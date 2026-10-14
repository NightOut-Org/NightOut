/**
 * BarcodeDetector (Shape Detection API · Chrome/Edge/Android) — lib.dom ของ TS 5.9 ยังไม่มี
 * จึงประกาศเฉพาะส่วนที่ใช้ไว้ที่นี่ (ไม่ augment lib.dom) · Safari/Firefox ไม่มี → useQrScanner ใช้ jsQR แทน
 */
export interface DetectedBarcode {
  rawValue: string;
}

export interface BarcodeDetectorLike {
  detect(src: CanvasImageSource): Promise<DetectedBarcode[]>;
}

export interface BarcodeDetectorCtor {
  new (o?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats(): Promise<string[]>;
}

/** constructor ของเบราว์เซอร์ หรือ undefined ถ้าไม่รองรับ */
export const getBarcodeDetector = (): BarcodeDetectorCtor | undefined =>
  (globalThis as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
