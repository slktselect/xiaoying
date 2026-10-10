/**
 * 缩略卡：poster + title，点击触发 onSelect。
 * active=true 时给一圈高亮，提示「这个就是大画面正在播的」。
 */
export default function VideoThumb({ video, active = false, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(video)}
      className={`group block w-full text-left transition ${
        active ? 'rounded-lg ring-2 ring-blue-500 ring-offset-2' : ''
      }`}
      aria-pressed={active}
    >
      <div className="aspect-video w-full overflow-hidden rounded-lg bg-slate-100">
        {video.poster ? (
          <img src={video.poster} alt={video.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
            暂无封面
          </div>
        )}
      </div>
      <p className="mt-1.5 line-clamp-2 text-sm font-medium text-slate-800 group-hover:text-blue-600">
        {video.title}
      </p>
    </button>
  );
}
