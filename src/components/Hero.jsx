export default function Hero({ profile, contacts }) {
  const initial = (profile.name || '?').trim().slice(0, 1);

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-3xl gap-5 px-4 py-10">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-600 text-3xl font-semibold text-white">
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
            <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {contacts.map((c) => (
                <li key={`${c.label}-${c.value}`} className="text-slate-600">
                  <span className="text-slate-400">{c.label}：</span>
                  {c.href ? (
                    <a
                      href={c.href}
                      className="text-slate-700 underline-offset-2 hover:text-blue-600 hover:underline"
                      {...(c.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    >
                      {c.value}
                    </a>
                  ) : (
                    c.value
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </header>
  );
}
