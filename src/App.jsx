import { useEffect, useMemo } from 'react';
import resume from './resume.config.js';
import Hero from './components/Hero.jsx';
import Nav from './components/Nav.jsx';
import VideoCard from './components/VideoCard.jsx';
import Section from './components/Section.jsx';
import ShareButton from './components/ShareButton.jsx';

export default function App() {
  const { profile = {}, contacts = [], videos = [], sections = [], share, footer } = resume;

  const visibleVideos = useMemo(() => videos.filter((v) => !v.hidden), [videos]);
  const visibleSections = useMemo(() => sections.filter((s) => !s.hidden), [sections]);
  const navItems = useMemo(
    () => [
      ...(visibleVideos.length ? [{ id: 'videos', title: '视频介绍' }] : []),
      ...visibleSections.map((s) => ({ id: s.id, title: s.title })),
    ],
    [visibleVideos, visibleSections],
  );

  useEffect(() => {
    document.title = profile.name
      ? `${profile.name} · ${profile.title || '个人简历'}`
      : '个人简历';
  }, [profile.name, profile.title]);

  const footText =
    footer?.text ||
    `© ${new Date().getFullYear()} ${profile.name || ''} · Powered by Cloudflare Workers & R2`;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <Hero profile={profile} contacts={contacts} />
      <Nav items={navItems} />

      <main className="mx-auto w-full max-w-3xl px-4 pb-10 sm:pb-16">
        {visibleVideos.length > 0 && (
          <section id="videos" className="scroll-mt-20 pt-8">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">视频介绍</h2>
            {visibleVideos.map((v) => (
              <VideoCard key={`${v.key}-${v.title}`} video={v} />
            ))}
          </section>
        )}

        {visibleSections.map((s) => (
          <Section key={s.id} section={s} />
        ))}
      </main>

      {/* 底部留出分享按钮的高度，免得它压住页脚 */}
      <footer className="no-print border-t border-slate-200 px-4 pt-8 pb-24 text-center text-xs text-slate-400 sm:pb-8">
        {footText}
      </footer>

      {share?.enabled !== false && <ShareButton config={share} />}
    </div>
  );
}
