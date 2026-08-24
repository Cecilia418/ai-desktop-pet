use serde::Serialize;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    App, AppHandle, Emitter, Manager,
};

const MAIN_WINDOW_LABEL: &str = "main";
const WINDOW_VISIBILITY_EVENT: &str = "platform://window-visibility";

#[derive(Clone, Debug, Serialize)]
struct WindowVisibilitySnapshot {
    visible: bool,
}

pub fn install(app: &mut App) -> tauri::Result<()> {
    let show_item = MenuItem::with_id(app, "show", "叫女儿回来", true, None::<&str>)?;
    let hide_item = MenuItem::with_id(app, "hide", "隐藏女儿", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "退出程序", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_item, &hide_item, &quit_item])?;
    let icon = tray_icon();

    TrayIconBuilder::new()
        .menu(&menu)
        .icon(icon)
        .tooltip("桌面女儿")
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => set_window_visible(app, true),
            "hide" => set_window_visible(app, false),
            "quit" => app.exit(0),
            _ => {}
        })
        .build(app)?;

    Ok(())
}

fn tray_icon() -> tauri::image::Image<'static> {
    let mut pixels = Vec::with_capacity(16 * 16 * 4);
    for _ in 0..(16 * 16) {
        pixels.extend_from_slice(&[0xB9, 0x98, 0xD8, 0xFF]);
    }

    tauri::image::Image::new_owned(pixels, 16, 16)
}

fn set_window_visible(app: &AppHandle, visible: bool) {
    let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        return;
    };

    let result = if visible {
        window.show().and_then(|_| window.set_focus())
    } else {
        window.hide()
    };

    match result {
        Ok(()) => {
            let _ = app.emit(
                WINDOW_VISIBILITY_EVENT,
                WindowVisibilitySnapshot { visible },
            );
        }
        Err(error) => {
            eprintln!("desktop window visibility change failed: {error}");
        }
    }
}
