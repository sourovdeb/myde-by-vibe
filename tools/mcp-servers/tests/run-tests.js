#!/usr/bin/env node
/**
 * Integration test suite for the upgraded MCP servers.
 *   node tests/run-tests.js
 *
 * Starts on loopback only:
 *   - a mock Chrome CDP server (tests/mock-cdp.js)
 *   - my-mcp-connector (required in-process)
 *   - browser-control-mcp (required in-process, CDP pointed at the mock)
 *   - one spawned CLI instance of my-mcp-connector with MYDE_MCP_TOKEN set
 *
 * What this proves: JSON-RPC/MCP protocol behaviour, exact tool inventories,
 * auth enforcement, loopback binding, graceful CLI shutdown, and the full
 * tool call paths of both servers against the CDP mock.
 * What this does NOT prove: behaviour against a real Chrome build — run one
 * live check on the target PC after deploying.
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

// Fast failure paths for tests; production defaults remain 5s/30s.
process.env.CDP_CONNECT_TIMEOUT_MS = '3000';
process.env.CDP_CALL_TIMEOUT_MS = '3000';

const { startMockCdp } = require('./mock-cdp');
const connector = require('../my-mcp-connector.js');
const browser = require('../browser-control-mcp.js');

let passed = 0;
let failed = 0;
const failures = [];
let stage = 'startup';
let cliProc = null;

// Never leave a spawned child alive: the graceful SIGTERM handler in the CLI
// child would otherwise keep it listening after this process exits.
process.on('exit', () => {
  if (cliProc && cliProc.exitCode === null) {
    try { cliProc.kill('SIGKILL'); } catch (e) { /* ignore */ }
  }
});

// Watchdog: never let the suite hang the runner.
const watchdog = setTimeout(() => {
  console.error('WATCHDOG FIRED during: ' + stage);
  console.error(passed + ' passed, ' + failed + ' failed before hang');
  process.exit(2);
}, 90000);

function check(name, cond, detail) {
  stage = name;
  if (cond) { passed += 1; console.log('PASS  ' + name); }
  else { failed += 1; failures.push(name + (detail ? ' :: ' + detail : '')); console.log('FAIL  ' + name + (detail ? ' :: ' + detail : '')); }
}

function post(port, body, headers) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: '/mcp', method: 'POST', headers: headers || {}, timeout: 10000 }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('timeout', () => req.destroy(new Error('request timeout')));
    req.on('error', reject);
    req.end(body);
  });
}

function get(port, pathname) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: pathname || '/', timeout: 5000 }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('timeout', () => req.destroy(new Error('request timeout')));
    req.on('error', reject);
  });
}

function jrpc(method, params, id) {
  return JSON.stringify({ jsonrpc: '2.0', id: id === undefined ? 1 : id, method, params: params || {} });
}

async function call(port, tool, args) {
  const res = await post(port, jrpc('tools/call', { name: tool, arguments: args || {} }));
  return JSON.parse(res.body);
}

function parseToolText(payload) {
  const text = payload.result && payload.result.content && payload.result.content[0] && payload.result.content[0].text;
  return text ? JSON.parse(text) : null;
}

async function waitFor(fn, timeoutMs, label) {
  const started = Date.now();
  for (;;) {
    try {
      const v = await fn();
      if (v) return v;
    } catch (e) { /* retry */ }
    if (Date.now() - started > timeoutMs) throw new Error('timeout waiting for ' + label);
    await new Promise((r) => setTimeout(r, 150));
  }
}

async function main() {
  // --- fixtures: fake skills dir + credential env vars
  const tmpSkills = fs.mkdtempSync(path.join(os.tmpdir(), 'myde-skills-'));
  fs.mkdirSync(path.join(tmpSkills, 'demo-skill'));
  fs.writeFileSync(path.join(tmpSkills, 'demo-skill', 'SKILL.md'),
    '---\nname: demo-skill\ndescription: A fake skill for tests.\n---\n\nBody.\n');
  fs.mkdirSync(path.join(tmpSkills, 'second-skill'));
  process.env.MYDE_VIBE_SKILLS_DIR = tmpSkills;
  process.env.MYDE_TEST_CRED_SET = 'a-value-never-printed';
  delete process.env.MYDE_TEST_CRED_MISSING;
  // the default credential list (WORDPRESS_APP_PASSWORD, HOSTINGER_API_KEY) must be present
  // for one_stop_shop_status to report overall "ok"
  process.env.WORDPRESS_APP_PASSWORD = 'fixture-value-never-printed';
  process.env.HOSTINGER_API_KEY = 'fixture-value-never-printed';

  // --- start mock CDP + both servers
  stage = 'starting servers';
  const mockCdp = await startMockCdp(0);
  process.env.CDP_PORT = String(mockCdp.port);
  const connectorInst = await connector.start({ port: 0 });
  const browserInst = await browser.start({ port: 0 });
  process.env.MYDE_BROWSER_CONTROL_URL = 'http://127.0.0.1:' + browserInst.port + '/';
  const cPort = connectorInst.port;
  const bPort = browserInst.port;
  console.log('mock CDP on :' + mockCdp.port + ', connector on :' + cPort + ', browser-control on :' + bPort);

  // === my-mcp-connector tests
  stage = 'connector protocol tests';
  const init1 = JSON.parse((await post(cPort, jrpc('initialize'))).body);
  check('connector initialize returns protocolVersion', init1.result && init1.result.protocolVersion === '2025-06-18');
  check('connector initialize serverInfo.name', init1.result && init1.result.serverInfo && init1.result.serverInfo.name === 'my-mcp-connector');

  const list1 = JSON.parse((await post(cPort, jrpc('tools/list'))).body);
  const connectorTools = list1.result.tools.map((t) => t.name).sort();
  const expectedConnector = ['credential_env_present', 'health_check', 'one_stop_shop_status', 'system_info', 'vibe_skill_list'];
  check('connector exposes exactly the 5 audited tools', JSON.stringify(connectorTools) === JSON.stringify(expectedConnector),
    'got: ' + connectorTools.join(','));
  check('connector tools all carry inputSchema', list1.result.tools.every((t) => t.inputSchema && t.inputSchema.type === 'object'));

  const ping1 = JSON.parse((await post(cPort, jrpc('ping'))).body);
  check('connector ping returns empty result', ping1.result && Object.keys(ping1.result).length === 0);

  stage = 'connector tool tests';
  const health = parseToolText(await call(cPort, 'health_check'));
  check('health_check status ok', health && health.status === 'ok' && health.version === '2.0.0');
  check('health_check has uptime and timestamp', health && Number.isFinite(health.uptime_seconds) && !!health.timestamp);

  const sysinfo = parseToolText(await call(cPort, 'system_info'));
  check('system_info reports os/node/hostname', sysinfo && !!sysinfo.os && !!sysinfo.node && !!sysinfo.hostname);
  check('system_info reports memory', sysinfo && Number.isFinite(sysinfo.freemem_bytes) && Number.isFinite(sysinfo.totalmem_bytes));

  const creds = parseToolText(await call(cPort, 'credential_env_present', { names: ['MYDE_TEST_CRED_SET', 'MYDE_TEST_CRED_MISSING'] }));
  check('credential_env_present detects set var', creds && creds.credentials[0].present === true);
  check('credential_env_present detects missing var', creds && creds.credentials[1].present === false);
  check('credential_env_present never returns values', !JSON.stringify(creds).includes('a-value-never-printed'));
  const credsDefault = parseToolText(await call(cPort, 'credential_env_present'));
  check('credential_env_present default list includes WORDPRESS_APP_PASSWORD',
    credsDefault && credsDefault.credentials.some((c) => c.name === 'WORDPRESS_APP_PASSWORD'));

  const skills = parseToolText(await call(cPort, 'vibe_skill_list'));
  check('vibe_skill_list finds fake skills dir', skills && skills.count === 2 && Array.isArray(skills.skills));
  const demo = skills && skills.skills.find((s) => s.name === 'demo-skill');
  check('vibe_skill_list parses frontmatter description', demo && demo.description === 'A fake skill for tests.');

  const oss = parseToolText(await call(cPort, 'one_stop_shop_status'));
  check('one_stop_shop_status overall ok', oss && oss.overall === 'ok', 'got: ' + (oss && oss.overall));
  check('one_stop_shop_status probes browser-control', oss && oss.browser_control.reachable === true);
  check('one_stop_shop_status reports tool count', oss && oss.tools_count === 5);

  stage = 'connector error handling';
  const unknownTool = JSON.parse((await post(cPort, jrpc('tools/call', { name: 'no_such_tool' }))).body);
  check('unknown tool rejected with -32602', unknownTool.error && unknownTool.error.code === -32602);

  const unknownMethod = JSON.parse((await post(cPort, jrpc('bogus/method'))).body);
  check('unknown method rejected with -32601', unknownMethod.error && unknownMethod.error.code === -32601);

  const badJson = JSON.parse((await post(cPort, '{not json')).body);
  check('invalid JSON rejected with -32700', badJson.error && badJson.error.code === -32700);

  const notif = await post(cPort, JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }));
  check('notification accepted with 202 and no body', notif.status === 202 && notif.body === '');

  const batch = JSON.parse((await post(cPort, '[' + jrpc('ping', {}, 1) + ',' + jrpc('ping', {}, 2) + ']')).body);
  check('batch request returns array of responses', Array.isArray(batch) && batch.length === 2 && batch[1].id === 2);

  const root1 = JSON.parse((await get(cPort, '/')).body);
  check('connector GET / self-reports 5 tools', root1.tools === 5 && root1.service === 'my-mcp-connector');

  // === browser-control-mcp tests
  stage = 'browser protocol tests';
  const init2 = JSON.parse((await post(bPort, jrpc('initialize'))).body);
  check('browser initialize serverInfo.name', init2.result && init2.result.serverInfo && init2.result.serverInfo.name === 'browser-control-mcp');

  const list2 = JSON.parse((await post(bPort, jrpc('tools/list'))).body);
  const browserTools = list2.result.tools.map((t) => t.name).sort();
  const expectedBrowser = [
    'browser_click', 'browser_close_tab', 'browser_execute_js', 'browser_get_dom', 'browser_get_element_text',
    'browser_get_page_info', 'browser_handle_dialog', 'browser_list_tabs', 'browser_navigate', 'browser_new_tab',
    'browser_screenshot', 'browser_scroll', 'browser_switch_tab', 'browser_type', 'browser_wait_for_element',
  ].sort();
  check('browser exposes exactly the 15 audited tools', JSON.stringify(browserTools) === JSON.stringify(expectedBrowser),
    'got: ' + browserTools.join(','));

  const root2 = JSON.parse((await get(bPort, '/')).body);
  check('browser GET / self-reports 15 tools and CDP URL', root2.tools === 15 && root2.cdp.includes('127.0.0.1'));

  stage = 'browser tool tests (via mock CDP websocket)';
  const tabs = parseToolText(await call(bPort, 'browser_list_tabs'));
  check('browser_list_tabs returns 2 page tabs (browser target filtered)',
    tabs && tabs.count === 2 && tabs.tabs[0].targetId === 'MOCKTAB1' && tabs.tabs[0].url === 'http://127.0.0.1/mock');

  const newTab = parseToolText(await call(bPort, 'browser_new_tab', { url: 'http://example.com/' }));
  check('browser_new_tab opens tab and returns targetId', newTab && newTab.opened === true && /^NEWTAB/.test(newTab.targetId));

  const nav = parseToolText(await call(bPort, 'browser_navigate', { url: 'http://127.0.0.1/mock' }));
  check('browser_navigate succeeds against mock CDP',
    nav && nav.navigated === true && nav.page && nav.page.url === 'http://127.0.0.1/mock' && nav.frameId === 'frame0');

  const info = parseToolText(await call(bPort, 'browser_get_page_info', { target_id: 'MOCKTAB1' }));
  check('browser_get_page_info returns url/title/readyState',
    info && info.url === 'http://127.0.0.1/mock' && info.title === 'Mock Page' && info.readyState === 'complete');

  const dom = parseToolText(await call(bPort, 'browser_get_dom', { selector: 'main' }));
  check('browser_get_dom returns element html', dom && dom.dom.includes('mock dom') && dom.truncated === false);

  const text = parseToolText(await call(bPort, 'browser_get_element_text', { selector: 'main' }));
  check('browser_get_element_text returns text', text && text.text === 'mock element text');

  const click = parseToolText(await call(bPort, 'browser_click', { selector: 'button.go' }));
  check('browser_click succeeds', click && click.clicked === true);

  const type = parseToolText(await call(bPort, 'browser_type', { selector: '#q', text: 'hello world', submit: true }));
  check('browser_type types and submits', type && type.typed === true && type.submitted === true);

  const scroll = parseToolText(await call(bPort, 'browser_scroll', { direction: 'down', amount: 600 }));
  check('browser_scroll scrolls and reports position', scroll && scroll.scrolled === 'down' && scroll.position.y === 600);

  const js = parseToolText(await call(bPort, 'browser_execute_js', { code: '2 + 2' }));
  check('browser_execute_js returns evaluated value', js && js.result === 4);

  const shot = parseToolText(await call(bPort, 'browser_screenshot', { format: 'png' }));
  check('browser_screenshot returns base64 payload',
    shot && shot.base64 === Buffer.from('mock-png-bytes').toString('base64') && shot.size_bytes > 0);

  const waitEl = parseToolText(await call(bPort, 'browser_wait_for_element', { selector: '.result', timeout_ms: 3000 }));
  check('browser_wait_for_element finds element', waitEl && waitEl.found === true && waitEl.waited_ms < 3000);

  const dialog = parseToolText(await call(bPort, 'browser_handle_dialog', { accept: true }));
  check('browser_handle_dialog accepts dialog', dialog && dialog.handled === true && dialog.accepted === true);

  const switchTab = parseToolText(await call(bPort, 'browser_switch_tab', { target_id: 'MOCKTAB2' }));
  check('browser_switch_tab activates target', switchTab && switchTab.activated === true && switchTab.title === 'Second Mock Page');

  const closeTab = parseToolText(await call(bPort, 'browser_close_tab', { target_id: 'MOCKTAB2' }));
  check('browser_close_tab closes target', closeTab && closeTab.closed === true);
  const tabsAfter = parseToolText(await call(bPort, 'browser_list_tabs'));
  check('closed tab disappears from list', tabsAfter && tabsAfter.count === 1 && tabsAfter.tabs[0].targetId === 'MOCKTAB1');

  stage = 'browser error handling';
  const missingParam = await call(bPort, 'browser_navigate', {});
  check('missing required param returns isError', missingParam.result && missingParam.result.isError === true);

  const badTarget = await call(bPort, 'browser_get_page_info', { target_id: 'DOESNOTEXIST' });
  check('unknown target returns isError with CDP hint', badTarget.result && badTarget.result.isError === true &&
    /Unknown tab target|Cannot reach Chrome/.test(badTarget.result.content[0].text));

  // === spawned CLI + auth test (isolated process)
  stage = 'spawned CLI auth test';
  const cliPort = 3990;
  cliProc = spawn('node', [path.join(__dirname, '..', 'my-mcp-connector.js')], {
    env: Object.assign({}, process.env, { PORT: String(cliPort), MYDE_MCP_TOKEN: 'test-token' }),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let cliOut = '';
  cliProc.stdout.on('data', (d) => { cliOut += d.toString('utf8'); });
  const cliUp = await waitFor(() => get(cliPort, '/').then((r) => r.status === 200 ? r : null).catch(() => null), 8000, 'CLI server up');
  check('CLI instance starts and binds the requested port', !!cliUp);

  const unauth = await post(cliPort, jrpc('ping'), {});
  check('with MYDE_MCP_TOKEN set, request without token is 401', unauth.status === 401);
  const auth = await post(cliPort, jrpc('ping'), { Authorization: 'Bearer test-token' });
  check('request with correct bearer token is accepted', auth.status === 200 && JSON.parse(auth.body).result);

  const cliExit = new Promise((resolve) => cliProc.on('exit', (code) => resolve(code)));
  cliProc.kill('SIGTERM');
  const exitCode = await Promise.race([cliExit, new Promise((r) => setTimeout(() => r('timeout'), 5000))]);
  check('SIGTERM triggers graceful shutdown (exit 0)', exitCode === 0, 'exit code: ' + exitCode);
  check('CLI banner names service and tools count', /my-mcp-connector v2\.0\.0/.test(cliOut) && /\(5 tools/.test(cliOut));
  if (exitCode !== 0 && cliProc.exitCode === null) { try { cliProc.kill('SIGKILL'); } catch (e) { /* ignore */ } }

  // === summary
  clearTimeout(watchdog);
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  if (failures.length) console.log('Failures:\n  ' + failures.join('\n  '));
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Test runner crashed at stage "' + stage + '": ' + (err && err.stack ? err.stack : err));
  process.exit(1);
});
