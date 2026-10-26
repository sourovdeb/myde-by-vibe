//! Windows tray (step 10): On/Off toggle, Open Settings, Copy URL, Quit.
//! Behind the `tray` feature; requires a Win32 event loop on the thread
//! that creates the icon — so the tray runs on the main thread and the
//! HTTP servers move to background threads.

use std::sync::Arc;

use crate::bridge::Bridge;
use crate::config::Config;

pub enum TrayAction {
    Toggle,
    Settings,
    CopyUrl,
    Quit,
}

#[cfg(all(windows, feature = "tray"))]
pub fn run_tray(bridge: Arc<Bridge>, cfg: Config) {
    use tray_icon::menu::{CheckMenuItem, Menu, MenuEvent, MenuId, MenuItem, PredefinedMenuItem};
    use tray_icon::{TrayIcon, TrayIconBuilder};

    let _ = &cfg;

    let toggle = CheckMenuItem::with_id(MenuId::new("toggle"), "Enabled", true, true, None);
    let settings = MenuItem::with_id(MenuId::new("settings"), "Open Settings", true, None);
    let copy_url = MenuItem::with_id(MenuId::new("copy"), "Copy connector URL", true, None);
    let quit = MenuItem::with_id(MenuId::new("quit"), "Quit", true, None);

    let menu = Menu::new();
    let _ = menu.append_items(&[&toggle, &settings, &copy_url, &PredefinedMenuItem::separator(), &quit]);

    // plain built-in icon (no resource file dependency)
    let icon = tray_icon::Icon::from_rgba(
        vec![0u8; 32 * 32 * 4],
        32,
        32,
    );

    let mut tray: Option<TrayIcon> = None;

    // Win32 message loop: tray-icon on Windows needs GetMessage-style pumping.
    // tray-icon's docs route events via channel receivers; we poll them from
    // the loop below.
    let mut toggle_on = bridge.cfg.read().unwrap().enabled;

    // event loop: pump messages via winit-free Win32 loop
    // (tray-icon on Windows does not require winit; it needs a win32 event
    // loop on the thread, which we implement with a message-only window pump)
    unsafe {
        // Create a message-only window to own the tray icon's messages.
        // tray-icon creates its own hidden window internally; pumping
        // messages with PeekMessage/GetMessage is sufficient.
        pump_messages(bridge.clone(), &menu, &toggle, &settings, &copy_url, &quit, &mut toggle_on, &mut tray, icon.ok());
    }
    let _ = (&settings, &copy_url, &quit, &tray);
}

#[cfg(all(windows, feature = "tray"))]
unsafe fn pump_messages(
    bridge: Arc<Bridge>,
    menu: &tray_icon::menu::Menu,
    toggle: &tray_icon::menu::CheckMenuItem,
    _settings: &tray_icon::menu::MenuItem,
    _copy: &tray_icon::menu::MenuItem,
    _quit: &tray_icon::menu::MenuItem,
    toggle_on: &mut bool,
    tray: &mut Option<tray_icon::TrayIcon>,
    icon: Option<tray_icon::Icon>,
) {
    use tray_icon::{TrayIconBuilder, TrayIconEvent};
    let _ = menu;

    if let Some(icon) = icon {
        *tray = Some(
            TrayIconBuilder::new()
                .with_menu(Box::new(menu.clone()))
                .with_tooltip("mcp-bridge")
                .with_icon(icon)
                .build()
                .unwrap(),
        );
    }

    loop {
        // pump Win32 messages (tray + menu events ride on this thread)
        let mut msg = windows_sys::Win32::UI::WindowsAndMessaging::MSG { hwnd: std::ptr::null_mut(), message: 0, wParam: 0, lParam: 0, time: 0, pt: windows_sys::Win32::Foundation::POINT { x: 0, y: 0 } };
        while windows_sys::Win32::UI::WindowsAndMessaging::PeekMessageW(&mut msg, 0 as _, 0, 0, 1) != 0 {
            windows_sys::Win32::UI::WindowsAndMessaging::TranslateMessage(&msg);
            windows_sys::Win32::UI::WindowsAndMessaging::DispatchMessageW(&msg);
        }

        // menu events
        if let Ok(ev) = tray_icon::menu::MenuEvent::receiver().try_recv() {
            match ev.id().0.as_str() {
                "toggle" => {
                    *toggle_on = !*toggle_on;
                    bridge.cfg.write().unwrap().enabled = *toggle_on;
                    let snapshot = bridge.cfg.read().unwrap().clone();
                    let _ = crate::config::save_config(&snapshot);
                    let _ = toggle.set_checked(*toggle_on);
                }
                "settings" => {
                    let admin = format!("http://127.0.0.1:{}/", bridge.cfg.read().unwrap().admin_port);
                    let _ = std::process::Command::new("cmd")
                        .args(["/C", "start", "", &admin])
                        .spawn();
                }
                "copy" => {
                    let cfg = bridge.cfg.read().unwrap();
                    let url = if cfg.public_url.is_empty() {
                        format!("http://127.0.0.1:{}/mcp", cfg.port)
                    } else {
                        cfg.public_url.clone()
                    };
                    let _ = std::process::Command::new("cmd")
                        .args(["/C", "echo", &url, "|", "clip"])
                        .spawn();
                }
                "quit" => {
                    let mut cfg = bridge.cfg.write().unwrap();
                    cfg.enabled = false;
                    drop(cfg);
                    std::process::exit(0);
                }
                _ => {}
            }
        }
        if let Ok(_ev) = TrayIconEvent::receiver().try_recv() {
            // clicks; nothing extra needed
        }
        std::thread::sleep(std::time::Duration::from_millis(50));
    }
}

#[cfg(not(all(windows, feature = "tray")))]
pub fn run_tray(_bridge: Arc<Bridge>, _cfg: Config) {
    // no tray on this platform/build; caller runs servers in the foreground
}
