const http = require('http');
const url = require('url');
const { spawn } = require('child_process');
const dotenv = require('dotenv');

dotenv.config({ path: __dirname + '/.env' });

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';
const BROWSER_HARNESS = process.env.BROWSER_HARNESS || 'browser-harness';

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
  { name: 'browser_list_tabs', description: 'List all open browser tabs', inputSchema: { type: 'object', properties: {}, required: [] } },
  { name: 'browser_new_tab', description: 'Open a new browser tab', inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } },
  { name: 'browser_switch_tab', description: 'Switch to a tab', inputSchema: { type: 'object', properties: { target_id: { type: 'string' }, index: { type: 'number' } } } },
  { name: 'browser_close_tab', description: 'Close a tab', inputSchema: { type: 'object', properties: { target_id: { type: 'string' }, index: { type: 'number' } } } },
  { name: 'browser_navigate', description: 'Navigate to URL', inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } },
  { name: 'browser_get_page_info', description: 'Get current page info', inputSchema: { type: 'object', properties: {}, required: [] } },
  { name: 'browser_screenshot', description: 'Take screenshot', inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } },
  { name: 'browser_execute_js', description: 'Execute JavaScript', inputSchema: { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] } },
  { name: 'browser_click', description: 'Click at coordinates', inputSchema: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } }, required: ['x', 'y'] } },
  { name: 'browser_type', description: 'Type text', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
  { name: 'browser_get_dom', description: 'Get HTML content', inputSchema: { type: 'object', properties: { selector: { type: 'string' } } } },
  { name: 'browser_scroll', description: 'Scroll page', inputSchema: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } } } }
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
          return { jsonrpc: '2.0', id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'browser-control-mcp', version: '1.0.0' } } };
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
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
        const response = await handleJsonRpc(request);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error', data: error.message } }));
      }
    });
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
