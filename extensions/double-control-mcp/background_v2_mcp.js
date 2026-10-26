// Double Control Extension v2.0.0 - MCP Enhanced Background Service Worker (ES module)
//
// What this worker does:
//   1. Tab control (cache + create/close/switch) - the v1 behavior, kept.
//   2. MCP client: probes /health and drives Streamable HTTP (protocol 2025-06-18)
//      against the four local MCP servers (3000-3003) and the Cloudflare tunnel.
//      Browser / system tools need NO key. (No key is ever stored for MCP.)
//   3. Mistral embeddings: POST /v1/embeddings with mistral-embed-2312 (1024-d)
//      or codestral-embed-2505 (1536-d). The Bearer key is read from
//      chrome.storage.local ("mistralKey") at call time - never hard-coded,
//      never logged, never returned to the UI (only its length is reported).
//
// Security: This file contains NO secret. The key, when set, lives only in
// the extension's private chrome.storage.local on this machine.

const MCP_ENDPOINTS = {
  system:   { label: 'System Info (3000)',        base: 'http://localhost:3000' },
  chrome:   { label: 'Browser Control / Chrome (3001)', base: 'http://localhost:3001' },
  opera:    { label: 'Browser Control / Opera (3002)', base: 'http://localhost:3002' },
  firefox:  { label: 'Browser Control / Firefox (3003)', base: 'http://localhost:3003' }
};
const TUNNEL_ENDPOINT = {
  label: 'Cloudflare tunnel (ephemeral)',
  // Ephemeral: regenerated on every cloudflared restart. Overridden at runtime
  // via {cmd:"mcp_set_tunnel", url} if the user passes a fresh URL.
  base: 'https://chocolate-loading-scanning-matthew.trycloudflare.com'
};

const MISTRAL_EMBED_BASE = 'https://api.mistral.ai/v1/embeddings';
const EMBED_MODELS = {
  'mistral-embed-2312':  { note: 'general text, 1024-d (verified 2026-10-24)' },
  'codestral-embed-2505': { note: 'code, 1536-d (verified 2026-10-24)' }
};

// ---------------------------------------------------------------------------
// Tab cache (v1 behavior)
// ---------------------------------------------------------------------------
let tabsCache = [];
async function updateTabCache() {
  try {
    const tabs = await chrome.tabs.query({});
    tabsCache = tabs;
  } catch (_) {}
}
function slimTabs() {
  return tabsCache.map(t => ({ id: t.id, title: t.title, url: t.url, active: t.active, windowId: t.windowId }));
}
chrome.tabs.onCreated?.addListener(updateTabCache);
chrome.tabs.onUpdated?.addListener(updateTabCache);
chrome.tabs.onRemoved?.addListener(updateTabCache);
chrome.tabs.onActivated?.addListener(updateTabCache);
updateTabCache();
setInterval(updateTabCache, 5000);

// ---------------------------------------------------------------------------
// MCP client (Streamable HTTP). One session id per server base.
// ---------------------------------------------------------------------------
const mcpSessions = new Map(); // base -> { sessionId, initialized, tools }

async function parseBody(resp) {
  const ct = resp.headers.get('content-type') || '';
  const raw = await resp.text();
  if (ct.includes('text/event-stream')) {
    // Take the first JSON payload from the SSE stream.
    const lines = raw.split('\n').filter(l => l.startsWith('data:'));
    if (lines.length) return JSON.parse(lines[0].slice(5).trim());
    return { sseRaw: raw.slice(0, 500) };
  }
  try { return JSON.parse(raw); } catch (_) { return { raw: raw.slice(0, 500) }; }
}

async function mcpPost(base, id, method, params) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream'
  };
  const sess = mcpSessions.get(base);
  if (sess?.sessionId) headers['Mcp-Session-Id'] = sess.sessionId;

  const resp = await fetch(base.replace(/\/$/, '') + '/mcp', {
    method: 'POST', headers, body: JSON.stringify({ jsonrpc: '2.0', id, method, params })
  });
  if (!resp.ok) throw new Error(`MCP ${method} -> HTTP ${resp.status}`);

  const sid = resp.headers.get('Mcp-Session-Id');
  if (sid) mcpSessions.set(base, { ...(mcpSessions.get(base) || {}), sessionId: sid });

  const data = await parseBody(resp);
  if (method === 'initialize') {
    // Fire the initialized notification (best-effort; ignore errors).
    try {
      await fetch(base.replace(/\/$/, '') + '/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream',
                  ...(sid ? { 'Mcp-Session-Id': sid } : {}) },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })
      });
    } catch (_) {}
    mcpSessions.set(base, { ...(mcpSessions.get(base) || {}), initialized: true });
  }
  return data;
}

const SERVER_ALIAS = {
  system: 'system', systemInfo: 'system',
  chrome: 'chrome', browserControl: 'chrome',
  opera: 'opera', browserControlOpera: 'opera',
  firefox: 'firefox', browserControlFirefox: 'firefox',
  tunnel: 'tunnel'
};
function resolveBase(server) {
  const key = SERVER_ALIAS[server] || server;
  if (key === 'tunnel') return TUNNEL_ENDPOINT.base;
  const ep = MCP_ENDPOINTS[key];
  if (!ep) throw new Error(`Unknown MCP server "${server}". Use: ${Object.keys(MCP_ENDPOINTS).concat('tunnel').join(', ')} (aliases: systemInfo, browserControl, browserControlOpera, browserControlFirefox).`);
  return ep.base;
}

const LOCAL_BRIDGES = {
  latch: { label: 'Latch MCP', base: 'http://127.0.0.1:3939', mcp: '/mcp/pi' },
  mcpBridge: { label: 'mcp-bridge', base: 'http://127.0.0.1:8765', mcp: '/mcp', admin: 'http://127.0.0.1:8766/' }
};

async function localBridgeProbe(which) {
  const spec = LOCAL_BRIDGES[which];
  if (!spec) return { error: 'unknown bridge' };
  const prefs = await chrome.storage.local.get(['latchCalls', 'bridgeCalls']);
  const callsOn = which === 'latch' ? prefs.latchCalls !== false : prefs.bridgeCalls !== false;
  const out = { which, label: spec.label, base: spec.base, callsOn, alive: false, tools: [] };
  try {
    const healthPath = which === 'mcpBridge' ? '/healthz' : '/';
    const hr = await fetch(spec.base + healthPath, { method: 'GET' });
    out.http = hr.status;
    out.alive = hr.status > 0 && hr.status < 500;
  } catch (e) {
    out.error = String(e.message || e).slice(0, 160);
  }
  if (!callsOn) return out;
  try {
    const init = await fetch(spec.base + spec.mcp, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'double-control', version: '2.0.0' } } })
    });
    out.initStatus = init.status;
    if (init.ok) out.alive = true;
    const listed = await fetch(spec.base + spec.mcp, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })
    });
    out.toolsStatus = listed.status;
    if (listed.ok) {
      const body = await listed.json();
      const tools = body.result?.tools || [];
      out.tools = tools.map(t => t.name).slice(0, 20);
      out.toolCount = tools.length;
      out.alive = true;
    }
  } catch (e) {
    out.rpcError = String(e.message || e).slice(0, 160);
  }
  return out;
}

async function mcpHealth(server) {
  const base = resolveBase(server);
  const out = { server, base, alive: false };
  try {
    const r = await fetch(base.replace(/\/$/, '') + '/health', { method: 'GET' });
    out.alive = r.ok;
    out.status = r.status;
    if (r.ok) { try { out.body = (await r.text()).slice(0, 200); } catch (_) {} }
  } catch (e) { out.alive = false; out.error = String(e.message || e).slice(0, 120); }
  return out;
}

async function mcpTools(server) {
  const base = resolveBase(server);
  if (!(mcpSessions.get(base)?.initialized)) {
    await mcpPost(base, 1, 'initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'double-control-extension', version: '2.0.0' }
    });
  }
  const res = await mcpPost(base, 2, 'tools/list', {});
  const tools = res?.result?.tools || res?.tools || [];
  mcpSessions.set(base, { ...(mcpSessions.get(base) || {}), tools });
  return tools.map(t => ({ name: t.name, desc: (t.description || '').slice(0, 160), schema: t.inputSchema }));
}

async function mcpCall(server, tool, args = {}) {
  const base = resolveBase(server);
  if (!(mcpSessions.get(base)?.initialized)) await (await mcpTools(server));
  const res = await mcpPost(base, 3, 'tools/call', { name: tool, arguments: args });
  return res;
}

// ---------------------------------------------------------------------------
// Mistral embeddings
// ---------------------------------------------------------------------------
async function getKey() {
  const { mistralKey } = await chrome.storage.local.get(['mistralKey']);
  return mistralKey || '';
}
async function embed(texts, model = 'mistral-embed-2312') {
  if (!EMBED_MODELS[model]) throw new Error(`Unknown embed model "${model}". Use: ${Object.keys(EMBED_MODELS).join(', ')}.`);
  const key = await getKey();
  if (!key) throw new Error('No Mistral key set. Open the extension popup and paste your MISTRAL_API_KEY once (stored only in chrome.storage.local).');
  const resp = await fetch(MISTRAL_EMBED_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
    body: JSON.stringify({ model, input: Array.isArray(texts) ? texts : [texts], encoding_format: 'float' })
  });
  if (!resp.ok) {
    let msg = 'HTTP ' + resp.status;
    try { const j = await resp.json(); msg += ' ' + JSON.stringify(j).slice(0, 200); } catch (_) {}
    throw new Error('Mistral embeddings failed: ' + msg);
  }
  const data = await resp.json();
  const vectors = data.data.map(d => d.embedding);
  const dim = vectors[0]?.length ?? 0;
  return { model, dim, note: EMBED_MODELS[model].note, vectors, indices: data.data.map(d => d.index) };
}
function cosine(a, b) {
  if (!a?.length || a.length !== b?.length) return NaN;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? NaN : dot / denom;
}

// ---------------------------------------------------------------------------
// Message router (popup, content scripts, external + native ports)
// ---------------------------------------------------------------------------
async function handle(msg) {
  switch (msg.cmd) {
    case 'tabs':           return { tabs: slimTabs() };
    case 'tab_open':       await chrome.tabs.create({ url: msg.url }); return { ok: true };
    case 'tab_close':      await chrome.tabs.remove(msg.id);          return { ok: true };
    case 'tab_switch':     await chrome.tabs.update(msg.id, { active: true }); return { ok: true };

    case 'mcp_health':     return { endpoints: await Promise.all([
        ...Object.keys(MCP_ENDPOINTS).map(s => mcpHealth(s)),
        mcpHealth('tunnel')
      ]) };
    case 'mcp_tools':      return { server: msg.server, tools: await mcpTools(msg.server) };
    case 'mcp_call':       return { result: await mcpCall(msg.server, msg.tool, msg.args || {}) };
    case 'local_bridge_status': return await localBridgeProbe(msg.which);
    case 'local_bridge_set': {
      const key = msg.which === 'latch' ? 'latchCalls' : 'bridgeCalls';
      await chrome.storage.local.set({ [key]: !!msg.on });
      return { ok: true, which: msg.which, on: !!msg.on, note: 'Extension calls only. Latch config and mcp-bridge process were not changed.' };
    }

    case 'ping':           return { ok: true };
    case 'tabs_refresh':   updateTabCache(); return { ok: true };

    case 'find_similar_tabs': {
      const query = msg.query;
      if (!query) return { error: 'query required' };
      const model = msg.model || 'mistral-embed-2312';
      const threshold = msg.threshold ?? 0.7, limit = msg.limit ?? 10;
      await updateTabCache();
      const cand = tabsCache
        .filter(t => t.url && !/^chrome(-extension)?:/i.test(t.url) && !/^about:/i.test(t.url))
        .slice(0, 200);
      if (!cand.length) return { tabs: [] };
      const inputs = [query, ...cand.map(t => ((t.title || '') + ' ' + (t.url || '')).slice(0, 2000))];
      const { vectors } = await embed(inputs, model);
      const qv = vectors[0];
      const tabs = cand
        .map((t, i) => ({ id: t.id, title: t.title, url: t.url, sim: cosine(qv, vectors[i + 1]) }))
        .filter(x => Number.isFinite(x.sim) && x.sim >= threshold)
        .sort((a, b) => b.sim - a.sim)
        .slice(0, limit)
        .map(x => ({ id: x.id, title: x.title, url: x.url, sim: Number(x.sim.toFixed(4)) }));
      return { tabs, model, threshold, limit };
    }

    case 'check_remote_debug': {
      let open = false, info = '';
      try {
        const r = await fetch('http://127.0.0.1:9222/json/version', { method: 'GET' });
        open = true; // any HTTP response means port 9222 is listening.
        info = r.ok
          ? 'HTTP ' + r.status + ' :: ' + ((await r.text()) || '').slice(0, 160)
          : 'HTTP ' + r.status + ' - port 9222 is open (Chrome 156+ returns 404/empty on DevTools HTTP paths; only the WebSocket endpoint works - gotcha #10)';
      } catch (e) { open = false; info = String(e.message || e).slice(0, 120) + ' - port 9222 not listening'; }
      return { open, info, note: open ? '' : 'Chrome 156+ ignores --remote-debugging-port on the default profile; use the DebugFull copied-profile workaround (see AGENTS.md gotcha #9).' };
    }

    case 'launch_chrome_debug': {
      const command = "powershell -Command \"Start-Process 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' -ArgumentList '--remote-debugging-port=9222','--user-data-dir=C:\\Users\\souro\\AppData\\Local\\Google\\Chrome\\DebugFull'\"";
      return { launched: false, note: 'Service workers cannot spawn processes. Run the command below (DebugFull copied profile + CDP 9222; the default-profile flag is silently ignored on Chrome 156+). Copy the DebugFull profile first if it does not exist.', command };
    }

    case 'embed':          return { result: await embed(msg.texts, msg.model) };
    case 'embed_compare': {
      const m = msg.model || 'mistral-embed-2312';
      const { vectors } = await embed([msg.a, msg.b], m);
      return { model: m, similarity: cosine(vectors[0], vectors[1]), a: vectors[0], b: vectors[1] };
    }
    case 'embed_active_page': {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (!tab?.id) throw new Error('No active tab found.');
      const info = await chrome.tabs.sendMessage(tab.id, { cmd: 'page_text' });
      return { result: await embed(info.text, msg.model || 'mistral-embed-2312'), title: info.title, url: info.url };
    }

    case 'key_set':        await chrome.storage.local.set({ mistralKey: String(msg.key || '') });
                          return { ok: true, len: String(msg.key || '').length }; // never echo the key
    case 'key_status':    { const k = await getKey(); return { present: !!k, len: k.length }; }
    // WordPress credentials (added 2026-10-24): site URL + application password,
    // stored ONLY in chrome.storage.local; the password is never echoed or logged.
    case 'wp_cred_set':   {
      const s = String(msg.site || '').trim(), u = String(msg.user || '').trim(), p = String(msg.pass || '');
      if (!s || !p) return { ok: false, error: 'Site URL and application password are both required.' };
      await chrome.storage.local.set({ wpCred: { site: s, user: u, pass: p, savedAt: new Date().toISOString() } });
      return { ok: true, site: s, len: p.length }; // never echo the password
    }
    case 'wp_cred_status':{ const c = (await chrome.storage.local.get(['wpCred'])).wpCred;
                           return { present: !!c?.pass, site: c?.site || '', user: c?.user || '', len: c?.pass?.length || 0 }; }
    default: return { error: 'Unknown command: ' + msg.cmd };
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  handle(msg).then(sendResponse).catch(e => sendResponse({ error: String(e.message || e) }));
  return true; // async
});

// External ports (any extension page) - keep the v1 surface.
chrome.runtime.onConnectExternal?.addListener((port) => {
  port.postMessage({ type: 'connected', tabs: slimTabs() });
  port.onMessage.addListener((m) => {
    handle(m).then(r => port.postMessage({ type: 'reply', ...r })).catch(e => port.postMessage({ type: 'error', error: String(e.message || e) }));
  });
});

// Native messaging host (com.sourov.mcp_host) declared in manifest_v2_mcp.json.
chrome.runtime.onConnectNative?.addListener((port) => {
  port.postMessage({ type: 'hello', ext: 'double-control', version: '2.0.0' });
  port.onMessage.addListener((m) => {
    handle(m).then(r => port.postMessage({ type: 'reply', ...r })).catch(e => port.postMessage({ type: 'error', error: String(e.message || e) }));
  });
});

console.log('Double Control v2 (MCP enhanced) service worker loaded.');
