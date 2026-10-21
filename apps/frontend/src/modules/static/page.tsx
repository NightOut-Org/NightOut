import { Card } from 'antd';
import { PageHeader } from '@/ui/components/pageHeader';

const CONTENT: Record<string, { title: string; body: string[] }> = {
  terms: {
    title: 'เงื่อนไขการใช้งาน',
    body: [
      'ร่างสำหรับเดโม — ต้องให้ทนายตรวจก่อนเปิดใช้งานจริง',
      'ผู้ใช้ต้องมีอายุ 20 ปีขึ้นไป',
      'ราคาในแอปเป็นราคาโดยประมาณ ไม่ใช่ราคาสุดท้าย',
      'เงินที่ชำระผ่านแอปคือค่าธรรมเนียมจองโต๊ะ (Table Fee) เท่านั้น — NightOut ถือไว้จนเช็กอินหรือครบเงื่อนไข แล้วจึงโอนให้ร้าน และไม่มีการขายหรือพรีออเดอร์เครื่องดื่มแอลกอฮอล์ผ่านแอป',
    ],
  },
  privacy: {
    title: 'นโยบายความเป็นส่วนตัว',
    body: [
      'ร่างสำหรับเดโม (PDPA)',
      'เราขอตำแหน่งเฉพาะตอนใช้ "ร้านใกล้ฉัน" และไม่บันทึกพิกัด',
      'หลักฐานการชำระเก็บเท่าที่จำเป็นและลบตามรอบที่กำหนด',
      'ขอลบบัญชีได้ในหน้า ตั้งค่า',
    ],
  },
  cookies: {
    title: 'นโยบายคุกกี้',
    body: ['ร่างสำหรับเดโม', 'ใช้ localStorage เก็บธีม การยืนยันอายุ และ session'],
  },
};

export function StaticPage({ page }: { page: keyof typeof CONTENT }) {
  const c = CONTENT[page]!;
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={c.title} />
      <Card>
        <div className="space-y-3">
          {c.body.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      </Card>
    </div>
  );
}
