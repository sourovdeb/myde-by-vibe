use crate::settings::Settings;

pub fn parse_form(body: &str) -> Vec<(String, String)> {
    let mut pairs = Vec::new();
    for part in body.split('&') {
        if part.is_empty() {
            continue;
        }
        let (key, value) = part.split_once('=').unwrap_or((part, ""));
        pairs.push((decode(key), decode(value)));
    }
    pairs
}

fn decode(raw: &str) -> String {
    let raw = raw.replace('+', " ");
    let bytes = raw.as_bytes();
    let mut out = Vec::new();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(byte) = u8::from_str_radix(&raw[i + 1..i + 3], 16) {
                out.push(byte);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn lines(value: &str) -> Vec<String> {
    value
        .lines()
        .map(|line| line.trim())
        .filter(|line| !line.is_empty())
        .map(|line| line.to_string())
        .collect()
}

/// Full form from the panel. A missing checkbox means off.
pub fn apply_form(settings: &mut Settings, body: &str) -> Result<(), String> {
    let pairs = parse_form(body);
    let has = |key: &str| pairs.iter().any(|(name, _)| name == key);
    let val = |key: &str| {
        pairs
            .iter()
            .find(|(name, _)| name == key)
            .map(|(_, value)| value.as_str())
    };
    if val("panel") != Some("1") {
        return Err("not a panel form".into());
    }
    let token = val("token").unwrap_or("");
    if settings.token.is_empty() || token != settings.token {
        return Err("bad token".into());
    }
    settings.version = 2;
    settings.server_on = has("server_on");
    settings.caps.read = has("cap_read");
    settings.caps.edit = has("cap_edit");
    settings.caps.scripts = has("cap_scripts");
    settings.caps.desktop = has("cap_desktop");
    for (caller, prefix) in [
        (&mut settings.providers.grok, "grok"),
        (&mut settings.providers.mistral, "mistral"),
        (&mut settings.providers.chatgpt, "chatgpt"),
        (&mut settings.providers.pi, "pi"),
    ] {
        caller.read = has(&format!("{prefix}_read"));
        caller.edit = has(&format!("{prefix}_edit"));
        caller.scripts = has(&format!("{prefix}_scripts"));
        caller.desktop = has(&format!("{prefix}_desktop"));
    }
    if let Some(name) = val("name") {
        let name = name.trim();
        if !name.is_empty() {
            settings.name = name.to_string();
        }
    }
    if let Some(url) = val("public_url") {
        settings.public_url = url.trim().to_string();
    }
    if let Some(folders) = val("folders") {
        settings.folders = lines(folders);
    }
    if let Some(commands) = val("commands") {
        settings.commands = lines(commands);
    }
    if let Some(apps) = val("apps") {
        settings.apps = lines(apps);
        if settings.apps.iter().any(|app| app.chars().count() < 3) {
            return Err("an app name must be at least 3 characters".into());
        }
    }
    Ok(())
}

pub fn render(settings: &Settings, saved: bool) -> String {
    let saved_line = if saved { "<p class=\"ok\">Saved.</p>" } else { "" };
    format!(
        r#"<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Latch</title>
<style>
  body {{ margin: 0; background: #f4f1ea; color: #1c1915; font: 16px/1.45 Georgia, serif; }}
  main {{ max-width: 46rem; margin: 0 auto; padding: 1.5rem 1.2rem 3rem; }}
  h1 {{ font-weight: 500; font-size: 1.8rem; margin: 0 0 0.2rem; }}
  h2 {{ font-weight: 500; font-size: 1.15rem; margin: 1.6rem 0 0.4rem; }}
  p, li {{ color: #3d3832; }}
  .ok {{ color: #1d6b3a; }}
  form {{ display: grid; gap: 0.8rem; }}
  fieldset {{ border: 1px solid #d9d2c5; background: #fffdf8; padding: 0.8rem 1rem 1rem; }}
  legend {{ padding: 0 0.3rem; }}
  label {{ display: flex; gap: 0.45rem; align-items: center; margin: 0.25rem 0; }}
  textarea, input[type=text] {{ width: 100%; box-sizing: border-box; font: 15px/1.4 Consolas, monospace; padding: 0.4rem; border: 1px solid #d9d2c5; background: #fff; }}
  button {{ font: 16px Georgia, serif; background: #8a4b2f; color: #fff; border: 0; padding: 0.55rem 1rem; width: 10rem; }}
  .row {{ display: grid; grid-template-columns: 8rem 1fr 1fr 1fr 1fr; gap: 0.3rem 0.6rem; align-items: center; }}
  .head {{ color: #6d675f; font-size: 0.85rem; }}
</style>
</head>
<body>
<main>
  <h1>{name}</h1>
  <p>Switches on this page are saved. Latch reads them on every call. A provider cannot do more than the master switches allow.</p>
  {saved_line}
  <form method="post" action="/panel">
    <input type="hidden" name="panel" value="1">
    <input type="hidden" name="token" value="{token}">
    <fieldset>
      <legend>Server</legend>
      <label><input type="checkbox" name="server_on"{server_on}> Server on</label>
      <label>Name <input type="text" name="name" value="{name_value}"></label>
      <label>Public https URL <input type="text" name="public_url" value="{url}"></label>
      <p>Grok, Mistral, and ChatGPT must use the public https address, not localhost. Add the provider path at the end.</p>
    </fieldset>
    <fieldset>
      <legend>Master switches</legend>
      <label><input type="checkbox" name="cap_read"{cap_read}> Read files</label>
      <label><input type="checkbox" name="cap_edit"{cap_edit}> Edit files</label>
      <label><input type="checkbox" name="cap_scripts"{cap_scripts}> Run approved scripts</label>
      <label><input type="checkbox" name="cap_desktop"{cap_desktop}> Control desktop apps</label>
    </fieldset>
    <fieldset>
      <legend>Each provider</legend>
      <div class="row head"><span></span><span>Read</span><span>Edit</span><span>Scripts</span><span>Desktop</span></div>
      {rows}
      <ul>
        <li>Grok: register <code>/mcp/grok</code> on the public https URL.</li>
        <li>Mistral: register <code>/mcp/mistral</code>.</li>
        <li>ChatGPT: register <code>/mcp/chatgpt</code>. A free plan may not allow a custom connector. OpenAI may refuse write tools.</li>
        <li>Pi has no cloud page. It stays on this PC at <code>/mcp/pi</code>.</li>
      </ul>
    </fieldset>
    <fieldset>
      <legend>Allow lists</legend>
      <label>Folders, one per line<textarea name="folders" rows="4">{folders}</textarea></label>
      <label>Approved commands, one exact line each<textarea name="commands" rows="4">{commands}</textarea></label>
      <label>App names, one per line, at least 3 letters<textarea name="apps" rows="3">{apps}</textarea></label>
    </fieldset>
    <button type="submit">Save</button>
  </form>
</main>
</body>
</html>
"#,
        name = esc(&settings.name),
        saved_line = saved_line,
        token = esc(&settings.token),
        server_on = tick(settings.server_on),
        name_value = esc(&settings.name),
        url = esc(&settings.public_url),
        cap_read = tick(settings.caps.read),
        cap_edit = tick(settings.caps.edit),
        cap_scripts = tick(settings.caps.scripts),
        cap_desktop = tick(settings.caps.desktop),
        rows = rows(settings),
        folders = esc(&settings.folders.join("\n")),
        commands = esc(&settings.commands.join("\n")),
        apps = esc(&settings.apps.join("\n")),
    )
}

fn rows(settings: &Settings) -> String {
    let mut out = String::new();
    for (label, prefix, caps) in [
        ("Grok", "grok", &settings.providers.grok),
        ("Mistral", "mistral", &settings.providers.mistral),
        ("ChatGPT", "chatgpt", &settings.providers.chatgpt),
        ("Pi", "pi", &settings.providers.pi),
    ] {
        out.push_str(&format!(
            r#"<div class="row"><span>{label}</span><label><input type="checkbox" name="{prefix}_read"{read}></label><label><input type="checkbox" name="{prefix}_edit"{edit}></label><label><input type="checkbox" name="{prefix}_scripts"{scripts}></label><label><input type="checkbox" name="{prefix}_desktop"{desktop}></label></div>"#,
            label = label,
            prefix = prefix,
            read = tick(caps.read),
            edit = tick(caps.edit),
            scripts = tick(caps.scripts),
            desktop = tick(caps.desktop),
        ));
    }
    out
}

fn tick(on: bool) -> &'static str {
    if on {
        " checked"
    } else {
        ""
    }
}

fn esc(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for ch in value.chars() {
        match ch {
            '&' => {
                out.push('&');
                out.push_str("amp;");
            }
            '<' => {
                out.push('&');
                out.push_str("lt;");
            }
            '>' => {
                out.push('&');
                out.push_str("gt;");
            }
            '"' => {
                out.push('&');
                out.push_str("quot;");
            }
            _ => out.push(ch),
        }
    }
    out
}

pub fn text_panel(settings: &Settings) -> String {
    let mut lines = Vec::new();
    lines.push(format!(
        "server: {}",
        if settings.server_on { "on" } else { "off" }
    ));
    lines.push(format!(
        "master: read={} edit={} scripts={} desktop={}",
        on(settings.caps.read),
        on(settings.caps.edit),
        on(settings.caps.scripts),
        on(settings.caps.desktop)
    ));
    for (name, caps) in [
        ("grok", &settings.providers.grok),
        ("mistral", &settings.providers.mistral),
        ("chatgpt", &settings.providers.chatgpt),
        ("pi", &settings.providers.pi),
    ] {
        lines.push(format!(
            "{name}: read={} edit={} scripts={} desktop={}",
            on(caps.read),
            on(caps.edit),
            on(caps.scripts),
            on(caps.desktop)
        ));
    }
    if !settings.token.is_empty() {
        lines.push(format!(
            "panel: http://127.0.0.1:{}/panel?token={}",
            settings.port, settings.token
        ));
    }
    lines.join("\n")
}

fn on(value: bool) -> &'static str {
    if value {
        "on"
    } else {
        "off"
    }
}
