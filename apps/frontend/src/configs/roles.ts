import {
  CrownSimple,
  IdentificationBadge,
  QrCode,
  ShieldCheck,
  ShieldStar,
  Storefront,
  User,
  type Icon,
} from '@phosphor-icons/react';
import type { UserRole } from '@nightout/types';

/** หลังบ้าน (apps/admin) — production เสิร์ฟใต้ /admin/ โดเมนเดียวกัน (vercel.json) · dev พอร์ต 5174 */
export const BACKOFFICE_URL = import.meta.env.DEV ? 'http://localhost:5174/admin/' : '/admin/';

export interface RoleMeta {
  /** ชื่อสำรอง (ชื่อจริงอ่านจาก DB: user.roleLabel) */
  label: string;
  /** สีตัวหนังสือ/เส้นของชั้นนี้ — token ที่เปลี่ยนตามธีม */
  color: string;
  /** RGB ของสีหลัก (โหมดมืด) ไว้ทำพื้นจาง/เส้น/แสงเรือง และพื้นทึบของป้าย */
  rgb: string;
  icon: Icon;
  description: string;
  /** ปุ่มลัดในเมนูบัญชี — ลูกค้าไม่มี (เมนู "การจอง" อยู่บน navbar แล้ว) */
  cta?: { label: string; icon: Icon; to: string; external?: boolean };
}

/**
 * ชั้นบัญชี (users.role → ตาราง roles · ADR 0005) — สี ไอคอน คำอธิบาย ที่ navbar และ /profile ใช้
 * ลำดับใน ROLE_RANK = ต่ำ → สูง · ผู้ใช้เห็นเฉพาะชั้นตัวเองและที่ต่ำกว่า
 */
export const ROLE_META: Record<UserRole, RoleMeta> = {
  CUSTOMER: {
    label: 'ลูกค้า',
    color: 'var(--link)',
    rgb: '184,107,250',
    icon: User,
    description: 'ค้นหา จองโต๊ะ และรีวิวร้านที่เช็กอินแล้ว',
  },
  STAFF: {
    label: 'พนักงานร้าน',
    color: 'var(--role-staff)',
    rgb: '140,155,234',
    icon: IdentificationBadge,
    description: 'เช็กอินลูกค้าและดูแลโต๊ะคืนนี้',
    cta: { label: 'เปิดหน้าคืนนี้', icon: QrCode, to: '/merchant/tonight' },
  },
  MERCHANT: {
    label: 'ร้านค้า',
    color: 'var(--gold-text)',
    rgb: '232,182,76',
    icon: Storefront,
    description: 'จัดการร้าน เมนู โต๊ะ มัดจำ และการจองของร้าน',
    cta: { label: 'ไปหน้าร้านของฉัน', icon: Storefront, to: '/merchant' },
  },
  ADMIN: {
    label: 'แอดมิน',
    color: 'var(--crowd-available)',
    rgb: '34,197,94',
    icon: ShieldCheck,
    description: 'ดูแลหลังบ้าน อนุมัติร้าน Safety และชุมชน',
    cta: { label: 'เข้าหลังบ้าน', icon: ShieldCheck, to: BACKOFFICE_URL, external: true },
  },
  SUPER_ADMIN: {
    label: 'ซูเปอร์แอดมิน',
    color: 'var(--crowd-full)',
    rgb: '239,68,68',
    icon: CrownSimple,
    description: 'ทุกอย่างของแอดมิน + แก้ชั้นบัญชีผู้ใช้',
    cta: { label: 'เข้าหลังบ้าน', icon: ShieldStar, to: BACKOFFICE_URL, external: true },
  },
};

export const ROLE_RANK: readonly UserRole[] = ['CUSTOMER', 'STAFF', 'MERCHANT', 'ADMIN', 'SUPER_ADMIN'];

/** ชั้นของตัวเองและที่ต่ำกว่า (ต่ำ → สูง) — ไม่โชว์ชั้นที่สูงกว่า */
export const visibleRoles = (role: UserRole) => ROLE_RANK.slice(0, ROLE_RANK.indexOf(role) + 1);

/** พื้นจาง / เส้น / แสงเรือง จาก RGB ของชั้น */
export const roleTint = (m: RoleMeta, alpha: number) => `rgba(${m.rgb},${alpha})`;

/** บรรทัดขอบเขตใต้ชื่อชั้น เช่น "Moonlight Bar · พนักงาน" */
export function roleScope(role: UserRole, barName?: string) {
  if (role === 'STAFF') return barName ? `${barName} · พนักงาน` : 'พนักงานร้าน';
  if (role === 'MERCHANT') return barName ? `${barName} · เจ้าของ` : 'เจ้าของร้าน';
  if (role === 'ADMIN') return 'ทีม NightOut';
  if (role === 'SUPER_ADMIN') return 'ทีม NightOut · สิทธิ์สูงสุด';
  return 'บัญชีส่วนตัว';
}
