import { EnvelopeSimple, PaperPlaneTilt } from '@phosphor-icons/react';
import { Button, Form, Input } from 'antd';
import { useState } from 'react';
import { supabase } from '@/services/supabase';

/** ฟอร์มลืมรหัสผ่านใน AuthModal — ส่งลิงก์ตั้งรหัสใหม่ (→ /reset-password) แล้วแสดงผลในกล่องเดิม · onBack กลับไปเข้าสู่ระบบ */
export function AuthForgotForm({ onBack }: { onBack: () => void }) {
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string>();

  const onFinish = async ({ email }: { email: string }) => {
    setLoading(true);
    try {
      // ไม่บอกว่ามีบัญชีหรือไม่ (กันเดาอีเมล) — แสดงผลเหมือนกันทุกกรณี
      await supabase?.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setSentTo(email);
    } finally {
      setLoading(false);
    }
  };

  const backLink = (
    <p className="mt-6 text-center text-xs text-white/80">
      นึกรหัสผ่านออกแล้ว ?{' '}
      <button type="button" onClick={onBack} className="font-bold text-[#c79bff] hover:text-white">
        กลับไปเข้าสู่ระบบ
      </button>
    </p>
  );

  if (sentTo)
    return (
      <div className="text-center" role="status">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-white/10 text-[#c79bff]">
          <PaperPlaneTilt size={22} weight="duotone" />
        </span>
        <p className="mt-4 text-sm text-white/90">
          ถ้ามีบัญชีของ <span className="font-semibold text-white">{sentTo}</span> เราได้ส่งลิงก์ตั้งรหัสใหม่ไปแล้ว
        </p>
        <p className="mt-1.5 text-xs text-white/60">ไม่เห็นอีเมล ลองดูในโฟลเดอร์สแปม หรือส่งใหม่อีกครั้ง</p>
        <Button size="large" block className="btn-oauth-dark mt-5" onClick={() => setSentTo(undefined)}>
          ส่งลิงก์อีกครั้ง
        </Button>
        {backLink}
      </div>
    );

  return (
    <>
      <Form<{ email: string }> layout="vertical" requiredMark={false} onFinish={onFinish}>
        <Form.Item
          name="email"
          label="อีเมล"
          className="!mb-5"
          rules={[{ required: true, type: 'email', message: 'กรอกอีเมลให้ถูกต้อง' }]}
        >
          <Input
            size="large"
            prefix={<EnvelopeSimple size={18} />}
            placeholder="you@email.com"
            autoComplete="email"
            inputMode="email"
          />
        </Form.Item>
        <Button type="primary" htmlType="submit" size="large" block loading={loading} className="btn-gold">
          ส่งลิงก์ตั้งรหัสใหม่
        </Button>
      </Form>
      {backLink}
    </>
  );
}
