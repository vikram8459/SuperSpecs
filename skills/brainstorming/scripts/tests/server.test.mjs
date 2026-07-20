// Behaviour tests for the brainstorm-companion server.
//
// Covers the four audit-mandated cases (F12.3):
//   1. connect / disconnect
//   2. message round-trip (client -> server -> file)
//   3. fragment handling (`ws` reassembles continuation frames into a
//      single 'message' event)
//   4. oversize payload rejection (close code 1009)
//
// The server is started on an ephemeral port via BRAINSTORM_PORT=0, with
// SESSION_DIR pointed at a per-test temp directory so the watcher and
// state files don't collide.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

let savedEnv;
let sessionDir;
let serverHandle;

function freshSessionDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spx-brainstorm-test-'));
  fs.mkdirSync(path.join(dir, 'content'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'state'), { recursive: true });
  return dir;
}

function cleanupDir(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) { /* ignore */ }
}

async function bootServer() {
  // Re-require so module-level constants (PORT, SESSION_DIR, etc.) read
  // the env we just set. Drop the previous instance from the cache.
  const modulePath = require.resolve('../server.cjs');
  delete require.cache[modulePath];
  const { startServer } = require('../server.cjs');
  const handle = startServer();
  await new Promise((resolve) => {
    if (handle.server.listening) resolve();
    else handle.server.once('listening', resolve);
  });
  return handle;
}

function port(handle) {
  return handle.server.address().port;
}

/** WebSocket URL including the server's per-session auth token. */
function wsUrl(handle) {
  return `ws://127.0.0.1:${port(handle)}/?token=${handle.token}`;
}

/** HTTP URL for a path including the server's per-session auth token. */
function httpUrl(handle, pathname = '/') {
  return `http://127.0.0.1:${port(handle)}${pathname}?token=${handle.token}`;
}

async function awaitOpen(ws) {
  await new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });
}

function awaitClose(ws) {
  return new Promise((resolve) => {
    ws.once('close', (code, reason) => resolve({ code, reason: reason.toString('utf8') }));
  });
}

beforeEach(() => {
  savedEnv = { ...process.env };
  sessionDir = freshSessionDir();
  process.env.BRAINSTORM_PORT = '0';
  process.env.BRAINSTORM_HOST = '127.0.0.1';
  process.env.BRAINSTORM_DIR = sessionDir;
  process.env.BRAINSTORM_OWNER_PID = String(process.pid);
  process.env.BRAINSTORM_MAX_PAYLOAD = '256';
});

afterEach(async () => {
  if (serverHandle) {
    await new Promise((resolve) => serverHandle.server.close(resolve));
    serverHandle = null;
  }
  process.env = savedEnv;
  cleanupDir(sessionDir);
});

describe('brainstorm-companion server', () => {
  it('accepts a WebSocket connection and closes cleanly', async () => {
    serverHandle = await bootServer();
    const ws = new WebSocket(wsUrl(serverHandle));
    await awaitOpen(ws);
    expect(ws.readyState).toBe(WebSocket.OPEN);
    const closePromise = awaitClose(ws);
    ws.close(1000, 'bye');
    const { code } = await closePromise;
    expect(code).toBe(1000);
  });

  it('round-trips a JSON event from client to STATE_DIR/events', async () => {
    serverHandle = await bootServer();
    const ws = new WebSocket(wsUrl(serverHandle));
    await awaitOpen(ws);

    const event = { type: 'click', choice: 'option-a', text: 'Option A' };
    ws.send(JSON.stringify(event));

    const eventsFile = path.join(sessionDir, 'state', 'events');
    for (let i = 0; i < 50; i++) {
      if (fs.existsSync(eventsFile) && fs.readFileSync(eventsFile, 'utf8').length > 0) break;
      await new Promise((r) => setTimeout(r, 20));
    }

    expect(fs.existsSync(eventsFile)).toBe(true);
    const lines = fs.readFileSync(eventsFile, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toMatchObject(event);

    ws.close();
    await awaitClose(ws);
  });

  it('reassembles fragmented frames into one message', async () => {
    // `ws` exposes fragmentation via send({ fin: false }) then a final
    // send({ fin: true }). On the receive side, the server should still
    // see exactly one 'message' event with the concatenated payload —
    // proving the library handles continuation frames so we don't have to.
    serverHandle = await bootServer();
    const ws = new WebSocket(wsUrl(serverHandle));
    await awaitOpen(ws);

    const payload = { choice: 'fragmented', text: 'A'.repeat(40) + '|' + 'B'.repeat(40) };
    const full = JSON.stringify(payload);
    const mid = Math.floor(full.length / 2);
    ws.send(full.slice(0, mid), { fin: false });
    ws.send(full.slice(mid), { fin: true });

    const eventsFile = path.join(sessionDir, 'state', 'events');
    for (let i = 0; i < 50; i++) {
      if (fs.existsSync(eventsFile) && fs.readFileSync(eventsFile, 'utf8').length > 0) break;
      await new Promise((r) => setTimeout(r, 20));
    }

    expect(fs.existsSync(eventsFile)).toBe(true);
    const line = fs.readFileSync(eventsFile, 'utf8').trim();
    expect(JSON.parse(line)).toMatchObject(payload);

    ws.close();
    await awaitClose(ws);
  });

  it('rejects an oversize payload with close code 1009', async () => {
    serverHandle = await bootServer();
    const ws = new WebSocket(wsUrl(serverHandle));
    await awaitOpen(ws);

    // MAX_PAYLOAD is set to 256 bytes in beforeEach.
    const oversize = 'x'.repeat(1024);
    const closePromise = awaitClose(ws);
    ws.send(oversize);

    const { code } = await closePromise;
    // 1009 = Message Too Big (RFC 6455 §7.4.1). `ws` enforces maxPayload
    // by closing with this code.
    expect(code).toBe(1009);
  });

  it('rejects an HTTP request without the auth token (403)', async () => {
    serverHandle = await bootServer();
    const status = await new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${port(serverHandle)}/`, (res) => {
        res.resume();
        resolve(res.statusCode);
      }).on('error', reject);
    });
    expect(status).toBe(403);
  });

  it('closes a WebSocket opened without the auth token (1008)', async () => {
    serverHandle = await bootServer();
    const ws = new WebSocket(`ws://127.0.0.1:${port(serverHandle)}`);
    const closePromise = awaitClose(ws);
    // Either the open is followed immediately by a policy-violation close,
    // or the handshake errors; both mean "not authorized".
    ws.on('error', () => { /* server may close mid-handshake */ });
    const { code } = await closePromise;
    expect(code).toBe(1008);
  });

  it('serves a /files/ static asset WITHOUT the auth token', async () => {
    // A pushed screen references assets as browser sub-resources
    // (e.g. <img src="/files/x.svg">); the browser can't append the token,
    // so /files/ must be reachable without it (basename-confined to content).
    serverHandle = await bootServer();
    fs.writeFileSync(path.join(sessionDir, 'content', 'asset.svg'), '<svg/>');
    const { status, body } = await new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${port(serverHandle)}/files/asset.svg`, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
        res.on('error', reject);
      }).on('error', reject);
    });
    expect(status).toBe(200);
    expect(body).toBe('<svg/>');
  });

  it('serves the waiting page over HTTP when no screen has been pushed', async () => {
    serverHandle = await bootServer();
    const body = await new Promise((resolve, reject) => {
      http.get(httpUrl(serverHandle, '/'), (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => resolve(data));
        res.on('error', reject);
      });
    });
    expect(body).toMatch(/Waiting for the agent to push a screen/);
    expect(body).toMatch(/<script>/); // helper.js injected
  });
});
