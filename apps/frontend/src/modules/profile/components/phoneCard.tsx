import { Phone } from '@phosphor-icons/react';
import { formatThaiPhone, toThaiE164 } from '@nightout/utils';
import { App, Button, Input, Typography } from 'antd';
import { useState } from 'react';
import { useAuth } from '@/services/auth';
import { updateMyPhone } from '../api';

/**
 * เบอร์โทรของบัญชี (users.phone_e164) — ร้านใช้ติดต่อ + หน้า Checkout เติมให้
 * แก้ได้ แต่ลบเป็นค่าว่างไม่ได้ · ไม่มี OTP · บันทึกแล้วการจองที่ยังไม่ถึงเวลาเปลี่ยนเป็นเบอร์ใหม่ (PATCH /me/phone)
 */
export function PhoneCard({ phoneE164 }: { phoneE164: string | null | undefined }) {
  const { reload } = useAuth();
  const { message } = App.useApp();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const next = toThaiE164(value);
  const error = touched && !next ? (value.trim() ? 'เบอร์ไม่ถูกต้อง เช่น 081-234-5678' : 'กรอกเบอร์โทร') : null;
  const unchanged = !!next && next === phoneE164;

  const startEdit = () => {
    setValue(formatThaiPhone(phoneE164));
    setTouched(false);
    setEditing(true);
  };

  const save = async () => {
    setTouched(true);
    if (!next || unchanged) return;
    setSaving(true);
    try {
      const r = await updateMyPhone({ phone: value });
      await reload();
      message.success(
        r.bookings_updated > 0
          ? `บันทึกแล้ว และเปลี่ยนเบอร์ในการจองที่ยังไม่ถึงเวลา ${r.bookings_updated} รายการ`
          : 'บันทึกเบอร์โทรแล้ว',
      );
      setEditing(false);
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby="profile-phone-title" className="rounded-[14px] border border-border bg-card px-[18px] py-4">
      <div className="flex items-center gap-3.5">
        <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-gold/15 text-gold-text">
          <Phone size={20} weight="fill" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 id="profile-phone-title" className="text-[15px] font-semibold">
            เบอร์โทร
          </h2>
          {!editing && (
            <span className={`text-[13px] ${phoneE164 ? 'text-text tabular-nums' : 'text-muted'}`}>
              {phoneE164 ? formatThaiPhone(phoneE164) : 'ยังไม่มีเบอร์ (กรอกตอนจองครั้งแรก หรือเพิ่มที่นี่)'}
            </span>
          )}
        </div>
        {!editing && (
          <Button onClick={startEdit} className="shrink-0">
            {phoneE164 ? 'แก้ไข' : 'เพิ่มเบอร์'}
          </Button>
        )}
      </div>

      {editing && (
        <form
          className="mt-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <Input
            id="profile-phone"
            aria-labelledby="profile-phone-title"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="081-234-5678"
            prefix={<Phone size={18} className="text-muted" aria-hidden />}
            value={value}
            status={error ? 'error' : undefined}
            aria-invalid={!!error}
            aria-describedby="profile-phone-help"
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => setTouched(true)}
            maxLength={16}
            autoFocus
          />
          <Typography.Text id="profile-phone-help" type={error ? 'danger' : 'secondary'} className="mt-1 block text-xs">
            {error ?? 'ร้านใช้ติดต่อเรื่องโต๊ะ และการจองที่ยังไม่ถึงเวลาจะเปลี่ยนเป็นเบอร์นี้ด้วย'}
          </Typography.Text>
          <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="text" className="!text-muted" disabled={saving} onClick={() => setEditing(false)}>
              ยกเลิก
            </Button>
            <Button type="primary" htmlType="submit" loading={saving} disabled={unchanged}>
              บันทึก
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
