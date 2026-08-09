import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function patch(file, pairs) {
  const fp = path.join(ROOT, file);
  let s = fs.readFileSync(fp, 'utf8');
  const eol = s.includes('\r\n') ? '\r\n' : '\n';
  s = s.replace(/\r\n/g, '\n');
  let ok = 0;
  for (const [from, to] of pairs) {
    if (s.includes(from)) { s = s.replace(from, to); ok++; }
    else console.log('  ✗ NOT FOUND:', file, '::', from.slice(0, 60));
  }
  fs.writeFileSync(fp, s.split('\n').join(eol));
  console.log(`  ${file}: ${ok}/${pairs.length} patched`);
}

const audit = (action, details) => `            // C3: Audit trail
            try {
                window.auditModule?.logAudit?.(${action}, ${details});
            } catch (e) { /* silent */ }
`;

// Parts
patch('src/js/modules/parts.js', [
  [
    `this.showNotification("Spare part data synchronized!");`,
    `this.showNotification("Spare part data synchronized!");
${audit(`this.isEditingPart ? 'Update Spare Part' : 'Create Spare Part'`, `{ id: sanitizedData.PartID, nama: sanitizedData.NamaPart }`)}`
  ]
]);

// PM
patch('src/js/modules/pm-schedule.js', [
  [
    `this.showNotification('PM Task created!');`,
    `this.showNotification('PM Task created!');
${audit(`'Create PM Task'`, `{ id: pmId, task: this.pmForm.taskName, equip: this.pmForm.equipmentId }`)}`
  ],
  [
    `this.showNotification('PM Task updated!');`,
    `this.showNotification('PM Task updated!');
${audit(`'Update PM Task'`, `{ id: pmId, task: this.pmForm.taskName }`)}`
  ]
]);

// Performance
patch('src/js/modules/performance.js', [
  [
    `this.showNotification("KPI metrics successfully synced!");`,
    `this.showNotification("KPI metrics successfully synced!");
${audit(`this.isEditingPerformance ? 'Update Performance' : 'Create Performance'`, `{ id: perfId, equip: sanitizedData.equipmentId || sanitizedData.EquipmentID, date: sanitizedData.date }`)}`
  ]
]);

// Requisition
patch('src/js/modules/requisition.js', [
  [
    `this.showNotification('✅ Permintaan diupdate');`,
    `this.showNotification('✅ Permintaan diupdate');
${audit(`'Update Requisition'`, `{ id: this.reqEditId }`)}`
  ],
  [
    `this.showNotification(\`✅ \${validItems.length} item berhasil diajukan dalam 1 permintaan\`);`,
    `this.showNotification(\`✅ \${validItems.length} item berhasil diajukan dalam 1 permintaan\`);
${audit(`'Create Requisition'`, `{ id, item: record.itemName, qty: record.quantity }`)}`
  ]
]);

console.log('✅ Audit trail wired ke parts, PM, performance, requisition');
