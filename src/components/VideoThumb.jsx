import useSignedUrl from './useSignedUrl';

/**
 * 缩略卡：封面 + title，点击触发 onSelect。
 * active=true 时给一圈高亮，提示「这个就是大画面正在播的」。
 *
 * poster 存的是 R2 key（`videos/<slug>/poster.jpg`），要先换成签名 URL 才能显示；
 * 空字符串时显示占位，不发请求。
 */
export default function VideoThumb({ video, active = false, onSelect }) {
  const { url: posterUrl, loading, error } = useSignedUrl(video.poster);
  const placeholder = loading ? '封面加载中…' : error ? '封面不可用' : '暂无封面';

  return (
    <button
      type="button"
      onClick={() => onSelect?.(video)}
      className={`group block w-full text-left transition ${
        active ? 'rounded-lg ring-2 ring-blue-500 ring-offset-2' : ''
      }`}
      aria-pressed={active}
    >
      <div className="aspect-[9/16] w-full overflow-hidden rounded-lg bg-black">
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={video.title}
            loading="lazy"
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-slate-100 text-xs text-slate-400">
            {placeholder}
          </div>
        )}
      </div>
      <p className="mt-1.5 line-clamp-2 text-sm font-medium text-slate-800 group-hover:text-blue-600">
        {video.title}
      </p>
    </button>
  );
}
