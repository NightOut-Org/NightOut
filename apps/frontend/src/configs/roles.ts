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

/**
 * หลังบ้าน (apps/admin) — โดเมนเดียวกัน (production: vercel.json · dev: vite proxy /admin → :5174)
 * → ใช้ session Supabase ร่วมกัน ไม่ต้องล็อกอินใหม่ (ยังต้องผ่าน MFA)
 */
export const BACKOFFICE_URL = '/admin/';

export interface RoleMeta {
  /** ชื่อสำรอง (ชื่อจริงอ่านจาก DB: user.roleLabel / GET /me/roles) */
  label: string;
  icon: Icon;
  description: string;
  /** ปุ่มลัดในเมนูบัญชี (ลูกค้า = สมัครเปิดร้าน · เมนู "การจอง" อยู่บน navbar แล้ว) */
  cta?: { label: string; icon: Icon; to: string; external?: boolean };
}

/**
 * ชั้นบัญชี (users.role → ตาราง roles · ADR 0005) — ไอคอน คำอธิบาย ปุ่มลัด ที่ navbar และ /profile ใช้
 * ชื่อและสีของชั้นอ่านจาก API (GET /me/roles → hooks/useRoles) · Super Admin แก้สีที่ Backoffice /settings
 * ลำดับใน ROLE_RANK = ต่ำ → สูง · ผู้ใช้เห็นเฉพาะชั้นตัวเองและที่ต่ำกว่า
 */
export const ROLE_META: Record<UserRole, RoleMeta> = {
  CUSTOMER: {
    label: 'ลูกค้า',
    icon: User,
    description: 'ค้นหา จองโต๊ะ และรีวิวร้านที่เช็กอินแล้ว',
    cta: { label: 'เปิดร้านกับ NightOut', icon: Storefront, to: '/merchant/join' },
  },
  STAFF: {
    label: 'พนักงานร้าน',
    icon: IdentificationBadge,
    description: 'เช็กอินลูกค้าและดูแลโต๊ะคืนนี้',
    cta: { label: 'เปิดหน้าคืนนี้', icon: QrCode, to: '/merchant/tonight' },
  },
  MERCHANT: {
    label: 'ร้านค้า',
    icon: Storefront,
    description: 'จัดการร้าน เมนู โต๊ะ มัดจำ และการจองของร้าน',
    cta: { label: 'ไปหน้าร้านของฉัน', icon: Storefront, to: '/merchant' },
  },
  ADMIN: {
    label: 'แอดมิน',
    icon: ShieldCheck,
    description: 'ดูแลหลังบ้าน อนุมัติร้าน Safety และชุมชน',
    cta: { label: 'เข้าหลังบ้าน', icon: ShieldCheck, to: BACKOFFICE_URL, external: true },
  },
  SUPER_ADMIN: {
    label: 'ซูเปอร์แอดมิน',
    icon: CrownSimple,
    description: 'ทุกอย่างของแอดมิน + แก้ชั้นบัญชีผู้ใช้',
    cta: { label: 'เข้าหลังบ้าน', icon: ShieldStar, to: BACKOFFICE_URL, external: true },
  },
};

export const ROLE_RANK: readonly UserRole[] = ['CUSTOMER', 'STAFF', 'MERCHANT', 'ADMIN', 'SUPER_ADMIN'];

/** ชั้นของตัวเองและที่ต่ำกว่า (ต่ำ → สูง) — ไม่โชว์ชั้นที่สูงกว่า */
export const visibleRoles = (role: UserRole) => ROLE_RANK.slice(0, ROLE_RANK.indexOf(role) + 1);

/** สีตั้งต้นของแต่ละชั้น (ตรงกับ migration …20261017000100) — ใช้ระหว่างรอ API / โหลดไม่ได้ */
export const ROLE_DEFAULT_COLORS: Record<UserRole, string> = {
  CUSTOMER: '#B86BFA',
  STAFF: '#8C9BEA',
  MERCHANT: '#E8B64C',
  ADMIN: '#22C55E',
  SUPER_ADMIN: '#EF4444',
};

export interface RoleTone {
  /** สีหลักของชั้น — พื้นป้ายทึบ วงรอบรูป */
  solid: string;
  /** สีตัวหนังสือ/เส้นบนพื้นเว็บ — ธีมสว่างเข้มขึ้นเอง (--role-ink ใน styles/index.css) */
  ink: string;
  /** สีตัวหนังสือบนพื้นทึบ (ดำ/ขาว ตามความสว่างของสีหลัก) */
  on: string;
  /** พื้นจาง / เส้น / แสงเรือง */
  tint: (alpha: number) => string;
}

const HEX = /^#[0-9a-f]{6}$/i;

/** ชุดสีที่หน้าเว็บใช้ จากสีหลัก #RRGGBB ของชั้น (สีผิดรูปแบบ = ม่วงของลูกค้า) */
export function roleTone(color: string): RoleTone {
  const hex = HEX.test(color) ? color : ROLE_DEFAULT_COLORS.CUSTOMER;
  const channel = (i: number) => parseInt(hex.slice(i, i + 2), 16);
  const [r, g, b] = [channel(1), channel(3), channel(5)];
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return {
    solid: hex,
    ink: `color-mix(in oklab, ${hex} var(--role-ink), #000)`,
    on: lum > 0.45 ? '#07070D' : '#FFFFFF',
    tint: (alpha) => `rgba(${r},${g},${b},${alpha})`,
  };
}

/** บรรทัดขอบเขตใต้ชื่อชั้น เช่น "พนักงานร้าน Moonlight Bar" */
export function roleScope(role: UserRole, barName?: string) {
  if (role === 'STAFF') return barName ? `พนักงานร้าน ${barName}` : 'พนักงานร้าน';
  if (role === 'MERCHANT') return barName ? `เจ้าของร้าน ${barName}` : 'เจ้าของร้าน';
  if (role === 'ADMIN') return 'ทีม NightOut';
  if (role === 'SUPER_ADMIN') return 'ทีม NightOut (สิทธิ์สูงสุด)';
  return 'บัญชีส่วนตัว';
}
