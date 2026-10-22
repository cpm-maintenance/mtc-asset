// @ts-check
/**
 * css-dedupe.mjs — buang aturan yang sudah ada di CSS kritis (S33ae).
 *
 * Sejak S33ab, layar login memakai CSS kritis **inline** (subset Tailwind
 * `index.html` + token/ikon/font) dan bundel penuh baru dipasang setelah paint.
 * Masalahnya: bundel penuh itu dibangun dari SELURUH konten, jadi ia memuat
 * ulang setiap aturan yang sudah ada di CSS kritis — 8,7 KB gzip dobel.
 *
 * Fungsi ini melakukan selisih **tepat di tingkat aturan** (bukan tebakan
 * "kelas mana yang dipakai"): setiap aturan dinormalkan jadi kunci
 * `media|selector|declarations` dan aturan yang kuncinya ada di CSS kritis
 * dibuang dari bundel.
 *
 * Jaminan yang dijaga: `dedupe(full, critical)` **tidak boleh menghilangkan
 * aturan**. Setiap aturan bundel penuh harus tetap ada di (kritis ∪ hasil).
 * Kalau tidak, build gagal — lebih baik bundel gemuk daripada shell tanpa gaya.
 */
import postcss from 'postcss';

/**
 * Kunci normalisasi sebuah node CSS. Aturan yang isinya sama persis di kedua
 * berkas menghasilkan kunci yang sama; perbedaan sekecil apa pun (nilai,
 * `!important`, media query) membuatnya tetap dipertahankan di bundel.
 * @param {import('postcss').ChildNode} node
 * @param {string} media
 * @returns {string}
 */
function keyOf(node, media) {
  if (node.type === 'rule') {
    const decls = node.nodes
      .filter((n) => n.type === 'decl')
      .map((n) => `${n.prop}:${n.value}${n.important ? '!important' : ''}`)
      .join(';');
    return `rule|${media}|${node.selector.replace(/\s+/g, ' ').trim()}|${decls}`;
  }
  if (node.type === 'atrule') {
    const body = 'nodes' in node && node.nodes ? node.nodes.map((n) => n.toString()).join('') : '';
    return `atrule|${media}|${node.name}|${node.params}|${body}`;
  }
  return `other|${media}|${node.toString()}`;
}

/**
 * Kumpulkan kunci semua aturan, dengan konteks media query-nya.
 * @param {import('postcss').Root} root
 * @returns {Set<string>}
 */
function collectKeys(root) {
  /** @type {Set<string>} */
  const keys = new Set();
  /** @param {import('postcss').Container} container @param {string} media */
  const walk = (container, media) => {
    for (const node of container.nodes || []) {
      if (node.type === 'atrule' && node.name === 'media') {
        walk(node, media ? `${media} and ${node.params}` : node.params);
        continue;
      }
      keys.add(keyOf(node, media));
      if (node.type === 'atrule' && 'nodes' in node && node.nodes) {
        for (const child of node.nodes) keys.add(keyOf(child, media));
      }
    }
  };
  walk(root, '');
  return keys;
}

/**
 * @param {string} fullCss bundel penuh hasil build
 * @param {string} criticalCss CSS kritis yang sudah di-inline
 * @returns {{ css: string, removed: number, kept: number, critical: number }}
 */
export function dedupeCss(fullCss, criticalCss) {
  const full = postcss.parse(fullCss);
  const criticalRoot = postcss.parse(criticalCss);
  const criticalKeys = collectKeys(criticalRoot);

  let removed = 0;
  /** @param {import('postcss').Container} container @param {string} media */
  const prune = (container, media) => {
    for (const node of [...(container.nodes || [])]) {
      if (node.type === 'atrule' && node.name === 'media') {
        prune(node, media ? `${media} and ${node.params}` : node.params);
        if (node.nodes && node.nodes.length === 0) node.remove();
        continue;
      }
      const key = keyOf(node, media);
      if (criticalKeys.has(key)) {
        node.remove();
        removed++;
      }
    }
  };
  prune(full, '');

  // INVARIAN: setiap aturan bundel penuh harus tetap ada di kritis ∪ hasil.
  // Penjaga terhadap normalisasi yang tidak simetris (kunci beda untuk aturan
  // yang sebenarnya sama): lebih baik bundel gemuk daripada shell tanpa gaya.
  const original = collectKeys(postcss.parse(fullCss));
  const remaining = collectKeys(postcss.parse(full.toString()));
  const stillThere = new Set([...remaining, ...criticalKeys]);
  const lost = [...original].filter((k) => !stillThere.has(k));
  if (lost.length > 0) {
    throw new Error(
      `[css-dedupe] ${lost.length} aturan hilang dari kritis ∪ bundel, mis. ${lost[0].slice(0, 120)}`
    );
  }

  return {
    css: full.toString(),
    removed,
    kept: remaining.size,
    critical: criticalKeys.size,
  };
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/css-dedupe.mjs')) {
  const fs = await import('node:fs');
  const [, , fullPath, criticalPath, outPath] = process.argv;
  const res = dedupeCss(
    fs.readFileSync(fullPath, 'utf-8'),
    fs.readFileSync(criticalPath, 'utf-8')
  );
  fs.writeFileSync(outPath, res.css);
  console.log(
    `[css-dedupe] ${res.removed} aturan dibuang · ${res.kept} tersisa · kritis ${res.critical} · ${res.css.length} B → ${outPath}`
  );
}
