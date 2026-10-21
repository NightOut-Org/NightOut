import { MapPin } from '@phosphor-icons/react';
import type { AreaAtPointResult } from '@nightout/contracts';
import { amphoeLabel, districtLabel, tambonLabel } from '@nightout/utils';
import { Skeleton } from 'antd';

/** ชื่อพื้นที่จากผล GET /public/area */
export function pinAreaParts(a?: AreaAtPointResult) {
  const parts = {
    tambon: a?.tambon?.name_th,
    amphoe: a?.amphoe?.name_th,
    province: a?.province?.name_th,
    provinceCode: a?.province?.code,
  };
  const head = a?.district ? districtLabel(a.district.name_th) : tambonLabel(parts);
  const rest = [a?.district ? tambonLabel(parts) : '', amphoeLabel(parts), parts.province ?? '']
    .filter(Boolean)
    .join(' ');
  return { head, rest, found: !!a?.tambon };
}

/**
 * พื้นที่ของร้านที่ระบบหาจากหมุด (สมัครร้าน · ข้อมูลร้าน) — ร้านไม่ต้องเลือกย่านเอง
 * ตัวหนา = ย่าน (ไม่อยู่ในย่านไหน = ตำบล/แขวง) · บรรทัดล่าง = ตำบล อำเภอ จังหวัด
 */
export function PinAreaCard({
  area,
  loading,
  hasPin,
}: {
  area?: AreaAtPointResult;
  loading: boolean;
  hasPin: boolean;
}) {
  const { head, rest, found } = pinAreaParts(area);
  return (
    <div
      className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-3.5"
      aria-live="polite"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gold/15 text-xl text-gold-text">
        <MapPin weight="fill" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[13px] text-muted">พื้นที่ของร้าน</span>
        {!hasPin ? (
          <span className="text-sm text-muted">
            ปักหมุดแล้วระบบจะบอกย่าน เขต/อำเภอ และจังหวัดให้
          </span>
        ) : loading ? (
          <Skeleton active title={false} paragraph={{ rows: 2, width: ['55%', '80%'] }} />
        ) : found ? (
          <>
            <b className="break-words text-[15px] font-semibold">{head}</b>
            <span className="break-words text-[13px] text-muted">{rest}</span>
          </>
        ) : (
          <span className="text-sm text-muted">
            หาพื้นที่ของหมุดนี้ไม่เจอ ตรวจว่าหมุดอยู่ในประเทศไทย
          </span>
        )}
        {hasPin && found && (
          <span className="mt-1 text-xs text-muted">
            ระบบเลือกจากหมุด ย้ายหมุดแล้วพื้นที่เปลี่ยนตาม
          </span>
        )}
        {/* สัญญาอนุญาตของข้อมูลต้องระบุที่มา: OCHA COD-AB (CC BY-IGO) และ OpenStreetMap (ODbL) */}
        <span className="mt-1 text-[11px] text-muted/80">
          ขอบเขตการปกครองจาก OCHA (CC BY-IGO) และชื่อย่านจาก{' '}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
            className="text-link"
          >
            © OpenStreetMap
          </a>
        </span>
      </div>
    </div>
  );
}
