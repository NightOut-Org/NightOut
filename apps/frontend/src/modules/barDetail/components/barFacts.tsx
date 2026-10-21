import { BOOKING_EXTENSION_MINUTES } from '@nightout/utils';
import { Descriptions } from 'antd';
import type { BarWithTier } from '@/services/data';
import { baht } from '@/ui/utils/format';
import type { ReactNode } from 'react';

/** ค่าหลัก + คำอธิบายรองบรรทัดล่าง (ตัวเล็ก สีจาง) */
const Fact = ({ value, note }: { value: ReactNode; note: ReactNode }) => (
  <span className="flex flex-col">
    <span>{value}</span>
    <span className="text-xs text-muted">{note}</span>
  </span>
);

/** ข้อมูลหลักของร้าน: ที่อยู่ ราคาเฉลี่ย ค่าบริการ เวลาเก็บโต๊ะ มัดจำ */
export function BarFacts({ bar }: { bar: BarWithTier }) {
  return (
    <Descriptions
      column={{ xs: 1, sm: 2 }}
      items={[
        { key: 'a', label: 'ที่อยู่', children: bar.address },
        {
          key: 'p',
          label: 'ราคาเฉลี่ย',
          children: (
            <span>
              <b className="font-semibold text-gold-text">{baht(bar.avgPerPerson)}</b> ต่อคน (โดยประมาณ)
            </span>
          ),
        },
        {
          key: 's',
          label: 'Service charge / VAT',
          children: `${bar.fees.serviceChargeRate}% / ${bar.fees.vatRate}%`,
        },
        { key: 'o', label: 'ค่าอื่นๆ', children: bar.fees.otherFees ? baht(bar.fees.otherFees) : 'ไม่มี' },
        {
          key: 'g',
          label: 'เก็บโต๊ะให้',
          children: (
            <Fact
              value={<><b className="font-semibold">{bar.gracePeriodMinutes} นาที</b> หลังเวลาจอง</>}
              note={`ขอต่อเวลาได้อีก ${BOOKING_EXTENSION_MINUTES} นาที 1 ครั้ง`}
            />
          ),
        },
        {
          key: 'd',
          label: 'Table Fee',
          children: (
            <Fact
              value={
                <>
                  <b className="font-semibold text-gold-text">{baht(bar.deposit.amount)}</b>{' '}
                  {bar.deposit.unit === 'PER_PERSON' ? 'ต่อคน' : 'ต่อโต๊ะ'}
                </>
              }
              note="ชำระเข้า NightOut แล้วส่งต่อให้ร้านหลังเช็กอิน"
            />
          ),
        },
      ]}
    />
  );
}
