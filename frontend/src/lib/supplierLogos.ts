/**
 * Map a supplier (by stable id or by name fragment) to its logo URL.
 *
 * Files live in `public/suppliers/` and ship statically with the bundle
 * — no CDN, no Supabase Storage, no auth. Drop a new file in that folder
 * and reference it here.
 *
 * Drop these four PNGs into `public/suppliers/` so the cards on
 * /suppliers (and the dossier header on /suppliers/:id) show the brand
 * marks the user provided:
 *
 *   alpha.png        — Alpha Marine · green shield "A" · Trusted Compliance
 *   beta.png         — BlueWave Bunkering · blue circular wave mark
 *   gamma.png        — OceanBunker (flame G) · orange/red flame around G
 *   oceanbunker.png  — OceanBunker International · grey anchor + globe
 *
 * Missing files render the textual fallback (initials chip) — the page
 * doesn't crash, the layout stays the same.
 */

const BY_ID: Record<string, string> = {
  'SUP-001': '/suppliers/alpha.png',
  'SUP-002': '/suppliers/beta.png',
  'SUP-003': '/suppliers/gamma.png',
  'SUP-004': '/suppliers/oceanbunker.png',
};

/** Keyword fallback when the id isn't in the table (e.g. a free-text
 *  supplier_name on a session that didn't make it into `suppliers`). */
const BY_KEYWORD: Array<[RegExp, string]> = [
  [/oceanbunker/i, '/suppliers/oceanbunker.png'],
  [/\bgamma\b/i,   '/suppliers/gamma.png'],
  [/\bbeta\b/i,    '/suppliers/beta.png'],
  [/\balpha\b/i,   '/suppliers/alpha.png'],
];

export function supplierLogoFor(idOrName: string | null | undefined): string | null {
  if (!idOrName) return null;
  if (BY_ID[idOrName]) return BY_ID[idOrName];
  for (const [re, url] of BY_KEYWORD) {
    if (re.test(idOrName)) return url;
  }
  return null;
}

/** Two-letter initials for the fallback chip.
 *
 *  Picks distinguishing keywords first (Alpha / Beta / Gamma / Ocean)
 *  so the three demo suppliers don't all collapse to "BD" — their full
 *  names are "BunkerGuard Demo Supplier Alpha Pte Ltd" etc. and the
 *  naive "first two words" approach loses the only distinguishing
 *  token. Falls back to the first-letters-of-first-two-words rule
 *  for any name that doesn't match a known keyword. */
export function supplierInitials(name: string): string {
  const text = name || '';
  const KEYWORDS = [
    /(ocean\s*bunker|oceanbunker)/i,
    /\b(alpha)\b/i,
    /\b(beta)\b/i,
    /\b(gamma)\b/i,
    /\b(blue\s*wave|bluewave)\b/i,
    /\b(megafuel)\b/i,
    /\b(sino\s*marine|sinomarine)\b/i,
  ];
  for (const re of KEYWORDS) {
    const m = text.match(re);
    if (m) {
      const tok = m[1].replace(/\s+/g, '');
      // Two letters: first + middle (e.g. "Alpha" → "AL", "OceanBunker" → "OB")
      if (/ocean/i.test(tok)) return 'OB';
      if (/blue/i.test(tok))  return 'BW';
      return tok.slice(0, 2).toUpperCase();
    }
  }
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
