mod config;
mod game;
mod logs;
mod mods;
mod profiles;
mod saves;
mod translate;
mod translations;

use std::sync::Mutex;
use tauri::Manager;

pub struct AppState {
    pub game_path: Mutex<Option<String>>,
    pub game_state: Mutex<String>, // "idle" | "launching" | "running"
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .manage(AppState {
            game_path: Mutex::new(None),
            game_state: Mutex::new("idle".to_string()),
        })
        .invoke_handler(tauri::generate_handler![
            // App
            config::app_init,
            config::app_select_game_path,
            config::get_language,
            config::set_language,
            // Window
            window_minimize,
            window_maximize,
            window_close,
            // Mods
            mods::mods_scan,
            mods::mods_toggle,
            mods::mods_uninstall,
            mods::mods_install,
            mods::mods_install_drop,
            mods::mods_backup,
            mods::mods_restore,
            // Shell
            shell_open_mods_dir,
            shell_open_game_dir,
            shell_open_logs_dir,
            shell_open_saves_dir,
            shell_open_url,
            // Game
            game::game_launch,
            game::game_get_state,
            game::game_get_version,
            game::game_analyze_crash,
            // Logs
            logs::logs_get_latest,
            logs::logs_read,
            // Profiles
            profiles::profiles_load,
            profiles::profiles_save,
            // Translate
            translate::translate_text,
            // Translations persistence
            translations::translations_load,
            translations::translations_save,
            // Saves
            saves::saves_scan,
            saves::saves_export,
            saves::saves_import,
            saves::saves_delete_backup,
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| {
            eprintln!("Tauri error: {}", e);
            let log_dir = dirs::config_dir()
                .unwrap_or_else(|| std::path::PathBuf::from("."))
                .join("STS2ModManager");
            let log_path = log_dir.join("launch.log");
            if let Ok(mut f) = std::fs::OpenOptions::new().append(true).open(&log_path) {
                use std::io::Write;
                let _ = writeln!(f, "Tauri error: {}", e);
            }
            panic!("Tauri error: {}", e);
        });
}

// ── Window commands ──

#[tauri::command]
fn window_minimize(window: tauri::Window) {
    let _ = window.minimize();
}

#[tauri::command]
fn window_maximize(window: tauri::Window) {
    if window.is_maximized().unwrap_or(false) {
        let _ = window.unmaximize();
    } else {
        let _ = window.maximize();
    }
}

#[tauri::command]
fn window_close(window: tauri::Window) {
    let _ = window.close();
}

// ── Shell commands ──

fn get_appdata_dir() -> Option<std::path::PathBuf> {
    dirs::config_dir()
}

#[tauri::command]
fn shell_open_mods_dir(state: tauri::State<'_, AppState>) {
    let gp = state.game_path.lock().unwrap();
    if let Some(ref p) = *gp {
        let mods_dir = std::path::Path::new(p).join("mods");
        if mods_dir.exists() {
            let _ = opener::open(mods_dir.to_string_lossy().to_string());
        }
    }
}

#[tauri::command]
fn shell_open_game_dir(state: tauri::State<'_, AppState>) {
    let gp = state.game_path.lock().unwrap();
    if let Some(ref p) = *gp {
        let _ = opener::open(p.clone());
    }
}

#[tauri::command]
fn shell_open_logs_dir() {
    if let Some(appdata) = get_appdata_dir() {
        let logs_dir = appdata.join("SlayTheSpire2").join("logs");
        if logs_dir.exists() {
            let _ = opener::open(logs_dir.to_string_lossy().to_string());
        }
    }
}

#[tauri::command]
fn shell_open_saves_dir() {
    if let Some(appdata) = get_appdata_dir() {
        let saves_dir = appdata.join("SlayTheSpire2");
        if saves_dir.exists() {
            let _ = opener::open(saves_dir.to_string_lossy().to_string());
        }
    }
}

#[tauri::command]
fn shell_open_url(url: String) {
    if url.starts_with("https://") || url.starts_with("http://") {
        let _ = opener::open_browser(url);
    }
}
