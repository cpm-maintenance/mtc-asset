/**
 * @file Shared domain types MTC-Asset (TypeScript).
 *
 * Sumber tipe tunggal untuk record lintas modul. Dipakai lewat JSDoc:
 *   @typedef {import('./types').Equipment} Equipment
 *
 * Konvensi field (lihat juga utils.js):
 * - HistoryLog/SpareParts/Equipment memakai `EquipmentID` (capital).
 * - Performance/PM_Schedule memakai `equipmentId` (lowercase).
 *
 * ponytail: interface menyertakan index signature `[key: string]: any` supaya
 * field dinamis (payload Firebase) tetap lolos typecheck tanpa memaksa
 * pemetaan lengkap hari ini. Perketat (hapus index signature) saat tiap modul
 * selesai dimigrasi — mulai dari field yang sudah stabil.
 */

/** Form/record Equipment. */
export interface Equipment {
  id?: string;
  EquipmentID?: string;
  nama?: string;
  Name?: string;
  serialNumber?: string;
  Tipe?: string;
  Type?: string;
  Status?: string;
  Criticality?: string;
  Location?: string;
  NextPMDate?: string;
  [key: string]: any;
}

/** Form/record Spare Part. */
export interface SparePart {
  id?: string;
  PartID?: string;
  nama?: string;
  Name?: string;
  Stok?: number | string;
  MinStock?: number | string;
  harga?: number | string;
  Price?: number | string;
  EquipmentID?: string;
  [key: string]: any;
}

/** Record HistoryLog (WO / PM / Breakdown). */
export interface HistoryLog {
  LogID?: string;
  EquipmentID?: string;
  Jenis?: string;
  Tanggal?: string;
  date?: string;
  desc?: string;
  Downtime?: number | string;
  HM?: number | string;
  Cost?: number | string;
  photos?: string[];
  PartsUsed?: string | Array<{ id?: string; qty?: number; partId?: string; quantity?: number }>;
  [key: string]: any;
}

/** Form/record Performance (WH/BD/STB). */
export interface Performance {
  id?: string;
  equipmentId?: string;
  date?: string;
  wh?: number | string;
  bd?: number | string;
  stb?: number | string;
  freq?: number;
  paPlan?: number | string;
  hm?: number | string;
  type?: string;
  area?: string;
  remarks?: string;
  rca?: string;
  category?: string;
  events?: any[];
  [key: string]: any;
}

/** Form/record tugas PM Schedule. */
export interface PMTask {
  pmId?: string;
  taskName?: string;
  equipmentId?: string;
  description?: string;
  date?: string;
  frequency?: string;
  basis?: string;
  intervalHours?: number;
  assignedTo?: string;
  status?: string;
  priority?: string;
  completionDate?: string;
  completionNote?: string;
  [key: string]: any;
}

/** Status lifetime spare part. */
export type LifetimeStatus = 'overdue' | 'warning' | 'ok';

/** Hasil kalkulasi lifetime spare part. */
export interface PartLifetimeResult {
  daysUsed: number;
  daysRemaining: number;
  percentUsed: number;
  isOverdue: boolean;
  isWarning: boolean;
  status: LifetimeStatus;
}

/** Opsi retry untuk `withRetry`. */
export interface RetryOptions {
  maxRetries?: number;
  delay?: number;
  backoff?: number;
  onRetry?: ((attempt: number, error: unknown, delay: number) => void) | null;
}

/** Item yang memakai spare part (untuk cek ketersediaan). */
export interface PartUsageItem {
  partId?: string;
  quantity?: number;
  [key: string]: any;
}
