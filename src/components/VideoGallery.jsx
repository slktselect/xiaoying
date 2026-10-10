import { useMemo, useState } from 'react';
import VideoHero from './VideoHero';
import VideoThumb from './VideoThumb';

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
      out.push({ ...v, section: s.title });
    }
  }
  return out;
}

/**
 * 视频介绍区：分区标签 + 大画面 + 当前分区的缩略列表。
 *
 * 布局（4 个视频都是竖版 9:16）：
 *   宽屏：左播放器按竖版比例收窄居中，右侧当前分区缩略 3 列；
 *   窄屏：上播放器（整宽 9:16），下分区标签 + 缩略 2 列。
 */
export default function VideoGallery({ sections }) {
  const usable = useMemo(
    () => (sections || []).filter((s) => (s.videos || []).length > 0),
    [sections],
  );
  const all = useMemo(() => flatten(sections), [sections]);
  const [activeKey, setActiveKey] = useState(all[0]?.key);

  const active = all.find((v) => v.key === activeKey) || all[0];
  if (!active) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
        暂无视频
      </div>
    );
  }

  // 当前视频落在哪个分区（点缩略图不换区，点标签换区）
  const activeSection =
    usable.find((s) => (s.videos || []).some((v) => v.key === active.key)) || usable[0];
  const activeVideos = activeSection.videos || [];

  const select = (v) => {
    if (v.key === active.key) return;
    setActiveKey(v.key);
  };
  const selectTab = (s) => {
    const first = (s.videos || [])[0];
    if (first) select(first);
  };

  // 分区标签（只有一个分区时不占地方）
  const tabs =
    usable.length > 1 ? (
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {usable.map((s) => {
          const on = s === activeSection;
          return (
            <button
              key={s.title}
              type="button"
              onClick={() => selectTab(s)}
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

  const desc = activeSection.desc ? (
    <p className="px-1 text-xs leading-relaxed text-slate-500">{activeSection.desc}</p>
  ) : null;

  // 竖版 9:16 缩略卡：完整显示封面，不再裁切
  const thumbs = (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {activeVideos.map((v) => (
        <VideoThumb key={v.key} video={v} active={v.key === active.key} onSelect={select} />
      ))}
    </div>
  );

  return (
    <>
      {tabs}

      {/* 宽屏：左 2/5 播放器（竖版收窄居中）+ 右 3/5 当前分区列表 */}
      <div className="hidden items-start gap-6 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* key 触发 hero 重建，释放旧 hls.js 实例 */}
        <VideoHero key={active.key} video={active} autoplay />
        <div>
          {desc}
          <div className={desc ? 'mt-3' : ''}>{thumbs}</div>
        </div>
      </div>

      {/* 窄屏：上播放器，下当前分区缩略 */}
      <div className="space-y-3 lg:hidden">
        <VideoHero key={active.key} video={active} autoplay />
        {desc}
        {thumbs}
      </div>
    </>
  );
}
