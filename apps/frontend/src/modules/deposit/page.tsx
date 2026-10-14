import { Button, Card, Result, Skeleton } from 'antd';
import type { ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useDemo } from '@/hooks/useDemo';
import { getBar, getBooking } from '@/services/data';
import { NotFoundResult } from '@/ui/components/notFoundResult';
import { useBookingPayments, usePaymentConfig } from './api';
import { ProviderCheckout } from './components/providerCheckout';
import { SlipTransfer } from './components/slipTransfer';

function Loading() {
  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <Skeleton active />
      </Card>
    </div>
  );
}

/**
 * /bookings/:id/deposit — ชำระ Table Fee
 * หน้าชำระเงินออนไลน์เมื่อ backend ตั้ง PAYMENT_PROVIDER · ไม่ตั้ง = โอน PromptPay + แนบสลิปเดิม
 * กลับจากผู้ให้บริการที่ `?payment=return` → ตรวจผลจนการจองยืนยัน (E-Ticket ออกอัตโนมัติ)
 */
export function DepositPage() {
  useDemo();
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const returning = params.get('payment') === 'return';
  const navigate = useNavigate();
  const b = getBooking(id);
  const bar = b ? getBar(b.barId) : null;
  const config = usePaymentConfig();
  const providerMode = config.data?.mode === 'PROVIDER';
  // ผลการชำระของการจองที่ไม่รอชำระแล้ว (เงินเข้าหลังหมดเวลา → ต้องคืน) — โหมดสลิปไม่เรียก
  const payments = useBookingPayments(id, {
    enabled: !!b && b.status !== 'AWAITING_DEPOSIT' && providerMode,
    poll: false,
  });

  if (!b || !bar) return <NotFoundResult title="ไม่พบการจอง" kind="booking" />;

  if (b.status !== 'AWAITING_DEPOSIT') {
    const toBooking = (label: ReactNode, primary = false) => (
      <Button type={primary ? 'primary' : 'default'} onClick={() => navigate(`/bookings/${b.id}`)}>
        {label}
      </Button>
    );
    if (b.status === 'CONFIRMED' && (b.deposit?.method === 'ONLINE' || returning)) {
      return (
        <Result
          status="success"
          title="ชำระ Table Fee สำเร็จ"
          subTitle="โต๊ะของคุณยืนยันแล้ว — E-Ticket (QR เช็กอิน) อยู่ในหน้าบัตรจอง"
          extra={toBooking('ดู E-Ticket', true)}
        />
      );
    }
    // รอผลก่อน ไม่ให้ข้อความ "ไม่ต้องชำระแล้ว" แวบขึ้นก่อนคำเตือนเรื่องคืนเงิน
    if (config.isLoading || payments.isLoading) return <Loading />;
    // โหลดผลไม่ได้ → ห้ามบอกว่า "ไม่ต้องชำระแล้ว" (อาจมีเงินที่ต้องคืนอยู่)
    if (config.isError || payments.isError) {
      return (
        <Result
          status="error"
          title="โหลดสถานะการชำระไม่สำเร็จ"
          extra={
            <Button onClick={() => void (config.isError ? config.refetch() : payments.refetch())}>ลองใหม่</Button>
          }
        />
      );
    }
    const refund =
      payments.data?.find((p) => p.refund_status === 'REQUIRED') ??
      payments.data?.find((p) => p.refund_status === 'REFUNDED');
    if (refund?.refund_status === 'REQUIRED') {
      return (
        <Result
          status="warning"
          title="ได้รับ Table Fee แล้ว แต่ยืนยันการจองไม่ได้"
          subTitle="NightOut จะคืนเงินให้เต็มจำนวน และแจ้งเตือนเมื่อคืนแล้ว"
          extra={toBooking('ดูการจอง')}
        />
      );
    }
    if (refund?.refund_status === 'REFUNDED') {
      return (
        <Result
          status="info"
          title="NightOut คืน Table Fee ให้แล้ว"
          extra={toBooking('ดูการจอง')}
        />
      );
    }
    return (
      <Result
        status="info"
        title="การจองนี้ไม่ต้องชำระ Table Fee แล้ว"
        extra={toBooking('ดูบัตรจอง')}
      />
    );
  }

  if (config.isLoading) return <Loading />;
  if (config.isError || !config.data) {
    return (
      <Result
        status="error"
        title="โหลดช่องทางชำระเงินไม่สำเร็จ"
        extra={<Button onClick={() => void config.refetch()}>ลองใหม่</Button>}
      />
    );
  }
  if (config.data.mode === 'PROVIDER') {
    return <ProviderCheckout booking={b} bar={bar} config={config.data} returning={returning} />;
  }
  return <SlipTransfer booking={b} bar={bar} />;
}
