mod persistence;
mod platform;

use tauri::Manager;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn load_pet_state(app: tauri::AppHandle) -> Result<Option<persistence::PersistedPetState>, String> {
    persistence::load_pet_state(app)
}

#[tauri::command]
fn save_pet_state(
    app: tauri::AppHandle,
    state: persistence::PersistedPetState,
) -> Result<(), String> {
    persistence::save_pet_state(app, state)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            platform::cursor::install(app)?;
            platform::tray::install(app)?;
            if let Some(window) = app.get_webview_window("main") {
                window.show()?;
                window.set_focus()?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            load_pet_state,
            save_pet_state
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
