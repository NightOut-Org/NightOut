import type * as C from '@nightout/contracts';
import type { Db } from '@nightout/types';
import dayjs, { type Dayjs } from 'dayjs';
import { useState } from 'react';

type LinkType = Db.BarLinkItem['type'];
type InfoKey = keyof C.AdminBarInfoBody;
type HourRow = NonNullable<C.AdminBarInfoBody['hours']>[number];

/** อาทิตย์ … เสาร์ (day_of_week 0–6) */
export const DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'] as const;
/** วันที่ร้านยังไม่ตั้งเวลา — ค่าเริ่มต้นเดียวกับหน้า /merchant/store */
const DEFAULT_OPEN = '18:00';
const DEFAULT_CLOSE = '02:00';

/** ค่าของฟอร์ม "ข้อมูลร้าน" (ที่อยู่ไม่อยู่ในฟอร์ม — แก้ผ่านขั้นตอนตรวจตำแหน่งร้าน) */
export interface InfoForm {
  name: string;
  description: string;
  phone: string;
  district_id: string | null;
  /** เฉพาะสไตล์ที่แสดงอยู่ — สไตล์ที่ซ่อนแล้วไม่ส่ง (DB เก็บลิงก์เดิมไว้) */
  style_keys: string[];
  /** ครบ 7 วันเสมอ (index = day_of_week) */
  hours: { closed: boolean; range: [Dayjs, Dayjs] | null }[];
  links: { type: LinkType; url: string }[];
}

/** แถวเมนูในตารางแก้ไข — key ใช้ใน React · id `new-<n>` = รายการใหม่ (DB สร้าง id ให้) */
export interface MenuRow {
  key: string;
  id: string;
  category: string;
  name: string;
  price: number;
  available: boolean;
  image_path: string | null;
}

const hm = (t: string | null | undefined) => (t ? t.slice(0, 5) : null);
const toTime = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return dayjs().startOf('day').hour(h ?? 0).minute(m ?? 0);
};
const blank = (s: string | null | undefined) => (s ?? '').trim() || null;

/** เวลาเปิด-ปิด 7 วันจาก server — วันที่ไม่มีแถว = 18:00–02:00 (ตรงกับค่าเริ่มต้นของฟอร์ม จะได้ไม่ขึ้นว่าแก้แล้วตั้งแต่เปิด) */
function serverHours(rows: Db.OpeningHour[]): HourRow[] {
  return DAYS.map((_, day) => {
    const h = rows.find((r) => r.day_of_week === day);
    if (!h) return { day_of_week: day, open_time: DEFAULT_OPEN, close_time: DEFAULT_CLOSE, is_closed: false };
    return h.is_closed
      ? { day_of_week: day, open_time: null, close_time: null, is_closed: true }
      : { day_of_week: day, open_time: hm(h.open_time), close_time: hm(h.close_time), is_closed: false };
  });
}

/** server → ค่าเปรียบเทียบ (รูปแบบเดียวกับ body ที่จะส่ง) */
function fromServer(d: Db.AdminBarDetails, activeKeys: Set<string>): Required<C.AdminBarInfoBody> {
  return {
    name: d.name.trim(),
    description: blank(d.description),
    phone: blank(d.phone),
    district_id: d.district_id,
    style_keys: d.style_keys.filter((k) => activeKeys.has(k)).sort(),
    hours: serverHours(d.hours),
    links: d.links.map((l) => ({ type: l.type, url: l.url.trim() })),
  };
}

/** ค่าในฟอร์ม → ค่าเปรียบเทียบ / body */
function fromForm(v: InfoForm): Required<C.AdminBarInfoBody> {
  return {
    name: (v.name ?? '').trim(),
    description: blank(v.description),
    phone: blank(v.phone),
    district_id: v.district_id ?? null,
    style_keys: [...(v.style_keys ?? [])].sort(),
    hours: DAYS.map((_, day) => {
      const h = v.hours?.[day];
      const closed = !!h?.closed;
      return {
        day_of_week: day,
        open_time: closed || !h?.range ? null : h.range[0].format('HH:mm'),
        close_time: closed || !h?.range ? null : h.range[1].format('HH:mm'),
        is_closed: closed,
      };
    }),
    links: (v.links ?? []).map((l) => ({ type: l.type, url: (l.url ?? '').trim() })),
  };
}

/** server → ค่าตั้งต้นของฟอร์ม */
export function toInfoForm(d: Db.AdminBarDetails, activeKeys: Set<string>): InfoForm {
  const s = fromServer(d, activeKeys);
  return {
    name: s.name,
    description: s.description ?? '',
    phone: s.phone ?? '',
    district_id: s.district_id,
    style_keys: s.style_keys,
    hours: s.hours.map((h) => ({
      closed: h.is_closed,
      range: h.open_time && h.close_time ? [toTime(h.open_time), toTime(h.close_time)] : null,
    })),
    links: s.links,
  };
}

const toRows = (d: Db.AdminBarDetails): MenuRow[] =>
  d.menu.map((m) => ({
    key: m.id,
    id: m.id,
    category: m.category ?? '',
    name: m.name,
    price: Number(m.price),
    available: m.available,
    image_path: m.image_path,
  }));

const toMenuBody = (rows: MenuRow[]): C.AdminMenuItem[] =>
  rows.map((r) => ({ id: r.id, category: r.category.trim(), name: r.name.trim(), price: r.price, available: r.available }));

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const INFO_KEYS: InfoKey[] = ['name', 'description', 'phone', 'district_id', 'style_keys', 'hours', 'links'];

/**
 * draft ของ Drawer "แก้ข้อมูลร้าน" — ฟอร์มข้อมูลร้าน (antd Form ส่งค่าเข้ามาทาง setInfo) + ตารางเมนู
 * แก้กลับเป็นค่าเดิมจาก server = ไม่นับว่าแก้ · body() = PUT /admin/bars/:id/details (info เฉพาะ key ที่ต่าง · menu ทั้งชุด)
 */
export function useBarDetailsDraft(details: Db.AdminBarDetails | null | undefined, activeKeys: Set<string>) {
  const [info, setInfo] = useState<InfoForm | null>(null);
  const [menu, setMenu] = useState<MenuRow[] | null>(null);
  const [seq, setSeq] = useState(0);

  const server = details ? fromServer(details, activeKeys) : null;
  const current = info ? fromForm(info) : server;
  const infoChanges: InfoKey[] =
    server && current ? INFO_KEYS.filter((k) => !same(server[k], current[k])) : [];

  const serverRows = details ? toRows(details) : [];
  const rows = menu ?? serverRows;
  const menuChanged = !!details && !same(toMenuBody(rows), toMenuBody(serverRows));
  const menuErrors = rows.filter((r) => !r.name.trim() || !Number.isFinite(r.price)).length;

  const editMenu = (fn: (rows: MenuRow[]) => MenuRow[]) => setMenu((prev) => fn(prev ?? serverRows));

  return {
    infoChanges,
    infoDirty: infoChanges.length > 0,
    setInfo,
    rows,
    menuChanged,
    menuErrors,
    count: (infoChanges.length > 0 ? 1 : 0) + (menuChanged ? 1 : 0),
    categories: [...new Set(rows.map((r) => r.category.trim()).filter(Boolean))],
    addItem: () => {
      const id = `new-${seq + 1}`;
      setSeq((n) => n + 1);
      editMenu((list) => [
        ...list,
        { key: id, id, category: list.at(-1)?.category ?? '', name: '', price: 0, available: true, image_path: null },
      ]);
    },
    updateItem: (key: string, patch: Partial<Omit<MenuRow, 'key' | 'id' | 'image_path'>>) =>
      editMenu((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r))),
    removeItem: (key: string) => editMenu((list) => list.filter((r) => r.key !== key)),
    /** body ของ PUT /admin/bars/:id/details — ส่งค่าที่ผ่าน validate ของฟอร์มแล้ว (ไม่ได้แก้ข้อมูลร้าน = ไม่ส่ง info) */
    body: (values?: InfoForm): C.AdminBarDetailsBody => {
      const out: C.AdminBarDetailsBody = {};
      if (values && server) {
        const next = fromForm(values);
        const changed = INFO_KEYS.filter((k) => !same(server[k], next[k]));
        if (changed.length) out.info = Object.fromEntries(changed.map((k) => [k, next[k]])) as C.AdminBarInfoBody;
      }
      if (menuChanged) out.menu = toMenuBody(rows);
      return out;
    },
    reset: () => {
      setInfo(null);
      setMenu(null);
    },
  };
}

export type BarDetailsDraft = ReturnType<typeof useBarDetailsDraft>;
