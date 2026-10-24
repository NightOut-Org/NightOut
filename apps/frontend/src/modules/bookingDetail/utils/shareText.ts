import { TABLE_FEE_SHORT } from '@nightout/utils';
import { baht } from '@/ui/utils/format';

/** ลิงก์เปิด LINE พร้อมข้อความ (เลือกแชต/กลุ่มเองในแอป LINE) */
export const lineShareUrl = (text: string) => `https://line.me/R/share?text=${encodeURIComponent(text)}`;

/** ยอดหารต่อหัว = Table Fee ÷ จำนวนคน (ปัดขึ้นเป็นบาท) — สูตรเดียวกับหน้า /share/:token */
export const feePerHead = (fee: number, pax: number) => (pax > 0 ? Math.ceil(fee / pax) : fee);

interface SplitText {
  barName: string;
  when: string;
  pax: number;
  fee: number;
  /** ผู้จองจ่ายผ่านแอปแล้ว (มัดจำ VERIFIED) */
  paid: boolean;
  /** งบในร้านโดยประมาณต่อคน (0 = ไม่มีข้อมูล) */
  avgPerPerson: number;
  shareUrl: string;
}

/**
 * ข้อความหารจ่ายส่งเข้า LINE — แจ้งยอดต่อหัวให้เพื่อนโอนคืนผู้จองเอง
 * (ผู้จองจ่ายผ่านแอปคนเดียว ไม่มี Split-Pay)
 */
export function splitPayText(s: SplitText) {
  const lines = [
    `หารค่าโต๊ะ ${s.barName} กัน`,
    `${s.when} (${s.pax} คน)`,
    `${TABLE_FEE_SHORT} ${baht(s.fee)} หาร ${s.pax} คน = คนละ ${baht(feePerHead(s.fee, s.pax))}`,
    s.paid
      ? 'เราจ่ายผ่าน NightOut ให้แล้ว โอนส่วนของแต่ละคนให้เราได้เลย'
      : 'เราจะเป็นคนจ่ายผ่าน NightOut แล้วค่อยโอนส่วนของแต่ละคนให้เรา',
  ];
  if (s.avgPerPerson > 0) lines.push(`งบในร้านโดยประมาณ ${baht(s.avgPerPerson)} ต่อคน (จ่ายที่ร้าน)`);
  lines.push(`ดูบัตรจองและกด "ไปด้วย": ${s.shareUrl}`);
  return lines.join('\n');
}
