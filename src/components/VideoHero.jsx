import { useEffect, useRef } from 'react';
import useVideoPlayer from './useVideoPlayer';

/**
 * 大画面视频组件。autoplay 为 true 时挂载后自动播放。
 * 父组件用 key={video.key} 触发重建，确保旧节点资源被彻底释放。
 */
export default function VideoHero({ video, autoplay = false }) {
  const { mediaRef, status, reload } = useVideoPlayer(video.key);
  const attemptedRef = useRef(false);

  useEffect(() => {
    attemptedRef.current = false;
  }, [video?.key]);

  useEffect(() => {
    if (!autoplay || attemptedRef.current) return;
    const m = mediaRef.current;
    if (!m) return;
    // 等待 source 加载完再尝试播放
    const tryPlay = () => {
      attemptedRef.current = true;
      m.play().catch(() => {
        // 浏览器拦截 autoplay → 退回等待用户手动点
        attemptedRef.current = false;
      });
    };
    if (m.readyState >= 2) tryPlay();
    else m.addEventListener('loadeddata', tryPlay, { once: true });
  }, [autoplay, video?.key]);

  if (!video) return null;

  return (
    <div className="print-plain overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="p-4 pb-3 sm:p-5">
        <h3 className="font-semibold text-slate-900">{video.title}</h3>
        {video.section && (
          <p className="mt-0.5 text-xs uppercase tracking-wide text-slate-400">{video.section}</p>
        )}
        {video.desc && <p className="mt-1 text-sm text-slate-500">{video.desc}</p>}
      </div>
      <div className="relative bg-black">
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
          onError={() => reload()}
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
              onClick={reload}
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
