import { useEffect, useRef, useState } from 'react';

const isHls = (key) => /\.m3u8$/i.test((key || '').trim());

export default function VideoCard({ video }) {
  const mediaRef = useRef(null);
  const hlsRef = useRef(null);
  const [status, setStatus] = useState({ loading: true, error: '' });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const attach = async () => {
      const media = mediaRef.current;
      if (!media) return;
      setStatus({ loading: true, error: '' });

      try {
        // 向 Worker 换取带签名的临时播放地址
        const res = await fetch(`/api/video?key=${encodeURIComponent(video.key)}`, {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { url } = await res.json();
        if (cancelled) return;

        if (!isHls(video.key)) {
          media.src = url;
        } else if (media.canPlayType('application/vnd.apple.mpegurl')) {
          // Safari / iOS 原生支持 HLS，不用加载 hls.js
          media.src = url;
        } else {
          // 桌面 Chrome / Edge 需要 hls.js；按需动态加载，不进主包
          const { default: Hls } = await import('hls.js');
          if (cancelled) return;
          if (!Hls.isSupported()) {
            setStatus({ loading: false, error: '当前浏览器不支持 HLS 播放' });
            return;
          }
          const hls = new Hls({ enableWorker: true, backBufferLength: 30 });
          hls.on(Hls.Events.ERROR, (_e, data) => {
            if (data.fatal) setStatus({ loading: false, error: '视频加载失败或链接已过期' });
          });
          hls.loadSource(url);
          hls.attachMedia(media);
          hlsRef.current = hls;
        }

        if (!cancelled) setStatus({ loading: false, error: '' });
      } catch (e) {
        if (!cancelled) setStatus({ loading: false, error: `播放地址获取失败：${e.message}` });
      }
    };

    attach();

    return () => {
      cancelled = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [video.key, nonce]);

  return (
    <div className="print-plain mb-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="p-5 pb-3">
        <h3 className="font-semibold text-slate-900">{video.title}</h3>
        {video.desc && <p className="mt-1 text-sm text-slate-500">{video.desc}</p>}
      </div>

      <div className="relative bg-black">
        {/*
          playsInline / webkit-playsinline：iOS Safari 与微信内置浏览器不强制全屏，页内播放。
          x5-*：微信 Android（X5 内核）需要这几个属性才会页内播放，否则会自动跳全屏。
        */}
        <video
          ref={mediaRef}
          controls
          playsInline
          webkit-playsinline="true"
          x5-playsinline="true"
          x5-video-player-type="h5-page"
          x5-video-player-fullscreen="true"
          preload="metadata"
          poster={video.poster || undefined}
          className="aspect-video w-full"
          onError={() => setStatus({ loading: false, error: '视频加载失败或链接已过期' })}
        />

        {status.loading && (
          <div className="absolute inset-0 grid place-items-center bg-black/50 text-sm text-white">
            正在获取播放地址…
          </div>
        )}

        {!status.loading && status.error && (
          <div className="absolute inset-0 grid place-items-center gap-3 bg-black/60 px-6 text-center">
            <p className="text-sm text-white">{status.error}</p>
            <button
              type="button"
              onClick={() => setNonce((n) => n + 1)}
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700"
            >
              重新获取
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
