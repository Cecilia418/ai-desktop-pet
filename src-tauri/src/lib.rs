mod ai;
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
        .manage(ai::AiBackend::default())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
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
            save_pet_state,
            ai::ai_get_configuration_status,
            ai::ai_save_api_key,
            ai::ai_delete_api_key,
            ai::ai_test_connection,
            ai::ai_chat_completion,
            ai::ai_cancel_request
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
