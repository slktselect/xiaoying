import { useEffect, useState } from 'react';
import useSignedUrl from './useSignedUrl';

/**
 * 缩略卡：封面 + title，点击触发 onSelect。
 * active=true 时给一圈高亮，提示「这个就是大画面正在播的」。
 *
 * poster 存的是 R2 key（`videos/<slug>/poster.jpg`），要先换成签名 URL 才能显示；
 * 空字符串时显示占位，不发请求。
 *
 * 卡片比例跟着封面走：横版封面 16:9、竖版封面 9:16，封面完整显示不裁切。
 * 封面和视频本身比例一致，所以这也是视频的方向。
 */
export default function VideoThumb({ video, active = false, onSelect }) {
  const { url: posterUrl, loading, error } = useSignedUrl(video.poster);
  // 封面签名地址过期/加载失败时退回占位，别留一张碎图
  const [imgOk, setImgOk] = useState(true);
  useEffect(() => setImgOk(true), [posterUrl]);
  const placeholder = loading ? '封面加载中…' : error || !imgOk ? '封面不可用' : '暂无封面';

  return (
    <button
      type="button"
      onClick={() => onSelect?.(video)}
      className={`group block w-full self-start text-left transition ${
        active ? 'rounded-lg ring-2 ring-blue-500 ring-offset-2' : ''
      }`}
      aria-pressed={active}
    >
      {/* 不写死比例：让封面按自己的宽高比撑开盒子（h-auto），
          横版封面就是 16:9、竖版封面就是 9:16，永远完整显示。
          比「JS 探测方向再切 class」更稳——不依赖 onLoad 的触发时机 */}
      <div className="min-h-[120px] w-full overflow-hidden rounded-lg bg-black">
        {posterUrl && imgOk ? (
          <img
            src={posterUrl}
            alt={video.title}
            loading="lazy"
            className="block h-auto w-full"
            onError={() => setImgOk(false)}
          />
        ) : (
          <div className="flex aspect-[9/16] w-full items-center justify-center bg-slate-100 text-xs text-slate-400">
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
