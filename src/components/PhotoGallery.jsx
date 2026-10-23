import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

/** 进入全屏的四角图标 */
function ExpandIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M16 3h3a2 2 0 0 1 2 2v3" />
      <path d="M21 16v3a2 2 0 0 1-2 2h-3" />
      <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
    </svg>
  );
}

/** 关闭叉号 */
function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/**
 * 横向滑动手势（移动端）。
 * 手指向左滑 → 下一张，向右滑 → 上一张。
 * 阈值 44px，且要求横向位移明显大于纵向，避免和竖向滚动抢手势。
 *
 * movedAt 记录"刚刚滑动过"的时间戳（毫秒）。滑动结束后浏览器会补发一次 click，
 * 调用方用 `Date.now() - movedAt.current < 400` 把这次 click 吞掉，
 * 超过 400ms 的正常点击不受影响（比起布尔标志，不会误吞下一次真实点击）。
 */
function useSwipe({ onNext, onPrev, threshold = 44 }) {
  const startRef = useRef(null);
  const movedAt = useRef(0);

  const onTouchStart = (e) => {
    if (e.touches.length !== 1) {
      startRef.current = null;
      return;
    }
    const t = e.touches[0];
    startRef.current = { x: t.clientX, y: t.clientY };
  };

  const onTouchEnd = (e) => {
    const s = startRef.current;
    startRef.current = null;
    if (!s || !e.changedTouches.length) return;

    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.3) return;

    movedAt.current = Date.now();
    if (dx < 0) onNext && onNext();
    else onPrev && onPrev();
  };

  return { onTouchStart, onTouchEnd, movedAt };
}

/**
 * 左右箭头的渐进式自动隐藏。
 *
 * 出现（或重新出现）后静置 delay 毫秒开始淡出，淡出由 CSS transition 完成；
 * 鼠标移动 / 触摸 / 切图时 reveal() 再淡入并重新计时。
 * 隐藏时加 pointer-events-none，避免看不见的按钮挡住"点大图进全屏"。
 */
function useAutoHide(delay = 1000) {
  const [visible, setVisible] = useState(true);
  const timer = useRef(null);

  const clear = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const reveal = useCallback(() => {
    setVisible(true);
    clear();
    timer.current = setTimeout(() => setVisible(false), delay);
  }, [clear, delay]);

  useEffect(() => {
    reveal();
    return clear;
  }, [reveal, clear]);

  return { visible, reveal };
}

/**
 * 箭头按钮的淡入淡出类名（配合按钮上已有的 transition）。
 *
 * 桌面和触屏都隐藏：触屏上静置 1 秒后箭头淡出，靠左右滑动切图，
 * 切完图（activeIdx 变化）会再淡入一次给出反馈。
 */
function fadeArrow(visible) {
  return `duration-700 ease-out motion-reduce:transition-none focus-visible:opacity-100 focus-visible:pointer-events-auto ${
    visible ? 'opacity-100' : 'pointer-events-none opacity-0'
  }`;
}

/** 分类标签：大图区和全屏层共用，dark 版给全屏的深色底用 */
function CatTabs({ categories, active, onSelect, dark = false, className = '' }) {
  if (!categories || categories.length < 2) return null;

  return (
    <div
      className={`flex gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
        dark ? 'justify-start sm:justify-center' : ''
      } ${className}`}
    >
      {categories.map((s, i) => {
        const on = i === active;
        const tone = dark
          ? on
            ? 'bg-white/90 font-medium text-slate-900'
            : 'bg-white/15 text-white/80 hover:bg-white/25'
          : on
            ? 'bg-blue-50 font-medium text-blue-600'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200';
        return (
          <button
            key={s.title}
            type="button"
            onClick={() => onSelect(i)}
            className={`no-print shrink-0 snap-start rounded-full px-3.5 py-2 text-sm transition sm:py-1.5 ${tone}`}
            aria-pressed={on}
          >
            {s.title}
          </button>
        );
      })}
    </div>
  );
}

/** 旋转到横屏的图标（横向照片在竖屏下用） */
function RotateIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-2.6-6.4" />
      <path d="M21 3.5V9h-5.5" />
    </svg>
  );
}


/** 预加载相邻照片，滑动/切图时不再等签名 URL */
function NeighborImage({ photoKey }) {
  const { url } = useSignedUrl(photoKey);
  useEffect(() => {
    if (!url) return undefined;
    const img = new Image();
    img.src = url;
    return undefined;
  }, [url]);
  return null;
}

/**
 * 全屏预览（lightbox）。
 *
 * 交互约定与 ShareButton 的弹层一致：fixed inset-0 + 深色遮罩、点空白关闭、
 * Esc 关闭；额外支持左右方向键、左右箭头按钮、手指左右滑动。
 * 另外：手指下滑退出、底部可直接切换分类、横向照片可一键转横屏并铺满。
 * 打开期间锁 body 滚动，顶部/底部留出刘海与横条的安全区。
 */
function Lightbox({ categories, catIdx, onSelectCat, photos, index, onChange, onClose }) {
  const photo = photos[index];
  const { url, loading, error } = useSignedUrl(photo ? photo.key : '');
  const closeRef = useRef(null);
  const rootRef = useRef(null);
  const many = photos.length > 1;
  const category = categories && categories[catIdx];

  // 当前照片的宽高比（用来判断横图，并据此决定留白与"转横屏"入口）
  const [ratio, setRatio] = useState(0);
  // 手指下滑的位移，用于跟手拖动 + 松手判定
  const [dragY, setDragY] = useState(0);
  const [portrait, setPortrait] = useState(
    () => typeof window === 'undefined' || window.innerHeight >= window.innerWidth,
  );
  const gest = useRef({ x: 0, y: 0, dx: 0, dy: 0, active: false, movedAt: 0 });

  const photoKey = photo ? photo.key : '';
  useEffect(() => {
    setRatio(0);
  }, [photoKey]);

  // 锁滚动：全屏时背景不能跟着滑（移动端尤其明显）
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // 键盘：Esc 关闭，左右切图；打开时焦点落到关闭按钮
  useEffect(() => {
    if (closeRef.current) closeRef.current.focus({ preventScroll: true });
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (!many) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onChange(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onChange(1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [many, onChange, onClose]);

  // 朝向变化：横竖屏决定要不要给"转横屏"入口
  useEffect(() => {
    const onResize = () => setPortrait(window.innerHeight >= window.innerWidth);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  // 箭头静置 1 秒淡出；触摸 / 移动鼠标 / 切图 / 切分类后淡入
  const arrows = useAutoHide(1000);
  useEffect(() => {
    arrows.reveal();
  }, [index, catIdx, arrows.reveal]);

  const onTouchStart = (e) => {
    arrows.reveal();
    if (e.touches.length !== 1) {
      gest.current.active = false;
      return;
    }
    const t = e.touches[0];
    gest.current = { x: t.clientX, y: t.clientY, dx: 0, dy: 0, active: true, movedAt: 0 };
  };

  const onTouchMove = (e) => {
    const g = gest.current;
    if (!g.active || e.touches.length !== 1) return;
    const t = e.touches[0];
    g.dx = t.clientX - g.x;
    g.dy = t.clientY - g.y;
    // 往下拖且明显是竖向：跟手移动，松手超过阈值就退出
    if (g.dy > 0 && Math.abs(g.dy) > Math.abs(g.dx) * 1.1) {
      g.movedAt = Date.now();
      setDragY(Math.min(g.dy * 0.85, 260));
    }
  };

  const onTouchEnd = () => {
    const g = gest.current;
    if (!g.active) return;
    g.active = false;
    setDragY(0);

    const vertical = Math.abs(g.dy) > Math.abs(g.dx) * 1.1;
    if (g.dy > 110 && vertical) {
      g.movedAt = Date.now();
      onClose(); // 下滑退出全屏
      return;
    }
    if (many && !vertical && Math.abs(g.dx) >= 44) {
      g.movedAt = Date.now();
      if (g.dx < 0) onChange(1);
      else onChange(-1);
    }
  };

  const landscapePhoto = ratio > 1.05;
  const canLockOrientation =
    typeof screen !== 'undefined' &&
    !!screen.orientation &&
    typeof screen.orientation.lock === 'function';
  // 横向照片 + 竖屏：给一个"转横屏"入口（能锁方向就锁，锁不了让用户自己转）
  const showRotate = landscapePhoto && portrait && canLockOrientation;

  const rotateToLandscape = async () => {
    try {
      if (rootRef.current && rootRef.current.requestFullscreen && !document.fullscreenElement) {
        await rootRef.current.requestFullscreen();
      }
    } catch {
      /* iOS Safari 不支持元素级全屏，忽略 */
    }
    try {
      await screen.orientation.lock('landscape');
    } catch {
      /* 不支持就手动转屏 */
    }
  };

  if (!photo) return null;

  const prevKey = many ? photos[(index - 1 + photos.length) % photos.length].key : '';
  const nextKey = many ? photos[(index + 1) % photos.length].key : '';

  return (
    <div
      ref={rootRef}
      className="no-print fixed inset-0 z-[70] flex flex-col bg-slate-950/95 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="全屏预览照片"
    >
      {/* 顶栏：标题 + 转横屏 + 关闭（手机横过来时浮在照片上方，把高度让给照片） */}
      <div
        className="lb-bar lb-bar-top flex shrink-0 items-center gap-3 px-3 pb-1"
        style={{
          paddingTop: 'calc(0.5rem + env(safe-area-inset-top, 0px))',
          paddingLeft: 'max(0.75rem, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(0.75rem, env(safe-area-inset-right, 0px))',
        }}
      >
        <p className="min-w-0 flex-1 truncate text-sm text-white/85">{photo.title}</p>
        {showRotate && (
          <button
            type="button"
            onClick={rotateToLandscape}
            aria-label="横屏查看"
            title="横屏查看"
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-3 text-xs text-white transition hover:bg-white/25"
          >
            <RotateIcon />
            横屏
          </button>
        )}
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="退出全屏"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <CloseIcon />
        </button>
      </div>

      {/* 图片区：点空白关闭；横滑切图、下滑退出全屏 */}
      <div
        className={`relative flex min-h-0 flex-1 touch-none items-center justify-center overflow-hidden overscroll-contain ${
          landscapePhoto ? 'sm:px-4' : 'sm:px-14'
        }`}
        style={{
          transform: dragY ? `translateY(${dragY}px) scale(${1 - dragY / 2600})` : undefined,
          transition: dragY ? 'none' : 'transform 220ms ease-out',
          paddingLeft: 'max(0.25rem, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(0.25rem, env(safe-area-inset-right, 0px))',
        }}
        onMouseMove={arrows.reveal}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={(e) => {
          // 刚滑动/拖动过，浏览器补发的那次 click 不算点击
          if (Date.now() - gest.current.movedAt < 400) return;
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {url ? (
          <img
            src={url}
            alt={photo.title}
            draggable={false}
            onLoad={(e) => {
              const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
              if (w && h) setRatio(w / h);
            }}
            className="max-h-full max-w-full select-none object-contain"
          />
        ) : (
          <p className="text-sm text-white/60">
            {loading ? '照片加载中…' : error ? '照片不可用' : '暂无照片'}
          </p>
        )}

        {many && (
          <>
            <button
              type="button"
              onClick={() => onChange(-1)}
              aria-label="上一张"
              className={`absolute left-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/35 text-white/90 transition hover:bg-black/55 sm:left-4 ${fadeArrow(
                arrows.visible,
              )}`}
            >
              <Arrow dir="left" />
            </button>
            <button
              type="button"
              onClick={() => onChange(1)}
              aria-label="下一张"
              className={`absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/35 text-white/90 transition hover:bg-black/55 sm:right-4 ${fadeArrow(
                arrows.visible,
              )}`}
            >
              <Arrow dir="right" />
            </button>
          </>
        )}
      </div>

      {/* 底栏：分类切换 + 序号 + 拍摄设备（手机横过来时浮在照片上方） */}
      <div
        className="lb-bar lb-bar-bottom shrink-0 px-3 pt-1 text-center"
        style={{
          paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))',
          paddingLeft: 'max(0.75rem, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(0.75rem, env(safe-area-inset-right, 0px))',
        }}
      >
        <CatTabs
          categories={categories}
          active={catIdx}
          onSelect={onSelectCat}
          dark
          className="mb-2"
        />
        <p className="text-xs tabular-nums text-white/70">
          {index + 1} / {photos.length}
          <span className="ml-2 text-white/35 sm:hidden">
            {many ? '左右滑切换 · 下滑退出' : '下滑退出'}
          </span>
        </p>
        {category && category.device && (
          <p className="mt-0.5 truncate text-xs text-white/45">拍摄设备：{category.device}</p>
        )}
      </div>

      {prevKey && <NeighborImage photoKey={prevKey} />}
      {nextKey && <NeighborImage photoKey={nextKey} />}
    </div>
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
            decoding="async"
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
 * 摄影作品区：分类标签 + 大图预览 + 缩略图网格 + 全屏预览。
 *
 * 布局与视频区一致：
 *   宽屏：左大图（按照片自身比例，限高 65vh），右分类标签 + 缩略图；
 *   窄屏：上大图，下标签 + 缩略图（块级自然堆叠）。
 *
 * 全屏：点大图或右上角四角图标进入；全屏内可左右方向键、箭头按钮、手指横滑切换，
 * 手指下滑退出，底部还能直接切分类；横向照片给"横屏"入口并铺满屏幕。
 * Esc / 关闭按钮 / 点空白退出。
 *
 * 左右箭头静置 1 秒后淡出（700ms 过渡），鼠标移动 / 触摸 / 切图 / 切分类 / 滚入视口时淡入；
 * 触屏同样隐藏，靠左右滑动切图，切完图箭头会再淡入一次。
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
  const [full, setFull] = useState(false);

  // 索引夹紧：分类被热更新删掉时不至于越界（同时保证 hooks 顺序稳定）
  const activeCat = usable[Math.min(catIdx, Math.max(usable.length - 1, 0))];
  const photos = (activeCat && activeCat.photos) || [];
  const activeIdx = Math.min(photoIdx, Math.max(photos.length - 1, 0));
  const active = photos[activeIdx];

  const { url: heroUrl, loading, error } = useSignedUrl(active ? active.key : '');

  // 分类数量变化（如配置热更新删了分类）时收紧越界索引
  useEffect(() => {
    if (catIdx > usable.length - 1) {
      setCatIdx(0);
      setPhotoIdx(0);
    }
  }, [usable.length, catIdx]);

  const go = useCallback(
    (delta) => {
      if (photos.length > 1) setPhotoIdx((i) => (i + delta + photos.length) % photos.length);
    },
    [photos.length],
  );

  const openFull = useCallback(() => setFull(true), []);
  const closeFull = useCallback(() => setFull(false), []);

  // 大图区域也支持左右滑动（移动端最直觉的操作）
  const swipe = useSwipe({ onNext: () => go(1), onPrev: () => go(-1) });

  // 箭头静置 1 秒淡出；移动鼠标 / 触摸 / 切图 / 滚到这一屏后淡入
  const arrows = useAutoHide(1000);
  const heroRef = useRef(null);
  useEffect(() => {
    arrows.reveal();
  }, [activeIdx, arrows.reveal]);
  useEffect(() => {
    const el = heroRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((en) => en.isIntersecting)) arrows.reveal();
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [arrows.reveal]);

  // 键盘左右方向键切换照片（输入框聚焦时不劫持；全屏时交给 Lightbox 自己处理）
  useEffect(() => {
    const onKey = (e) => {
      if (full) return;
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, full]);

  if (!usable.length || !active) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
        暂无照片
      </div>
    );
  }

  const selectPhoto = (p) => setPhotoIdx(photos.indexOf(p));
  const selectCat = (i) => {
    setCatIdx(i);
    setPhotoIdx(0);
  };

  return (
    <div className="lg:grid lg:items-start lg:gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      {/* 左：大图 + 照片信息 */}
      <div>
        <div
          ref={heroRef}
          className="relative"
          onMouseEnter={arrows.reveal}
          onMouseMove={arrows.reveal}
          onFocusCapture={arrows.reveal}
        >
          <button
            type="button"
            onClick={() => {
              // 滑动结束后浏览器会补发一次 click，别把它当成"点开全屏"
              if (Date.now() - swipe.movedAt.current < 400) return;
              openFull();
            }}
            aria-label={`全屏查看 ${active.title}`}
            className="block w-full cursor-zoom-in select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            onTouchStart={(e) => {
              swipe.onTouchStart(e);
              arrows.reveal();
            }}
            onTouchEnd={swipe.onTouchEnd}
          >
            <div className="flex min-h-[220px] w-full touch-pan-y items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100 sm:min-h-[280px]">
              {heroUrl ? (
                <img
                  src={heroUrl}
                  alt={active.title}
                  draggable={false}
                  className="max-h-[60vh] w-auto max-w-full sm:max-h-[65vh]"
                />
              ) : (
                <p className="text-sm text-slate-400">
                  {loading ? '照片加载中…' : error ? '照片不可用' : '暂无照片'}
                </p>
              )}
            </div>
          </button>

          {/* 全屏入口（打印时隐藏） */}
          <button
            type="button"
            onClick={openFull}
            aria-label="全屏查看"
            title="全屏查看"
            className="no-print absolute right-2 top-2 grid h-10 w-10 place-items-center rounded-full bg-white/80 text-slate-700 shadow-md transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <ExpandIcon />
          </button>

          {/* 左右切换按钮（打印时隐藏；静置 1 秒后淡出） */}
          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="上一张"
                className={`no-print absolute left-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-slate-700 shadow-md transition hover:bg-white sm:left-2 sm:h-10 sm:w-10 ${fadeArrow(
                  arrows.visible,
                )}`}
              >
                <Arrow dir="left" />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label="下一张"
                className={`no-print absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-slate-700 shadow-md transition hover:bg-white sm:right-2 sm:h-10 sm:w-10 ${fadeArrow(
                  arrows.visible,
                )}`}
              >
                <Arrow dir="right" />
              </button>
            </>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-1">
          <p className="font-medium text-slate-900">{active.title}</p>
          <p className="text-xs tabular-nums text-slate-500">
            {activeIdx + 1} / {photos.length}
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
        <CatTabs categories={usable} active={catIdx} onSelect={selectCat} className="mb-3" />
        <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
          {photos.map((p) => (
            <PhotoThumb key={p.key} photo={p} active={p === active} onSelect={selectPhoto} />
          ))}
        </div>
      </div>

      {full && (
        <Lightbox
          categories={usable}
          catIdx={catIdx}
          onSelectCat={selectCat}
          photos={photos}
          index={activeIdx}
          onChange={go}
          onClose={closeFull}
        />
      )}
    </div>
  );
}
