import { useEffect, useState } from 'react';

export default function Nav({ items }) {
  const [active, setActive] = useState(items[0]?.id);

  useEffect(() => {
    let raf = 0;
    const measure = () => {
      raf = 0;
      const line = 120; // 吸顶导航栏高度 + 一点余量
      let cur = items[0]?.id;
      items.forEach((i) => {
        const el = document.getElementById(i.id);
        // 用 getBoundingClientRect：offsetTop 相对定位父级，容器一变就漂移
        if (el && el.getBoundingClientRect().top <= line) cur = i.id;
      });
      // 滚到页面底部时高亮最后一项，否则最后一段永远点不亮
      if (
        items.length &&
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4
      ) {
        cur = items[items.length - 1].id;
      }
      setActive(cur);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [items]);

  if (!items.length) return null;

  return (
    <nav className="no-print sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur">
      {/* 分区多时可横向滑动；滚动条隐藏，点击区域放大到 40px 以上便于手指点按 */}
      <div className="mx-auto flex w-full max-w-3xl gap-1 overflow-x-auto px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((i) => (
          <a
            key={i.id}
            href={`#${i.id}`}
            className={`shrink-0 rounded-full px-3.5 py-2 text-sm transition ${
              active === i.id
                ? 'bg-blue-50 font-medium text-blue-600'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {i.title}
          </a>
        ))}
      </div>
    </nav>
  );
}
