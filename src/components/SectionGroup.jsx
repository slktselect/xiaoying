import VideoThumb from './VideoThumb';

/**
 * 单个分区的缩略卡容器。
 * layout=vertical：宽屏用，垂直堆叠。
 * layout=horizontal：窄屏用，横向滚动。
 */
export default function SectionGroup({
  title,
  desc = '',
  videos,
  activeKey,
  onSelect,
  layout = 'vertical',
}) {
  return (
    <div>
      <h3 className="px-1 text-sm font-semibold text-slate-700">{title}</h3>
      {desc && (
        <p className="mt-1 px-1 text-xs leading-relaxed text-slate-500">{desc}</p>
      )}
      <div
        className={
          layout === 'vertical'
            ? 'mt-2 space-y-2'
            : 'mt-2 flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
        }
      >
        {videos.map((v) => (
          <div key={v.key} className={layout === 'vertical' ? '' : 'w-40 shrink-0'}>
            <VideoThumb
              video={v}
              active={v.key === activeKey}
              onSelect={onSelect}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
