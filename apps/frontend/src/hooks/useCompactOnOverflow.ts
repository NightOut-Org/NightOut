import { useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

/**
 * แถบแนวนอนที่เนื้อหาล้น → `compact = true` ให้ส่วนที่ย่อได้ (เช่นชื่อบนปุ่มบัญชี) หดลง
 * จำความกว้างตอนแสดงเต็มไว้ แล้วกลับเป็นแบบเต็มเมื่อกว้างพอเท่านั้น (ไม่สลับไปมา)
 * - `layoutKey` = สิ่งที่ทำให้แถบเปลี่ยนขนาดจาก state ของเราเอง (เช่น navbar หดตอนเลื่อน) → ตรวจใน useLayoutEffect
 *   ของ commit เดียวกัน = ย่อก่อน browser paint (ถ้ารอ ResizeObserver จะเห็นล้น 1–2 เฟรม)
 * - `contentKey` = ชื่อเมนู/ชื่อผู้ใช้เปลี่ยน → กลับไปวัดจากแบบเต็มใหม่
 * - ResizeObserver (ย่อหน้าต่าง · ฟอนต์โหลดเสร็จ) ใช้ flushSync → ย่อก่อน paint เหมือนกัน
 * วัดจาก layout (scrollWidth/clientWidth) ไม่ใช่ getBoundingClientRect → ไม่เพี้ยนตอน motion layout animation
 */
export function useCompactOnOverflow<T extends HTMLElement>(contentKey: string, layoutKey: unknown) {
  const ref = useRef<T>(null);
  const [compact, setCompact] = useState(false);
  const fullWidth = useRef(0);

  // เนื้อหาเปลี่ยน → กลับไปวัดจากแบบเต็มใหม่ (ปรับ state ระหว่าง render — ไม่กระพริบ)
  const [measuredKey, setMeasuredKey] = useState(contentKey);
  if (measuredKey !== contentKey) {
    setMeasuredKey(contentKey);
    setCompact(false);
  }

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    /** ค่าที่ควรเป็นจากขนาดตอนนี้ (null = เหมือนเดิม) */
    const next = () => {
      if (!compact) {
        if (el.scrollWidth <= el.clientWidth) return null;
        fullWidth.current = el.scrollWidth;
        return true;
      }
      return el.clientWidth >= fullWidth.current ? false : null;
    };
    const first = next();
    if (first !== null) setCompact(first);
    const ro = new ResizeObserver(() => {
      const v = next();
      if (v !== null) flushSync(() => setCompact(v));
    });
    ro.observe(el);
    for (const child of el.children) ro.observe(child);
    return () => ro.disconnect();
  }, [compact, contentKey, layoutKey]);

  return { ref, compact };
}
