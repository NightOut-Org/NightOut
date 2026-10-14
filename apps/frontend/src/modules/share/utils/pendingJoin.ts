/** ลิงก์แชร์ที่กด "ไปด้วย" ตอนยังไม่ล็อกอิน — เก็บไว้ให้กดต่อเองเมื่อกลับมาหลังล็อกอิน / สมัคร + ยืนยันอีเมล (OAuth โหลดหน้าใหม่) */
const KEY = 'nightout-pending-share';
/** ยืนยันอีเมลอาจใช้เวลา — เก็บไว้ 1 วัน */
const TTL_MS = 24 * 60 * 60 * 1000;

/** จำ token ที่รอเข้ากลุ่ม (เขียนไม่ได้ เช่น private mode = ไม่เป็นไร ผู้ใช้กดเองอีกครั้ง) */
export function rememberPendingShare(token: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ token, at: Date.now() }));
  } catch {
    /* ไม่มี storage */
  }
}

/** token นี้รอเข้ากลุ่มอยู่ไหม — อ่านแล้วลบทิ้งทันที (ทำครั้งเดียว) */
export function takePendingShare(token: string): boolean {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return false;
    const v = JSON.parse(raw) as { token?: string; at?: number };
    if (v.token !== token) return false;
    localStorage.removeItem(KEY);
    return Date.now() - (v.at ?? 0) < TTL_MS;
  } catch {
    return false;
  }
}
