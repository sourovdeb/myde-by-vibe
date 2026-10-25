#!/usr/bin/env node
/**
 * Mock Chrome DevTools Protocol server for testing browser-control-mcp.
 * Implements the HTTP discovery endpoints (/json/list, /json/new, /json/activate,
 * /json/close) and a minimal WebSocket endpoint speaking CDP, with canned
 * responses keyed on Runtime.evaluate expression markers.
 * Loopback only. No npm dependencies.
 */

'use strict';

const http = require('http');
const crypto = require('crypto');

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

const TABS = [
  { id: 'MOCKTAB1', type: 'page', title: 'Mock Page', url: 'http://127.0.0.1/mock', webSocketDebuggerUrl: 'WSURL_PLACEHOLDER/devtools/page/MOCKTAB1' },
  { id: 'MOCKTAB2', type: 'page', title: 'Second Mock Page', url: 'http://127.0.0.1/mock2', webSocketDebuggerUrl: 'WSURL_PLACEHOLDER/devtools/page/MOCKTAB2' },
  { id: 'BROWSERTYPE-OTHER', type: 'browser', title: 'Browser', url: '', webSocketDebuggerUrl: 'WSURL_PLACEHOLDER/devtools/browser' },
];
let newTabCounter = 0;
const closedTabs = new Set();
let mockPort = 0;

function wsBase() { return 'ws://127.0.0.1:' + mockPort; }

function evaluateMock(expression) {
  const expr = String(expression);
  if (expr.includes('location.href')) {
    return JSON.stringify({ url: 'http://127.0.0.1/mock', title: 'Mock Page', readyState: 'complete' });
  }
  if (expr.includes('outerHTML')) return '<html><body><main>mock dom</main></body></html>';
  if (expr.includes('textContent')) return 'mock element text';
  if (expr.includes('el.click()')) return true;
  if (expr.includes('el.focus()')) return true;
  if (expr.includes('requestSubmit')) return true;
  if (expr.includes('window.scrollBy')) return JSON.stringify({ x: 0, y: 600 });
  if (expr.includes('!!document.querySelector')) return true;
  if (expr.trim() === '2 + 2') return 4;
  return null;
}

function cdpResult(method, params) {
  switch (method) {
    case 'Runtime.evaluate':
      return { result: { type: 'object', value: evaluateMock(params.expression) } };
    case 'Page.navigate':
      return { frameId: 'frame0', loaderId: 'loader0' };
    case 'Page.enable':
      return {};
    case 'Page.captureScreenshot':
      return { data: Buffer.from('mock-png-bytes').toString('base64') };
    case 'Page.handleJavaScriptDialog':
      return {};
    default:
      return {};
  }
}

class MockWsSession {
  constructor(socket) {
    this.socket = socket;
    this.buf = Buffer.alloc(0);
    this.dead = false;
    socket.setNoDelay(true);
    socket.on('data', (d) => this.feed(d));
    const dead = () => { this.dead = true; };
    socket.on('close', dead);
    socket.on('error', dead);
  }

  feed(chunk) {
    if (this.dead) return;
    this.buf = Buffer.concat([this.buf, chunk]);
    for (;;) {
      if (this.buf.length < 2) return;
      const b0 = this.buf[0], b1 = this.buf[1];
      const opcode = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f;
      let off = 2;
      if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (this.buf.length < 10) return; len = Number(this.buf.readBigUInt64BE(2)); off = 10; }
      const maskLen = masked ? 4 : 0;
      if (this.buf.length < off + maskLen + len) return;
      let payload = this.buf.subarray(off + maskLen, off + maskLen + len);
      if (masked) {
        const mask = this.buf.subarray(off, off + 4);
        const out = Buffer.allocUnsafe(len);
        for (let i = 0; i < len; i++) out[i] = payload[i] ^ mask[i % 4];
        payload = out;
      }
      this.buf = this.buf.subarray(off + maskLen + len);
      if (opcode === 0x8) { this.sendFrame(0x8, Buffer.alloc(0)); this.socket.end(); return; }
      if (opcode === 0x9) { this.sendFrame(0xA, payload); continue; }
      if (opcode === 0x1) this.onText(payload.toString('utf8'));
    }
  }

  sendFrame(opcode, payload) {
    const len = payload.length;
    let header;
    if (len < 126) header = Buffer.from([0x80 | opcode, len]);
    else if (len < 65536) { header = Buffer.alloc(4); header[0] = 0x80 | opcode; header[1] = 126; header.writeUInt16BE(len, 2); }
    else { header = Buffer.alloc(10); header[0] = 0x80 | opcode; header[1] = 127; header.writeBigUInt64BE(BigInt(len), 2); }
    this.socket.write(Buffer.concat([header, payload]));
  }

  onText(text) {
    let msg;
    try { msg = JSON.parse(text); } catch (e) { return; }
    if (msg.id === undefined) return;
    this.sendFrame(0x1, Buffer.from(JSON.stringify({ id: msg.id, result: cdpResult(msg.method, msg.params || {}) })));
  }
}

function startMockCdp(port) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = req.url.split('?')[0];
      const q = req.url.split('?')[1] || '';
      const sendJson = (code, obj) => {
        res.writeHead(code, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(obj));
      };
      if (url === '/json/list' || url === '/json') {
        sendJson(200, TABS
          .filter((t) => !closedTabs.has(t.id))
          .map((t) => Object.assign({}, t, { webSocketDebuggerUrl: t.webSocketDebuggerUrl.replace('WSURL_PLACEHOLDER', wsBase()) })));
        return;
      }
      if (url === '/json/new') {
        newTabCounter += 1;
        const id = 'NEWTAB' + newTabCounter;
        const targetUrl = decodeURIComponent(q);
        sendJson(200, { id, type: 'page', title: 'New Mock Tab', url: targetUrl, webSocketDebuggerUrl: wsBase() + '/devtools/page/' + id });
        return;
      }
      const activate = /^\/json\/activate\/(.+)$/.exec(url);
      if (activate) {
        const id = activate[1];
        if (TABS.some((t) => t.id === id)) { res.writeHead(200); res.end('Target activated'); }
        else { res.writeHead(404); res.end('No such target'); }
        return;
      }
      const close = /^\/json\/close\/(.+)$/.exec(url);
      if (close) {
        const id = close[1];
        if (TABS.some((t) => t.id === id)) { closedTabs.add(id); res.writeHead(200); res.end('Target is closing'); }
        else { res.writeHead(404); res.end('No such target'); }
        return;
      }
      res.writeHead(404); res.end('not found');
    });
    server.on('upgrade', (req, socket) => {
      const key = req.headers['sec-websocket-key'];
      if (!key) { socket.destroy(); return; }
      const accept = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
      socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
      new MockWsSession(socket);
    });
    server.on('error', reject);
    server.listen(port || 0, '127.0.0.1', () => {
      mockPort = server.address().port;
      resolve({
        port: mockPort,
        stop: () => new Promise((r) => server.close(() => r(null))),
      });
    });
  });
}

module.exports = { startMockCdp };
