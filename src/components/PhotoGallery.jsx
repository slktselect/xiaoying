import { useEffect, useMemo, useState } from 'react';
import useSignedUrl from './useSignedUrl';

/** 相机小图标（拍摄设备行用） */
function CameraIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5 shrink-0"
      aria-hidden="true"
    >
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

/** 左右切换用的箭头 */
function Arrow({ dir = 'left' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      {dir === 'left' ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}
    </svg>
  );
}

/**
 * 缩略卡：方形裁切 + 点击切换大图。
 * photo.key 存的是 R2 对象 key（photos/<分类>/<序号>.jpg），先换签名 URL 再显示。
 */
function PhotoThumb({ photo, active = false, onSelect }) {
  const { url, loading, error } = useSignedUrl(photo.key);
  const placeholder = loading ? '加载中…' : error ? '不可用' : '暂无';

  return (
    <button
      type="button"
      onClick={() => onSelect(photo)}
      className={`group block w-full text-left transition ${
        active ? 'rounded-lg ring-2 ring-blue-500 ring-offset-2' : ''
      }`}
      aria-pressed={active}
      title={photo.title}
    >
      <div className="aspect-square w-full overflow-hidden rounded-lg bg-slate-100">
        {url ? (
          <img
            src={url}
            alt={photo.title}
            loading="lazy"
            className="block h-full w-full object-cover transition group-hover:opacity-85"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-slate-400">
            {placeholder}
          </div>
        )}
      </div>
    </button>
  );
}

/**
 * 摄影作品区：分类标签 + 大图预览 + 缩略图网格。
 *
 * 布局与视频区一致：
 *   宽屏：左大图（按照片自身比例，限高 65vh），右分类标签 + 缩略图；
 *   窄屏：上大图，下标签 + 缩略图（块级自然堆叠）。
 *
 * 照片存在 R2，经 Worker 的 /api/video 签发短期签名 URL 后加载（防盗链同视频）。
 */
export default function PhotoGallery({ sections }) {
  const usable = useMemo(
    () => (sections || []).filter((s) => (s.photos || []).length > 0),
    [sections],
  );
  const [catIdx, setCatIdx] = useState(0);
  const [photoIdx, setPhotoIdx] = useState(0);

  // 分类数量变化（如配置热更新删了分类）时收紧越界索引
  useEffect(() => {
    if (catIdx > usable.length - 1) {
      setCatIdx(0);
      setPhotoIdx(0);
    }
  }, [usable.length, catIdx]);

  if (!usable.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
        暂无照片
      </div>
    );
  }

  const activeCat = usable[catIdx];
  const photos = activeCat.photos || [];
  const active = photos[Math.min(photoIdx, photos.length - 1)] || photos[0];

  const selectPhoto = (p) => setPhotoIdx(photos.indexOf(p));
  const selectCat = (i) => {
    setCatIdx(i);
    setPhotoIdx(0);
  };
  const go = (delta) => {
    if (photos.length > 1) setPhotoIdx((i) => (i + delta + photos.length) % photos.length);
  };

  // 键盘左右方向键切换照片（输入框聚焦时不劫持）
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // go 只依赖 photos.length，分类切换时靠 catIdx 重建闭包
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catIdx, photos.length]);

  const { url: heroUrl, loading, error } = useSignedUrl(active.key);

  const tabs =
    usable.length > 1 ? (
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {usable.map((s, i) => {
          const on = i === catIdx;
          return (
            <button
              key={s.title}
              type="button"
              onClick={() => selectCat(i)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm transition ${
                on
                  ? 'bg-blue-50 font-medium text-blue-600'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
              aria-pressed={on}
            >
              {s.title}
            </button>
          );
        })}
      </div>
    ) : null;

  return (
    <div className="lg:grid lg:items-start lg:gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      {/* 左：大图 + 照片信息 */}
      <div>
        <div className="relative">
          <div className="flex min-h-[280px] w-full items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
            {heroUrl ? (
              <img
                src={heroUrl}
                alt={active.title}
                className="max-h-[65vh] w-auto max-w-full"
              />
            ) : (
              <p className="text-sm text-slate-400">
                {loading ? '照片加载中…' : error ? '照片不可用' : '暂无照片'}
              </p>
            )}
          </div>

          {/* 左右切换按钮（打印时隐藏） */}
          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="上一张"
                className="no-print absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/85 p-2 text-slate-700 shadow-md transition hover:bg-white"
              >
                <Arrow dir="left" />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label="下一张"
                className="no-print absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/85 p-2 text-slate-700 shadow-md transition hover:bg-white"
              >
                <Arrow dir="right" />
              </button>
            </>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-1">
          <p className="font-medium text-slate-900">{active.title}</p>
          <p className="text-xs text-slate-500">
            {photos.indexOf(active) + 1} / {photos.length}
          </p>
        </div>
        {activeCat.device && (
          <p className="mt-1 flex items-center gap-1.5 px-1 text-xs text-slate-500">
            <CameraIcon />
            拍摄设备：{activeCat.device}
          </p>
        )}
      </div>

      {/* 右：分类标签 + 缩略图网格 */}
      <div className="mt-4 lg:mt-0">
        {tabs}
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((p) => (
            <PhotoThumb key={p.key} photo={p} active={p === active} onSelect={selectPhoto} />
          ))}
        </div>
      </div>
    </div>
  );
}
