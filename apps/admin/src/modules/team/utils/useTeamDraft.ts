import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import type * as C from '@nightout/contracts';
import type { Db } from '@nightout/types';
import { useMemo, useState } from 'react';

/**
 * draft ของหน้าทีมงาน — ลำดับ (ลากเรียง · เฉพาะซูเปอร์แอดมิน) + สวิตช์แสดงบนเว็บ แล้วบันทึกครั้งเดียว (PATCH /admin/team-members)
 * rows ใหม่จาก server (เพิ่ม/ลบ/แก้ใน Drawer) ไม่ทำให้ draft หาย: คนที่ถูกลบหลุดจากลำดับ · คนใหม่ต่อท้าย
 */
export function useTeamDraft(rows: Db.AdminTeamMember[]) {
  const [orderIds, setOrderIds] = useState<string[] | null>(null);
  const [active, setActive] = useState<Map<string, boolean>>(new Map());

  const ordered = useMemo(() => {
    if (!orderIds) return rows;
    const byId = new Map(rows.map((r) => [r.id, r]));
    const kept = orderIds.flatMap((id) => byId.get(id) ?? []);
    return [...kept, ...rows.filter((r) => !orderIds.includes(r.id))];
  }, [orderIds, rows]);

  const orderChanged = ordered.some((r, i) => r.id !== rows[i]?.id);
  const activeChanges = rows.flatMap((r) => {
    const v = active.get(r.id);
    return v !== undefined && v !== r.active ? [{ id: r.id, active: v }] : [];
  });

  const sensors = useSensors(
    // ขยับเกิน 4px ถึงเริ่มลาก — คลิกปุ่มจับเฉย ๆ ไม่นับ
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active: from, over }: DragEndEvent) => {
    if (!over || from.id === over.id) return;
    const ids = ordered.map((r) => r.id);
    setOrderIds(arrayMove(ids, ids.indexOf(String(from.id)), ids.indexOf(String(over.id))));
  };

  const activeOf = (r: Db.AdminTeamMember) => active.get(r.id) ?? r.active;
  const setRowActive = (r: Db.AdminTeamMember, v: boolean) =>
    setActive((prev) => {
      const next = new Map(prev);
      if (v === r.active) next.delete(r.id);
      else next.set(r.id, v);
      return next;
    });

  /** body ของ PATCH /admin/team-members — null = ไม่มีอะไรเปลี่ยน */
  const body: C.SaveTeamPageBody | null =
    orderChanged || activeChanges.length
      ? {
          ...(orderChanged ? { order: ordered.map((r) => r.id) } : {}),
          ...(activeChanges.length ? { active: activeChanges } : {}),
        }
      : null;

  return {
    ordered,
    sensors,
    onDragEnd,
    activeOf,
    setRowActive,
    activeChanged: (r: Db.AdminTeamMember) => activeOf(r) !== r.active,
    /** ลำดับนับเป็น 1 รายการ + แถวที่สลับการแสดง */
    count: (orderChanged ? 1 : 0) + activeChanges.length,
    orderChanged,
    body,
    reset: () => {
      setOrderIds(null);
      setActive(new Map());
    },
  };
}
