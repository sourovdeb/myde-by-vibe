//! Window control for allow-listed apps.
//! List, focus, and type only. No hotkeys, no mouse, no new programs.
//! Starting a program is `run_task`, and that stays on the command allow list.

use std::path::Path;

pub fn validate(apps: &[String], action: &str, target: &str, text: &str) -> Result<(), String> {
    if apps.is_empty() {
        return Err("no apps are allowed".into());
    }
    if apps.iter().any(|app| app.trim().chars().count() < 3) {
        return Err("an app name must be at least 3 characters".into());
    }
    match action {
        "list" => Ok(()),
        "focus" => {
            known_app(apps, target)?;
            Ok(())
        }
        "type" => {
            known_app(apps, target)?;
            if text.is_empty() || text.chars().count() > 120 {
                return Err("text must be 1 to 120 characters".into());
            }
            if text.chars().any(|c| !matches!(c, ' '..='~')) {
                return Err("text must be plain printable characters".into());
            }
            Ok(())
        }
        _ => Err("action must be list, focus, or type".into()),
    }
}

fn known_app(apps: &[String], target: &str) -> Result<(), String> {
    let target = target.trim();
    if target.is_empty() {
        return Err("missing app".into());
    }
    if apps.iter().any(|app| app.eq_ignore_ascii_case(target)) {
        Ok(())
    } else {
        Err("app is not on the allow list".into())
    }
}

pub fn run(action: &str, target: &str, text: &str, apps: &[String]) -> Result<String, String> {
    validate(apps, action, target, text)?;
    #[cfg(windows)]
    {
        win::run(action, target, text, apps)
    }
    #[cfg(not(windows))]
    {
        let _ = (action, target, text, apps);
        Err("control_desktop calls the Windows window API. This build is not Windows.".into())
    }
}

/// True when `path` is `root` or a file inside it. `..` never counts.
pub fn inside(root: &str, path: &str) -> bool {
    if path.is_empty() || root.is_empty() || has_parent(path) || has_parent(root) {
        return false;
    }
    let root = root.trim_end_matches(['/', '\\']);
    if root.is_empty() {
        return false;
    }
    if eq_ignore(path, root) {
        return true;
    }
    let bytes = path.as_bytes();
    let root_bytes = root.as_bytes();
    if bytes.len() <= root_bytes.len() {
        return false;
    }
    if !eq_ignore(&path[..root.len()], root) {
        return false;
    }
    matches!(bytes[root.len()], b'/' | b'\\')
}

pub fn has_parent(path: &str) -> bool {
    path.split(['/', '\\']).any(|part| part == "..")
}

pub fn is_absolute(path: &str) -> bool {
    path.starts_with('/')
        || path.starts_with('\\')
        || (path.len() >= 3 && path.as_bytes()[1] == b':')
}

pub fn join_root(root: &str, rel: &str) -> String {
    let root = root.trim_end_matches(['/', '\\']);
    let sep = if root.contains('\\') { '\\' } else { '/' };
    format!("{root}{sep}{rel}")
}

fn eq_ignore(left: &str, right: &str) -> bool {
    left.eq_ignore_ascii_case(right)
}

/// Canonical path must stay inside one allowed folder.
pub fn canonical_inside(folders: &[String], path: &Path) -> Result<std::path::PathBuf, String> {
    let canon = path.canonicalize().map_err(|e| e.to_string())?;
    let ok = folders.iter().any(|folder| {
        std::path::Path::new(folder)
            .canonicalize()
            .map(|root| canon.starts_with(&root))
            .unwrap_or(false)
    });
    if !ok {
        return Err("path is outside the allowed folders".into());
    }
    Ok(canon)
}

#[cfg(windows)]
mod win {
    use std::ffi::c_void;

    #[link(name = "user32")]
    extern "system" {
        fn EnumWindows(
            callback: extern "system" fn(*mut c_void, isize) -> i32,
            param: isize,
        ) -> i32;
        fn GetWindowTextW(hwnd: *mut c_void, buffer: *mut u16, max: i32) -> i32;
        fn IsWindowVisible(hwnd: *mut c_void) -> i32;
        fn SetForegroundWindow(hwnd: *mut c_void) -> i32;
        fn ShowWindow(hwnd: *mut c_void, command: i32) -> i32;
        fn SendMessageW(hwnd: *mut c_void, msg: u32, wparam: usize, lparam: isize) -> isize;
    }

    const SW_RESTORE: i32 = 9;
    const WM_CHAR: u32 = 0x0102;

    struct Hit {
        hwnd: *mut c_void,
        title: String,
    }

    extern "system" fn enum_cb(hwnd: *mut c_void, param: isize) -> i32 {
        if unsafe { IsWindowVisible(hwnd) } == 0 {
            return 1;
        }
        let mut buf = [0u16; 256];
        let n = unsafe { GetWindowTextW(hwnd, buf.as_mut_ptr(), buf.len() as i32) };
        if n <= 0 {
            return 1;
        }
        let title = String::from_utf16_lossy(&buf[..n as usize]);
        if title.trim().is_empty() {
            return 1;
        }
        let hits = unsafe { &mut *(param as *mut Vec<Hit>) };
        hits.push(Hit { hwnd, title });
        1
    }

    fn windows() -> Vec<Hit> {
        let mut hits = Vec::new();
        unsafe { EnumWindows(enum_cb, &mut hits as *mut Vec<Hit> as isize) };
        hits
    }

    fn title_matches(title: &str, app: &str) -> bool {
        title.to_ascii_lowercase().contains(&app.to_ascii_lowercase())
    }

    pub fn run(action: &str, target: &str, text: &str, apps: &[String]) -> Result<String, String> {
        let hits = windows();
        match action {
            "list" => {
                let mut lines = Vec::new();
                for hit in &hits {
                    if apps.iter().any(|app| title_matches(&hit.title, app)) {
                        lines.push(hit.title.clone());
                    }
                    if lines.len() == 50 {
                        break;
                    }
                }
                if lines.is_empty() {
                    return Ok("no matching windows".into());
                }
                Ok(lines.join("\n"))
            }
            "focus" | "type" => {
                let hit = hits
                    .into_iter()
                    .find(|hit| title_matches(&hit.title, target))
                    .ok_or_else(|| format!("no window matches {target}"))?;
                unsafe {
                    ShowWindow(hit.hwnd, SW_RESTORE);
                    if SetForegroundWindow(hit.hwnd) == 0 {
                        return Err(format!("Windows did not focus {}", hit.title));
                    }
                    if action == "type" {
                        for ch in text.chars() {
                            SendMessageW(hit.hwnd, WM_CHAR, u32::from(ch) as usize, 0);
                        }
                    }
                }
                if action == "type" {
                    Ok(format!("typed into {}", hit.title))
                } else {
                    Ok(format!("focused {}", hit.title))
                }
            }
            _ => Err("action must be list, focus, or type".into()),
        }
    }
}
