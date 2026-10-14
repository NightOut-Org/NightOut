import type * as C from '@nightout/contracts';
import { TABLE_FEE_SHORT } from '@nightout/utils';
import { Alert, Button, Skeleton } from 'antd';
import { Tile } from '@/ui/components/merchantUi';
import { baht } from '@/ui/utils/format';
import { useSalesStats } from '../api';
import { delta } from '../utils/delta';
import { KpiTile } from './kpiTile';

type Key = 'est_spend_per_booking' | 'est_spend_per_person' | 'table_fee_avg' | 'table_fee_total';

const TILES: { key: Key; title: string; kind: 'est' | 'fee' }[] = [
  { key: 'est_spend_per_booking', title: 'ยอดใช้จ่ายเฉลี่ย / โต๊ะ', kind: 'est' },
  { key: 'est_spend_per_person', title: 'ยอดใช้จ่ายเฉลี่ย / คน', kind: 'est' },
  { key: 'table_fee_avg', title: `${TABLE_FEE_SHORT} เฉลี่ย / การจอง`, kind: 'fee' },
  { key: 'table_fee_total', title: `${TABLE_FEE_SHORT} ที่ร้านได้`, kind: 'fee' },
];

/** บรรทัดล่างของการ์ด: เทียบช่วงก่อนหน้า (ต้องมีตัวเลขทั้ง 2 ช่วง) · ไม่มีตัวเลขช่วงนี้ = บอกเหตุผล */
function subLine(key: Key, kind: 'est' | 'fee', cur: C.SalesStatsPeriod, prev: C.SalesStatsPeriod, days: number) {
  const value = cur[key];
  if (value == null) {
    if (kind === 'fee') return { text: `ยังไม่มี ${TABLE_FEE_SHORT} ในช่วงนี้`, cls: 'text-muted' };
    return cur.checked_in_bookings === 0
      ? { text: 'ยังไม่มีการเช็กอินในช่วงนี้', cls: 'text-muted' }
      : { text: 'ใส่เมนูและราคาก่อน ระบบจึงประเมินได้', cls: 'text-muted' };
  }
  const before = prev[key];
  const d = before == null ? null : delta(value, before, '%');
  const text = d ? `${d.text} จาก ${days} วันก่อน` : 'ยังไม่มีข้อมูลช่วงก่อนหน้า';
  return {
    text: key === 'table_fee_total' ? `${cur.table_fee_bookings.toLocaleString('th-TH')} การจอง · ${text}` : text,
    cls: d?.cls ?? 'text-muted',
  };
}

/** ยอดขายเฉลี่ย (ประมาณการ) — Table Fee ที่ร้านได้ + ยอดใช้จ่ายโดยประมาณของการจองที่เช็กอิน · ตัวเลขจาก API (rpc bar_sales_stats) */
export function SalesSection({ barId, days }: { barId: string; days: number }) {
  const { data, error, isPending, isPlaceholderData, refetch } = useSalesStats(barId, days);
  // ระหว่างโหลดช่วงใหม่ยังแสดงช่วงเดิม (keepPreviousData) → ใช้ days ของข้อมูลที่แสดงอยู่
  const shownDays = data?.days ?? days;

  return (
    <section className="flex flex-col gap-2.5 lg:gap-3" aria-labelledby="sales-heading" aria-busy={isPending || isPlaceholderData}>
      <div className="flex items-center gap-2">
        <h2 id="sales-heading" className="text-sm font-semibold lg:text-base">
          ยอดขายเฉลี่ย
        </h2>
        <span className="rounded-full border border-gold/40 px-2 text-[11px] text-gold-text">ประมาณการ</span>
      </div>

      {error && !data ? (
        <Alert
          type="warning"
          showIcon
          title={(error as Error).message}
          action={
            <Button size="small" onClick={() => void refetch()}>
              ลองใหม่
            </Button>
          }
        />
      ) : (
        <div
          className={`grid grid-cols-2 gap-2.5 transition-opacity lg:grid-cols-4 lg:gap-4 ${isPlaceholderData ? 'opacity-60' : ''}`}
        >
          {TILES.map((t) => {
            if (!data) {
              return (
                <Tile key={t.key} className="flex flex-col gap-1 !rounded-2xl !p-3 lg:!rounded-[20px] lg:!p-[18px]">
                  <span className="text-xs text-muted lg:text-[13px]">{t.title}</span>
                  <Skeleton active title={false} paragraph={{ rows: 2 }} />
                </Tile>
              );
            }
            const value = data.current[t.key];
            const sub = subLine(t.key, t.kind, data.current, data.previous, shownDays);
            return (
              <KpiTile
                key={t.key}
                title={t.title}
                value={value == null ? '—' : baht(value)}
                sub={sub.text}
                subClass={sub.cls}
              />
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-muted lg:text-xs">
        ยอดใช้จ่ายเป็นการประมาณ: ราคาที่ลูกค้าประเมินตอนจอง (ถ้ามี) หรือราคาต่อคนโดยประมาณของร้าน × จำนวนคนที่เช็กอินจริง —
        NightOut ไม่เห็นบิลจริงของร้าน · {TABLE_FEE_SHORT} = ค่าธรรมเนียมจองโต๊ะที่ลูกค้าจ่ายผ่านแอปและร้านได้รับ
        (รวมที่รอโอน · ไม่รวมที่คืนลูกค้า)
      </p>
    </section>
  );
}
