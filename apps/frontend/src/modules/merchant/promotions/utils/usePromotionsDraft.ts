import type { BarPromotion } from '@nightout/mock';
import { useState } from 'react';

/**
 * draft ของรายการโปร (หน้า /merchant/promotions) — สร้าง/ลบ/เปิด-ปิด ในเครื่องก่อน แล้วบันทึกทั้งชุดพร้อมค่าธรรมเนียม
 * โปรใหม่มี id `new-…` (backend สร้าง id จริงให้)
 */
export function usePromotionsDraft(server: BarPromotion[]) {
  const [draft, setDraft] = useState<BarPromotion[] | null>(null);
  const list = draft ?? server;
  const edit = (fn: (l: BarPromotion[]) => BarPromotion[]) => setDraft((d) => fn(d ?? server));

  const byId = new Map(server.map((p) => [p.id, p]));
  const added = list.filter((p) => !byId.has(p.id)).length;
  const removed = server.filter((p) => !list.some((x) => x.id === p.id)).length;
  const toggled = list.filter((p) => byId.has(p.id) && byId.get(p.id)!.active !== p.active).length;

  return {
    list,
    /** โปรใหม่ หรือสลับเปิด/ปิดแล้วยังไม่บันทึก */
    stateOf: (p: BarPromotion): 'new' | 'changed' | null =>
      !byId.has(p.id) ? 'new' : byId.get(p.id)!.active !== p.active ? 'changed' : null,
    add: (p: BarPromotion) => edit((l) => [...l, p]),
    remove: (id: string) => edit((l) => l.filter((x) => x.id !== id)),
    setActive: (id: string, active: boolean) =>
      edit((l) => l.map((x) => (x.id === id ? { ...x, active } : x))),
    count: added + removed + toggled,
    reset: () => setDraft(null),
  };
}
