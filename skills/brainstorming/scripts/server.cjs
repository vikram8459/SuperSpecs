// SuperSpecs brainstorm-companion server.
//
// Local-only HTTP + WebSocket server that backs the brainstorming skill's
// visual companion (see docs/architecture.md ADR-010).
//
// External protocol contract — preserved verbatim from the prior
// hand-rolled implementation so existing wrappers keep working:
//   - Environment: BRAINSTORM_PORT, BRAINSTORM_HOST, BRAINSTORM_URL_HOST,
//     BRAINSTORM_DIR, BRAINSTORM_OWNER_PID.
//   - stdout JSON event types: `server-started`, `screen-added`,
//     `screen-updated`, `user-event`, `owner-pid-invalid`, `server-stopped`.
//   - HTTP routes: `GET /` (latest screen + injected helper),
//     `GET /files/<name>` (static asset from CONTENT_DIR).
//   - WebSocket protocol: JSON text frames. Server broadcasts
//     `{"type":"reload"}`; client (helper.js) sends `{type:'click', ...}`
//     and other event payloads.
//
// This rewrite replaces the prior hand-rolled RFC-6455 implementation
// with the `ws` package. Behaviour is the same; framing, masking, ping/
// pong, close codes, and fragmentation are now delegated to a
// battle-tested library.

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

// ========== Configuration ==========

const PORT = process.env.BRAINSTORM_PORT || (49152 + Math.floor(Math.random() * 16383));
const HOST = process.env.BRAINSTORM_HOST || '127.0.0.1';
const URL_HOST = process.env.BRAINSTORM_URL_HOST || (HOST === '127.0.0.1' ? 'localhost' : HOST);
const SESSION_DIR = process.env.BRAINSTORM_DIR || '/tmp/brainstorm';
const CONTENT_DIR = path.join(SESSION_DIR, 'content');
const STATE_DIR = path.join(SESSION_DIR, 'state');
const MAX_PAYLOAD_BYTES = Number(process.env.BRAINSTORM_MAX_PAYLOAD || 1024 * 1024); // 1 MiB
let ownerPid = process.env.BRAINSTORM_OWNER_PID ? Number(process.env.BRAINSTORM_OWNER_PID) : null;

// Per-session auth token. The server binds loopback by default; the token
// primarily stops a page from another origin (or a browser that only knows
// the host:port) from reading pushed screens or posting events, since it can
// neither guess the value nor read the owner-only server-info file. It is NOT
// a boundary against arbitrary same-user local processes: the token must be
// shared with the launcher/owner via stdout and the server-info file, so any
// process that can read those can obtain it. The token gates both HTTP (`/`)
// and WebSocket: it is carried in the reported `url` (so the launcher opens
// the page with `?token=...`), and the injected helper reads it from the page
// URL to authenticate its WebSocket. Supply `BRAINSTORM_TOKEN` to pin a
// value; otherwise a random one is minted.
const AUTH_TOKEN = process.env.BRAINSTORM_TOKEN || crypto.randomBytes(16).toString('hex');

/** True if the request URL carries the correct `?token=`. */
function isAuthorized(reqUrl) {
  try {
    return new URL(reqUrl, 'http://localhost').searchParams.get('token') === AUTH_TOKEN;
  } catch (_) {
    return false;
  }
}

const MIME_TYPES = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml'
};

// ========== Templates and Constants ==========

const WAITING_PAGE = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Brainstorm Companion</title>
<style>body { font-family: system-ui, sans-serif; padding: 2rem; max-width: 800px; margin: 0 auto; }
h1 { color: #333; } p { color: #666; }</style>
</head>
<body><h1>Brainstorm Companion</h1>
<p>Waiting for the agent to push a screen...</p></body></html>`;

const frameTemplate = fs.readFileSync(path.join(__dirname, 'frame-template.html'), 'utf-8');
const helperScript = fs.readFileSync(path.join(__dirname, 'helper.js'), 'utf-8');
const helperInjection = '<script>\n' + helperScript + '\n</script>';

// ========== Helper Functions ==========

function isFullDocument(html) {
  const trimmed = html.trimStart().toLowerCase();
  return trimmed.startsWith('<!doctype') || trimmed.startsWith('<html');
}

function wrapInFrame(content) {
  return frameTemplate.replace('<!-- CONTENT -->', content);
}

function getNewestScreen() {
  const files = fs.readdirSync(CONTENT_DIR)
    .filter(f => f.endsWith('.html'))
    .map(f => {
      const fp = path.join(CONTENT_DIR, f);
      return { path: fp, mtime: fs.statSync(fp).mtime.getTime() };
    })
    .sort((a, b) => b.mtime - a.mtime);
  return files.length > 0 ? files[0].path : null;
}

// ========== HTTP Request Handler ==========

function handleRequest(req, res) {
  touchActivity();
  const pathname = new URL(req.url, 'http://localhost').pathname;

  // Static assets under /files/ are served WITHOUT the token gate: a pushed
  // screen references them as sub-resources (e.g. <img src="/files/x.png">)
  // and the browser can't append the session token to those URLs. They are
  // confined to CONTENT_DIR via path.basename, so this exposes only files the
  // agent itself placed for the screen. The token still gates the screen page
  // (`/`) and the WebSocket channel.
  if (req.method === 'GET' && pathname.startsWith('/files/')) {
    const fileName = pathname.slice(7);
    const filePath = path.join(CONTENT_DIR, path.basename(fileName));
    if (!fs.existsSync(filePath)) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(fs.readFileSync(filePath));
    return;
  }

  if (!isAuthorized(req.url)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden: missing or invalid token');
    return;
  }

  if (req.method === 'GET' && pathname === '/') {
    const screenFile = getNewestScreen();
    let html = screenFile
      ? (raw => isFullDocument(raw) ? raw : wrapInFrame(raw))(fs.readFileSync(screenFile, 'utf-8'))
      : WAITING_PAGE;

    if (html.includes('</body>')) {
      html = html.replace('</body>', helperInjection + '\n</body>');
    } else {
      html += helperInjection;
    }

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
}

// ========== WebSocket — backed by `ws` (ADR-010) ==========
//
// The `ws` package handles RFC-6455 framing, masking, ping/pong, close
// codes, and continuation frames. We only manage the application-level
// protocol (JSON text payloads) and the lifecycle of connected clients.

function attachWebSocket(server) {
  const wss = new WebSocketServer({
    server,
    maxPayload: MAX_PAYLOAD_BYTES,
    // We never serve binary payloads; the helper.js client only sends JSON
    // text. ws still validates per-frame; rejecting binary up front is a
    // defence-in-depth measure.
    perMessageDeflate: false
  });

  wss.on('connection', (ws, req) => {
    if (!isAuthorized(req.url)) {
      // 1008 = policy violation (RFC 6455 §7.4.1).
      ws.close(1008, 'unauthorized');
      return;
    }
    touchActivity();

    ws.on('message', (data, isBinary) => {
      touchActivity();
      if (isBinary) {
        // Protocol mismatch: helper only sends text JSON.
        ws.close(1003, 'binary not accepted');
        return;
      }
      handleMessage(data.toString('utf8'));
    });

    ws.on('error', () => { /* ws emits 'close' next; nothing to do */ });
  });

  // Expose broadcast as a closure over `wss` (no separate clients Set).
  return function broadcast(msg) {
    const payload = JSON.stringify(msg);
    for (const client of wss.clients) {
      if (client.readyState === client.OPEN) {
        try { client.send(payload); } catch (_) { /* socket already closing */ }
      }
    }
  };
}

function handleMessage(text) {
  let event;
  try {
    event = JSON.parse(text);
  } catch (e) {
    console.error('Failed to parse WebSocket message:', e.message);
    return;
  }
  console.log(JSON.stringify({ source: 'user-event', ...event }));
  if (event.choice) {
    const eventsFile = path.join(STATE_DIR, 'events');
    fs.appendFileSync(eventsFile, JSON.stringify(event) + '\n');
  }
}

// ========== Activity Tracking ==========

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
let lastActivity = Date.now();

function touchActivity() {
  lastActivity = Date.now();
}

// ========== File Watching ==========

const debounceTimers = new Map();

// ========== Server Startup ==========

function startServer() {
  if (!fs.existsSync(CONTENT_DIR)) fs.mkdirSync(CONTENT_DIR, { recursive: true });
  if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });

  // Track known files to distinguish new screens from updates.
  // macOS fs.watch reports 'rename' for both new files and overwrites,
  // so we can't rely on eventType alone.
  const knownFiles = new Set(
    fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.html'))
  );

  const server = http.createServer(handleRequest);
  const broadcast = attachWebSocket(server);

  const watcher = fs.watch(CONTENT_DIR, (eventType, filename) => {
    if (!filename || !filename.endsWith('.html')) return;

    if (debounceTimers.has(filename)) clearTimeout(debounceTimers.get(filename));
    debounceTimers.set(filename, setTimeout(() => {
      debounceTimers.delete(filename);
      const filePath = path.join(CONTENT_DIR, filename);

      if (!fs.existsSync(filePath)) return; // file was deleted
      touchActivity();

      if (!knownFiles.has(filename)) {
        knownFiles.add(filename);
        const eventsFile = path.join(STATE_DIR, 'events');
        if (fs.existsSync(eventsFile)) fs.unlinkSync(eventsFile);
        console.log(JSON.stringify({ type: 'screen-added', file: filePath }));
      } else {
        console.log(JSON.stringify({ type: 'screen-updated', file: filePath }));
      }

      broadcast({ type: 'reload' });
    }, 100));
  });
  watcher.on('error', (err) => console.error('fs.watch error:', err.message));

  function shutdown(reason) {
    console.log(JSON.stringify({ type: 'server-stopped', reason }));
    const infoFile = path.join(STATE_DIR, 'server-info');
    if (fs.existsSync(infoFile)) fs.unlinkSync(infoFile);
    fs.writeFileSync(
      path.join(STATE_DIR, 'server-stopped'),
      JSON.stringify({ reason, timestamp: Date.now() }) + '\n'
    );
    watcher.close();
    clearInterval(lifecycleCheck);
    server.close(() => process.exit(0));
  }

  function ownerAlive() {
    if (!ownerPid) return true;
    try { process.kill(ownerPid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
  }

  // Check every 60s: exit if owner process died or idle for 30 minutes
  const lifecycleCheck = setInterval(() => {
    if (!ownerAlive()) shutdown('owner process exited');
    else if (Date.now() - lastActivity > IDLE_TIMEOUT_MS) shutdown('idle timeout');
  }, 60 * 1000);
  lifecycleCheck.unref();

  // Validate owner PID at startup. If it's already dead, the PID resolution
  // was wrong (common on WSL, Tailscale SSH, and cross-user scenarios).
  // Disable monitoring and rely on the idle timeout instead.
  if (ownerPid) {
    try { process.kill(ownerPid, 0); }
    catch (e) {
      if (e.code !== 'EPERM') {
        console.log(JSON.stringify({ type: 'owner-pid-invalid', pid: ownerPid, reason: 'dead at startup' }));
        ownerPid = null;
      }
    }
  }

  server.listen(PORT, HOST, () => {
    const boundPort = Number(server.address().port);
    // The url carries the token so whoever opens it (browser/launcher) is
    // authenticated; the injected helper reads the token from this url too.
    const url = 'http://' + URL_HOST + ':' + boundPort + '/?token=' + AUTH_TOKEN;
    const info = JSON.stringify({
      type: 'server-started', port: boundPort, host: HOST,
      url_host: URL_HOST, url, token: AUTH_TOKEN,
      screen_dir: CONTENT_DIR, state_dir: STATE_DIR
    });
    console.log(info);
    // server-info carries the session token (the launcher reads the
    // authenticated url from it), so write it owner-only. writeFileSync's
    // `mode` only applies when the file is created, so chmod afterwards to
    // also tighten a pre-existing file (no-op on platforms without POSIX
    // perms, e.g. Windows).
    const infoPath = path.join(STATE_DIR, 'server-info');
    fs.writeFileSync(infoPath, info + '\n', { mode: 0o600 });
    try { fs.chmodSync(infoPath, 0o600); } catch (_) { /* best effort */ }
  });

  return { server, shutdown, token: AUTH_TOKEN };
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer };
