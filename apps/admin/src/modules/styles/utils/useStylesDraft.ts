import type * as C from '@nightout/contracts';
import type { Db } from '@nightout/types';
import { useState } from 'react';

/** 1 แถวในตาราง /styles — id `new-<n>` = สไตล์ใหม่ที่ยังไม่บันทึก */
export interface StyleRow {
  id: string;
  name_th: string;
  icon: string;
  active: boolean;
  bar_count: number;
  fan_count: number;
}
export type StyleError = 'empty' | 'duplicate';

export const isNewStyle = (r: Pick<StyleRow, 'id'>) => r.id.startsWith('new-');
const nameKey = (s: string) => s.trim().toLowerCase();
const fromServer = (s: Db.AdminStyle): StyleRow => ({
  id: s.id,
  name_th: s.name_th,
  icon: s.icon,
  active: s.active,
  bar_count: s.bar_count,
  fan_count: s.fan_count,
});

/** ชื่อสไตล์ที่การ์ดหมวดหน้าแรกใช้กรอง (/search?style=<ชื่อ>) — ตัวกรองหน้าค้นหาเทียบชื่อตรงตัว (ตัวพิมพ์เล็ก/ใหญ่มีผล) */
const linkedStyleNames = (linkTo: string) =>
  new URLSearchParams(linkTo.split('?')[1] ?? '').getAll('style').map((s) => s.trim());

/**
 * draft ของหน้า /styles — แก้ทั้งตารางในเครื่องก่อน แล้วบันทึกครั้งเดียว (PUT /admin/styles · ลบไม่ได้ ใช้ซ่อนแทน)
 * แก้กลับเป็นค่าเดิมจาก server = ไม่นับ · `affected` = การ์ดหมวดหน้าแรกที่ลิงก์ด้วยชื่อสไตล์เดิมซึ่งจะเปลี่ยนชื่อ/ถูกซ่อน
 */
export function useStylesDraft(server: Db.AdminStyle[], homeCategories: Db.AdminHomeCategory[]) {
  const [draft, setDraft] = useState<StyleRow[] | null>(null);
  const [seq, setSeq] = useState(0);
  const base = server.map(fromServer);
  const list = draft ?? base;
  const byId = new Map(server.map((s, i) => [s.id, { s, i }]));

  const edit = (fn: (rows: StyleRow[]) => StyleRow[]) => setDraft((prev) => fn(prev ?? base));
  const patch = (id: string, p: Partial<Pick<StyleRow, 'name_th' | 'icon' | 'active'>>) =>
    edit((rows) => rows.map((r) => (r.id === id ? { ...r, ...p } : r)));

  /** แถวที่ต่างจาก server (ใหม่ · ชื่อ · ไอคอน · แสดง · ตำแหน่ง) */
  const changedIds = new Set(
    list.flatMap((r, i) => {
      const o = byId.get(r.id);
      if (!o) return [r.id];
      const same = o.i === i && o.s.name_th === r.name_th.trim() && o.s.icon === r.icon && o.s.active === r.active;
      return same ? [] : [r.id];
    }),
  );

  const counts = new Map<string, number>();
  for (const r of list) counts.set(nameKey(r.name_th), (counts.get(nameKey(r.name_th)) ?? 0) + 1);
  const errors = new Map<string, StyleError>();
  for (const r of list) {
    if (!r.name_th.trim()) errors.set(r.id, 'empty');
    else if ((counts.get(nameKey(r.name_th)) ?? 0) > 1) errors.set(r.id, 'duplicate');
  }

  /** ชื่อเดิม (server) ของสไตล์ที่จะเปลี่ยนชื่อ หรือจะถูกซ่อน */
  const goneNames = new Set(
    list.flatMap((r) => {
      const o = byId.get(r.id)?.s;
      if (!o) return [];
      // เทียบตรงตัว: เปลี่ยนแค่ตัวพิมพ์ (Rooftop → ROOFTOP) ก็ทำให้ลิงก์ ?style=Rooftop ว่าง
      const renamed = o.name_th.trim() !== r.name_th.trim();
      const hidden = o.active && !r.active;
      return renamed || hidden ? [o.name_th.trim()] : [];
    }),
  );
  const affected = goneNames.size
    ? homeCategories.filter((c) => linkedStyleNames(c.link_to).some((n) => goneNames.has(n)))
    : [];

  return {
    list,
    changes: changedIds.size,
    isChanged: (r: StyleRow) => changedIds.has(r.id),
    errors,
    affected,
    add: () => {
      const id = `new-${seq + 1}`;
      setSeq((n) => n + 1);
      edit((rows) => [...rows, { id, name_th: '', icon: 'Sparkle', active: true, bar_count: 0, fan_count: 0 }]);
    },
    /** เอาสไตล์ใหม่ที่ยังไม่บันทึกออก (สไตล์เดิมลบไม่ได้) */
    discard: (id: string) => edit((rows) => rows.filter((r) => r.id !== id || !isNewStyle(r))),
    rename: (id: string, name_th: string) => patch(id, { name_th }),
    setIcon: (id: string, icon: string) => patch(id, { icon }),
    toggle: (id: string, active: boolean) => patch(id, { active }),
    move: (i: number, dir: -1 | 1) =>
      edit((rows) => {
        const j = i + dir;
        if (j < 0 || j >= rows.length) return rows;
        const next = [...rows];
        [next[i], next[j]] = [next[j]!, next[i]!];
        return next;
      }),
    reset: () => setDraft(null),
    body: (): C.SaveStylesBody => ({
      items: list.map(({ id, name_th, icon, active }) => ({
        id: isNewStyle({ id }) ? null : id,
        name_th: name_th.trim(),
        icon,
        active,
      })),
    }),
  };
}
