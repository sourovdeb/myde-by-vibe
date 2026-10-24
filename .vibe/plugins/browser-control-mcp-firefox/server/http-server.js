const http = require('http');
const url = require('url');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const dotenv = require('dotenv');

dotenv.config({ path: __dirname + '/.env' });

const PORT = process.env.PORT || 3003;
const HOST = process.env.HOST || '0.0.0.0';
const GECKODRIVER_PORT = process.env.GECKODRIVER_PORT || 4444;
const GECKODRIVER_PATH = process.env.GECKODRIVER_PATH || 'geckodriver';
const HEADLESS = process.env.HEADLESS === 'true';
const BROWSER_TIMEOUT = parseInt(process.env.BROWSER_TIMEOUT || '30000', 10);

// Session store for MCP Streamable HTTP transport
const sessions = new Map();

// Selenium WebDriver state
let webdriver = null;
let firefoxBuilder = null;
let driver = null;
let geckoProcess = null;
let windowHandles = [];

// Lazy-load selenium-webdriver (it's a large dependency)
function loadSelenium() {
  if (!webdriver) {
    webdriver = require('selenium-webdriver');
    const firefox = require('selenium-webdriver/firefox');
    firefoxBuilder = { webdriver, firefox };
  }
  return firefoxBuilder;
}

// Find Firefox executable
function findFirefoxPath() {
  if (process.env.FIREFOX_PATH && fs.existsSync(process.env.FIREFOX_PATH)) {
    return process.env.FIREFOX_PATH;
  }
  const candidates = [
    'C:\\Program Files\\Mozilla Firefox\\firefox.exe',
    'C:\\Program Files (x86)\\Mozilla Firefox\\firefox.exe',
    process.env.LOCALAPPDATA + '\\Mozilla Firefox\\firefox.exe',
    'C:\\Program Files\\Firefox Developer Edition\\firefox.exe',
    'C:\\Program Files\\Nightly\\firefox.exe',
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// Find geckodriver executable
function findGeckodriverPath() {
  if (process.env.GECKODRIVER_PATH && fs.existsSync(process.env.GECKODRIVER_PATH)) {
    return process.env.GECKODRIVER_PATH;
  }
  // Check local directory first
  const localPath = path.join(__dirname, 'geckodriver.exe');
  if (fs.existsSync(localPath)) return localPath;
  
  const candidates = [
    'geckodriver.exe',
    'geckodriver',
    path.join(__dirname, 'geckodriver.exe'),
    path.join(__dirname, 'geckodriver'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch (e) {}
  }
  return 'geckodriver'; // Hope it's on PATH
}

// Start geckodriver process
async function startGeckodriver() {
  const gdPath = findGeckodriverPath();
  geckoProcess = spawn(gdPath, ['--port', String(GECKODRIVER_PORT)], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  
  geckoProcess.stdout.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg.includes('Listening')) {
      console.log('geckodriver ready on port ' + GECKODRIVER_PORT);
    }
  });
  geckoProcess.stderr.on('data', (data) => {
    console.error('geckodriver:', data.toString().trim());
  });
  
  // Wait for geckodriver to be ready
  await sleep(2000);
}

// Initialize Firefox driver
async function ensureDriver() {
  if (driver) {
    try {
      // Check if driver is still alive
      await driver.getSession();
      return driver;
    } catch (e) {
      driver = null;
    }
  }
  
  const { webdriver: wd, firefox: ff } = loadSelenium();
  
  // Start geckodriver if not running
  try {
    const testRes = await fetch('http://localhost:' + GECKODRIVER_PORT + '/status');
    if (!testRes.ok) throw new Error('not running');
  } catch (e) {
    await startGeckodriver();
  }
  
  const firefoxPath = findFirefoxPath();
  
  const options = new ff.Options();
  if (firefoxPath) {
    options.setBinary(firefoxPath);
  }
  if (HEADLESS) {
    options.headless();
  }
  
  // Use a dedicated profile to avoid locking issues
  const profileDir = process.env.FIREFOX_PROFILE_DIR || 
    path.join(process.env.LOCALAPPDATA || 'C:\\Users\\souro\\AppData\\Local', 'Mozilla Firefox', 'DebugProfile');
  
  // Set preferences for automation
  options.setPreference('dom.disable_beforeunload', true);
  options.setPreference('browser.shell.checkDefaultBrowser', false);
  options.setPreference('browser.startup.page', 0);
  options.setPreference('browser.startup.homepage_override.mstone', 'ignore');
  options.setPreference('marionette.port', GECKODRIVER_PORT);
  
  const service = new ff.ServiceBuilder()
    .setPort(GECKODRIVER_PORT);
  
  driver = await wd.Builder()
    .forBrowser('firefox')
    .setFirefoxOptions(options)
    .setFirefoxService(service)
    .build();
  
  // Set timeouts
  await driver.manage().setTimeouts({ 
    implicit: 5000, 
    pageLoad: BROWSER_TIMEOUT, 
    script: BROWSER_TIMEOUT 
  });
  
  // Set window size
  await driver.manage().window().setRect({ width: 1920, height: 1080 });
  
  return driver;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Get list of window handles (tabs)
async function getWindowHandles() {
  const d = await ensureDriver();
  const handles = await d.getAllWindowHandles();
  windowHandles = handles;
  return handles;
}

// Tool definitions
const TOOLS = [
  { name: 'firefox_list_tabs', description: 'List all open Firefox browser tabs', inputSchema: { type: 'object', properties: {}, required: [] } },
  { name: 'firefox_new_tab', description: 'Open a new Firefox browser tab', inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } },
  { name: 'firefox_switch_tab', description: 'Switch to a Firefox tab', inputSchema: { type: 'object', properties: { target_id: { type: 'string' }, index: { type: 'number' } } } },
  { name: 'firefox_close_tab', description: 'Close a Firefox tab', inputSchema: { type: 'object', properties: { target_id: { type: 'string' }, index: { type: 'number' } } } },
  { name: 'firefox_navigate', description: 'Navigate Firefox to URL', inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } },
  { name: 'firefox_get_page_info', description: 'Get current Firefox page info', inputSchema: { type: 'object', properties: {}, required: [] } },
  { name: 'firefox_screenshot', description: 'Take screenshot in Firefox', inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } },
  { name: 'firefox_execute_js', description: 'Execute JavaScript in Firefox', inputSchema: { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] } },
  { name: 'firefox_click', description: 'Click at coordinates in Firefox', inputSchema: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } }, required: ['x', 'y'] } },
  { name: 'firefox_type', description: 'Type text in Firefox', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
  { name: 'firefox_get_dom', description: 'Get HTML content from Firefox', inputSchema: { type: 'object', properties: { selector: { type: 'string' } } } },
  { name: 'firefox_scroll', description: 'Scroll Firefox page', inputSchema: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } } } },
];

async function executeTool(name, args) {
  const d = await ensureDriver();
  const { By, until, Key } = loadSelenium().webdriver;
  
  switch (name) {
    case 'firefox_list_tabs': {
      const handles = await getWindowHandles();
      const currentHandle = await d.getWindowHandle();
      const tabs = [];
      for (let i = 0; i < handles.length; i++) {
        await d.switchTo().window(handles[i]);
        const url = await d.getCurrentUrl();
        const title = await d.getTitle();
        tabs.push({
          index: i,
          target_id: handles[i],
          url,
          title,
          active: handles[i] === currentHandle,
        });
      }
      // Switch back to original
      await d.switchTo().window(currentHandle);
      return { output: JSON.stringify(tabs, null, 2) };
    }
    
    case 'firefox_new_tab': {
      if (!args.url) throw new Error('url is required');
      // Open new tab via JS
      await d.executeScript('window.open(arguments[0], "_blank");', args.url);
      await sleep(1000);
      const handles = await getWindowHandles();
      // Switch to the new tab (last one)
      await d.switchTo().window(handles[handles.length - 1]);
      return { output: 'Opened: ' + args.url };
    }
    
    case 'firefox_switch_tab': {
      const handles = await getWindowHandles();
      let handle;
      if (args.target_id) {
        handle = args.target_id;
      } else if (args.index !== undefined) {
        handle = handles[args.index];
      }
      if (!handle) throw new Error('Tab not found');
      await d.switchTo().window(handle);
      const url = await d.getCurrentUrl();
      return { output: 'Switched to: ' + url };
    }
    
    case 'firefox_close_tab': {
      const handles = await getWindowHandles();
      let handle;
      if (args.target_id) {
        handle = args.target_id;
      } else if (args.index !== undefined) {
        handle = handles[args.index];
      }
      if (!handle) throw new Error('Tab not found');
      
      const currentHandle = await d.getWindowHandle();
      await d.switchTo().window(handle);
      await d.close();
      
      // Switch to remaining tab if we closed the current one
      const remaining = await getWindowHandles();
      if (remaining.length > 0 && handle === currentHandle) {
        await d.switchTo().window(remaining[0]);
      }
      return { output: 'Closed tab' };
    }
    
    case 'firefox_navigate': {
      if (!args.url) throw new Error('url is required');
      await d.get(args.url);
      await sleep(1000);
      const url = await d.getCurrentUrl();
      const title = await d.getTitle();
      return { output: 'Navigated to: ' + url + '\nTitle: ' + title };
    }
    
    case 'firefox_get_page_info': {
      const url = await d.getCurrentUrl();
      const title = await d.getTitle();
      const readyState = await d.executeScript('return document.readyState');
      return { output: JSON.stringify({ url, title, readyState }, null, 2) };
    }
    
    case 'firefox_screenshot': {
      if (!args.path) throw new Error('path is required');
      const screenshot = await d.takeScreenshot();
      const buffer = Buffer.from(screenshot, 'base64');
      const savePath = args.path.replace(/\//g, '\\');
      fs.writeFileSync(savePath, buffer);
      return { output: 'Screenshot saved to: ' + savePath + ' (' + buffer.length + ' bytes)' };
    }
    
    case 'firefox_execute_js': {
      if (!args.code) throw new Error('code is required');
      const result = await d.executeScript('return ' + args.code + ';');
      return { output: JSON.stringify(result, null, 2) };
    }
    
    case 'firefox_click': {
      if (args.x === undefined || args.y === undefined) throw new Error('x and y are required');
      // Use ActionChains for coordinate-based click
      const { ActionSequence } = loadSelenium().webdriver;
      const actions = d.actions({ bridge: true });
      await actions.move({ x: args.x, y: args.y }).click().perform();
      return { output: 'Clicked at (' + args.x + ', ' + args.y + ')' };
    }
    
    case 'firefox_type': {
      if (!args.text) throw new Error('text is required');
      // Click on body first to ensure focus, then type
      const body = await d.findElement(By.tagName('body'));
      await body.sendKeys(args.text);
      return { output: 'Typed: ' + args.text };
    }
    
    case 'firefox_get_dom': {
      let html;
      if (args.selector) {
        const escaped = args.selector.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        html = await d.executeScript('var el = document.querySelector(\'' + escaped + '\'); return el ? el.outerHTML : null;');
      } else {
        html = await d.executeScript('return document.documentElement.outerHTML;');
      }
      return { output: JSON.stringify({ html }, null, 2) };
    }
    
    case 'firefox_scroll': {
      const dx = args.x || 0;
      const dy = args.y || 500;
      await d.executeScript('window.scrollBy(arguments[0], arguments[1]);', dx, dy);
      return { output: 'Scrolled by dx=' + dx + ' dy=' + dy };
    }
    
    default:
      throw new Error('Unknown tool: ' + name);
  }
}

function createSession() {
  const id = crypto.randomUUID();
  sessions.set(id, { createdAt: Date.now(), initialized: false });
  return id;
}

function handleJsonRpc(request) {
  const { jsonrpc, id, method, params } = request;
  
  if (jsonrpc !== '2.0') {
    return { jsonrpc: '2.0', id: id || null, error: { code: -32600, message: 'Invalid Request' } };
  }
  
  const asyncHandler = async () => {
    try {
      switch (method) {
        case 'initialize':
          return { jsonrpc: '2.0', id, result: { protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'browser-control-mcp-firefox', version: '1.0.0' } } };
        case 'notifications/initialized':
          return null;
        case 'tools/list':
          return { jsonrpc: '2.0', id, result: { tools: TOOLS } };
        case 'tools/call': {
          const { name, arguments: args } = params || {};
          if (!name) return { jsonrpc: '2.0', id, error: { code: -32602, message: 'name is required' } };
          const result = await executeTool(name, args || {});
          return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: result.output }] } };
        }
        case 'ping':
          return { jsonrpc: '2.0', id, result: {} };
        default:
          return { jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found: ' + method } };
      }
    } catch (error) {
      return { jsonrpc: '2.0', id, error: { code: -32603, message: error.message } };
    }
  };
  
  return asyncHandler();
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id, Last-Event-ID');
  res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
  
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }
  
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  
  if (pathname === '/health' && req.method === 'GET') {
    const firefoxPath = findFirefoxPath();
    const gdPath = findGeckodriverPath();
    let driverStatus = 'not initialized';
    try {
      if (driver) {
        await driver.getSession();
        driverStatus = 'connected';
      }
    } catch (e) {
      driverStatus = 'disconnected';
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'browser-control-mcp-firefox',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      firefoxInstalled: firefoxPath ? true : false,
      firefoxPath: firefoxPath || null,
      geckodriverPath: gdPath,
      geckodriverPort: GECKODRIVER_PORT,
      driverStatus,
      headless: HEADLESS,
    }));
    return;
  }
  
  if (pathname === '/mcp' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const request = JSON.parse(body);
        const requests = Array.isArray(request) ? request : [request];
        const responses = [];
        
        for (const reqItem of requests) {
          const response = await handleJsonRpc(reqItem);
          if (response !== null) {
            responses.push(response);
          }
        }
        
        let newSessionId = null;
        if (requests.some(r => r.method === 'initialize')) {
          newSessionId = createSession();
        }
        
        const headers = { 'Content-Type': 'application/json' };
        if (newSessionId) {
          headers['Mcp-Session-Id'] = newSessionId;
        }
        
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
  
  if (pathname === '/mcp' && req.method === 'GET') {
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
    const keepAlive = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 30000);
    req.on('close', () => {
      clearInterval(keepAlive);
      sessions.delete(sessionId);
    });
    return;
  }
  
  if (pathname === '/mcp' && req.method === 'DELETE') {
    const sessionId = req.headers['mcp-session-id'];
    if (sessionId) {
      sessions.delete(sessionId);
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'session terminated' }));
    return;
  }
  
  if (pathname === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      name: 'browser-control-mcp-firefox',
      version: '1.0.0',
      description: 'Browser Control MCP Server for Firefox',
      endpoints: { mcp: '/mcp (POST)', health: '/health (GET)' },
      tools: TOOLS.map(t => t.name),
      geckodriverPort: GECKODRIVER_PORT,
    }));
    return;
  }
  
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found' }));
});

server.listen(PORT, HOST, () => {
  console.log('Browser Control MCP Server (Firefox) running at http://' + HOST + ':' + PORT);
  console.log('MCP endpoint: http://' + HOST + ':' + PORT + '/mcp');
  console.log('Health check: http://' + HOST + ':' + PORT + '/health');
  console.log('geckodriver port: ' + GECKODRIVER_PORT);
  console.log('Tools: ' + TOOLS.map(t => t.name).join(', '));
  const firefoxPath = findFirefoxPath();
  console.log('Firefox path: ' + (firefoxPath || 'NOT FOUND - install Firefox or set FIREFOX_PATH'));
  console.log('geckodriver path: ' + findGeckodriverPath());
});

// Cleanup on exit
async function cleanup() {
  try {
    if (driver) await driver.quit();
  } catch (e) {}
  try {
    if (geckoProcess) geckoProcess.kill();
  } catch (e) {}
  server.close(() => process.exit(0));
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
server.on('error', (error) => { console.error('Server error:', error); process.exit(1); });
