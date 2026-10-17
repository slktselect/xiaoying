import { useState } from 'react';

/** 复制文本；Clipboard API 不可用（非 HTTPS / 旧浏览器）时退回 execCommand */
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0';
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

export default function Hero({ profile, contacts }) {
  const initial = (profile.name || '?').trim().slice(0, 1);
  // 当前显示「已复制」对勾的联系行下标；-1 = 无
  const [copiedIdx, setCopiedIdx] = useState(-1);

  const copy = async (idx, text) => {
    const ok = await copyText(text);
    setCopiedIdx(ok ? idx : -1);
    setTimeout(() => setCopiedIdx((cur) => (cur === idx ? -1 : cur)), 2000);
  };

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-3xl gap-4 px-4 py-8 sm:gap-5 sm:py-10">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-600 text-2xl font-semibold text-white sm:h-20 sm:w-20 sm:text-3xl">
          {profile.avatar ? (
            <img src={profile.avatar} alt={profile.name || '头像'} className="h-full w-full object-cover" />
          ) : (
            initial
          )}
        </div>

        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {profile.name || '你的姓名'}
          </h1>
          {profile.title && <p className="mt-1 text-sm font-medium text-blue-600">{profile.title}</p>}
          {profile.summary && (
            <p className="mt-3 text-sm leading-6 text-slate-600">{profile.summary}</p>
          )}

          {contacts.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
              {contacts.map((c, i) => (
                <li
                  key={`${c.label}-${c.value}`}
                  className="flex max-w-full items-center gap-1 text-slate-600"
                >
                  <span className="shrink-0 text-slate-400">{c.label}：</span>
                  {c.href ? (
                    <a
                      href={c.href}
                      className="inline-block break-words text-slate-700 underline-offset-2 hover:text-blue-600 hover:underline"
                      {...(c.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    >
                      {c.value}
                    </a>
                  ) : (
                    <span className="break-words text-slate-700">{c.value}</span>
                  )}
                  {/* 一键复制：手机上点链接更顺手，桌面上复制电话/邮箱更常用 */}
                  <button
                    type="button"
                    onClick={() => copy(i, c.value)}
                    aria-label={`复制${c.label}`}
                    title={`复制${c.label}`}
                    className="no-print shrink-0 rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-blue-600"
                  >
                    {copiedIdx === i ? (
                      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                        <path fill="currentColor" d="M9 16.2l-3.5-3.5L4 14.2l5 5 11-11-1.4-1.4z" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                        <path
                          fill="currentColor"
                          d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z"
                        />
                      </svg>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </header>
  );
}
