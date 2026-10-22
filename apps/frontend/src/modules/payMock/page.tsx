import type * as C from '@nightout/contracts';
import { CheckCircle, XCircle } from '@phosphor-icons/react';
import { App, Button, Card, Result, Skeleton, Tag } from 'antd';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { NotFoundResult } from '@/ui/components/notFoundResult';
import { baht, timeHHmm } from '@/ui/utils/format';
import { completeMockPayment, useMockIntent, usePaymentConfig } from './api';

/** หัวข้อเมื่อรายการไม่รอชำระแล้ว (เปิดลิงก์ซ้ำ / กดย้อนกลับหลังจ่าย) */
const CLOSED_TITLE: Record<Exclude<C.PaymentIntentView['status'], 'PENDING'>, string> = {
  PAID: 'รายการนี้ชำระแล้ว',
  FAILED: 'รายการนี้ชำระไม่สำเร็จ',
  EXPIRED: 'รายการนี้หมดเวลาแล้ว',
  CANCELLED: 'รายการนี้ถูกยกเลิกแล้ว',
};

/** /pay/mock/:intentId — ระบบชำระเงินจำลอง (PAYMENT_PROVIDER=mock) ใช้ทดสอบ flow ก่อนเชื่อมผู้ให้บริการจริง · ไม่ตัดเงินจริง */
export function PayMockPage() {
  const { intentId = '' } = useParams();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const config = usePaymentConfig();
  const intent = useMockIntent(intentId);
  const [sending, setSending] = useState<C.MockCompleteBody['outcome'] | null>(null);

  if (config.isLoading || intent.isLoading) {
    return (
      <Card className="mx-auto max-w-md">
        <Skeleton active />
      </Card>
    );
  }
  const it = intent.data;
  if (intent.isError || !it) return <NotFoundResult title="ไม่พบรายการชำระเงิน" kind="booking" />;

  const depositPath = `/bookings/${it.booking_id}/deposit`;
  const backToDeposit = (
    <Button onClick={() => navigate(depositPath)}>กลับไปหน้าชำระ Table Fee</Button>
  );
  if (config.data?.provider !== 'mock' || it.provider !== 'mock') {
    return <Result status="info" title="ระบบชำระเงินจำลองไม่ได้เปิดอยู่" extra={backToDeposit} />;
  }
  if (it.status !== 'PENDING') {
    return (
      <Result
        status="info"
        title={CLOSED_TITLE[it.status]}
        extra={backToDeposit}
      />
    );
  }

  const complete = async (outcome: C.MockCompleteBody['outcome']) => {
    setSending(outcome);
    try {
      await completeMockPayment(it.id, outcome);
      if (outcome === 'PAID') message.success('ชำระสำเร็จ (จำลอง)');
      else message.info('จำลองการชำระไม่สำเร็จแล้ว');
      navigate(`${depositPath}?payment=return`, { replace: true });
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setSending(null);
    }
  };

  return (
    <Card className="mx-auto max-w-md">
      <Tag color="purple">โหมดทดสอบ</Tag>
      <h1 className="mt-3 font-display text-2xl font-bold">ระบบชำระเงินจำลอง</h1>
      <p className="mt-1 text-sm text-muted">
        ใช้ทดสอบก่อนเชื่อมผู้ให้บริการจริง — ไม่มีการตัดเงิน
      </p>
      <dl className="mt-5 grid grid-cols-[88px_1fr] gap-y-2 text-sm">
        <dt className="text-muted">ร้าน</dt>
        <dd>{it.bar_name}</dd>
        <dt className="text-muted">รหัสจอง</dt>
        <dd>{it.booking_code}</dd>
        <dt className="text-muted">ยอด</dt>
        <dd className="text-lg font-bold text-gold-text">{baht(Number(it.amount))}</dd>
        <dt className="text-muted">หมดเวลา</dt>
        <dd>{timeHHmm(it.expires_at)} น.</dd>
      </dl>
      <div className="mt-6 flex flex-col gap-3">
        <Button
          type="primary"
          block
          icon={<CheckCircle />}
          loading={sending === 'PAID'}
          disabled={!!sending}
          onClick={() => void complete('PAID')}
        >
          จ่ายสำเร็จ
        </Button>
        <Button
          danger
          block
          icon={<XCircle />}
          loading={sending === 'FAILED'}
          disabled={!!sending}
          onClick={() => void complete('FAILED')}
        >
          จ่ายไม่สำเร็จ
        </Button>
        <Button
          type="link"
          block
          disabled={!!sending}
          onClick={() => navigate(`/bookings/${it.booking_id}`)}
        >
          ยกเลิก กลับไปหน้าการจอง
        </Button>
      </div>
    </Card>
  );
}
