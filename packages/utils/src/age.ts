/**
 * อายุ 20+ — ใช้ตอนสมัครด้วย Google / Facebook (backend ดึงวันเกิดจากผู้ให้บริการเอง)
 * วันตัดตรงกับ DB (`check_user_age` / `app_complete_oauth_signup`: birthdate <= current_date - 20 ปี · current_date = UTC)
 */
export const MIN_CUSTOMER_AGE = 20;

/** เวอร์ชันเงื่อนไขการใช้งาน / นโยบายความเป็นส่วนตัวที่ผู้สมัครยอมรับ (บันทึกใน `user_consents`) */
export const TERMS_VERSION = 'v1';
export const PRIVACY_VERSION = 'v1';

/** ผู้ให้บริการล็อกอินที่ยืนยันอายุจากวันเกิดของบัญชีได้ */
export type OAuthProvider = 'google' | 'facebook';
export const OAUTH_PROVIDERS = ['google', 'facebook'] as const satisfies readonly OAuthProvider[];
export const isOAuthProvider = (v: unknown): v is OAuthProvider => v === 'google' || v === 'facebook';

/** ชื่อที่แสดงของผู้ให้บริการ */
export const OAUTH_PROVIDER_LABEL: Record<OAuthProvider, string> = { google: 'Google', facebook: 'Facebook' };

/** scope ที่ต้องขอเพิ่มตอนล็อกอินเพื่ออ่านวันเกิด (ได้รับอนุมัติจากผู้ให้บริการแล้ว) */
export const OAUTH_BIRTHDAY_SCOPE: Record<OAuthProvider, string> = {
  google: 'https://www.googleapis.com/auth/user.birthday.read',
  facebook: 'user_birthday',
};

const pad = (n: number) => String(n).padStart(2, '0');

/** YYYY-MM-DD ที่เป็นวันจริงบนปฏิทิน · ไม่ครบ/ไม่ใช่วันจริง = null */
function isoDate(year: number | undefined, month: number | undefined, day: number | undefined): string | null {
  if (!year || !month || !day) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** แถว `birthdays` จาก Google People API (`people/me?personFields=birthdays`) */
export interface GoogleBirthday {
  metadata?: { primary?: boolean; source?: { type?: string } };
  date?: { year?: number; month?: number; day?: number };
}

/**
 * วันเกิดจาก Google — ต้องครบ วัน/เดือน/ปี
 * เลือกแถวที่มาจากบัญชี Google (`ACCOUNT`) ก่อน แล้วค่อยแถว primary (โปรไฟล์ที่ผู้ใช้ตั้งเอง)
 */
export function googleBirthdate(birthdays: GoogleBirthday[] | null | undefined): string | null {
  const rank = (b: GoogleBirthday) => (b.metadata?.source?.type === 'ACCOUNT' ? 0 : b.metadata?.primary ? 1 : 2);
  for (const b of [...(birthdays ?? [])].sort((a, b) => rank(a) - rank(b))) {
    const iso = isoDate(b.date?.year, b.date?.month, b.date?.day);
    if (iso) return iso;
  }
  return null;
}

/**
 * วันเกิดจาก Facebook Graph (`/me?fields=birthday`) — รูปแบบ `MM/DD/YYYY`
 * ผู้ใช้ซ่อนบางส่วนได้ (`MM/DD` หรือ `YYYY`) = ไม่ครบ → null
 */
export function facebookBirthdate(birthday: string | null | undefined): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(birthday?.trim() ?? '');
  return m ? isoDate(Number(m[3]), Number(m[1]), Number(m[2])) : null;
}

/** อายุครบ `years` ปีแล้วหรือยัง ณ `today` (วันตาม UTC เหมือน `current_date` ของ DB) */
export function isAtLeastAge(birthdate: string, years = MIN_CUSTOMER_AGE, today: Date = new Date()): boolean {
  const limit = `${today.getUTCFullYear() - years}-${pad(today.getUTCMonth() + 1)}-${pad(today.getUTCDate())}`;
  return birthdate <= limit;
}
