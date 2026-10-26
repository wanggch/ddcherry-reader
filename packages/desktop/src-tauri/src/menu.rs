use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::Emitter;

pub fn build_menu(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let app_handle = app.handle();

    let open_item = MenuItem::with_id(
        app_handle,
        "open-file",
        "Open File…",
        true,
        Some("CmdOrCtrl+O"),
    )?;

    let reload_item = MenuItem::with_id(
        app_handle,
        "reload-file",
        "Reload",
        true,
        Some("CmdOrCtrl+R"),
    )?;

    let theme_system = MenuItem::with_id(
        app_handle,
        "theme-system",
        "Follow System",
        true,
        None::<&str>,
    )?;
    let theme_light = MenuItem::with_id(app_handle, "theme-light", "Light", true, None::<&str>)?;
    let theme_paper = MenuItem::with_id(app_handle, "theme-paper", "Paper", true, None::<&str>)?;
    let theme_dark = MenuItem::with_id(app_handle, "theme-dark", "Dark", true, None::<&str>)?;
    let theme_black = MenuItem::with_id(app_handle, "theme-black", "Black", true, None::<&str>)?;

    let open_folder_item = MenuItem::with_id(
        app_handle,
        "open-folder",
        "Open Folder…",
        true,
        Some("CmdOrCtrl+Shift+O"),
    )?;

    let file_menu = Submenu::with_items(
        app_handle,
        "File",
        true,
        &[
            &open_item,
            &open_folder_item,
            &PredefinedMenuItem::separator(app_handle)?,
            &reload_item,
        ],
    )?;

    let theme_menu = Submenu::with_items(
        app_handle,
        "Theme",
        true,
        &[
            &theme_system,
            &PredefinedMenuItem::separator(app_handle)?,
            &theme_light,
            &theme_paper,
            &theme_dark,
            &theme_black,
        ],
    )?;

    let view_menu = Submenu::with_items(
        app_handle,
        "View",
        true,
        &[
            &theme_menu,
            &PredefinedMenuItem::separator(app_handle)?,
        ],
    )?;

    #[cfg(target_os = "macos")]
    let app_menu = {
        let quit_item = MenuItem::with_id(
            app_handle,
            "quit",
            "Quit DDCherry Reader",
            true,
            Some("CmdOrCtrl+Q"),
        )?;
        Submenu::with_items(
            app_handle,
            "DDCherry Reader",
            true,
            &[
                &PredefinedMenuItem::about(app_handle, Some("Markdown Reader Pro"), None)?,                &PredefinedMenuItem::separator(app_handle)?,
                &quit_item,
            ],
        )?
    };

    let menu = Menu::with_items(
        app_handle,
        &[
            #[cfg(target_os = "macos")]
            &app_menu,
            &file_menu,
            &view_menu,
        ],
    )?;

    app.set_menu(menu)?;

    app.on_menu_event(move |app, event| {
        let id = event.id.as_ref();
        match id {
            "open-file" => {
                app.emit("app:open-file-dialog", ()).ok();
            }
            "open-folder" => {
                app.emit("app:open-folder-dialog", ()).ok();
            }
            "reload-file" => {
                app.emit("app:reload-file", ()).ok();
            }
            "theme-system" => {
                app.emit("app:set-theme", "system").ok();
            }
            "theme-light" => {
                app.emit("app:set-theme", "light").ok();
            }
            "theme-paper" => {
                app.emit("app:set-theme", "paper").ok();
            }
            "theme-dark" => {
                app.emit("app:set-theme", "dark").ok();
            }
            "theme-black" => {
                app.emit("app:set-theme", "black").ok();
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        }
    });

    Ok(())
}
