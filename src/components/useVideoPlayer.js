import { useEffect, useRef, useState } from 'react';

const isHls = (key) => /\.m3u8$/i.test((key || '').trim());

// 提前多少秒续期：要留够一次网络往返的时间
const REFRESH_LEAD = 60;
// 两次续期的最小间隔（毫秒），防止连续 403 时疯狂重试
const MIN_REFRESH_GAP = 5000;
// 连续续期失败多少次后放弃自动重试，把重试按钮交给用户
const MAX_FAILS = 3;

/**
 * 视频播放 hook：取签名 URL、加载 HLS、定时续期。
 * @param {string} key  R2 对象 key
 * @returns {{ mediaRef: React.RefObject, status: { loading: boolean, error: string }, reload: () => void }}
 */
export default function useVideoPlayer(key) {
  const mediaRef = useRef(null);
  const hlsRef = useRef(null);
  const [status, setStatus] = useState({ loading: true, error: '' });
  const [nonce, setNonce] = useState(0);

  // 续期相关状态（用 ref 存，避免触发重渲染）
  const expRef = useRef(0);
  const timerRef = useRef(null);
  const lastRefreshRef = useRef(0);
  const failsRef = useRef(0);
  const aliveRef = useRef(true);
  const fatalRef = useRef(() => {});

  useEffect(() => {
    const media = mediaRef.current;
    if (!media || !key) return undefined;

    aliveRef.current = true;
    failsRef.current = 0;

    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    /** 向 Worker 换取带签名的播放地址（签名里的分片地址会一起刷新） */
    const fetchUrl = async () => {
      const res = await fetch(`/api/video?key=${encodeURIComponent(key)}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    };

    const scheduleRefresh = () => {
      clearTimer();
      const waitMs = (expRef.current - Math.floor(Date.now() / 1000) - REFRESH_LEAD) * 1000;
      if (waitMs <= 0) return;
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        const m = mediaRef.current;
        // 暂停中就不打扰：等真正播放失败时再走 onFatal 续期
        if (!m || m.paused || m.ended) return;
        reload();
      }, waitMs);
    };

    /** 用新的签名地址重新加载，尽量保住播放进度 */
    const reload = async () => {
      const now = Date.now();
      if (now - lastRefreshRef.current < MIN_REFRESH_GAP) return false;
      lastRefreshRef.current = now;

      const at = media.currentTime;
      const wasPlaying = !media.paused && !media.ended;

      let data;
      try {
        data = await fetchUrl();
      } catch (e) {
        if (aliveRef.current) {
          setStatus({ loading: false, error: `播放地址已过期，续期失败：${e.message}` });
        }
        return false;
      }
      if (!aliveRef.current) return false;

      expRef.current = data.exp || 0;
      scheduleRefresh();

      if (hlsRef.current) {
        // hls.js 重新拉播放列表；媒体元素不变，进度不会丢
        hlsRef.current.loadSource(data.url);
        if (wasPlaying) media.play().catch(() => {});
      } else {
        // 原生播放（Safari / iOS）：换 src 会重置播放器，所以要手动回到原进度
        media.src = data.url;
        media.load();
        const restore = () => {
          media.removeEventListener('loadedmetadata', restore);
          if (at > 0) {
            try {
              media.currentTime = at;
            } catch {
              /* 某些浏览器在元数据就绪前设置会抛错，忽略 */
            }
          }
          if (wasPlaying) media.play().catch(() => {});
        };
        media.addEventListener('loadedmetadata', restore);
      }
      return true;
    };

    /** 播放出错（多半是签名过期 → 403）：换个新地址再来一次 */
    const onFatal = async () => {
      if (!aliveRef.current) return;
      failsRef.current += 1;
      if (failsRef.current > MAX_FAILS) {
        setStatus({ loading: false, error: '视频加载失败或链接已过期' });
        return;
      }
      const ok = await reload();
      if (!ok && aliveRef.current) {
        setStatus({ loading: false, error: '视频加载失败或链接已过期' });
      }
    };
    fatalRef.current = onFatal;

    // 能正常播放说明已经恢复，清掉失败计数与错误提示
    const onPlaying = () => {
      failsRef.current = 0;
      setStatus({ loading: false, error: '' });
    };
    media.addEventListener('playing', onPlaying);

    const attach = async () => {
      setStatus({ loading: true, error: '' });
      try {
        const data = await fetchUrl();
        if (!aliveRef.current) return;

        expRef.current = data.exp || 0;
        lastRefreshRef.current = Date.now();
        scheduleRefresh();

        if (!isHls(key)) {
          // 普通 mp4 也走签名，同样会过期
          media.src = data.url;
        } else if (media.canPlayType('application/vnd.apple.mpegurl')) {
          // Safari / iOS 原生支持 HLS，不用加载 hls.js
          media.src = data.url;
        } else {
          // 桌面 Chrome / Edge 需要 hls.js；按需动态加载，不进主包
          const { default: Hls } = await import('hls.js');
          if (!aliveRef.current) return;
          if (!Hls.isSupported()) {
            setStatus({ loading: false, error: '当前浏览器不支持 HLS 播放' });
            return;
          }
          const hls = new Hls({ enableWorker: true, backBufferLength: 30 });
          hls.on(Hls.Events.ERROR, (_e, d) => {
            if (d.fatal) onFatal();
          });
          hls.loadSource(data.url);
          hls.attachMedia(media);
          hlsRef.current = hls;
        }

        if (aliveRef.current) setStatus({ loading: false, error: '' });
      } catch (e) {
        if (aliveRef.current) {
          setStatus({ loading: false, error: `播放地址获取失败：${e.message}` });
        }
      }
    };

    attach();

    return () => {
      aliveRef.current = false;
      clearTimer();
      media.removeEventListener('playing', onPlaying);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [key, nonce]);

  return {
    mediaRef,
    status,
    reload: () => setNonce((n) => n + 1),
  };
}
