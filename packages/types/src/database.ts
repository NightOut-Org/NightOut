/**
 * NightOut — Data structures (packages/types/src/database.ts)
 *
 * ชนิดตาราง/enum/function มาจาก `supabase gen types` (database.generated.ts — ห้ามแก้มือ)
 *   สร้างใหม่หลังแก้ migration: pnpm --filter @nightout/backend db:types
 * ไฟล์นี้ override เฉพาะ view ที่หน้าบ้านใช้ (jsonb → ชนิดจริง, คอลัมน์ที่ไม่มีทางเป็น null → non-null)
 * ตามสัญญาใน docs/DATABASE_CHANGES.md หัวข้อ 5 (กฎ "ไม่มีข้อมูล")
 *
 * ใช้: import { Db } from '@nightout/types'  →  Db.BarCard, Db.BarDetail, Db.Enums<'booking_status'>, Db.BOOKING_TRANSITIONS
 * ชื่อ key เป็น snake_case ตามหลังบ้าน (ไม่มีชั้นแปลงชื่อ)
 */
import type { Database, Json } from './database.generated';
import type {
  LocationRequestSource,
  LocationRequestStatus,
  PaymentEventType,
  PaymentIntentStatus,
  PaymentRefundStatus,
  SafetyCheckResult,
  TransitLine,
} from './enums';

export type { Database, Json };

type PublicSchema = Database['public'];
export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row'];
export type TablesInsert<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Update'];
export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T];
type ViewRow<T extends keyof PublicSchema['Views']> = PublicSchema['Views'][T]['Row'];

/** view ที่ gen types ให้ทุกคอลัมน์เป็น nullable → บังคับคอลัมน์ที่รู้ว่าไม่ null ให้เป็น non-null + แทนชนิด jsonb */
type Override<Row, NonNull extends keyof Row, Json extends object> = Omit<Row, NonNull | keyof Json> & {
  [K in NonNull]-?: NonNullable<Row[K]>;
} & Json;

// ---------------------------------------------------------------------
// ชิ้นส่วน jsonb ที่ใช้ซ้ำ
// ---------------------------------------------------------------------
export type UUID = string;
export type ISODateTime = string;
export type ISODate = string;
/** "HH:MM" */
export type TimeHM = string;

export interface DistrictRef {
  id: UUID;
  slug: string;
  name_th: string;
}

/** key ตัวเล็กเสมอ 3 ตัว (หลังบ้านเก็บ enum ตัวใหญ่ MALE/FEMALE/LGBTQ) · ส่ง request_pr / p_pr_gender เป็นตัวใหญ่ */
export interface PrCounts {
  male: number;
  female: number;
  lgbtq: number;
}

export interface OpeningHour {
  day_of_week: number; // 0 = อาทิตย์
  open_time: TimeHM | null;
  close_time: TimeHM | null;
  is_closed: boolean;
}

export interface SpecialHour {
  date: ISODate;
  open_time: TimeHM | null;
  close_time: TimeHM | null;
  is_closed: boolean;
  note: string | null;
}

export interface MediaItem {
  id: UUID;
  kind: Enums<'media_kind'>;
  storage_path: string;
  caption?: string | null;
  thumb_path?: string | null;
  width: number | null;
  height: number | null;
  duration_sec: number | null;
}

export interface BarLinkItem {
  type: Enums<'link_type'>;
  url: string;
}

export interface BookingSettings {
  deposit_amount: number;
  deposit_unit: Enums<'deposit_unit'>;
  deposit_policy: string | null;
  refund_before_hours: number;
  grace_minutes: number;
  pending_timeout_minutes: number;
  deposit_timeout_minutes: number;
  max_pax_per_booking: number;
  min_advance_minutes: number;
  max_advance_days: number;
}

export interface FeeItem {
  fee_type: Enums<'fee_type'>;
  label: string;
  calc: Enums<'fee_calc'>;
  value: number;
}

export interface MenuEntry {
  id: UUID;
  category: string | null;
  name: string;
  description: string | null;
  price: number;
  unit_label: string | null;
  image_path: string | null;
  is_available: boolean;
}

export interface PackageEntry {
  id: UUID;
  name: string;
  description: string | null;
  pax_min: number;
  pax_max: number;
  total_price: number;
  fees_included: boolean;
  items: { menu_item_id: UUID | null; name: string; quantity: number; unit_price: number }[];
}

export interface PromotionEntry {
  id: UUID;
  title: string;
  description: string | null;
  perk_type: Enums<'perk_type'>;
  discount_percent: number | null;
  days_of_week: number[];
  valid_from: ISODate | null;
  valid_to: ISODate | null;
  cutoff_time: TimeHM | null;
  min_pax: number | null;
}

export interface ZoneEntry {
  id: UUID;
  name: string;
  capacity_pax: number;
  default_duration_minutes: number;
  allow_zone_only_booking: boolean;
  tables: { id: UUID; name: string; seats: number }[];
}

export interface SafetyEntry {
  key: string;
  name_th: string;
  icon: string;
  value: Enums<'safety_value'>;
  source: Enums<'safety_source'> | null;
  verified_at: ISODateTime | null;
  /** วิธีตรวจของ ADMIN_VERIFIED — EVIDENCE ตรวจหลักฐาน · ON_SITE ลงพื้นที่ (ไม่มี/null = ข้อมูลเก่า → ถือเป็นตรวจหลักฐาน) */
  verify_method?: Enums<'safety_verify_method'> | null;
}

/** ตำแหน่งร้าน (bars / bar_location_requests / jsonb snapshot) — migration 20261013000600 */
export interface BarLocationFields {
  lat: number;
  lng: number;
  address: string;
  parking_note: string | null;
  transit_line: TransitLine | null;
  transit_station: string | null;
  transit_walk_minutes: number | null;
}

/** my_bar_detail.location_request — คำขอล่าสุดของร้าน (ทุกสถานะ) · null = ไม่เคยขอ */
export interface MyBarLocationRequest extends BarLocationFields {
  id: UUID;
  status: LocationRequestStatus;
  source: LocationRequestSource;
  /** ค่าที่ใช้จริงตอนอนุมัติ (แอดมินอาจปรับ) · null = ยังไม่อนุมัติ */
  applied: BarLocationFields | null;
  admin_edited: boolean;
  /** เหตุผลตีกลับ / ยกเลิก / หมายเหตุแอดมิน */
  reason: string | null;
  created_at: ISODateTime;
  reviewed_at: ISODateTime | null;
}

// ---------------------------------------------------------------------
// view ที่หน้าบ้านใช้
// ---------------------------------------------------------------------
type BarCardNonNull =
  | 'id' | 'slug' | 'name' | 'category' | 'lat' | 'lng' | 'has_pr' | 'is_new'
  | 'rating_count' | 'checkin_count' | 'is_promoted';
type BarCardJson = { district: DistrictRef | null; styles: string[]; pr_counts: PrCounts };

/** bar_cards — ลิสต์ร้าน / แผนที่ / ranking (styles = key ตัวใหญ่ เช่น 'ROOFTOP') */
export type BarCard = Override<ViewRow<'bar_cards'>, BarCardNonNull, BarCardJson>;

/** bar_detail — หน้ารายละเอียดร้าน (หนึ่งหน้า = หนึ่งการเรียก) */
export type BarDetail = Override<
  ViewRow<'bar_detail'>,
  BarCardNonNull | 'address' | 'perks',
  BarCardJson & {
    hours: OpeningHour[];
    special_hours: SpecialHour[];
    media: MediaItem[];
    links: BarLinkItem[];
    booking_settings: BookingSettings | null;
    fees: FeeItem[];
    menu: MenuEntry[];
    packages: PackageEntry[];
    promotions: PromotionEntry[];
    zones: ZoneEntry[];
    safety: SafetyEntry[];
    /** ที่จอดรถ + รถไฟฟ้าใกล้สุด (migration 20261013000600) · null = ไม่ระบุ */
    parking_note: string | null;
    transit_line: TransitLine | null;
    transit_station: string | null;
    transit_walk_minutes: number | null;
  }
>;

/** public_reviews — ไม่มี email/birthdate · display_name เป็น null ได้ถ้าบัญชีถูกลบ */
export type PublicReview = Override<
  ViewRow<'public_reviews'>,
  'id' | 'bar_id' | 'rating' | 'created_at',
  { media: MediaItem[] }
>;

export type MyBar = Override<
  ViewRow<'my_bars'>,
  'id' | 'slug' | 'name' | 'category' | 'status' | 'staff_role' | 'is_new' | 'rating_count' | 'checkin_count' | 'created_at' | 'updated_at',
  { district: DistrictRef | null }
>;

export interface BookingBarRef {
  id: UUID;
  slug: string;
  name: string;
  cover_image_url: string | null;
  cover_style: string | null;
}

export type MyBooking = Override<
  ViewRow<'my_bookings'>,
  'id' | 'code' | 'status' | 'booking_datetime' | 'pax' | 'deposit_required' | 'auto_cancel_at' | 'created_at' | 'updated_at',
  { bar: BookingBarRef | null }
>;

export interface DepositSummary {
  id: UUID;
  amount: number;
  status: Enums<'deposit_status'>;
  reject_reason: string | null;
  settlement: Enums<'deposit_settlement'>;
  verified_at: ISODateTime | null;
  created_at: ISODateTime;
}

export type BookingDetail = Override<
  ViewRow<'booking_detail'>,
  | 'id' | 'code' | 'status' | 'user_id' | 'is_mine' | 'booking_datetime' | 'reserved_from' | 'reserved_until'
  | 'pax' | 'deposit_required' | 'grace_minutes' | 'auto_cancel_at' | 'created_at' | 'updated_at',
  {
    bar: (BookingBarRef & { address: string; lat: number; lng: number }) | null;
    zone: { id: UUID; name: string } | null;
    table: { id: UUID; name: string; seats: number } | null;
    promotion: { id: UUID | null; title: string; perk: Json; redeemed_at: ISODateTime | null } | null;
    price_estimate: {
      items: { menu_item_id: UUID | null; name: string; qty: number; unit_price: number }[];
      subtotal: number;
      service_charge_rate: number;
      vat_rate: number;
      other_fees: { label: string; calc: Enums<'fee_calc'>; value: number; amount: number }[];
      estimated_total: number;
      per_person: number;
    } | null;
    package: { package_id: UUID | null; name: string; items: Json; price: number; fees: Json } | null;
    deposit: DepositSummary | null;
    checkin: { checked_in_at: ISODateTime; method: Enums<'checkin_method'>; actual_pax: number | null } | null;
    status_history: {
      from_status: Enums<'booking_status'> | null;
      to_status: Enums<'booking_status'>;
      reason: string | null;
      created_at: ISODateTime;
    }[];
  }
>;

export type MyFavorite = BarCard & { favorited_at: ISODateTime };

/** rpc('nearby_bars') */
export type NearbyBar = BarCard & { distance_m: number };

/** rpc('search_bars') args */
export type SearchBarsArgs = PublicSchema['Functions']['search_bars']['Args'];

// ---------------------------------------------------------------------
// Backoffice (view admin_* — อ่านได้เฉพาะ ADMIN ที่ผ่าน MFA · ผู้อื่นได้แถวว่าง)
// การกระทำทั้งหมดส่งผ่าน NestJS /api/admin/* (เรียกฟังก์ชัน admin_* ด้วย service_role + audit log)
// ---------------------------------------------------------------------
export interface IdName {
  id: UUID;
  name: string;
}
export interface UserRef {
  id: UUID;
  email: string;
  display_name: string;
}

export type AdminUser = Override<
  ViewRow<'admin_users'>,
  'id' | 'email' | 'display_name' | 'role' | 'created_at' | 'fake_slip_count',
  {
    bars: { id: UUID; slug: string; name: string; role: Enums<'bar_staff_role'> }[];
    /** เบอร์ที่ถูกแบนเพราะบัญชีนี้ (E.164) */
    banned_phones: string[];
  }
>;

export type AdminBar = Override<
  ViewRow<'admin_bars'>,
  'id' | 'slug' | 'name' | 'category' | 'status' | 'created_at' | 'is_new' | 'rating_count' | 'checkin_count' | 'is_promoted',
  { district: DistrictRef | null; owner: UserRef | null }
>;

export interface AdminStatusHistory {
  from_status: Enums<'booking_status'> | null;
  to_status: Enums<'booking_status'>;
  reason: string | null;
  created_at: ISODateTime;
  /** ชื่อผู้เปลี่ยน · null = ระบบ */
  changed_by: string | null;
}

export type AdminBooking = Override<
  ViewRow<'admin_bookings'>,
  'id' | 'code' | 'status' | 'booking_datetime' | 'pax' | 'deposit_required' | 'created_at',
  {
    bar: IdName;
    customer: UserRef | null;
    status_history: AdminStatusHistory[];
    /** หลักฐานการยอมรับเงื่อนไขริบมัดจำตอน Checkout (booking_deposit_consents) */
    deposit_consent: AdminDepositConsent | null;
  }
>;

export interface AdminDepositConsent {
  terms_version: string;
  terms_text: string;
  deposit_amount: number;
  refund_before_hours: number;
  grace_minutes: number;
  deposit_policy: string | null;
  ip: string | null;
  user_agent: string | null;
  accepted_at: ISODateTime;
}

/** เหตุผลที่แอดมินปฏิเสธสลิป (ข้อความ: DEPOSIT_REJECT_REASONS ใน @nightout/utils) */
export type DepositRejectCode = 'FAKE_SLIP' | 'AMOUNT_MISMATCH' | 'WRONG_ACCOUNT' | 'UNREADABLE' | 'DUPLICATE' | 'OTHER';

export type AdminDeposit = Override<
  ViewRow<'admin_deposits'>,
  'id' | 'amount' | 'status' | 'settlement' | 'created_at' | 'customer_fake_slip_count' | 'customer_banned',
  {
    reject_code: DepositRejectCode | null;
    booking: { id: UUID; code: string; status: Enums<'booking_status'>; booking_datetime: ISODateTime; pax: number };
    bar: IdName;
    customer: UserRef | null;
    /** บัญชีรับเงินหลักของร้าน (เลขบัญชีแสดงแค่ 4 ตัวท้าย) */
    payout_account: { bank_code: string; account_name: string; account_no_last4: string } | null;
    payment_intent_id: UUID | null;
    /** ชำระออนไลน์ผ่านผู้ให้บริการไหน · null = โอน + สลิป */
    payment_provider: string | null;
  }
>;

/** payment_events ที่ผูกกับรายการ (ใหม่สุดก่อน · สูงสุด 20) */
export interface PaymentEventRow {
  id: number;
  event_type: PaymentEventType;
  raw_type: string | null;
  /** CONFIRMED / REFUND_REQUIRED / FAILED / EXPIRED / CANCELLED / IGNORED / NOT_FOUND (PENDING = ค่าเริ่มต้นก่อนฟังก์ชันตั้งผล) */
  result: string;
  amount: number | null;
  received_at: ISODateTime;
}

/** admin_payment_intents (migration 20261013001100) — รายการชำระ Table Fee ผ่านผู้ให้บริการ · Backoffice "การชำระเงิน" */
export interface AdminPaymentIntent {
  id: UUID;
  provider: string;
  provider_ref: string | null;
  amount: number;
  currency: 'THB';
  /** PENDING ที่เลย expires_at แสดงเป็น EXPIRED */
  status: PaymentIntentStatus;
  /** ค่าในตารางจริง */
  raw_status: PaymentIntentStatus;
  checkout_created: boolean;
  expires_at: ISODateTime;
  paid_at: ISODateTime | null;
  paid_amount: number | null;
  closed_at: ISODateTime | null;
  failure_code: string | null;
  failure_message: string | null;
  deposit_id: UUID | null;
  deposit_settlement: Enums<'deposit_settlement'> | null;
  /** ชำระแล้วและผูกกับการจองแล้ว (มีแถว deposits) */
  applied: boolean;
  refund_status: PaymentRefundStatus;
  refund_reason: string | null;
  refund_note: string | null;
  refund_ref: string | null;
  refunded_at: ISODateTime | null;
  refunded_by_name: string | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
  booking: { id: UUID; code: string; status: Enums<'booking_status'>; booking_datetime: ISODateTime; pax: number };
  bar: IdName;
  customer: UserRef | null;
  events: PaymentEventRow[];
}

/** admin_payment_unmatched (migration 20261013001100) — webhook "ชำระสำเร็จ" ที่หารายการชำระไม่เจอ → แอดมินตรวจ/คืนเงินที่ระบบผู้ให้บริการเอง */
export interface AdminPaymentUnmatched {
  id: number;
  provider: string;
  event_id: string;
  raw_type: string | null;
  provider_ref: string | null;
  amount: number | null;
  received_at: ISODateTime;
}

export type AdminReview = Override<
  ViewRow<'admin_reviews'>,
  'id' | 'rating' | 'status' | 'created_at' | 'open_report_count',
  {
    bar: IdName;
    reports: { reason: string; detail: string | null; status: Enums<'report_status'>; created_at: ISODateTime }[];
  }
>;

export type AdminSafetyItem = Override<
  ViewRow<'admin_safety_queue'>,
  'id' | 'bar_id' | 'feature_key' | 'name_th' | 'value' | 'source' | 'updated_at' | 'open_inaccurate_reports' | 'awaiting_visit',
  { bar: IdName; last_result: SafetyCheckResult | null }
>;

/** 1 ข้อในผลลงพื้นที่ตรวจ (admin_safety_inspections.items) */
export interface SafetyInspectionItem {
  feature_key: string;
  name_th: string;
  result: SafetyCheckResult;
  note: string | null;
  photo_paths: string[];
  value_before: Enums<'safety_value'> | null;
  value_after: Enums<'safety_value'> | null;
}

/** admin_bar_safety — checklist ทุกข้อของร้าน (ร้านยังไม่แจ้ง = UNKNOWN) สำหรับ Drawer ลงพื้นที่ตรวจ · verify_method + verified_by_name + verified_at = ตรวจด้วยวิธีไหน โดยใคร เมื่อไร */
export type AdminBarSafety = Override<
  ViewRow<'admin_bar_safety'>,
  'bar_id' | 'feature_key' | 'name_th' | 'icon' | 'weight' | 'sort_order' | 'value' | 'open_inaccurate_reports',
  { last_result: SafetyCheckResult | null }
>;

/** admin_safety_inspections — ประวัติการลงพื้นที่ตรวจ */
export type AdminSafetyInspection = Override<
  ViewRow<'admin_safety_inspections'>,
  'id' | 'bar_id' | 'inspector_name' | 'inspected_at' | 'pass_count' | 'fail_count' | 'na_count' | 'created_at',
  { bar: IdName; items: SafetyInspectionItem[] }
>;

export type AdminPromotedListing = Override<
  ViewRow<'admin_promoted_listings'>,
  'id' | 'placement' | 'price_paid' | 'status' | 'created_at',
  {
    bar: IdName;
    package: { id: UUID; name: string; duration_days: number };
    latest_payment: { id: UUID; amount: number; slip_path: string | null; status: string; created_at: ISODateTime } | null;
  }
>;

export type AdminBillingEvent = Override<
  ViewRow<'admin_billing_events'>,
  'id' | 'event_type' | 'base_amount' | 'amount' | 'status' | 'created_at' | 'booking_code',
  { bar: IdName }
>;

export type AdminAuditLog = Override<
  ViewRow<'admin_audit_logs'>,
  'id' | 'action' | 'entity_type' | 'created_at',
  { actor: UserRef | null }
>;

export type AdminDashboard = PublicSchema['Functions']['admin_dashboard']['Returns'][number];

/** โปรโมชันของร้านที่รอแอดมินตรวจถ้อยคำ */
export type AdminBarPromotion = Override<
  ViewRow<'admin_bar_promotions'>,
  'id' | 'title' | 'active' | 'moderation_status' | 'created_at',
  { bar: IdName; days_of_week: number[] }
>;

// ---------------------------------------------------------------------
// ร้านค้า / ลูกค้า (migration …001700)
// ---------------------------------------------------------------------
/** my_bar_detail — ร้านของฉัน (ทุกสถานะ) รูปแบบเดียวกับ BarDetail + สถานะ/บทบาท/บัญชีรับเงิน · promotions มี active + moderation_status */
export type MyBarDetail = Override<
  ViewRow<'my_bar_detail'>,
  BarCardNonNull | 'address' | 'perks' | 'status' | 'staff_role' | 'created_at' | 'updated_at',
  BarCardJson & {
    hours: OpeningHour[];
    links: BarLinkItem[];
    booking_settings: BookingSettings | null;
    fees: FeeItem[];
    menu: MenuEntry[];
    packages: PackageEntry[];
    promotions: (PromotionEntry & { active: boolean; moderation_status: Enums<'moderation_status'> })[];
    zones: ZoneEntry[];
    safety: SafetyEntry[];
    payout_account: { bank_code: string; account_name: string; account_no_last4: string; verified_at: ISODateTime | null } | null;
    /** รูปแกลเลอรีของร้าน (migration 20261009000100) — ปก = cover_image_url */
    media: MediaItem[];
    /** ที่จอดรถ + รถไฟฟ้าใกล้สุด (migration 20261013000600) · null = ไม่ระบุ */
    parking_note: string | null;
    transit_line: TransitLine | null;
    transit_station: string | null;
    transit_walk_minutes: number | null;
    /** หมุดผ่านการตรวจล่าสุดเมื่อไร · null = ยังไม่เคยตรวจ */
    location_reviewed_at: ISODateTime | null;
    /** คำขอแก้ตำแหน่งล่าสุด (ทุกสถานะ) · null = ไม่เคยขอ */
    location_request: MyBarLocationRequest | null;
  }
>;

/** my_reviews — รีวิวของฉัน (ทุกสถานะ) */
export type MyReview = Override<
  ViewRow<'my_reviews'>,
  'id' | 'booking_id' | 'bar_id' | 'rating' | 'status' | 'created_at',
  { bar: { id: UUID; slug: string; name: string }; media: MediaItem[] }
>;

/** rpc('zone_availability', {p_bar, p_datetime}) */
export type ZoneAvailability = PublicSchema['Functions']['zone_availability']['Returns'][number];

// ---------------------------------------------------------------------
// ทีมงานหน้า /about (migration …001800)
// ---------------------------------------------------------------------
/** team_members.contacts — key ที่ไม่มี/ค่าว่าง = ไม่แสดงไอคอนนั้น */
export interface TeamContacts {
  /** URL เต็ม */
  facebook?: string;
  instagram?: string;
  tiktok?: string;
  github?: string;
  linkedin?: string;
  /** LINE ID หรือ URL */
  line?: string;
  email?: string;
  phone?: string;
}

/** public_team — ทีมงานที่ active เรียงตาม sort_order */
export type PublicTeamMember = Override<
  ViewRow<'public_team'>,
  'id' | 'nickname' | 'roles' | 'skills' | 'sort_order',
  { contacts: TeamContacts }
>;

/** admin_team_members (migration 20261003000100) — ทุกคนรวมที่ซ่อนอยู่ · Backoffice "ทีมงาน" */
export type AdminTeamMember = Omit<Tables<'team_members'>, 'contacts'> & { contacts: TeamContacts };

/** admin_home_content / admin_home_categories (migration 20261007000100) — เนื้อหาหน้าแรกที่แก้ได้ · Backoffice "หน้าแรก" */
export type AdminHomeContent = Omit<Tables<'home_content'>, 'id'>;
export type AdminHomeCategory = Tables<'home_categories'>;
/** admin_home_popular (migration 20261008000300) — ร้านยอดนิยมที่ปักไว้บนหน้าแรก (รวมร้านที่ไม่ APPROVED แล้ว) */
export type AdminHomePopular = Pick<Tables<'home_popular_bars'>, 'bar_id' | 'sort_order'> &
  Pick<Tables<'bars'>, 'name' | 'slug' | 'status'>;

/** admin_bar_media (migration 20261009000100) — รูปร้าน 1 แถวต่อร้าน (ทุกสถานะ) · Backoffice "รูปร้าน" · path อยู่ bucket bar-media */
export interface AdminBarMedia {
  id: UUID;
  slug: string;
  name: string;
  status: Enums<'bar_status'>;
  /** URL เต็มของรูปปก (หนึ่งในแกลเลอรี) · null = ใช้รูปแทน */
  cover_image_url: string | null;
  media: { id: UUID; storage_path: string; created_at: ISODateTime }[];
  menu: { id: UUID; category: string | null; name: string; image_path: string | null }[];
  media_count: number;
  menu_image_count: number;
  updated_at: ISODateTime;
}

/** admin_bar_locations (migration 20261013000600) — 1 แถวต่อร้าน (ทุกสถานะ) · Backoffice /bar-locations + /merchants */
export interface AdminBarLocation extends BarLocationFields {
  id: UUID;
  slug: string;
  name: string;
  status: Enums<'bar_status'>;
  district: DistrictRef | null;
  owner: UserRef | null;
  location_reviewed_at: ISODateTime | null;
  location_reviewed_by: { id: UUID; display_name: string } | null;
  /** หมุดค่าเริ่มต้นที่ระบบเดิมใส่ให้ (ร้านไม่ได้ปักเอง) */
  is_default_pin: boolean;
  location_pending: boolean;
  pending_request: (BarLocationFields & { id: UUID; created_at: ISODateTime; requested_by: UserRef | null }) | null;
  pending_since: ISODateTime | null;
  updated_at: ISODateTime;
}

/** admin_bar_location_requests (migration 20261013000600) — ประวัติคำขอ/การตั้งแทนทุกครั้ง */
export interface AdminBarLocationRequest extends BarLocationFields {
  id: UUID;
  bar_id: UUID;
  bar: { id: UUID; slug: string; name: string; status: Enums<'bar_status'> };
  source: LocationRequestSource;
  status: LocationRequestStatus;
  /** ค่าใน bars ตอนส่ง */
  previous: BarLocationFields;
  /** ค่าที่ใช้จริงตอนอนุมัติ · null = ยังไม่อนุมัติ */
  applied: BarLocationFields | null;
  admin_edited: boolean;
  reason: string | null;
  requested_by: UserRef | null;
  reviewed_by: { id: UUID; display_name: string } | null;
  created_at: ISODateTime;
  reviewed_at: ISODateTime | null;
}

/** สถานะกระทู้/ความเห็นชุมชน (migration 20261010000100) · DELETED = เจ้าของลบ (ไม่ขึ้นใน view แอดมิน) */
export type CommunityStatus = 'PUBLISHED' | 'HIDDEN' | 'REMOVED' | 'DELETED';
/** ไฟล์แนบ (migration 20261011000100) — path ใน bucket community-media (private · Backoffice ขอ signed URL เอง) */
export interface CommunityMediaRow {
  id: UUID;
  kind: 'IMAGE' | 'VIDEO';
  path: string;
  thumb_path: string | null;
  duration_sec: number | null;
}
export interface CommunityReportRow {
  reason: 'SPAM' | 'OFFENSIVE' | 'ADVERTISING' | 'PRIVACY' | 'OTHER';
  detail: string | null;
  status: 'OPEN' | 'RESOLVED';
  created_at: ISODateTime;
}
/** เวอร์ชันก่อนหน้าของกระทู้/ความเห็น (community_revisions · migration 20261012000800) ใหม่สุดก่อน */
export interface CommunityRevisionRow {
  /** กระทู้เท่านั้น (ความเห็น = null) */
  title: string | null;
  body: string;
  media: CommunityMediaRow[];
  /** เวอร์ชันนี้เริ่มแสดงเมื่อไร */
  version_at: ISODateTime;
  /** ถูกแก้ทับเมื่อไร */
  replaced_at: ISODateTime;
}
/** ร้านของผู้เขียนตอนโพสต์ (ป้าย "ทีมร้าน · <ชื่อร้าน>" · migration 20261013000900) */
export interface CommunityTeamBarRef {
  id: UUID;
  slug: string;
  name: string;
}

/** admin_community_threads (migration 20261013000900) — กระทู้ทุกสถานะยกเว้นที่เจ้าของลบ · Backoffice "ชุมชน" */
export interface AdminCommunityThread {
  id: UUID;
  title: string;
  body: string;
  category: string;
  category_name: string;
  status: CommunityStatus;
  author_id: UUID;
  author_name: string | null;
  bar: { id: UUID; slug: string; name: string } | null;
  reply_count: number;
  like_count: number;
  view_count: number;
  created_at: ISODateTime;
  edited_at: ISODateTime | null;
  open_report_count: number;
  reports: CommunityReportRow[];
  media: CommunityMediaRow[];
  revisions: CommunityRevisionRow[];
  team_bar: CommunityTeamBarRef | null;
  /** ถูกใจจากทีมร้านของร้านที่แท็ก (ไม่นับใน like_count) */
  excluded_like_count: number;
}

/** admin_community_comments (migration 20261013000900) — ความเห็นทุกสถานะยกเว้นที่เจ้าของลบ */
export interface AdminCommunityComment {
  id: UUID;
  thread_id: UUID;
  thread_title: string;
  parent_id: UUID | null;
  body: string;
  status: CommunityStatus;
  author_id: UUID;
  author_name: string | null;
  like_count: number;
  created_at: ISODateTime;
  open_report_count: number;
  reports: CommunityReportRow[];
  media: CommunityMediaRow[];
  edited_at: ISODateTime | null;
  revisions: CommunityRevisionRow[];
  team_bar: CommunityTeamBarRef | null;
  /** ถูกใจจากทีมร้านของร้านที่แท็ก (ไม่นับใน like_count) */
  excluded_like_count: number;
}

/** admin_mini_ads (migration 20261013001300) — โฆษณาแบนเนอร์ทุกสถานะ + ยอดเห็น/คลิกรวม · Backoffice "โฆษณา (Mini-Ads)" */
export interface AdminMiniAd {
  id: UUID;
  advertiser_name: string;
  title: string;
  description: string;
  cta_label: string;
  /** URL เต็ม (site-media/ads/…) หรือ path ใน public/ */
  image_url: string;
  link_url: string;
  placements: ('HOME' | 'SEARCH')[];
  starts_at: ISODateTime;
  /** ไม่รวม (หยุดแสดงตั้งแต่เวลานี้) */
  ends_at: ISODateTime;
  active: boolean;
  note: string | null;
  no_alcohol_confirmed_at: ISODateTime;
  confirmed_by: { id: UUID; display_name: string | null; email: string | null } | null;
  impressions: number;
  clicks: number;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

/** แถวในประวัติ "ร้านไม่มีโต๊ะให้ลูกค้า" (bar_strikes · migration 20261013000700) ใหม่สุดก่อน · สูงสุด 50 */
export interface AdminBarStrike {
  id: UUID;
  booking_id: UUID;
  booking_code: string;
  booking_datetime: ISODateTime;
  pax: number;
  booking_status: Enums<'booking_status'>;
  note: string | null;
  /** TEAM = ทีมร้านเลือกเหตุนี้เอง · ADMIN = แอดมินบันทึกจากข้อร้องเรียนของลูกค้า */
  source: 'TEAM' | 'ADMIN';
  /** ชื่อคนที่กดแจ้ง (ทีมร้าน หรือแอดมิน) */
  reported_by: string | null;
  created_at: ISODateTime;
}

/** admin_bar_blacklist (migration 20261013000700): ร้านที่แสดง/ระงับ หรือมีประวัติ + สถานะ Blacklist · Backoffice "Blacklist ร้าน" */
export interface AdminBarBlacklist {
  id: UUID;
  slug: string;
  name: string;
  status: Enums<'bar_status'>;
  status_reason: string | null;
  is_blacklisted: boolean;
  blacklisted_at: ISODateTime | null;
  blacklist_reason: string | null;
  blacklisted_by: UserRef | null;
  strike_count: number;
  strike_count_90d: number;
  last_strike_at: ISODateTime | null;
  strikes: AdminBarStrike[];
}

// ---------------------------------------------------------------------
// G6 เครื่องมือแอดมิน: แก้ข้อมูลร้านแทน · สไตล์ร้าน · อันดับร้าน (migration 20261013001010–001030)
// ---------------------------------------------------------------------

/** admin_bar_details (migration 20261013001010) — ข้อมูลร้าน 1 แถวต่อร้าน (ทุกสถานะ) · Drawer "แก้ข้อมูลร้าน" ใน /bars */
export interface AdminBarDetails {
  id: UUID;
  slug: string;
  name: string;
  status: Enums<'bar_status'>;
  category: Enums<'bar_category'>;
  description: string | null;
  /** แสดงอย่างเดียว — แก้ที่หน้าตรวจตำแหน่งร้าน */
  address: string;
  phone: string | null;
  district_id: UUID | null;
  district: DistrictRef | null;
  /** key ของสไตล์ที่ร้านเลือก (รวมสไตล์ที่ถูกซ่อน) */
  style_keys: string[];
  hours: OpeningHour[];
  links: BarLinkItem[];
  menu: { id: UUID; category: string | null; name: string; price: number; available: boolean; image_path: string | null }[];
  owner: UserRef | null;
  updated_at: ISODateTime;
}

/** admin_styles (migration 20261013001020) — สไตล์ร้านทั้งหมด (รวมที่ซ่อน) + จำนวนร้านที่แสดงอยู่ที่ใช้ + ลูกค้าที่ตั้งเป็นสไตล์ที่ชอบ */
export interface AdminStyle {
  id: UUID;
  key: string;
  name_th: string;
  icon: string;
  sort_order: number;
  active: boolean;
  bar_count: number;
  fan_count: number;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

/**
 * admin_ranking (migration 20261013001030) — ร้านที่แสดงอยู่ + คะแนนรอบสัปดาห์ล่าสุด (แยกส่วน) + โหวตสัปดาห์/เดือน · null = ยังไม่เคยคำนวณ
 * checkin_score = 0 → ร้านยังไม่มีเช็กอินในช่วง: total_score = (รีวิว + Safety) ขยายจากเต็ม 70 เป็น 100 (rankingScore().rescaled)
 */
export interface AdminRanking {
  id: UUID;
  slug: string;
  name: string;
  category: Enums<'bar_category'>;
  district_id: UUID | null;
  district: DistrictRef | null;
  rating_avg: number | null;
  rating_count: number;
  safety_percent: number | null;
  review_score: number | null;
  checkin_score: number | null;
  safety_score: number | null;
  total_score: number | null;
  stars: number | null;
  tier: Enums<'tier_letter'> | null;
  is_new: boolean;
  /** อันดับในประเภทร้าน / ในย่าน ของรอบสัปดาห์ล่าสุด (null = ร้านใหม่ / ยังไม่เคยคำนวณ / ไม่มีย่าน) */
  rank_in_category: number | null;
  rank_in_district: number | null;
  prev_stars: number | null;
  votes_week: number;
  votes_month: number;
  computed_at: ISODateTime | null;
  /** แสดงอย่างเดียว — โฆษณาไม่มีผลกับคะแนน */
  is_promoted: boolean;
}

// ---------------------------------------------------------------------
// กฎธุรกิจที่ต้องตรงกับ DB
// ---------------------------------------------------------------------
export type BookingStatus = Enums<'booking_status'>;
export type TransitionActor = 'SYSTEM' | 'CUSTOMER' | 'MERCHANT' | 'STAFF' | 'ADMIN';

/** ต้องตรงกับ booking_transition_allowed() ใน migration 20261013001100 (TS บอกเพิ่มว่าใครทำได้) */
export const BOOKING_TRANSITIONS: Record<BookingStatus, Partial<Record<BookingStatus, TransitionActor[]>>> = {
  PENDING: {
    AWAITING_DEPOSIT: ['SYSTEM'],
    CONFIRMED: ['MERCHANT'],
    REJECTED: ['MERCHANT'],
    CANCELLED_BY_CUSTOMER: ['CUSTOMER'],
    EXPIRED: ['SYSTEM'],
  },
  AWAITING_DEPOSIT: {
    CONFIRMED: ['SYSTEM'], // ชำระผ่านผู้ให้บริการสำเร็จ (webhook · migration 20261013001100)
    DEPOSIT_SUBMITTED: ['CUSTOMER'],
    CANCELLED_BY_CUSTOMER: ['CUSTOMER'],
    EXPIRED: ['SYSTEM'],
  },
  DEPOSIT_SUBMITTED: {
    CONFIRMED: ['ADMIN'],
    AWAITING_DEPOSIT: ['ADMIN'], // สลิปไม่ผ่าน ให้ส่งใหม่
    REJECTED: ['ADMIN', 'MERCHANT'], // → มัดจำ REFUND_PENDING อัตโนมัติ
    CANCELLED_BY_CUSTOMER: ['CUSTOMER'], // → มัดจำ REFUND_PENDING อัตโนมัติ
  },
  CONFIRMED: {
    CHECKED_IN: ['STAFF', 'MERCHANT'],
    NO_SHOW: ['SYSTEM'],
    CANCELLED_BY_CUSTOMER: ['CUSTOMER'],
    CANCELLED_BY_MERCHANT: ['MERCHANT'],
  },
  CHECKED_IN: { COMPLETED: ['MERCHANT', 'SYSTEM'] },
  REJECTED: {},
  CANCELLED_BY_CUSTOMER: {},
  CANCELLED_BY_MERCHANT: {},
  COMPLETED: {},
  NO_SHOW: {},
  EXPIRED: {},
};

/** สถานะที่ยังถือโต๊ะ/ความจุโซน (ตรงกับ exclusion constraint bookings_no_table_overlap) */
export const ACTIVE_BOOKING_STATUSES: readonly BookingStatus[] = [
  'PENDING', 'AWAITING_DEPOSIT', 'DEPOSIT_SUBMITTED', 'CONFIRMED', 'CHECKED_IN',
];

export function canTransition(from: BookingStatus, to: BookingStatus, actor: TransitionActor): boolean {
  return BOOKING_TRANSITIONS[from][to]?.includes(actor) ?? false;
}

/** ดาว → Tier (ตรงกับ CHECK ใน bar_stats / tier_scores) */
export function starsToTier(stars: 1 | 2 | 3 | 4 | 5): Enums<'tier_letter'> {
  return stars === 5 ? 'S' : stars === 4 ? 'A' : stars === 3 ? 'B' : 'C';
}

/** pr_counts (key ตัวเล็ก) → ค่า enum ที่ต้องส่งกลับหลังบ้าน (ตัวใหญ่) */
export const PR_GENDER_KEYS = { male: 'MALE', female: 'FEMALE', lgbtq: 'LGBTQ' } as const satisfies Record<
  keyof PrCounts,
  Enums<'pr_gender'>
>;
