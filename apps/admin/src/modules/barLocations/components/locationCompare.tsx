import type { Db } from '@nightout/types';
import { distanceMeters } from '@nightout/utils';
import { Table, Tag } from 'antd';
import { coordText, movedText, realPinOf, transitText } from '@/ui/utils/location';

export interface CompareColumn {
  key: string;
  title: string;
  fields: Db.BarLocationFields | null;
  /** เทียบกับคอลัมน์ไหน (index) — ไม่ใส่ = ไม่ติดป้าย */
  against?: number;
  /** ป้ายเมื่อค่าต่างจากคอลัมน์ที่เทียบ (ค่าเริ่มต้น "เปลี่ยน") */
  changedLabel?: string;
}

type RowKey = 'address' | 'parking' | 'transit' | 'pin';
/** คอลัมน์ป้ายแคบพอให้ 2 คอลัมน์ข้อมูลพอดีจอมือถือ (Drawer เต็มจอ) */
const LABEL_WIDTH = 72;
const ROWS: { key: RowKey; label: string }[] = [
  { key: 'address', label: 'ที่อยู่' },
  { key: 'parking', label: 'ที่จอดรถ' },
  { key: 'transit', label: 'รถไฟฟ้า' },
  { key: 'pin', label: 'พิกัด' },
];

/** ข้อความของช่อง (null = ไม่ระบุ) */
function cellText(f: Db.BarLocationFields, key: RowKey): string | null {
  if (key === 'address') return f.address?.trim() || null;
  if (key === 'parking') return f.parking_note?.trim() || null;
  if (key === 'transit') return transitText(f);
  const pin = realPinOf(f);
  return pin ? coordText(pin) : null;
}

function differs(a: Db.BarLocationFields, b: Db.BarLocationFields, key: RowKey): boolean {
  if (key !== 'pin') return cellText(a, key) !== cellText(b, key);
  const pa = realPinOf(a);
  const pb = realPinOf(b);
  if (!pa || !pb) return !!pa !== !!pb;
  return distanceMeters(pa, pb) >= 2;
}

/** ตารางเทียบตำแหน่ง (ตอนนี้ / ร้านขอ / ใช้จริง …) — ช่องที่ต่างจากคอลัมน์ที่เทียบติดป้าย */
export function LocationCompare({ columns }: { columns: CompareColumn[] }) {
  return (
    <Table<{ key: RowKey; label: string }>
      size="small"
      bordered
      pagination={false}
      rowKey="key"
      dataSource={ROWS}
      scroll={{ x: LABEL_WIDTH + columns.length * 128 }}
      columns={[
        {
          title: '',
          dataIndex: 'label',
          width: LABEL_WIDTH,
          onCell: () => ({ className: 'whitespace-nowrap font-medium' }),
        },
        ...columns.map((c) => ({
          title: c.title,
          key: c.key,
          render: (_: unknown, row: { key: RowKey }) => {
            if (!c.fields) return <span className="text-muted">-</span>;
            const value = cellText(c.fields, row.key);
            const base = c.against !== undefined ? columns[c.against]?.fields : null;
            const changed = !!base && differs(base, c.fields, row.key);
            const basePin = base ? realPinOf(base) : null;
            const pin = realPinOf(c.fields);
            return (
              <span className="flex flex-col items-start gap-1">
                <span className={`break-words ${value ? (row.key === 'pin' ? 'tabular-nums' : '') : 'text-muted'}`}>
                  {value ?? (row.key === 'pin' ? 'ยังไม่ปักหมุด' : 'ไม่ระบุ')}
                </span>
                {changed && (
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    <Tag color="gold" className="!m-0">
                      {c.changedLabel ?? 'เปลี่ยน'}
                    </Tag>
                    {row.key === 'pin' && basePin && pin && (
                      <span className="text-xs text-muted">ย้าย {movedText(basePin, pin)}</span>
                    )}
                  </span>
                )}
              </span>
            );
          },
        })),
      ]}
    />
  );
}
