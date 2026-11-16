// @ts-check
/**
 * Penjaga konfigurasi Firebase di bundel hasil build.
 *
 * `src/js/firebase-core.js` mengambil seluruh config dari `import.meta.env.VITE_FIREBASE_*`.
 * Kalau variabel itu tidak ada saat `vite build`, Vite meng-inline `void 0` — build
 * tetap sukses dan tidak ada yang gagal, tapi setiap halaman langsung melempar
 * `auth/invalid-api-key`. Pernah terjadi (S54): `dist/` lokal dibangun tanpa `.env`
 * lalu di-deploy manual, menimpa rilis CI yang sehat.
 *
 * Fungsi ini menolak bundel yang config-nya kosong supaya kegagalan terjadi di build,
 * bukan di layar operator.
 */

/** Field yang wajib berisi string nyata di bundel. */
const REQUIRED = [
  'apiKey',
  'authDomain',
  'databaseURL',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId',
];

/** Nilai yang ditulis Vite saat env tidak tersedia. */
const EMPTY_VALUES = new Set(['void 0', 'undefined', 'null', '""', "''", '``']);

/**
 * Ambil isi literal objek yang diekspor sebagai `window.firebaseConfig`.
 *
 * Output minify berbentuk `Pi={apiKey:`...`,...},Fi=re(Pi),...,window.firebaseConfig=Pi`.
 * Nama variabelnya berubah tiap build, jadi dicari dari sisi ekspornya.
 * @param {string} source
 * @returns {string|null} isi `{...}` tanpa kurung; null bila tidak ketemu
 */
function configLiteral(source) {
  const exported = /window\.firebaseConfig\s*=\s*([A-Za-z_$][\w$]*)/.exec(source);
  if (!exported) return null;

  const name = exported[1];
  const assignment = new RegExp(`\\b${name}\\s*=\\s*\\{`, 'g');
  const before = source.slice(0, exported.index);

  let start = -1;
  for (let m = assignment.exec(before); m; m = assignment.exec(before)) {
    start = m.index + m[0].length;
  }
  if (start < 0) return null;

  // Objek config tidak bersarang, jadi `}` pertama sudah penutupnya.
  const end = source.indexOf('}', start);
  return end < 0 ? null : source.slice(start, end);
}

/**
 * @param {string} source isi chunk JS hasil build
 * @returns {string[]} nama field yang kosong/hilang
 */
export function missingFirebaseConfig(source) {
  const literal = configLiteral(source);
  if (literal === null) return [...REQUIRED];

  /** @type {Map<string,string>} */
  const entries = new Map();
  for (const pair of literal.split(',')) {
    const colon = pair.indexOf(':');
    if (colon < 0) continue;
    entries.set(pair.slice(0, colon).trim(), pair.slice(colon + 1).trim());
  }

  return REQUIRED.filter((field) => {
    const value = entries.get(field);
    if (value === undefined || EMPTY_VALUES.has(value)) return true;
    const quoted = /^(["'`])([\s\S]*)\1$/.exec(value);
    return quoted ? quoted[2].trim() === '' : false;
  });
}

/**
 * @param {string} source isi chunk JS hasil build
 * @param {string} label nama berkas untuk pesan galat
 * @returns {string[]} daftar alasan gagal; kosong = lolos
 */
export function checkFirebaseConfig(source, label) {
  const missing = missingFirebaseConfig(source);
  if (missing.length === 0) return [];
  return [
    `${label}: ${missing.length} field Firebase kosong di bundel — ${missing.join(', ')}`,
    'Bundle dibangun tanpa env VITE_FIREBASE_*; set di .env (lokal) atau GitHub Secrets, lalu build ulang.',
  ];
}
