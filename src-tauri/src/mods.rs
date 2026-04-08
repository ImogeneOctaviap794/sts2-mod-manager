use crate::AppState;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use tauri_plugin_dialog::DialogExt;

const DISABLED_DIR: &str = "mods_disabled";
const LEGACY_DISABLED_DIR: &str = "_disabled";

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ModInfo {
    pub id: Option<String>,
    pub name: Option<String>,
    pub author: Option<String>,
    pub version: Option<String>,
    pub description: Option<String>,
    pub dependencies: Option<Vec<String>>,
    pub affects_gameplay: Option<bool>,
    pub has_dll: Option<bool>,
    pub has_pck: Option<bool>,
    pub enabled: bool,
    #[serde(rename = "instanceKey")]
    pub instance_key: String,
    #[serde(rename = "folderName")]
    pub folder_name: String,
    #[serde(rename = "isFolder")]
    pub is_folder: bool,
    pub path: String,
    pub files: Vec<String>,
    pub size: u64,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ToggleModInfo {
    #[serde(rename = "isFolder")]
    pub is_folder: bool,
    #[serde(rename = "folderName")]
    pub folder_name: String,
    pub files: Option<Vec<String>>,
    pub enabled: bool,
}

#[derive(Serialize)]
pub struct ModResult {
    pub success: bool,
    pub error: Option<String>,
    pub mods: Option<Vec<ModInfo>>,
    pub installed: Option<Vec<String>>,
}

fn get_mods_dir(game_path: &str) -> PathBuf {
    Path::new(game_path).join("mods")
}

fn get_disabled_dir(game_path: &str) -> PathBuf {
    let dir = Path::new(game_path).join(DISABLED_DIR);
    if !dir.exists() {
        let _ = fs::create_dir_all(&dir);
    }
    dir
}

fn get_legacy_disabled_dir(game_path: &str) -> PathBuf {
    get_mods_dir(game_path).join(LEGACY_DISABLED_DIR)
}

fn migrate_legacy_disabled(game_path: &str) {
    let legacy = get_legacy_disabled_dir(game_path);
    let disabled = get_disabled_dir(game_path);
    if !legacy.exists() {
        return;
    }
    if let Ok(entries) = fs::read_dir(&legacy) {
        for entry in entries.flatten() {
            let dst = disabled.join(entry.file_name());
            if !dst.exists() {
                let _ = fs::rename(entry.path(), dst);
            }
        }
    }
    if legacy.exists() {
        if let Ok(entries) = fs::read_dir(&legacy) {
            if entries.count() == 0 {
                let _ = fs::remove_dir(&legacy);
            }
        }
    }
}

fn read_json_file(path: &Path) -> Option<serde_json::Value> {
    let mut content = fs::read_to_string(path).ok()?;
    // Strip BOM
    if content.starts_with('\u{feff}') {
        content = content[3..].to_string();
    }
    serde_json::from_str(&content).ok()
}

fn dir_size(path: &Path) -> u64 {
    let mut size = 0u64;
    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_dir() {
                size += dir_size(&p);
            } else if let Ok(meta) = p.metadata() {
                size += meta.len();
            }
        }
    }
    size
}

fn try_parse_mod(full_path: &Path, item_name: &str, enabled: bool) -> Option<ModInfo> {
    let meta = fs::metadata(full_path).ok()?;

    if meta.is_dir() {
        // Folder mod
        let entries: Vec<String> = fs::read_dir(full_path)
            .ok()?
            .flatten()
            .filter_map(|e| e.file_name().to_str().map(String::from))
            .collect();

        let json_files: Vec<&String> = entries.iter().filter(|f| f.ends_with(".json")).collect();
        for jf in json_files {
            let json_path = full_path.join(jf);
            if let Some(data) = read_json_file(&json_path) {
                if data.get("id").and_then(|v| v.as_str()).is_some()
                    && data.get("name").and_then(|v| v.as_str()).is_some()
                {
                    let has_dll = entries.iter().any(|f| f.ends_with(".dll"));
                    let has_pck = entries.iter().any(|f| f.ends_with(".pck"));
                    return Some(ModInfo {
                        id: data.get("id").and_then(|v| v.as_str()).map(String::from),
                        name: data.get("name").and_then(|v| v.as_str()).map(String::from),
                        author: data.get("author").and_then(|v| v.as_str()).map(String::from),
                        version: data.get("version").and_then(|v| v.as_str()).map(String::from),
                        description: data
                            .get("description")
                            .and_then(|v| v.as_str())
                            .map(String::from),
                        dependencies: data.get("dependencies").and_then(|v| {
                            v.as_array().map(|arr| {
                                arr.iter()
                                    .filter_map(|x| x.as_str().map(String::from))
                                    .collect()
                            })
                        }),
                        affects_gameplay: data
                            .get("affects_gameplay")
                            .and_then(|v| v.as_bool()),
                        has_dll: Some(has_dll),
                        has_pck: Some(has_pck),
                        enabled,
                        instance_key: full_path.to_string_lossy().to_string(),
                        folder_name: item_name.to_string(),
                        is_folder: true,
                        path: full_path.to_string_lossy().to_string(),
                        files: entries,
                        size: dir_size(full_path),
                    });
                }
            }
        }
    } else if item_name.ends_with(".json") && !item_name.starts_with('.') {
        // Flat mod
        if let Some(data) = read_json_file(full_path) {
            if data.get("id").and_then(|v| v.as_str()).is_some()
                && data.get("name").and_then(|v| v.as_str()).is_some()
            {
                let base_name = item_name.trim_end_matches(".json");
                let parent = full_path.parent()?;
                let mut related_files = Vec::new();
                let mut total_size = meta.len();

                if let Ok(entries) = fs::read_dir(parent) {
                    for entry in entries.flatten() {
                        let fname = entry.file_name().to_string_lossy().to_string();
                        if fname.starts_with(&format!("{}.", base_name)) && fname != item_name {
                            related_files.push(fname);
                            if let Ok(m) = entry.metadata() {
                                total_size += m.len();
                            }
                        }
                    }
                }

                let has_dll = related_files.iter().any(|f| f.ends_with(".dll"));
                let has_pck = related_files.iter().any(|f| f.ends_with(".pck"));

                let mut files = vec![item_name.to_string()];
                files.extend(related_files);

                return Some(ModInfo {
                    id: data.get("id").and_then(|v| v.as_str()).map(String::from),
                    name: data.get("name").and_then(|v| v.as_str()).map(String::from),
                    author: data.get("author").and_then(|v| v.as_str()).map(String::from),
                    version: data.get("version").and_then(|v| v.as_str()).map(String::from),
                    description: data
                        .get("description")
                        .and_then(|v| v.as_str())
                        .map(String::from),
                    dependencies: data.get("dependencies").and_then(|v| {
                        v.as_array().map(|arr| {
                            arr.iter()
                                .filter_map(|x| x.as_str().map(String::from))
                                .collect()
                        })
                    }),
                    affects_gameplay: data.get("affects_gameplay").and_then(|v| v.as_bool()),
                    has_dll: Some(has_dll),
                    has_pck: Some(has_pck),
                    enabled,
                    instance_key: full_path.to_string_lossy().to_string(),
                    folder_name: base_name.to_string(),
                    is_folder: false,
                    path: parent.to_string_lossy().to_string(),
                    files,
                    size: total_size,
                });
            }
        }
    }
    None
}

pub fn scan_mods_internal(game_path: &str) -> Vec<ModInfo> {
    let mods_dir = get_mods_dir(game_path);
    if !mods_dir.exists() {
        return vec![];
    }

    migrate_legacy_disabled(game_path);
    let mut mods = Vec::new();

    // Scan enabled mods
    if let Ok(entries) = fs::read_dir(&mods_dir) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name == LEGACY_DISABLED_DIR {
                continue;
            }
            if let Some(m) = try_parse_mod(&entry.path(), &name, true) {
                mods.push(m);
            }
        }
    }

    // Scan disabled mods
    let disabled_dir = get_disabled_dir(game_path);
    if disabled_dir.exists() {
        if let Ok(entries) = fs::read_dir(&disabled_dir) {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                if let Some(m) = try_parse_mod(&entry.path(), &name, false) {
                    mods.push(m);
                }
            }
        }
    }

    // Sort: enabled first, then alphabetical
    mods.sort_by(|a, b| {
        if a.enabled != b.enabled {
            return if a.enabled {
                std::cmp::Ordering::Less
            } else {
                std::cmp::Ordering::Greater
            };
        }
        let a_name = a.name.as_deref().unwrap_or("");
        let b_name = b.name.as_deref().unwrap_or("");
        a_name.to_lowercase().cmp(&b_name.to_lowercase())
    });

    mods
}

fn find_folder_mod_location(game_path: &str, folder_name: &str) -> Option<PathBuf> {
    let roots = vec![
        get_mods_dir(game_path),
        get_disabled_dir(game_path),
        get_legacy_disabled_dir(game_path),
    ];
    for root in roots {
        let candidate = root.join(folder_name);
        if candidate.exists() {
            return Some(candidate);
        }
    }
    None
}

fn find_flat_mod_base_dir(game_path: &str, files: &[String]) -> Option<PathBuf> {
    let roots = vec![
        get_mods_dir(game_path),
        get_disabled_dir(game_path),
        get_legacy_disabled_dir(game_path),
    ];
    for root in roots {
        if files.iter().any(|f| root.join(f).exists()) {
            return Some(root);
        }
    }
    None
}

#[tauri::command]
pub fn mods_scan(state: tauri::State<'_, AppState>) -> Vec<ModInfo> {
    let gp = state.game_path.lock().unwrap();
    match &*gp {
        Some(p) => scan_mods_internal(p),
        None => vec![],
    }
}

#[tauri::command]
pub fn mods_toggle(
    state: tauri::State<'_, AppState>,
    mod_info: ToggleModInfo,
) -> ModResult {
    let gp = state.game_path.lock().unwrap();
    let game_path = match &*gp {
        Some(p) => p.clone(),
        None => {
            return ModResult {
                success: false,
                error: Some("Game path not set".into()),
                mods: None,
                installed: None,
            }
        }
    };
    drop(gp);

    let mods_dir = get_mods_dir(&game_path);
    let disabled_dir = get_disabled_dir(&game_path);

    if mod_info.is_folder {
        if let Some(src) = find_folder_mod_location(&game_path, &mod_info.folder_name) {
            let src_parent = src.parent().unwrap_or(Path::new(""));
            let dst = if src_parent == mods_dir.as_path() {
                disabled_dir.join(&mod_info.folder_name)
            } else {
                mods_dir.join(&mod_info.folder_name)
            };
            if src != dst {
                if let Err(e) = fs::rename(&src, &dst) {
                    return ModResult {
                        success: false,
                        error: Some(format!("移动失败: {}", e)),
                        mods: None,
                        installed: None,
                    };
                }
            }
        } else {
            return ModResult {
                success: false,
                error: Some(format!("找不到 MOD 文件夹: {}", mod_info.folder_name)),
                mods: None,
                installed: None,
            };
        }
    } else {
        let files = mod_info.files.unwrap_or_default();
        if let Some(src_dir) = find_flat_mod_base_dir(&game_path, &files) {
            let dst_dir = if src_dir == mods_dir {
                &disabled_dir
            } else {
                &mods_dir
            };
            for file in &files {
                let src = src_dir.join(file);
                let dst = dst_dir.join(file);
                if src.exists() {
                    let _ = fs::rename(&src, &dst);
                }
            }
        } else {
            return ModResult {
                success: false,
                error: Some("找不到 MOD 文件".into()),
                mods: None,
                installed: None,
            };
        }
    }

    ModResult {
        success: true,
        error: None,
        mods: Some(scan_mods_internal(&game_path)),
        installed: None,
    }
}

#[tauri::command]
pub fn mods_uninstall(
    state: tauri::State<'_, AppState>,
    mod_info: ToggleModInfo,
) -> ModResult {
    let gp = state.game_path.lock().unwrap();
    let game_path = match &*gp {
        Some(p) => p.clone(),
        None => {
            return ModResult {
                success: false,
                error: Some("Game path not set".into()),
                mods: None,
                installed: None,
            }
        }
    };
    drop(gp);

    if mod_info.is_folder {
        if let Some(mod_path) = find_folder_mod_location(&game_path, &mod_info.folder_name) {
            if let Err(e) = fs::remove_dir_all(&mod_path) {
                return ModResult {
                    success: false,
                    error: Some(format!("删除失败: {}", e)),
                    mods: None,
                    installed: None,
                };
            }
        }
    } else {
        let files = mod_info.files.unwrap_or_default();
        if let Some(base_dir) = find_flat_mod_base_dir(&game_path, &files) {
            for file in &files {
                let fp = base_dir.join(file);
                if fp.exists() {
                    let _ = fs::remove_file(&fp);
                }
            }
        }
    }

    ModResult {
        success: true,
        error: None,
        mods: Some(scan_mods_internal(&game_path)),
        installed: None,
    }
}

fn smart_extract_zip(zip_path: &str, mods_dir: &Path) -> Result<(), String> {
    let file = fs::File::open(zip_path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;

    // Check if all entries share a single root folder
    let mut top_dirs = std::collections::HashSet::new();
    let mut has_root_file = false;
    for i in 0..archive.len() {
        let entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let name = entry.mangled_name();
        let parts: Vec<_> = name.components().collect();
        if parts.len() == 1 && !entry.is_dir() {
            has_root_file = true;
            break;
        }
        if let Some(first) = parts.first() {
            top_dirs.insert(first.as_os_str().to_string_lossy().to_string());
        }
    }

    let dest = if !has_root_file && top_dirs.len() == 1 {
        // Already has a single root folder, extract directly
        mods_dir.to_path_buf()
    } else {
        // Loose files — create subfolder from zip filename
        let base_name = Path::new(zip_path)
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| "unknown_mod".to_string());
        let sub_dir = mods_dir.join(&base_name);
        let _ = fs::create_dir_all(&sub_dir);
        sub_dir
    };

    // Re-open archive for extraction
    let file2 = fs::File::open(zip_path).map_err(|e| e.to_string())?;
    let mut archive2 = zip::ZipArchive::new(file2).map_err(|e| e.to_string())?;
    for i in 0..archive2.len() {
        let mut entry = archive2.by_index(i).map_err(|e| e.to_string())?;
        let out_path = dest.join(entry.mangled_name());
        if entry.is_dir() {
            let _ = fs::create_dir_all(&out_path);
        } else {
            if let Some(parent) = out_path.parent() {
                let _ = fs::create_dir_all(parent);
            }
            let mut outfile = fs::File::create(&out_path).map_err(|e| e.to_string())?;
            std::io::copy(&mut entry, &mut outfile).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn mods_install(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<ModResult, String> {
    let gp = state.game_path.lock().unwrap().clone();
    let game_path = match gp {
        Some(p) => p,
        None => {
            return Ok(ModResult {
                success: false,
                error: Some("Game path not set".into()),
                mods: None,
                installed: None,
            })
        }
    };

    let mods_dir = get_mods_dir(&game_path);
    let dialog = app.dialog();
    let files = dialog
        .file()
        .set_title("Select MOD Archive")
        .add_filter("Archives", &["zip"])
        .blocking_pick_files();

    let file_paths = match files {
        Some(paths) => paths,
        None => {
            return Ok(ModResult {
                success: false,
                error: Some("Cancelled".into()),
                mods: None,
                installed: None,
            })
        }
    };

    let mut installed = Vec::new();
    for fp in &file_paths {
        let path_str = fp.to_string();
        if let Err(e) = smart_extract_zip(&path_str, &mods_dir) {
            return Ok(ModResult {
                success: false,
                error: Some(format!("解压失败: {}", e)),
                mods: None,
                installed: None,
            });
        }
        installed.push(
            Path::new(&path_str)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default(),
        );
    }

    Ok(ModResult {
        success: true,
        error: None,
        mods: Some(scan_mods_internal(&game_path)),
        installed: Some(installed),
    })
}

#[tauri::command]
pub fn mods_install_drop(
    state: tauri::State<'_, AppState>,
    file_paths: Vec<String>,
) -> ModResult {
    let gp = state.game_path.lock().unwrap().clone();
    let game_path = match gp {
        Some(p) => p,
        None => {
            return ModResult {
                success: false,
                error: Some("Game path not set".into()),
                mods: None,
                installed: None,
            }
        }
    };

    let mods_dir = get_mods_dir(&game_path);
    let mut installed = Vec::new();

    for fp in &file_paths {
        if let Err(e) = smart_extract_zip(fp, &mods_dir) {
            return ModResult {
                success: false,
                error: Some(format!("解压失败: {}", e)),
                mods: None,
                installed: None,
            };
        }
        installed.push(
            Path::new(fp)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default(),
        );
    }

    ModResult {
        success: true,
        error: None,
        mods: Some(scan_mods_internal(&game_path)),
        installed: Some(installed),
    }
}

fn create_zip_from_dir(source: &Path, zip_path: &str) -> Result<(), String> {
    let file = fs::File::create(zip_path).map_err(|e| e.to_string())?;
    let mut zip_writer = zip::ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    fn add_dir_to_zip(
        zip_writer: &mut zip::ZipWriter<fs::File>,
        base: &Path,
        current: &Path,
        options: zip::write::SimpleFileOptions,
    ) -> Result<(), String> {
        if let Ok(entries) = fs::read_dir(current) {
            for entry in entries.flatten() {
                let path = entry.path();
                let rel = path
                    .strip_prefix(base)
                    .map_err(|e| e.to_string())?
                    .to_string_lossy()
                    .to_string();
                if path.is_dir() {
                    let _ = zip_writer.add_directory(&format!("{}/", rel), options);
                    add_dir_to_zip(zip_writer, base, &path, options)?;
                } else {
                    zip_writer
                        .start_file(&rel, options)
                        .map_err(|e| e.to_string())?;
                    let mut f = fs::File::open(&path).map_err(|e| e.to_string())?;
                    let mut buf = Vec::new();
                    f.read_to_end(&mut buf).map_err(|e| e.to_string())?;
                    std::io::Write::write_all(zip_writer, &buf).map_err(|e| e.to_string())?;
                }
            }
        }
        Ok(())
    }

    add_dir_to_zip(&mut zip_writer, source, source, options)?;
    zip_writer.finish().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn mods_backup(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<ModResult, String> {
    let gp = state.game_path.lock().unwrap().clone();
    let game_path = match gp {
        Some(p) => p,
        None => {
            return Ok(ModResult {
                success: false,
                error: Some("Game path not set".into()),
                mods: None,
                installed: None,
            })
        }
    };

    let mods_dir = get_mods_dir(&game_path);
    let dialog = app.dialog();
    let default_name = format!(
        "sts2_mods_backup_{}.zip",
        chrono_timestamp()
    );

    let save_path = dialog
        .file()
        .set_title("Save MOD Backup")
        .set_file_name(&default_name)
        .add_filter("ZIP Archive", &["zip"])
        .blocking_save_file();

    match save_path {
        Some(path) => {
            let path_str = path.to_string();
            if let Err(e) = create_zip_from_dir(&mods_dir, &path_str) {
                return Ok(ModResult {
                    success: false,
                    error: Some(e),
                    mods: None,
                    installed: None,
                });
            }
            Ok(ModResult {
                success: true,
                error: None,
                mods: None,
                installed: None,
            })
        }
        None => Ok(ModResult {
            success: false,
            error: None,
            mods: None,
            installed: None,
        }),
    }
}

#[tauri::command]
pub async fn mods_restore(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<ModResult, String> {
    let gp = state.game_path.lock().unwrap().clone();
    let game_path = match gp {
        Some(p) => p,
        None => {
            return Ok(ModResult {
                success: false,
                error: Some("Game path not set".into()),
                mods: None,
                installed: None,
            })
        }
    };

    let mods_dir = get_mods_dir(&game_path);
    let dialog = app.dialog();
    let file = dialog
        .file()
        .set_title("Select MOD Backup")
        .add_filter("ZIP Archive", &["zip"])
        .blocking_pick_file();

    match file {
        Some(path) => {
            let path_str = path.to_string();
            if let Err(e) = smart_extract_zip(&path_str, &mods_dir) {
                return Ok(ModResult {
                    success: false,
                    error: Some(e),
                    mods: None,
                    installed: None,
                });
            }
            Ok(ModResult {
                success: true,
                error: None,
                mods: Some(scan_mods_internal(&game_path)),
                installed: None,
            })
        }
        None => Ok(ModResult {
            success: false,
            error: None,
            mods: None,
            installed: None,
        }),
    }
}

fn chrono_timestamp() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    now.to_string()
}
