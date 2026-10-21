import type * as C from '@nightout/contracts';
import { CreditCard } from '@phosphor-icons/react';
import { isInAppCheckoutUrl, TABLE_FEE_LABEL } from '@nightout/utils';
import { Alert, App, Button, Card, Spin } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { Bar, Booking } from '@/services/data';
import { PageHeader } from '@/ui/components/pageHeader';
import { baht, timeHHmm } from '@/ui/utils/format';
import { startCheckout } from '../api';
import { usePaymentStatus, type PaymentStatus } from '../hooks/usePaymentStatus';

/** แถบสถานะเหนือการ์ด — ตรวจผล / หมดเวลารอ / ไม่สำเร็จ / หน้าเดิมหมดเวลา / ยอดไม่ตรง */
function StatusAlert({ status }: { status: PaymentStatus }) {
  const { latest, checking, timedOut, failed, recheck } = status;
  const recheckButton = (
    <Button className="!h-10" onClick={recheck}>
      ตรวจอีกครั้ง
    </Button>
  );
  if (checking) {
    return (
      <Alert
        className="!mb-4"
        type="info"
        showIcon
        icon={<Spin size="small" />}
        title="กำลังตรวจสอบการชำระเงิน…"
        description="ปกติใช้เวลาไม่กี่วินาที อย่าเพิ่งปิดหน้านี้"
      />
    );
  }
  if (failed) {
    return (
      <Alert
        className="!mb-4"
        type="warning"
        showIcon
        title="ตรวจสอบผลการชำระไม่สำเร็จ"
        description="ถ้าชำระแล้ว ไม่ต้องจ่ายซ้ำ — กด “ตรวจอีกครั้ง” เมื่อเน็ตกลับมา"
        action={recheckButton}
      />
    );
  }
  if (timedOut) {
    return (
      <Alert
        className="!mb-4"
        type="warning"
        showIcon
        title="ยังไม่ได้รับผลการชำระ"
        description="ถ้าชำระแล้ว รอสักครู่แล้วกด “ตรวจอีกครั้ง” — ไม่ต้องจ่ายซ้ำ"
        action={recheckButton}
      />
    );
  }
  if (!latest) return null;
  if (latest.status === 'FAILED') {
    return (
      <Alert
        className="!mb-4"
        type="error"
        showIcon
        title="ชำระไม่สำเร็จ"
        description={latest.failure_message ?? 'ลองใหม่อีกครั้ง หรือเปลี่ยนวิธีชำระ'}
      />
    );
  }
  if (latest.status === 'EXPIRED' || latest.status === 'CANCELLED') {
    return (
      <Alert
        className="!mb-4"
        type="info"
        showIcon
        title="หน้าชำระเงินเดิมหมดเวลาแล้ว — กดชำระใหม่ได้เลย"
      />
    );
  }
  if (latest.status === 'PAID' && latest.refund_status === 'REQUIRED') {
    return (
      <Alert
        className="!mb-4"
        type="warning"
        showIcon
        title="ได้รับเงินแล้ว แต่ยอดไม่ตรงกับ Table Fee"
        description="NightOut จะคืนเงินก้อนนั้นให้เต็มจำนวน — กดชำระใหม่ด้วยยอดที่ถูกต้องได้"
      />
    );
  }
  return null;
}

/**
 * ชำระ Table Fee ผ่านผู้ให้บริการ (backend ตั้ง PAYMENT_PROVIDER) — ปุ่มพาไปหน้าชำระเงิน แล้วกลับมาที่ `?payment=return` เพื่อตรวจผล
 * ชำระสำเร็จ → webhook ยืนยันโต๊ะ + ออก E-Ticket อัตโนมัติ
 */
export function ProviderCheckout({
  booking: b,
  bar,
  config,
  returning,
}: {
  booking: Booking;
  bar: Bar;
  config: C.PaymentConfig;
  returning: boolean;
}) {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [starting, setStarting] = useState(false);
  const status = usePaymentStatus(b.id, { enabled: true, returning });
  const { latest, checking } = status;

  const goToCheckout = async () => {
    setStarting(true);
    try {
      const r = await startCheckout(b.id);
      if (isInAppCheckoutUrl(r.checkout_url)) navigate(r.checkout_url);
      else if (r.checkout_url.startsWith('https://')) window.location.assign(r.checkout_url);
      else message.error('ลิงก์หน้าชำระเงินไม่ถูกต้อง');
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="ชำระ Table Fee" subtitle={`${bar.name} รหัสจอง ${b.code}`} />
      <StatusAlert status={status} />
      <Card>
        <p className="text-muted">{TABLE_FEE_LABEL}</p>
        <p className="text-4xl font-bold text-gold-text">{baht(b.depositRequired ?? 0)}</p>
        <p className="mt-2 text-sm text-muted">
          ชำระผ่าน {config.provider_label}
          <span className="block">NightOut ถือเงินไว้ให้ และส่งต่อให้ร้านหลังคุณเช็กอิน</span>
          <span className="block">ถ้ายกเลิกตามเงื่อนไข คุณได้เงินคืนจากเราโดยตรง</span>
        </p>
        <Alert
          className="mt-4"
          type="info"
          showIcon
          title="นโยบาย Table Fee ของร้าน"
          description={bar.deposit.policy}
        />
        {latest?.status === 'PENDING' && latest.expires_at && (
          <p className="mt-4 text-sm text-muted">ชำระภายใน {timeHHmm(latest.expires_at)} น.</p>
        )}
        <Button
          type="primary"
          block
          size="large"
          className="mt-6"
          icon={<CreditCard />}
          loading={starting}
          disabled={checking}
          onClick={() => void goToCheckout()}
        >
          {latest?.status === 'PENDING' ? 'กลับไปหน้าชำระเงิน' : 'ไปหน้าชำระเงิน'}
        </Button>
        <p className="mt-3 text-center text-xs text-muted">
          ชำระสำเร็จแล้ว ระบบยืนยันโต๊ะและออก E-Ticket ให้อัตโนมัติ
        </p>
      </Card>
    </div>
  );
}
