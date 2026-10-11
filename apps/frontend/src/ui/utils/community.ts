/** ตัวช่วยแสดงผลของชุมชน (ใช้ทั้งฟีด กระทู้ของฉัน และหน้าอ่านกระทู้) */

/** สีพื้นวงกลมชื่อผู้เขียน — เลือกจาก id เดิมได้สีเดิมทุกครั้ง (ชุดเดียวกับดีไซน์ Community) */
const AVATAR_COLORS = [
  '#a738f5',
  '#c8900a',
  '#1d6e8c',
  '#b8337a',
  '#3a7d5a',
  '#5b3fd1',
  '#9a5b12',
  '#6b5a86',
];

export const avatarColor = (id: string) => {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length]!;
};

/** ตัวอักษรแรกของชื่อ (รองรับสระไทยนำหน้า เช่น "เจ" → "จ") */
export const initialOf = (name: string) => {
  const s = name.trim().replace(/^[เแโใไ]/, '');
  return (s[0] ?? '?').toUpperCase();
};

/** 1234 → "1.2k" · ต่ำกว่าพันแสดงเต็ม */
export const compactCount = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, '')}k` : String(n);

/** "21:08" เวลาที่บันทึกร่าง */
export const clockTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
