import { getState, mutate, setSessionUserId } from '@/services/cache';
import type {
  AppNotification,
  Bar,
  Booking,
  DemoUser,
  PromotionOrder,
  Review,
} from '@/services/models';
import type { BarAreaRow } from '@nightout/contracts';
import type { UserRole } from '@nightout/types';
import { amphoeLabel, provinceLabel } from '@nightout/utils';
import { Rest } from '@nightout/utils/rest';
import { STYLE_LABELS, toBar, type BarDetailRow } from '@/services/barsRepo';
import { log, since } from '@/services/log';
import {
  toNotification,
  toPromotionOrder,
  type ListingRow,
  type NotificationRow,
} from '@/services/mappers/account';
import { toBooking, type BookingDetailRow } from '@/services/mappers/booking';
import {
  mediaPaths,
  signReviewPaths,
  toMyReview,
  toPublicReview,
  type MyReviewRow,
  type PublicReviewRow,
} from '@/services/mappers/review';

/**
 * ดึงข้อมูลจาก NestJS API (Rest → GET /public/catalog, /me/overview) มาใส่ cache ฝั่งหน้าเว็บ (services/cache.ts) — ไม่ query DB ตรง (ADR 0002)
 * - สาธารณะ (ตอนเปิดเว็บ): ร้าน (bar_detail) · รีวิว (public_reviews) · ย่าน/สไตล์/แพ็กเกจโปรโมท/PromptPay
 * - ผู้ใช้ (หลังล็อกอิน): การจอง · มัดจำ · แจ้งเตือน · ร้านโปรด · รีวิวของฉัน · ร้านของฉัน (ทุกสถานะ) + การจองของร้าน
 * หน้าเว็บอ่านจาก store แบบเดิม (listBars, myBookings, ...) · การเขียนทั้งหมดไป NestJS (modules/<หน้า>/api.ts) แล้ว Rest โหลดใหม่ให้เอง (refreshAfterWrite)
 * ไม่มีข้อมูลเดโม: cache เริ่มว่างแล้วเติมจาก DB ทุกครั้ง
 */

// ---------------------------------------------------------------------
// master data (ใช้ใน dropdown) — เติมค่าตอนเปิดเว็บก่อน render (main.tsx รอโหลดเสร็จ)
// ---------------------------------------------------------------------
export interface DistrictOpt {
  id: string;
  name: string;
  /** จังหวัดของย่าน (ชื่อย่านซ้ำกันได้ข้ามจังหวัด) */
  province: string;
}
/** ตัวเลือกพื้นที่ในหน้าค้นหา/Hero — ครบทั้งประเทศ (ย่าน 850 · อำเภอ/เขต 928 · จังหวัด 77) พื้นที่ที่มีร้านอยู่ขึ้นก่อน */
export interface AreaOpt {
  /** ค่าใน ?district= (ชื่อไม่มีคำนำหน้า) */
  value: string;
  /** "ย่านทองหล่อ" · "เขตวัฒนา" · "เชียงใหม่" */
  label: string;
  kind: 'district' | 'amphoe' | 'province';
  /** จังหวัด (ย่าน/อำเภอที่ชื่อซ้ำกันข้ามจังหวัดได้) · ว่าง = จังหวัดเอง หรือชื่อนี้มีหลายจังหวัด */
  hint: string;
  /** จำนวนร้านที่แสดงอยู่ในพื้นที่ */
  count: number;
  /** ตัวเลือกเด่น (Hero · ปุ่มลัด · แยกคำค้น): มีร้าน หรือเป็นจังหวัด หรือย่านที่ทีมคัดเอง */
  featured: boolean;
}
export interface StyleOpt {
  id: string;
  key: string;
  label: string;
  /** ชื่อไอคอน Phosphor ที่แอดมินตั้ง (Backoffice /styles · STYLE_ICONS) — snapshot เก่าไม่มี */
  icon?: string;
}
export interface PromotionPackage {
  id: string;
  name: string;
  placement: 'HOME_BANNER' | 'HOME_RECOMMENDED' | 'SEARCH_TOP';
  days: number;
  price: number;
}
export const MASTER = {
  districts: [] as DistrictOpt[],
  styles: [] as StyleOpt[],
  packages: [] as PromotionPackage[],
  depositPromptPay: { name: '', promptpayId: '' },
  promotionPromptPay: { name: '', promptpayId: '' },
};
/** พื้นที่ที่มีร้าน เรียงตามจำนวนร้าน — array เดิมถูกเติมค่าในที่ */
export const AREA_OPTIONS: AreaOpt[] = [];
/** ชื่อพื้นที่ที่มีร้าน (ค่าของ AREA_OPTIONS) — ใช้แยกคำค้นใน smartQuery */
export const DISTRICTS: string[] = [];
/** ชื่อสไตล์ (เหมือน STYLES เดิม) */
export const STYLES: string[] = [];

// ---------------------------------------------------------------------
// cache ภายใน (แยกสาธารณะ / ผู้ใช้ แล้วรวมใส่ store)
// ---------------------------------------------------------------------
let publicBars: Bar[] = [];
let publicReviews: Review[] = [];
interface UserData {
  user: DemoUser;
  myBars: Bar[];
  bookings: Booking[];
  myReviews: Review[];
  reportedReviewIds: Set<string>;
  favorites: string[];
  notifications: AppNotification[];
  promotions: PromotionOrder[];
}
let userData: UserData | null = null;
let lastUserSignature = '';

function commit() {
  mutate((s) => {
    const mine = new Map((userData?.myBars ?? []).map((b) => [b.id, b]));
    s.bars = [...publicBars.filter((b) => !mine.has(b.id)), ...mine.values()];
    const reviews = new Map(publicReviews.map((r) => [r.id, r]));
    for (const r of userData?.myReviews ?? []) reviews.set(r.id, { ...reviews.get(r.id), ...r });
    s.reviews = [...reviews.values()].map((r) =>
      userData?.reportedReviewIds.has(r.id) ? { ...r, reported: true } : r,
    );
    s.bookings = userData?.bookings ?? [];
    s.notifications = userData?.notifications ?? [];
    s.favorites = userData ? { [userData.user.id]: userData.favorites } : {};
    s.promotions = userData?.promotions ?? [];
    s.users = userData ? [userData.user] : [];
  });
}

// ---------------------------------------------------------------------
// โหลดข้อมูลสาธารณะ (ตอนเปิดเว็บ)
// ---------------------------------------------------------------------
interface PublicRaw {
  bars: BarDetailRow[];
  /** snapshot เก่าไม่มี */
  areas?: BarAreaRow[];
  reviews: PublicReviewRow[];
  districts: { id: string; name_th: string; province_th?: string; sort_order?: number }[];
  /** snapshot เก่าไม่มี */
  amphoes?: { code: string; name_th: string; province_code: string }[];
  provinces?: { code: string; name_th: string }[];
  styles: { id: string; key: string; name_th: string; icon?: string | null }[];
  settings: { key: string; value: { name?: string; promptpay_id?: string } }[];
  packages: {
    id: string;
    name: string;
    placement: PromotionPackage['placement'];
    duration_days: number;
    price: number;
  }[];
}

/** แปลงข้อมูลดิบ → master + store (ใช้ทั้งตอนโหลดจาก DB และตอนอ่าน snapshot ในเครื่อง) */
function applyPublic(raw: PublicRaw, urls: Map<string, string>) {
  MASTER.districts = raw.districts.map((d) => ({
    id: d.id,
    name: d.name_th,
    province: d.province_th ?? '',
  }));
  MASTER.styles = raw.styles.map((x) => ({
    id: x.id,
    key: x.key,
    label: x.name_th,
    icon: x.icon ?? undefined,
  }));
  for (const x of MASTER.styles) STYLE_LABELS[x.key] = x.label;
  STYLES.splice(0, STYLES.length, ...MASTER.styles.map((x) => x.label));
  for (const row of raw.settings) {
    const v = { name: row.value?.name ?? '', promptpayId: row.value?.promptpay_id ?? '' };
    if (row.key === 'deposit_promptpay') MASTER.depositPromptPay = v;
    if (row.key === 'promotion_promptpay') MASTER.promotionPromptPay = v;
  }
  MASTER.packages = raw.packages.map((p) => ({
    id: p.id,
    name: p.name,
    placement: p.placement,
    days: p.duration_days,
    price: Number(p.price),
  }));
  const areas = new Map((raw.areas ?? []).map((a) => [a.bar_id, a]));
  publicBars = raw.bars.map((row) => {
    const bar = toBar(row);
    const a = areas.get(bar.id);
    return a
      ? {
          ...bar,
          area: {
            tambon: a.tambon_th,
            tambonCode: a.tambon_code,
            amphoe: a.amphoe_th,
            province: a.province_th,
            provinceCode: a.province_code,
          },
        }
      : bar;
  });
  const opts = areaOptions(publicBars, raw);
  AREA_OPTIONS.splice(0, AREA_OPTIONS.length, ...opts);
  // แยกคำค้นเฉพาะตัวเลือกเด่น ชื่อ ≥ 3 ตัวอักษร — ชื่อชุมชนสั้นๆ จาก OSM ไม่ไปชนคำทั่วไปในช่องค้นหา
  DISTRICTS.splice(0, DISTRICTS.length, ...opts.filter((o) => o.featured && o.value.length >= 3).map((o) => o.value));
  publicReviews = raw.reviews.map((r) => toPublicReview(r, urls));
  commit();
}

/** ย่าน < 1000 = ทีมคัดเอง (SEED) · OSM = 1000 (migration …20261020000400) */
const SEED_SORT_MAX = 1000;

/**
 * ตัวเลือกพื้นที่ทั้งประเทศ + จำนวนร้านที่แสดงอยู่ · กรองด้วยชื่อ → ชื่อซ้ำ (ย่านสาทร / เขตสาทร · อำเภอชื่อเดียวกันคนละจังหวัด) รวมเป็นตัวเลือกเดียว
 * เรียง: มีร้านมากก่อน → ตัวเลือกเด่น → ย่าน / อำเภอ / จังหวัด → ชื่อ
 */
function areaOptions(bars: Bar[], raw: PublicRaw): AreaOpt[] {
  const count = new Map<string, number>();
  const bump = (v?: string) => v && count.set(v, (count.get(v) ?? 0) + 1);
  for (const b of bars) {
    if (b.status !== 'APPROVED') continue;
    bump(b.district || undefined);
    if (b.area && b.area.amphoe !== b.district) bump(b.area.amphoe);
    if (b.area && b.area.province !== b.district && b.area.province !== b.area.amphoe) bump(b.area.province);
  }
  const provinceName = new Map((raw.provinces ?? []).map((p) => [p.code, p.name_th]));
  const byValue = new Map<string, AreaOpt>();
  const add = (value: string, label: string, kind: AreaOpt['kind'], hint: string, seed: boolean) => {
    const o = byValue.get(value);
    if (o) {
      if (o.hint !== hint) o.hint = '';
      o.featured ||= seed;
      return;
    }
    const n = count.get(value) ?? 0;
    byValue.set(value, { value, label, kind, hint, count: n, featured: seed || n > 0 });
  };
  for (const d of raw.districts) {
    add(d.name_th, `ย่าน${d.name_th}`, 'district', provinceLabel({ province: d.province_th }), (d.sort_order ?? SEED_SORT_MAX) < SEED_SORT_MAX);
  }
  for (const a of raw.amphoes ?? []) {
    const province = provinceName.get(a.province_code) ?? '';
    add(a.name_th, amphoeLabel({ amphoe: a.name_th, provinceCode: a.province_code }), 'amphoe', provinceLabel({ province, provinceCode: a.province_code }), false);
  }
  for (const p of raw.provinces ?? []) add(p.name_th, provinceLabel({ province: p.name_th, provinceCode: p.code }), 'province', '', true);
  // snapshot เก่า (ไม่มีรายชื่ออำเภอ/จังหวัด) — ใช้พื้นที่ของร้านแทน
  for (const b of bars) {
    if (b.status !== 'APPROVED' || !b.area) continue;
    const p = { ...b.area };
    add(b.area.amphoe, amphoeLabel(p), 'amphoe', provinceLabel(p), false);
    add(b.area.province, provinceLabel(p), 'province', '', true);
  }
  const rank = { district: 0, amphoe: 1, province: 2 };
  return [...byValue.values()].sort(
    (a, b) =>
      b.count - a.count ||
      Number(b.featured) - Number(a.featured) ||
      rank[a.kind] - rank[b.kind] ||
      a.label.localeCompare(b.label, 'th'),
  );
}

// ---------------------------------------------------------------------
// snapshot ข้อมูลสาธารณะในเครื่อง — เปิดเว็บครั้งถัดไปแสดงได้ทันที แล้วค่อยโหลดของใหม่เบื้องหลัง
// (URL รูปรีวิวเป็นลิงก์ชั่วคราว 6 ชม. → ไม่เก็บ ขอใหม่ทุกครั้ง)
// ---------------------------------------------------------------------
const SNAPSHOT_KEY = 'nightout-public-v1';
const SNAPSHOT_MAX_AGE = 24 * 3600_000;

function saveSnapshot(raw: PublicRaw) {
  const write = () => {
    try {
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ savedAt: Date.now(), raw }));
    } catch {
      /* เต็ม/ถูกปิด — ไม่เป็นไร ครั้งหน้าโหลดจาก DB ตามปกติ */
    }
  };
  if (window.requestIdleCallback) window.requestIdleCallback(write, { timeout: 5000 });
  else setTimeout(write, 1000);
}

/** มี snapshot ที่ยังไม่เก่าเกิน 24 ชม. → ใส่ store ทันที (คืน true) */
export function hydratePublicFromCache(): boolean {
  try {
    const v = localStorage.getItem(SNAPSHOT_KEY);
    if (!v) return false;
    const snap = JSON.parse(v) as { savedAt: number; raw: PublicRaw };
    if (!snap?.raw?.bars || Date.now() - snap.savedAt > SNAPSHOT_MAX_AGE) return false;
    applyPublic(snap.raw, new Map());
    log.ok(
      `แสดงข้อมูลจากเครื่องก่อน (${Math.round((Date.now() - snap.savedAt) / 60_000)} นาทีที่แล้ว) · กำลังโหลดของใหม่`,
    );
    return true;
  } catch {
    return false;
  }
}

export async function loadPublic(): Promise<void> {
  const t0 = performance.now();
  const raw = await Rest.get<PublicRaw>('/public/catalog');
  // แสดงร้าน/รีวิวก่อน แล้วค่อยขอ URL รูป/วิดีโอรีวิวทีหลัง (ไม่ให้หน้าแรกต้องรอ)
  applyPublic(raw, new Map());
  saveSnapshot(raw);
  const paths = mediaPaths(raw.reviews);
  if (paths.length) void signReviewPaths(paths).then((urls) => applyPublic(raw, urls));
  log.ok(
    `โหลดข้อมูลจาก API สำเร็จ (${Rest.baseURL}) · ร้าน ${publicBars.length} · รีวิว ${publicReviews.length} · ย่าน ${MASTER.districts.length} · ${since(t0)}`,
  );
}

/** GET /me/overview (แถวจาก view ของ DB — snake_case) */
interface MeOverview {
  bookings: BookingDetailRow[];
  notifications: NotificationRow[];
  favorites: { id: string }[];
  reviews: MyReviewRow[];
  preferences: {
    preferred_style_ids: string[];
    preferred_district_ids: string[];
    budget_per_person: number | null;
    usual_pax: number | null;
  } | null;
  bars: BarDetailRow[];
  team_bookings: BookingDetailRow[];
  listings: ListingRow[];
  review_reports: { review_id: string }[];
}

// ---------------------------------------------------------------------
// โหลดข้อมูลของผู้ใช้ที่ล็อกอิน
// ---------------------------------------------------------------------
export interface SessionProfile {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  /** เบอร์ล่าสุดที่ใช้จอง (E.164) — หน้า Checkout เติมให้ */
  phoneE164?: string | null;
  /** ถูกระงับ (แอดมินแบน / สลิปปลอมซ้ำ) — จองไม่ได้ + ชุมชนอ่านอย่างเดียว */
  bannedAt?: string | null;
  /** เหตุผลที่ถูกระงับ */
  banReason?: string | null;
}
export interface UserPrefs {
  styleIds: string[];
  districtIds: string[];
  budget?: number;
  pax?: number;
}
export let myPrefs: UserPrefs = { styleIds: [], districtIds: [] };

/** คืน id ร้านหลักของผู้ใช้ (ร้านแรกที่เป็นเจ้าของ/อยู่ในทีม) */
export async function loadUser(p: SessionProfile): Promise<{ barId?: string }> {
  const t0 = performance.now();
  const o = await Rest.get<MeOverview>('/me/overview');
  const barRows = o.bars;
  const bars = barRows.map(toBar);
  // ร้านของฉัน: การจองทั้งหมดของร้าน + ประวัติโปรโมท (API รวมมาให้แล้ว)
  const teamBookings = o.team_bookings;
  const listings = o.listings;

  const own = o.bookings;
  const allBookings = new Map<string, Booking>();
  for (const r of [...own, ...teamBookings]) allBookings.set(r.id, toBooking(r));

  const myReviewRows = o.reviews;
  // โหลดซ้ำทุก 60 วิ: ถ้าข้อมูลเหมือนเดิมทุกอย่าง ไม่ต้องขอ URL รูปใหม่ / ไม่ re-render ทั้งแอป
  const signature = JSON.stringify(o);
  if (signature === lastUserSignature && userData?.user.id === p.id)
    return { barId: userData.user.barId };
  lastUserSignature = signature;
  const urls = await signReviewPaths(mediaPaths(myReviewRows));
  const pr = o.preferences;
  // สไตล์ที่แอดมินซ่อน (/styles) ไม่อยู่ใน MASTER.styles → ตัดออก ไม่ให้โผล่เป็น id ดิบในโปรไฟล์/onboarding
  const visibleStyleIds = new Set(MASTER.styles.map((s) => s.id));
  myPrefs = {
    styleIds: (pr?.preferred_style_ids ?? []).filter((id) => visibleStyleIds.has(id)),
    districtIds: pr?.preferred_district_ids ?? [],
    budget: pr?.budget_per_person ? Number(pr.budget_per_person) : undefined,
    pax: pr?.usual_pax ?? undefined,
  };
  const primary =
    bars.find((b) => b.staffRole === 'OWNER' && b.status === 'APPROVED') ??
    bars.find((b) => b.status === 'APPROVED') ??
    bars[0];

  userData = {
    user: {
      id: p.id,
      email: p.email,
      displayName: p.displayName,
      role: p.role,
      barId: primary?.id,
      createdAt: new Date().toISOString(),
      preferences: {
        styles: MASTER.styles.filter((s) => myPrefs.styleIds.includes(s.id)).map((s) => s.label),
        districts: MASTER.districts
          .filter((d) => myPrefs.districtIds.includes(d.id))
          .map((d) => d.name),
        budget: myPrefs.budget,
        pax: myPrefs.pax,
      },
    },
    myBars: bars,
    bookings: [...allBookings.values()],
    myReviews: myReviewRows.map((r) => toMyReview(r, p, urls)),
    reportedReviewIds: new Set(o.review_reports.map((x) => x.review_id)),
    favorites: o.favorites.map((f) => f.id),
    notifications: o.notifications.map(toNotification),
    promotions: listings.map(toPromotionOrder),
  };
  setSessionUserId(p.id);
  commit();
  log.ok(
    `โหลดข้อมูลผู้ใช้จาก API (${p.email} · ${p.role}) · การจอง ${userData.bookings.length} · แจ้งเตือน ${userData.notifications.length} · ร้านโปรด ${userData.favorites.length}${bars.length ? ` · ร้านของฉัน ${bars.length}` : ''} · ${since(t0)}`,
  );
  return { barId: primary?.id };
}

let lastProfile: SessionProfile | null = null;
let polling: ReturnType<typeof setInterval> | undefined;

/** เริ่มใช้ข้อมูลของผู้ใช้ + โหลดใหม่ทุก 60 วินาทีขณะเปิดหน้าอยู่ (แจ้งเตือน/สถานะการจอง) */
export async function startUser(p: SessionProfile) {
  lastProfile = p;
  const r = await loadUser(p);
  clearInterval(polling);
  polling = setInterval(() => {
    if (document.visibilityState === 'visible' && lastProfile)
      void loadUser(lastProfile).catch((e: Error) =>
        log.warn('โหลดข้อมูลผู้ใช้ใหม่ไม่สำเร็จ', e.message),
      );
  }, 60_000);
  return r;
}

export function clearUser() {
  lastProfile = null;
  lastUserSignature = '';
  clearInterval(polling);
  userData = null;
  myPrefs = { styleIds: [], districtIds: [] };
  setSessionUserId(null);
  commit();
}

/** โหลด store ใหม่ (`/me/overview` + `/public/catalog` ถ้า public) */
export async function refresh(opts: { public?: boolean } = {}) {
  await Promise.all([
    opts.public ? loadPublic() : Promise.resolve(),
    lastProfile ? loadUser(lastProfile) : Promise.resolve(),
  ]);
}

/** การเขียนที่ไม่ต้องโหลด store ใหม่ — POST ที่จริงเป็นการขอ URL ไฟล์ / ลบบัญชี (เข้าสู่ระบบไม่ได้แล้ว) */
// ชุมชน: หน้าใช้ TanStack Query ของตัวเอง (store ไม่มีข้อมูลกระทู้) — ร่างบันทึกทุกวินาทีที่หยุดพิมพ์ ไม่ต้องโหลด store ใหม่ · นับเห็น/คลิกโฆษณา (mini-ads) ไม่ต้องโหลด store ใหม่
const NO_REFRESH =
  /^\/storage\/|^\/me\/delete$|^\/(public\/|me\/)?community\/|^\/public\/mini-ads\//;
/** การเขียนที่เปลี่ยนข้อมูลหน้าร้าน → โหลด `/public/catalog` ใหม่ด้วย */
const PUBLIC_WRITES =
  /^\/merchant\/bars\/[^/]+\/(crowd|info|media|menu|promotions|fees|zones|safety|booking-settings)|^\/bookings\/[^/]+\/review$/;

/**
 * ตั้งเป็น `afterWrite` ของ Rest ใน main.tsx — ทุก POST/PUT/PATCH/DELETE ที่สำเร็จโหลด store ใหม่ให้อัตโนมัติ
 * (modules/<หน้า>/api.ts เรียก `Rest.post(...)` อย่างเดียว ไม่ต้อง refresh เอง)
 */
export async function refreshAfterWrite({ url }: { url: string }) {
  if (NO_REFRESH.test(url)) return;
  await refresh({ public: PUBLIC_WRITES.test(url) });
}

/** ชื่อผู้ใช้ใน store (ใช้หลังแก้โปรไฟล์) */
export function currentProfile(): SessionProfile | null {
  return lastProfile;
}
/** โปรไฟล์ที่ล็อกอินอยู่ — โยน error ถ้ายังไม่ได้เข้าสู่ระบบ (ใช้ใน modules/<หน้า>/api.ts ที่ต้องรู้ user id) */
export function me(): SessionProfile {
  const p = lastProfile;
  if (!p) throw new Error('กรุณาเข้าสู่ระบบ');
  return p;
}
export function setProfileName(displayName: string) {
  if (lastProfile) lastProfile = { ...lastProfile, displayName };
}
export function setProfilePhone(phoneE164: string) {
  if (lastProfile) lastProfile = { ...lastProfile, phoneE164 };
}

/** ใช้ใน dev tools: window.__nightout() ดูข้อมูลใน cache */
if (typeof window !== 'undefined') {
  (window as unknown as { __nightout: () => unknown }).__nightout = () => ({
    api: Rest.baseURL,
    bars: getState().bars.length,
    bookings: getState().bookings.length,
    reviews: getState().reviews.length,
    user: userData?.user ?? null,
  });
}
