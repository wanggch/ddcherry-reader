mod file;
mod menu;
mod storage;

use file::{
    file_exists, list_directory, read_file, unwatch_file, watch_file, FileWatcherState,
};
use storage::{get_all_preferences, get_preference, remove_preference, set_preference};
use tauri::webview::WebviewWindow;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(FileWatcherState {
            watchers: Default::default(),
        })
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            read_file,
            file_exists,
            watch_file,
            unwatch_file,
            list_directory,
            get_all_preferences,
            get_preference,
            set_preference,
            remove_preference,
            get_initial_file,
            print_window
        ])
        .setup(|app| {
            menu::build_menu(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn get_initial_file() -> Option<String> {
    std::env::args().nth(1)
}

#[tauri::command]
fn print_window(window: WebviewWindow) -> Result<(), String> {
    window.print().map_err(|e| e.to_string())
}
