import useVideoPlayer from './useVideoPlayer';

export default function VideoCard({ video }) {
  const { mediaRef, status, reload } = useVideoPlayer(video.key);

  return (
    <div className="print-plain mb-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="p-4 pb-3 sm:p-5">
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
