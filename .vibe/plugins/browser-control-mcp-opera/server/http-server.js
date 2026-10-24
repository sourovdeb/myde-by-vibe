const http = require('http');
const url = require('url');
const crypto = require('crypto');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const dotenv = require('dotenv');

dotenv.config({ path: __dirname + '/.env' });

const PORT = process.env.PORT || 3002;
const HOST = process.env.HOST || '0.0.0.0';
const CDP_PORT = process.env.CDP_PORT || 9223;
const BROWSER_TIMEOUT = parseInt(process.env.BROWSER_TIMEOUT || '30000', 10);

// Session store for MCP Streamable HTTP transport
const sessions = new Map();

// CDP connection state
let cdpWs = null;
let cdpMessageId = 0;
let cdpPending = new Map();
let currentTarget = null;
let operaProcess = null;

// Find Opera executable
function findOperaPath() {
  if (process.env.OPERA_PATH && fs.existsSync(process.env.OPERA_PATH)) {
    return process.env.OPERA_PATH;
  }
  const candidates = [
    process.env.LOCALAPPDATA + '\\Programs\\Opera\\opera.exe',
    process.env.LOCALAPPDATA + '\\Programs\\Opera GX\\opera.exe',
    'C:\\Program Files\\Opera\\opera.exe',
    'C:\\Program Files (x86)\\Opera\\opera.exe',
    'C:\\Program Files\\Opera GX\\opera.exe',
    'C:\\Program Files (x86)\\Opera GX\\opera.exe',
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// Launch Opera with remote debugging
async function launchOpera() {
  const operaPath = findOperaPath();
  if (!operaPath) {
    throw new Error('Opera not found. Install Opera or set OPERA_PATH in .env');
  }
  
  // Use a separate user-data-dir to avoid the Chrome 156 default-profile CDP restriction
  const userDataDir = path.join(process.env.LOCALAPPDATA || 'C:\\Users\\souro\\AppData\\Local', 'Opera', 'DebugProfile');
  
  const args = [
    '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + userDataDir,
    '--no-first-run',
    '--no-default-browser-check',
  ];
  
  operaProcess = spawn(operaPath, args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
  });
  operaProcess.unref();
  
  // Wait for CDP to be ready
  await waitForCDP(15000);
  return operaPath;
}

// Wait for CDP endpoint to be available
async function waitForCDP(timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const targets = await getCDPTargets();
      if (targets.length > 0) return targets;
    } catch (e) {
      // Not ready yet
    }
    await sleep(500);
  }
  throw new Error('CDP endpoint not available after ' + timeoutMs + 'ms');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Get list of CDP targets from Opera
async function getCDPTargets() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:' + CDP_PORT + '/json', (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// Connect to CDP WebSocket for a specific target
async function connectCDP(targetInfo) {
  if (cdpWs && cdpWs.readyState === WebSocket.OPEN) {
    cdpWs.close();
  }
  
  cdpWs = new WebSocket(targetInfo.webSocketDebuggerUrl, {
    perMessageDeflate: false,
    maxPayload: 256 * 1024 * 1024, // 256MB for large DOM
  });
  
  cdpWs.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.id && cdpPending.has(msg.id)) {
        const { resolve, reject } = cdpPending.get(msg.id);
        cdpPending.delete(msg.id);
        if (msg.error) {
          reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        } else {
          resolve(msg.result);
        }
      }
    } catch (e) {
      // Ignore parse errors for events
    }
  });
  
  cdpWs.on('error', (err) => {
    console.error('CDP WebSocket error:', err.message);
  });
  
  cdpWs.on('close', () => {
    cdpWs = null;
  });
  
  await new Promise((resolve, reject) => {
    cdpWs.on('open', resolve);
    cdpWs.on('error', reject);
    setTimeout(() => reject(new Error('CDP WebSocket connection timeout')), 10000);
  });
  
  currentTarget = targetInfo;
  return targetInfo;
}

// Send CDP command
async function cdpSend(method, params = {}) {
  if (!cdpWs || cdpWs.readyState !== WebSocket.OPEN) {
    throw new Error('CDP not connected. Call ensureConnected() first.');
  }
  
  const id = ++cdpMessageId;
  return new Promise((resolve, reject) => {
    cdpPending.set(id, { resolve, reject });
    cdpWs.send(JSON.stringify({ id, method, params }));
    setTimeout(() => {
      if (cdpPending.has(id)) {
        cdpPending.delete(id);
        reject(new Error('CDP command timeout: ' + method));
      }
    }, BROWSER_TIMEOUT);
  });
}

// Ensure we have a CDP connection to a page target
async function ensureConnected() {
  // Check if existing connection is alive
  if (cdpWs && cdpWs.readyState === WebSocket.OPEN && currentTarget) {
    return currentTarget;
  }
  
  // Try to connect to existing Opera instance
  let targets;
  try {
    targets = await getCDPTargets();
  } catch (e) {
    // Opera not running, launch it
    await launchOpera();
    targets = await getCDPTargets();
  }
  
  // Find a page target (prefer the active one)
  let pageTarget = targets.find(t => t.type === 'page');
  if (!pageTarget) {
    // Create a new tab via the browser-level WebSocket
    const browserWs = targets.find(t => t.type === 'browser');
    if (browserWs) {
      const ws = new WebSocket(browserWs.webSocketDebuggerUrl);
      await new Promise((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
        setTimeout(() => reject(new Error('timeout')), 5000);
      });
      const id = ++cdpMessageId;
      const result = await new Promise((resolve, reject) => {
        const handler = (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.id === id) {
            ws.removeListener('message', handler);
            resolve(msg.result);
          }
        };
        ws.on('message', handler);
        ws.send(JSON.stringify({ id, method: 'Target.createTarget', params: { url: 'about:blank' } }));
        setTimeout(() => reject(new Error('timeout')), 5000);
      });
      ws.close();
      targets = await getCDPTargets();
      pageTarget = targets.find(t => t.type === 'page');
    }
  }
  
  if (!pageTarget) {
    throw new Error('No page target found in Opera');
  }
  
  await connectCDP(pageTarget);
  return pageTarget;
}

// List all tabs
async function listTabs() {
  const targets = await getCDPTargets();
  return targets
    .filter(t => t.type === 'page')
    .map((t, i) => ({
      index: i,
      target_id: t.id,
      url: t.url,
      title: t.title,
      webSocketDebuggerUrl: t.webSocketDebuggerUrl,
    }));
}

// Tool definitions
const TOOLS = [
  { name: 'opera_list_tabs', description: 'List all open Opera browser tabs', inputSchema: { type: 'object', properties: {}, required: [] } },
  { name: 'opera_new_tab', description: 'Open a new Opera browser tab', inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } },
  { name: 'opera_switch_tab', description: 'Switch to an Opera tab', inputSchema: { type: 'object', properties: { target_id: { type: 'string' }, index: { type: 'number' } } } },
  { name: 'opera_close_tab', description: 'Close an Opera tab', inputSchema: { type: 'object', properties: { target_id: { type: 'string' }, index: { type: 'number' } } } },
  { name: 'opera_navigate', description: 'Navigate Opera to URL', inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } },
  { name: 'opera_get_page_info', description: 'Get current Opera page info', inputSchema: { type: 'object', properties: {}, required: [] } },
  { name: 'opera_screenshot', description: 'Take screenshot in Opera', inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } },
  { name: 'opera_execute_js', description: 'Execute JavaScript in Opera', inputSchema: { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] } },
  { name: 'opera_click', description: 'Click at coordinates in Opera', inputSchema: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } }, required: ['x', 'y'] } },
  { name: 'opera_type', description: 'Type text in Opera', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
  { name: 'opera_get_dom', description: 'Get HTML content from Opera', inputSchema: { type: 'object', properties: { selector: { type: 'string' } } } },
  { name: 'opera_scroll', description: 'Scroll Opera page', inputSchema: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } } } },
  { name: 'opera_wait_for_element', description: 'Wait for a CSS selector to appear on the Opera page within a given timeout', inputSchema: { type: 'object', properties: { selector: { type: 'string', description: 'CSS selector to wait for' }, timeout_ms: { type: 'number', description: 'Maximum time to wait in milliseconds (default 10000)' } }, required: ['selector'] } },
  { name: 'opera_get_element_text', description: 'Extract the text content, inner HTML, and attributes of a specified element in Opera', inputSchema: { type: 'object', properties: { selector: { type: 'string', description: 'CSS selector for the target element' } }, required: ['selector'] } },
  { name: 'opera_handle_dialog', description: 'Handle JavaScript alert/confirm/prompt dialogs in Opera by accepting or dismissing them', inputSchema: { type: 'object', properties: { action: { type: 'string', enum: ['accept', 'dismiss'], description: 'Whether to accept or dismiss the dialog' }, prompt_text: { type: 'string', description: 'Text to enter if the dialog is a prompt (only used with accept action)' } }, required: ['action'] } },
];

async function executeTool(name, args) {
  switch (name) {
    case 'opera_list_tabs': {
      const tabs = await listTabs();
      return { output: JSON.stringify(tabs, null, 2) };
    }
    
    case 'opera_new_tab': {
      if (!args.url) throw new Error('url is required');
      // Use browser-level CDP to create a new target
      const targets = await getCDPTargets();
      const browserTarget = targets.find(t => t.type === 'browser');
      if (!browserTarget) throw new Error('No browser target found');
      
      const ws = new WebSocket(browserTarget.webSocketDebuggerUrl);
      await new Promise((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
        setTimeout(() => reject(new Error('timeout')), 5000);
      });
      
      const id = ++cdpMessageId;
      const result = await new Promise((resolve, reject) => {
        const handler = (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.id === id) {
            ws.removeListener('message', handler);
            if (msg.error) reject(new Error(msg.error.message));
            else resolve(msg.result);
          }
        };
        ws.on('message', handler);
        ws.send(JSON.stringify({ id, method: 'Target.createTarget', params: { url: args.url } }));
        setTimeout(() => reject(new Error('timeout')), 5000);
      });
      ws.close();
      return { output: 'Opened: ' + args.url + ' (targetId: ' + result.targetId + ')' };
    }
    
    case 'opera_switch_tab': {
      const tabs = await listTabs();
      let target;
      if (args.target_id) {
        target = tabs.find(t => t.target_id === args.target_id);
      } else if (args.index !== undefined) {
        target = tabs[args.index];
      }
      if (!target) throw new Error('Tab not found');
      
      const targets = await getCDPTargets();
      const fullTarget = targets.find(t => t.id === target.target_id);
      if (!fullTarget) throw new Error('Target not found in CDP');
      
      await connectCDP(fullTarget);
      // Activate the tab
      await cdpSend('Target.activateTarget', { targetId: target.target_id });
      return { output: 'Switched to: ' + target.url };
    }
    
    case 'opera_close_tab': {
      const tabs = await listTabs();
      let target;
      if (args.target_id) {
        target = tabs.find(t => t.target_id === args.target_id);
      } else if (args.index !== undefined) {
        target = tabs[args.index];
      }
      if (!target) throw new Error('Tab not found');
      
      const targets = await getCDPTargets();
      const browserTarget = targets.find(t => t.type === 'browser');
      if (!browserTarget) throw new Error('No browser target found');
      
      const ws = new WebSocket(browserTarget.webSocketDebuggerUrl);
      await new Promise((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
        setTimeout(() => reject(new Error('timeout')), 5000);
      });
      
      const id = ++cdpMessageId;
      await new Promise((resolve, reject) => {
        const handler = (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.id === id) {
            ws.removeListener('message', handler);
            if (msg.error) reject(new Error(msg.error.message));
            else resolve(msg.result);
          }
        };
        ws.on('message', handler);
        ws.send(JSON.stringify({ id, method: 'Target.closeTarget', params: { targetId: target.target_id } }));
        setTimeout(() => reject(new Error('timeout')), 5000);
      });
      ws.close();
      return { output: 'Closed: ' + target.url };
    }
    
    case 'opera_navigate': {
      if (!args.url) throw new Error('url is required');
      await ensureConnected();
      await cdpSend('Page.enable');
      await cdpSend('Page.navigate', { url: args.url });
      await sleep(1500); // Wait for page load
      const info = await cdpSend('Runtime.evaluate', {
        expression: 'JSON.stringify({url: location.href, title: document.title})',
        returnByValue: true,
      });
      const pageInfo = JSON.parse(info.result.value || '{}');
      return { output: 'Navigated to: ' + pageInfo.url + '\nTitle: ' + pageInfo.title };
    }
    
    case 'opera_get_page_info': {
      await ensureConnected();
      const info = await cdpSend('Runtime.evaluate', {
        expression: 'JSON.stringify({url: location.href, title: document.title, readyState: document.readyState})',
        returnByValue: true,
      });
      return { output: info.result.value || '{}' };
    }
    
    case 'opera_screenshot': {
      if (!args.path) throw new Error('path is required');
      await ensureConnected();
      await cdpSend('Page.enable');
      const result = await cdpSend('Page.captureScreenshot', { format: 'png' });
      const buffer = Buffer.from(result.data, 'base64');
      // Normalize path for Windows
      const savePath = args.path.replace(/\//g, '\\');
      fs.writeFileSync(savePath, buffer);
      return { output: 'Screenshot saved to: ' + savePath + ' (' + buffer.length + ' bytes)' };
    }
    
    case 'opera_execute_js': {
      if (!args.code) throw new Error('code is required');
      await ensureConnected();
      const result = await cdpSend('Runtime.evaluate', {
        expression: args.code,
        returnByValue: true,
        awaitPromise: true,
      });
      if (result.exceptionDetails) {
        throw new Error('JS error: ' + JSON.stringify(result.exceptionDetails));
      }
      return { output: JSON.stringify(result.result.value !== undefined ? result.result.value : result.result, null, 2) };
    }
    
    case 'opera_click': {
      if (args.x === undefined || args.y === undefined) throw new Error('x and y are required');
      await ensureConnected();
      await cdpSend('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x: args.x,
        y: args.y,
        button: 'left',
        clickCount: 1,
      });
      await cdpSend('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x: args.x,
        y: args.y,
        button: 'left',
        clickCount: 1,
      });
      return { output: 'Clicked at (' + args.x + ', ' + args.y + ')' };
    }
    
    case 'opera_type': {
      if (!args.text) throw new Error('text is required');
      await ensureConnected();
      for (const char of args.text) {
        await cdpSend('Input.dispatchKeyEvent', {
          type: 'char',
          text: char,
        });
      }
      return { output: 'Typed: ' + args.text };
    }
    
    case 'opera_get_dom': {
      await ensureConnected();
      let expression;
      if (args.selector) {
        const sel = args.selector.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        expression = 'var el = document.querySelector(\'' + sel + '\'); el ? el.outerHTML : null';
      } else {
        expression = 'document.documentElement.outerHTML';
      }
      const result = await cdpSend('Runtime.evaluate', {
        expression,
        returnByValue: true,
      });
      return { output: JSON.stringify({ html: result.result.value }, null, 2) };
    }
    
    case 'opera_scroll': {
      const dx = args.x || 0;
      const dy = args.y || 500;
      await ensureConnected();
      await cdpSend('Runtime.evaluate', {
        expression: 'window.scrollBy(' + dx + ', ' + dy + '); "scrolled"',
        returnByValue: true,
      });
      return { output: 'Scrolled by dx=' + dx + ' dy=' + dy };
    }
    
    case 'opera_wait_for_element': {
      if (!args.selector) throw new Error('selector is required');
      const timeoutMs = args.timeout_ms || 10000;
      await ensureConnected();
      const start = Date.now();
      let found = false;
      let elapsed = 0;
      const selJson = JSON.stringify(args.selector);
      while (elapsed < timeoutMs) {
        const result = await cdpSend('Runtime.evaluate', {
          expression: 'document.querySelector(' + selJson + ') !== null',
          returnByValue: true,
        });
        if (result.result.value === true) {
          found = true;
          break;
        }
        await sleep(200);
        elapsed = Date.now() - start;
      }
      return { output: JSON.stringify({ found, selector: args.selector, elapsed_ms: elapsed }) };
    }
    
    case 'opera_get_element_text': {
      if (!args.selector) throw new Error('selector is required');
      await ensureConnected();
      const selJson = JSON.stringify(args.selector);
      const result = await cdpSend('Runtime.evaluate', {
        expression: '(() => { const el = document.querySelector(' + selJson + '); if (!el) return JSON.stringify({exists: false, text: "", html: "", attributes: {}}); const attrs = {}; for (let i = 0; i < el.attributes.length; i++) { attrs[el.attributes[i].name] = el.attributes[i].value; } return JSON.stringify({exists: true, text: el.innerText || el.textContent || "", html: el.innerHTML || "", attributes: attrs}); })()',
        returnByValue: true,
      });
      const data = JSON.parse(result.result.value || '{}');
      return { output: JSON.stringify(data, null, 2) };
    }
    
    case 'opera_handle_dialog': {
      if (!args.action) throw new Error('action is required (accept or dismiss)');
      await ensureConnected();
      const accept = args.action === 'accept';
      const promptText = args.prompt_text || '';
      // Override dialog functions to auto-handle
      await cdpSend('Runtime.evaluate', {
        expression: '(() => { const accept = ' + accept + '; const pt = ' + JSON.stringify(promptText) + '; window.alert = function() { return undefined; }; window.confirm = function() { return accept; }; window.prompt = function(msg, def) { return accept ? (pt || def || "") : null; }; return JSON.stringify({handled: true, action: accept ? "accept" : "dismiss"}); })()',
        returnByValue: true,
      });
      return { output: JSON.stringify({ handled: true, action: args.action }) };
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
          return { jsonrpc: '2.0', id, result: { protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'browser-control-mcp-opera', version: '1.0.0' } } };
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
    let operaStatus = 'unknown';
    let cdpStatus = 'unknown';
    try {
      const targets = await getCDPTargets();
      cdpStatus = 'available (' + targets.length + ' targets)';
      operaStatus = 'running';
    } catch (e) {
      operaStatus = 'not running';
      cdpStatus = 'unavailable';
    }
    const operaPath = findOperaPath();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'browser-control-mcp-opera',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      operaInstalled: operaPath ? true : false,
      operaPath: operaPath || null,
      operaRunning: operaStatus === 'running',
      cdpPort: CDP_PORT,
      cdpStatus,
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
      name: 'browser-control-mcp-opera',
      version: '1.0.0',
      description: 'Browser Control MCP Server for Opera',
      endpoints: { mcp: '/mcp (POST)', health: '/health (GET)' },
      tools: TOOLS.map(t => t.name),
      cdpPort: CDP_PORT,
    }));
    return;
  }
  
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found' }));
});

server.listen(PORT, HOST, () => {
  console.log('Browser Control MCP Server (Opera) running at http://' + HOST + ':' + PORT);
  console.log('MCP endpoint: http://' + HOST + ':' + PORT + '/mcp');
  console.log('Health check: http://' + HOST + ':' + PORT + '/health');
  console.log('CDP port: ' + CDP_PORT);
  console.log('Tools: ' + TOOLS.map(t => t.name).join(', '));
  const operaPath = findOperaPath();
  console.log('Opera path: ' + (operaPath || 'NOT FOUND - install Opera or set OPERA_PATH'));
});

process.on('SIGINT', () => { 
  if (cdpWs) cdpWs.close();
  server.close(() => process.exit(0)); 
});
process.on('SIGTERM', () => { 
  if (cdpWs) cdpWs.close();
  server.close(() => process.exit(0)); 
});
server.on('error', (error) => { console.error('Server error:', error); process.exit(1); });
