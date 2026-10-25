#!/usr/bin/env node
/**
 * My MCP Connector — upgraded clean-room server (v2.0.0)
 * Repo: sourovdeb/myde-by-vibe  →  tools/mcp-servers/my-mcp-connector.js
 *
 * Replaces the original "my-mcp-connector" (localhost:3000, 5 tools).
 * Tool names are kept identical for drop-in compatibility.
 *
 * Upgrades over the audited v1.0.0:
 *   - Credentials: presence checks only, values never read into output or logs.
 *     Configured via env (MYDE_CREDENTIAL_ENVS + defaults), fixing the audit
 *     finding that the bridge stored its api_key in wp_options.
 *   - Optional bearer-token auth (MYDE_MCP_TOKEN) on every request.
 *   - Binds 127.0.0.1 by default; no exposure on other interfaces.
 *   - Accurate self-reported tool count on GET / (fixes stale bridge counts).
 *   - Graceful shutdown on SIGINT/SIGTERM.
 *
 * Run:  node my-mcp-connector.js            (default port 3000)
 * Env:  PORT, BIND_HOST, MYDE_MCP_TOKEN, MYDE_CREDENTIAL_ENVS,
 *       MYDE_VIBE_SKILLS_DIR, MYDE_BROWSER_CONTROL_URL, NODE_ENV
 * No npm dependencies. Node >= 16.
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const SERVER_NAME = 'my-mcp-connector';
const SERVER_VERSION = '2.0.0';
const PROTOCOL_VERSION = '2025-06-18';
const STARTED_AT = Date.now();

const DEFAULT_CREDENTIAL_ENVS = ['WORDPRESS_APP_PASSWORD', 'HOSTINGER_API_KEY'];
const DEFAULT_SKILLS_DIR = 'C:/Users/souro/.vibe/skills';

// ---------------------------------------------------------------- tool registry

function credentialEnvList() {
  const extra = (process.env.MYDE_CREDENTIAL_ENVS || '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  return [...new Set([...DEFAULT_CREDENTIAL_ENVS, ...extra])];
}

function credentialEnvPresent(args) {
  const names = Array.isArray(args && args.names) && args.names.length
    ? args.names
    : credentialEnvList();
  const credentials = names.map((name) => {
    if (typeof name !== 'string' || !/^[A-Z0-9_]+$/i.test(name)) {
      return { name: String(name), present: false, error: 'invalid name' };
    }
    // Presence only: the value is never included in any output.
    const present = Object.prototype.hasOwnProperty.call(process.env, name) &&
      String(process.env[name] || '').length > 0;
    return { name, present };
  });
  const allPresent = credentials.every((c) => c.present);
  return {
    service: SERVER_NAME,
    checked_at: new Date().toISOString(),
    credentials,
    all_present: allPresent,
    note: 'Presence check only. Values are never returned.',
  };
}

function healthCheck() {
  return {
    status: 'ok',
    service: SERVER_NAME,
    version: SERVER_VERSION,
    transport: 'http',
    protocol: PROTOCOL_VERSION,
    uptime_seconds: Math.round((Date.now() - STARTED_AT) / 1000),
    timestamp: new Date().toISOString(),
  };
}

function oneStopShopStatus() {
  const health = healthCheck();
  const creds = credentialEnvPresent({});
  const status = {
    service: SERVER_NAME,
    version: SERVER_VERSION,
    generated_at: new Date().toISOString(),
    health,
    credentials: { all_present: creds.all_present, checked: creds.credentials.length },
    skills_dir: null,
    skills_found: 0,
    browser_control: { configured: false, reachable: null },
    tools_count: TOOLS.length,
    overall: 'ok',
  };
  const skillsDir = process.env.MYDE_VIBE_SKILLS_DIR || DEFAULT_SKILLS_DIR;
  status.skills_dir = skillsDir;
  try {
    const entries = fs.readdirSync(skillsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory());
    status.skills_found = entries.length;
  } catch (e) {
    status.skills_dir = skillsDir + ' (not readable: ' + e.code + ')';
  }
  const bcUrl = process.env.MYDE_BROWSER_CONTROL_URL || null;
  if (bcUrl) status.browser_control.configured = true;
  if (!creds.all_present) status.overall = 'degraded_credentials';
  if (status.skills_found === 0) {
    status.overall = status.overall === 'ok' ? 'degraded_skills' : status.overall + '+degraded_skills';
  }
  return status;
}

function oneStopShopStatusAsync() {
  const status = oneStopShopStatus();
  const bcUrl = process.env.MYDE_BROWSER_CONTROL_URL || null;
  if (!bcUrl) return Promise.resolve(status);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (reachable) => {
      if (settled) return;
      settled = true;
      status.browser_control.reachable = reachable;
      if (!reachable) status.overall = 'degraded_browser_control';
      resolve(status);
    };
    const timer = setTimeout(() => finish(false), 3000);
    try {
      const u = new URL(bcUrl);
      const req = http.get({ host: u.hostname, port: u.port || 80, path: u.pathname || '/', timeout: 3000 }, (res) => {
        clearTimeout(timer);
        finish(res.statusCode === 200);
        res.resume();
      });
      req.on('timeout', () => { req.destroy(new Error('timeout')); });
      req.on('error', () => { clearTimeout(timer); finish(false); });
    } catch (e) {
      clearTimeout(timer);
      finish(false);
    }
  });
}

function parseFrontmatter(text) {
  const out = {};
  const m = /^\s*---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) return out;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line.trim());
    if (kv) out[kv[1].toLowerCase()] = kv[2].replace(/^['"]|['"]$/g, '');
  }
  return out;
}

function vibeSkillList(args) {
  const skillsDir = process.env.MYDE_VIBE_SKILLS_DIR || DEFAULT_SKILLS_DIR;
  const skills = [];
  let error = null;
  try {
    const entries = fs.readdirSync(skillsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    for (const name of entries) {
      const skillFile = path.join(skillsDir, name, 'SKILL.md');
      let skill = { name, description: null, has_skill_md: false };
      try {
        const text = fs.readFileSync(skillFile, 'utf8');
        skill.has_skill_md = true;
        const fm = parseFrontmatter(text);
        if (fm.description) skill.description = fm.description;
        if (fm.name) skill.name = fm.name;
      } catch (e) { /* keep defaults */ }
      skills.push(skill);
    }
  } catch (e) {
    error = e.code || String(e.message);
  }
  const result = { service: SERVER_NAME, skills_dir: skillsDir, skills, count: skills.length };
  if (error !== null) {
    result.note = 'Skills directory not readable (' + error + '). ' +
      'Set MYDE_VIBE_SKILLS_DIR to the Vibe skills folder.';
  }
  return result;
}

function systemInfo() {
  return {
    service: SERVER_NAME,
    version: SERVER_VERSION,
    os: os.platform(),
    os_release: os.release(),
    node: process.version,
    arch: os.arch(),
    hostname: os.hostname(),
    uptime_process_seconds: Math.round(process.uptime()),
    uptime_server_seconds: Math.round((Date.now() - STARTED_AT) / 1000),
    freemem_bytes: os.freemem(),
    totalmem_bytes: os.totalmem(),
    cpu_count: os.cpus().length,
    environment: { nodeEnv: process.env.NODE_ENV || null },
    timestamp: new Date().toISOString(),
  };
}

const TOOLS = [
  {
    name: 'health_check',
    description: 'Server liveness and identity: status, version, transport, uptime, timestamp.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => healthCheck(),
  },
  {
    name: 'system_info',
    description: 'Local runtime details: OS, Node version, memory, CPU count, environment.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => systemInfo(),
  },
  {
    name: 'credential_env_present',
    description: 'Check that credential environment variables are set. Presence only — values are never returned. Names default to WORDPRESS_APP_PASSWORD and HOSTINGER_API_KEY plus MYDE_CREDENTIAL_ENVS.',
    inputSchema: {
      type: 'object',
      properties: {
        names: {
          type: 'array',
          items: { type: 'string', pattern: '^[A-Z0-9_]+$' },
          description: 'Optional explicit list of environment variable names to check.',
        },
      },
      additionalProperties: false,
    },
    handler: (args) => credentialEnvPresent(args || {}),
  },
  {
    name: 'one_stop_shop_status',
    description: 'Aggregated status report: health, credential presence, skills folder, optional browser-control server reachability (MYDE_BROWSER_CONTROL_URL).',
    inputSchema: {
      type: 'object',
      properties: { include_missing_dir: { type: 'boolean', default: true } },
      additionalProperties: false,
    },
    handler: () => oneStopShopStatusAsync(),
  },
  {
    name: 'vibe_skill_list',
    description: 'List Vibe skills from MYDE_VIBE_SKILLS_DIR (default C:/Users/souro/.vibe/skills): folder names, descriptions parsed from SKILL.md frontmatter.',
    inputSchema: {
      type: 'object',
      properties: { include_missing_dir: { type: 'boolean', default: true } },
      additionalProperties: false,
    },
    handler: (args) => vibeSkillList(args || {}),
  },
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
        return jsonRpcResult(m.id, {
          tools: TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
        });
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
    req.on('data', (c) => { size += c.length; if (size > 5 * 1024 * 1024) { req.destroy(); return; } chunks.push(c); });
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
  const port = (opts.port === undefined || opts.port === null) ? parseInt(process.env.PORT || '3000', 10) : opts.port;
  const host = opts.host || process.env.BIND_HOST || '127.0.0.1';
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on('error', reject);
    server.listen(port, host, () => {
      const actualPort = server.address().port;
      const shutdown = () => {
        server.close(() => process.exit(0));
        setTimeout(() => process.exit(0), 1500).unref();
      };
      if (opts.registerSignals !== false && !process.listenerCount('SIGINT')) {
        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
      }
      resolve({
        server,
        port: actualPort,
        host,
        tools: TOOLS.length,
        stop: () => new Promise((r) => server.close(() => r(null))),
      });
    });
  });
}

if (require.main === module) {
  start().then((info) => {
    process.stdout.write(
      'my-mcp-connector v' + SERVER_VERSION + ' listening on http://' + info.host + ':' + info.port +
      ' (' + info.tools + ' tools, auth ' + (process.env.MYDE_MCP_TOKEN ? 'on' : 'off') + ')\n'
    );
  }).catch((err) => {
    process.stderr.write('Failed to start: ' + err.message + '\n');
    process.exit(1);
  });
}

module.exports = { start, TOOLS, healthCheck, systemInfo, requestHandler, credentialEnvPresent, vibeSkillList, oneStopShopStatusAsync, SERVER_NAME, SERVER_VERSION };
