/**
 * @file Deklarasi tipe untuk paket npm yang belum menyertakan `.d.ts`.
 */

declare module 'qrcode' {
  interface QROptions {
    /** 'L' | 'M' | 'Q' | 'H' — H dipakai supaya badge tengah aman. */
    errorCorrectionLevel?: string;
    width?: number;
    margin?: number;
    color?: { dark?: string; light?: string };
  }
  const QRCode: {
    toDataURL(text: string, options?: QROptions): Promise<string>;
  };
  export default QRCode;
}

declare module 'jspdf-autotable' {
  interface UserOptions {
    startY?: number;
    head?: any[][];
    body?: any[][];
    theme?: string;
    headStyles?: any;
    bodyStyles?: any;
    margin?: any;
    [key: string]: any;
  }
  export function autoTable(doc: any, options: UserOptions): void;
}

declare module 'jspdf' {
  interface jsPDF {
    autoTable(options: any): jsPDF;
    lastAutoTable: { finalY: number };
  }
}
