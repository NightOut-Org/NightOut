import { SITE_NAV_REQUIRED, type SaveSiteNavBody, type SiteNavKey } from '@nightout/contracts';
import type { Db } from '@nightout/types';
import { useState } from 'react';

export type NavMode = 'desktop' | 'mobile';
export type NavRow = Pick<Db.AdminSiteNavItem, 'key' | 'label' | 'desktop_visible' | 'mobile_visible'>;

const visibleKey = (mode: NavMode) => (mode === 'desktop' ? 'desktop_visible' : 'mobile_visible');

interface Draft {
  rows: Map<SiteNavKey, NavRow>;
  /** key เรียงตามลำดับของแต่ละชุด */
  order: Record<NavMode, SiteNavKey[]>;
}

const fromServer = (server: Db.AdminSiteNavItem[]): Draft => ({
  rows: new Map(server.map((s) => [s.key, { key: s.key, label: s.label, desktop_visible: s.desktop_visible, mobile_visible: s.mobile_visible }])),
  order: {
    desktop: [...server].sort((a, b) => a.desktop_order - b.desktop_order).map((s) => s.key),
    mobile: [...server].sort((a, b) => a.mobile_order - b.mobile_order).map((s) => s.key),
  },
});

/**
 * draft ของหน้าเมนู navbar — แก้ในเครื่องก่อนแล้วบันทึกครั้งเดียว (PUT /admin/site-nav)
 * ชื่อใช้ร่วมกันทั้ง 2 ชุด · ลำดับ / ซ่อน-แสดง แยก desktop กับมือถือ · แก้กลับเป็นค่าเดิม = ไม่นับ
 */
export function useSiteNavDraft(server: Db.AdminSiteNavItem[]) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const base = fromServer(server);
  const cur = draft ?? base;
  const byKey = new Map(server.map((s) => [s.key, s]));

  const edit = (fn: (d: Draft) => Draft) => setDraft((prev) => fn(prev ?? base));
  const patch = (key: SiteNavKey, p: Partial<NavRow>) =>
    edit((d) => {
      const rows = new Map(d.rows);
      const row = rows.get(key);
      if (row) rows.set(key, { ...row, ...p });
      return { ...d, rows };
    });

  /** เมนูที่ต่างจาก server (ชื่อ · ซ่อน/แสดง · ตำแหน่งในชุดใดชุดหนึ่ง) */
  const changed = new Set(
    [...cur.rows.values()].flatMap((r) => {
      const s = byKey.get(r.key);
      if (!s) return [];
      const same =
        s.label === r.label.trim() &&
        s.desktop_visible === r.desktop_visible &&
        s.mobile_visible === r.mobile_visible &&
        cur.order.desktop.indexOf(r.key) === s.desktop_order &&
        cur.order.mobile.indexOf(r.key) === s.mobile_order;
      return same ? [] : [r.key];
    }),
  );
  const errors = new Set([...cur.rows.values()].filter((r) => !r.label.trim()).map((r) => r.key));

  return {
    /** เมนูของชุดนั้นเรียงตามลำดับ (รวมที่ซ่อน) */
    list: (mode: NavMode) => cur.order[mode].flatMap((k) => cur.rows.get(k) ?? []),
    isVisible: (mode: NavMode, r: NavRow) => r[visibleKey(mode)],
    changes: changed.size,
    isChanged: (key: SiteNavKey) => changed.has(key),
    errors,
    canHide: (key: SiteNavKey) => key !== SITE_NAV_REQUIRED,
    rename: (key: SiteNavKey, label: string) => patch(key, { label }),
    toggle: (mode: NavMode, key: SiteNavKey, visible: boolean) => patch(key, { [visibleKey(mode)]: visible }),
    move: (mode: NavMode, i: number, dir: -1 | 1) =>
      edit((d) => {
        const j = i + dir;
        const list = d.order[mode];
        if (j < 0 || j >= list.length) return d;
        const next = [...list];
        [next[i], next[j]] = [next[j]!, next[i]!];
        return { ...d, order: { ...d.order, [mode]: next } };
      }),
    reset: () => setDraft(null),
    body: (): SaveSiteNavBody => ({
      items: [...cur.rows.values()].map((r) => ({
        key: r.key,
        label: r.label.trim(),
        desktop_order: cur.order.desktop.indexOf(r.key),
        desktop_visible: r.desktop_visible,
        mobile_order: cur.order.mobile.indexOf(r.key),
        mobile_visible: r.mobile_visible,
      })),
    }),
  };
}
