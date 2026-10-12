/**
 * @file Deklarasi tipe untuk paket npm yang belum menyertakan `.d.ts`.
 *
 * Hanya paket yang benar-benar dipakai lewat dynamic import di src/js.
 */
declare module 'qrcode' {
  interface QROptions {
    width?: number;
    margin?: number;
    color?: { dark?: string; light?: string };
  }
  const QRCode: {
    toDataURL(text: string, options?: QROptions): Promise<string>;
  };
  export default QRCode;
}
