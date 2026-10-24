const http = require('http');
const url = require('url');
const crypto = require('crypto');
const { spawn } = require('child_process');
const dotenv = require('dotenv');

dotenv.config({ path: __dirname + '/.env' });

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';
const BROWSER_HARNESS = process.env.BROWSER_HARNESS || 'browser-harness';

// Session store for MCP Streamable HTTP transport
const sessions = new Map();

function createSession() {
  const id = crypto.randomUUID();
  sessions.set(id, { createdAt: Date.now(), initialized: false });
  return id;
}

// Helper to execute browser-harness commands by spawning process and writing to stdin
function runBrowserHarness(script) {
  return new Promise((resolve) => {
    const proc = spawn(BROWSER_HARNESS, [], {
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, output: stdout, error: stderr });
      } else {
        resolve({ success: false, error: stderr || 'Process exited with code ' + code, output: stdout, stderr: stderr });
      }
    });
    
    proc.on('error', (err) => {
      resolve({ success: false, error: err.message, output: stdout, stderr: stderr });
    });
    
    // Write the script to stdin and close it
    proc.stdin.write(script);
    proc.stdin.end();
    
    // Timeout after 60 seconds
    setTimeout(() => {
      proc.kill();
      resolve({ success: false, error: 'Timeout after 60 seconds', output: stdout, stderr: stderr });
    }, 60000);
  });
}

// Tool definitions
const TOOLS = [
  { name: 'browser_list_tabs', description: 'Retrieve a list of all currently open browser tabs with their details', inputSchema: { type: 'object', properties: {}, required: [] } },
  { name: 'browser_new_tab', description: 'Open a new browser tab and navigate it to a specified URL', inputSchema: { type: 'object', properties: { url: { type: 'string', description: 'The URL to open in the new tab' } }, required: ['url'] } },
  { name: 'browser_switch_tab', description: 'Switch the active context to a specific browser tab using its ID or index', inputSchema: { type: 'object', properties: { target_id: { type: 'string', description: 'The target ID of the tab to switch to' }, index: { type: 'number', description: 'The zero-based index of the tab to switch to' } } } },
  { name: 'browser_close_tab', description: 'Close a specific browser tab using its ID or index', inputSchema: { type: 'object', properties: { target_id: { type: 'string', description: 'The target ID of the tab to close' }, index: { type: 'number', description: 'The zero-based index of the tab to close' } } } },
  { name: 'browser_navigate', description: 'Navigate the current active tab to a specified URL', inputSchema: { type: 'object', properties: { url: { type: 'string', description: 'The URL to navigate to' } }, required: ['url'] } },
  { name: 'browser_get_page_info', description: 'Retrieve the current page\'s URL, title, and readiness state', inputSchema: { type: 'object', properties: {}, required: [] } },
  { name: 'browser_screenshot', description: 'Capture a screenshot of the current page and save it to a specified file path', inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'The file path where the screenshot will be saved (e.g. H:/screenshot.png)' } }, required: ['path'] } },
  { name: 'browser_execute_js', description: 'Execute a provided JavaScript code string in the context of the current page', inputSchema: { type: 'object', properties: { code: { type: 'string', description: 'The JavaScript code to execute' } }, required: ['code'] } },
  { name: 'browser_click', description: 'Perform a mouse click action at specific x and y coordinates on the page', inputSchema: { type: 'object', properties: { x: { type: 'number', description: 'The x coordinate to click at' }, y: { type: 'number', description: 'The y coordinate to click at' } }, required: ['x', 'y'] } },
  { name: 'browser_type', description: 'Type a specified text string into the currently focused input element', inputSchema: { type: 'object', properties: { text: { type: 'string', description: 'The text to type' } }, required: ['text'] } },
  { name: 'browser_get_dom', description: 'Retrieve the HTML content of the entire page or a specific element', inputSchema: { type: 'object', properties: { selector: { type: 'string', description: 'CSS selector for a specific element (optional, returns full page if omitted)' } } } },
  { name: 'browser_scroll', description: 'Scroll the current page by a specified number of x and y pixels', inputSchema: { type: 'object', properties: { x: { type: 'number', description: 'Horizontal scroll amount in pixels (default 0)' }, y: { type: 'number', description: 'Vertical scroll amount in pixels (default 500)' } } } },
  { name: 'browser_wait_for_element', description: 'Wait for an element matching a CSS selector to appear on the page within a given timeout', inputSchema: { type: 'object', properties: { selector: { type: 'string', description: 'CSS selector to wait for' }, timeout_ms: { type: 'number', description: 'Maximum time to wait in milliseconds (default 10000)' } }, required: ['selector'] } },
  { name: 'browser_get_element_text', description: 'Extract the text content, inner HTML, and attributes of a specified element', inputSchema: { type: 'object', properties: { selector: { type: 'string', description: 'CSS selector for the target element' } }, required: ['selector'] } },
  { name: 'browser_handle_dialog', description: 'Handle JavaScript alert/confirm/prompt dialogs by accepting or dismissing them', inputSchema: { type: 'object', properties: { action: { type: 'string', enum: ['accept', 'dismiss'], description: 'Whether to accept or dismiss the dialog' }, prompt_text: { type: 'string', description: 'Text to enter if the dialog is a prompt (only used with accept action)' } }, required: ['action'] } }
];

async function executeTool(name, args) {
  let script = '';
  
  switch (name) {
    case 'browser_list_tabs':
      script = 'import json\ntabs = list_tabs()\nprint(json.dumps(tabs, indent=2))';
      break;
    case 'browser_new_tab':
      if (!args.url) throw new Error('url is required');
      script = 'new_tab(url=' + JSON.stringify(args.url) + ')\nprint("Opened: " + ' + JSON.stringify(args.url) + ')';
      break;
    case 'browser_switch_tab':
      if (args.target_id) {
        script = 'switch_tab(target=' + JSON.stringify(args.target_id) + ')\nprint("Switched to: " + ' + JSON.stringify(args.target_id) + ')';
      } else if (args.index !== undefined) {
        script = 'tabs = list_tabs()\nif ' + args.index + ' < len(tabs):\n    switch_tab(target=tabs[' + args.index + ']["target_id"])\n    print("Switched to index " + str(' + args.index + '))\nelse:\n    print("Error: index out of range")';
      } else {
        throw new Error('target_id or index is required');
      }
      break;
    case 'browser_close_tab':
      if (args.target_id) {
        script = 'close_tab(target=' + JSON.stringify(args.target_id) + ')\nprint("Closed: " + ' + JSON.stringify(args.target_id) + ')';
      } else if (args.index !== undefined) {
        script = 'tabs = list_tabs()\nif ' + args.index + ' < len(tabs):\n    close_tab(target=tabs[' + args.index + ']["target_id"])\n    print("Closed index " + str(' + args.index + '))\nelse:\n    print("Error: index out of range")';
      } else {
        throw new Error('target_id or index is required');
      }
      break;
    case 'browser_navigate':
      if (!args.url) throw new Error('url is required');
      script = 'goto_url(' + JSON.stringify(args.url) + ')\ninfo = page_info()\nprint("Navigated to: " + info.get("url", "unknown"))\nprint("Title: " + info.get("title", "unknown"))';
      break;
    case 'browser_get_page_info':
      script = 'import json\ninfo = page_info()\nprint(json.dumps(info, indent=2))';
      break;
    case 'browser_screenshot':
      if (!args.path) throw new Error('path is required');
      var pyPath = args.path.split('\\').join('/');
      script = 'capture_screenshot(path=' + JSON.stringify(pyPath) + ')\nprint("Screenshot saved to: " + ' + JSON.stringify(pyPath) + ')';
      break;
    case 'browser_execute_js':
      if (!args.code) throw new Error('code is required');
      script = 'import json\nresult = js(' + JSON.stringify(args.code) + ')\nprint(json.dumps(result, indent=2, default=str))';
      break;
    case 'browser_click':
      if (args.x === undefined || args.y === undefined) throw new Error('x and y are required');
      script = 'click_at_xy(' + args.x + ', ' + args.y + ')\nprint("Clicked at (" + str(' + args.x + ') + ", " + str(' + args.y + ') + ")")';
      break;
    case 'browser_type':
      if (!args.text) throw new Error('text is required');
      script = 'type_text(' + JSON.stringify(args.text) + ')\nprint("Typed: " + ' + JSON.stringify(args.text) + ')';
      break;
    case 'browser_get_dom':
      if (args.selector) {
        var sel = args.selector.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        script = 'import json\nresult = js("var el = document.querySelector(\'' + sel + '\'); el ? el.outerHTML : null")\nprint(json.dumps({"html": result}, indent=2))';
      } else {
        script = 'import json\nresult = js("document.documentElement.outerHTML")\nprint(json.dumps({"html": result}, indent=2))';
      }
      break;
    case 'browser_scroll':
      var scrollDx = args.x || 0;
      var scrollDy = args.y || 500;
      script = 'js("window.scrollBy(' + scrollDx + ', ' + scrollDy + ')")\nprint("Scrolled by dx=" + str(' + scrollDx + ') + " dy=" + str(' + scrollDy + ') + ")")';
      break;
    case 'browser_wait_for_element': {
      if (!args.selector) throw new Error('selector is required');
      var timeoutMs = args.timeout_ms || 10000;
      // Inject selector as JSON (valid Python string literal), parse in Python
      var selJson = JSON.stringify(args.selector);
      script = [
        'import json, time',
        'selector = json.loads(' + JSON.stringify(selJson) + ')',
        'timeout_ms = ' + timeoutMs,
        'start = time.time()',
        'found = False',
        'elapsed = 0',
        'js_expr = "document.querySelector(" + json.dumps(selector) + ") !== null"',
        'while elapsed < timeout_ms:',
        '    result = js(js_expr)',
        '    if result:',
        '        found = True',
        '        break',
        '    time.sleep(0.2)',
        '    elapsed = int((time.time() - start) * 1000)',
        'print(json.dumps({"found": found, "selector": selector, "elapsed_ms": elapsed}))'
      ].join('\n');
      break;
    }
    case 'browser_get_element_text': {
      if (!args.selector) throw new Error('selector is required');
      var selJson2 = JSON.stringify(args.selector);
      script = [
        'import json',
        'selector = json.loads(' + JSON.stringify(selJson2) + ')',
        'js_code = "(() => { const el = document.querySelector(" + json.dumps(selector) + "); if (!el) return JSON.stringify({exists: false, text: \\"\\", html: \\"\\", attributes: {}}); const attrs = {}; for (let i = 0; i < el.attributes.length; i++) { attrs[el.attributes[i].name] = el.attributes[i].value; } return JSON.stringify({exists: true, text: el.innerText || el.textContent || \\"\\", html: el.innerHTML || \\"\\", attributes: attrs}); })()"',
        'result = js(js_code)',
        'data = json.loads(result) if isinstance(result, str) else result',
        'print(json.dumps(data, indent=2))'
      ].join('\n');
      break;
    }
    case 'browser_handle_dialog': {
      if (!args.action) throw new Error('action is required (accept or dismiss)');
      var actionJson = JSON.stringify(args.action);
      var promptJson = JSON.stringify(args.prompt_text || '');
      script = [
        'import json',
        'action = json.loads(' + JSON.stringify(actionJson) + ')',
        'prompt_text = json.loads(' + JSON.stringify(promptJson) + ')',
        'accept_str = "true" if action == "accept" else "false"',
        'action_str = json.dumps(action)',
        'js_code = "(() => { const accept = " + accept_str + "; const pt = " + json.dumps(prompt_text) + "; const act = " + action_str + "; window.alert = function() { return undefined; }; window.confirm = function() { return accept; }; window.prompt = function(msg, def) { return accept ? (pt || def || \\"\\") : null; }; return JSON.stringify({handled: true, action: act}); })()"',
        'result = js(js_code)',
        'print(result)'
      ].join('\n');
      break;
    }
    default:
      throw new Error('Unknown tool: ' + name);
  }
  
  const result = await runBrowserHarness(script);
  
  if (!result.success) {
    throw new Error('Browser harness error: ' + result.error);
  }
  
  return { output: result.output, stderr: result.error };
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
          return { jsonrpc: '2.0', id, result: { protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'browser-control-mcp', version: '1.0.0' } } };
        case 'notifications/initialized':
          return null; // Notification, no response needed
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
    let bhStatus = 'unknown';
    try {
      const testResult = await runBrowserHarness('print("browser-harness is working")');
      bhStatus = testResult.success ? 'available' : 'error: ' + testResult.error;
    } catch (e) { bhStatus = 'not available'; }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'browser-control-mcp', version: '1.0.0', timestamp: new Date().toISOString(), browserHarness: bhStatus, chromeConnected: bhStatus === 'available' }));
    return;
  }
  
  if (pathname === '/mcp' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const request = JSON.parse(body);
        const sessionId = req.headers['mcp-session-id'];
        
        // Handle batch requests
        const requests = Array.isArray(request) ? request : [request];
        const responses = [];
        
        for (const reqItem of requests) {
          const response = await handleJsonRpc(reqItem);
          if (response !== null) {
            responses.push(response);
          }
        }
        
        // For initialize, create a new session
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
  
  // GET /mcp - SSE stream endpoint (Streamable HTTP transport)
  if (pathname === '/mcp' && req.method === 'GET') {
    const sessionId = req.headers['mcp-session-id'];
    if (!sessionId || !sessions.has(sessionId)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32000, message: 'Invalid or missing session ID' } }));
      return;
    }
    // Set up SSE stream
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write('event: endpoint\ndata: /mcp\n\n');
    // Keep connection alive
    const keepAlive = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 30000);
    req.on('close', () => {
      clearInterval(keepAlive);
      sessions.delete(sessionId);
    });
    return;
  }
  
  // DELETE /mcp - terminate session
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
    res.end(JSON.stringify({ name: 'browser-control-mcp', version: '1.0.0', description: 'Browser Control MCP Server', endpoints: { mcp: '/mcp (POST)', health: '/health (GET)' }, tools: TOOLS.map(t => t.name) }));
    return;
  }
  
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found' }));
});

server.listen(PORT, HOST, () => {
  console.log('Browser Control MCP Server running at http://' + HOST + ':' + PORT);
  console.log('MCP endpoint: http://' + HOST + ':' + PORT + '/mcp');
  console.log('Health check: http://' + HOST + ':' + PORT + '/health');
  console.log('Tools: ' + TOOLS.map(t => t.name).join(', '));
});

process.on('SIGINT', () => { server.close(() => process.exit(0)); });
process.on('SIGTERM', () => { server.close(() => process.exit(0)); });
server.on('error', (error) => { console.error('Server error:', error); process.exit(1); });
