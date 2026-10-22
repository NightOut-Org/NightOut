import { Armchair, CalendarBlank, Clock, Gift, Hourglass, Phone, UsersThree } from '@phosphor-icons/react';
import { Alert, Button, Card, Checkbox, Input, Typography } from 'antd';
import type { ReactNode } from 'react';
import type { BarWithTier } from '@/services/data';
import { BOOKING_EXTENSION_MINUTES, TABLE_FEE_LABEL } from '@nightout/utils';
import { RuleList } from '@/ui/components/ruleList';
import { baht } from '@/ui/utils/format';
import type { BookingForm } from '../hooks/useBookingForm';

interface SummaryRow {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  note?: string;
}

/** ขั้น 2: สรุปการจอง (แถวละ 1 ข้อมูล แบบใบเสร็จ) + Table Fee + เบอร์ติดต่อ + ยอมรับเงื่อนไขริบมัดจำ แล้วยืนยัน */
export function ConfirmStep({ bar, f }: { bar: BarWithTier; f: BookingForm }) {
  const { datetime, chosenPromo } = f;
  const rows: SummaryRow[] = [
    { icon: <CalendarBlank />, label: 'วันที่', value: datetime.format('ddd D MMM YYYY') },
    { icon: <Clock />, label: 'เวลา', value: datetime.format('HH:mm น.') },
    { icon: <UsersThree />, label: 'จำนวน', value: `${f.pax} คน` },
    { icon: <Armchair />, label: 'โซน', value: f.zone?.zone.name },
    {
      icon: <Hourglass />,
      label: 'เก็บโต๊ะให้ถึง',
      value: datetime.add(bar.gracePeriodMinutes, 'minute').format('HH:mm น.'),
      note: `${bar.gracePeriodMinutes} นาทีหลังเวลาจอง และขอต่อได้อีก ${BOOKING_EXTENSION_MINUTES} นาที 1 ครั้ง`,
    },
    ...(chosenPromo
      ? [
          {
            icon: <Gift />,
            label: 'โปรโมชัน',
            value: chosenPromo.title,
            note: chosenPromo.cutoffTime ? `เช็กอินก่อน ${chosenPromo.cutoffTime} น.` : undefined,
          },
        ]
      : []),
  ];
  return (
    <Card>
      {f.banned && (
        <Alert
          className="!mb-4"
          type="error"
          showIcon
          title="บัญชีนี้ถูกระงับการจอง"
          description={`${f.banReason ? `เหตุผล: ${f.banReason} (` : ''}หากคิดว่าเป็นความผิดพลาด กรุณาติดต่อ NightOut${f.banReason ? ')' : ''}`}
        />
      )}
      <section aria-labelledby="booking-summary">
        <h2 id="booking-summary" className="text-base font-semibold">
          สรุปการจอง
        </h2>
        <dl className="mt-2 divide-y divide-border">
          {rows.map((r) => (
            <div key={r.label} className="flex items-start justify-between gap-4 py-3">
              <dt className="flex shrink-0 items-center gap-2 text-sm text-muted">
                <span aria-hidden className="inline-flex text-gold-text/80 [&>svg]:size-[18px]">
                  {r.icon}
                </span>
                {r.label}
              </dt>
              <dd className="min-w-0 text-right">
                <span className="block font-semibold">{r.value}</span>
                {r.note && <span className="mt-0.5 block text-xs text-muted">{r.note}</span>}
              </dd>
            </div>
          ))}
        </dl>
        <div className="mt-1 flex items-center justify-between gap-4 rounded-xl bg-surface px-4 py-3.5">
          <div className="min-w-0">
            <p className="m-0 text-sm font-medium">{TABLE_FEE_LABEL}</p>
            <p className="m-0 text-xs text-muted">{bar.deposit.unit === 'PER_PERSON' ? 'คิดต่อคน' : 'คิดต่อโต๊ะ'}</p>
          </div>
          <span className="shrink-0 text-2xl font-bold tabular-nums text-gold-text">{baht(f.deposit)}</span>
        </div>
        <RuleList
          className="mt-3 text-xs text-muted"
          rules={[
            'ชำระให้ NightOut ไม่ใช่เข้าร้านโดยตรง',
            'เราถือเงินไว้จนกว่าคุณจะเช็กอิน แล้วจึงส่งต่อให้ร้าน',
          ]}
        />
      </section>

      <label htmlFor="contact-phone" className="mt-6 block text-sm font-medium">
        เบอร์โทรติดต่อ
      </label>
      <Input
        id="contact-phone"
        className="!mt-1.5"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="081-234-5678"
        prefix={<Phone size={18} className="text-muted" aria-hidden />}
        value={f.phone}
        status={f.phoneError ? 'error' : undefined}
        aria-invalid={!!f.phoneError}
        aria-describedby="contact-phone-help"
        onChange={(e) => f.setPhone(e.target.value)}
        onBlur={() => f.setPhoneTouched(true)}
        maxLength={16}
      />
      <Typography.Text
        id="contact-phone-help"
        type={f.phoneError ? 'danger' : 'secondary'}
        className="mt-1 block text-xs"
      >
        {f.phoneError ?? 'ร้านใช้ติดต่อเรื่องโต๊ะของคุณ'}
      </Typography.Text>

      {f.needsTerms && (
        <section aria-labelledby="deposit-terms" className="mt-5 rounded-lg border border-border bg-surface p-4">
          <h3 id="deposit-terms" className="text-sm font-semibold">
            เงื่อนไข Table Fee {baht(f.deposit)}
          </h3>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-muted">
            {f.termsLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
          <Checkbox
            className="!mt-4"
            checked={f.termsAccepted}
            onChange={(e) => f.setTermsAccepted(e.target.checked)}
          >
            <span className="text-sm">
              ฉันได้อ่านและยอมรับเงื่อนไข{TABLE_FEE_LABEL} รวมถึงการริบ Table Fee เมื่อยกเลิกช้า หรือมาไม่ทันเวลาเก็บโต๊ะจนถูกปลดโต๊ะ (Forfeited)
            </span>
          </Checkbox>
          <p className="mt-2 text-xs text-muted">ระบบบันทึกเวลาและอุปกรณ์ที่ใช้กดยอมรับไว้เป็นหลักฐานของการจองนี้</p>
        </section>
      )}
      <Input.TextArea
        className="!mt-4"
        rows={2}
        placeholder="หมายเหตุถึงร้าน (ไม่บังคับ) เช่น ฉลองวันเกิด"
        value={f.note}
        onChange={(e) => f.setNote(e.target.value)}
        maxLength={200}
        showCount
      />
      <div className="mt-6 flex gap-3">
        <Button block onClick={() => f.setStep(0)}>
          ย้อนกลับ
        </Button>
        <Button
          block
          type="primary"
          loading={f.submitting}
          disabled={!f.canSubmit}
          onClick={() => void f.submit()}
        >
          {f.needsTerms ? 'ยืนยันและไปชำระ Table Fee' : 'ยืนยันการจอง'}
        </Button>
      </div>
    </Card>
  );
}
