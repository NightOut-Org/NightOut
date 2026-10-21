import { Select } from 'antd';
import { useState } from 'react';
import { AREA_OPTIONS, listBars, type AreaOpt, type BarFilter } from '@/services/data';
import { tambonOptionText } from '@/ui/utils/area';
import { useTambonSearch } from '../api';

const GROUPS: { kind: AreaOpt['kind']; title: string }[] = [
  { kind: 'district', title: 'ย่าน' },
  { kind: 'amphoe', title: 'อำเภอ / เขต' },
  { kind: 'province', title: 'จังหวัด' },
];
/** ค่าของตัวเลือกตำบลใน Select = "t:<รหัส>" (ย่าน/อำเภอ/จังหวัดใช้ชื่อ) */
const TAMBON = 't:';

/**
 * ช่องเลือกพื้นที่ของตัวกรอง /search — ย่าน · อำเภอ/เขต · จังหวัด (ครบทั้งประเทศ ค้นในเครื่อง)
 * + ตำบล/แขวง 7,425 แห่ง ค้นจาก GET /public/tambons ตอนพิมพ์ ≥ 2 ตัวอักษร (เลือกแล้วกรองด้วยรหัส ?tambon=)
 */
export function AreaSelect({ f, set }: { f: BarFilter; set: (p: Partial<BarFilter>) => void }) {
  const [term, setTerm] = useState('');
  const q = term.trim();
  const tambons = useTambonSearch(q);

  const tambonCount = new Map<string, number>();
  for (const b of listBars({})) {
    if (b.area) tambonCount.set(b.area.tambonCode, (tambonCount.get(b.area.tambonCode) ?? 0) + 1);
  }
  /** บรรทัดรอง + จำนวนร้านของแต่ละตัวเลือก (ใช้ตอนวาดแถว) */
  const meta = new Map<string, { hint: string; count: number }>(
    AREA_OPTIONS.map((o) => [o.value, { hint: o.hint, count: o.count }]),
  );

  const local = GROUPS.map((g) => ({
    label: g.title,
    title: g.title,
    options: AREA_OPTIONS.filter(
      (o) => o.kind === g.kind && (!q || o.label.includes(q) || o.value.includes(q)),
    ).map((o) => ({ value: o.value, label: o.label })),
  }));
  const tambonOptions = (q.length >= 2 ? (tambons.data ?? []) : []).map((t) => {
    const { label, hint } = tambonOptionText(t);
    meta.set(TAMBON + t.code, { hint, count: tambonCount.get(t.code) ?? 0 });
    return { value: TAMBON + t.code, label };
  });
  // ตำบลที่เลือกอยู่ต้องมีในรายการเสมอ ไม่งั้น Select แสดงรหัสแทนชื่อ
  if (f.tambon && !tambonOptions.some((o) => o.value === TAMBON + f.tambon)) {
    tambonOptions.push({ value: TAMBON + f.tambon, label: f.tambonLabel ?? 'ตำบลที่เลือก' });
  }
  const options = [
    ...local,
    { label: 'ตำบล / แขวง', title: 'ตำบล / แขวง', options: tambonOptions },
  ].filter((g) => g.options.length);

  return (
    <Select
      className="mb-2.5 w-full"
      size="large"
      allowClear
      showSearch={{ filterOption: false, searchValue: term, onSearch: setTerm }}
      placeholder="ค้นหาย่าน ตำบล/แขวง อำเภอ/เขต หรือจังหวัด"
      aria-label="พื้นที่"
      value={f.tambon ? TAMBON + f.tambon : f.district}
      loading={tambons.isFetching}
      notFoundContent={
        q.length < 2 ? 'พิมพ์ชื่อพื้นที่อย่างน้อย 2 ตัวอักษร' : 'ไม่พบพื้นที่ชื่อนี้'
      }
      onChange={(v?: string) => {
        setTerm('');
        if (!v) set({ district: undefined, tambon: undefined, tambonLabel: undefined });
        else if (v.startsWith(TAMBON)) {
          const label = tambonOptions.find((o) => o.value === v)?.label;
          set({ tambon: v.slice(TAMBON.length), tambonLabel: label, district: undefined });
        } else set({ district: v, tambon: undefined, tambonLabel: undefined });
      }}
      options={options}
      optionRender={(o) => {
        const m = meta.get(String(o.value));
        return (
          <span className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate">
              {o.label}
              {m?.hint && <span className="ml-1.5 text-xs text-muted">{m.hint}</span>}
            </span>
            <span className="shrink-0 text-xs text-muted">
              {m?.count ? `${m.count} ร้าน` : 'ยังไม่มีร้าน'}
            </span>
          </span>
        );
      }}
    />
  );
}
