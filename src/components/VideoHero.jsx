import { useEffect, useRef, useState } from 'react';
import useVideoPlayer from './useVideoPlayer';
import useSignedUrl from './useSignedUrl';

/**
 * 大画面视频组件。autoplay 为 true 时挂载后自动播放。
 * 父组件用 key={video.key} 触发重建，确保旧节点资源被彻底释放。
 */
export default function VideoHero({ video, autoplay = false }) {
  const { mediaRef, status, reload } = useVideoPlayer(video?.key);
  // 封面是 R2 key，要换成签名 URL 才显示得出来
  const { url: posterUrl } = useSignedUrl(video?.poster);
  const attemptedRef = useRef(false);
  // 横版还是竖版：元数据到了才知道，先按竖版渲染（已有视频都是竖版）
  const [wide, setWide] = useState(false);

  useEffect(() => {
    attemptedRef.current = false;
    setWide(false); // 换视频时回到默认，等新的探测结果
  }, [video?.key]);

  // 横竖版探测：封面图和视频本身同比例，且不依赖播放（autoplay 被拦时
  // videoWidth 一直是 0，拿不到）。没有封面时才退回等 video 的元数据。
  useEffect(() => {
    if (!posterUrl) return undefined;
    let alive = true;
    const im = new Image();
    im.onload = () => {
      if (alive && im.naturalWidth && im.naturalHeight) {
        setWide(im.naturalWidth >= im.naturalHeight);
      }
    };
    im.src = posterUrl;
    return () => {
      alive = false;
    };
  }, [posterUrl, video?.key]);

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

  // 竖版：宽屏按高度收窄、盒子收缩到视频宽（不产生黑边）；窄屏整宽 9:16。
  // 横版：直接按 16:9 占满列宽，box 本身就是视频比例，无黑边。
  const videoBox = wide
    ? 'aspect-video w-full'
    : 'aspect-[9/16] w-full lg:h-[min(68vh,600px)] lg:w-auto lg:max-w-full';

  return (
    <div className="print-plain overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="p-4 pb-3 sm:p-5">
        <h3 className="font-semibold text-slate-900">{video.title}</h3>
        {video.section && (
          <p className="mt-0.5 text-xs uppercase tracking-wide text-slate-400">{video.section}</p>
        )}
        {video.desc && <p className="mt-1 text-sm text-slate-500">{video.desc}</p>}
        {/* lg:w-fit：竖版时盒子收缩到视频宽，两侧不会露出容器黑底 */}
        <div
          className={`relative mx-auto mt-3 w-full overflow-hidden rounded-lg bg-black ${
            wide ? 'lg:w-full' : 'lg:w-fit'
          }`}
        >
          <video
            ref={mediaRef}
            controls
            playsInline
            webkit-playsinline="true"
            x5-playsinline="true"
            x5-video-player-type="h5-page"
            x5-video-player-fullscreen="true"
            preload="metadata"
            poster={posterUrl || undefined}
            className={videoBox}
            onLoadedMetadata={(e) => {
              const v = e.currentTarget;
              if (v.videoWidth && v.videoHeight) {
                setWide(v.videoWidth >= v.videoHeight);
              }
            }}
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
    </div>
  );
}
