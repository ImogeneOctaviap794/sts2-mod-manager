#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::io::Write;

fn setup_logging() {
    let log_dir = dirs::config_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("STS2ModManager");
    let _ = fs::create_dir_all(&log_dir);
    let log_path = log_dir.join("launch.log");
    if let Ok(mut f) = fs::File::create(&log_path) {
        let _ = writeln!(f, "[{}] App starting...", timestamp());
        let _ = writeln!(f, "  exe: {:?}", std::env::current_exe());
        let _ = writeln!(f, "  cwd: {:?}", std::env::current_dir());
        let _ = writeln!(f, "  args: {:?}", std::env::args().collect::<Vec<_>>());
    }
}

fn timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("{}", secs)
}

fn main() {
    setup_logging();

    // Catch panics and write to log
    let result = std::panic::catch_unwind(|| {
        sts2_mod_manager_lib::run();
    });

    if let Err(e) = result {
        let log_dir = dirs::config_dir()
            .unwrap_or_else(|| std::path::PathBuf::from("."))
            .join("STS2ModManager");
        let log_path = log_dir.join("launch.log");
        if let Ok(mut f) = fs::OpenOptions::new().append(true).open(&log_path) {
            let _ = writeln!(f, "[{}] PANIC: {:?}", timestamp(), e);
        }
        // Also show a message box on Windows
        #[cfg(target_os = "windows")]
        {
            let msg = format!("应用启动失败！\n日志位于: {}\n\n错误: {:?}", log_path.display(), e);
            unsafe {
                use std::ffi::CString;
                let text = CString::new(msg).unwrap_or_default();
                let title = CString::new("STS2 Mod Manager - Error").unwrap_or_default();
                winapi_messagebox(title.as_ptr(), text.as_ptr());
            }
        }
    }
}

#[cfg(target_os = "windows")]
unsafe fn winapi_messagebox(title: *const i8, text: *const i8) {
    #[link(name = "user32")]
    extern "system" {
        fn MessageBoxA(hwnd: *mut std::ffi::c_void, text: *const i8, caption: *const i8, utype: u32) -> i32;
    }
    MessageBoxA(std::ptr::null_mut(), text, title, 0x10); // MB_ICONERROR
}
