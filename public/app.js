// 简历站点前端：读取 resume.json 渲染页面，并向 Worker 换取签名后的视频播放地址

const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

boot();

async function boot() {
  let data;
  try {
    data = await fetch('./resume.json', { cache: 'no-cache' }).then((r) => {
      if (!r.ok) throw new Error(`resume.json ${r.status}`);
      return r.json();
    });
  } catch (e) {
    $('#content').innerHTML = `<div class="card">简历数据加载失败：${e.message}</div>`;
    return;
  }

  renderProfile(data.profile || {}, data.contacts || []);
  renderNav(data.videos, data.sections || []);

  const content = $('#content');
  if (Array.isArray(data.videos) && data.videos.length) {
    content.append(renderVideos(data.videos));
  }
  (data.sections || []).forEach((s) => content.append(renderSection(s)));

  renderFooter(data.profile || {});
}

/* ------------------------------ 渲染 ------------------------------ */

function renderProfile(profile, contacts) {
  document.title = profile.name ? `${profile.name} · ${profile.title || '个人简历'}` : '个人简历';

  const initial = (profile.name || '?').trim().slice(0, 1);
  const avatar = $('[data-avatar]');
  if (profile.avatar) {
    const img = el('img');
    img.src = profile.avatar;
    img.alt = profile.name || '头像';
    avatar.replaceChildren(img);
  } else {
    avatar.textContent = initial;
  }

  $('[data-name]').textContent = profile.name || '你的姓名';
  $('[data-title]').textContent = profile.title || '';

  const list = $('[data-contacts]');
  list.replaceChildren(
    ...contacts.map((c) => {
      const li = el('li');
      li.append(el('span', 'lab', `${c.label}：`));
      if (c.href) {
        const a = el('a', null, c.value);
        a.href = c.href;
        if (c.href.startsWith('http')) {
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
        }
        li.append(a);
      } else {
        li.append(document.createTextNode(c.value));
      }
      return li;
    }),
  );
}

function renderNav(videos, sections) {
  const nav = $('[data-nav]');
  const items = [
    ...(Array.isArray(videos) && videos.length ? [{ id: 'videos', title: '视频介绍' }] : []),
    ...sections.map((s) => ({ id: s.id, title: s.title })),
  ];
  nav.replaceChildren(
    ...items.map((i) => {
      const a = el('a', null, i.title);
      a.href = `#${i.id}`;
      return a;
    }),
  );

  const links = [...nav.querySelectorAll('a')];
  const spy = () => {
    const y = window.scrollY + 120;
    let active = links[0];
    links.forEach((a) => {
      const t = document.getElementById(a.getAttribute('href').slice(1));
      if (t && t.offsetTop <= y) active = a;
    });
    links.forEach((a) => a.classList.toggle('on', a === active));
  };
  addEventListener('scroll', spy, { passive: true });
  spy();
}

function renderSection(section) {
  const wrap = el('section', null);
  wrap.id = section.id;

  const card = el('div', 'card');
  card.append(el('h2', null, section.title || ''));

  if (section.summary) card.append(el('p', 'summary', section.summary));

  (section.items || []).forEach((it) => {
    const box = el('div', 'item');

    const head = el('div', 'item-head');
    head.append(el('span', 'item-title', it.title || ''));
    if (it.subtitle) head.append(el('span', 'item-sub', it.subtitle));
    if (it.period) head.append(el('span', 'item-period', it.period));
    box.append(head);

    if (it.meta) {
      const m = el('div', 'item-period', it.meta);
      m.style.marginLeft = '0';
      box.append(m);
    }

    if (Array.isArray(it.links) && it.links.length) {
      const p = el('div');
      it.links.forEach((l, i) => {
        if (i) p.append(' · ');
        const a = el('a', null, l.label);
        a.href = l.href;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        p.append(a);
      });
      box.append(p);
    }

    if (Array.isArray(it.bullets) && it.bullets.length) {
      const ul = el('ul');
      it.bullets.forEach((b) => ul.append(el('li', null, b)));
      box.append(ul);
    }

    if (Array.isArray(it.tags) && it.tags.length) {
      const tags = el('div', 'tags');
      it.tags.forEach((t) => tags.append(el('span', 'tag', t)));
      box.append(tags);
    }

    card.append(box);
  });

  wrap.append(card);
  return wrap;
}

function renderVideos(videos) {
  const wrap = el('section', null);
  wrap.id = 'videos';

  const card = el('div', 'card');
  card.append(el('h2', null, '视频介绍'));

  const grid = el('div', 'videos');
  videos.forEach((v) => grid.append(renderVideoCard(v)));
  card.append(grid);

  wrap.append(card);
  return wrap;
}

const isHls = (key) => /\.m3u8$/i.test((key || '').trim());

function renderVideoCard(video) {
  const box = el('div');

  if (video.title) box.append(el('h3', null, video.title));

  const frame = el('div', 'video-frame');
  const state = el('div', 'video-state');
  const media = el('video');
  media.controls = true;
  media.playsInline = true;
  media.preload = 'metadata';
  if (video.poster) media.poster = video.poster;

  let hls = null;

  const setState = (msg, retry) => {
    media.hidden = true;
    state.replaceChildren();
    if (msg) state.append(el('div', null, msg));
    if (retry) {
      const btn = el('button', null, '重新加载');
      btn.type = 'button';
      btn.onclick = () => load();
      state.append(btn);
    }
    state.hidden = false;
  };

  async function load() {
    setState('正在获取播放地址…', false);
    try {
      const res = await fetch(`/api/video?key=${encodeURIComponent(video.key)}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { url } = await res.json();

      if (isHls(video.key)) attachHls(url);
      else media.src = url;

      media.hidden = false;
      state.hidden = true;
      // 播放地址有有效期，失败时引导用户重新签发
      media.onerror = () => setState('视频加载失败或链接已过期', true);
    } catch (e) {
      setState(`播放地址获取失败：${e.message}`, true);
    }
  }

  /**
   * HLS 播放：桌面版 Chrome/Edge 不支持原生 HLS，需要 hls.js；
   * Safari / iOS 原生支持，直接用 video.src 即可（更省电）。
   */
  function attachHls(url) {
    if (hls) {
      hls.destroy();
      hls = null;
    }
    media.removeAttribute('src');
    if (window.Hls && window.Hls.isSupported()) {
      hls = new window.Hls({ enableWorker: true, backBufferLength: 30 });
      hls.on(window.Hls.Events.ERROR, (_evt, data) => {
        if (data.fatal) setState('视频加载失败或链接已过期', true);
      });
      hls.loadSource(url);
      hls.attachMedia(media);
    } else if (media.canPlayType('application/vnd.apple.mpegurl')) {
      media.src = url;
    } else {
      setState('当前浏览器不支持 HLS 播放', false);
    }
  }

  frame.append(media, state);
  box.append(frame);
  if (video.desc) box.append(el('p', 'video-desc', video.desc));

  load();
  return box;
}

function renderFooter(profile) {
  const year = new Date().getFullYear();
  $('[data-foot]').textContent = `© ${year} ${profile.name || ''} · Powered by Cloudflare Workers & R2`;
}
