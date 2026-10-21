import { Storefront } from '@phosphor-icons/react';
import { Steps } from 'antd';
import { Link, useParams } from 'react-router';
import { useDemo } from '@/hooks/useDemo';
import { getBarBySlug } from '@/services/data';
import { EmbersBackdrop } from '@/ui/components/embersBackdrop';
import { NotFoundResult } from '@/ui/components/notFoundResult';
import { PageHeader } from '@/ui/components/pageHeader';
import { HEADER_LINK_CLASS } from '@/ui/utils/buttonClasses';
import { ConfirmStep } from './components/confirmStep';
import { ScheduleStep } from './components/scheduleStep';
import { useBookingForm } from './hooks/useBookingForm';
import { barPlace } from '@/ui/utils/area';

/**
 * /bars/:slug/book — จองโต๊ะอย่างเดียว (ไม่มีสั่งอาหาร/เครื่องดื่มล่วงหน้า)
 * ขั้น 1 วันเวลา/จำนวนคน/โซน + เลือกโปรโมชันของร้าน (ถ้าเข้าเงื่อนไขเวลา) → ขั้น 2 ยืนยัน + มัดจำ
 * ทุกการจองต้องมัดจำ เงินเข้า NightOut ก่อน แล้วแพลตฟอร์มค่อยโอนให้ร้าน
 */
export function BookPage() {
  useDemo();
  const { slug = '' } = useParams();
  const bar = getBarBySlug(slug);
  const f = useBookingForm(bar ?? null);

  if (!bar) return <NotFoundResult title="ไม่พบร้าน" kind="bar" />;

  return (
    <div className="embers-glass relative isolate mx-auto max-w-3xl">
      {/* พื้นหลัง Golden Embers เดียวกับหน้าการจอง (ธีมมืด) */}
      <EmbersBackdrop />
      <PageHeader
        title={`จองโต๊ะที่ ${bar.name}`}
        subtitle={barPlace(bar)}
        extra={
          <Link to={`/bars/${bar.slug}`} className={HEADER_LINK_CLASS}>
            <Storefront size={18} aria-hidden />
            กลับหน้าร้าน
          </Link>
        }
      />
      <Steps current={f.step} className="mb-8" items={[{ title: 'วันเวลา & โซน' }, { title: 'ยืนยัน & ชำระ' }]} />
      {f.step === 0 ? <ScheduleStep f={f} /> : <ConfirmStep bar={bar} f={f} />}
    </div>
  );
}
