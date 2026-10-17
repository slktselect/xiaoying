import { useEffect, useRef, useState } from 'react';
import useVideoPlayer from './useVideoPlayer';
import useSignedUrl from './useSignedUrl';
import useVideoOrientation from './useVideoOrientation';

/**
 * 大画面视频组件。挂载后只显示封面（poster），
 * 等用户点播放按钮才播放，不自动播放。
 * 唯一例外：连播（videoGallery.autoNext）时父组件显式传 autoPlay，
 * 表示「上一个视频刚看完，这个是顺着往下播的」。
 *
 * 父组件用 key={video.key} 触发重建，确保旧节点资源被彻底释放。
 *
 * @param {object}  video                视频配置 {key,title,desc,poster,section}
 * @param {boolean} [wide]               横版还是竖版；不传就自己探测（单独使用时）
 * @param {number}  [startAt]            上次观看到的秒数；切回来时接着看（看完传 0）
 * @param {boolean} [autoPlay]           数据就绪后立即播放（仅连播场景）
 * @param {number}  [index]              本分区内序号（配合 total 显示「3 / 12」）
 * @param {number}  [total]              本分区视频总数
 * @param {(key: string) => void} [onEnded]    播放结束
 * @param {(t: number) => void}   [onProgress] 播放进度（节流上报，供父组件记忆）
 */
export default function VideoHero({
  video,
  wide: wideProp,
  startAt = 0,
  autoPlay = false,
  index,
  total,
  onEnded,
  onProgress,
}) {
  const { mediaRef, status, reload } = useVideoPlayer(video?.key);
  // 封面是 R2 key，要换成签名 URL 才显示得出来
  const { url: posterUrl } = useSignedUrl(video?.poster);
  // 横版还是竖版，优先级：父组件传的 > 封面探测 > 视频自己的元数据。
  // 封面探测不依赖播放（不自动播放时 videoWidth 一直是 0），所以排前面；
  // 元数据只在没有封面时兜底。
  const ownWide = useVideoOrientation(wideProp === undefined ? video?.poster : '');
  const [metaWide, setMetaWide] = useState(null);
  const wide = (wideProp ?? ownWide ?? metaWide) ?? false;

  // 「接着看」只恢复一次：播放中续期 reload() 也会再触发 loadedmetadata，
  // 那时进度由 hook 自己的恢复逻辑管，不能再跳回 startAt
  const restoredRef = useRef(false);
  // 进度上报节流：timeupdate 每秒最多一次，pause / ended 立即报
  const lastReportRef = useRef(0);

  // 连播起播：仅父组件明确要求（autoPlay）时才 play()，
  // 被浏览器拦了就退回手动点，封面还在
  useEffect(() => {
    if (!autoPlay) return undefined;
    const m = mediaRef.current;
    if (!m) return undefined;
    const tryPlay = () => {
      m.play().catch(() => {});
    };
    if (m.readyState >= 2) tryPlay();
    else m.addEventListener('loadeddata', tryPlay, { once: true });
    return () => m.removeEventListener('loadeddata', tryPlay);
  }, [autoPlay, video?.key]);

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
              // 兜底：封面没给出方向时才信视频自己的元数据
              const v = e.currentTarget;
              if (v.videoWidth && v.videoHeight) {
                setMetaWide(v.videoWidth >= v.videoHeight);
              }
              // 第一次元数据就绪时恢复到上次观看位置（看完的不恢复）
              if (!restoredRef.current) {
                restoredRef.current = true;
                if (startAt > 1 && v.duration && startAt < v.duration - 1) {
                  try {
                    v.currentTime = startAt;
                  } catch {
                    /* 某些浏览器在元数据就绪前设置会抛错，忽略 */
                  }
                }
              }
            }}
            onTimeUpdate={() => {
              const m = mediaRef.current;
              if (!m || !onProgress) return;
              const now = Date.now();
              if (now - lastReportRef.current < 1000) return;
              lastReportRef.current = now;
              onProgress(m.currentTime);
            }}
            onPause={() => {
              const m = mediaRef.current;
              if (m && onProgress) onProgress(m.currentTime);
            }}
            onEnded={() => onEnded?.(video.key)}
            onError={() => reload()}
          />

          {/* 本分区内序号，长列表里知道自己看到哪了 */}
          {index > 0 && total > 0 && (
            <span className="no-print absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs tabular-nums text-white/90">
              {index} / {total}
            </span>
          )}

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

        {/* 键盘提示只在桌面端显示（手机上没键盘） */}
        {total > 1 && (
          <p className="no-print mt-2 hidden text-xs text-slate-400 lg:block">
            ← / → 切换本分区视频
          </p>
        )}
      </div>
    </div>
  );
}
