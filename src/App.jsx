import { useEffect, useMemo } from 'react';
import resume from './resume.config.js';
import Hero from './components/Hero.jsx';
import Nav from './components/Nav.jsx';
import VideoGallery from './components/VideoGallery.jsx';
import Section from './components/Section.jsx';
import ShareButton from './components/ShareButton.jsx';
import BackToTop from './components/BackToTop.jsx';

/** 按 attr/key 找或建一个 <meta>，并写入 content（SEO / 分享卡片用） */
function upsertMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export default function App() {
  const { profile = {}, contacts = [], sections = [], share, footer, videoGallery } = resume;
  // sections 字段有两类：
  //   1) 旧版：[{id, title, items: [...]}, ...] —— 正文分区（id 必填）
  //   2) 新版（视频嵌套）：[{title, desc, videos: [...]}, ...] —— 视频分区（id 缺省，videos 必填）
  // 用 'videos' 字段是否存在来区分
  const videoSections = useMemo(
    () => (sections || []).filter((s) => Array.isArray(s.videos)),
    [sections],
  );
  const pageSections = useMemo(
    () => (sections || []).filter((s) => !Array.isArray(s.videos) && !s.hidden),
    [sections],
  );

  const hasVideos = videoSections.some((s) => (s.videos || []).length > 0);
  const navItems = useMemo(
    () => [
      ...(hasVideos ? [{ id: 'videos', title: '视频介绍' }] : []),
      ...pageSections.map((s) => ({ id: s.id, title: s.title })),
    ],
    [hasVideos, pageSections],
  );

  // 标题与 SEO meta 都由配置驱动：改 resume.config.js 即同步搜索引擎 / 微信分享卡片
  useEffect(() => {
    const title = profile.name
      ? `${profile.name} · ${profile.title || '个人简历'}`
      : '个人简历';
    document.title = title;

    const desc = (profile.summary || '个人在线简历').trim();
    upsertMeta('name', 'description', desc);
    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', desc);
    upsertMeta('property', 'og:type', 'profile');
    if (typeof location !== 'undefined') {
      upsertMeta('property', 'og:url', location.origin + location.pathname);
    }
  }, [profile.name, profile.title, profile.summary]);

  const footText =
    footer?.text ||
    `© ${new Date().getFullYear()} ${profile.name || ''} · Powered by Cloudflare Workers & R2`;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <Hero profile={profile} contacts={contacts} />
      <Nav items={navItems} />

      <main className="mx-auto w-full max-w-5xl px-4 pb-10 sm:pb-16">
        {hasVideos && (
          <section id="videos" className="scroll-mt-20 pt-8">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">视频介绍</h2>
            <VideoGallery sections={videoSections} autoNext={videoGallery?.autoNext === true} />
          </section>
        )}

        {pageSections.map((s) => (
          <Section key={s.id} section={s} />
        ))}
      </main>

      {/* 底部留出分享按钮的高度，免得它压住页脚 */}
      <footer className="no-print border-t border-slate-200 px-4 pt-8 pb-24 text-center text-xs text-slate-400 sm:pb-8">
        {footText}
      </footer>

      {share?.enabled !== false && <ShareButton config={share} />}
      <BackToTop />
    </div>
  );
}
