import { useEffect, useState } from 'react';

export default function Nav({ items }) {
  const [active, setActive] = useState(items[0]?.id);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY + 120;
      let cur = items[0]?.id;
      items.forEach((i) => {
        const t = document.getElementById(i.id);
        if (t && t.offsetTop <= y) cur = i.id;
      });
      setActive(cur);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
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
