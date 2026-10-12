import { useState } from 'react';
import type { Bar } from '@/services/data';

export type Zone = Bar['zones'][number];
type Table = Zone['tables'][number];

/** id ชั่วคราวของโซน/โต๊ะที่เพิ่มในหน้า — ส่งเป็น null ให้ backend สร้าง id จริง */
export const isNewId = (id: string) => !id || id.startsWith('new:');
const newId = () => `new:${crypto.randomUUID()}`;

/** ชื่อโต๊ะถัดไปของโซน เช่น A1, A2 → A3 */
function nextTableName(z: Zone) {
  const prefix = z.tables[0]?.name.replace(/\d+$/, '') || z.name.slice(0, 1).toUpperCase();
  let n = z.tables.length + 1;
  while (z.tables.some((t) => t.name === `${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

const sameZone = (a: Zone, b: Zone) =>
  a.name === b.name &&
  a.capacityPax === b.capacityPax &&
  a.defaultDurationMinutes === b.defaultDurationMinutes &&
  a.tables.length === b.tables.length &&
  a.tables.every(
    (t, i) =>
      t.id === b.tables[i]!.id && t.name === b.tables[i]!.name && t.seats === b.tables[i]!.seats,
  );

/**
 * draft ของโซน/โต๊ะ (หน้า /merchant/tables) — เพิ่มโซน · เพิ่ม/ปิดใช้โต๊ะ · แก้ความจุ/เวลาจอง ในเครื่องก่อน
 * บันทึกทั้งชุดด้วย PUT /merchant/bars/:barId/zones (เส้นเดิมรับทั้งชุดอยู่แล้ว)
 */
export function useZonesDraft(server: Zone[]) {
  const [draft, setDraft] = useState<Zone[] | null>(null);
  const zones = draft ?? server;
  const edit = (fn: (l: Zone[]) => Zone[]) => setDraft((d) => fn(d ?? server));
  const update = (id: string, fn: (z: Zone) => Zone) =>
    edit((l) => l.map((z) => (z.id === id ? fn(z) : z)));

  const byId = new Map(server.map((z) => [z.id, z]));
  /** โซนที่เพิ่ม/แก้ (นับต่อโซน) */
  const count = zones.filter((z) => !byId.has(z.id) || !sameZone(z, byId.get(z.id)!)).length;

  return {
    zones,
    zoneState: (z: Zone): 'new' | 'changed' | null =>
      !byId.has(z.id) ? 'new' : sameZone(z, byId.get(z.id)!) ? null : 'changed',
    addZone: (v: { name: string; tables: number; seats: number; duration: number }) => {
      const prefix = v.name.slice(0, 1).toUpperCase();
      edit((l) => [
        ...l,
        {
          id: newId(),
          name: v.name,
          capacityPax: v.tables * v.seats,
          defaultDurationMinutes: v.duration,
          tables: Array.from({ length: v.tables }, (_, i): Table => ({
            id: newId(),
            name: `${prefix}${i + 1}`,
            seats: v.seats,
          })),
        },
      ]);
    },
    addTable: (z: Zone) =>
      update(z.id, (x) => ({
        ...x,
        tables: [...x.tables, { id: newId(), name: nextTableName(x), seats: 4 }],
        capacityPax: x.capacityPax + 4,
      })),
    /** ปิดใช้โต๊ะ (โต๊ะใหม่ที่ยังไม่บันทึก = เอาออกเฉย ๆ) */
    removeTable: (z: Zone, tableId: string) =>
      update(z.id, (x) => {
        const t = x.tables.find((y) => y.id === tableId);
        return {
          ...x,
          tables: x.tables.filter((y) => y.id !== tableId),
          capacityPax: Math.max(1, x.capacityPax - (t?.seats ?? 0)),
        };
      }),
    setCapacity: (z: Zone, capacityPax: number) => update(z.id, (x) => ({ ...x, capacityPax })),
    setDuration: (z: Zone, defaultDurationMinutes: number) =>
      update(z.id, (x) => ({ ...x, defaultDurationMinutes })),
    count,
    reset: () => setDraft(null),
  };
}
