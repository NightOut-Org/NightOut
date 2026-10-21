/**
 * โดเมน backoffice — การอ่านของหน้าแอดมิน (ADR 0003): view admin_* · ตาราง master · แดชบอร์ด
 * ชนิดแถวของแต่ละ view อยู่ใน @nightout/types (Db.Admin*)
 */

/** view ที่ GET /admin/views/:view อ่านได้ (RLS ของแต่ละ view: ADMIN + MFA) */
export const ADMIN_VIEWS = [
  'admin_users',
  'admin_bars',
  'admin_bookings',
  'admin_deposits',
  'admin_reviews',
  'admin_safety_queue',
  'admin_promoted_listings',
  'admin_billing_events',
  'admin_audit_logs',
  'admin_bar_promotions',
  'admin_team_members',
  'admin_home_categories',
  'admin_site_nav',
  'admin_bar_media',
  'admin_community_threads',
  'admin_community_comments',
  'admin_bar_locations',
  'admin_bar_location_requests',
  'admin_bar_blacklist',
  'admin_bar_safety',
  'admin_safety_inspections',
  'admin_bar_details',
  'admin_styles',
  'admin_ranking',
  'admin_bar_areas',
  'admin_payment_intents',
  'admin_payment_unmatched',
  'admin_mini_ads',
] as const;
export type AdminView = (typeof ADMIN_VIEWS)[number];

/** view ที่อ่านได้เฉพาะ SUPER_ADMIN (ค่าคอม) — ADMIN ได้ 403 · RLS ของ view ตรวจซ้ำด้วย is_super_admin() */
export const SUPER_ADMIN_VIEWS = ['admin_billing_events'] as const satisfies readonly AdminView[];

/** ตารางตั้งค่าที่ GET /admin/master/:table อ่านได้ */
export const ADMIN_MASTER_TABLES = ['styles', 'safety_features', 'platform_settings', 'districts'] as const;
export type AdminMasterTable = (typeof ADMIN_MASTER_TABLES)[number];

/** query string ของ GET /admin/views/:view — `<คอลัมน์>=<ค่า>` (หลายค่าคั่นด้วย , = in) + `order=<col>.asc|desc` + `limit` */
export interface AdminViewQuery {
  [column: string]: string | number | undefined;
  order?: string;
  limit?: number;
}
export const ADMIN_VIEW_MAX_LIMIT = 2000;
