/**
 * ปุ่มหัวหน้า (Desktop) ของหน้าร้านที่แก้ทั้งหน้าแล้วบันทึกครั้งเดียว — 3 ระดับให้แยกออกด้วยตา
 * - บันทึก = ทองทึบ (ปุ่มหลักปุ่มเดียวของหน้า) · ยังไม่มีอะไรให้บันทึก = พื้นเทา ตัวหนังสือจาง
 * - เพิ่ม/สร้าง = ขอบทอง พื้นใส
 * - คืนค่า = ขอบเทา ตัวหนังสือจาง (อยู่ในแต่ละหน้า)
 * ใส่ `!` เพราะ `.embers-glass .merchant-pill` ทับพื้น/ขอบให้เป็นกระจก
 */
export const HEADER_SAVE_CLASS =
  'hidden h-10 items-center gap-2 rounded-xl bg-gold px-[18px] text-sm font-semibold text-on-gold disabled:cursor-not-allowed disabled:!border disabled:!border-border disabled:!bg-surface disabled:!text-muted disabled:!opacity-100 lg:inline-flex';

export const HEADER_ADD_CLASS =
  'merchant-pill hidden h-10 items-center gap-2 rounded-xl border !border-gold/60 !bg-transparent px-[18px] text-sm font-semibold !text-gold-text hover:!bg-gold/10 disabled:opacity-60 lg:inline-flex';

/** ปุ่มรองบนหัวหน้า (เช่น "กลับหน้าร้าน") — ขอบเทา ใช้กับ `<Link>` แทนลิงก์ข้อความ + ลูกศร */
export const HEADER_LINK_CLASS =
  'inline-flex h-10 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold !text-text transition-colors hover:border-gold/60 hover:!text-gold-text';

/** ปุ่มชวนทำต่อใน Empty (เช่น "หาร้าน") — ทองทึบ ใช้กับ `<Link>` แทนลิงก์ข้อความ + ลูกศร */
export const EMPTY_CTA_CLASS =
  'inline-flex h-10 items-center gap-2 rounded-xl bg-gold px-5 text-sm font-semibold !text-on-gold transition-colors hover:bg-gold-highlight';
