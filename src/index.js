/**
 * Cloudflare Worker：简历站点（静态资源）+ R2 视频私有分发（防盗链）
 *
 * 路由（run_worker_first 已在 wrangler.toml 指定，其余路径由 Workers 静态资源直出）：
 *   GET /api/video?key=<对象key>          -> 校验来源后签发短期签名 URL，返回给播放器
 *   GET /sign?key=<对象key>&ttl=<秒>      -> 业务后端使用的签发接口（需 Bearer SIGN_TOKEN）
 *   GET|HEAD /v/<key>?exp=<秒>&sig=<签名> -> 校验签名后从 R2 返回视频，支持 Range
 *
 * 绑定/变量见 wrangler.toml：BUCKET(R2)、USAGE(KV)、SIGN_SECRET(secret)、SIGN_TOKEN(secret)
 */

import { beginRequest, endRequest, currentUsage } from './usage.js';

const enc = new TextEncoder();

const EXT_MIME = {
  mp4: 'video/mp4',
  m4v: 'video/x-m4v',
  mov: 'video/quicktime',
  webm: 'video/webm',
  m3u8: 'application/vnd.apple.mpegurl',
  ts: 'video/mp2t',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  vtt: 'text/vtt',
};

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204 });
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return text('Method Not Allowed', 405);
    }

    const url = new URL(request.url);
    const ip = request.headers.get('cf-connecting-ip') || '';

    // 静态资源由 Workers Assets 直出，能走到这里的一定是下面的动态路由，统一计入配额
    const quota = await beginRequest(env);
    if (quota.exceeded) {
      return text(
        '429 Too Many Requests：今日免费额度已用尽，请明天再试',
        429,
        { 'retry-after': String(quota.retryAfter), 'cache-control': 'no-store' },
      );
    }

    let res;
    if (url.pathname === '/api/video') res = await issueForPlayer(request, env, url, ip);
    else if (url.pathname === '/sign') res = await handleSign(request, env, url, ip);
    else if (url.pathname.startsWith('/v/')) res = await serveVideo(request, env, url, ip);
    else if (url.pathname === '/usage') res = await showUsage(env, request);
    else res = text('Not Found', 404);

    // 出网字节数计入当日用量（放在 waitUntil，不占 Worker CPU 时间）
    ctx.waitUntil(endRequest(env, res.headers.get('content-length')));
    return res;
  },
};

/** 当日用量查询：同一 IP 白名单内可用；生产建议加鉴权或直接注释掉该路由 */
async function showUsage(env, request) {
  const ip = request.headers.get('cf-connecting-ip') || '';
  const allowed = (env.USAGE_ALLOW_IPS || '').split(',').map((s) => s.trim()).filter(Boolean);
  // 未显式配置白名单时一律拒绝，避免用量数据对外泄露
  if (!allowed.includes(ip)) return text('Forbidden', 403);
  const usage = await currentUsage(env);
  if (!usage) return json({ error: 'usage tracking disabled' }, 404);
  return json(usage);
}

/* ------------------- /api/video：给前端播放器的签发接口 ------------------- */

async function issueForPlayer(request, env, url, ip) {
  if (!env.SIGN_SECRET) return json({ error: 'SIGN_SECRET missing' }, 500);

  // 防盗链第一道：只有白名单来源的页面才能拿到播放地址
  if (!refererAllowed(request, env)) {
    return json({ error: 'forbidden: referer not allowed' }, 403);
  }

  const key = normalizeKey(url.searchParams.get('key') || '');
  if (!key) return json({ error: 'key is required' }, 400);
  if (!keyAllowed(key, env)) return json({ error: 'forbidden: key not allowed' }, 403);

  const ttl = clamp(Number(url.searchParams.get('ttl') || env.PLAY_TTL || 300), 1, 86400);
  // exp 对齐到 SIGN_WINDOW：同一时间窗口内所有访客拿到完全相同的 URL，
  // 这样 Cloudflare 边缘节点只需缓存一份，绝大多数请求由 CDN 直出而非回源 R2。
  const exp = bucketExp(ttl, env);
  const sig = await makeSig(env.SIGN_SECRET, payload(env, key, exp, ip));

  return json({
    url: `/v/${encodeURI(key)}?exp=${exp}&sig=${sig}`,
    key,
    exp,
    ttl: exp - Math.floor(Date.now() / 1000),
  });
}

/* --------------------- /sign：给业务后端的签发接口 --------------------- */

async function handleSign(request, env, url, ip) {
  if (!env.SIGN_TOKEN || !env.SIGN_SECRET) {
    return json({ error: 'sign api disabled' }, 404);
  }
  if (request.headers.get('authorization') !== `Bearer ${env.SIGN_TOKEN}`) {
    return json({ error: 'unauthorized' }, 401);
  }

  const key = normalizeKey(url.searchParams.get('key') || '');
  if (!key) return json({ error: 'key is required' }, 400);

  const ttl = clamp(Number(url.searchParams.get('ttl') || 300), 1, 7 * 24 * 3600);
  const exp = bucketExp(ttl, env);
  const sig = await makeSig(env.SIGN_SECRET, payload(env, key, exp, ip));

  return json({
    url: `${url.origin}/v/${encodeURI(key)}?exp=${exp}&sig=${sig}`,
    key,
    exp,
    ttl,
  });
}

/* ------------------------------ 视频分发 ------------------------------ */

async function serveVideo(request, env, url, ip) {
  if (!env.SIGN_SECRET) return text('Server misconfigured: SIGN_SECRET missing', 500);

  const key = normalizeKey(url.pathname.slice('/v/'.length));
  if (!key) return text('Bad Request: invalid key', 400);

  const exp = Number(url.searchParams.get('exp') || 0);
  const sig = url.searchParams.get('sig') || '';
  if (!exp || !sig) return text('Forbidden: missing signature', 403);
  if (exp * 1000 <= Date.now()) return text('Forbidden: link expired', 403);

  if (!(await verifySig(env.SIGN_SECRET, payload(env, key, exp, ip), sig))) {
    return text('Forbidden: bad signature', 403);
  }

  if (!refererAllowed(request, env)) {
    return text('Forbidden: referer not allowed', 403);
  }

  let head;
  try {
    head = await env.BUCKET.head(key);
  } catch (e) {
    return text('Upstream error: ' + e.message, 500);
  }
  if (!head) return text('Not Found', 404);

  const size = head.size;
  const headers = baseHeaders(head, key, env, exp);

  let start = 0;
  let end = size - 1;
  let status = 200;

  const rangeHeader = request.headers.get('range');
  if (rangeHeader && size > 0) {
    const r = parseRange(rangeHeader, size);
    if (!r) {
      headers.set('content-range', `bytes */${size}`);
      headers.set('content-length', '0');
      return new Response(null, { status: 416, headers });
    }
    start = r.start;
    end = r.end;
    status = 206;

    // 仅在客户端显式发 Range 时才限制单次返回字节数。
    // 注意：不能对"完整请求"（无 Range）做截断，否则 Content-Length 会小于真实文件大小，
    // 浏览器会以为视频只有这么长，导致播放提前结束。
    const maxRange = Number(env.MAX_RANGE_BYTES || 0);
    if (maxRange > 0 && end - start + 1 > maxRange) {
      end = Math.min(end, start + maxRange - 1);
    }
  }

  const length = end - start + 1;
  headers.set('accept-ranges', 'bytes');
  headers.set('content-length', String(length));
  if (status === 206) headers.set('content-range', `bytes ${start}-${end}/${size}`);

  if (request.method === 'HEAD') {
    return new Response(null, { status, headers });
  }

  let obj;
  try {
    // 按 Range 只读取需要的字节，避免整文件入内存
    obj = length === size
      ? await env.BUCKET.get(key)
      : await env.BUCKET.get(key, { range: { offset: start, length } });
  } catch (e) {
    return text('Upstream error: ' + e.message, 500);
  }
  if (!obj || !obj.body) return text('Not Found', 404);

  return new Response(obj.body, { status, headers });
}

/* ------------------------------ 工具函数 ------------------------------ */

function payload(env, key, exp, ip) {
  return env.BIND_IP === '1' ? `${key}\n${exp}\n${ip}` : `${key}\n${exp}`;
}

/**
 * 把过期时间向上取整到 SIGN_WINDOW 的整数倍。
 * 目的：同一时间窗口内所有访客拿到**完全相同**的 URL，
 * 使 Cloudflare 边缘节点只需缓存一份（否则每人一个签名 = 每人一份缓存副本）。
 */
function bucketExp(ttl, env) {
  const window = Math.max(1, Number(env.SIGN_WINDOW || 300));
  const now = Math.floor(Date.now() / 1000);
  return Math.ceil((now + Math.max(1, ttl)) / window) * window;
}

function keyAllowed(key, env) {
  const allow = (env.VIDEO_KEYS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return allow.length === 0 || allow.includes(key);
}

function normalizeKey(raw) {
  let key;
  try {
    key = decodeURIComponent(raw);
  } catch {
    key = raw;
  }
  key = key.replace(/^\/+/, '');
  if (!key) return null;
  if (key.split('/').some((seg) => seg === '.' || seg === '..')) return null;
  return key;
}

/** 解析 `bytes=start-end`，返回 null 表示不可满足（416） */
function parseRange(header, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec((header || '').trim());
  if (!m) return null;
  const [, s, e] = m;
  if (s === '' && e === '') return null;

  let start;
  let end;
  if (s === '') {
    const suffixLen = Number(e);
    if (!suffixLen) return null;
    start = Math.max(0, size - suffixLen);
    end = size - 1;
  } else {
    start = Number(s);
    end = e === '' ? size - 1 : Math.min(Number(e), size - 1);
  }
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start > end || start >= size) return null;
  return { start, end };
}

function baseHeaders(head, key, env, exp) {
  // 签名本身带过期时间、且 exp 已按 SIGN_WINDOW 对齐，同一窗口内 URL 完全一致，
  // 因此响应可以安全地放进 Cloudflare 边缘缓存做免费 CDN 分发；
  // max-age 不会超过剩余有效期，过期后自然失效。
  const maxAge = clamp(
    Math.min(Number(env.CDN_CACHE_MAX_AGE || 300), exp - Math.floor(Date.now() / 1000)),
    0,
    86400,
  );
  const h = new Headers({
    'content-type': (head.httpMetadata && head.httpMetadata.contentType) || guessMime(key),
    'content-disposition': 'inline',
    'cache-control': `public, max-age=${maxAge}`,
    'cloudflare-cdn-cache-control': `max-age=${maxAge}`,
  });
  const etag = head.httpEtag || head.etag;
  if (etag) h.set('etag', etag);
  if (head.uploaded) h.set('last-modified', new Date(head.uploaded).toUTCString());
  return h;
}

function guessMime(key) {
  const ext = key.split('.').pop().toLowerCase();
  return EXT_MIME[ext] || 'application/octet-stream';
}

function refererAllowed(request, env) {
  const allow = (env.ALLOW_REFERERS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allow.length === 0) return true;

  const ref = request.headers.get('referer');
  if (!ref) return env.ALLOW_EMPTY_REFERER === '1';

  let host;
  try {
    host = new URL(ref).hostname.toLowerCase();
  } catch {
    return false;
  }
  return allow.some((pattern) => matchHost(pattern, host));
}

function matchHost(pattern, host) {
  if (pattern.startsWith('*.')) {
    const base = pattern.slice(2);
    return host === base || host.endsWith('.' + base);
  }
  return host === pattern;
}

function importHmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

async function makeSig(secret, payload) {
  const key = await importHmacKey(secret);
  return b64urlEncode(await crypto.subtle.sign('HMAC', key, enc.encode(payload)));
}

async function verifySig(secret, payload, sig) {
  const key = await importHmacKey(secret);
  try {
    // crypto.subtle.verify 内部为常量时间比较，优于手写字符串 ===
    return await crypto.subtle.verify('HMAC', key, b64urlDecode(sig), enc.encode(payload));
  } catch {
    return false;
  }
}

function b64urlEncode(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str) {
  const s = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : '';
  const bin = atob(s + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function clamp(n, min, max) {
  if (!Number.isFinite(n)) return min;
  return Math.min(Math.max(Math.trunc(n), min), max);
}

function text(body, status = 200, headers = {}) {
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8', ...headers },
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}
