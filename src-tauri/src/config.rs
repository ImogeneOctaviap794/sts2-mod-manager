use crate::AppState;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri_plugin_dialog::DialogExt;

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct Config {
    #[serde(rename = "gamePath")]
    pub game_path: Option<String>,
    #[serde(rename = "language", default = "default_language")]
    pub language: String,
}

fn default_language() -> String {
    "en".to_string()
}

#[derive(Serialize)]
pub struct InitResult {
    #[serde(rename = "gamePath")]
    pub game_path: Option<String>,
    #[serde(rename = "modsDir")]
    pub mods_dir: Option<String>,
}

fn config_dir() -> PathBuf {
    let base = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    base.join("STS2ModManager")
}

fn config_path() -> PathBuf {
    config_dir().join("config.json")
}

pub fn load_config() -> Config {
    let p = config_path();
    if p.exists() {
        if let Ok(content) = fs::read_to_string(&p) {
            if let Ok(cfg) = serde_json::from_str(&content) {
                return cfg;
            }
        }
    }
    Config::default()
}

pub fn save_config(cfg: &Config) {
    let dir = config_dir();
    let _ = fs::create_dir_all(&dir);
    if let Ok(json) = serde_json::to_string_pretty(cfg) {
        let _ = fs::write(config_path(), json);
    }
}

fn detect_game_path() -> Option<String> {
    // Windows Steam library paths
    let steam_paths = vec![
        r"C:\Program Files (x86)\Steam",
        r"C:\Program Files\Steam",
        r"D:\Steam",
        r"D:\SteamLibrary",
        r"E:\SteamLibrary",
    ];

    for sp in &steam_paths {
        let vdf_path = Path::new(sp)
            .join("steamapps")
            .join("libraryfolders.vdf");
        if vdf_path.exists() {
            if let Ok(content) = fs::read_to_string(&vdf_path) {
                // Parse "path" entries from VDF
                for cap in content.lines() {
                    if let Some(start) = cap.find("\"path\"") {
                        let rest = &cap[start + 6..];
                        if let Some(s) = rest.find('"') {
                            let rest2 = &rest[s + 1..];
                            if let Some(e) = rest2.find('"') {
                                let lib_path = rest2[..e].replace("\\\\", "\\");
                                let game_dir = Path::new(&lib_path)
                                    .join("steamapps")
                                    .join("common")
                                    .join("Slay the Spire 2");
                                if game_dir.exists() {
                                    return Some(game_dir.to_string_lossy().to_string());
                                }
                            }
                        }
                    }
                }
            }
        }
        // Direct check
        let game_dir = Path::new(sp)
            .join("steamapps")
            .join("common")
            .join("Slay the Spire 2");
        if game_dir.exists() {
            return Some(game_dir.to_string_lossy().to_string());
        }
    }

    let direct_paths = vec![
        r"D:\SteamLibrary\steamapps\common\Slay the Spire 2",
        r"C:\Program Files (x86)\Steam\steamapps\common\Slay the Spire 2",
    ];
    for p in direct_paths {
        if Path::new(p).exists() {
            return Some(p.to_string());
        }
    }
    None
}

#[tauri::command]
pub fn app_init(state: tauri::State<'_, AppState>) -> InitResult {
    let cfg = load_config();
    let detected = if let Some(ref gp) = cfg.game_path {
        if Path::new(gp).exists() {
            Some(gp.clone())
        } else {
            detect_game_path()
        }
    } else {
        detect_game_path()
    };

    if let Some(ref gp) = detected {
        let mut state_gp = state.game_path.lock().unwrap();
        *state_gp = Some(gp.clone());
        // Persist if auto-detected
        if cfg.game_path.as_deref() != Some(gp.as_str()) {
            let mut new_cfg = cfg;
            new_cfg.game_path = Some(gp.clone());
            save_config(&new_cfg);
        }
    }

    let mods_dir = detected
        .as_ref()
        .map(|p| Path::new(p).join("mods").to_string_lossy().to_string());

    InitResult {
        game_path: detected,
        mods_dir,
    }
}

#[tauri::command]
pub async fn app_select_game_path(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<Option<InitResult>, String> {
    let dialog = app.dialog();
    let folder = dialog
        .file()
        .set_title("选择 Slay the Spire 2 游戏目录")
        .blocking_pick_folder();

    if let Some(folder_path) = folder {
        let gp = folder_path.to_string();
        let mut state_gp = state.game_path.lock().unwrap();
        *state_gp = Some(gp.clone());

        let mut cfg = load_config();
        cfg.game_path = Some(gp.clone());
        save_config(&cfg);

        let mods_dir = Path::new(&gp).join("mods").to_string_lossy().to_string();
        Ok(Some(InitResult {
            game_path: Some(gp),
            mods_dir: Some(mods_dir),
        }))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub fn get_language() -> String {
    let cfg = load_config();
    cfg.language
}

#[tauri::command]
pub fn set_language(language: String) -> Result<(), String> {
    let mut cfg = load_config();
    cfg.language = language;
    save_config(&cfg);
    Ok(())
}
