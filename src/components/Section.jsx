function Item({ item }) {
  return (
    <div className="print-plain rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="font-semibold text-slate-900">{item.title}</h3>
        {item.period && <span className="text-xs text-slate-500">{item.period}</span>}
      </div>

      {item.subtitle && <p className="mt-0.5 text-sm text-blue-600">{item.subtitle}</p>}
      {item.meta && <p className="mt-0.5 text-xs text-slate-500">{item.meta}</p>}

      {item.bullets?.length > 0 && (
        <ul className="mt-3 space-y-1.5 text-sm leading-6 text-slate-700">
          {item.bullets.map((b, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}

      {item.links?.length > 0 && (
        <p className="mt-3 flex flex-wrap gap-x-4 text-sm">
          {item.links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              {l.label || l.href}
            </a>
          ))}
        </p>
      )}

      {item.tags?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {item.tags.map((t) => (
            <span key={t} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Section({ section }) {
  return (
    <section id={section.id} className="scroll-mt-20 pt-8">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">{section.title}</h2>
      <div className="space-y-4">
        {(section.items || []).map((item, i) => (
          <Item key={`${item.title}-${i}`} item={item} />
        ))}
      </div>
    </section>
  );
}
