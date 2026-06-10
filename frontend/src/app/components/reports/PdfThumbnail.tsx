import { useEffect, useRef, useState } from 'react';

/**
 * Render page 1 of a real PDF as a canvas thumbnail.
 *
 * The Reports tab now shows the actual document — not a mockup. We use
 * PDF.js to rasterise page 1 at a target pixel width, draw it into a
 * <canvas>, and let the page CSS scale it into the card slot. The PDF
 * keeps its real layout (header band, verdict bar, stat trio, ruled
 * tables, signature blocks) — what the operator sees in the grid is a
 * literal preview of what they get when they click and the PDF opens
 * full-screen.
 *
 * Caching: rendered pages are cached in module-scope by URL so flipping
 * away and back doesn't re-rasterise. Each cached entry holds a data
 * URL (PNG), cheap to re-use.
 */

// Cache by URL so re-renders don't repeat the work. URLs in this app are
// either blob:… (localStorage-backed) which are stable per page session,
// or https://…supabase.co/storage/… which are stable across reloads.
const RENDER_CACHE = new Map<string, string>();
let pdfjsModulePromise: Promise<any> | null = null;

/** Load PDF.js with a Vite-friendly worker setup.
 *
 *  Strategy: try `new URL(..., import.meta.url)` first — this lets Vite
 *  resolve the worker through its module graph and emit it next to the
 *  app bundle. If that fails (e.g. SSR mode, older Vite), fall back to
 *  pointing GlobalWorkerOptions.workerSrc at the file-system path that
 *  Vite serves under `/node_modules/...` during dev. As a last resort,
 *  set `useFakeWorker` so rendering runs on the main thread — slower
 *  but always works. */
async function loadPdfjs() {
  if (!pdfjsModulePromise) {
    pdfjsModulePromise = (async () => {
      const pdfjs: any = await import('pdfjs-dist/build/pdf.mjs');
      try {
        // Vite-native worker URL — resolves through the dep graph at build
        // time, gets a hashed asset URL in production.
        const workerUrl = new URL(
          'pdfjs-dist/build/pdf.worker.mjs',
          import.meta.url,
        ).href;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      } catch {
        try {
          pdfjs.GlobalWorkerOptions.workerSrc =
            '/node_modules/pdfjs-dist/build/pdf.worker.mjs';
        } catch {
          // Last resort — fake-worker mode (no separate thread).
          // eslint-disable-next-line no-console
          console.warn('[PdfThumbnail] falling back to main-thread render');
        }
      }
      return pdfjs;
    })();
  }
  return pdfjsModulePromise;
}

export interface PdfThumbnailProps {
  /** PDF source — same URL the card's click handler will open. */
  url: string;
  /** Internal render width in device pixels. Higher = crisper but
   *  slower. 600 is a good balance for A4 portrait at card size. */
  pixelWidth?: number;
  /** CSS width/height for the thumbnail container; the canvas inside
   *  scales to fit while preserving aspect ratio. */
  style?: React.CSSProperties;
  className?: string;
  /** Fallback content rendered while loading or on error — usually a
   *  small badge so the card isn't blank. */
  fallback?: React.ReactNode;
}

export function PdfThumbnail({
  url, pixelWidth = 600, style, className, fallback,
}: PdfThumbnailProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(() => RENDER_CACHE.get(url) ?? null);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    if (RENDER_CACHE.has(url)) {
      setDataUrl(RENDER_CACHE.get(url)!);
      return;
    }
    setError(null);
    setDataUrl(null);
    (async () => {
      try {
        const pdfjs = await loadPdfjs();
        const loadingTask = pdfjs.getDocument({ url });
        const pdf = await loadingTask.promise;
        if (cancelledRef.current) return;
        const page = await pdf.getPage(1);
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = pixelWidth / baseViewport.width;
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width  = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('canvas 2d unavailable');
        // pdfjs v6 expects { canvasContext, viewport, canvas } in modern
        // builds; older builds accept the same minus `canvas`. Spread
        // both to stay forward/backward compatible.
        await page.render({
          canvasContext: ctx as any,
          viewport,
          canvas,
        } as any).promise;
        if (cancelledRef.current) return;
        const url2 = canvas.toDataURL('image/png');
        RENDER_CACHE.set(url, url2);
        setDataUrl(url2);
      } catch (e: any) {
        // eslint-disable-next-line no-console
        console.warn('[PdfThumbnail] failed:', e?.message ?? e);
        if (!cancelledRef.current) setError(e?.message ?? String(e));
      }
    })();
    return () => { cancelledRef.current = true; };
  }, [url, pixelWidth]);

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        background: '#0E1C2D',
        overflow: 'hidden',
        // Default to A4 portrait aspect (≈ 1 : 1.414).
        aspectRatio: '1 / 1.414',
        ...style,
      }}
    >
      {dataUrl && (
        <img
          src={dataUrl}
          alt="PDF page 1 preview"
          style={{
            width: '100%', height: '100%', objectFit: 'contain', display: 'block',
            background: '#F4ECD8',
          }}
          draggable={false}
        />
      )}
      {!dataUrl && !error && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#7FA5D3', fontSize: 10, fontWeight: 600,
          letterSpacing: 0.8, textTransform: 'uppercase',
          background: 'rgba(244,236,216,0.08)',
        }}>
          {fallback ?? 'Rendering preview…'}
        </div>
      )}
      {error && !dataUrl && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#FFA940', fontSize: 10, fontWeight: 600,
          letterSpacing: 0.8, textTransform: 'uppercase',
          padding: 12, textAlign: 'center',
        }}>
          {fallback ?? 'Preview unavailable'}
        </div>
      )}
    </div>
  );
}
