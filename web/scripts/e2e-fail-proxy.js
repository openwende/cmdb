#!/usr/bin/env node
/**
 * E2E 故障注入代理
 *
 * 监听 8091，把请求原样转发到后端 8080。命中「归档」请求时不转发，直接返回一个
 * 和真实后端完全一致的错误响应，用来在真实浏览器里验证前端的失败分支
 * （归档失败提示、列表不被误删等）。
 *
 * 注入的响应刻意抄真实后端的形状：HTTP 404 + {"success":false,"error":"...","message":"..."}，
 * error 是字符串不是对象。形状对不上，前端就可能走到别的错误分支，注入就白做了。
 *
 * 归档在前端是 PUT /api/v1/businesses/:id 且 body 里 lifecycle === 'offline'
 * （见 src/pages/Resource/Business/BusinessList/index.tsx 的 confirmArchive）。
 *
 * 环境变量：
 *   E2E_FAIL_ARCHIVE_IDS  要让归档失败的业务 ID，逗号分隔，如 "1002,1003"；
 *                         填 "*" 表示所有业务的归档都失败。不设则不注入任何故障。
 *   E2E_PROXY_PORT        代理监听端口，默认 8091
 *   E2E_BACKEND_URL       真实后端地址，默认 http://localhost:8080
 *   E2E_FAIL_STATUS       注入失败时返回的状态码，默认 404（与真实后端一致）
 *   E2E_DEV_PORT          --with-dev 时 vite 的端口，默认 5199
 *
 * 用法：
 *   node scripts/e2e-fail-proxy.js              仅启动代理
 *   node scripts/e2e-fail-proxy.js --with-dev   同时拉起前端 dev server，并把
 *                                               VITE_API_URL 指向本代理
 */

import http from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const PROXY_PORT = Number(process.env.E2E_PROXY_PORT || 8091);
const BACKEND_URL = new URL(process.env.E2E_BACKEND_URL || 'http://localhost:8080');
const FAIL_STATUS = Number(process.env.E2E_FAIL_STATUS || 404);
const DEV_PORT = Number(process.env.E2E_DEV_PORT || 5199);

const rawIds = (process.env.E2E_FAIL_ARCHIVE_IDS || '').trim();
const FAIL_ALL = rawIds === '*';
const FAIL_IDS = new Set(
  rawIds
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);

const OFFLINE_LIFECYCLE = 'offline';
const ARCHIVE_PATH = /^(?:\/api)?\/v1\/businesses\/([^/?]+)$/;

/** 判断这条请求是不是「对某个被点名的业务做归档」 */
function matchArchiveFailure(method, url, body) {
  if (!FAIL_ALL && FAIL_IDS.size === 0) return null;
  if (method !== 'PUT') return null;

  const path = url.split('?')[0];
  const matched = ARCHIVE_PATH.exec(path);
  if (!matched) return null;

  const id = matched[1];
  if (!FAIL_ALL && !FAIL_IDS.has(id)) return null;

  // 只拦归档，普通编辑照常放行
  let payload;
  try {
    payload = JSON.parse(body.toString('utf8') || '{}');
  } catch {
    return null;
  }
  if (payload?.lifecycle !== OFFLINE_LIFECYCLE) return null;

  return id;
}

/** 注入的响应要自己带 CORS 头，否则浏览器只会报跨域错误，看不到真正的状态码 */
function corsHeaders(req) {
  return {
    'Access-Control-Allow-Origin': req.headers.origin || '*',
    'Access-Control-Allow-Credentials': 'true',
    Vary: 'Origin',
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  let body;
  try {
    body = await readBody(req);
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json', ...corsHeaders(req) });
    res.end(JSON.stringify({ success: false, error: 'e2e-proxy: failed to read request body' }));
    return;
  }

  const hitId = matchArchiveFailure(req.method, req.url, body);
  if (hitId) {
    console.log(`[e2e-proxy] INJECT FAIL  ${req.method} ${req.url}  business=${hitId}`);
    res.writeHead(FAIL_STATUS, { 'Content-Type': 'application/json', ...corsHeaders(req) });
    // 形状与真实后端错误一致：error 是字符串，不是对象
    res.end(
      JSON.stringify({
        success: false,
        error: 'E2E_INJECTED',
        message: `E2E 注入失败：业务 ${hitId}`,
      }),
    );
    return;
  }

  const headers = { ...req.headers, host: BACKEND_URL.host };
  const upstream = http.request(
    {
      protocol: BACKEND_URL.protocol,
      hostname: BACKEND_URL.hostname,
      port: BACKEND_URL.port || 80,
      method: req.method,
      path: req.url,
      headers,
    },
    (upstreamRes) => {
      console.log(`[e2e-proxy] pass ${req.method} ${req.url} -> ${upstreamRes.statusCode}`);
      res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    },
  );

  upstream.on('error', (err) => {
    console.error(`[e2e-proxy] upstream error ${req.method} ${req.url}: ${err.message}`);
    res.writeHead(502, { 'Content-Type': 'application/json', ...corsHeaders(req) });
    res.end(
      JSON.stringify({
        success: false,
        error: `e2e-proxy: cannot reach backend ${BACKEND_URL.origin} (${err.message})`,
      }),
    );
  });

  if (body.length > 0) upstream.write(body);
  upstream.end();
});

server.listen(PROXY_PORT, () => {
  const target = FAIL_ALL ? 'ALL businesses' : [...FAIL_IDS].join(', ') || '(none)';
  console.log(`[e2e-proxy] listening on http://localhost:${PROXY_PORT} -> ${BACKEND_URL.origin}`);
  console.log(`[e2e-proxy] archive will fail for: ${target}  (status ${FAIL_STATUS})`);
  if (!FAIL_ALL && FAIL_IDS.size === 0) {
    console.log('[e2e-proxy] tip: set E2E_FAIL_ARCHIVE_IDS=1002 to inject a failure');
  }
});

// --with-dev: 顺带把前端 dev server 拉起来，并指向本代理
if (process.argv.includes('--with-dev')) {
  // 直接用本地 vite，绕开 npx/npm 的告警噪音
  const localVite = new URL('../node_modules/.bin/vite', import.meta.url).pathname;
  const viteBin = existsSync(localVite) ? localVite : 'npx';
  const viteArgs =
    viteBin === 'npx' ? ['vite', '--port', String(DEV_PORT)] : ['--port', String(DEV_PORT)];

  const child = spawn(viteBin, viteArgs, {
    stdio: 'inherit',
    env: {
      ...process.env,
      VITE_API_URL: `http://localhost:${PROXY_PORT}/api`,
      VITE_DEMO_LOGIN: process.env.VITE_DEMO_LOGIN ?? 'true',
    },
  });

  const shutdown = () => {
    child.kill('SIGTERM');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  child.on('exit', (code) => {
    server.close(() => process.exit(code ?? 0));
    setTimeout(() => process.exit(code ?? 0), 2000).unref();
  });
}
