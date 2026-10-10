import { useState } from 'react';
import VideoHero from './VideoHero';
import SectionGroup from './SectionGroup';

/** 拍平 sections 得到所有 video（保持分区顺序）。 */
function flatten(sections) {
  const out = [];
  for (const s of sections || []) {
    if (!s || !s.title) {
      console.error('section 配置错误：缺少 title 字段', s);
      continue;
    }
    for (const v of s.videos || []) {
      if (!v || !v.key) {
        console.error(`section "${s.title}" 下的视频缺少 key`, v);
        continue;
      }
      out.push({ ...v, _section: s.title });
    }
  }
  return out;
}

export default function VideoGallery({ sections }) {
  if (!sections || sections.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
        暂无视频
      </div>
    );
  }

  const all = flatten(sections);
  if (all.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
        暂无视频
      </div>
    );
  }

  const [activeKey, setActiveKey] = useState(all[0].key);
  const active = all.find((v) => v.key === activeKey) || all[0];

  const select = (v) => {
    if (v.key === activeKey) return;
    setActiveKey(v.key);
  };

  return (
    <>
      {/* 宽屏（lg+）：左 2/3 hero + 右 1/3 分区列表 */}
      <div className="hidden lg:grid lg:grid-cols-3 lg:gap-6">
        <div className="lg:col-span-2">
          {/* key 触发 hero 重建，释放旧 hls.js 实例 */}
          <VideoHero key={active.key} video={active} autoplay />
        </div>
        <div className="space-y-5 overflow-y-auto pr-1 lg:max-h-[80vh]">
          {sections.map((s) => (
            <SectionGroup
              key={s.title}
              title={s.title}
              desc={s.desc}
              videos={s.videos || []}
              activeKey={activeKey}
              onSelect={select}
              layout="vertical"
            />
          ))}
        </div>
      </div>

      {/* 窄屏：上 hero，下 chips + 当前分区的 desc + 缩略横排 */}
      <div className="space-y-4 lg:hidden">
        <VideoHero key={active.key} video={active} autoplay />
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {sections.map((s) => {
            const isActive = (s.videos || []).some((v) => v.key === activeKey);
            return (
              <button
                key={s.title}
                type="button"
                onClick={() => select((s.videos || [])[0])}
                className={`shrink-0 rounded-full px-3 py-1 text-xs ${
                  isActive
                    ? 'bg-blue-50 font-medium text-blue-600'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {s.title}
              </button>
            );
          })}
        </div>
        {sections.map((s) =>
          (s.videos || []).some((v) => v.key === activeKey) ? (
            <SectionGroup
              key={s.title}
              title={s.title}
              desc={s.desc}
              videos={s.videos || []}
              activeKey={activeKey}
              onSelect={select}
              layout="horizontal"
            />
          ) : null
        )}
      </div>
    </>
  );
}
