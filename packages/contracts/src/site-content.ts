import { z } from 'zod';

/**
 * โดเมน site-content — เนื้อหาหน้าแรก (ตาราง home_content / home_categories / home_popular_bars · อ่านอย่างเดียวผ่าน GET /public/home)
 * Hero (หัวข้อ · คำโปรย · ช่องค้นหา · ภาพพื้น) + การ์ดหมวด "คืนนี้อยากได้ฟีลไหน" 8 ช่องแบบ bento + ร้านยอดนิยมที่ปักไว้
 * Backoffice แก้หน้าแรกไม่ได้แล้ว (2026-10-15) — /home-content จัดเมนู navbar (site_nav_items) แทน
 */

/** ช่องของการ์ดหมวดบนกริด bento — ตำแหน่งตายตัว (popular = การ์ดใหญ่ 2×2 · party = กว้าง 2) */
export const HOME_CATEGORY_SLOTS = ['popular', 'pub', 'food', 'live', 'rooftop', 'chill', 'outdoor', 'party'] as const;
export type HomeCategorySlot = (typeof HOME_CATEGORY_SLOTS)[number];

const line = (max: number) => z.string().trim().min(1).max(max);

/** จำนวนร้านในกริดร้านยอดนิยมของหน้าแรก */
export const HOME_POPULAR_MAX = 8;

export interface HomeContent {
  hero_title_lead: string;
  hero_title_highlight: string;
  hero_title_tail: string;
  hero_subtitle: string;
  hero_search_placeholder: string;
  hero_image_url: string | null;
  categories_eyebrow: string;
  categories_title: string;
  popular_eyebrow: string;
  popular_title: string;
  updated_at: string;
}

export interface HomeCategory {
  slot: HomeCategorySlot;
  title: string;
  hint: string;
  link_to: string;
  image_url: string;
  badge: string | null;
  updated_at: string;
}

/** GET /public/home */
export interface PublicHomeResult {
  content: HomeContent;
  /** เรียงตาม HOME_CATEGORY_SLOTS เสมอ */
  categories: HomeCategory[];
  /** ร้านยอดนิยมที่แอดมินปักไว้ (เฉพาะร้าน APPROVED · เรียงตามลำดับ) — ช่องที่เหลือหน้าเว็บเติมด้วยคะแนนรีวิว */
  popular_bar_ids: string[];
}

/**
 * เมนู navbar ของเว็บลูกค้า (ตาราง site_nav_items · นอก MVP — อนุมัติ 2026-10-15) — key ตายตัว ลิงก์/ไอคอนอยู่ในโค้ดหน้าเว็บ
 * แก้ได้: ชื่อที่แสดง · ลำดับ · ซ่อน/แสดง แยก 2 ชุด (desktop = navbar แคปซูล · mobile = แถบเมนูล่าง) · "หน้าหลัก" ซ่อนไม่ได้
 */
export const SITE_NAV_KEYS = ['home', 'search', 'community', 'ranking', 'bookings', 'about'] as const;
export const SiteNavKey = z.enum(SITE_NAV_KEYS);
export type SiteNavKey = z.infer<typeof SiteNavKey>;
/** เมนูที่ซ่อนไม่ได้ */
export const SITE_NAV_REQUIRED: SiteNavKey = 'home';
export const SITE_NAV_LABEL_MAX = 20;

export interface SiteNavItem {
  key: SiteNavKey;
  label: string;
  desktop_order: number;
  desktop_visible: boolean;
  mobile_order: number;
  mobile_visible: boolean;
}

const isPermutation = (orders: number[]) =>
  [...orders].sort((a, b) => a - b).every((o, i) => o === i);

/** PUT /admin/site-nav — ส่งครบทุกเมนู (ลำดับแต่ละชุด 0..n-1 ไม่ซ้ำ) */
export const SaveSiteNavBody = z.object({
  items: z
    .array(
      z.object({
        key: SiteNavKey,
        label: line(SITE_NAV_LABEL_MAX).describe('ชื่อเมนูที่แสดง'),
        desktop_order: z.number().int().min(0).describe('ลำดับบน navbar (0 = ซ้ายสุด)'),
        desktop_visible: z.boolean().describe('แสดงบน navbar'),
        mobile_order: z.number().int().min(0).describe('ลำดับบนแถบเมนูล่างของมือถือ (0 = ซ้ายสุด)'),
        mobile_visible: z.boolean().describe('แสดงบนแถบเมนูล่างของมือถือ'),
      }),
    )
    .length(SITE_NAV_KEYS.length, 'ต้องส่งครบทุกเมนู')
    .refine((items) => new Set(items.map((i) => i.key)).size === items.length, 'มีเมนูซ้ำ')
    .refine((items) => isPermutation(items.map((i) => i.desktop_order)), 'ลำดับ navbar ไม่ถูกต้อง')
    .refine((items) => isPermutation(items.map((i) => i.mobile_order)), 'ลำดับเมนูมือถือไม่ถูกต้อง')
    .refine(
      (items) => items.every((i) => i.key !== SITE_NAV_REQUIRED || (i.desktop_visible && i.mobile_visible)),
      'ซ่อนหน้าหลักไม่ได้',
    ),
});
export type SaveSiteNavBody = z.infer<typeof SaveSiteNavBody>;
export interface SaveSiteNavResult {
  /** จำนวนเมนูที่เปลี่ยน */
  updated: number;
}

export const SITE_CONTENT_ERRORS = {
  INVALID_SITE_NAV: 'เมนูไม่ครบ ลำดับซ้ำ ชื่อว่าง/ยาวเกิน 20 ตัวอักษร หรือซ่อนหน้าหลัก — รีเฟรชหน้าแล้วลองใหม่',
} as const satisfies Record<string, string>;
