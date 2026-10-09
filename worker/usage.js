/**
 * 每日用量统计与免费额度护栏（基于 Workers KV）
 *
 * 设计目标：在 Cloudflare **免费计划**内统计用量，自己不产生费用。
 * 做法：
 *   - KV 免费额度为 10 万次读/天、1 千次写/天，所以这里刻意压低读写频率：
 *     每个 isolate 至少间隔 QUOTA_FLUSH_INTERVAL 秒才读写一次 KV，
 *     期间的增量先在 isolate 内存里累计。
 *   - 计数是**近似值**：多个 isolate 并发时会丢少量增量 / 略有重复，
 *     作为"预算护栏"足够；真正的硬拦截应配合 Cloudflare WAF 速率限制 + 账单提醒。
 *   - 未绑定 KV（binding 缺失）或 QUOTA_ENFORCE=0 时自动降级为"不限制"。
 */

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const dayKey = (ts = Date.now()) => new Date(ts).toISOString().slice(0, 10).replace(/-/g, '');

/** KV 里的一份快照 + isolate 本地尚未写回的增量 */
let snap = null;
let pending = { requests: 0, bytes: 0 };

function enabled(env) {
  return Boolean(env.USAGE) && env.QUOTA_ENFORCE !== '0';
}

function flushInterval(env) {
  return Math.max(60, toNum(env.QUOTA_FLUSH_INTERVAL) || 600) * 1000;
}

function secondsUntilTomorrow() {
  const t = new Date();
  t.setUTCHours(24, 0, 0, 0);
  return Math.max(1, Math.ceil((t.getTime() - Date.now()) / 1000));
}

async function readTotal(env, day) {
  try {
    const raw = await env.USAGE.get(`usage:${day}`);
    if (!raw) return { requests: 0, bytes: 0 };
    const v = JSON.parse(raw);
    return { requests: toNum(v.requests), bytes: toNum(v.bytes) };
  } catch {
    return { requests: 0, bytes: 0 };
  }
}

/**
 * 请求入口：计入 1 次请求，并检查是否超出当日配额。
 * @returns {{ exceeded: boolean, retryAfter: number }}
 */
export async function beginRequest(env) {
  if (!enabled(env)) return { exceeded: false, retryAfter: 0 };

  const day = dayKey();
  const now = Date.now();
  if (!snap || snap.day !== day || now - snap.at >= flushInterval(env)) {
    const base = await readTotal(env, day);
    snap = { day, requests: base.requests, bytes: base.bytes, at: now };
  }

  const requests = snap.requests + pending.requests;
  const bytes = snap.bytes + pending.bytes;

  const reqLimit = toNum(env.DAILY_REQUEST_LIMIT);
  const byteLimit = toNum(env.DAILY_BYTES_LIMIT);
  const exceeded = (reqLimit > 0 && requests >= reqLimit) || (byteLimit > 0 && bytes >= byteLimit);

  if (!exceeded) pending.requests += 1;
  return { exceeded, retryAfter: secondsUntilTomorrow() };
}

/**
 * 请求结束：累加本次出网字节数；若已到刷新间隔则写回 KV。
 * 建议用 ctx.waitUntil() 调用，避免计入 Worker 的 CPU 时间。
 */
export async function endRequest(env, bytes) {
  if (!enabled(env)) return;

  pending.bytes += Math.max(0, toNum(bytes));
  if (!snap || Date.now() - snap.at < flushInterval(env)) return;

  const day = snap.day;
  const key = `usage:${day}`;
  const send = pending;
  pending = { requests: 0, bytes: 0 };

  try {
    const cur = await readTotal(env, day);
    const next = { requests: cur.requests + send.requests, bytes: cur.bytes + send.bytes };
    snap = { day, requests: next.requests, bytes: next.bytes, at: Date.now() };
    await env.USAGE.put(
      key,
      JSON.stringify({ ...next, day, updatedAt: new Date().toISOString() }),
      { expirationTtl: 7 * 24 * 3600 }, // 7 天后自动清理
    );
  } catch {
    // KV 写失败（例如超免费额度被限流）不影响正常业务，退化为近似计数
  }
}

/** 供 /usage 之类调试接口读取当前累计值 */
export async function currentUsage(env) {
  if (!enabled(env)) return null;
  const day = dayKey();
  const total = await readTotal(env, day);
  return {
    day,
    total,
    pendingThisIsolate: pending,
    limits: {
      requests: toNum(env.DAILY_REQUEST_LIMIT),
      bytes: toNum(env.DAILY_BYTES_LIMIT),
    },
  };
}
