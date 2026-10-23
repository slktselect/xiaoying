import { useEffect, useState } from 'react';

/** 已经是能直接用的地址（绝对 URL / 站内绝对路径 / data URI），不用再换签名。 */
export function isDirectUrl(s) {
  return /^(https?:)?\/\//i.test(s) || s.startsWith('/') || s.startsWith('data:');
}

/**
 * 签名 URL 的进程内缓存：key -> { url, exp }。
 *
 * 同一个 key 在签名有效期内只请求一次 /api/video。缩略图、大图、全屏用的是同一批 key，
 * 所以缩略图铺完之后切图/开全屏都是同步命中缓存，不再闪"照片加载中…"。
 */
const CACHE = new Map();
/** 剩余有效期不足这个秒数就当失效，避免刚好卡在过期点上拿到 403 */
const SKEW_SECONDS = 60;
/** 同一 key 的并发请求合并，只打一次接口 */
const INFLIGHT = new Map();

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function cacheGet(key) {
  const hit = CACHE.get(key);
  if (!hit) return '';
  if (hit.exp && hit.exp - nowSeconds() < SKEW_SECONDS) {
    CACHE.delete(key);
    return '';
  }
  return hit.url || '';
}

function cacheSet(key, data) {
  if (!data || !data.url) return;
  CACHE.set(key, { url: data.url, exp: Number(data.exp) || 0 });
}

/** 发一次签名请求（带 inflight 合并），成功后写入缓存 */
function fetchSigned(key) {
  if (INFLIGHT.has(key)) return INFLIGHT.get(key);

  const p = fetch(`/api/video?key=${encodeURIComponent(key)}`, { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then((d) => {
      cacheSet(key, d);
      return d.url || '';
    })
    .finally(() => {
      INFLIGHT.delete(key);
    });

  INFLIGHT.set(key, p);
  return p;
}

/**
 * 把 R2 对象 key 换成带签名的可访问 URL（走 Worker 的 /api/video）。
 * 传入的本来就是 URL 时原样返回，不改动。
 *
 * 封面和视频用同一套签名机制：poster 存的是 `videos/<slug>/poster.jpg`
 * 这样的 key，不能直接塞进 <img src>，否则会 403。
 *
 * 缓存命中时同步返回，且 loading 恒为 false —— 切图不会先闪一下加载态；
 * 未命中时保留上一张的 url 继续显示，等新图就绪再替换（避免闪白）。
 *
 * @param {string} keyOrUrl R2 对象 key，或已经可用的 URL
 * @returns {{ url: string, loading: boolean, error: string }}
 */
export default function useSignedUrl(keyOrUrl) {
  const key = keyOrUrl || '';

  // 首次渲染就取缓存，避免"先空一帧再出现"
  const [state, setState] = useState(() => {
    const cached = isDirectUrl(key) ? key : cacheGet(key);
    return { key, url: cached, loading: !cached && !!key, error: '' };
  });

  useEffect(() => {
    if (!key) {
      setState({ key: '', url: '', loading: false, error: '' });
      return undefined;
    }

    if (isDirectUrl(key)) {
      setState({ key, url: key, loading: false, error: '' });
      return undefined;
    }

    const cached = cacheGet(key);
    if (cached) {
      setState({ key, url: cached, loading: false, error: '' });
      return undefined;
    }

    let alive = true;
    // 保留旧 url：切图时先继续显示上一张，而不是立刻变成"加载中"
    setState((s) => ({ key, url: s.url, loading: true, error: '' }));

    fetchSigned(key)
      .then((url) => {
        if (alive) setState({ key, url, loading: false, error: '' });
      })
      .catch((e) => {
        if (alive) setState((s) => ({ key, url: s.url, loading: false, error: e.message }));
      });

    return () => {
      alive = false;
    };
  }, [key]);

  // key 已经变了但 effect 还没跑的这一帧，直接用缓存值兜住（不闪旧图、不闪加载态）
  if (state.key !== key) {
    const cached = isDirectUrl(key) ? key : cacheGet(key);
    return {
      url: cached || state.url,
      loading: !cached && !!key,
      error: '',
    };
  }

  return { url: state.url, loading: state.loading, error: state.error };
}
