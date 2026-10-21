import type {
  BarCategory,
  BookingStatus,
  CrowdStatus,
  LocationRequestSource,
  LocationRequestStatus,
  SafetyVerifyMethod,
  Tier,
  TransitLine,
  UserRole,
} from '@nightout/types';

export type SafetyKey =
  | 'SECURITY'
  | 'CCTV'
  | 'FIRE_EXIT'
  | 'FIRST_AID'
  | 'ID_CHECK'
  | 'PARKING_RIDE'
  | 'FEMALE_STAFF'
  | 'LIGHTING'
  | 'EMERGENCY_CONTACT';

export type SafetyValue = 'YES' | 'NO' | 'UNKNOWN';

export interface SafetyFeature {
  key: SafetyKey;
  value: SafetyValue;
  source: 'SELF_DECLARED' | 'ADMIN_VERIFIED';
  /** วันที่ทีมงานตรวจล่าสุด (ADMIN_VERIFIED) — ป้าย Safety แสดงวันที่นี้ */
  verifiedAt?: string | null;
  /** วิธีตรวจของ ADMIN_VERIFIED — EVIDENCE ตรวจหลักฐาน ("ตรวจหลักฐานแล้ว") · ON_SITE ลงพื้นที่ ("ทีมงานลงพื้นที่ตรวจ") · ไม่มี = ถือเป็นตรวจหลักฐาน */
  verifyMethod?: SafetyVerifyMethod | null;
}

export interface MenuItem {
  id: string;
  category: 'เครื่องดื่ม' | 'มิกเซอร์' | 'อาหาร' | 'ของทานเล่น';
  name: string;
  price: number;
  available: boolean;
  /** รูปเมนู: path ใน bucket bar-media (`<bar_id>/menu/…`) + URL สำหรับแสดง */
  imagePath?: string;
  imageUrl?: string;
}

/** รูปแกลเลอรีร้าน (bucket bar-media `<bar_id>/gallery/…`) — ปกร้านคือรูปที่ `url` ตรงกับ coverUrl */
export interface BarPhoto {
  id: string;
  path: string;
  url: string;
}

export interface PricePackage {
  id: string;
  name: string;
  paxMin: number;
  paxMax: number;
  items: { menuItemId: string; quantity: number }[];
  totalPrice: number;
}

export interface Zone {
  id: string;
  name: string;
  capacityPax: number;
  tables: { id: string; name: string; seats: number }[];
  defaultDurationMinutes: number;
}

/** โปรโมชันของร้านที่ลูกค้าเลือกได้ตอนจองโต๊ะ (เช่น มาก่อน 2 ทุ่ม มิกเซอร์ 4 จ่าย 3 — ห้ามโปรแอลกอฮอล์) */
export interface BarPromotion {
  id: string;
  title: string;
  description: string;
  /** ต้องเช็กอินก่อนเวลานี้ (HH:mm) — ว่าง = ทั้งคืน */
  cutoffTime?: string;
  /** วันที่ใช้ได้ (0 = อาทิตย์) — ว่าง = ทุกวัน */
  days?: number[];
  active: boolean;
  /** ถ้อยคำโปรรอแอดมินตรวจ (เฉพาะหน้าร้านค้า — ลูกค้าเห็นแค่ APPROVED) */
  moderationStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  /** วันเริ่ม/วันสุดท้ายที่ใช้ได้ (YYYY-MM-DD · ว่าง = ไม่จำกัด) — ร้านยังตั้งเองไม่ได้ */
  validFrom?: string;
  validTo?: string;
}

/** PR ประจำร้าน (ร้านกรอกเอง) */
export interface BarPR {
  male: number;
  female: number;
  lgbtq?: number;
}

/** บัญชีรับเงินของร้าน — แพลตฟอร์มโอนมัดจำให้ตามนี้ */
export interface BarPayout {
  bankName: string;
  accountNo: string;
  accountName: string;
}

export interface OpeningHours {
  /** 0 = อาทิตย์ */
  day: number;
  open: string;
  close: string;
  closed?: boolean;
}

/** ชื่อไม่มีคำนำหน้า — แสดงผ่าน ui/utils/area.ts (เขต/แขวง กทม. · อำเภอ/ตำบล ที่อื่น) */
export interface BarArea {
  tambon: string;
  /** รหัส pcode ตำบล (ชื่อตำบลซ้ำกันข้ามจังหวัดได้ — ตัวกรองตำบลใช้รหัสนี้) */
  tambonCode: string;
  amphoe: string;
  province: string;
  provinceCode: string;
}

export interface Bar {
  id: string;
  slug: string;
  name: string;
  category: BarCategory;
  district: string;
  address: string;
  lat: number;
  lng: number;
  description: string;
  styles: string[];
  cover: string; // css gradient (ไม่มีรูปจริงในเดโม)
  /** รูปปกร้านจริง (Supabase Storage) — ถ้าไม่มีใช้ cover gradient */
  coverUrl?: string;
  /** แกลเลอรีรูปร้านตามลำดับที่ร้านจัด (ไม่มี = ยังไม่อัปโหลด) */
  gallery?: BarPhoto[];
  hours: OpeningHours[];
  menu: MenuItem[];
  packages: PricePackage[];
  promotions: BarPromotion[];
  pr: BarPR;
  zones: Zone[];
  fees: { serviceChargeRate: number; vatRate: number; otherFees: number };
  safety: SafetyFeature[];
  links: { type: 'INSTAGRAM' | 'TIKTOK' | 'FACEBOOK' | 'WEBSITE'; url: string }[];
  crowd: CrowdStatus;
  crowdUpdatedAt: string;
  score: number;
  rating: number;
  reviewCount: number;
  avgPerPerson: number;
  status: 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  promoted: boolean;
  /** มัดจำ — เก็บทุกการจอง เงินเข้าแพลตฟอร์มก่อน แล้วค่อยโอนให้ร้าน/เก็บเป็นเครดิต */
  deposit: {
    amount: number;
    unit: 'PER_TABLE' | 'PER_PERSON';
    policy: string;
    /** ยกเลิกล่วงหน้ากี่ชั่วโมงถึงได้มัดจำคืน (bar_booking_settings.refund_before_hours · ไม่มี = 24) */
    refundBeforeHours?: number;
  };
  payout: BarPayout;
  gracePeriodMinutes: number;
  perks: string[];
  /** บทบาทของผู้ใช้ปัจจุบันในทีมร้าน (เฉพาะร้านของฉัน) */
  staffRole?: 'OWNER' | 'MANAGER' | 'STAFF';
  /** เหตุผลจากแอดมิน (ไม่อนุมัติ / ระงับ) */
  statusReason?: string;
  /** id ย่านใน DB (DB หาเองจากหมุด) */
  districtId?: string;
  /** ตำบล/อำเภอ/จังหวัดจากหมุด (GET /public/catalog `areas` · ร้านที่ยังไม่แสดงไม่มี) */
  area?: BarArea;
  /** ที่จอดรถ (ร้านกรอก · ไม่มี = ไม่ระบุ) */
  parkingNote?: string;
  /** รถไฟฟ้าใกล้สุด (ไม่มี = ไม่ระบุ) */
  transit?: BarTransit;
  /** เฉพาะร้านของฉัน: หมุดผ่านการตรวจล่าสุดเมื่อไร (ไม่มี = ยังไม่เคยตรวจ) */
  locationReviewedAt?: string;
  /** เฉพาะร้านของฉัน: คำขอแก้ตำแหน่งล่าสุด (ทุกสถานะ) */
  locationRequest?: BarLocationRequest;
}

/** รถไฟฟ้าใกล้ร้าน (bars.transit_* · migration 20261013000600) */
export interface BarTransit {
  line: TransitLine;
  station: string;
  walkMinutes?: number;
}

/** คำขอแก้ตำแหน่งร้าน (my_bar_detail.location_request) — ค่าที่ร้านขอ · ADMIN = ทีม NightOut ตั้งแทน */
export interface BarLocationRequest {
  id: string;
  status: LocationRequestStatus;
  source: LocationRequestSource;
  lat: number;
  lng: number;
  address: string;
  parkingNote?: string;
  transit?: BarTransit;
  /** เหตุผลตีกลับ / ยกเลิก / หมายเหตุแอดมิน */
  reason?: string;
  /** แอดมินปรับหมุด/ข้อมูลก่อนอนุมัติ */
  adminEdited: boolean;
  createdAt: string;
  reviewedAt?: string;
}

/** รูป/วิดีโอแนบรีวิว — ของจริงอยู่ Supabase Storage bucket `review-media` */
export interface ReviewMedia {
  id: string;
  type: 'image' | 'video';
  /** รูป: data URL (เดโม) หรือ URL จริง · วิดีโอ: URL จริง (เดโมใช้ blobKey แทน) */
  src?: string;
  /** เดโม: วิดีโอเก็บใน IndexedDB ของเบราว์เซอร์ (ใหญ่เกิน localStorage) */
  blobKey?: string;
  /** ภาพหน้าปกวิดีโอ (data URL) */
  poster?: string;
  /** ความยาววิดีโอ (วินาที) */
  duration?: number;
}

export interface Review {
  id: string;
  barId: string;
  bookingId?: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: string;
  reported?: boolean;
  userId?: string;
  media?: ReviewMedia[];
  status?: 'PUBLISHED' | 'HIDDEN' | 'REMOVED';
}

export type DepositSettlement = 'HELD' | 'PAYOUT_PENDING' | 'PAID_OUT' | 'CREDIT' | 'REFUND_PENDING' | 'REFUNDED';

export interface Booking {
  id: string;
  code: string;
  barId: string;
  userId: string;
  userName: string;
  zoneId: string;
  tableId?: string;
  datetime: string;
  pax: number;
  status: BookingStatus;
  /** มัดจำที่ต้องโอน (snapshot ตอนจอง) */
  depositRequired?: number;
  /** เหตุผลที่ยกเลิก/ปฏิเสธ */
  cancelReason?: string;
  /** เหตุผลที่สลิปไม่ผ่าน */
  depositRejectReason?: string;
  promotionId?: string;
  promotionTitle?: string;
  /** มัดจำที่ลูกค้าโอนเข้าแพลตฟอร์ม */
  deposit?: {
    amount: number;
    slipDataUrl?: string;
    status: 'SUBMITTED' | 'VERIFIED' | 'REJECTED';
    submittedAt: string;
    verifiedAt?: string;
    /** เงินอยู่ที่ไหน: HELD = แพลตฟอร์มถือไว้ · PAYOUT_PENDING = รอโอนให้ร้าน · PAID_OUT = โอนแล้ว · CREDIT = เก็บเป็นเครดิตร้าน · REFUND_PENDING = รอคืนลูกค้า · REFUNDED = คืนลูกค้า */
    settlement?: DepositSettlement;
    settledAt?: string;
    /** SLIP = โอน + สลิป · ONLINE = ชำระผ่านผู้ให้บริการ */
    method?: 'SLIP' | 'ONLINE';
    /** payment_intents.provider (mock / beam …) */
    provider?: string;
  };
  note?: string;
  createdAt: string;
  history: { from: BookingStatus | null; to: BookingStatus; by: string; at: string }[];
  checkedInAt?: string;
  shareToken: string;
  reviewed?: boolean;
  /** เวลาปลดโต๊ะ (bookings.auto_cancel_at · รวมเวลาที่ต่อแล้ว) — ไม่มี = คำนวณจาก grace ของร้าน */
  autoCancelAt?: string;
  /** เวลาที่ลูกค้ากด "ขอต่อเวลา 15 นาที" (ได้ 1 ครั้ง) */
  extendedAt?: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  /** ร้านที่เกี่ยวข้อง (notifications.bar_id) */
  barId?: string;
  title: string;
  body: string;
  link?: string;
  createdAt: string;
  readAt?: string;
}

export interface DemoUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  /** ร้านที่ผูก (MERCHANT / STAFF) */
  barId?: string;
  createdAt: string;
  preferences: { styles: string[]; budget?: number; pax?: number; districts: string[] };
}

export interface AuditLog {
  id: string;
  actor: string;
  action: string;
  target: string;
  at: string;
}

export interface PromotionOrder {
  id: string;
  barId: string;
  packageName: string;
  placement: 'HOME_BANNER' | 'HOME_RECOMMENDED' | 'SEARCH_TOP';
  days: number;
  price: number;
  status: 'PAYMENT_SUBMITTED' | 'ACTIVE' | 'REJECTED' | 'EXPIRED';
  createdAt: string;
}

export interface BarWithTier extends Bar {
  stars: number | null;
  tier: Tier | null;
  isNew: boolean;
}

export type RankingPeriod = 'WEEK' | 'MONTH';

export interface RankedBar extends BarWithTier {
  rank: number;
  /** โหวตจากคนที่เช็กอินจริงในช่วงนั้น */
  votes: number;
}
