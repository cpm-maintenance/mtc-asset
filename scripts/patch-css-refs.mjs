/**
 * Ganti nama aset CSS (hasil dedupe) di SELURUH berkas teks bundel Rollup.
 *
 * Chunk JS ikut menyimpan URL CSS di `__vite__mapDeps` (Rollup menaruhnya di
 * setiap chunk yang mengimpornya dinamis). Kalau hanya `.html` ditambal, chunk
 * mem-preload aset yang sudah dihapus → hosting SPA balas `index.html`
 * (`text/html`) → preload CSS gagal → `import()` dinamis reject senyap.
 *
 * @param {Record<string, {type: string, fileName: string, code?: string, source?: string}>} bundle
 * @param {string} from nama berkas lama, mis. `assets/main-abc.css`
 * @param {string} to nama berkas baru
 * @returns {number} jumlah kemunculan yang ditambal
 */
export function patchCssRefs(bundle, from, to) {
  let patched = 0;
  const swap = (text) => {
    const hits = text.split(from).length - 1;
    if (hits) patched += hits;
    return text.split(from).join(to);
  };
  for (const other of Object.values(bundle)) {
    if (other.type === 'chunk') {
      other.code = swap(other.code);
    } else if (other.type === 'asset' && /\.(?:html|js|mjs|json|css)$/.test(String(other.fileName))) {
      other.source = swap(String(other.source));
    }
  }
  return patched;
}
