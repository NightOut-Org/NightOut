import type * as C from '@nightout/contracts';
import type { Db } from '@nightout/types';
import { useState } from 'react';

type Change = C.SetBarsStatusBody['changes'][number];

/** ร้านที่สลับแสดง/ระงับได้ในหน้านี้ (ร่าง / รอตรวจ / ไม่อนุมัติ จัดการที่ /merchants) */
export const isToggleable = (b: Pick<Db.AdminBar, 'status'>) =>
  b.status === 'APPROVED' || b.status === 'SUSPENDED';

/**
 * draft ของสวิตช์ "แสดง" ทั้งหน้า (key = id ร้าน) — สลับกลับเป็นค่าเดิมจาก server = ลบออกจาก draft
 * `changes` = body ของ PATCH /admin/bars/status (เฉพาะร้านที่ต่างจาก server)
 */
export function useBarStatusDraft(rows: Db.AdminBar[]) {
  const [draft, setDraft] = useState<Map<string, Change>>(new Map());

  const shownOf = (b: Db.AdminBar) => (draft.get(b.id)?.status ?? b.status) === 'APPROVED';
  const changed = (b: Db.AdminBar) => draft.has(b.id);
  const reasonOf = (b: Db.AdminBar) => {
    const c = draft.get(b.id);
    return c?.status === 'SUSPENDED' ? c.reason : undefined;
  };

  const set = (b: Db.AdminBar, shown: boolean, reason?: string) =>
    setDraft((prev) => {
      const next = new Map(prev);
      if (shown === (b.status === 'APPROVED')) next.delete(b.id);
      else
        next.set(
          b.id,
          shown
            ? { id: b.id, status: 'APPROVED' }
            : { id: b.id, status: 'SUSPENDED', reason: reason ?? '' },
        );
      return next;
    });

  // ร้านที่ server เปลี่ยนไปแล้ว (เช่น คนอื่นบันทึก) จนตรงกับ draft หรือสลับไม่ได้แล้ว ไม่นับ
  const changes = rows.flatMap((b) => {
    const c = draft.get(b.id);
    return c && isToggleable(b) && c.status !== b.status ? [c] : [];
  });

  return { shownOf, changed, reasonOf, set, changes, reset: () => setDraft(new Map()) };
}
