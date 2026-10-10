import { useEffect, useState } from 'react';

/** 已经是能直接用的地址（绝对 URL / 站内绝对路径 / data URI），不用再换签名。 */
export function isDirectUrl(s) {
  return /^(https?:)?\/\//i.test(s) || s.startsWith('/') || s.startsWith('data:');
}

/**
 * 把 R2 对象 key 换成带签名的可访问 URL（走 Worker 的 /api/video）。
 * 传入的本来就是 URL 时原样返回，不改动。
 *
 * 封面和视频用同一套签名机制：poster 存的是 `videos/<slug>/poster.jpg`
 * 这样的 key，不能直接塞进 <img src>，否则会 403。
 *
 * @param {string} keyOrUrl R2 对象 key，或已经可用的 URL
 * @returns {{ url: string, loading: boolean, error: string }}
 */
export default function useSignedUrl(keyOrUrl) {
  const direct = !keyOrUrl || isDirectUrl(keyOrUrl);
  const [state, setState] = useState({
    url: direct ? keyOrUrl || '' : '',
    loading: !direct,
    error: '',
  });

  useEffect(() => {
    if (!keyOrUrl || isDirectUrl(keyOrUrl)) {
      setState({ url: keyOrUrl || '', loading: false, error: '' });
      return undefined;
    }

    let alive = true;
    setState({ url: '', loading: true, error: '' });

    fetch(`/api/video?key=${encodeURIComponent(keyOrUrl)}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => {
        if (alive) setState({ url: d.url || '', loading: false, error: '' });
      })
      .catch((e) => {
        if (alive) setState({ url: '', loading: false, error: e.message });
      });

    return () => {
      alive = false;
    };
  }, [keyOrUrl]);

  return state;
}
