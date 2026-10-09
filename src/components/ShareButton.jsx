import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';

export default function ShareButton({ config = {} }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState('');
  const canvasRef = useRef(null);

  // 只分享站点路径本身：不带 hash / 查询串
  const url = typeof location === 'undefined' ? '' : location.origin + location.pathname;

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const copy = async () => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(url);
      ok = true;
    } catch {
      // 非 HTTPS 或旧浏览器没有 Clipboard API，退回选中再复制
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0';
      document.body.append(ta);
      ta.select();
      ok = document.execCommand('copy');
      ta.remove();
    }
    setCopied(ok ? '已复制' : '复制失败');
    setTimeout(() => setCopied(''), 2000);
  };

  const save = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = 'resume-qrcode.png';
    document.body.append(a);
    a.click();
    a.remove();
  };

  const systemShare = () => {
    if (navigator.share) navigator.share({ title: document.title, url }).catch(() => {});
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="分享本页二维码"
        className="no-print fixed right-5 bottom-5 z-40 inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-700"
        style={{ bottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            fill="currentColor"
            d="M18 16.1a3 3 0 0 0-2 .8l-7.1-4.2a3 3 0 0 0 0-1.4L16 7.1a3 3 0 1 0-1-2.1l-7.1 4.2a3 3 0 1 0 0 5.6L15 18.9a3 3 0 1 0 3-2.8Z"
          />
        </svg>
        分享
      </button>

      {open && (
        <div
          className="no-print fixed inset-0 z-50 grid place-items-center bg-slate-900/55 p-4 sm:p-5"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="max-h-[90dvh] w-full max-w-[360px] overflow-y-auto rounded-2xl bg-white p-5 text-center shadow-xl sm:p-6"
          >
            <h3 className="text-base font-semibold text-slate-900">
              {config.title || '扫码在手机上查看'}
            </h3>

            <div className="mt-4 flex justify-center rounded-xl border border-slate-200 bg-white p-3">
              <QRCodeSVG value={url} size={220} level="M" />
            </div>

            <p className="mt-4 break-all text-xs text-slate-500">{url}</p>

            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {typeof navigator !== 'undefined' && navigator.share && (
                <button
                  type="button"
                  onClick={systemShare}
                  className="rounded-lg bg-blue-600 px-3 py-2.5 text-sm text-white hover:bg-blue-700"
                >
                  系统分享
                </button>
              )}
              <button
                type="button"
                onClick={copy}
                className="rounded-lg bg-blue-600 px-3 py-2.5 text-sm text-white hover:bg-blue-700"
              >
                {copied || '复制链接'}
              </button>
              <button
                type="button"
                onClick={save}
                className="rounded-lg bg-blue-600 px-3 py-2.5 text-sm text-white hover:bg-blue-700"
              >
                保存二维码
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg bg-blue-50 px-3 py-2.5 text-sm text-blue-600 hover:bg-blue-100"
              >
                关闭
              </button>
            </div>

            {config.tip && <p className="mt-4 text-xs text-slate-400">{config.tip}</p>}

            {/* 离屏 canvas 只用于导出 PNG；显示用上面的 SVG，缩放更清晰 */}
            <div className="hidden">
              <QRCodeCanvas ref={canvasRef} value={url} size={512} level="M" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
