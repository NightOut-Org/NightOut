import { ThemeMode, UserRole } from '@nightout/types';
import { z } from 'zod';
import { objectPath, uuid } from './common';

/**
 * โดเมน account — โปรไฟล์ ความชอบ แจ้งเตือน ร้านโปรด ลบบัญชี (ลูกค้า)
 * ผู้ใช้ ชั้นบัญชี (roles) แบน/ปลดแบน (Backoffice — ADR 0005)
 */

// ----------------------------- ฉัน -----------------------------
/** GET /me/profile */
export interface MyProfile {
  id: string;
  display_name: string;
  role: UserRole;
  /** ชื่อไทยของชั้นบัญชี (ตาราง roles) */
  role_label: string;
  can_enter_backoffice: boolean;
  /** เบอร์ล่าสุดที่ใช้จอง (E.164) — หน้า Checkout เติมให้ */
  phone_e164: string | null;
  /** ถูกระงับการจองเมื่อ (null = ปกติ) */
  banned_at: string | null;
  /** เหตุผลที่ถูกระงับ (null = ปกติ) */
  ban_reason: string | null;
  /** URL รูปโปรไฟล์ (bucket avatars · null = ใช้ตัวย่อชื่อ) */
  avatar_url: string | null;
}

/** ขนาดไฟล์รูปโปรไฟล์สูงสุดก่อนย่อ (ตรงกับ file_size_limit ของ bucket avatars) */
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
/** ชนิดไฟล์รูปโปรไฟล์ที่รับ */
export const AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** PUT /me/avatar — หลังอัปโหลดไฟล์เข้า bucket avatars (POST /storage/upload-url) แล้ว */
export const SetAvatarBody = z.object({ path: objectPath.describe('path ใน bucket avatars ต้องขึ้นต้นด้วย <user_id>/') });
export type SetAvatarBody = z.infer<typeof SetAvatarBody>;
/** PUT / DELETE /me/avatar */
export interface AvatarResult {
  avatar_url: string | null;
}

/** PATCH /me/profile — ส่งเฉพาะ field ที่แก้ */
export const UpdateProfileBody = z
  .object({
    display_name: z.string().trim().min(1).max(60),
    style_ids: z.array(uuid).max(20),
    district_ids: z.array(uuid).max(20),
    budget_per_person: z.number().min(0).max(1_000_000).nullable(),
    usual_pax: z.number().int().min(1).max(50).nullable(),
    theme: ThemeMode,
    onboarded: z.boolean(),
  })
  .partial();
export type UpdateProfileBody = z.infer<typeof UpdateProfileBody>;

/** POST /me/notifications/read — ไม่ส่ง ids = อ่านทั้งหมด */
export const MarkReadBody = z.object({ ids: z.array(uuid).max(500).nullish() });
export type MarkReadBody = z.infer<typeof MarkReadBody>;

/** POST /me/favorites/:barId/toggle */
export interface ToggleFavoriteResult {
  bar_id: string;
  favorite: boolean;
}

// ----------------------------- สมัครด้วย Google / Facebook -----------------------------
/** POST /me/oauth-signup/verify — ส่ง `provider_token` ที่ได้จาก session หลังกลับจาก Google/Facebook (backend ใช้ดึงวันเกิด) */
export const OAuthSignupVerifyBody = z.object({
  provider_token: z.string().min(10).max(4096).nullish().describe('access token ของ Google/Facebook จาก session (มีเฉพาะตอนเพิ่งล็อกอิน)'),
});
export type OAuthSignupVerifyBody = z.infer<typeof OAuthSignupVerifyBody>;
export interface OAuthSignupVerifyResult {
  /** REGISTERED = มีบัญชีแล้ว (ใช้งานได้เลย) · NEEDS_CONSENT = อายุผ่าน รอยอมรับเงื่อนไขก่อนสร้างบัญชี */
  status: 'REGISTERED' | 'NEEDS_CONSENT';
  /** ผู้ให้บริการที่ใช้สมัคร (null = บัญชีที่สมัครด้วยอีเมลแล้วผูก Google/Facebook ภายหลัง) */
  provider: 'google' | 'facebook' | null;
  email: string;
  /** ชื่อจากบัญชีผู้ให้บริการ — ใช้เป็นชื่อที่แสดงเริ่มต้น */
  display_name: string;
  terms_version: string;
  privacy_version: string;
}

/** POST /me/oauth-signup/complete — ยอมรับ ToS + PDPA แล้วสร้างบัญชี */
export const OAuthSignupCompleteBody = z.object({
  accept_terms: z.literal(true).describe('ยอมรับเงื่อนไขการใช้งานและนโยบายความเป็นส่วนตัว'),
  display_name: z.string().trim().min(1).max(60).optional().describe('ชื่อที่แสดง · ไม่ส่ง = ใช้ชื่อจากบัญชีผู้ให้บริการ'),
});
export type OAuthSignupCompleteBody = z.infer<typeof OAuthSignupCompleteBody>;
export interface OAuthSignupCompleteResult {
  id: string;
  /** false = มีบัญชีอยู่แล้ว (กดซ้ำ) */
  created: boolean;
}

/** DELETE /me/oauth-signup — ไม่ยอมรับเงื่อนไข → ลบบัญชี Auth ที่ยังไม่ได้สร้างโปรไฟล์ */
export interface OAuthSignupCancelResult {
  deleted: boolean;
}

// ----------------------------- Backoffice -----------------------------
/** ประเภทบัญชีที่แอดมินเลือกตอนสร้าง → ชั้นบัญชี + บทบาทในร้าน · ADMIN / SUPER_ADMIN สร้างได้เฉพาะ SUPER_ADMIN */
export const ACCOUNT_TYPES = {
  CUSTOMER: { role: 'CUSTOMER', bar_role: null },
  OWNER: { role: 'MERCHANT', bar_role: 'OWNER' },
  MANAGER: { role: 'MERCHANT', bar_role: 'MANAGER' },
  STAFF: { role: 'STAFF', bar_role: 'STAFF' },
  ADMIN: { role: 'ADMIN', bar_role: null },
  SUPER_ADMIN: { role: 'SUPER_ADMIN', bar_role: null },
} as const satisfies Record<string, { role: UserRole; bar_role: 'OWNER' | 'MANAGER' | 'STAFF' | null }>;
export type AccountType = keyof typeof ACCOUNT_TYPES;
export const AccountType = z.enum(['CUSTOMER', 'OWNER', 'MANAGER', 'STAFF', 'ADMIN', 'SUPER_ADMIN']);

/** ชั้นที่ผู้เรียกเลือกตอนสร้างบัญชีได้ (ADR 0005) */
export const canCreateRole = (actorRole: string | undefined, role: UserRole) =>
  actorRole === 'SUPER_ADMIN' || (role !== 'ADMIN' && role !== 'SUPER_ADMIN');

const isAdult = (d: string) => {
  const limit = new Date();
  limit.setFullYear(limit.getFullYear() - 20);
  return new Date(`${d}T00:00:00Z`) <= limit;
};

/** POST /admin/users */
export const CreateUserBody = z
  .object({
    email: z.string().trim().toLowerCase().max(254).pipe(z.email()).describe('อีเมลที่ใช้เข้าสู่ระบบ'),
    display_name: z.string().trim().min(1).max(60).describe('ชื่อที่แสดง'),
    account_type: AccountType.describe('ลูกค้า / เจ้าของร้าน / ผู้จัดการร้าน / พนักงานร้าน / แอดมิน / ซูเปอร์แอดมิน (2 แบบหลังเฉพาะ SUPER_ADMIN)'),
    bar_id: uuid.nullish().describe('ร้าน — ต้องใส่เมื่อเป็นเจ้าของ / ผู้จัดการ / พนักงานร้าน'),
    birthdate: z.iso.date().refine(isAdult, 'ต้องอายุ 20 ปีขึ้นไป').describe('YYYY-MM-DD · ต้องอายุ 20 ปีขึ้นไป'),
    password: z.string().min(10).max(72).optional().describe('ไม่ใส่ = ระบบสุ่มให้ แล้วตอบกลับครั้งเดียว'),
  })
  .refine((v) => (ACCOUNT_TYPES[v.account_type].bar_role === null) === !v.bar_id, {
    message: 'เจ้าของ / ผู้จัดการ / พนักงานร้าน ต้องเลือกร้าน · ลูกค้า / แอดมิน / ซูเปอร์แอดมิน ห้ามเลือกร้าน',
    path: ['bar_id'],
  });
export type CreateUserBody = z.input<typeof CreateUserBody>;
export interface CreateUserResult {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  bar_id: string | null;
  bar_role: string | null;
  /** เฉพาะเมื่อระบบสุ่มให้ — แสดงครั้งเดียว ไม่ถูกเก็บ */
  password: string | null;
}

/** PATCH /admin/users/:id */
export const UpdateUserAccountBody = z.object({
  email: z
    .email()
    .transform((v) => v.trim().toLowerCase())
    .optional(),
  display_name: z.string().trim().min(1).max(60).optional(),
  phone_e164: z
    .string()
    .trim()
    .regex(/^\+[1-9][0-9]{7,14}$/, 'INVALID_PHONE')
    .nullable()
    .optional(),
  password: z.string().min(10).max(72).optional(),
});
export type UpdateUserAccountBody = z.infer<typeof UpdateUserAccountBody>;

/** PATCH /admin/users/roles (SUPER_ADMIN) — หน้า /users บันทึกชั้นบัญชีที่แก้หลายคนครั้งเดียว */
export const SetUsersRoleBody = z.object({
  changes: z
    .array(z.object({ id: uuid, role: UserRole.describe('ชั้นบัญชีใหม่ (ตาราง roles)') }))
    .min(1)
    .max(200)
    .refine((c) => new Set(c.map((x) => x.id)).size === c.length, 'ผู้ใช้ซ้ำกัน')
    .describe('เฉพาะคนที่เปลี่ยน'),
});
export type SetUsersRoleBody = z.infer<typeof SetUsersRoleBody>;
export interface SetUsersRoleResult {
  updated: number;
  /** จำนวนร้านที่หลุดรวม (ชั้นใหม่เป็นลูกค้า/แอดมิน/ซูเปอร์แอดมิน) */
  bars_detached: number;
}

/** POST /admin/users/:id/ban — แบนบัญชีเอง (ลูกค้า / ทีมร้าน) · แบน = จองไม่ได้ + ชุมชนอ่านได้อย่างเดียว */
export const BanUserBody = z.object({
  reason: z.string().trim().min(3).max(300).describe('เหตุผล — เจ้าของบัญชีเห็นในแจ้งเตือน · บันทึกใน audit log'),
  ban_phones: z.boolean().default(false).describe('แบนทุกเบอร์ที่บัญชีนี้เคยใช้ด้วย (สมัครบัญชีใหม่ด้วยเบอร์เดิมก็จองไม่ได้)'),
});
export type BanUserBody = z.input<typeof BanUserBody>;
export interface BanUserResult {
  id: string;
  banned: true;
  banned_at: string;
  phones_banned: number;
}

/** POST /admin/users/:id/avatar/remove — แอดมินลบรูปโปรไฟล์ไม่เหมาะสม */
export const RemoveUserAvatarBody = z.object({ reason: z.string().trim().min(3).max(300).describe('เหตุผล — เจ้าของบัญชีเห็นในแจ้งเตือน · บันทึกใน audit log') });
export type RemoveUserAvatarBody = z.infer<typeof RemoveUserAvatarBody>;
export interface RemoveUserAvatarResult {
  id: string;
}

/** POST /admin/users/:id/unban */
export const UnbanUserBody = z.object({ reason: z.string().trim().min(3).max(300).describe('เหตุผลที่ปลดแบน (บันทึกใน audit log)') });
export type UnbanUserBody = z.infer<typeof UnbanUserBody>;
export interface UnbanUserResult {
  id: string;
  banned: false;
  phones_unbanned: number;
  flags_cleared: number;
}

/** GET /admin/roles */
export interface AccountRoleOption {
  code: UserRole;
  label_th: string;
  sort_order: number;
  can_enter_backoffice: boolean;
  /** ผู้เรียกเลือกชั้นนี้ตอนสร้างบัญชีได้ */
  can_create: boolean;
  /** ผู้เรียกแก้บัญชีอื่นเป็นชั้นนี้ได้ (เฉพาะซูเปอร์แอดมิน) */
  can_assign: boolean;
}

export const ACCOUNT_ERRORS = {
  INVALID_DISPLAY_NAME: 'ชื่อที่แสดงต้องยาว 1–60 ตัวอักษร',
  HAS_ACTIVE_BOOKINGS: 'ยังมีการจองที่ยังไม่จบ — ยกเลิกหรือรอให้จบก่อนลบบัญชี',
  EMAIL_EXISTS: 'อีเมลนี้มีบัญชีอยู่แล้ว — ถ้าชั้นบัญชีผิด ให้ซูเปอร์แอดมินแก้จากรายชื่อผู้ใช้',
  INVALID_ACCOUNT_TYPE: 'ประเภทบัญชีกับร้านไม่ตรงกัน (เจ้าของ/ผู้จัดการ/พนักงานต้องเลือกร้าน)',
  AGE_UNDER_20: 'ผู้ใช้ต้องอายุ 20 ปีขึ้นไป',
  SELF_ONLY: 'แอดมินแก้ไขได้เฉพาะบัญชีของตัวเอง',
  INVALID_ACCOUNT: 'ข้อมูลบัญชีไม่ถูกต้องหรือไม่สามารถเปลี่ยนแปลงได้',
  INVALID_ROLE_CHANGES: 'ข้อมูลชั้นบัญชีไม่ถูกต้อง — รีเฟรชหน้าแล้วลองใหม่',
  LAST_SUPER_ADMIN: 'ต้องมีซูเปอร์แอดมินอย่างน้อย 1 คน — ตั้งคนอื่นเป็นซูเปอร์แอดมินก่อน',
  BAN_REASON_REQUIRED: 'ใส่เหตุผล 3–300 ตัวอักษร',
  CANNOT_BAN_SELF: 'แบนบัญชีของตัวเองไม่ได้',
  CANNOT_BAN_ADMIN: 'แบนบัญชีทีมงาน NightOut (แอดมิน / ซูเปอร์แอดมิน) ไม่ได้ — ให้ซูเปอร์แอดมินลดชั้นบัญชีก่อน',
  USER_ALREADY_BANNED: 'บัญชีนี้ถูกแบนอยู่แล้ว',
  AVATAR_INVALID: 'อัปโหลดรูปไม่สำเร็จ — เลือกรูปใหม่แล้วลองอีกครั้ง',
  AVATAR_NOT_FOUND: 'บัญชีนี้ไม่มีรูปโปรไฟล์แล้ว',
  AVATAR_REMOVE_REASON_REQUIRED: 'ใส่เหตุผล 3–300 ตัวอักษร',
  OAUTH_BIRTHDATE_MISSING: 'บัญชี Google/Facebook นี้ไม่มีวันเกิดครบ วัน/เดือน/ปี จึงยืนยันอายุไม่ได้ — กรุณาสมัครด้วยอีเมลแทน',
  OAUTH_AGE_UNDER_20: 'วันเกิดในบัญชี Google/Facebook อายุยังไม่ถึง 20 ปี จึงใช้งาน NightOut ไม่ได้',
  OAUTH_EMAIL_MISSING: 'บัญชี Google/Facebook นี้ไม่มีอีเมล — กรุณาสมัครด้วยอีเมลแทน',
  OAUTH_PROVIDER_UNSUPPORTED: 'ยืนยันอายุได้เฉพาะบัญชี Google หรือ Facebook',
  OAUTH_TOKEN_MISMATCH: 'ข้อมูลจาก Google/Facebook ไม่ตรงกับบัญชีที่ล็อกอิน — ออกจากระบบแล้วลองใหม่',
  OAUTH_RELOGIN_REQUIRED: 'หมดเวลายืนยันอายุ — เข้าสู่ระบบด้วย Google/Facebook อีกครั้ง',
  OAUTH_PROVIDER_UNAVAILABLE: 'อ่านวันเกิดจาก Google/Facebook ไม่ได้ — ตรวจว่าอนุญาตให้เข้าถึงวันเกิดแล้วลองใหม่',
} as const satisfies Record<string, string>;
