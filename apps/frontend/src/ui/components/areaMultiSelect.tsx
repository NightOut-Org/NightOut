import type { TambonOption } from '@nightout/contracts';
import { Select } from 'antd';
import { useMemo, useState } from 'react';
import { AREA_PICKS, type AreaPick } from '@/services/data';
import { useTambonSearch, useTambonsByCodes } from '@/services/api/areas';
import { isTambonCode, tambonOptionText } from '@/ui/utils/area';

const GROUPS: { kind: AreaPick['kind']; title: string }[] = [
  { kind: 'district', title: 'ย่าน' },
  { kind: 'amphoe', title: 'อำเภอ / เขต' },
  { kind: 'province', title: 'จังหวัด' },
];
/** ไม่มีคำค้น = แสดงแค่นี้ต่อกลุ่ม (ทั้งประเทศมี 1,800+ รายการ) · มีคำค้น = เจอเท่าไหร่แสดงเท่านั้น */
const PREVIEW = 8;

interface Picked {
  value: string;
  label: string;
}

/**
 * เลือก "พื้นที่ที่ชอบ" ได้หลายอัน ทุกระดับ: ย่าน · อำเภอ/เขต · จังหวัด (ค้นในเครื่อง) + ตำบล/แขวง 7,425 แห่ง (ค้นจาก backend ตอนพิมพ์ ≥ 2 ตัวอักษร)
 * ค่า = array ผสม: id ย่าน (uuid) · รหัส pcode ของจังหวัด/อำเภอ/ตำบล (TH…) — แยกด้วย `splitAreaPicks` ตอนบันทึก
 * ป้ายที่เลือกแล้วแสดงชื่อเองด้วย labelInValue → รายการค้นหาแสดงเฉพาะที่ตรงกับคำค้น ไม่ปนของที่เลือกไว้
 */
export function AreaMultiSelect({
  value,
  onChange,
  placeholder = 'พิมพ์ชื่อย่าน ตำบล อำเภอ หรือจังหวัด',
}: {
  value?: string[];
  onChange?: (v: string[]) => void;
  placeholder?: string;
}) {
  const [term, setTerm] = useState('');
  /** ชื่อของตัวเลือกที่เพิ่งเลือกในหน้านี้ (ตำบลจากผลค้นหา) — ไม่ต้องรอขอชื่อจาก backend อีกรอบ */
  const [chosen, setChosen] = useState<Map<string, string>>(() => new Map());
  const q = term.trim();
  const picked = useMemo(() => value ?? [], [value]);
  const search = useTambonSearch(q);
  // ตำบลที่เลือกไว้ก่อนหน้า (เปิดฟอร์มแก้) — ขอชื่อจากรหัสทีเดียว
  const known = useTambonsByCodes(picked.filter(isTambonCode));

  const pickLabel = useMemo(() => new Map(AREA_PICKS.map((p) => [p.value, p.label])), []);
  const selected: Picked[] = picked.map((v) => {
    const t = known.data?.find((x) => x.code === v);
    return {
      value: v,
      label: chosen.get(v) ?? pickLabel.get(v) ?? (t ? tambonOptionText(t).label : v),
    };
  });

  const { options, hints } = useMemo(() => {
    const hints = new Map<string, string>();
    const match = (p: AreaPick) => !q || p.label.includes(q) || p.hint.includes(q);
    const groups = GROUPS.map((g) => {
      const all = AREA_PICKS.filter((p) => p.kind === g.kind && match(p));
      const shown = q ? all : all.slice(0, PREVIEW);
      return {
        label: g.title,
        title: g.title,
        options: shown.map((p) => {
          hints.set(p.value, p.hint);
          return { value: p.value, label: p.label };
        }),
      };
    });
    const tambons = new Map<string, TambonOption>();
    for (const t of q.length >= 2 ? (search.data ?? []) : []) tambons.set(t.code, t);
    groups.push({
      label: 'ตำบล / แขวง',
      title: 'ตำบล / แขวง',
      options: [...tambons.values()].map((t) => {
        const { label, hint } = tambonOptionText(t);
        hints.set(t.code, hint);
        return { value: t.code, label };
      }),
    });
    return { options: groups.filter((g) => g.options.length), hints };
  }, [q, search.data]);

  return (
    <Select<Picked[]>
      mode="multiple"
      labelInValue
      value={selected}
      onChange={(v) => {
        setTerm('');
        setChosen((prev) => {
          const next = new Map(prev);
          for (const x of v) next.set(x.value, String(x.label));
          return next;
        });
        onChange?.(v.map((x) => x.value));
      }}
      showSearch={{ filterOption: false, searchValue: term, onSearch: setTerm }}
      placeholder={placeholder}
      loading={search.isFetching}
      maxCount={20}
      notFoundContent={
        q.length < 2 ? 'พิมพ์ชื่อพื้นที่อย่างน้อย 2 ตัวอักษร' : 'ไม่พบพื้นที่ชื่อนี้'
      }
      options={options}
      optionRender={(o) => (
        <span className="flex items-center justify-between gap-3">
          <span className="min-w-0 truncate">{o.label}</span>
          {hints.get(String(o.value)) && (
            <span className="shrink-0 text-xs text-muted">{hints.get(String(o.value))}</span>
          )}
        </span>
      )}
    />
  );
}
