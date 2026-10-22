import { UploadSimple } from '@phosphor-icons/react';
import { TABLE_FEE_LABEL } from '@nightout/utils';
import { Alert, App, Button, Card, Upload } from 'antd';
import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { MASTER, promptPayPayload, type Bar, type Booking } from '@/services/data';
import { InfoButton } from '@/ui/components/infoButton';
import { PageHeader } from '@/ui/components/pageHeader';
import { baht } from '@/ui/utils/format';
import { submitDeposit } from '../api';

/** ย่อรูปสลิปก่อนอัปโหลด (ยังอ่าน QR ในสลิปได้) — ใช้แสดงตัวอย่าง + อัปโหลดเข้า deposit-slips */
function toSmallDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1080 / img.width);
      const c = document.createElement('canvas');
      c.width = img.width * scale;
      c.height = img.height * scale;
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', 0.82));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/** โอน PromptPay เข้า NightOut (แพลตฟอร์มถือเงินไว้ให้) + อัปโหลดสลิป — ใช้เมื่อ backend ยังไม่ตั้ง PAYMENT_PROVIDER */
export function SlipTransfer({ booking: b, bar }: { booking: Booking; bar: Bar }) {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [slip, setSlip] = useState<string>();
  const [sending, setSending] = useState(false);
  // ยอดมัดจำ snapshot ตอนจอง (ร้านเปลี่ยนนโยบายภายหลังไม่กระทบการจองนี้)
  const amount = b.depositRequired ?? 0;
  const promptpay = MASTER.depositPromptPay;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="ชำระ Table Fee" subtitle={`${bar.name} รหัสจอง ${b.code}`} />
      {b.depositRejectReason && (
        <Alert
          className="!mb-4"
          type="warning"
          showIcon
          title="สลิปก่อนหน้าไม่ผ่านการตรวจ"
          description={`${b.depositRejectReason} — โอนใหม่แล้วส่งสลิปอีกครั้ง`}
        />
      )}
      <Card>
        <div className="grid gap-6 sm:grid-cols-[220px_1fr]">
          <div className="text-center">
            <div className="inline-block rounded-2xl bg-white p-3">
              <QRCodeSVG value={promptPayPayload(promptpay.promptpayId, amount)} size={190} />
            </div>
            <p className="mt-2 text-sm text-muted">PromptPay: {promptpay.name}</p>
          </div>
          <div>
            <p className="text-muted">{TABLE_FEE_LABEL}</p>
            <p className="text-4xl font-bold text-gold-text">{baht(amount)}</p>
            <p className="mt-2 text-sm text-muted">
              โอนเข้า NightOut — เราถือเงินไว้ให้ และส่งต่อให้ร้านหลังคุณเช็กอิน
              ยกเลิกตามเงื่อนไขได้เงินคืนจากเราโดยตรง
            </p>
            <InfoButton label="นโยบาย Table Fee ของร้าน" className="mt-4">
              {bar.deposit.policy}
            </InfoButton>
          </div>
        </div>
        <Upload.Dragger
          accept="image/*"
          maxCount={1}
          showUploadList={false}
          beforeUpload={async (file) => {
            if (file.size > 10 * 1024 * 1024) {
              message.error('ไฟล์ใหญ่เกิน 10MB');
              return Upload.LIST_IGNORE;
            }
            setSlip(await toSmallDataUrl(file));
            return false;
          }}
          className="!mt-6 block"
        >
          {slip ? (
            <img src={slip} alt="สลิปที่เลือก" className="mx-auto max-h-64 rounded-lg" />
          ) : (
            <div className="py-6">
              <UploadSimple size={36} className="mx-auto text-gold-text" />
              <p className="mt-2">แตะเพื่อเลือกรูปสลิป หรือลากไฟล์มาวาง</p>
              <p className="text-xs text-muted">JPG / PNG ไม่เกิน 10MB</p>
            </div>
          )}
        </Upload.Dragger>
        <Button
          type="primary"
          block
          className="mt-6"
          disabled={!slip}
          loading={sending}
          onClick={async () => {
            setSending(true);
            try {
              await submitDeposit(b.id, await (await fetch(slip!)).blob());
              message.success('ส่งสลิปแล้ว NightOut จะตรวจและยืนยันโต๊ะให้');
              navigate(`/bookings/${b.id}`);
            } catch (e) {
              message.error((e as Error).message);
            } finally {
              setSending(false);
            }
          }}
        >
          ส่งสลิป
        </Button>
      </Card>
    </div>
  );
}
