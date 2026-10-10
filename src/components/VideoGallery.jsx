import { useMemo, useState } from 'react';
import VideoHero from './VideoHero';
import SectionGroup from './SectionGroup';

/** 把 videos 按 section 分组，分区顺序 = 首次出现顺序。 */
function groupBySection(videos) {
  const groups = [];
  const map = new Map();
  for (const v of videos) {
    if (!v.section) {
      // 缺 section 是配置错误，打日志并跳过
      console.error('视频配置错误：缺少 section 字段', v);
      continue;
    }
    if (!map.has(v.section)) {
      const g = { section: v.section, videos: [] };
      groups.push(g);
      map.set(v.section, g);
    }
    map.get(v.section).videos.push(v);
  }
  return groups;
}

export default function VideoGallery({ videos }) {
  if (!videos || videos.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
        暂无视频
      </div>
    );
  }

  const groups = useMemo(() => groupBySection(videos), [videos]);
  const [activeKey, setActiveKey] = useState(videos[0].key);
  const active = videos.find((v) => v.key === activeKey) || videos[0];

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
          {groups.map((g) => (
            <SectionGroup
              key={g.section}
              section={g.section}
              videos={g.videos}
              activeKey={activeKey}
              onSelect={select}
              layout="vertical"
            />
          ))}
        </div>
      </div>

      {/* 窄屏：上 hero，下 chips + 缩略横排 */}
      <div className="space-y-4 lg:hidden">
        <VideoHero key={active.key} video={active} autoplay />
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {groups.map((g) => {
            const isActive = g.videos.some((v) => v.key === activeKey);
            return (
              <button
                key={g.section}
                type="button"
                onClick={() => select(g.videos[0])}
                className={`shrink-0 rounded-full px-3 py-1 text-xs ${
                  isActive
                    ? 'bg-blue-50 font-medium text-blue-600'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {g.section}
              </button>
            );
          })}
        </div>
        {groups.map((g) =>
          g.videos.some((v) => v.key === activeKey) ? (
            <SectionGroup
              key={g.section}
              section={g.section}
              videos={g.videos}
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
