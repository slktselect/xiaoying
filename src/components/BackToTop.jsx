import { useEffect, useState } from 'react';

/**
 * 回到顶部按钮：页面很长（视频区 + 多个正文分区），滚过一屏后才出现。
 * 位置在「分享」按钮正上方，两者不重叠；打印时隐藏。
 */
export default function BackToTop() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setShow(window.scrollY > 600);
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const toTop = () => {
    // 系统开了「减少动态效果」就直接跳，不做平滑滚动
    const reduce =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  };

  return (
    <button
      type="button"
      onClick={toTop}
      aria-label="回到顶部"
      className={`no-print fixed right-5 z-40 grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-lg transition hover:text-blue-600 ${
        show ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
      }`}
      style={{ bottom: 'calc(1.25rem + 3.25rem + env(safe-area-inset-bottom, 0px))' }}
    >
      {/* Material arrow_upward */}
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path
          fill="currentColor"
          d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z"
        />
      </svg>
    </button>
  );
}
