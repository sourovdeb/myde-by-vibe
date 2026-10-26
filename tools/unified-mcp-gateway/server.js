const http = require('http');
const url = require('url');
const crypto = require('crypto');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Load .env file
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.substring(0, eqIdx).trim();
        const value = trimmed.substring(eqIdx + 1).trim();
        if (!process.env[key]) process.env[key] = value;
      }
    }
  }
} catch (e) { /* .env is optional */ }

const PORT = process.env.PORT || 3002;
const HOST = process.env.HOST || '0.0.0.0';

// Auth: bearer token for /mcp endpoint
const AUTH_TOKEN = process.env.GATEWAY_AUTH_TOKEN || '';
const AUTH_ENABLED = process.env.GATEWAY_AUTH_ENABLED === 'true' && AUTH_TOKEN.length > 0;

function checkAuth(req) {
  if (!AUTH_ENABLED) return true;
  const authHeader = req.headers['authorization'] || '';
  if (authHeader === 'Bearer ' + AUTH_TOKEN) return true;
  // Also accept token as query param for SSE connections
  const parsedUrl = url.parse(req.url, true);
  if (parsedUrl.query && parsedUrl.query.token === AUTH_TOKEN) return true;
  return false;
}

// Upstream MCP servers
const UPSTREAM_SERVERS = {
  latch: { host: '127.0.0.1', port: 3939, prefix: '' },
  connector: { host: '127.0.0.1', port: 3000, prefix: '' },
  browser: { host: '127.0.0.1', port: 3001, prefix: 'browser_' }
};

// Session store for MCP Streamable HTTP transport
const sessions = new Map();

function createSession() {
  const id = crypto.randomUUID();
  sessions.set(id, { createdAt: Date.now(), initialized: false });
  return id;
}

// ============================================================
// PROXY: Forward requests to upstream MCP servers
// ============================================================

function proxyRequest(serverKey, method, params) {
  return new Promise((resolve, reject) => {
    const server = UPSTREAM_SERVERS[serverKey];
    const payload = JSON.stringify({
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method: method,
      params: params || {}
    });

    const req = http.request({
      host: server.host,
      port: server.port,
      path: '/mcp',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 30000
    }, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk.toString(); });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error('Invalid JSON from upstream: ' + body.substring(0, 200)));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Upstream timeout')); });
    req.write(payload);
    req.end();
  });
}

async function fetchUpstreamTools() {
  const allTools = [];
  const errors = [];

  for (const [key, server] of Object.entries(UPSTREAM_SERVERS)) {
    try {
      const resp = await proxyRequest(key, 'tools/list');
      if (resp.result && resp.result.tools) {
        for (const tool of resp.result.tools) {
          allTools.push({
            ...tool,
            _upstream: key
          });
        }
      }
    } catch (e) {
      errors.push({ server: key, error: e.message });
    }
  }

  return { tools: allTools, errors };
}

async function callUpstreamTool(serverKey, toolName, args) {
  const resp = await proxyRequest(serverKey, 'tools/call', {
    name: toolName,
    arguments: args || {}
  });
  return resp;
}

// ============================================================
// NEW TOOLS: 13 capabilities implemented natively
// ============================================================

// Allow-list for run_command (safe commands only)
const COMMAND_ALLOWLIST = [
  'echo', 'dir', 'ls', 'type', 'cat', 'whoami', 'hostname',
  'systeminfo', 'tasklist', 'ipconfig', 'netstat', 'ping',
  'python --version', 'python3 --version', 'node --version', 'npm --version',
  'git --version', 'git status', 'git log --oneline -5',
  'winget --version', 'choco --version',
  'powershell -Command Get-Date',
  'powershell -Command Get-Process',
  'powershell -Command Get-Service',
  'powershell -Command Get-CimInstance Win32_OperatingSystem',
  'powershell -Command Get-CimInstance Win32_ComputerSystem',
  'powershell -Command Get-CimInstance Win32_Processor',
  'powershell -Command Get-CimInstance Win32_LogicalDisk',
  'powershell -Command Get-NetTCPConnection',
  'powershell -Command Get-NetFirewallRule',
  'curl --version', 'ffprobe -version', 'ffmpeg -version',
  'code --version', 'notepad',
  'start', 'explorer',
  'date /t', 'time /t',
  'ver', 'vol', 'set',
  'where', 'whereis', 'which',
  'fc', 'find', 'findstr', 'tree',
  'xcopy /?', 'robocopy /?',
  'schtasks /query',
  'wmic cpu get name',
  'wmic os get caption',
  'wmic memorychip get capacity',
  'wmic logicaldisk get size,freespace,caption'
];

function isCommandAllowed(cmd) {
  const cmdLower = cmd.toLowerCase().trim();
  // Check exact match or prefix match against allow-list
  for (const allowed of COMMAND_ALLOWLIST) {
    if (cmdLower === allowed.toLowerCase()) return true;
    // Allow prefix match for commands with arguments (e.g., "git status --short")
    if (cmdLower.startsWith(allowed.toLowerCase() + ' ')) return true;
  }
  // Block dangerous patterns
  const dangerous = ['del ', 'rmdir ', 'rd ', 'erase ', 'format ', 'shutdown', 'restart', 'reg ', 'regedit', 'taskkill /f', 'net user', 'net localgroup', 'vssadmin', 'bcdedit', 'diskpart', 'cipher /w'];
  for (const d of dangerous) {
    if (cmdLower.includes(d)) return false;
  }
  return false;
}

function runShellCommand(cmd, timeoutMs) {
  return new Promise((resolve) => {
    const timeout = timeoutMs || 30000;
    let stdout = '';
    let stderr = '';

    const proc = spawn('cmd.exe', ['/c', cmd], {
      shell: false,
      windowsHide: true
    });

    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });

    const timer = setTimeout(() => {
      proc.kill();
      resolve({ success: false, output: stdout, error: stderr + '\n[Timeout after ' + timeout + 'ms]', timedOut: true });
    }, timeout);

    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({ success: code === 0, output: stdout, error: stderr, exitCode: code });
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      resolve({ success: false, output: stdout, error: err.message });
    });
  });
}

function runPowerShellCommand(script, timeoutMs) {
  return new Promise((resolve) => {
    const timeout = timeoutMs || 30000;
    let stdout = '';
    let stderr = '';

    const proc = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      shell: false,
      windowsHide: true
    });

    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });

    const timer = setTimeout(() => {
      proc.kill();
      resolve({ success: false, output: stdout, error: stderr + '\n[Timeout after ' + timeout + 'ms]', timedOut: true });
    }, timeout);

    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({ success: code === 0, output: stdout, error: stderr, exitCode: code });
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      resolve({ success: false, output: stdout, error: err.message });
    });
  });
}

// Tool 1: run_command — Execute allow-listed shell commands
function toolRunCommand(args) {
  const cmd = args.command;
  if (!cmd) throw new Error('command is required');
  if (!isCommandAllowed(cmd)) {
    throw new Error('Command not in allow-list. Allowed commands: ' + COMMAND_ALLOWLIST.slice(0, 20).join(', ') + '... (see docs for full list)');
  }
  return runShellCommand(cmd, args.timeout_ms || 30000).then(r => ({
    command: cmd,
    success: r.success,
    exitCode: r.exitCode,
    output: r.output,
    error: r.error,
    timedOut: r.timedOut || false
  }));
}

// Tool 2: manage_process — Start/stop/list processes
function toolManageProcess(args) {
  const action = args.action; // 'list', 'start', 'stop', 'info'
  if (!action) throw new Error('action is required (list, start, stop, info)');

  if (action === 'list') {
    const filter = args.filter || '';
    let psScript = 'Get-Process';
    if (filter) {
      psScript += ' | Where-Object {$_.ProcessName -like "*' + filter.replace(/"/g, '`"') + '*" }';
    }
    psScript += ' | Select-Object Id, ProcessName, CPU, WorkingSet, StartTime | ConvertTo-Json -Compress';
    return runPowerShellCommand(psScript, 15000).then(r => {
      let processes = [];
      try { processes = JSON.parse(r.output.trim() || '[]'); } catch (e) { processes = []; }
      if (!Array.isArray(processes)) processes = [processes];
      return { action: 'list', count: processes.length, processes: processes.map(p => ({
        pid: p.Id,
        name: p.ProcessName,
        cpu: p.CPU,
        memoryMB: Math.round((p.WorkingSet || 0) / 1048576 * 10) / 10,
        startTime: p.StartTime
      })) };
    });
  }

  if (action === 'start') {
    const cmd = args.command;
    if (!cmd) throw new Error('command is required for start action');
    return runPowerShellCommand('Start-Process -FilePath "' + cmd.replace(/"/g, '`"') + '" -PassThru | Select-Object Id, ProcessName | ConvertTo-Json -Compress', 15000).then(r => ({
      action: 'start',
      command: cmd,
      success: r.success,
      output: r.output.trim(),
      error: r.error
    }));
  }

  if (action === 'stop') {
    const pid = args.pid;
    const name = args.name;
    if (!pid && !name) throw new Error('pid or name is required for stop action');
    let psScript;
    if (pid) {
      psScript = 'Stop-Process -Id ' + parseInt(pid) + ' -Force -ErrorAction SilentlyContinue; "Stopped PID ' + parseInt(pid) + '"';
    } else {
      psScript = 'Get-Process -Name "' + name.replace(/"/g, '`"') + '" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue; "Stopped ' + name.replace(/"/g, '`"') + '"';
    }
    return runPowerShellCommand(psScript, 15000).then(r => ({
      action: 'stop',
      target: pid ? 'PID ' + pid : 'name ' + name,
      success: r.success,
      output: r.output.trim(),
      error: r.error
    }));
  }

  if (action === 'info') {
    const pid = args.pid;
    if (!pid) throw new Error('pid is required for info action');
    return runPowerShellCommand('Get-Process -Id ' + parseInt(pid) + ' -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, CPU, WorkingSet, VirtualMemorySize, StartTime, Path, Company, Product | ConvertTo-Json -Compress', 15000).then(r => ({
      action: 'info',
      pid: pid,
      success: r.success,
      output: r.output.trim(),
      error: r.error
    }));
  }

  throw new Error('Unknown action: ' + action);
}

// Tool 3: screenshot — Capture screen
function toolScreenshot(args) {
  const savePath = args.path || path.join(os.tmpdir(), 'screenshot-' + Date.now() + '.png');
  const psScript = [
    'Add-Type -AssemblyName System.Windows.Forms',
    'Add-Type -AssemblyName System.Drawing',
    '$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds',
    '$bitmap = New-Object System.Drawing.Bitmap $screen.Width, $screen.Height',
    '$graphics = [System.Drawing.Graphics]::FromImage($bitmap)',
    '$graphics.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)',
    '$bitmap.Save("' + savePath.replace(/\\/g, '\\\\').replace(/"/g, '`"') + '", [System.Drawing.Imaging.ImageFormat]::Png)',
    '$graphics.Dispose()',
    '$bitmap.Dispose()',
    '"Saved to: ' + savePath.replace(/\\/g, '\\\\').replace(/"/g, '`"') + '"'
  ].join('; ');

  return runPowerShellCommand(psScript, 15000).then(r => {
    let fileSize = 0;
    try { fileSize = fs.existsSync(savePath) ? fs.statSync(savePath).size : 0; } catch (e) {}
    return {
      success: r.success && fileSize > 0,
      path: savePath,
      fileSizeBytes: fileSize,
      output: r.output.trim(),
      error: r.error
    };
  });
}

// Tool 4: clipboard — Read/write clipboard
function toolClipboard(args) {
  const action = args.action; // 'read' or 'write'
  if (!action) throw new Error('action is required (read or write)');

  if (action === 'read') {
    return runPowerShellCommand('Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Clipboard]::GetText()', 10000).then(r => ({
      action: 'read',
      success: r.success,
      text: r.output,
      error: r.error
    }));
  }

  if (action === 'write') {
    const text = args.text;
    if (text === undefined) throw new Error('text is required for write action');
    const escaped = text.replace(/\\/g, '\\\\').replace(/"/g, '`"').replace(/\n/g, '`n').replace(/\r/g, '`r');
    return runPowerShellCommand('Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Clipboard]::SetText("' + escaped + '")', 10000).then(r => ({
      action: 'write',
      success: r.success,
      textLength: text.length,
      output: r.output.trim(),
      error: r.error
    }));
  }

  throw new Error('Unknown action: ' + action);
}

// Tool 5: manage_file — Delete/move/rename/copy files
function toolManageFile(args) {
  const action = args.action; // 'delete', 'move', 'rename', 'copy', 'exists', 'info'
  if (!action) throw new Error('action is required (delete, move, rename, copy, exists, info)');
  const filePath = args.path;
  if (!filePath) throw new Error('path is required');

  const safePath = filePath.replace(/"/g, '`"');

  switch (action) {
    case 'exists':
      return Promise.resolve({
        action: 'exists',
        path: filePath,
        exists: fs.existsSync(filePath)
      });

    case 'info': {
      if (!fs.existsSync(filePath)) throw new Error('File not found: ' + filePath);
      const stat = fs.statSync(filePath);
      return Promise.resolve({
        action: 'info',
        path: filePath,
        size: stat.size,
        isDirectory: stat.isDirectory(),
        created: stat.birthtime,
        modified: stat.mtime,
        accessed: stat.atime
      });
    }

    case 'delete':
      return runPowerShellCommand('Remove-Item -Path "' + safePath + '" -Force -Recurse -ErrorAction Stop; "Deleted: ' + safePath + '"', 15000).then(r => ({
        action: 'delete',
        path: filePath,
        success: r.success,
        output: r.output.trim(),
        error: r.error
      }));

    case 'move': {
      const dest = args.destination;
      if (!dest) throw new Error('destination is required for move action');
      return runPowerShellCommand('Move-Item -Path "' + safePath + '" -Destination "' + dest.replace(/"/g, '`"') + '" -Force -ErrorAction Stop; "Moved to: ' + dest.replace(/"/g, '`"') + '"', 15000).then(r => ({
        action: 'move',
        path: filePath,
        destination: dest,
        success: r.success,
        output: r.output.trim(),
        error: r.error
      }));
    }

    case 'rename': {
      const newName = args.new_name;
      if (!newName) throw new Error('new_name is required for rename action');
      return runPowerShellCommand('Rename-Item -Path "' + safePath + '" -NewName "' + newName.replace(/"/g, '`"') + '" -Force -ErrorAction Stop; "Renamed to: ' + newName.replace(/"/g, '`"') + '"', 15000).then(r => ({
        action: 'rename',
        path: filePath,
        newName: newName,
        success: r.success,
        output: r.output.trim(),
        error: r.error
      }));
    }

    case 'copy': {
      const dest = args.destination;
      if (!dest) throw new Error('destination is required for copy action');
      return runPowerShellCommand('Copy-Item -Path "' + safePath + '" -Destination "' + dest.replace(/"/g, '`"') + '" -Force -Recurse -ErrorAction Stop; "Copied to: ' + dest.replace(/"/g, '`"') + '"', 15000).then(r => ({
        action: 'copy',
        path: filePath,
        destination: dest,
        success: r.success,
        output: r.output.trim(),
        error: r.error
      }));
    }

    default:
      throw new Error('Unknown action: ' + action);
  }
}

// Tool 6: manage_service — Start/stop/list Windows services
function toolManageService(args) {
  const action = args.action; // 'list', 'start', 'stop', 'status'
  if (!action) throw new Error('action is required (list, start, stop, status)');

  if (action === 'list') {
    const filter = args.filter || '';
    let psScript = 'Get-Service';
    if (filter) {
      psScript += ' | Where-Object {$_.Name -like "*' + filter.replace(/"/g, '`"') + '*" -or $_.DisplayName -like "*' + filter.replace(/"/g, '`"') + '*" }';
    }
    psScript += ' | Select-Object Name, DisplayName, Status, StartType | ConvertTo-Json -Compress';
    return runPowerShellCommand(psScript, 15000).then(r => {
      let services = [];
      try { services = JSON.parse(r.output.trim() || '[]'); } catch (e) { services = []; }
      if (!Array.isArray(services)) services = [services];
      return { action: 'list', count: services.length, services };
    });
  }

  if (action === 'status') {
    const name = args.name;
    if (!name) throw new Error('name is required for status action');
    return runPowerShellCommand('Get-Service -Name "' + name.replace(/"/g, '`"') + '" -ErrorAction SilentlyContinue | Select-Object Name, DisplayName, Status, StartType | ConvertTo-Json -Compress', 10000).then(r => ({
      action: 'status',
      name: name,
      success: r.success,
      output: r.output.trim(),
      error: r.error
    }));
  }

  if (action === 'start' || action === 'stop') {
    const name = args.name;
    if (!name) throw new Error('name is required for ' + action + ' action');
    const cmd = action === 'start' ? 'Start-Service' : 'Stop-Service';
    return runPowerShellCommand(cmd + ' -Name "' + name.replace(/"/g, '`"') + '" -Force -ErrorAction Stop; "' + action + 'ped: ' + name.replace(/"/g, '`"') + '"', 30000).then(r => ({
      action: action,
      name: name,
      success: r.success,
      output: r.output.trim(),
      error: r.error
    }));
  }

  throw new Error('Unknown action: ' + action);
}

// Tool 7: network_info — Network configuration
function toolNetworkInfo(args) {
  const psScript = [
    '$info = @{}',
    '$info.hostname = $env:COMPUTERNAME',
    '$info.ipAddresses = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -ne "127.0.0.1"} | Select-Object IPAddress, InterfaceAlias, PrefixLength) | ConvertTo-Json -Compress',
    '$info.defaultGateway = (Get-NetRoute -DestinationPrefix "0.0.0.0/0" | Select-Object -First 1 -ExpandProperty NextHop)',
    '$info.dnsServers = (Get-DnsClientServerAddress -AddressFamily IPv4 | Select-Object -ExpandProperty ServerAddresses) -join ", "',
    '$info.listeningPorts = (Get-NetTCPConnection -State Listen | Select-Object LocalAddress, LocalPort, OwningProcess) | ConvertTo-Json -Compress',
    '$info.publicIP = try { (Invoke-RestMethod -Uri "https://api.ipify.org?format=json" -TimeoutSec 5).ip } catch { "unavailable" }',
    '$info | ConvertTo-Json -Depth 5 -Compress'
  ].join('\n');

  return runPowerShellCommand(psScript, 15000).then(r => {
    let data = {};
    try { data = JSON.parse(r.output.trim()); } catch (e) { data = { raw: r.output }; }
    return {
      success: r.success,
      network: data,
      error: r.error
    };
  });
}

// Tool 8: install_package — Install via winget or chocolatey
function toolInstallPackage(args) {
  const pkg = args.package;
  if (!pkg) throw new Error('package is required');
  const manager = args.manager || 'winget'; // 'winget' or 'choco'
  const safePkg = pkg.replace(/[;&|`$(){}]/g, '');

  let cmd;
  if (manager === 'choco') {
    cmd = 'choco install ' + safePkg + ' -y';
  } else {
    cmd = 'winget install --id ' + safePkg + ' --accept-source-agreements --accept-package-agreements -h';
  }

  return runShellCommand(cmd, 300000).then(r => ({
    manager: manager,
    package: pkg,
    success: r.success,
    output: r.output,
    error: r.error,
    timedOut: r.timedOut || false
  }));
}

// Tool 9: notify — Toast notification
function toolNotify(args) {
  const title = args.title || 'Notification';
  const message = args.message || '';
  const safeTitle = title.replace(/"/g, '`"').replace(/'/g, "'");
  const safeMsg = message.replace(/"/g, '`"').replace(/'/g, "'");

  const psScript = [
    '[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null',
    '[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null',
    '$template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)',
    '$textNodes = $template.GetElementsByTagName("text")',
    '$textNodes.Item(0).AppendChild($template.CreateTextNode("' + safeTitle + '")) | Out-Null',
    '$textNodes.Item(1).AppendChild($template.CreateTextNode("' + safeMsg + '")) | Out-Null',
    '$toast = [Windows.UI.Notifications.ToastNotification]::new($template)',
    '$notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("Sourov Control")',
    '$notifier.Show($toast)',
    '"Notification sent: ' + safeTitle + '"'
  ].join('\n');

  return runPowerShellCommand(psScript, 10000).then(r => ({
    success: r.success,
    title: title,
    message: message,
    output: r.output.trim(),
    error: r.error
  }));
}

// Tool 10: window_management — Resize/minimize/maximize windows
// Uses a compiled C# helper written to temp file to avoid here-string issues with -Command
function toolWindowManagement(args) {
  const action = args.action;
  if (!action) throw new Error('action is required (list, minimize, maximize, restore, close, activate, resize, move)');

  if (action === 'list') {
    // Simple approach: use Get-Process (no P/Invoke needed)
    const psScript = 'Get-Process | Where-Object {$_.MainWindowTitle -and $_.MainWindowHandle -ne 0} | Select-Object Id, ProcessName, @{N="Title";E={$_.MainWindowTitle}}, @{N="Handle";E={$_.MainWindowHandle.ToInt64()}} | ConvertTo-Json -Compress';
    return runPowerShellCommand(psScript, 10000).then(r => {
      let windows = [];
      try { windows = JSON.parse(r.output.trim() || '[]'); } catch (e) { windows = []; }
      if (!Array.isArray(windows)) windows = [windows];
      return { action: 'list', count: windows.length, windows };
    });
  }

  const title = args.title;
  const pid = args.pid;
  if (!title && !pid) throw new Error('title or pid is required for action: ' + action);

  // Write C# helper to temp file, compile, and use it
  const csCode = [
    'using System;',
    'using System.Runtime.InteropServices;',
    'public class WinAct {',
    '  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);',
    '  [DllImport("user32.dll")] public static extern bool CloseWindow(IntPtr hWnd);',
    '  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);',
    '  [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);',
    '  public static int Main(string[] args) {',
    '    if (args.Length < 2) { Console.WriteLine("Usage: WinAct <hwnd> <action> [x y w h]"); return 1; }',
    '    IntPtr hwnd = new IntPtr(long.Parse(args[0]));',
    '    string act = args[1];',
    '    switch (act) {',
    '      case "minimize": ShowWindowAsync(hwnd, 6); break;',
    '      case "maximize": ShowWindowAsync(hwnd, 3); break;',
    '      case "restore": ShowWindowAsync(hwnd, 9); break;',
    '      case "close": CloseWindow(hwnd); break;',
    '      case "activate": SetForegroundWindow(hwnd); break;',
    '      case "resize":',
    '        if (args.Length >= 6) MoveWindow(hwnd, int.Parse(args[2]), int.Parse(args[3]), int.Parse(args[4]), int.Parse(args[5]), true);',
    '        break;',
    '      case "move":',
    '        if (args.Length >= 6) MoveWindow(hwnd, int.Parse(args[2]), int.Parse(args[3]), int.Parse(args[4]), int.Parse(args[5]), true);',
    '        break;',
    '      default: Console.WriteLine("Unknown action: " + act); return 1;',
    '    }',
    '    Console.WriteLine(act + " applied to hwnd " + hwnd.ToInt64());',
    '    return 0;',
    '  }',
    '}'
  ].join('\n');

  const tmpCs = path.join(os.tmpdir(), 'WinAct_' + Date.now() + '.cs');
  const tmpExe = path.join(os.tmpdir(), 'WinAct_' + Date.now() + '.exe');
  fs.writeFileSync(tmpCs, csCode);

  // Find csc.exe (C# compiler)
  let cscPath = '';
  try {
    const findCsc = execSync('where csc', { encoding: 'utf-8', timeout: 5000 }).trim().split('\n')[0].trim();
    cscPath = findCsc;
  } catch (e) {
    // Try common locations
    const possiblePaths = [
      'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe',
      'C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe'
    ];
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) { cscPath = p; break; }
    }
  }

  if (!cscPath) {
    // Fallback: use PowerShell Add-Type with a script file instead of -Command
    const psScriptFile = path.join(os.tmpdir(), 'winact_' + Date.now() + '.ps1');
    const psContent = [
      'Add-Type -TypeDefinition @\'',
      csCode.replace(/public class WinAct/, 'public class WinActPs').replace(/public static int Main/, 'public static string Run'),
      '\'@ -ReferencedAssemblies System.dll',
      '',
      '# Get window handle',
      pid
        ? '$p = Get-Process -Id ' + parseInt(pid) + ' -ErrorAction SilentlyContinue'
        : '$p = Get-Process | Where-Object {$_.MainWindowTitle -like "*' + (title || '').replace(/"/g, '`"').replace(/'/g, "''") + '*" } | Select-Object -First 1',
      'if (-not $p -or $p.MainWindowHandle -eq 0) { Write-Output "Window not found"; exit 1 }',
      '$hwnd = $p.MainWindowHandle.ToInt64()',
      '',
      '# Perform action',
      'switch ("' + action + '") {',
      '  "minimize" { [WinActPs]::Run($hwnd.ToString(), "minimize") | Out-Null }',
      '  "maximize" { [WinActPs]::Run($hwnd.ToString(), "maximize") | Out-Null }',
      '  "restore"  { [WinActPs]::Run($hwnd.ToString(), "restore") | Out-Null }',
      '  "close"    { [WinActPs]::Run($hwnd.ToString(), "close") | Out-Null }',
      '  "activate" { [WinActPs]::Run($hwnd.ToString(), "activate") | Out-Null }',
      '  "resize"   { [WinActPs]::Run($hwnd.ToString(), "resize", "' + (args.x || 0) + '", "' + (args.y || 0) + '", "' + (args.width || 800) + '", "' + (args.height || 600) + '") | Out-Null }',
      '  "move"     { [WinActPs]::Run($hwnd.ToString(), "move", "' + (args.x || 0) + '", "' + (args.y || 0) + '", "' + (args.width || 0) + '", "' + (args.height || 0) + '") | Out-Null }',
      '}',
      'Write-Output "' + action + ' applied to window: $($p.MainWindowTitle)"'
    ].join('\n');
    // Fix the Run method signature for the fallback
    const psContentFixed = psContent.replace(
      'public static string Run(string[] args)',
      'public static string Run(string hwndStr, string act, string x = "0", string y = "0", string w = "0", string h = "0")'
    ).replace(
      /if \(args\.Length < 2\).*?return 1; \}/,
      'IntPtr hwnd = new IntPtr(long.Parse(hwndStr));'
    ).replace(
      /string act = args\[1\];/,
      ''
    ).replace(
      /case "resize":\n        if \(args\.Length >= 6\) MoveWindow\(hwnd, int\.Parse\(args\[2\]\), int\.Parse\(args\[3\]\), int\.Parse\(args\[4\]\), int\.Parse\(args\[5\]\), true\);/,
      'case "resize": MoveWindow(hwnd, int.Parse(x), int.Parse(y), int.Parse(w), int.Parse(h), true);'
    ).replace(
      /case "move":\n        if \(args\.Length >= 6\) MoveWindow\(hwnd, int\.Parse\(args\[2\]\), int\.Parse\(args\[3\]\), int\.Parse\(args\[4\]\), int\.Parse\(args\[5\]\), true\);/,
      'case "move": MoveWindow(hwnd, int.Parse(x), int.Parse(y), int.Parse(w), int.Parse(h), true);'
    );
    fs.writeFileSync(psScriptFile, psContentFixed);
    return runPowerShellCommand('powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + psScriptFile + '"', 15000).then(r => {
      try { fs.unlinkSync(psScriptFile); } catch (e) {}
      return {
        action: action,
        target: pid ? 'PID ' + pid : 'title "' + title + '"',
        success: r.success,
        output: r.output.trim(),
        error: r.error
      };
    });
  }

  // Compile and run
  const compileResult = runShellCommand('"' + cscPath + '" /out:"' + tmpExe + '" "' + tmpCs + '"', 15000);
  return compileResult.then(cr => {
    try { fs.unlinkSync(tmpCs); } catch (e) {}
    if (!cr.success) {
      return { action, target: pid ? 'PID ' + pid : 'title "' + title + '"', success: false, output: '', error: 'Compile failed: ' + cr.error };
    }
    let exeArgs = '"' + tmpExe + '"';
    // Get window handle first
    let psFilter;
    if (pid) {
      psFilter = '(Get-Process -Id ' + parseInt(pid) + ' -ErrorAction SilentlyContinue).MainWindowHandle.ToInt64()';
    } else {
      psFilter = '(Get-Process | Where-Object {$_.MainWindowTitle -like "*' + (title || '').replace(/"/g, '`"').replace(/'/g, "''") + '*" } | Select-Object -First 1).MainWindowHandle.ToInt64()';
    }
    const getHwnd = runPowerShellCommand(psFilter, 10000);
    return getHwnd.then(hr => {
      const hwnd = hr.output.trim();
      if (!hwnd || hwnd === '0') {
        try { fs.unlinkSync(tmpExe); } catch (e) {}
        return { action, target: pid ? 'PID ' + pid : 'title "' + title + '"', success: false, output: '', error: 'Window not found' };
      }
      let cmdArgs = hwnd + ' ' + action;
      if (action === 'resize' || action === 'move') {
        cmdArgs += ' ' + (args.x || 0) + ' ' + (args.y || 0) + ' ' + (args.width || (action === 'resize' ? 800 : 0)) + ' ' + (args.height || (action === 'resize' ? 600 : 0));
      }
      return runShellCommand(exeArgs + ' ' + cmdArgs, 10000).then(er => {
        try { fs.unlinkSync(tmpExe); } catch (e) {}
        return {
          action: action,
          target: pid ? 'PID ' + pid : 'title "' + title + '"',
          success: er.success,
          output: er.output.trim(),
          error: er.error
        };
      });
    });
  });
}

// Tool 11: registry_read — Read Windows registry keys (read-only)
function toolRegistryRead(args) {
  const regPath = args.path;
  if (!regPath) throw new Error('path is required (e.g., HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion)');
  const safePath = regPath.replace(/"/g, '`"');

  const psScript = 'Get-ItemProperty -Path "' + safePath + '" -ErrorAction SilentlyContinue | ConvertTo-Json -Compress';
  return runPowerShellCommand(psScript, 10000).then(r => ({
    path: regPath,
    success: r.success,
    data: r.output.trim(),
    error: r.error
  }));
}

// Tool 12: get_env — List environment variable names (never values)
function toolGetEnv(args) {
  const filter = args.filter || '';
  const psScript = 'Get-ChildItem Env: | Where-Object {$_.Name -like "*' + filter.replace(/"/g, '`"') + '*" } | Select-Object Name, @{N="ValueLength";E={$_.Value.Length}} | ConvertTo-Json -Compress';
  return runPowerShellCommand(psScript, 10000).then(r => {
    let vars = [];
    try { vars = JSON.parse(r.output.trim() || '[]'); } catch (e) { vars = []; }
    if (!Array.isArray(vars)) vars = [vars];
    return {
      count: vars.length,
      variables: vars.map(v => ({ name: v.Name, valueLength: v.ValueLength }))
    };
  });
}

// Tool 13: system_info_extended — Detailed system info
function toolSystemInfoExtended(args) {
  const psScript = [
    '$info = @{}',
    '$os = Get-CimInstance Win32_OperatingSystem',
    '$info.os = @{',
    '  caption = $os.Caption',
    '  version = $os.Version',
    '  buildNumber = $os.BuildNumber',
    '  architecture = $os.OSArchitecture',
    '  totalVisibleMemoryKB = $os.TotalVisibleMemorySize',
    '  freePhysicalMemoryKB = $os.FreePhysicalMemory',
    '  totalVirtualMemoryKB = $os.TotalVirtualMemorySize',
    '  freeVirtualMemoryKB = $os.FreeVirtualMemory',
    '  uptimeSeconds = [math]::Round((New-TimeSpan -Start $os.LastBootUpTime).TotalSeconds, 0)',
    '}',
    '$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1',
    '$info.cpu = @{',
    '  name = $cpu.Name',
    '  cores = $cpu.NumberOfCores',
    '  logicalProcessors = $cpu.NumberOfLogicalProcessors',
    '  maxClockSpeed = $cpu.MaxClockSpeed',
    '  loadPercentage = $cpu.LoadPercentage',
    '}',
    '$disks = Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | Select-Object DeviceID, @{N="SizeGB";E={[math]::Round($_.Size/1GB,2)}}, @{N="FreeGB";E={[math]::Round($_.FreeSpace/1GB,2)}}',
    '$info.disks = $disks',
    '$mem = Get-CimInstance Win32_PhysicalMemory | Measure-Object -Property Capacity -Sum',
    '$info.memory = @{',
    '  totalRAMGB = [math]::Round($mem.Sum / 1GB, 2)',
    '  ramModules = $mem.Count',
    '  usedRAMGB = [math]::Round(($os.TotalVisibleMemorySize - $os.FreePhysicalMemory) / 1048576, 2)',
    '  freeRAMGB = [math]::Round($os.FreePhysicalMemory / 1048576, 2)',
    '  ramUsagePercent = [math]::Round((($os.TotalVisibleMemorySize - $os.FreePhysicalMemory) / $os.TotalVisibleMemorySize) * 100, 1)',
    '}',
    '$gpu = Get-CimInstance Win32_VideoController | Select-Object -First 1',
    '$info.gpu = @{',
    '  name = $gpu.Name',
    '  adapterRAM = $gpu.AdapterRAM',
    '  driverVersion = $gpu.DriverVersion',
    '}',
    '$info.timestamp = (Get-Date).ToString("o")',
    '$info | ConvertTo-Json -Depth 5 -Compress'
  ].join('\n');

  return runPowerShellCommand(psScript, 15000).then(r => {
    let data = {};
    try { data = JSON.parse(r.output.trim()); } catch (e) { data = { raw: r.output, error: e.message }; }
    return {
      success: r.success,
      system: data,
      error: r.error
    };
  });
}

// ============================================================
// NATIVE TOOL DEFINITIONS
// ============================================================

const NATIVE_TOOLS = [
  {
    name: 'run_command',
    description: 'Execute an allow-listed shell command on the PC. Only safe, read-only commands are permitted.',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The command to execute (must be in the allow-list)' },
        timeout_ms: { type: 'number', description: 'Timeout in milliseconds (default 30000)' }
      },
      required: ['command']
    }
  },
  {
    name: 'manage_process',
    description: 'Manage Windows processes: list, start, stop, or get info about running processes.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'start', 'stop', 'info'], description: 'Action to perform' },
        filter: { type: 'string', description: 'Filter process names (for list action)' },
        command: { type: 'string', description: 'Command to start (for start action)' },
        pid: { type: 'number', description: 'Process ID (for stop/info actions)' },
        name: { type: 'string', description: 'Process name (for stop action)' }
      },
      required: ['action']
    }
  },
  {
    name: 'screenshot',
    description: 'Capture a screenshot of the primary screen and save it to a file.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path to save the screenshot (default: temp directory)' }
      },
      required: []
    }
  },
  {
    name: 'clipboard',
    description: 'Read from or write to the Windows clipboard.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['read', 'write'], description: 'Read or write clipboard' },
        text: { type: 'string', description: 'Text to write (for write action)' }
      },
      required: ['action']
    }
  },
  {
    name: 'manage_file',
    description: 'Manage files: delete, move, rename, copy, check existence, or get file info.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['delete', 'move', 'rename', 'copy', 'exists', 'info'], description: 'Action to perform' },
        path: { type: 'string', description: 'File or directory path' },
        destination: { type: 'string', description: 'Destination path (for move/copy)' },
        new_name: { type: 'string', description: 'New name (for rename)' }
      },
      required: ['action', 'path']
    }
  },
  {
    name: 'manage_service',
    description: 'Manage Windows services: list, start, stop, or check status.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'start', 'stop', 'status'], description: 'Action to perform' },
        name: { type: 'string', description: 'Service name (for start/stop/status)' },
        filter: { type: 'string', description: 'Filter service names (for list action)' }
      },
      required: ['action']
    }
  },
  {
    name: 'network_info',
    description: 'Get network configuration: IP addresses, gateway, DNS, listening ports, public IP.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'install_package',
    description: 'Install a software package using winget or chocolatey.',
    inputSchema: {
      type: 'object',
      properties: {
        package: { type: 'string', description: 'Package ID (e.g., "Git.Git" for winget, "git" for choco)' },
        manager: { type: 'string', enum: ['winget', 'choco'], description: 'Package manager to use (default: winget)' }
      },
      required: ['package']
    }
  },
  {
    name: 'notify',
    description: 'Send a Windows toast notification.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Notification title (default: "Notification")' },
        message: { type: 'string', description: 'Notification message body' }
      },
      required: ['message']
    }
  },
  {
    name: 'window_management',
    description: 'Manage application windows: list, minimize, maximize, restore, close, activate, resize, or move.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'minimize', 'maximize', 'restore', 'close', 'activate', 'resize', 'move'], description: 'Action to perform' },
        title: { type: 'string', description: 'Window title (partial match, for window actions)' },
        pid: { type: 'number', description: 'Process ID (alternative to title)' },
        x: { type: 'number', description: 'X coordinate (for resize/move)' },
        y: { type: 'number', description: 'Y coordinate (for resize/move)' },
        width: { type: 'number', description: 'Width in pixels (for resize/move)' },
        height: { type: 'number', description: 'Height in pixels (for resize/move)' }
      },
      required: ['action']
    }
  },
  {
    name: 'registry_read',
    description: 'Read Windows registry key values (read-only, safe).',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Registry path (e.g., HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion)' }
      },
      required: ['path']
    }
  },
  {
    name: 'get_env',
    description: 'List environment variable names and their value lengths (never exposes values).',
    inputSchema: {
      type: 'object',
      properties: {
        filter: { type: 'string', description: 'Filter variable names (wildcard match)' }
      },
      required: []
    }
  },
  {
    name: 'system_info_extended',
    description: 'Get detailed system information: OS, CPU, RAM, disks, GPU, uptime.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  }
];

// ============================================================
// NATIVE TOOL EXECUTION
// ============================================================

async function executeNativeTool(name, args) {
  switch (name) {
    case 'run_command': return await toolRunCommand(args);
    case 'manage_process': return await toolManageProcess(args);
    case 'screenshot': return await toolScreenshot(args);
    case 'clipboard': return await toolClipboard(args);
    case 'manage_file': return await toolManageFile(args);
    case 'manage_service': return await toolManageService(args);
    case 'network_info': return await toolNetworkInfo(args);
    case 'install_package': return await toolInstallPackage(args);
    case 'notify': return await toolNotify(args);
    case 'window_management': return await toolWindowManagement(args);
    case 'registry_read': return await toolRegistryRead(args);
    case 'get_env': return await toolGetEnv(args);
    case 'system_info_extended': return await toolSystemInfoExtended(args);
    default: throw new Error('Unknown native tool: ' + name);
  }
}

// ============================================================
// MCP JSON-RPC HANDLER
// ============================================================

async function handleJsonRpc(request) {
  const { jsonrpc, id, method, params } = request;

  if (jsonrpc !== '2.0') {
    return { jsonrpc: '2.0', id: id || null, error: { code: -32600, message: 'Invalid Request' } };
  }

  try {
    switch (method) {
      case 'initialize':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2025-06-18',
            capabilities: { tools: {} },
            serverInfo: { name: 'unified-mcp-gateway', version: '1.0.0' }
          }
        };

      case 'notifications/initialized':
        return null;

      case 'tools/list': {
        // Fetch upstream tools + add native tools
        const { tools: upstreamTools, errors } = await fetchUpstreamTools();
        const allTools = [...upstreamTools.map(t => {
          const { _upstream, ...tool } = t;
          return tool;
        }), ...NATIVE_TOOLS];
        return {
          jsonrpc: '2.0',
          id,
          result: {
            tools: allTools,
            _meta: {
              upstreamErrors: errors,
              nativeToolCount: NATIVE_TOOLS.length,
              upstreamToolCount: upstreamTools.length,
              totalTools: allTools.length
            }
          }
        };
      }

      case 'tools/call': {
        const { name, arguments: args } = params || {};
        if (!name) return { jsonrpc: '2.0', id, error: { code: -32602, message: 'name is required' } };

        // Check if it's a native tool
        const isNative = NATIVE_TOOLS.some(t => t.name === name);
        if (isNative) {
          const result = await executeNativeTool(name, args || {});
          return {
            jsonrpc: '2.0',
            id,
            result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
          };
        }

        // Proxy to upstream — find which server has this tool
        const { tools: upstreamTools } = await fetchUpstreamTools();
        const upstreamTool = upstreamTools.find(t => t.name === name);
        if (!upstreamTool) {
          return { jsonrpc: '2.0', id, error: { code: -32602, message: 'Unknown tool: ' + name } };
        }

        const resp = await callUpstreamTool(upstreamTool._upstream, name, args || {});
        return {
          jsonrpc: '2.0',
          id,
          result: resp.result || { content: [{ type: 'text', text: JSON.stringify(resp.error || resp) }] }
        };
      }

      case 'ping':
        return { jsonrpc: '2.0', id, result: {} };

      default:
        return { jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found: ' + method } };
    }
  } catch (error) {
    return { jsonrpc: '2.0', id, error: { code: -32603, message: error.message } };
  }
}

// ============================================================
// HTTP SERVER
// ============================================================

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id, Last-Event-ID');
  res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Health check
  if (pathname === '/health' && req.method === 'GET') {
    // Check upstream health
    const upstreamHealth = {};
    for (const [key, srv] of Object.entries(UPSTREAM_SERVERS)) {
      try {
        const resp = await new Promise((resolve, reject) => {
          const r = http.request({ host: srv.host, port: srv.port, path: '/health', method: 'GET', timeout: 3000 }, (res) => {
            let b = ''; res.on('data', c => b += c); res.on('end', () => resolve(b));
          });
          r.on('error', reject); r.on('timeout', () => { r.destroy(); reject(new Error('timeout')); });
          r.end();
        });
        upstreamHealth[key] = JSON.parse(resp).status || 'ok';
      } catch (e) {
        upstreamHealth[key] = 'unreachable';
      }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'unified-mcp-gateway',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      authEnabled: AUTH_ENABLED,
      nativeTools: NATIVE_TOOLS.length,
      upstreamServers: upstreamHealth
    }));
    return;
  }

  // MCP endpoint (POST)
  if (pathname === '/mcp' && req.method === 'POST') {
    if (!checkAuth(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json', 'WWW-Authenticate': 'Bearer' });
      res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Unauthorized: valid bearer token required' } }));
      return;
    }
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const request = JSON.parse(body);
        const requests = Array.isArray(request) ? request : [request];
        const responses = [];

        for (const reqItem of requests) {
          const response = await handleJsonRpc(reqItem);
          if (response !== null) responses.push(response);
        }

        let newSessionId = null;
        if (requests.some(r => r.method === 'initialize')) {
          newSessionId = createSession();
        }

        const headers = { 'Content-Type': 'application/json' };
        if (newSessionId) headers['Mcp-Session-Id'] = newSessionId;

        const responseBody = Array.isArray(request)
          ? JSON.stringify(responses)
          : JSON.stringify(responses[0] || { jsonrpc: '2.0', id: null, result: {} });

        res.writeHead(200, headers);
        res.end(responseBody);
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error', data: error.message } }));
      }
    });
    return;
  }

  // GET /mcp - SSE stream
  if (pathname === '/mcp' && req.method === 'GET') {
    if (!checkAuth(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json', 'WWW-Authenticate': 'Bearer' });
      res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Unauthorized' } }));
      return;
    }
    const sessionId = req.headers['mcp-session-id'];
    if (!sessionId || !sessions.has(sessionId)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32000, message: 'Invalid or missing session ID' } }));
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write('event: endpoint\ndata: /mcp\n\n');
    const keepAlive = setInterval(() => { res.write(': keepalive\n\n'); }, 30000);
    req.on('close', () => { clearInterval(keepAlive); sessions.delete(sessionId); });
    return;
  }

  // DELETE /mcp - terminate session
  if (pathname === '/mcp' && req.method === 'DELETE') {
    if (!checkAuth(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json', 'WWW-Authenticate': 'Bearer' });
      res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Unauthorized' } }));
      return;
    }
    const sessionId = req.headers['mcp-session-id'];
    if (sessionId) sessions.delete(sessionId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'session terminated' }));
    return;
  }

  // Root info
  if (pathname === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      name: 'unified-mcp-gateway',
      version: '1.0.0',
      description: 'Unified MCP Gateway — aggregates Latch, my-mcp-connector, browser-control-mcp + 13 native PC control tools',
      endpoints: { mcp: '/mcp (POST)', health: '/health (GET)' },
      nativeTools: NATIVE_TOOLS.map(t => t.name),
      upstreamServers: Object.entries(UPSTREAM_SERVERS).map(([k, v]) => ({ name: k, port: v.port }))
    }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found' }));
});

server.listen(PORT, HOST, () => {
  console.log('Unified MCP Gateway running at http://' + HOST + ':' + PORT);
  console.log('MCP endpoint: http://' + HOST + ':' + PORT + '/mcp');
  console.log('Health check: http://' + HOST + ':' + PORT + '/health');
  console.log('Native tools (' + NATIVE_TOOLS.length + '): ' + NATIVE_TOOLS.map(t => t.name).join(', '));
  console.log('Upstream servers:');
  for (const [k, v] of Object.entries(UPSTREAM_SERVERS)) {
    console.log('  - ' + k + ': http://' + v.host + ':' + v.port);
  }
});

process.on('SIGINT', () => { server.close(() => process.exit(0)); });
process.on('SIGTERM', () => { server.close(() => process.exit(0)); });
server.on('error', (error) => { console.error('Server error:', error); process.exit(1); });
