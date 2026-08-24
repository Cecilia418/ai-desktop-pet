use std::{
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    thread,
    time::Duration,
};

use serde::Serialize;
use tauri::{App, AppHandle, Emitter, Manager};

const MAIN_WINDOW_LABEL: &str = "main";
const CURSOR_MOVED_EVENT: &str = "platform://cursor-moved";

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
struct CursorSnapshot {
    cursor_x: i32,
    cursor_y: i32,
    window_x: i32,
    window_y: i32,
    scale_factor: f64,
    left_button_down: bool,
}

pub fn install(app: &mut App) -> tauri::Result<()> {
    #[cfg(target_os = "windows")]
    {
        let app_handle = app.handle().clone();
        let stop = Arc::new(AtomicBool::new(false));
        let thread_stop = Arc::clone(&stop);
        let spawn_result = thread::Builder::new()
            .name("desktop-cursor-monitor".to_string())
            .spawn(move || monitor_loop(app_handle, thread_stop));

        if let Err(error) = spawn_result {
            eprintln!("failed to start desktop cursor monitor: {error}");
        }
    }

    Ok(())
}

#[cfg(target_os = "windows")]
fn monitor_loop(app: AppHandle, stop: Arc<AtomicBool>) {
    while !stop.load(Ordering::Relaxed) {
        if let Some(snapshot) = read_snapshot(&app) {
            // Emit continuously so a listener that starts after the first sample
            // still receives the current hit-test state without waiting for a
            // physical cursor or window movement.
            let _ = app.emit(CURSOR_MOVED_EVENT, snapshot);
        }

        thread::sleep(Duration::from_millis(33));
    }
}

#[cfg(target_os = "windows")]
fn read_snapshot(app: &AppHandle) -> Option<CursorSnapshot> {
    use windows_sys::Win32::{
        Foundation::POINT,
        UI::{
            Input::KeyboardAndMouse::{GetAsyncKeyState, VK_LBUTTON},
            WindowsAndMessaging::GetCursorPos,
        },
    };

    let window = app.get_webview_window(MAIN_WINDOW_LABEL)?;
    let mut cursor = POINT { x: 0, y: 0 };

    let cursor_read = unsafe { GetCursorPos(&mut cursor) };
    if cursor_read == 0 {
        return None;
    }

    let window_position = window.outer_position().ok()?;
    let scale_factor = window.scale_factor().ok()?;
    let left_button_down = unsafe { GetAsyncKeyState(VK_LBUTTON as i32) < 0 };

    Some(CursorSnapshot {
        cursor_x: cursor.x,
        cursor_y: cursor.y,
        window_x: window_position.x,
        window_y: window_position.y,
        scale_factor,
        left_button_down,
    })
}
