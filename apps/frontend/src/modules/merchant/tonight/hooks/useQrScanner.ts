import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { getBarcodeDetector } from '../type/barcodeDetector';

export type QrScannerStatus =
  'idle' | 'starting' | 'scanning' | 'denied' | 'unavailable' | 'insecure' | 'error';
export type QrScannerEngine = 'native' | 'jsqr';

const NATIVE_INTERVAL_MS = 150;
const JSQR_INTERVAL_MS = 250;
const JSQR_MAX_EDGE = 640;
const REPEAT_IGNORE_MS = 2500;

type Detect = (video: HTMLVideoElement) => Promise<string | null>;
type Run = {
  status: Exclude<QrScannerStatus, 'starting' | 'insecure'>;
  engine: QrScannerEngine | null;
};
const IDLE: Run = { status: 'idle', engine: null };

/** BarcodeDetector ของเครื่อง ถ้ารองรับ qr_code · ไม่งั้น null */
async function nativeDetect(): Promise<Detect | null> {
  const Ctor = getBarcodeDetector();
  if (!Ctor) return null;
  try {
    if (!(await Ctor.getSupportedFormats()).includes('qr_code')) return null;
    const detector = new Ctor({ formats: ['qr_code'] });
    return async (video) => (await detector.detect(video))[0]?.rawValue || null;
  } catch {
    return null;
  }
}

/** jsQR บน canvas นอกจอ (ย่อภาพก่อน — เร็วพอบนมือถือรุ่นเก่า) */
async function jsqrDetect(): Promise<Detect> {
  const mod = await import('jsqr');
  // jsqr เป็น UMD (CommonJS + __esModule) — กัน bundler ที่ห่อ default ซ้อนอีกชั้น
  const jsQR =
    typeof mod.default === 'function'
      ? mod.default
      : (mod.default as unknown as { default: typeof mod.default }).default;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('CANVAS_UNAVAILABLE');
  return async (video) => {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return null;
    const scale = Math.min(1, JSQR_MAX_EDGE / Math.max(vw, vh));
    const w = Math.round(vw * scale);
    const h = Math.round(vh * scale);
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    ctx.drawImage(video, 0, 0, w, h);
    return (
      jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' })?.data ||
      null
    );
  };
}

/** error ของ getUserMedia → สถานะที่บอกผู้ใช้ได้ */
function errorStatus(e: unknown): Run['status'] {
  const name = (e as { name?: string } | null)?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'unavailable';
  return 'error';
}

const subscribeVisibility = (cb: () => void) => {
  document.addEventListener('visibilitychange', cb);
  return () => document.removeEventListener('visibilitychange', cb);
};
const isPageVisible = () => document.visibilityState !== 'hidden';

/**
 * สแกน QR ด้วยกล้องหลังของมือถือ (หน้า /merchant/tonight)
 * - เบราว์เซอร์ที่มี BarcodeDetector (Chrome/Edge/Android) ใช้ของเครื่อง · ไม่มี (Safari/Firefox) โหลด jsQR ตอนใช้ครั้งแรก
 *   (dynamic import — ไม่อยู่ใน bundle หลัก)
 * - ไม่ตรวจทุกเฟรม: native ทุก ~150ms · jsQR ทุก ~250ms (ย่อภาพด้านยาว ≤640px) · รอบก่อนยังไม่เสร็จ = ข้าม
 * - ข้อความเดิมซ้ำภายใน 2.5 วิ = ไม่แจ้งซ้ำ (QR ค้างหน้ากล้อง)
 * - ปิดกล้องเมื่อ active = false / unmount / สลับแท็บ แล้วเปิดใหม่เองเมื่อกลับมาที่แท็บ (ปลอดภัยกับ StrictMode)
 */
export function useQrScanner({
  active,
  onDetect,
}: {
  active: boolean;
  onDetect: (text: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onDetectRef = useRef(onDetect);
  const [run, setRun] = useState<Run>(IDLE);
  const [attempt, setAttempt] = useState(0);
  const pageVisible = useSyncExternalStore(subscribeVisibility, isPageVisible);

  useEffect(() => {
    onDetectRef.current = onDetect;
  }, [onDetect]);

  // กล้องใช้ได้เฉพาะ https (หรือ localhost) และเบราว์เซอร์ที่มี getUserMedia
  const blocked: QrScannerStatus | null = !window.isSecureContext
    ? 'insecure'
    : !navigator.mediaDevices?.getUserMedia
      ? 'unavailable'
      : null;
  const live = active && pageVisible && !blocked;

  useEffect(() => {
    if (!live) return;
    const video = videoRef.current;
    let cancelled = false;
    let stream: MediaStream | null = null;
    let timer: number | undefined;

    void (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        if (!video) throw new Error('VIDEO_UNAVAILABLE');
        video.srcObject = s;
        // autoPlay + muted เล่นเองอยู่แล้ว · play() บางครั้ง reject (ถูกขัดจังหวะ) — ไม่ถือว่าเปิดกล้องไม่สำเร็จ
        await video.play().catch(() => undefined);
        const native = await nativeDetect();
        const detect = native ?? (await jsqrDetect());
        if (cancelled) return;
        // กล้องถูกปิดจากที่อื่น (ถอดกล้อง / แอปอื่นแย่งใช้) → ให้กด "ลองใหม่"
        s.getVideoTracks()[0]?.addEventListener('ended', () => {
          window.clearInterval(timer);
          if (!cancelled) setRun({ status: 'error', engine: null });
        });
        setRun({ status: 'scanning', engine: native ? 'native' : 'jsqr' });

        let pending = false;
        let lastText = '';
        let lastSeen = 0;
        timer = window.setInterval(
          () => {
            if (pending || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
            pending = true;
            detect(video)
              .then((text) => {
                if (cancelled || !text) return;
                const now = performance.now();
                const repeat = text === lastText && now - lastSeen < REPEAT_IGNORE_MS;
                lastText = text;
                lastSeen = now;
                if (!repeat) onDetectRef.current(text);
              })
              .catch(() => undefined)
              .finally(() => {
                pending = false;
              });
          },
          native ? NATIVE_INTERVAL_MS : JSQR_INTERVAL_MS,
        );
      } catch (e) {
        // เปิดกล้องได้แล้วแต่ตั้งตัวอ่าน QR ไม่สำเร็จ (เช่น โหลด jsQR ไม่ได้) → ปิดกล้องด้วย ไม่ให้ไฟกล้องค้าง
        window.clearInterval(timer);
        stream?.getTracks().forEach((t) => t.stop());
        stream = null;
        if (video) video.srcObject = null;
        if (!cancelled) setRun({ status: errorStatus(e), engine: null });
      }
    })();

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
      if (video) video.srcObject = null;
      setRun(IDLE);
    };
  }, [live, attempt]);

  const status: QrScannerStatus = !active
    ? 'idle'
    : (blocked ?? (run.status === 'idle' ? 'starting' : run.status));
  return {
    videoRef,
    status,
    engine: status === 'scanning' ? run.engine : null,
    /** เปิดกล้องใหม่ (หลังเปิดสิทธิ์ / กล้องหลุด) */
    retry: () => setAttempt((n) => n + 1),
  };
}
