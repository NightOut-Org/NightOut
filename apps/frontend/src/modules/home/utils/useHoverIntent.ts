import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * hover แบบหน่วงเวลา — เมาส์ค้างบน element ครบ `openDelay` ms ถึงเป็น true · ออกครบ `closeDelay` ms ถึงเป็น false
 * ใช้ onEnter/onLeave ชุดเดียวกันกับหลาย element ได้ (เช่น ช่องค้นหา + แผงที่ลอยอยู่ใต้ช่อง) — เมาส์ย้ายข้ามช่องว่างระหว่างกันไม่ปิด
 * ล้าง timer ตอน unmount
 */
export function useHoverIntent({ openDelay = 150, closeDelay = 250 } = {}) {
  const [hovered, setHovered] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const schedule = useCallback((next: boolean, delay: number) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setHovered(next), delay);
  }, []);

  const onEnter = useCallback(() => schedule(true, openDelay), [schedule, openDelay]);
  const onLeave = useCallback(() => schedule(false, closeDelay), [schedule, closeDelay]);
  /** ปิดทันที (เช่น กด Esc / เลือกรายการแล้ว) */
  const reset = useCallback(() => {
    clearTimeout(timer.current);
    setHovered(false);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return { hovered, onEnter, onLeave, reset };
}
