#!/usr/bin/env node
/**
 * Browser Control MCP — upgraded clean-room server (v2.0.0)
 * Repo: sourovdeb/myde-by-vibe  →  tools/mcp-servers/browser-control-mcp.js
 *
 * Replaces the original "Browser Control MCP" (localhost:3001). Tool names
 * are kept identical to the audited set (15 tools) for drop-in compatibility.
 *
 * Upgrades over the audited version:
 *   - Single instance discipline: fixed default port 3001, banner printed on
 *     start, GET / self-reports the exact tool count (the old bridge page
 *     showed a stale "12 tools" for a 15-tool server).
 *   - Optional bearer-token auth (MYDE_MCP_TOKEN) on every request.
 *   - Binds 127.0.0.1 by default; never exposed to the network.
 *   - CDP connections cached per target with idle cleanup and reconnect.
 *   - Structured JSON-RPC errors; timeouts on CDP calls; graceful shutdown.
 *
 * Run:  node browser-control-mcp.js       (default port 3001, CDP 9222)
 * Env:  PORT, BIND_HOST, MYDE_MCP_TOKEN, CDP_HOST, CDP_PORT,
 *       CDP_CONNECT_TIMEOUT_MS, CDP_CALL_TIMEOUT_MS, MYDE_MAX_DOM_CHARS
 * No npm dependencies. Node >= 16. Requires Chrome started with
 * --remote-debugging-port=<CDP_PORT>.
 */

'use strict';

const http = require('http');
const crypto = require('crypto');

const SERVER_NAME = 'browser-control-mcp';
const SERVER_VERSION = '2.0.0';
const PROTOCOL_VERSION = '2025-06-18';
const STARTED_AT = Date.now();

const CDP_HOST = () => process.env.CDP_HOST || '127.0.0.1';
const CDP_PORT = () => parseInt(process.env.CDP_PORT || '9222', 10);
const CONNECT_TIMEOUT = () => parseInt(process.env.CDP_CONNECT_TIMEOUT_MS || '5000', 10);
const CALL_TIMEOUT = () => parseInt(process.env.CDP_CALL_TIMEOUT_MS || '30000', 10);
const MAX_DOM_CHARS = () => parseInt(process.env.MYDE_MAX_DOM_CHARS || '100000', 10);

// ---------------------------------------------------------------- tiny WS client

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

class WsConnection {
  constructor(socket) {
    this.socket = socket;
    this.buf = Buffer.alloc(0);
    this.fragments = [];
    this.pending = new Map();
    this.eventHandlers = new Map();
    this.nextId = 1;
    this.closed = false;
    socket.setNoDelay(true);
    socket.on('data', (d) => this._feed(d));
    const onDead = () => {
      if (this.closed) return;
      this.closed = true;
      this._flushPending(new Error('connection closed'));
    };
    socket.on('close', onDead);
    socket.on('error', onDead);
  }

  _feed(chunk) {
    this.buf = Buffer.concat([this.buf, chunk]);
    for (;;) {
      const parsed = this._readFrame();
      if (!parsed) break;
      const { opcode, payload, fin } = parsed;
      if (opcode === 0x8) { // close
        this._sendFrame(0x8, payload);
        try { this.socket.end(); } catch (e) { /* ignore */ }
        this.closed = true;
        this._flushPending(new Error('connection closed'));
        return;
      }
      if (opcode === 0x9) { this._sendFrame(0xA, payload); continue; } // ping -> pong
      if (opcode === 0xA) continue; // pong
      if (opcode === 0x1 || opcode === 0x2) {
        if (fin) this._deliver(payload.toString('utf8'));
        else this.fragments = [payload];
        continue;
      }
      if (opcode === 0x0) { // continuation
        if (!this.fragments.length) continue;
        this.fragments.push(payload);
        if (fin) {
          const whole = Buffer.concat(this.fragments);
          this.fragments = [];
          this._deliver(whole.toString('utf8'));
        }
      }
    }
  }

  _readFrame() {
    const buf = this.buf;
    if (buf.length < 2) return null;
    const b0 = buf[0];
    const b1 = buf[1];
    const fin = (b0 & 0x80) !== 0;
    const opcode = b0 & 0x0f;
    const masked = (b1 & 0x80) !== 0;
    let len = b1 & 0x7f;
    let off = 2;
    if (len === 126) {
      if (buf.length < 4) return null;
      len = buf.readUInt16BE(2); off = 4;
    } else if (len === 127) {
      if (buf.length < 10) return null;
      const big = buf.readBigUInt64BE(2);
      if (big > BigInt(64 * 1024 * 1024)) { this.socket.destroy(); return null; }
      len = Number(big); off = 10;
    }
    const maskLen = masked ? 4 : 0;
    if (buf.length < off + maskLen + len) return null;
    let payload = Buffer.from(buf.subarray(off + maskLen, off + maskLen + len));
    if (masked) {
      const mask = buf.subarray(off, off + 4);
      const out = Buffer.allocUnsafe(len);
      for (let i = 0; i < len; i++) out[i] = payload[i] ^ mask[i % 4];
      payload = out;
    }
    this.buf = buf.subarray(off + maskLen + len);
    return { fin, opcode, payload };
  }

  _sendFrame(opcode, payload) {
    if (this.closed) return;
    const mask = crypto.randomBytes(4);
    const len = payload.length;
    let header;
    if (len < 126) {
      header = Buffer.from([0x80 | opcode, 0x80 | len]);
    } else if (len < 65536) {
      header = Buffer.alloc(4);
      header[0] = 0x80 | opcode; header[1] = 0x80 | 126;
      header.writeUInt16BE(len, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x80 | opcode; header[1] = 0x80 | 127;
      header.writeBigUInt64BE(BigInt(len), 2);
    }
    const out = Buffer.alloc(header.length + 4 + len);
    header.copy(out, 0);
    mask.copy(out, header.length);
    for (let i = 0; i < len; i++) out[header.length + 4 + i] = payload[i] ^ mask[i % 4];
    this.socket.write(out);
  }

  _deliver(text) {
    let msg;
    try { msg = JSON.parse(text); } catch (e) { return; }
    if (msg.id !== undefined && this.pending.has(msg.id)) {
      const { resolve, reject, timer } = this.pending.get(msg.id);
      clearTimeout(timer);
      this.pending.delete(msg.id);
      if (msg.error) reject(new Error('CDP error ' + (msg.error.code || '') + ': ' + (msg.error.message || 'unknown')));
      else resolve(msg.result);
      return;
    }
    if (msg.method !== undefined) {
      const handlers = this.eventHandlers.get(msg.method);
      if (handlers) for (const h of handlers) h(msg.params || {});
    }
  }

  _flushPending(err) {
    for (const [, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(err);
    }
    this.pending.clear();
  }

  on(method, handler) {
    if (!this.eventHandlers.has(method)) this.eventHandlers.set(method, []);
    this.eventHandlers.get(method).push(handler);
  }

  sendText(str) { this._sendFrame(0x1, Buffer.from(str, 'utf8')); }

  call(method, params) {
    return new Promise((resolve, reject) => {
      if (this.closed) { reject(new Error('CDP connection closed')); return; }
      const id = this.nextId++;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('CDP call timeout: ' + method));
      }, CALL_TIMEOUT());
      this.pending.set(id, { resolve, reject, timer });
      this.sendText(JSON.stringify({ id, method, params: params || {} }));
    });
  }

  close() {
    this.closed = true;
    this._flushPending(new Error('connection closed'));
    try { this._sendFrame(0x8, Buffer.alloc(0)); } catch (e) { /* ignore */ }
    try { this.socket.end(); } catch (e) { /* ignore */ }
  }
}

function wsConnect(port, host, wsPath) {
  return new Promise((resolve, reject) => {
    const key = crypto.randomBytes(16).toString('base64');
    const req = http.request({
      host, port, path: wsPath,
      headers: {
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        'Sec-WebSocket-Key': key,
        'Sec-WebSocket-Version': '13',
      },
    });
    req.setTimeout(CONNECT_TIMEOUT(), () => { req.destroy(new Error('CDP connect timeout')); });
    req.on('upgrade', (res, socket) => {
      const expected = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
      if (res.headers['sec-websocket-accept'] !== expected) {
        socket.destroy();
        reject(new Error('bad websocket accept header'));
        return;
      }
      resolve(new WsConnection(socket));
    });
    req.on('response', (res) => {
      req.destroy();
      reject(new Error('CDP refused websocket upgrade (HTTP ' + res.statusCode + ')'));
    });
    req.on('error', reject);
    req.end();
  });
}

// ---------------------------------------------------------------- CDP helpers

const wsCache = new Map(); // targetId -> {conn, lastUsed, timer}

function cdpHttp(pathname, method) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: CDP_HOST(), port: CDP_PORT(), path: pathname, method: method || 'GET', timeout: CONNECT_TIMEOUT() },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          let parsed = null;
          try { parsed = body ? JSON.parse(body) : null; } catch (e) { /* text body */ }
          resolve({ status: res.statusCode, body: parsed !== null ? parsed : body });
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error('CDP HTTP timeout')));
    req.on('error', reject);
    req.end();
  });
}

async function listTabsRaw() {
  const res = await cdpHttp('/json/list');
  if (res.status !== 200) throw new Error('CDP /json/list failed: HTTP ' + res.status);
  return (Array.isArray(res.body) ? res.body : []).filter((t) => t.type === 'page');
}

async function getSession(targetId) {
  const now = Date.now();
  const hit = wsCache.get(targetId);
  if (hit && !hit.conn.closed) {
    hit.lastUsed = now;
    return hit.conn;
  }
  if (hit) wsCache.delete(targetId);
  let targets;
  try {
    targets = await listTabsRaw();
  } catch (e) {
    throw new Error('Cannot reach Chrome CDP on ' + CDP_HOST() + ':' + CDP_PORT() + ' (' + e.message + '). Is Chrome running with --remote-debugging-port=' + CDP_PORT() + '?');
  }
  const target = targets.find((t) => t.id === targetId && t.webSocketDebuggerUrl);
  if (!target) throw new Error('Unknown tab target: ' + targetId);
  const conn = await wsConnect(CDP_PORT(), CDP_HOST(), new URL(target.webSocketDebuggerUrl).pathname);
  const entry = { conn, lastUsed: now, timer: null };
  wsCache.set(targetId, entry);
  const reap = () => {
    const cur = wsCache.get(targetId);
    if (cur && (Date.now() - cur.lastUsed) > 120000) {
      wsCache.delete(targetId);
      cur.conn.close();
    } else if (cur) {
      cur.timer = setTimeout(reap, 60000);
    }
  };
  entry.timer = setTimeout(reap, 180000);
  return conn;
}

function closeAllSessions() {
  for (const [, e] of wsCache) { clearTimeout(e.timer); try { e.conn.close(); } catch (err) { /* ignore */ } }
  wsCache.clear();
}

async function evaluateOn(targetId, expression) {
  const conn = await getSession(targetId);
  const result = await conn.call('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    const d = result.exceptionDetails;
    throw new Error('JS error: ' + ((d.exception && d.exception.description) || d.text || 'unknown'));
  }
  return result.result ? result.result.value : undefined;
}

async function activeTargetId(targetId) {
  if (targetId) return targetId;
  const tabs = await listTabsRaw();
  if (!tabs.length) throw new Error('No open page tabs found.');
  return tabs[0].id;
}

// ---------------------------------------------------------------- tools

async function browserListTabs() {
  const tabs = await listTabsRaw();
  return {
    count: tabs.length,
    tabs: tabs.map((t) => ({ targetId: t.id, title: t.title, url: t.url })),
  };
}

async function browserNewTab(args) {
  const url = args && args.url ? args.url : 'about:blank';
  // Chrome 111+ requires PUT for /json/new.
  let res = await cdpHttp('/json/new?' + encodeURIComponent(url), 'PUT');
  if (res.status === 405) res = await cdpHttp('/json/new?' + encodeURIComponent(url), 'GET');
  if (res.status !== 200 || !res.body || !res.body.id) {
    throw new Error('Failed to open tab (HTTP ' + res.status + ')');
  }
  return { targetId: res.body.id, title: res.body.title, url: res.body.url, opened: true };
}

async function browserNavigate(args) {
  if (!args || !args.url) throw new Error('Missing required parameter: url');
  const targetId = await activeTargetId(args.target_id);
  const conn = await getSession(targetId);
  const r = await conn.call('Page.navigate', { url: args.url });
  if (r.errorText) throw new Error('Navigation failed: ' + r.errorText);
  await new Promise((res) => setTimeout(res, args.wait_ms ? Math.min(Number(args.wait_ms), 5000) : 300));
  const info = await browserGetPageInfo({ target_id: targetId });
  return { targetId, navigated: true, frameId: r.frameId || null, page: info };
}

async function browserGetPageInfo(args) {
  const targetId = await activeTargetId(args && args.target_id);
  const value = await evaluateOn(targetId, 'JSON.stringify({url: location.href, title: document.title, readyState: document.readyState})');
  const parsed = typeof value === 'string' ? JSON.parse(value) : value || {};
  return { targetId, url: parsed.url, title: parsed.title, readyState: parsed.readyState };
}

async function browserGetDom(args) {
  const targetId = await activeTargetId(args && args.target_id);
  const sel = args && args.selector ? args.selector : 'html';
  const maxChars = Math.max(1000, Math.min(parseInt(args && args.max_chars, 10) || MAX_DOM_CHARS(), 1000000));
  const value = await evaluateOn(targetId,
    'var el = document.querySelector(' + JSON.stringify(sel) + '); el ? el.outerHTML : null');
  if (value === null || value === undefined) throw new Error('No element matches selector: ' + sel);
  const truncated = value.length > maxChars;
  return { targetId, selector: sel, truncated, dom: truncated ? value.slice(0, maxChars) : value };
}

async function browserGetElementText(args) {
  if (!args || !args.selector) throw new Error('Missing required parameter: selector');
  const targetId = await activeTargetId(args.target_id);
  const value = await evaluateOn(targetId,
    'var el = document.querySelector(' + JSON.stringify(args.selector) + '); el ? el.textContent : null');
  if (value === null || value === undefined) throw new Error('No element matches selector: ' + args.selector);
  return { targetId, selector: args.selector, text: String(value).trim() };
}

async function browserClick(args) {
  if (!args || !args.selector) throw new Error('Missing required parameter: selector');
  const targetId = await activeTargetId(args.target_id);
  const value = await evaluateOn(targetId,
    '(function(){var el = document.querySelector(' + JSON.stringify(args.selector) + ');' +
    'if(!el){return null;} el.scrollIntoView({block:"center"}); el.click(); return true;})()');
  if (value !== true) throw new Error('No element matches selector: ' + args.selector);
  await new Promise((res) => setTimeout(res, args.wait_ms ? Math.min(Number(args.wait_ms), 5000) : 150));
  return { targetId, selector: args.selector, clicked: true };
}

async function browserType(args) {
  if (!args || !args.selector) throw new Error('Missing required parameter: selector');
  if (typeof args.text !== 'string') throw new Error('Missing required parameter: text');
  const targetId = await activeTargetId(args.target_id);
  const expr =
    '(function(){var el = document.querySelector(' + JSON.stringify(args.selector) + ');' +
    'if(!el){return null;} el.focus();' +
    'var d = Object.getOwnPropertyDescriptor(el.__proto__, "value");' +
    'if (d && d.set) { d.set.call(el, ' + JSON.stringify(args.text) + '); } else { el.value = ' + JSON.stringify(args.text) + '; }' +
    'el.dispatchEvent(new Event("input", {bubbles: true}));' +
    'el.dispatchEvent(new Event("change", {bubbles: true}));' +
    'return true;})()';
  const value = await evaluateOn(targetId, expr);
  if (value !== true) throw new Error('No element matches selector: ' + args.selector);
  let submitted = false;
  if (args.submit) {
    submitted = await evaluateOn(targetId,
      '(function(){var f = document.querySelector(' + JSON.stringify(args.selector) + ').closest("form");' +
      'if(f){ if (f.requestSubmit) { f.requestSubmit(); } else { f.submit(); } return true; } return false;})()');
  }
  return { targetId, selector: args.selector, typed: true, submitted: !!submitted };
}

async function browserScroll(args) {
  const targetId = await activeTargetId(args && args.target_id);
  const direction = (args && args.direction) || 'down';
  const amount = Math.max(1, Math.min(parseInt(args && args.amount, 10) || 600, 10000));
  const dy = direction === 'up' ? -amount : direction === 'down' ? amount : 0;
  const dx = direction === 'left' ? -amount : direction === 'right' ? amount : 0;
  if (!dx && !dy) throw new Error('direction must be one of up/down/left/right');
  const pos = await evaluateOn(targetId,
    '(function(){window.scrollBy(' + dx + ', ' + dy + ');' +
    'return JSON.stringify({x: window.scrollX, y: window.scrollY});})()');
  const parsed = typeof pos === 'string' ? JSON.parse(pos) : pos || {};
  return { targetId, scrolled: direction, amount, position: parsed };
}

async function browserExecuteJs(args) {
  if (!args || typeof args.code !== 'string' || !args.code.trim()) throw new Error('Missing required parameter: code');
  const targetId = await activeTargetId(args.target_id);
  const value = await evaluateOn(targetId, args.code);
  return { targetId, result: value === undefined ? null : value };
}

async function browserScreenshot(args) {
  const targetId = await activeTargetId(args && args.target_id);
  const format = (args && args.format) || 'png';
  if (!['png', 'jpeg'].includes(format)) throw new Error('format must be png or jpeg');
  const conn = await getSession(targetId);
  const r = await conn.call('Page.captureScreenshot', { format });
  if (!r || !r.data) throw new Error('Screenshot failed: no data returned');
  return { targetId, format, size_bytes: Math.round(r.data.length * 3 / 4), base64: r.data };
}

async function browserWaitForElement(args) {
  if (!args || !args.selector) throw new Error('Missing required parameter: selector');
  const targetId = await activeTargetId(args.target_id);
  const timeout = Math.max(100, Math.min(parseInt(args.timeout_ms, 10) || 10000, 60000));
  const started = Date.now();
  for (;;) {
    const found = await evaluateOn(targetId,
      '!!document.querySelector(' + JSON.stringify(args.selector) + ')');
    if (found) return { targetId, selector: args.selector, found: true, waited_ms: Date.now() - started };
    if (Date.now() - started >= timeout) {
      return { targetId, selector: args.selector, found: false, waited_ms: Date.now() - started, timed_out: true };
    }
    await new Promise((res) => setTimeout(res, 250));
  }
}

async function browserHandleDialog(args) {
  const targetId = await activeTargetId(args && args.target_id);
  const accept = !(args && args.accept === false);
  const conn = await getSession(targetId);
  await conn.call('Page.enable');
  await conn.call('Page.handleJavaScriptDialog', {
    accept,
    promptText: (args && args.text) || '',
  }).catch((err) => {
    if (/No dialog is showing/i.test(err.message)) {
      throw new Error('No dialog is currently showing on this tab.');
    }
    throw err;
  });
  return { targetId, accepted: accept, handled: true };
}

async function browserSwitchTab(args) {
  if (!args || !args.target_id) throw new Error('Missing required parameter: target_id');
  const tabs = await listTabsRaw();
  const tab = tabs.find((t) => t.id === args.target_id);
  if (!tab) throw new Error('Unknown tab target: ' + args.target_id);
  const res = await cdpHttp('/json/activate/' + encodeURIComponent(args.target_id));
  if (res.status !== 200) throw new Error('Failed to activate tab (HTTP ' + res.status + ')');
  return { targetId: args.target_id, title: tab.title, url: tab.url, activated: true };
}

async function browserCloseTab(args) {
  if (!args || !args.target_id) throw new Error('Missing required parameter: target_id');
  const entry = wsCache.get(args.target_id);
  if (entry) { clearTimeout(entry.timer); try { entry.conn.close(); } catch (err) { /* ignore */ } wsCache.delete(args.target_id); }
  const res = await cdpHttp('/json/close/' + encodeURIComponent(args.target_id));
  if (res.status !== 200) throw new Error('Failed to close tab (HTTP ' + res.status + ')');
  return { targetId: args.target_id, closed: true };
}

// ---------------------------------------------------------------- registry

const TOOLS = [
  { name: 'browser_list_tabs', description: 'List open page tabs (targetId, title, url).', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, handler: browserListTabs },
  { name: 'browser_new_tab', description: 'Open a new tab. Returns its targetId.', inputSchema: { type: 'object', properties: { url: { type: 'string', description: 'URL to open (default about:blank)' } }, additionalProperties: false }, handler: browserNewTab },
  { name: 'browser_navigate', description: 'Navigate a tab to a URL (default active/first tab).', inputSchema: { type: 'object', properties: { url: { type: 'string' }, target_id: { type: 'string' }, wait_ms: { type: 'number', description: 'Settle wait after navigation, max 5000' } }, required: ['url'], additionalProperties: false }, handler: browserNavigate },
  { name: 'browser_get_page_info', description: 'Get a tab URL, title and readyState.', inputSchema: { type: 'object', properties: { target_id: { type: 'string' } }, additionalProperties: false }, handler: browserGetPageInfo },
  { name: 'browser_get_dom', description: 'Get outerHTML of an element (selector, default html), truncated at max_chars.', inputSchema: { type: 'object', properties: { selector: { type: 'string' }, target_id: { type: 'string' }, max_chars: { type: 'number' } }, additionalProperties: false }, handler: browserGetDom },
  { name: 'browser_get_element_text', description: 'Get trimmed textContent of the first element matching a selector.', inputSchema: { type: 'object', properties: { selector: { type: 'string' }, target_id: { type: 'string' } }, required: ['selector'], additionalProperties: false }, handler: browserGetElementText },
  { name: 'browser_click', description: 'Scroll an element into view and click it.', inputSchema: { type: 'object', properties: { selector: { type: 'string' }, target_id: { type: 'string' }, wait_ms: { type: 'number' } }, required: ['selector'], additionalProperties: false }, handler: browserClick },
  { name: 'browser_type', description: 'Type text into an input (native value setter + input/change events); optionally submit its form.', inputSchema: { type: 'object', properties: { selector: { type: 'string' }, text: { type: 'string' }, submit: { type: 'boolean' }, target_id: { type: 'string' } }, required: ['selector', 'text'], additionalProperties: false }, handler: browserType },
  { name: 'browser_scroll', description: 'Scroll the page up/down/left/right by amount pixels.', inputSchema: { type: 'object', properties: { direction: { type: 'string', enum: ['up', 'down', 'left', 'right'] }, amount: { type: 'number' }, target_id: { type: 'string' } }, additionalProperties: false }, handler: browserScroll },
  { name: 'browser_execute_js', description: 'Evaluate JavaScript on a tab (awaits promises, returns value).', inputSchema: { type: 'object', properties: { code: { type: 'string' }, target_id: { type: 'string' } }, required: ['code'], additionalProperties: false }, handler: browserExecuteJs },
  { name: 'browser_screenshot', description: 'Capture a screenshot of a tab as base64 (png or jpeg).', inputSchema: { type: 'object', properties: { format: { type: 'string', enum: ['png', 'jpeg'] }, target_id: { type: 'string' } }, additionalProperties: false }, handler: browserScreenshot },
  { name: 'browser_wait_for_element', description: 'Poll until a selector exists or timeout_ms (default 10000, max 60000).', inputSchema: { type: 'object', properties: { selector: { type: 'string' }, timeout_ms: { type: 'number' }, target_id: { type: 'string' } }, required: ['selector'], additionalProperties: false }, handler: browserWaitForElement },
  { name: 'browser_handle_dialog', description: 'Accept or dismiss a JS dialog (alert/confirm/prompt).', inputSchema: { type: 'object', properties: { accept: { type: 'boolean', default: true }, text: { type: 'string', description: 'Prompt text to reply with' }, target_id: { type: 'string' } }, additionalProperties: false }, handler: browserHandleDialog },
  { name: 'browser_switch_tab', description: 'Bring a tab to the front (activate).', inputSchema: { type: 'object', properties: { target_id: { type: 'string' } }, required: ['target_id'], additionalProperties: false }, handler: browserSwitchTab },
  { name: 'browser_close_tab', description: 'Close a tab by targetId.', inputSchema: { type: 'object', properties: { target_id: { type: 'string' } }, required: ['target_id'], additionalProperties: false }, handler: browserCloseTab },
];

// ---------------------------------------------------------------- MCP core

function jsonRpcResult(id, result) { return { jsonrpc: '2.0', id, result }; }
function jsonRpcError(id, code, message) { return { jsonrpc: '2.0', id, error: { code, message } }; }
function textContent(value) { return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] }; }

async function requestHandler(body) {
  let msg;
  try { msg = JSON.parse(body); } catch (e) { return { status: 400, payload: jsonRpcError(null, -32700, 'Parse error') }; }
  const isBatch = Array.isArray(msg);
  const items = isBatch ? msg : [msg];
  if (items.length === 1 && !isBatch && items[0].id === undefined) {
    return { status: 202, payload: null };
  }
  const handleOne = async (m) => {
    if (!m || typeof m !== 'object' || m.jsonrpc !== '2.0' || typeof m.method !== 'string') {
      return jsonRpcError(m && m.id !== undefined ? m.id : null, -32600, 'Invalid Request');
    }
    switch (m.method) {
      case 'initialize':
        return jsonRpcResult(m.id, {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
        });
      case 'ping':
        return jsonRpcResult(m.id, {});
      case 'tools/list':
        return jsonRpcResult(m.id, { tools: TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })) });
      case 'tools/call': {
        const name = m.params && m.params.name;
        const args = (m.params && m.params.arguments) || {};
        const tool = TOOLS.find((t) => t.name === name);
        if (!tool) return jsonRpcError(m.id, -32602, 'Unknown tool: ' + name);
        try {
          const value = await tool.handler(args);
          return jsonRpcResult(m.id, textContent(value));
        } catch (err) {
          return jsonRpcResult(m.id, {
            content: [{ type: 'text', text: 'Tool error: ' + (err && err.message ? err.message : String(err)) }],
            isError: true,
          });
        }
      }
      default:
        return jsonRpcError(m.id, -32601, 'Method not found: ' + m.method);
    }
  };
  const responses = [];
  for (const m of items) responses.push(await handleOne(m));
  if (!responses.length) return { status: 202, payload: null };
  return { status: 200, payload: isBatch ? responses : responses[0] };
}

function authorize(req) {
  const token = process.env.MYDE_MCP_TOKEN;
  if (!token) return true;
  return (req.headers['authorization'] || '') === 'Bearer ' + token;
}

function createServer() {
  return http.createServer((req, res) => {
    if (req.method === 'GET' && (req.url === '/' || req.url === '/health')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        service: SERVER_NAME,
        version: SERVER_VERSION,
        protocol: PROTOCOL_VERSION,
        tools: TOOLS.length,
        cdp: 'http://' + CDP_HOST() + ':' + CDP_PORT(),
        uptime_seconds: Math.round((Date.now() - STARTED_AT) / 1000),
      }));
      return;
    }
    if (req.method === 'DELETE') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, note: 'stateless server' }));
      return;
    }
    if (req.method !== 'POST' || !/^\/mcp\/?$/.test(req.url)) {
      res.writeHead(405, { 'Content-Type': 'application/json', Allow: 'POST, GET' });
      res.end(JSON.stringify({ error: 'Method Not Allowed. Use POST /mcp or GET /.' }));
      return;
    }
    if (!authorize(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json', 'WWW-Authenticate': 'Bearer' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
    const chunks = [];
    let size = 0;
    req.on('data', (c) => { size += c.length; if (size > 16 * 1024 * 1024) { req.destroy(); return; } chunks.push(c); });
    req.on('end', () => {
      requestHandler(Buffer.concat(chunks).toString('utf8'))
        .then(({ status, payload }) => {
          if (payload === null) { res.writeHead(status); res.end(); return; }
          res.writeHead(status, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(payload));
        })
        .catch(() => {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32603, message: 'Internal error' } }));
        });
    });
    req.on('error', () => { /* client aborted */ });
  });
}

// ---------------------------------------------------------------- entry points

function start(options) {
  const opts = options || {};
  const port = (opts.port === undefined || opts.port === null) ? parseInt(process.env.PORT || '3001', 10) : opts.port;
  const host = opts.host || process.env.BIND_HOST || '127.0.0.1';
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on('error', reject);
    server.listen(port, host, () => {
      const actualPort = server.address().port;
      const shutdown = () => {
        closeAllSessions();
        server.close(() => process.exit(0));
        setTimeout(() => process.exit(0), 1500).unref();
      };
      if (opts.registerSignals !== false && !process.listenerCount('SIGINT')) {
        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
      }
      resolve({ server, port: actualPort, host, tools: TOOLS.length, stop: () => new Promise((r) => { closeAllSessions(); server.close(() => r(null)); }) });
    });
  });
}

if (require.main === module) {
  start().then((info) => {
    process.stdout.write(
      'browser-control-mcp v' + SERVER_VERSION + ' on http://' + info.host + ':' + info.port +
      ' (' + info.tools + ' tools, CDP ' + CDP_HOST() + ':' + CDP_PORT() +
      ', auth ' + (process.env.MYDE_MCP_TOKEN ? 'on' : 'off') + ')\n'
    );
  }).catch((err) => {
    process.stderr.write('Failed to start: ' + err.message + '\n');
    process.exit(1);
  });
}

module.exports = { start, TOOLS, requestHandler, SERVER_NAME, SERVER_VERSION, closeAllSessions };
