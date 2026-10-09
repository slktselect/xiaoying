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
  renderShare();
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

/* --------------------------- 分享：生成二维码 --------------------------- */

function renderShare() {
  // 只分享站点路径本身：不带 hash / 查询串，避免把某次签名之类的临时参数带出去
  const url = location.origin + location.pathname;

  const fab = el('button', 'share-fab');
  fab.type = 'button';
  fab.setAttribute('aria-label', '分享本页二维码');
  fab.innerHTML =
    '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">' +
    '<path fill="currentColor" d="M18 16.1a3 3 0 0 0-2 .8l-7.1-4.2a3 3 0 0 0 0-1.4L16 7.1a3 3 0 1 0-1-2.1' +
    'l-7.1 4.2a3 3 0 1 0 0 5.6L15 18.9a3 3 0 1 0 3-2.8Z"/></svg><span>分享</span>';

  const mask = el('div', 'share-mask');
  mask.hidden = true;
  mask.innerHTML =
    '<div class="share-card" role="dialog" aria-modal="true" aria-labelledby="share-title">' +
    '<h3 id="share-title">扫码在手机上查看</h3>' +
    '<div class="share-qr"></div>' +
    '<p class="share-url"></p>' +
    '<div class="share-actions">' +
    '<button type="button" class="share-copy">复制链接</button>' +
    '<button type="button" class="share-save">保存二维码</button>' +
    '<button type="button" class="share-close ghost">关闭</button>' +
    '</div>' +
    '<p class="share-tip">二维码内容只有本页网址，不含任何个人信息</p>' +
    '</div>';

  const qrBox = $('.share-qr', mask);
  $('.share-url', mask).textContent = url;

  // 二维码只在第一次打开弹窗时生成
  let built = false;
  const build = () => {
    if (built || typeof qrcode === 'undefined') return false;
    const qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    qrBox.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2 });
    built = true;
    return true;
  };

  const close = () => {
    mask.hidden = true;
  };

  fab.addEventListener('click', () => {
    if (!build()) {
      fab.hidden = true; // 二维码库没加载成功时不要留个点了没用的按钮
      return;
    }
    mask.hidden = false;
  });
  mask.addEventListener('click', (e) => {
    if (e.target === mask) close();
  });
  $('.share-close', mask).addEventListener('click', close);
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !mask.hidden) close();
  });

  const copyBtn = $('.share-copy', mask);
  copyBtn.addEventListener('click', async () => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(url);
      ok = true;
    } catch {
      // 非 HTTPS 或旧浏览器没有 Clipboard API，退回到选中再复制
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0';
      document.body.append(ta);
      ta.select();
      ok = document.execCommand('copy');
      ta.remove();
    }
    copyBtn.textContent = ok ? '已复制' : '复制失败';
    setTimeout(() => {
      copyBtn.textContent = '复制链接';
    }, 2000);
  });

  $('.share-save', mask).addEventListener('click', () => {
    const qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    const a = document.createElement('a');
    a.href = qr.createDataURL(8, 2);
    a.download = 'resume-qrcode.png';
    document.body.append(a);
    a.click();
    a.remove();
  });

  // 手机浏览器有系统分享面板时多给一个入口
  if (navigator.share) {
    const sysBtn = el('button', 'share-sys', '系统分享');
    sysBtn.type = 'button';
    sysBtn.addEventListener('click', () => {
      navigator.share({ title: document.title, url }).catch(() => {});
    });
    $('.share-actions', mask).prepend(sysBtn);
  }

  document.body.append(fab, mask);
}
