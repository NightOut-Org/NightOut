import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export type DraftSaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'offline';

interface Options<T> {
  /** ค่าปัจจุบันของฟอร์ม (เปรียบเทียบด้วย JSON) */
  value: T;
  /** false = ยังไม่บันทึก (เช่น ยังโหลดร่างเดิมไม่เสร็จ / ยังไม่ล็อกอิน) */
  enabled: boolean;
  /** ฟอร์มว่าง → ลบร่างแทนการบันทึก */
  isEmpty: (v: T) => boolean;
  /** บันทึกร่าง — คืนเวลาที่ backend บันทึก */
  save: (v: T) => Promise<{ updated_at: string }>;
  remove: () => Promise<unknown>;
  /** หยุดพิมพ์นานเท่านี้แล้วบันทึก (ms) */
  delay?: number;
  /** ค่าแรกมาจากร่างที่บันทึกไว้เมื่อไหร่ (null = ยังไม่มีร่าง) */
  initialSavedAt?: string | null;
}

/**
 * บันทึกร่างอัตโนมัติ (ใช้ทั้งหน้าตั้ง/แก้กระทู้ และช่องตอบกลับ) — ตัว API อยู่ใน api.ts ของแต่ละโมดูล ส่งเข้ามาเป็น save/remove
 * - บันทึกเมื่อหยุดพิมพ์ `delay` ms · เมื่อสลับแท็บ/ปิดแอป · เมื่อออกจากหน้า · เมื่อกลับมาออนไลน์
 * - ค่าแรกที่เปิดใช้ (หรือค่าที่ส่งให้ `baseline`) ถือว่าบันทึกแล้ว — เปิดหน้าเฉยๆ ไม่ยิง API
 *   ฟอร์มที่เติมร่างเดิม: mount ฟอร์มหลังโหลดร่างเสร็จ ให้ค่าแรกเป็นร่างนั้น + ส่ง `initialSavedAt`
 * - `cancel()` หลังโพสต์สำเร็จ (backend ลบร่างให้แล้ว) กันไม่ให้บันทึกร่างซ้ำตอนออกจากหน้า
 */
export function useAutosaveDraft<T>({
  value,
  enabled,
  isEmpty,
  save,
  remove,
  delay = 1000,
  initialSavedAt = null,
}: Options<T>) {
  const key = JSON.stringify(value);
  const [status, setStatus] = useState<DraftSaveStatus>(initialSavedAt ? 'saved' : 'idle');
  const [savedAt, setSavedAt] = useState<string | null>(initialSavedAt);
  const savedKey = useRef<string | null>(null);
  const cancelled = useRef(false);
  const latest = useRef({ key, value, enabled, isEmpty, save, remove });
  useLayoutEffect(() => {
    latest.current = { key, value, enabled, isEmpty, save, remove };
  });

  /** บันทึกทันที — คืน false ถ้าบันทึกไม่สำเร็จ (ออฟไลน์ / API ล้ม) */
  const flush = useCallback(async (): Promise<boolean> => {
    const cur = latest.current;
    if (!cur.enabled || cancelled.current) return true;
    if (savedKey.current === null) {
      savedKey.current = cur.key;
      return true;
    }
    if (cur.key === savedKey.current) return true;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setStatus('offline');
      return false;
    }
    const sending = cur.key;
    setStatus('saving');
    try {
      if (cur.isEmpty(cur.value)) {
        await cur.remove();
        setSavedAt(null);
        setStatus('idle');
      } else {
        const r = await cur.save(cur.value);
        setSavedAt(r.updated_at);
        setStatus('saved');
      }
      savedKey.current = sending;
      return true;
    } catch {
      setStatus('error');
      return false;
    }
  }, []);

  // ค่าแรกที่เปิดใช้ = ฐาน (ไม่บันทึก)
  useEffect(() => {
    if (enabled && savedKey.current === null) savedKey.current = latest.current.key;
  }, [enabled]);

  useEffect(() => {
    if (!enabled || savedKey.current === null || key === savedKey.current) return;
    const t = window.setTimeout(() => void flush(), delay);
    return () => window.clearTimeout(t);
  }, [key, enabled, delay, flush]);

  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === 'hidden') void flush();
    };
    const onFlush = () => void flush();
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('pagehide', onFlush);
    window.addEventListener('online', onFlush);
    return () => {
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('pagehide', onFlush);
      window.removeEventListener('online', onFlush);
      void flush(); // ออกจากหน้าในแอป (กดย้อนกลับ/เปลี่ยนเมนู) ก็ไม่หาย
    };
  }, [flush]);

  /** ตั้งค่าที่ถือว่าบันทึกแล้ว (หลังเติมร่างเดิมลงฟอร์ม / หลังทิ้งร่าง) */
  const baseline = useCallback((v: T, at: string | null) => {
    savedKey.current = JSON.stringify(v);
    setSavedAt(at);
    setStatus(at ? 'saved' : 'idle');
  }, []);

  const cancel = useCallback(() => {
    cancelled.current = true;
  }, []);

  return { status, savedAt, flush, baseline, cancel };
}
