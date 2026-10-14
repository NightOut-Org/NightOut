import { describe, expect, it } from 'vitest';
import { BANGKOK_UTC_OFFSET_MINUTES, bangkokClock, dealTodayStatus, groupDealsToday, hhmmToMinutes, isPublicDeal } from './deal';
import { MINI_AD_LABEL, MINI_AD_NO_ALCOHOL_TEXT, miniAdCtr, miniAdState } from './mini-ads';
import {
  TABLE_BOARD_POLL_MS,
  TABLE_BOARD_STATUSES,
  boardDropBlock,
  businessNightOf,
  packLanes,
  periodsOverlap,
  timelineRange,
  type BoardDropBooking,
  type BoardDropTarget,
} from './table-board';
import {
  DEPOSIT_REJECT_CODES,
  DEPOSIT_REJECT_REASONS,
  BOOKING_EXTENSION_MINUTES,
  DEFAULT_REFUND_BEFORE_HOURS,
  DEPOSIT_TERMS_VERSION,
  canExtendBooking,
  canTeamForfeit,
  checkInWindow,
  TABLE_FEE_LABEL,
  TABLE_FEE_SHORT,
  canTransition,
  depositTermsLines,
  depositTermsText,
  formatThaiPhone,
  toThaiE164,
  estimatePrice,
  isNewBar,
  RANKING_CHECKIN_TARGET,
  RANKING_WEIGHTS,
  rankingCheckinPoints,
  rankingReviewPoints,
  rankingSafetyPoints,
  rankingScore,
  isReviewableStatus,
  isTerminalStatus,
  nextStatuses,
  scoreToStars,
  starsToTier,
  storagePublicUrl,
  barMediaPath,
  coverFirst,
  galleryCoverPath,
  SAFETY_CHECK_LABELS,
  SAFETY_CHECK_RESULTS,
  SAFETY_VERIFY_METHOD_LABELS,
  SAFETY_VERIFY_METHODS,
  countSafetyChecks,
  safetyCheckValue,
  safetyInspectionPhotoPath,
  safetyVerifyLabel,
  PAYMENT_POLL_MAX_MS,
  PAYMENT_POLL_MS,
  PAYMENT_REFUND_LABEL,
  PAYMENT_STATUS_LABEL,
  isInAppCheckoutUrl,
  paymentProviderLabel,
} from './index';

describe('booking state machine', () => {
  it('allows staff to check in a confirmed booking', () => {
    expect(canTransition('CONFIRMED', 'CHECKED_IN', 'STAFF')).toBe(true);
  });
  it('does not let a customer confirm their own booking', () => {
    expect(canTransition('PENDING', 'CONFIRMED', 'CUSTOMER')).toBe(false);
  });
  it('the system and the shop team can mark NO_SHOW (manual release after hold time · comment #76), never the customer/admin', () => {
    expect(canTransition('CONFIRMED', 'NO_SHOW', 'SYSTEM')).toBe(true);
    expect(canTransition('CONFIRMED', 'NO_SHOW', 'MERCHANT')).toBe(true);
    expect(canTransition('CONFIRMED', 'NO_SHOW', 'STAFF')).toBe(true);
    expect(canTransition('CONFIRMED', 'NO_SHOW', 'CUSTOMER')).toBe(false);
    expect(canTransition('CONFIRMED', 'NO_SHOW', 'ADMIN')).toBe(false);
  });
  it('terminal statuses have no exits', () => {
    expect(isTerminalStatus('COMPLETED')).toBe(true);
    expect(nextStatuses('NO_SHOW', 'SYSTEM')).toEqual([]);
  });
  it('allows reviews once the deposit is confirmed, without check-in', () => {
    expect(isReviewableStatus('CONFIRMED')).toBe(true);
    expect(isReviewableStatus('NO_SHOW')).toBe(true);
    expect(isReviewableStatus('DEPOSIT_SUBMITTED')).toBe(false);
    expect(isReviewableStatus('CANCELLED_BY_CUSTOMER')).toBe(false);
  });
  it('only the system confirms an awaiting-deposit booking (paid via provider webhook)', () => {
    expect(canTransition('AWAITING_DEPOSIT', 'CONFIRMED', 'SYSTEM')).toBe(true);
    expect(canTransition('AWAITING_DEPOSIT', 'CONFIRMED', 'CUSTOMER')).toBe(false);
    expect(nextStatuses('AWAITING_DEPOSIT', 'MERCHANT')).not.toContain('CONFIRMED');
    expect(nextStatuses('AWAITING_DEPOSIT', 'STAFF')).not.toContain('CONFIRMED');
  });
});

describe('payment helpers', () => {
  it('provider label: mock is marked as a test · none = slip · unknown = itself', () => {
    expect(paymentProviderLabel('mock')).toContain('จำลอง');
    expect(paymentProviderLabel(null)).toBe('โอน + แนบสลิป');
    expect(paymentProviderLabel(undefined)).toBe('โอน + แนบสลิป');
    expect(paymentProviderLabel('acme')).toBe('acme');
  });
  it('in-app checkout url: same-site path only', () => {
    expect(isInAppCheckoutUrl('/pay/mock/x')).toBe(true);
    expect(isInAppCheckoutUrl('//evil.com')).toBe(false);
    expect(isInAppCheckoutUrl('https://x')).toBe(false);
  });
  it('labels cover every status · polling window is bounded', () => {
    for (const s of ['PENDING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED'] as const) expect(PAYMENT_STATUS_LABEL[s]).toBeTruthy();
    for (const s of ['NONE', 'REQUIRED', 'REFUNDED'] as const) expect(PAYMENT_REFUND_LABEL[s]).toBeTruthy();
    expect(PAYMENT_POLL_MS).toBeGreaterThan(0);
    expect(PAYMENT_POLL_MAX_MS).toBeGreaterThan(PAYMENT_POLL_MS);
  });
});

describe('booking timing (reminder / extension / check-in window)', () => {
  const at = (iso: string) => new Date(iso);
  const b = {
    status: 'CONFIRMED' as const,
    datetime: '2026-10-20T14:00:00.000Z',
    autoCancelAt: '2026-10-20T14:30:00.000Z',
    extendedAt: null,
  };
  it('extends once, from 15 minutes before the booking until the table is released', () => {
    expect(BOOKING_EXTENSION_MINUTES).toBe(15);
    expect(canExtendBooking(b, at('2026-10-20T13:44:00.000Z'))).toBe(false);
    expect(canExtendBooking(b, at('2026-10-20T13:45:00.000Z'))).toBe(true);
    expect(canExtendBooking(b, at('2026-10-20T14:29:59.000Z'))).toBe(true);
    expect(canExtendBooking(b, at('2026-10-20T14:30:00.000Z'))).toBe(false);
  });
  it('cannot extend twice or when the booking is not confirmed', () => {
    const now = at('2026-10-20T14:10:00.000Z');
    expect(canExtendBooking({ ...b, extendedAt: '2026-10-20T14:05:00.000Z' }, now)).toBe(false);
    expect(canExtendBooking({ ...b, status: 'CHECKED_IN' }, now)).toBe(false);
  });
  it('opens check-in 3 hours before the booking and closes when the table is released', () => {
    const w = checkInWindow(b);
    expect(w.opensAt.toISOString()).toBe('2026-10-20T11:00:00.000Z');
    expect(w.closesAt.toISOString()).toBe('2026-10-20T14:30:00.000Z');
  });
  it('lets the shop team release (forfeit) a confirmed booking only once auto_cancel_at has passed', () => {
    expect(canTeamForfeit(b, at('2026-10-20T14:29:59.000Z'))).toBe(false);
    expect(canTeamForfeit(b, at('2026-10-20T14:30:00.000Z'))).toBe(true);
    expect(canTeamForfeit({ ...b, autoCancelAt: new Date('2026-10-20T14:45:00.000Z') }, at('2026-10-20T14:30:00.000Z'))).toBe(false);
    expect(canTeamForfeit({ ...b, status: 'CHECKED_IN' }, at('2026-10-20T15:00:00.000Z'))).toBe(false);
    expect(canTeamForfeit({ ...b, status: 'NO_SHOW' }, at('2026-10-20T15:00:00.000Z'))).toBe(false);
  });
  it('refunds a regular table in full when cancelled at least 6 hours before (refund_before_hours default)', () => {
    expect(DEFAULT_REFUND_BEFORE_HOURS).toBe(6);
  });
});

describe('estimatePrice', () => {
  it('matches the "2 กลม + โซดา 10 + น้ำแข็ง 3" example with 10% SC and 7% VAT', () => {
    const r = estimatePrice({
      items: [
        { name: 'set A', quantity: 2, unitPrice: 1000 },
        { name: 'soda', quantity: 10, unitPrice: 25 },
        { name: 'ice', quantity: 3, unitPrice: 30 },
      ],
      fees: { serviceChargeRate: 10, vatRate: 7, otherFees: 0 },
      pax: 4,
    });
    expect(r.subtotal).toBe(2340);
    expect(r.serviceCharge).toBe(234);
    expect(r.vat).toBe(180.18);
    expect(r.estimatedTotal).toBe(2754.18);
    expect(r.perPerson).toBe(688.55);
  });
});

describe('ranking', () => {
  it('maps score → stars → tier', () => {
    expect(scoreToStars(92)).toBe(5);
    expect(starsToTier(scoreToStars(92))).toBe('S');
    expect(starsToTier(scoreToStars(80))).toBe('A');
    expect(starsToTier(scoreToStars(65))).toBe('B');
    expect(starsToTier(scoreToStars(10))).toBe('C');
  });
  it('flags bars with fewer than 5 reviews as new', () => {
    expect(isNewBar(4)).toBe(true);
    expect(isNewBar(5)).toBe(false);
  });
  it('weights 50 / 30 / 20 add up to 100 (no price-completeness · ads have no effect)', () => {
    expect(RANKING_WEIGHTS.review + RANKING_WEIGHTS.checkin + RANKING_WEIGHTS.safety).toBe(100);
  });
  it('review points 0–50: Bayesian average pulled toward 3.5 by 5 reviews', () => {
    expect(rankingReviewPoints(null, 0)).toBe(31.25);
    expect(rankingReviewPoints(4.8, 0)).toBe(31.25);
    expect(rankingReviewPoints(4.8, 978)).toBeCloseTo(47.42, 2);
    const near = rankingReviewPoints(5, 1000);
    expect(near).toBeLessThan(50);
    expect(near).toBeGreaterThan(49);
    expect(rankingReviewPoints(1, 1000)).toBeGreaterThanOrEqual(0);
  });
  it('check-in points 0–30 on a log scale, full at RANKING_CHECKIN_TARGET', () => {
    expect(rankingCheckinPoints(0)).toBe(0);
    expect(rankingCheckinPoints(-3)).toBe(0);
    expect(rankingCheckinPoints(RANKING_CHECKIN_TARGET)).toBe(30);
    expect(rankingCheckinPoints(100)).toBe(30);
    expect(rankingCheckinPoints(5)).toBeCloseTo(15.65, 2);
  });
  it('safety points 0–20 from the 0–100 safety score', () => {
    expect(rankingSafetyPoints(78)).toBe(15.6);
    expect(rankingSafetyPoints(null)).toBe(0);
    expect(rankingSafetyPoints(150)).toBe(20);
    expect(rankingSafetyPoints(-5)).toBe(0);
  });
  it('total with check-ins uses the normal 50 / 30 / 20 weights', () => {
    const s = rankingScore({ ratingAvg: 4.8, ratingCount: 978, checkins: 1, safetyScore: 78 });
    expect(s.review).toBeCloseTo(47.42, 2);
    expect(s.checkin).toBeCloseTo(6.06, 2);
    expect(s.safety).toBe(15.6);
    expect(s.total).toBeCloseTo(69.08, 2);
    expect(s.rescaled).toBe(false);
    expect(s).toMatchObject({ isNew: false, stars: 3, tier: 'B' });
  });
  it('owner override: 0 check-ins in the window → (review + safety) rescaled from 70 to 100', () => {
    const s = rankingScore({ ratingAvg: 4.8, ratingCount: 978, checkins: 0, safetyScore: 78 });
    expect(s.checkin).toBe(0);
    expect(s.rescaled).toBe(true);
    expect(s.total).toBeCloseTo(90.03, 2);
    expect(s).toMatchObject({ isNew: false, stars: 5, tier: 'S' });
  });
  it('fewer than 5 reviews = ร้านใหม่ (no stars / tier) · perfect input = 5★ S · total never above 100', () => {
    expect(rankingScore({ ratingAvg: 4.8, ratingCount: 4, checkins: 0, safetyScore: 78 })).toMatchObject({ isNew: true, stars: null, tier: null });
    const perfect = rankingScore({ ratingAvg: 5, ratingCount: 1000, checkins: 30, safetyScore: 100 });
    expect(perfect).toMatchObject({ isNew: false, stars: 5, tier: 'S', rescaled: false });
    expect(perfect.total).toBeLessThanOrEqual(100);
    expect(rankingScore({ ratingAvg: 5, ratingCount: 100000, checkins: 0, safetyScore: 100 }).total).toBeLessThanOrEqual(100);
  });
});

describe('deposit helpers', () => {
  it('normalizes Thai phone numbers to E.164', () => {
    expect(toThaiE164('081-234-5678')).toBe('+66812345678');
    expect(toThaiE164('+66 81 234 5678')).toBe('+66812345678');
    expect(toThaiE164('66812345678')).toBe('+66812345678');
    expect(toThaiE164('02-123-4567')).toBe('+6621234567');
    expect(toThaiE164('0112345678')).toBeNull();
    expect(toThaiE164('12345')).toBeNull();
    expect(formatThaiPhone('+66812345678')).toBe('081-234-5678');
  });
  it('builds the deposit forfeiture terms the customer accepts', () => {
    const t = depositTermsText({ amount: 1000, refundBeforeHours: 24, graceMinutes: 30, barPolicy: 'หักจากค่าอาหาร' });
    expect(t).toContain('฿1,000');
    expect(t).toContain('24 ชั่วโมง');
    expect(t).toContain('30 นาที');
    expect(t).toContain('ถูกริบ');
    expect(t).toContain('5. เงื่อนไขของร้าน: หักจากค่าอาหาร');
    expect(depositTermsLines({ amount: 500, refundBeforeHours: 0, graceMinutes: 15 })).toHaveLength(3);
  });
  it('calls the money a Table Fee, never a deposit (legal wording)', () => {
    const t = depositTermsText({ amount: 600, refundBeforeHours: 6, graceMinutes: 30 });
    expect(t).toContain(TABLE_FEE_LABEL);
    expect(t).not.toContain('มัดจำ');
    expect(TABLE_FEE_LABEL).toBe('ค่าธรรมเนียมจองโต๊ะ (Table Fee)');
    expect(TABLE_FEE_SHORT).toBe('Table Fee');
    expect(t).toContain('ขอต่อเวลาได้อีก 15 นาที 1 ครั้ง');
    expect(t).toContain('ปลดโต๊ะ (Forfeited)');
    expect(DEPOSIT_TERMS_VERSION).toBe('deposit-v3');
  });
  it('has a label for every reject code', () => {
    expect(DEPOSIT_REJECT_CODES).toContain('FAKE_SLIP');
    expect(DEPOSIT_REJECT_REASONS.every((r) => r.label.length > 0)).toBe(true);
  });
});

describe('storage public url', () => {
  it('builds a Supabase public object URL and trims trailing slashes', () => {
    expect(storagePublicUrl('https://x.supabase.co/', 'bar-media', 'b1/gallery/a.webp')).toBe(
      'https://x.supabase.co/storage/v1/object/public/bar-media/b1/gallery/a.webp',
    );
  });
  it('encodes each path segment but keeps the folder slashes', () => {
    expect(storagePublicUrl('http://127.0.0.1:54321', 'bar-media', 'b1/menu/รูป 1.jpg')).toBe(
      'http://127.0.0.1:54321/storage/v1/object/public/bar-media/b1/menu/%E0%B8%A3%E0%B8%B9%E0%B8%9B%201.jpg',
    );
  });
  it('bar media paths live in <bar>/<folder>/<id>.<ext>', () => {
    expect(barMediaPath('b1', 'gallery', '.WEBP', 'abc')).toBe('b1/gallery/abc.webp');
    expect(barMediaPath('b1', 'menu', 'jpg')).toMatch(/^b1\/menu\/[0-9a-f-]{36}\.jpg$/);
  });
  it('finds the cover among gallery paths by URL suffix, whatever the Storage host', () => {
    const paths = ['b1/gallery/a.webp', 'b1/gallery/b.webp'];
    expect(galleryCoverPath('http://127.0.0.1:54321/storage/v1/object/public/bar-media/b1/gallery/b.webp', paths)).toBe('b1/gallery/b.webp');
    expect(galleryCoverPath('https://x.supabase.co/storage/v1/object/public/bar-media/b1/gallery/zz.webp', paths)).toBeNull();
    expect(galleryCoverPath(null, paths)).toBeNull();
  });
  it('puts the cover first and keeps the rest in order', () => {
    expect(coverFirst(['a', 'b', 'c'], 'c')).toEqual(['c', 'a', 'b']);
    expect(coverFirst(['a', 'b'], null)).toEqual(['a', 'b']);
    expect(coverFirst(['a', 'b'], 'x')).toEqual(['a', 'b']);
  });
});

describe('safety inspection (Inspector)', () => {
  it('maps a check result to the value customers see (NA = unchanged)', () => {
    expect(safetyCheckValue('PASS')).toBe('YES');
    expect(safetyCheckValue('FAIL')).toBe('NO');
    expect(safetyCheckValue('NA')).toBeNull();
  });
  it('counts pass / fail / na', () => {
    expect(countSafetyChecks([])).toEqual({ pass: 0, fail: 0, na: 0 });
    expect(
      countSafetyChecks([{ result: 'PASS' }, { result: 'FAIL' }, { result: 'PASS' }, { result: 'NA' }]),
    ).toEqual({ pass: 2, fail: 1, na: 1 });
  });
  it('builds the inspection photo path under <bar_id>/inspections/', () => {
    expect(safetyInspectionPhotoPath('b1', '.WEBP', 'abc')).toBe('b1/inspections/abc.webp');
    expect(safetyInspectionPhotoPath('b1', 'jpg')).toMatch(/^b1\/inspections\/[0-9a-f-]{36}\.jpg$/);
  });
  it('labels every check result in Thai', () => {
    expect(SAFETY_CHECK_RESULTS).toEqual(['PASS', 'FAIL', 'NA']);
    for (const r of SAFETY_CHECK_RESULTS) expect(SAFETY_CHECK_LABELS[r]).toBeTruthy();
    expect(SAFETY_CHECK_LABELS).toEqual({ PASS: 'ผ่าน', FAIL: 'ไม่พบ', NA: 'ไม่ได้ตรวจ' });
  });
  it('tells evidence-only checks apart from on-site inspections (never "Safety Verified")', () => {
    expect(SAFETY_VERIFY_METHODS).toEqual(['EVIDENCE', 'ON_SITE']);
    expect(SAFETY_VERIFY_METHOD_LABELS.EVIDENCE).toBe('ตรวจหลักฐานแล้ว');
    expect(SAFETY_VERIFY_METHOD_LABELS.ON_SITE).toBe('ทีมงานลงพื้นที่ตรวจ');
    expect(safetyVerifyLabel('ON_SITE')).toBe('ทีมงานลงพื้นที่ตรวจ');
    expect(safetyVerifyLabel('EVIDENCE')).toBe('ตรวจหลักฐานแล้ว');
    // ข้อมูลเก่าที่ไม่มีวิธีตรวจ → ไม่อ้างว่าลงพื้นที่
    expect(safetyVerifyLabel(null)).toBe('ตรวจหลักฐานแล้ว');
    expect(safetyVerifyLabel(undefined)).toBe('ตรวจหลักฐานแล้ว');
    for (const label of Object.values(SAFETY_VERIFY_METHOD_LABELS)) {
      expect(label).not.toMatch(/Safety Verified|ยืนยันโดย NightOut/i);
    }
  });
});

describe('table board', () => {
  const iso = (s: string) => new Date(s).toISOString();
  it('cuts the business night at 06:00 Bangkok time', () => {
    expect(TABLE_BOARD_POLL_MS).toBe(10_000);
    expect(TABLE_BOARD_STATUSES).toEqual(['FREE', 'RESERVED', 'IN_USE']);
    expect(businessNightOf(new Date('2026-10-16T22:59:59Z'))).toBe('2026-10-16');
    expect(businessNightOf(new Date('2026-10-16T23:00:00Z'))).toBe('2026-10-17');
    expect(businessNightOf(new Date('2026-10-17T05:00:00Z'))).toBe('2026-10-17');
  });
  it('treats periods as half-open [from, until)', () => {
    const a = { reserved_from: iso('2026-10-16T20:00:00+07:00'), reserved_until: iso('2026-10-16T22:00:00+07:00') };
    expect(periodsOverlap(a, { reserved_from: a.reserved_until, reserved_until: iso('2026-10-17T00:00:00+07:00') })).toBe(false);
    expect(periodsOverlap(a, { reserved_from: iso('2026-10-16T21:59:00+07:00'), reserved_until: iso('2026-10-17T00:00:00+07:00') })).toBe(true);
  });

  describe('boardDropBlock', () => {
    const now = new Date('2026-10-16T20:00:00+07:00');
    const booking: BoardDropBooking = {
      id: 'b1',
      status: 'CONFIRMED',
      table_id: 't1',
      reserved_from: iso('2026-10-16T21:00:00+07:00'),
      reserved_until: iso('2026-10-16T23:00:00+07:00'),
    };
    const free: BoardDropTarget = { id: 't2', status: 'FREE', status_source: null };
    const manual: BoardDropTarget = { id: 't2', status: 'IN_USE', status_source: 'MANUAL' };
    const other = (status: BoardDropBooking['status']): BoardDropBooking => ({
      id: 'b2',
      status,
      table_id: 't2',
      reserved_from: iso('2026-10-16T22:00:00+07:00'),
      reserved_until: iso('2026-10-17T00:00:00+07:00'),
    });
    it('allows a free target', () => {
      expect(boardDropBlock(booking, free, [], now)).toBeNull();
    });
    it('blocks a finished booking', () => {
      expect(boardDropBlock({ ...booking, status: 'COMPLETED' }, free, [], now)).toBe('NOT_MOVABLE');
      expect(boardDropBlock({ ...booking, status: 'NO_SHOW' }, free, [], now)).toBe('NOT_MOVABLE');
    });
    it('blocks the same table', () => {
      expect(boardDropBlock(booking, { ...free, id: 't1' }, [], now)).toBe('SAME_TABLE');
    });
    it('blocks an overlapping holding booking on the target, ignoring finished ones and itself', () => {
      expect(boardDropBlock(booking, free, [other('CONFIRMED')], now)).toBe('TIME_OVERLAP');
      expect(boardDropBlock(booking, free, [other('COMPLETED')], now)).toBeNull();
      expect(boardDropBlock(booking, free, [other('NO_SHOW')], now)).toBeNull();
      expect(boardDropBlock(booking, free, [{ ...booking, table_id: 't2' }], now)).toBeNull();
    });
    it('blocks a manually occupied table only when the booking is seated or starts within the lead time', () => {
      expect(boardDropBlock({ ...booking, status: 'CHECKED_IN' }, manual, [], now)).toBe('TABLE_IN_USE');
      // เริ่มในอีก 30 นาที
      expect(boardDropBlock({ ...booking, reserved_from: iso('2026-10-16T20:30:00+07:00') }, manual, [], now)).toBe('TABLE_IN_USE');
      // เริ่มอีก 3 ชม.
      expect(
        boardDropBlock({ ...booking, reserved_from: iso('2026-10-16T23:00:00+07:00'), reserved_until: iso('2026-10-17T01:00:00+07:00') }, manual, [], now),
      ).toBeNull();
      // กำลังใช้จากการจอง (ไม่ใช่ตั้งเอง) → ไม่ใช่ TABLE_IN_USE (DB ตรวจ TABLE_TAKEN เอง)
      expect(boardDropBlock({ ...booking, status: 'CHECKED_IN' }, { ...manual, status_source: 'BOOKING' }, [], now)).toBeNull();
    });
  });

  describe('packLanes', () => {
    const span = (id: string, start: number, end: number) => ({ id, start, end });
    const ids = (lanes: { id: string }[][]) => lanes.map((lane) => lane.map((x) => x.id));
    it('packs overlapping spans into extra lanes', () => {
      expect(packLanes([])).toEqual([]);
      expect(ids(packLanes([span('a', 0, 10), span('b', 20, 30)]))).toEqual([['a', 'b']]);
      expect(ids(packLanes([span('a', 0, 10), span('b', 5, 15)]))).toEqual([['a'], ['b']]);
      // ชนขอบพอดี = แถวเดียว (เรียงตาม start ให้)
      expect(ids(packLanes([span('b', 10, 20), span('a', 0, 10)]))).toEqual([['a', 'b']]);
      // ตัวที่สามกลับไปแถวแรกได้
      expect(ids(packLanes([span('a', 0, 10), span('b', 5, 15), span('c', 10, 12)]))).toEqual([['a', 'c'], ['b']]);
    });
  });

  describe('timelineRange', () => {
    const night = '2026-10-16';
    const nightStart = iso('2026-10-16T06:00:00+07:00');
    const nightEnd = iso('2026-10-17T06:00:00+07:00');
    const outside = new Date('2026-10-20T12:00:00+07:00');
    const ms = (s: string) => new Date(s).getTime();
    const hours = { open: '20:00', close: '02:00' };
    it('uses the opening hours across midnight', () => {
      expect(timelineRange({ night, nightStart, nightEnd, hours, periods: [], now: outside })).toEqual({
        start: ms('2026-10-16T20:00:00+07:00'),
        end: ms('2026-10-17T02:00:00+07:00'),
      });
    });
    it('widens to the earliest booking, rounded down to the hour', () => {
      const r = timelineRange({
        night,
        nightStart,
        nightEnd,
        hours,
        periods: [{ reserved_from: iso('2026-10-16T18:30:00+07:00'), reserved_until: iso('2026-10-16T21:00:00+07:00') }],
        now: outside,
      });
      expect(r).toEqual({ start: ms('2026-10-16T18:00:00+07:00'), end: ms('2026-10-17T02:00:00+07:00') });
    });
    it('falls back to 18:00–02:00 when closed or without hours', () => {
      const fallback = { start: ms('2026-10-16T18:00:00+07:00'), end: ms('2026-10-17T02:00:00+07:00') };
      expect(timelineRange({ night, nightStart, nightEnd, hours: { ...hours, closed: true }, periods: [], now: outside })).toEqual(fallback);
      expect(timelineRange({ night, nightStart, nightEnd, hours: null, periods: [], now: outside })).toEqual(fallback);
    });
    it('includes now inside the night and clamps to the night end', () => {
      const r = timelineRange({
        night,
        nightStart,
        nightEnd,
        hours,
        periods: [{ reserved_from: iso('2026-10-17T03:00:00+07:00'), reserved_until: iso('2026-10-17T07:30:00+07:00') }],
        now: new Date('2026-10-16T17:10:00+07:00'),
      });
      expect(r).toEqual({ start: ms('2026-10-16T17:00:00+07:00'), end: ms(nightEnd) });
    });
  });
});

describe('mini-ads', () => {
  const ad = { active: true, starts_at: '2026-10-10T00:00:00+07:00', ends_at: '2026-10-20T00:00:00+07:00' };
  it('miniAdState: SCHEDULED → LIVE → ENDED (end exclusive) · OFF when inactive · ENDED wins over OFF', () => {
    expect(miniAdState(ad, new Date('2026-10-09T23:59:59+07:00'))).toBe('SCHEDULED');
    expect(miniAdState(ad, new Date('2026-10-15T12:00:00+07:00'))).toBe('LIVE');
    expect(miniAdState(ad, new Date('2026-10-20T00:00:00+07:00'))).toBe('ENDED');
    expect(miniAdState(ad, new Date('2026-10-10T00:00:00+07:00'))).toBe('LIVE');
    expect(miniAdState({ ...ad, active: false }, new Date('2026-10-15T12:00:00+07:00'))).toBe('OFF');
    expect(miniAdState({ ...ad, active: false }, new Date('2026-10-21T00:00:00+07:00'))).toBe('ENDED');
  });
  it('miniAdCtr: no impressions = null · % with 1 decimal', () => {
    expect(miniAdCtr(0, 0)).toBeNull();
    expect(miniAdCtr(1000, 25)).toBe(2.5);
    expect(miniAdCtr(3, 1)).toBe(33.3);
  });
  it('label + no-alcohol confirmation text', () => {
    expect(MINI_AD_LABEL).toBe('โฆษณา');
    expect(MINI_AD_NO_ALCOHOL_TEXT).toContain('ม.32');
  });
});

describe('deal today', () => {
  const at = (iso: string) => Date.parse(iso);
  const wed1959 = at('2026-10-14T12:59:00Z');
  const wed2000 = at('2026-10-14T13:00:00Z');
  const wed2001 = at('2026-10-14T13:01:00Z');
  const thu1900 = at('2026-10-15T12:00:00Z');

  it('bangkokClock is Asia/Bangkok regardless of device timezone', () => {
    expect(BANGKOK_UTC_OFFSET_MINUTES).toBe(420);
    expect(bangkokClock(wed1959)).toEqual({ date: '2026-10-14', day: 3, minute: 1199 });
    expect(bangkokClock(at('2026-10-14T17:30:00Z'))).toEqual({ date: '2026-10-15', day: 4, minute: 30 });
    expect(bangkokClock(new Date(wed1959))).toEqual(bangkokClock(wed1959));
  });

  it('hhmmToMinutes', () => {
    expect(hhmmToMinutes('20:00')).toBe(1200);
    expect(hhmmToMinutes('20:00:00')).toBe(1200);
    expect(hhmmToMinutes('00:30')).toBe(30);
    expect(Number.isNaN(hhmmToMinutes('x'))).toBe(true);
  });

  it('cutoff: minute equal to cutoff is still LIVE (DB uses time > cutoff)', () => {
    const p = { active: true, days: [3], cutoffTime: '20:00' };
    expect(dealTodayStatus(p, wed1959)).toBe('LIVE');
    expect(dealTodayStatus(p, wed2000)).toBe('LIVE');
    expect(dealTodayStatus(p, wed2001)).toBe('ENDED');
    expect(dealTodayStatus(p, thu1900)).toBe('NOT_TODAY');
  });

  it('days empty / missing / all 7 = every day', () => {
    for (const days of [undefined, null, [], [0, 1, 2, 3, 4, 5, 6]]) {
      expect(dealTodayStatus({ active: true, days }, wed2001)).toBe('LIVE');
      expect(dealTodayStatus({ active: true, days }, thu1900)).toBe('LIVE');
    }
  });

  it('valid dates are inclusive Bangkok calendar dates', () => {
    expect(dealTodayStatus({ validFrom: '2026-10-15' }, wed2001)).toBe('NOT_TODAY');
    expect(dealTodayStatus({ validFrom: '2026-10-14' }, wed2001)).toBe('LIVE');
    expect(dealTodayStatus({ validTo: '2026-10-14' }, wed2001)).toBe('LIVE');
    expect(dealTodayStatus({ validTo: '2026-10-13' }, wed2001)).toBe('NOT_TODAY');
    // 00:30 กรุงเทพของวันที่ 15 = ยังเป็น 14 ตาม UTC แต่ต้องใช้วันที่กรุงเทพ
    expect(dealTodayStatus({ validTo: '2026-10-14' }, at('2026-10-14T17:30:00Z'))).toBe('NOT_TODAY');
  });

  it('inactive / unapproved are never deals; bad cutoff = no cutoff', () => {
    expect(dealTodayStatus({ active: false }, wed1959)).toBe('NOT_TODAY');
    expect(dealTodayStatus({ moderationStatus: 'PENDING' }, wed1959)).toBe('NOT_TODAY');
    expect(dealTodayStatus({ moderationStatus: 'REJECTED' }, wed1959)).toBe('NOT_TODAY');
    expect(dealTodayStatus({ moderationStatus: 'APPROVED', cutoffTime: '20:00' }, wed2001)).toBe('ENDED');
    expect(dealTodayStatus({ moderationStatus: null }, wed1959)).toBe('LIVE');
    expect(dealTodayStatus({ cutoffTime: 'x' }, wed2001)).toBe('LIVE');
    expect(isPublicDeal({})).toBe(true);
    expect(isPublicDeal({ active: true, moderationStatus: 'APPROVED' })).toBe(true);
    expect(isPublicDeal({ active: false })).toBe(false);
    expect(isPublicDeal({ moderationStatus: 'PENDING' })).toBe(false);
    expect(isPublicDeal({ moderationStatus: 'REJECTED' })).toBe(false);
  });

  it('groupDealsToday keeps order, drops non-public, closed day → otherDays', () => {
    const live = { id: 'live', active: true };
    const ended = { id: 'ended', active: true, cutoffTime: '20:00' };
    const thuOnly = { id: 'thu', active: true, days: [4] };
    const inactive = { id: 'off', active: false };
    const pending = { id: 'pending', active: true, moderationStatus: 'PENDING' };
    const live2 = { id: 'live2', moderationStatus: 'APPROVED' };
    const promos = [live, ended, thuOnly, inactive, pending, live2];
    const g = groupDealsToday(promos, wed2001);
    expect(g.live.map((p) => p.id)).toEqual(['live', 'live2']);
    expect(g.ended.map((p) => p.id)).toEqual(['ended']);
    expect(g.otherDays.map((p) => p.id)).toEqual(['thu']);
    const closed = groupDealsToday(promos, wed2001, { closedToday: true });
    expect(closed.live).toEqual([]);
    expect(closed.ended).toEqual([]);
    expect(closed.otherDays.map((p) => p.id)).toEqual(['live', 'ended', 'thu', 'live2']);
    expect(groupDealsToday([], wed2001)).toEqual({ live: [], ended: [], otherDays: [] });
  });

  it('groupDealsToday drops expired promos (validTo < today) from every group', () => {
    const expired = { id: 'old', moderationStatus: 'APPROVED', validTo: '2026-10-13' };
    const expiredOtherDay = { id: 'old-thu', days: [4], validTo: '2026-10-01' };
    const lastDay = { id: 'last', validTo: '2026-10-14' };
    const g = groupDealsToday([expired, expiredOtherDay, lastDay], wed2001);
    expect(g.live.map((p) => p.id)).toEqual(['last']);
    expect(g.ended).toEqual([]);
    expect(g.otherDays).toEqual([]);
    const closed = groupDealsToday([expired, expiredOtherDay, lastDay], wed2001, { closedToday: true });
    expect(closed.otherDays.map((p) => p.id)).toEqual(['last']);
  });
});
