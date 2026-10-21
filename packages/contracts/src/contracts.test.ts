import { describe, expect, it } from 'vitest';
import { CreateBookingBody, ERROR_MESSAGES, errorMessageOf, ReviewDepositBody, SaveTeamPageBody, TeamMemberBody, UpdateTeamMemberBody } from './index';
import { ACCOUNT_ERRORS, canCreateRole, CreateUserBody, OAuthSignupCompleteBody, OAuthSignupVerifyBody } from './account';
import { SaveSiteNavBody, SITE_NAV_KEYS } from './site-content';
import { SaveRoleColorsBody, SetUsersRoleBody } from './account';
import { AdminBarMediaBody, BAR_GALLERY_MAX, BarMediaBody, BarStoreBody, MenuBody, PromotionsPageBody, SaveSafetyBody, SettingsPageBody, SetBarsStatusBody } from './bar';
import { PUBLIC_BUCKETS, UploadBucket } from './storage';
import { CommunityCommentBody, CommunityFeedQuery, CommunityReportBody, CommunityThreadBody, communityTeamBadge, ModerateCommunityBody, MyCommunityFeedQuery, SaveCommunityDraftBody, UpdateCommunityCommentBody } from './community';
import { ADMIN_VIEWS, AdminReportNoTableBody, BAR_ERRORS, BarBlacklistBody, BOOKING_ERRORS, CheckInPreviewQuery, ReportNoTableBody } from './index';
import { SafetyInspectionBody } from './index';
import { ADMIN_MASTER_TABLES, AdminBarDetailsBody, AdminBarInfoBody, BanUserBody, RankingQuery, RemoveUserAvatarBody, SaveStylesBody, SetAvatarBody, STYLE_ICONS, UnbanUserBody } from './index';
import { MarkPaymentRefundedBody, MockCompleteBody, PAYMENT_ERRORS, SUPER_ADMIN_VIEWS } from './index';
import { TableBoardQuery, TableOccupancyBody } from './index';
import { MINI_ADS_ERRORS, MiniAdBody, MiniAdsQuery, TrackMiniAdBody, UpdateMiniAdBody } from './index';
import { SalesStatsQuery, type TeamForfeitResult } from './index';
import { AreaAtPointQuery, BarInfoBody, MerchantJoinBody, TambonSearchQuery } from './index';

describe('booking', () => {
  const base = {
    bar_id: '96e5917b-2acc-5f7f-b4ca-fc9a3b00f07d',
    zone_id: '786b8848-090f-50da-b21a-90cc60073677',
    datetime: '2026-10-10T21:00:00+07:00',
    pax: 2,
  };
  const terms = { accepted: true as const, terms_version: 'deposit-v2', terms_text: 'ฉันได้อ่านและยอมรับเงื่อนไขค่าธรรมเนียมจองโต๊ะ (Table Fee) ฿500' };
  it('normalizes a Thai phone to E.164', () => {
    expect(CreateBookingBody.parse({ ...base, contact_phone: '081-234-5678', deposit_terms: terms }).contact_phone).toBe('+66812345678');
  });
  it('rejects a missing or bad phone, and terms not accepted', () => {
    expect(CreateBookingBody.safeParse({ ...base, deposit_terms: terms }).success).toBe(false);
    expect(CreateBookingBody.safeParse({ ...base, contact_phone: '123', deposit_terms: terms }).success).toBe(false);
    expect(CreateBookingBody.safeParse({ ...base, contact_phone: '0812345678', deposit_terms: { ...terms, accepted: false } }).success).toBe(false);
  });
});

describe('deposit review', () => {
  it('approve needs no reason · reject needs a code · OTHER needs text', () => {
    expect(ReviewDepositBody.safeParse({ approve: true }).success).toBe(true);
    expect(ReviewDepositBody.safeParse({ approve: false }).success).toBe(false);
    expect(ReviewDepositBody.safeParse({ approve: false, reason_code: 'NOPE' }).success).toBe(false);
    expect(ReviewDepositBody.safeParse({ approve: false, reason_code: 'FAKE_SLIP' }).success).toBe(true);
    expect(ReviewDepositBody.safeParse({ approve: false, reason_code: 'OTHER' }).success).toBe(false);
    expect(ReviewDepositBody.safeParse({ approve: false, reason_code: 'OTHER', reason: 'ชื่อบัญชีไม่ตรง' }).success).toBe(true);
  });
});

describe('site-team', () => {
  it('accepts a full member and applies defaults', () => {
    const r = TeamMemberBody.parse({ nickname: ' แสน ', contacts: { github: 'https://github.com/san' } });
    expect(r).toMatchObject({ nickname: 'แสน', roles: [], skills: [], active: true, contacts: { github: 'https://github.com/san' } });
  });
  it('rejects unsafe links and bad values', () => {
    expect(TeamMemberBody.safeParse({ nickname: '' }).success).toBe(false);
    expect(TeamMemberBody.safeParse({ nickname: 'a', photo_url: 'javascript:alert(1)' }).success).toBe(false);
    expect(TeamMemberBody.safeParse({ nickname: 'a', photo_url: 'data:image/png;base64,x' }).success).toBe(false);
    expect(TeamMemberBody.safeParse({ nickname: 'a', contacts: { facebook: 'http://fb.com/x' } }).success).toBe(false);
    expect(TeamMemberBody.safeParse({ nickname: 'a', contacts: { email: 'not-mail' } }).success).toBe(false);
    expect(TeamMemberBody.safeParse({ nickname: 'a', roles: Array(7).fill('x') }).success).toBe(false);
  });
  it('partial update does not inject defaults', () => {
    expect(UpdateTeamMemberBody.parse({ active: false })).toEqual({ active: false });
  });
  it('save page: order and/or active changes (at least one) · uuids only · no duplicate rows', () => {
    const a = '96e5917b-2acc-5f7f-b4ca-fc9a3b00f07d';
    const b = '16e5917b-2acc-5f7f-b4ca-fc9a3b00f07d';
    expect(SaveTeamPageBody.safeParse({ order: [b, a] }).success).toBe(true);
    expect(SaveTeamPageBody.safeParse({ active: [{ id: a, active: false }] }).success).toBe(true);
    expect(SaveTeamPageBody.safeParse({ order: ['x'] }).success).toBe(false);
    expect(SaveTeamPageBody.safeParse({}).success).toBe(false);
    expect(SaveTeamPageBody.safeParse({ active: [] }).success).toBe(false);
    expect(SaveTeamPageBody.safeParse({ active: [{ id: a, active: true }, { id: a, active: false }] }).success).toBe(false);
  });
});

describe('bar status (Backoffice /bars)', () => {
  const id = '96e5917b-2acc-5f7f-b4ca-fc9a3b00f07d';
  it('show/hide only · hiding needs a reason · no duplicate bars', () => {
    expect(SetBarsStatusBody.safeParse({ changes: [{ id, status: 'APPROVED' }] }).success).toBe(true);
    expect(SetBarsStatusBody.safeParse({ changes: [{ id, status: 'SUSPENDED', reason: 'ภาพไม่เหมาะสม' }] }).success).toBe(true);
    expect(SetBarsStatusBody.safeParse({ changes: [{ id, status: 'SUSPENDED' }] }).success).toBe(false);
    expect(SetBarsStatusBody.safeParse({ changes: [{ id, status: 'SUSPENDED', reason: '   ' }] }).success).toBe(false);
    expect(SetBarsStatusBody.safeParse({ changes: [{ id, status: 'REJECTED', reason: 'x' }] }).success).toBe(false);
    expect(SetBarsStatusBody.safeParse({ changes: [] }).success).toBe(false);
    expect(SetBarsStatusBody.safeParse({ changes: [{ id, status: 'APPROVED' }, { id, status: 'APPROVED' }] }).success).toBe(false);
  });
});

describe('save page: user roles · bar safety', () => {
  const id = '96e5917b-2acc-5f7f-b4ca-fc9a3b00f07d';
  const bar = '16e5917b-2acc-5f7f-b4ca-fc9a3b00f07d';
  it('roles: changed users only · valid role · no duplicates', () => {
    expect(SetUsersRoleBody.safeParse({ changes: [{ id, role: 'ADMIN' }] }).success).toBe(true);
    expect(SetUsersRoleBody.safeParse({ changes: [{ id, role: 'GOD' }] }).success).toBe(false);
    expect(SetUsersRoleBody.safeParse({ changes: [] }).success).toBe(false);
    expect(SetUsersRoleBody.safeParse({ changes: [{ id, role: 'ADMIN' }, { id, role: 'CUSTOMER' }] }).success).toBe(false);
  });
  it('safety: each item has a value and/or evidence · keys unique (case-insensitive)', () => {
    expect(SaveSafetyBody.safeParse({ items: [{ key: 'CCTV', value: 'YES' }] }).success).toBe(true);
    expect(SaveSafetyBody.safeParse({ items: [{ key: 'CCTV', evidence_path: `${bar}/CCTV/a.jpg` }] }).success).toBe(true);
    expect(SaveSafetyBody.safeParse({ items: [{ key: 'CCTV' }] }).success).toBe(false);
    expect(SaveSafetyBody.safeParse({ items: [{ key: 'CCTV', value: 'MAYBE' }] }).success).toBe(false);
    expect(SaveSafetyBody.safeParse({ items: [{ key: 'CCTV', value: 'YES' }, { key: 'cctv', value: 'NO' }] }).success).toBe(false);
    expect(SaveSafetyBody.safeParse({ items: [] }).success).toBe(false);
  });
});

describe('save page: promotions + fees', () => {
  it('items and/or fees (at least one) · fee limits', () => {
    const promo = { title: 'ส่วนลดอาหาร 15%', active: true };
    expect(PromotionsPageBody.safeParse({ items: [promo] }).success).toBe(true);
    expect(PromotionsPageBody.safeParse({ items: [] }).success).toBe(true);
    expect(PromotionsPageBody.safeParse({ fees: { service_charge: 10, vat: 7, other: 0 } }).success).toBe(true);
    expect(PromotionsPageBody.safeParse({ fees: { service_charge: 10, vat: 70, other: 0 } }).success).toBe(false);
    expect(PromotionsPageBody.safeParse({}).success).toBe(false);
  });
});

describe('save page: merchant settings', () => {
  it('settings: booking and/or payout (at least one)', () => {
    expect(SettingsPageBody.safeParse({ booking: { grace_minutes: 30 } }).success).toBe(true);
    expect(SettingsPageBody.safeParse({ payout: { bank_code: 'กสิกรไทย', account_name: 'ร้าน', account_no: '1234567890' } }).success).toBe(true);
    expect(SettingsPageBody.safeParse({ booking: { grace_minutes: 20 } }).success).toBe(false);
    expect(SettingsPageBody.safeParse({}).success).toBe(false);
  });
});

describe('site-content', () => {
  const navItems = () =>
    SITE_NAV_KEYS.map((key, i) => ({
      key,
      label: ` ${key} `,
      desktop_order: i,
      desktop_visible: true,
      mobile_order: SITE_NAV_KEYS.length - 1 - i,
      mobile_visible: key !== 'about',
    }));
  it('site nav: accepts full list with separate desktop/mobile order', () => {
    const r = SaveSiteNavBody.parse({ items: navItems() });
    expect(r.items[0]!.label).toBe('home');
  });
  it('site nav: rejects missing, duplicate order, empty label and hidden home', () => {
    expect(SaveSiteNavBody.safeParse({ items: navItems().slice(1) }).success).toBe(false);
    expect(SaveSiteNavBody.safeParse({ items: navItems().map((x) => ({ ...x, desktop_order: 0 })) }).success).toBe(false);
    expect(SaveSiteNavBody.safeParse({ items: navItems().map((x, i) => (i ? x : { ...x, label: '  ' })) }).success).toBe(false);
    expect(
      SaveSiteNavBody.safeParse({ items: navItems().map((x) => (x.key === 'home' ? { ...x, mobile_visible: false } : x)) }).success,
    ).toBe(false);
  });
});

describe('account', () => {
  it('validates role colors and upper-cases hex', () => {
    expect(SaveRoleColorsBody.parse({ items: [{ code: 'ADMIN', color: '#22c55e' }] }).items[0]?.color).toBe('#22C55E');
    expect(SaveRoleColorsBody.safeParse({ items: [{ code: 'ADMIN', color: '22C55E' }] }).success).toBe(false);
    expect(SaveRoleColorsBody.safeParse({ items: [{ code: 'ADMIN', color: '#FFF' }] }).success).toBe(false);
    expect(SaveRoleColorsBody.safeParse({ items: [{ code: 'NOPE', color: '#FFFFFF' }] }).success).toBe(false);
    expect(SaveRoleColorsBody.safeParse({ items: [{ code: 'STAFF', color: '#FFFFFF' }, { code: 'STAFF', color: '#000000' }] }).success).toBe(false);
    expect(SaveRoleColorsBody.safeParse({ items: [] }).success).toBe(false);
    expect(ERROR_MESSAGES.INVALID_ROLE_COLORS).toBe(ACCOUNT_ERRORS.INVALID_ROLE_COLORS);
  });

  const base = { email: ' New@Mail.com ', display_name: 'ใหม่', birthdate: '1995-05-05' };
  it('normalizes email and ties bar to account type', () => {
    expect(CreateUserBody.parse({ ...base, account_type: 'CUSTOMER' }).email).toBe('new@mail.com');
    expect(CreateUserBody.safeParse({ ...base, account_type: 'STAFF' }).success).toBe(false);
    expect(CreateUserBody.safeParse({ ...base, account_type: 'ADMIN', bar_id: '96e5917b-2acc-5f7f-b4ca-fc9a3b00f07d' }).success).toBe(false);
    expect(CreateUserBody.safeParse({ ...base, account_type: 'OWNER', bar_id: '00000000-0000-4000-8000-000000000001' }).success).toBe(true);
    expect(CreateUserBody.safeParse({ ...base, account_type: 'SUPER_ADMIN' }).success).toBe(true);
    expect(CreateUserBody.safeParse({ ...base, birthdate: '2020-01-01', account_type: 'CUSTOMER' }).success).toBe(false);
    expect(CreateUserBody.safeParse({ ...base, account_type: 'CUSTOMER', password: 'short' }).success).toBe(false);
  });
  it('admin creates only customer / merchant / staff · super admin creates all', () => {
    expect(canCreateRole('ADMIN', 'CUSTOMER') && canCreateRole('ADMIN', 'MERCHANT') && canCreateRole('ADMIN', 'STAFF')).toBe(true);
    expect(canCreateRole('ADMIN', 'ADMIN')).toBe(false);
    expect(canCreateRole('SUPER_ADMIN', 'SUPER_ADMIN')).toBe(true);
  });
});

describe('bar media', () => {
  const bar = '96e5917b-2acc-5f7f-b4ca-fc9a3b00f07d';
  const g = (n: number) => `${bar}/gallery/${n}.webp`;
  it('gallery: up to BAR_GALLERY_MAX unique paths, cover must be one of them', () => {
    expect(BarMediaBody.safeParse({ paths: [], cover_path: null }).success).toBe(true);
    expect(BarMediaBody.safeParse({ paths: [g(1), g(2)], cover_path: g(2) }).success).toBe(true);
    expect(BarMediaBody.safeParse({ paths: [g(1)], cover_path: g(2) }).success).toBe(false);
    expect(BarMediaBody.safeParse({ paths: [g(1), g(1)], cover_path: null }).success).toBe(false);
    expect(BarMediaBody.safeParse({ paths: Array.from({ length: BAR_GALLERY_MAX + 1 }, (_, i) => g(i)), cover_path: null }).success).toBe(false);
    expect(BarMediaBody.safeParse({ paths: [`${bar}/../x.webp`], cover_path: null }).success).toBe(false);
  });
  it('menu image: optional per item (missing = keep, null = remove) · admin body takes path or null', () => {
    const item = { category: 'อาหาร', name: 'ข้าว', price: 60, available: true };
    expect(MenuBody.safeParse({ items: [item] }).success).toBe(true);
    expect(MenuBody.safeParse({ items: [{ ...item, image_path: null }] }).success).toBe(true);
    expect(MenuBody.safeParse({ items: [{ ...item, image_path: `${bar}/menu/a.jpg` }] }).success).toBe(true);
    expect(MenuBody.safeParse({ items: [{ ...item, image_path: '/etc/passwd' }] }).success).toBe(false);
  });
  it('admin save: gallery and/or changed menu images (path or null) · at least one', () => {
    const item = '16e5917b-2acc-5f7f-b4ca-fc9a3b00f07d';
    expect(AdminBarMediaBody.safeParse({ gallery: { paths: [g(1)], cover_path: g(1) } }).success).toBe(true);
    expect(AdminBarMediaBody.safeParse({ menu_images: [{ id: item, path: null }] }).success).toBe(true);
    expect(AdminBarMediaBody.safeParse({ menu_images: [{ id: item, path: `${bar}/menu/a.webp` }] }).success).toBe(true);
    expect(AdminBarMediaBody.safeParse({ menu_images: [{ id: item }] }).success).toBe(false);
    expect(AdminBarMediaBody.safeParse({ menu_images: [] }).success).toBe(false);
    expect(AdminBarMediaBody.safeParse({ gallery: { paths: [g(1)], cover_path: g(2) } }).success).toBe(false);
  });
  it('merchant store save: info and/or media (at least one)', () => {
    expect(BarStoreBody.safeParse({ info: { name: 'ร้าน' } }).success).toBe(true);
    expect(BarStoreBody.safeParse({ media: { paths: [], cover_path: null } }).success).toBe(true);
    expect(BarStoreBody.safeParse({}).success).toBe(false);
  });
  it('bar-media is an uploadable public bucket', () => {
    expect(UploadBucket.safeParse('bar-media').success).toBe(true);
    expect(PUBLIC_BUCKETS).toContain('bar-media');
  });
});

describe('community', () => {
  const id = '96e5917b-2acc-5f7f-b4ca-fc9a3b00f07d';
  it('thread: trims, needs a category and a 3+ char title', () => {
    expect(CommunityThreadBody.parse({ category: 'qa', title: '  ร้านไหนดี  ' })).toEqual({ category: 'qa', title: 'ร้านไหนดี', body: '', media: [] });
    expect(CommunityThreadBody.safeParse({ category: 'qa', title: 'ab' }).success).toBe(false);
    expect(CommunityThreadBody.safeParse({ category: 'Bad Slug', title: 'ร้านไหนดี' }).success).toBe(false);
  });
  it('feed query: coerces paging from the query string · scope is required for /me', () => {
    expect(CommunityFeedQuery.parse({ limit: '10', offset: '20' })).toMatchObject({ sort: 'latest', limit: 10, offset: 20 });
    expect(CommunityFeedQuery.safeParse({ sort: 'hot' }).success).toBe(false);
    expect(MyCommunityFeedQuery.safeParse({}).success).toBe(false);
    expect(MyCommunityFeedQuery.parse({ scope: 'pinned' }).scope).toBe('pinned');
  });
  it('draft: NEW has no thread · REPLY / EDIT need one · empty fields are fine', () => {
    expect(SaveCommunityDraftBody.safeParse({ kind: 'NEW', payload: { title: '' } }).success).toBe(true);
    expect(SaveCommunityDraftBody.safeParse({ kind: 'NEW', thread_id: id, payload: {} }).success).toBe(false);
    expect(SaveCommunityDraftBody.safeParse({ kind: 'REPLY', payload: { body: 'กำลังพิมพ์' } }).success).toBe(false);
    expect(SaveCommunityDraftBody.safeParse({ kind: 'EDIT', thread_id: id, payload: { title: 'x'.repeat(121) } }).success).toBe(false);
  });
  it('draft: EDIT_COMMENT needs a thread and the comment being edited', () => {
    expect(SaveCommunityDraftBody.safeParse({ kind: 'EDIT_COMMENT', thread_id: id, payload: { comment_id: id, body: 'แก้' } }).success).toBe(true);
    expect(SaveCommunityDraftBody.safeParse({ kind: 'EDIT_COMMENT', thread_id: id, payload: { body: 'แก้' } }).success).toBe(false);
    expect(SaveCommunityDraftBody.safeParse({ kind: 'EDIT_COMMENT', payload: { comment_id: id } }).success).toBe(false);
  });
  it('edit comment: trims · needs text or a file', () => {
    expect(UpdateCommunityCommentBody.parse({ body: '  แก้แล้ว  ' })).toEqual({ body: 'แก้แล้ว', media: [] });
    expect(UpdateCommunityCommentBody.safeParse({ body: '  ' }).success).toBe(false);
    expect(UpdateCommunityCommentBody.safeParse({ media: [{ path: 'u1/a.jpg', kind: 'IMAGE' }] }).success).toBe(true);
    expect(UpdateCommunityCommentBody.safeParse({ body: 'x'.repeat(2001) }).success).toBe(false);
  });
  it('media: up to 6 files · a comment needs text or a file', () => {
    const img = { path: 'u1/a.jpg', kind: 'IMAGE' as const };
    expect(CommunityThreadBody.parse({ category: 'qa', title: 'ร้านไหนดี' }).media).toEqual([]);
    expect(CommunityThreadBody.safeParse({ category: 'qa', title: 'ร้านไหนดี', media: Array(7).fill(img) }).success).toBe(false);
    expect(CommunityThreadBody.safeParse({ category: 'qa', title: 'ร้านไหนดี', media: [{ ...img, path: '../x.jpg' }] }).success).toBe(false);
    expect(CommunityCommentBody.safeParse({ body: '  ' }).success).toBe(false);
    expect(CommunityCommentBody.safeParse({ body: '', media: [img] }).success).toBe(true);
    expect(CommunityCommentBody.safeParse({ media: [{ path: 'u1/v.mp4', kind: 'VIDEO', duration_sec: 75 }] }).success).toBe(false);
  });
  it('report: exactly one target', () => {
    expect(CommunityReportBody.safeParse({ thread_id: id, reason: 'SPAM' }).success).toBe(true);
    expect(CommunityReportBody.safeParse({ reason: 'SPAM' }).success).toBe(false);
    expect(CommunityReportBody.safeParse({ thread_id: id, comment_id: id, reason: 'SPAM' }).success).toBe(false);
  });
  it('shop team: badge text · shop news must tag a shop', () => {
    expect(communityTeamBadge('Moon Bar')).toBe('ทีมร้าน Moon Bar');
    expect(CommunityThreadBody.safeParse({ category: 'shop-news', title: 'ข่าวร้านเรา' }).success).toBe(false);
    expect(CommunityThreadBody.safeParse({ category: 'shop-news', title: 'ข่าวร้านเรา', bar_id: id }).success).toBe(true);
    expect(CommunityThreadBody.safeParse({ category: 'qa', title: 'ร้านไหนดี' }).success).toBe(true);
  });
  it('shop team: error messages · quota number in the limit message', () => {
    for (const code of [
      'COMMUNITY_CATEGORY_TEAM_ONLY',
      'COMMUNITY_SHOP_NEWS_OWN_BAR',
      'COMMUNITY_SHOP_NEWS_LIMIT',
      'COMMUNITY_TEAM_CATEGORY',
      'COMMUNITY_SHOP_NEWS_LOCKED',
      'COMMUNITY_TEAM_OWN_TAG',
    ]) {
      expect(ERROR_MESSAGES[code], code).toBeTruthy();
    }
    expect(ERROR_MESSAGES.COMMUNITY_SHOP_NEWS_LIMIT).toContain('3');
  });
  it('moderate: hide / remove need a reason · keep / restore do not', () => {
    expect(ModerateCommunityBody.safeParse({ action: 'HIDE' }).success).toBe(false);
    expect(ModerateCommunityBody.safeParse({ action: 'REMOVE' }).success).toBe(false);
    expect(ModerateCommunityBody.safeParse({ action: 'REMOVE', reason: 'สแปม / โพสต์ซ้ำ' }).success).toBe(true);
    expect(ModerateCommunityBody.safeParse({ action: 'KEEP' }).success).toBe(true);
    expect(ModerateCommunityBody.safeParse({ action: 'RESTORE' }).success).toBe(true);
  });
});

describe('errors', () => {
  it('every domain contributes and nothing collides silently', () => {
    expect(ERROR_MESSAGES.ZONE_FULL).toContain('เต็ม');
    expect(ERROR_MESSAGES.TEAM_MEMBER_NOT_FOUND).toBeTruthy();
    expect(ERROR_MESSAGES.LAST_SUPER_ADMIN).toBeTruthy();
    expect(ERROR_MESSAGES.TEAM_MEMBER_NOT_OWN).toBeTruthy();
    expect(ERROR_MESSAGES.TEAM_MEMBER_EMAIL_LOCKED).toBeTruthy();
    expect(ERROR_MESSAGES.INVALID_BAR_MEDIA).toContain('รูป');
    expect(ERROR_MESSAGES.INVALID_MENU_IMAGE).toBeTruthy();
    expect(ERROR_MESSAGES.INVALID_MENU_ITEM).toBeTruthy();
    expect(ERROR_MESSAGES.COMMUNITY_PIN_LIMIT).toContain('3');
    expect(ERROR_MESSAGES.INVALID_INSPECTION_PHOTO).toContain('3');
    expect(ERROR_MESSAGES.INSPECTOR_IS_BAR_MEMBER).toBeTruthy();
    expect(ERROR_MESSAGES.MINI_AD_NO_ALCOHOL_CONFIRM_REQUIRED).toContain('ม.32');
    expect(Object.keys(ERROR_MESSAGES).length).toBeGreaterThan(70);
  });

  it('errorMessageOf: exact code → embedded code → unknown stays as-is', () => {
    expect(errorMessageOf('ZONE_FULL')).toBe(ERROR_MESSAGES.ZONE_FULL);
    expect(errorMessageOf('SUPABASE_UNREACHABLE: fetch failed')).toBe(ERROR_MESSAGES.SUPABASE_UNREACHABLE);
    expect(errorMessageOf('SOMETHING_NEW')).toBe('SOMETHING_NEW');
  });
});

describe('G3: check-in preview · ร้านไม่มีโต๊ะ · Blacklist ร้าน', () => {
  it('CheckInPreviewQuery trims the code and rejects codes under 3 characters', () => {
    expect(CheckInPreviewQuery.parse({ code: '  NL-3F8K2A  ' }).code).toBe('NL-3F8K2A');
    expect(CheckInPreviewQuery.safeParse({ code: ' NL ' }).success).toBe(false);
    expect(CheckInPreviewQuery.safeParse({}).success).toBe(false);
    expect(CheckInPreviewQuery.safeParse({ code: 'x'.repeat(121) }).success).toBe(false);
  });

  it('ReportNoTableBody: note is optional, trimmed, at most 300 characters', () => {
    expect(ReportNoTableBody.safeParse({}).success).toBe(true);
    expect(ReportNoTableBody.safeParse({ note: null }).success).toBe(true);
    expect(ReportNoTableBody.parse({ note: '  ลูกค้ามา 4 คน โต๊ะเต็ม  ' }).note).toBe('ลูกค้ามา 4 คน โต๊ะเต็ม');
    expect(ReportNoTableBody.safeParse({ note: 'ก'.repeat(300) }).success).toBe(true);
    expect(ReportNoTableBody.safeParse({ note: 'ก'.repeat(301) }).success).toBe(false);
  });

  it('BarBlacklistBody needs a reason of 3+ characters (after trim)', () => {
    expect(BarBlacklistBody.parse({ reason: '  ไม่มีโต๊ะซ้ำ 3 ครั้ง  ' }).reason).toBe('ไม่มีโต๊ะซ้ำ 3 ครั้ง');
    expect(BarBlacklistBody.safeParse({ reason: '  ab  ' }).success).toBe(false);
    expect(BarBlacklistBody.safeParse({}).success).toBe(false);
    expect(BarBlacklistBody.safeParse({ reason: 'x'.repeat(501) }).success).toBe(false);
  });

  it('AdminReportNoTableBody trims both fields · note 3–300 · booking_code required', () => {
    expect(AdminReportNoTableBody.parse({ booking_code: ' NL-3F8K2A ', note: '  ลูกค้าแจ้งว่าไปถึงแล้วไม่มีโต๊ะ  ' })).toEqual({
      booking_code: 'NL-3F8K2A',
      note: 'ลูกค้าแจ้งว่าไปถึงแล้วไม่มีโต๊ะ',
    });
    expect(AdminReportNoTableBody.safeParse({ booking_code: 'NL-3F8K2A', note: ' ab ' }).success).toBe(false);
    expect(AdminReportNoTableBody.safeParse({ booking_code: 'NL-3F8K2A', note: 'ก'.repeat(301) }).success).toBe(false);
    expect(AdminReportNoTableBody.safeParse({ booking_code: 'NL-3F8K2A', note: 'ก'.repeat(300) }).success).toBe(true);
    expect(AdminReportNoTableBody.safeParse({ note: 'ลูกค้าร้องเรียน' }).success).toBe(false);
    expect(AdminReportNoTableBody.safeParse({ booking_code: 'NL-3F8K2A' }).success).toBe(false);
  });

  it('new error codes have Thai messages · BAR_NOT_FOUND keeps the booking text', () => {
    for (const code of [
      'NO_TABLE_NOT_ALLOWED',
      'NO_TABLE_ALREADY_REPORTED',
      'NO_TABLE_ADMIN_NOT_ALLOWED',
      'NO_TABLE_NOTE_REQUIRED',
      'BLACKLIST_REASON_REQUIRED',
      'BAR_ALREADY_BLACKLISTED',
      'BAR_NOT_BLACKLISTED',
      'BAR_NOT_BLACKLISTABLE',
      'BAR_BLACKLISTED',
    ]) {
      expect(ERROR_MESSAGES[code], code).toMatch(/[ก-๙]/);
      expect(errorMessageOf(`P0001: ${code}`), code).toBe(ERROR_MESSAGES[code]);
    }
    expect(ERROR_MESSAGES.NO_TABLE_NOT_ALLOWED).toBe(BOOKING_ERRORS.NO_TABLE_NOT_ALLOWED);
    expect(ERROR_MESSAGES.BAR_BLACKLISTED).toBe(BAR_ERRORS.BAR_BLACKLISTED);
    expect('BAR_NOT_FOUND' in BAR_ERRORS).toBe(false);
    expect(ERROR_MESSAGES.BAR_NOT_FOUND).toBe(BOOKING_ERRORS.BAR_NOT_FOUND);
  });

  it('ADMIN_VIEWS includes admin_bar_blacklist', () => {
    expect(ADMIN_VIEWS).toContain('admin_bar_blacklist');
  });
});

describe('safety inspection (Inspector · Backoffice /safety)', () => {
  const photos = ['b1/inspections/a.webp', 'b1/inspections/b.webp', 'b1/inspections/c.webp'];
  const ok = {
    note: 'ร้านให้ความร่วมมือดี',
    items: [
      { key: 'FIRE_EXIT', result: 'PASS', note: 'ป้ายไฟทางออกใช้งานได้', photo_paths: photos },
      { key: 'CCTV', result: 'FAIL', note: 'กล้องที่ลานจอดรถดับ' },
      { key: 'LIGHTING', result: 'NA' },
    ],
  };
  const withItems = (items: unknown[]) => SafetyInspectionBody.safeParse({ items }).success;

  it('accepts PASS + FAIL (+ NA) with notes and up to 3 photos per item', () => {
    expect(SafetyInspectionBody.safeParse(ok).success).toBe(true);
    expect(withItems([{ key: 'CCTV', result: 'PASS' }])).toBe(true);
  });
  it('needs at least one PASS or FAIL · unique keys (case-insensitive) · known results only', () => {
    expect(withItems([{ key: 'CCTV', result: 'NA' }, { key: 'FIRE_EXIT', result: 'NA' }])).toBe(false);
    expect(withItems([{ key: 'cctv', result: 'PASS' }, { key: 'CCTV', result: 'FAIL' }])).toBe(false);
    expect(withItems([{ key: 'CCTV', result: 'MAYBE' }])).toBe(false);
    expect(withItems([])).toBe(false);
  });
  it('photos: at most 3 per item, no duplicates', () => {
    expect(withItems([{ key: 'CCTV', result: 'PASS', photo_paths: [...photos, 'b1/inspections/d.webp'] }])).toBe(false);
    expect(withItems([{ key: 'CCTV', result: 'PASS', photo_paths: [photos[0], photos[0]] }])).toBe(false);
  });
  it('notes: item ≤ 500 · overall ≤ 1000', () => {
    expect(withItems([{ key: 'CCTV', result: 'FAIL', note: 'ก'.repeat(500) }])).toBe(true);
    expect(withItems([{ key: 'CCTV', result: 'FAIL', note: 'ก'.repeat(501) }])).toBe(false);
    expect(SafetyInspectionBody.safeParse({ ...ok, note: 'ก'.repeat(1001) }).success).toBe(false);
  });
  it('inspected_at: optional ISO datetime with offset', () => {
    expect(SafetyInspectionBody.safeParse({ ...ok, inspected_at: '2026-10-13T20:00:00+07:00' }).success).toBe(true);
    expect(SafetyInspectionBody.safeParse({ ...ok, inspected_at: 'yesterday' }).success).toBe(false);
  });
  it('error codes have Thai messages · ADMIN_VIEWS has the inspector views', () => {
    for (const code of [
      'INVALID_INSPECTION',
      'INVALID_INSPECTION_PHOTO',
      'INVALID_INSPECTION_TIME',
      'INSPECTOR_IS_BAR_MEMBER',
      'SAFETY_ALREADY_VERIFIED',
      'SAFETY_EVIDENCE_REQUIRED',
    ] as const) {
      expect(ERROR_MESSAGES[code], code).toMatch(/[ก-๙]/);
      expect(ERROR_MESSAGES[code], code).toBe(BAR_ERRORS[code]);
    }
    expect(ERROR_MESSAGES.INVALID_INSPECTION_TIME).toContain('30');
    expect(ADMIN_VIEWS).toContain('admin_safety_inspections');
    expect(ADMIN_VIEWS).toContain('admin_bar_safety');
  });
});

describe('G6: แก้ข้อมูลร้านแทน · สไตล์ร้าน · แบนเอง · อันดับร้าน', () => {
  const sid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

  it('SaveStylesBody: new style without id · no duplicate names/ids · not empty · Phosphor PascalCase icon', () => {
    const ok = SaveStylesBody.safeParse({
      items: [
        { id: sid(1), name_th: 'Live Music', icon: 'MusicNotes', active: true },
        { name_th: 'Karaoke', icon: 'Microphone', active: true },
        { id: null, name_th: 'Rooftop ใหม่', icon: 'BuildingOffice', active: false },
      ],
    });
    expect(ok.success).toBe(true);
    expect(SaveStylesBody.safeParse({ items: [{ name_th: 'Rooftop', icon: 'Tree', active: true }, { name_th: ' rooftop ', icon: 'Tree', active: true }] }).success).toBe(false);
    expect(SaveStylesBody.safeParse({ items: [{ id: sid(1), name_th: 'A', icon: 'Tree', active: true }, { id: sid(1), name_th: 'B', icon: 'Tree', active: true }] }).success).toBe(false);
    expect(SaveStylesBody.safeParse({ items: [] }).success).toBe(false);
    expect(SaveStylesBody.safeParse({ items: [{ name_th: 'A', icon: 'music-notes', active: true }] }).success).toBe(false);
    expect(SaveStylesBody.safeParse({ items: [{ name_th: '   ', icon: 'Tree', active: true }] }).success).toBe(false);
    expect(STYLE_ICONS).toContain('Microphone');
    expect(ERROR_MESSAGES.INVALID_STYLES).toBeTruthy();
    expect(ERROR_MESSAGES.DUPLICATE_STYLE_NAME).toBeTruthy();
  });

  it('avatar: SetAvatarBody needs a path · RemoveUserAvatarBody reason 3–300 · avatars bucket is public', () => {
    expect(SetAvatarBody.safeParse({}).success).toBe(false);
    expect(SetAvatarBody.safeParse({ path: 'u1/a.webp' }).success).toBe(true);
    expect(RemoveUserAvatarBody.safeParse({ reason: 'ab' }).success).toBe(false);
    expect(RemoveUserAvatarBody.safeParse({ reason: 'รูปไม่เหมาะสม' }).success).toBe(true);
    expect(PUBLIC_BUCKETS).toContain('avatars');
    for (const k of ['AVATAR_INVALID', 'AVATAR_NOT_FOUND', 'AVATAR_REMOVE_REASON_REQUIRED']) expect(ERROR_MESSAGES[k]).toBeTruthy();
  });

  it('BanUserBody: reason 3–300 · ban_phones defaults false · UnbanUserBody requires a reason', () => {
    expect(BanUserBody.safeParse({ reason: 'ab' }).success).toBe(false);
    expect(BanUserBody.safeParse({ reason: '  ab  ' }).success).toBe(false);
    expect(BanUserBody.safeParse({ reason: 'x'.repeat(301) }).success).toBe(false);
    expect(BanUserBody.parse({ reason: 'สแปม' })).toEqual({ reason: 'สแปม', ban_phones: false });
    expect(BanUserBody.parse({ reason: 'โกงมัดจำ', ban_phones: true }).ban_phones).toBe(true);
    expect(UnbanUserBody.safeParse({}).success).toBe(false);
    expect(UnbanUserBody.safeParse({ reason: 'ok' }).success).toBe(false);
    expect(UnbanUserBody.safeParse({ reason: 'ตรวจแล้วไม่ผิด' }).success).toBe(true);
    for (const k of ['BAN_REASON_REQUIRED', 'CANNOT_BAN_SELF', 'CANNOT_BAN_ADMIN', 'USER_ALREADY_BANNED']) expect(ERROR_MESSAGES[k]).toBeTruthy();
    expect(ERROR_MESSAGES.ACCOUNT_BANNED).not.toContain('สลิป');
    expect(ERROR_MESSAGES.COMMUNITY_BANNED).toContain('อ่านชุมชนได้อย่างเดียว');
  });

  it('AdminBarDetailsBody: at least one part · empty menu ok · no address · hours/links checked', () => {
    expect(AdminBarDetailsBody.safeParse({}).success).toBe(false);
    expect(AdminBarDetailsBody.safeParse({ info: {} }).success).toBe(false);
    expect(AdminBarDetailsBody.safeParse({ menu: [] }).success).toBe(true);
    expect(AdminBarInfoBody.parse({ address: 'x' })).toEqual({});
    expect(AdminBarDetailsBody.safeParse({ info: { address: 'x' } }).success).toBe(false);
    const parsed = AdminBarDetailsBody.parse({ info: { name: 'ร้านใหม่', address: 'x' } });
    expect(parsed.info).toEqual({ name: 'ร้านใหม่' });
    const open = { day_of_week: 1, open_time: '18:00', close_time: '02:00', is_closed: false };
    expect(AdminBarDetailsBody.safeParse({ info: { hours: [open] } }).success).toBe(true);
    expect(AdminBarDetailsBody.safeParse({ info: { hours: [open, { ...open }] } }).success).toBe(false);
    expect(AdminBarDetailsBody.safeParse({ info: { hours: [{ ...open, close_time: null }] } }).success).toBe(false);
    expect(AdminBarDetailsBody.safeParse({ info: { hours: [{ day_of_week: 2, open_time: null, close_time: null, is_closed: true }] } }).success).toBe(true);
    expect(AdminBarDetailsBody.safeParse({ info: { links: [{ type: 'WEBSITE', url: 'http://bar.example' }] } }).success).toBe(false);
    expect(AdminBarDetailsBody.safeParse({ info: { links: [{ type: 'WEBSITE', url: 'https://bar.example' }] } }).success).toBe(true);
    const menu = AdminBarDetailsBody.parse({ menu: [{ id: 'new-1', category: 'อาหาร', name: 'เฟรนช์ฟรายส์', price: 120, available: true, image_path: 'x/y.webp' }] });
    expect(menu.menu?.[0]).not.toHaveProperty('image_path');
    expect(AdminBarDetailsBody.safeParse({ menu: [{ category: '', name: 'x', price: -1, available: true }] }).success).toBe(false);
    expect(ERROR_MESSAGES.INVALID_BAR_DETAILS).toBeTruthy();
    expect(ERROR_MESSAGES.INVALID_STYLE).toBeTruthy();
  });

  it('RankingQuery: defaults WEEKLY / 10 · limit coerces · only WEEKLY | MONTHLY', () => {
    expect(RankingQuery.parse({})).toEqual({ period: 'WEEKLY', limit: 10 });
    expect(RankingQuery.parse({ limit: '3', period: 'MONTHLY', category: 'CHILL' })).toEqual({ period: 'MONTHLY', limit: 3, category: 'CHILL' });
    expect(RankingQuery.safeParse({ period: 'YEARLY' }).success).toBe(false);
    expect(RankingQuery.safeParse({ limit: 51 }).success).toBe(false);
    expect(RankingQuery.safeParse({ category: 'NIGHTCLUB' }).success).toBe(false);
  });

  it('Backoffice registry: new views + districts master table', () => {
    for (const v of ['admin_bar_details', 'admin_styles', 'admin_ranking', 'admin_bar_areas'] as const) expect(ADMIN_VIEWS).toContain(v);
    expect(ADMIN_MASTER_TABLES).toContain('districts');
  });
});

describe('payment', () => {
  it('MockCompleteBody: PAID / FAILED only', () => {
    expect(MockCompleteBody.parse({ outcome: 'PAID' })).toEqual({ outcome: 'PAID' });
    expect(MockCompleteBody.safeParse({ outcome: 'FAILED' }).success).toBe(true);
    expect(MockCompleteBody.safeParse({ outcome: 'X' }).success).toBe(false);
    expect(MockCompleteBody.safeParse({}).success).toBe(false);
  });

  it('MarkPaymentRefundedBody: note ≥ 3 chars (trimmed) · optional refund_ref', () => {
    expect(MarkPaymentRefundedBody.safeParse({ note: 'ab' }).success).toBe(false);
    expect(MarkPaymentRefundedBody.safeParse({ note: '  ab  ' }).success).toBe(false);
    expect(MarkPaymentRefundedBody.parse({ note: '  คืนผ่าน dashboard  ' })).toEqual({ note: 'คืนผ่าน dashboard' });
    expect(MarkPaymentRefundedBody.parse({ note: 'คืนผ่าน dashboard', refund_ref: ' R-1 ' }).refund_ref).toBe('R-1');
    expect(MarkPaymentRefundedBody.safeParse({ note: 'คืนผ่าน dashboard', refund_ref: 'x'.repeat(121) }).success).toBe(false);
  });

  it('error messages: payment + slip-flow codes are Thai', () => {
    expect(ERROR_MESSAGES.PAYMENT_WINDOW_CLOSED).toBeTruthy();
    expect(ERROR_MESSAGES.SLIP_FLOW_DISABLED).toBeTruthy();
    for (const code of Object.keys(PAYMENT_ERRORS)) expect(ERROR_MESSAGES[code]).toBe(PAYMENT_ERRORS[code as keyof typeof PAYMENT_ERRORS]);
    expect(errorMessageOf('PAYMENT_SIGNATURE_INVALID')).toMatch(/[\u0E00-\u0E7F]/);
    expect(errorMessageOf('PAYMENT_SIGNATURE_INVALID')).not.toBe('PAYMENT_SIGNATURE_INVALID');
  });

  it('Backoffice registry: payment views for Admin + Super Admin', () => {
    for (const v of ['admin_payment_intents', 'admin_payment_unmatched'] as const) {
      expect(ADMIN_VIEWS).toContain(v);
      expect(SUPER_ADMIN_VIEWS as readonly string[]).not.toContain(v);
    }
  });
});

describe('table board', () => {
  it('TableBoardQuery: night is optional and must be YYYY-MM-DD', () => {
    expect(TableBoardQuery.safeParse({}).success).toBe(true);
    expect(TableBoardQuery.parse({ night: '2026-10-16' }).night).toBe('2026-10-16');
    expect(TableBoardQuery.safeParse({ night: '16/10/2026' }).success).toBe(false);
  });
  it('TableOccupancyBody: in_use required · pax 1–50 integer · note ≤ 100 (trimmed)', () => {
    expect(TableOccupancyBody.safeParse({ in_use: true }).success).toBe(true);
    expect(TableOccupancyBody.safeParse({ in_use: false, pax: null, note: null }).success).toBe(true);
    expect(TableOccupancyBody.parse({ in_use: true, pax: 4, note: '  โต๊ะริมหน้าต่าง  ' }).note).toBe('โต๊ะริมหน้าต่าง');
    expect(TableOccupancyBody.safeParse({ in_use: true, pax: 0 }).success).toBe(false);
    expect(TableOccupancyBody.safeParse({ in_use: true, pax: 51 }).success).toBe(false);
    expect(TableOccupancyBody.safeParse({ in_use: true, pax: 2.5 }).success).toBe(false);
    expect(TableOccupancyBody.safeParse({ in_use: true, note: 'ก'.repeat(101) }).success).toBe(false);
    expect(TableOccupancyBody.safeParse({ pax: 2 }).success).toBe(false);
  });
  it('has Thai messages for the board error codes', () => {
    for (const code of ['TABLE_NOT_ON_BOARD', 'TABLE_ALREADY_IN_USE', 'TABLE_NOT_IN_USE', 'TABLE_HAS_GUEST'] as const) {
      expect(ERROR_MESSAGES[code]).toContain('โต๊ะ');
      expect(BOOKING_ERRORS[code]).toBe(ERROR_MESSAGES[code]);
    }
  });
});

describe('mini-ads (Native Mini-Ads · Backoffice /mini-ads)', () => {
  const body = {
    advertiser_name: 'Grab',
    title: 'กลับบ้านปลอดภัย',
    image_url: 'https://x.supabase.co/storage/v1/object/public/site-media/ads/0b9c.webp',
    link_url: 'https://brand.co/x?y=1',
    placements: ['HOME'],
    starts_at: '2026-10-15T00:00:00+07:00',
    ends_at: '2026-11-15T00:00:00+07:00',
    confirm_no_alcohol: true,
  };
  const ok = (b: object) => MiniAdBody.safeParse(b).success;

  it('create: minimal body gets defaults', () => {
    expect(MiniAdBody.parse(body)).toMatchObject({ description: '', cta_label: 'ดูเพิ่มเติม', active: true });
  });
  it('create: confirm_no_alcohol must be true (Thai ม.32 message)', () => {
    const noConfirm: Partial<typeof body> = { ...body };
    delete noConfirm.confirm_no_alcohol;
    for (const b of [noConfirm, { ...body, confirm_no_alcohol: false }]) {
      const r = MiniAdBody.safeParse(b);
      expect(r.success).toBe(false);
      expect(r.error?.issues.some((i) => i.message.includes('ม.32'))).toBe(true);
    }
  });
  it('create: link_url = https:// or same-site /path only', () => {
    for (const link_url of ['javascript:alert(1)', 'http://x.com', '//evil.com', '/\\evil.com']) expect(ok({ ...body, link_url }), link_url).toBe(false);
    for (const link_url of ['/bars/abc', '/', 'https://brand.co/x?y=1']) expect(ok({ ...body, link_url }), link_url).toBe(true);
  });
  it('create: image_url = site-media/ads/ upload or /images/… only', () => {
    for (const image_url of [
      'data:image/png;base64,x',
      'https://evil.example/pixel.gif',
      'https://x.supabase.co/storage/v1/object/public/site-media/home/hero/a.webp',
    ])
      expect(ok({ ...body, image_url }), image_url).toBe(false);
    for (const image_url of [
      'https://x.supabase.co/storage/v1/object/public/site-media/ads/0b9c.webp',
      'http://127.0.0.1:54321/storage/v1/object/public/site-media/ads/a.webp',
      '/images/bars/placeholder.webp',
    ])
      expect(ok({ ...body, image_url }), image_url).toBe(true);
  });
  it('create: placements 1–2 without duplicates · period > 0 and ≤ 366 days', () => {
    expect(ok({ ...body, placements: [] })).toBe(false);
    expect(ok({ ...body, placements: ['HOME', 'HOME'] })).toBe(false);
    expect(ok({ ...body, placements: ['HOME', 'SEARCH'] })).toBe(true);
    expect(ok({ ...body, ends_at: body.starts_at })).toBe(false);
    expect(ok({ ...body, ends_at: '2026-10-14T00:00:00+07:00' })).toBe(false);
    expect(ok({ ...body, ends_at: '2027-10-17T00:00:00+07:00' })).toBe(false);
  });
  it('update: partial, no injected defaults · needs a non-confirm field', () => {
    expect(UpdateMiniAdBody.parse({ active: false })).toEqual({ active: false });
    expect(UpdateMiniAdBody.safeParse({}).success).toBe(false);
    expect(UpdateMiniAdBody.safeParse({ confirm_no_alcohol: true }).success).toBe(false);
    expect(UpdateMiniAdBody.safeParse({ title: 'x', confirm_no_alcohol: true }).success).toBe(true);
    expect(UpdateMiniAdBody.safeParse({ ends_at: '2026-12-01T00:00:00+07:00' }).success).toBe(true);
    expect(UpdateMiniAdBody.safeParse({ starts_at: body.ends_at, ends_at: body.starts_at }).success).toBe(false);
  });
  it('public query + track body', () => {
    expect(MiniAdsQuery.safeParse({ placement: 'MAP' }).success).toBe(false);
    expect(MiniAdsQuery.safeParse({ placement: 'SEARCH' }).success).toBe(true);
    expect(TrackMiniAdBody.safeParse({ event: 'VIEW', placement: 'HOME' }).success).toBe(false);
    expect(TrackMiniAdBody.safeParse({ event: 'CLICK', placement: 'HOME' }).success).toBe(true);
  });
  it('Backoffice view (any admin) + errors', () => {
    expect(ADMIN_VIEWS).toContain('admin_mini_ads');
    expect(SUPER_ADMIN_VIEWS as readonly string[]).not.toContain('admin_mini_ads');
    expect(errorMessageOf('MINI_AD_NOT_FOUND')).toBe(MINI_ADS_ERRORS.MINI_AD_NOT_FOUND);
    for (const code of Object.keys(MINI_ADS_ERRORS) as (keyof typeof MINI_ADS_ERRORS)[]) {
      expect(ERROR_MESSAGES[code], code).toBe(MINI_ADS_ERRORS[code]);
      expect(errorMessageOf(`P0001: ${code}`), code).toBe(MINI_ADS_ERRORS[code]);
    }
  });
});

describe('sales stats (ยอดขายเฉลี่ย · /merchant/analytics)', () => {
  it('days defaults to 30 and coerces query strings', () => {
    expect(SalesStatsQuery.parse({})).toEqual({ days: 30 });
    expect(SalesStatsQuery.parse({ days: '7' }).days).toBe(7);
    expect(SalesStatsQuery.parse({ days: 366 }).days).toBe(366);
  });
  it('rejects out-of-range / non-integer days', () => {
    for (const days of [0, 367, 'abc', 1.5, -1]) expect(SalesStatsQuery.safeParse({ days }).success, String(days)).toBe(false);
  });
  it('INVALID_STATS_RANGE has a Thai message', () => {
    expect(BOOKING_ERRORS.INVALID_STATS_RANGE).toBe('ช่วงเวลาของสถิติไม่ถูกต้อง (1–366 วัน)');
    expect(ERROR_MESSAGES.INVALID_STATS_RANGE).toBe(BOOKING_ERRORS.INVALID_STATS_RANGE);
  });
});

describe('team forfeit (ทีมร้านกดปลดโต๊ะเอง · คอมเมนต์ #76)', () => {
  it('BOOKING_NOT_OVERDUE has a Thai message without placeholders', () => {
    expect(BOOKING_ERRORS.BOOKING_NOT_OVERDUE).toBe('ยังไม่เลยเวลาเก็บโต๊ะ — ปลดโต๊ะได้เมื่อเลยเวลาที่เก็บโต๊ะแล้ว');
    expect(ERROR_MESSAGES.BOOKING_NOT_OVERDUE).toBe(BOOKING_ERRORS.BOOKING_NOT_OVERDUE);
  });
  it('TeamForfeitResult is { id, status: NO_SHOW }', () => {
    const r: TeamForfeitResult = { id: 'b1', status: 'NO_SHOW' };
    expect(r.status).toBe('NO_SHOW');
  });
});

describe('สมัครด้วย Google / Facebook (REQUIREMENTS ข้อ 3)', () => {
  it('verify รับ provider_token หรือไม่ส่งก็ได้ (ยืนยันไว้แล้ว)', () => {
    expect(OAuthSignupVerifyBody.safeParse({ provider_token: 'ya29.a0AfH6SMB' }).success).toBe(true);
    expect(OAuthSignupVerifyBody.safeParse({}).success).toBe(true);
    expect(OAuthSignupVerifyBody.safeParse({ provider_token: 'short' }).success).toBe(false);
  });
  it('complete ต้องติ๊กยอมรับเงื่อนไข (accept_terms = true)', () => {
    expect(OAuthSignupCompleteBody.safeParse({ accept_terms: true, display_name: ' มิว ' }).data?.display_name).toBe('มิว');
    expect(OAuthSignupCompleteBody.safeParse({ accept_terms: false }).success).toBe(false);
    expect(OAuthSignupCompleteBody.safeParse({}).success).toBe(false);
  });
  it('รหัส error ใหม่มีข้อความไทยใน ERROR_MESSAGES', () => {
    for (const code of ['OAUTH_BIRTHDATE_MISSING', 'OAUTH_AGE_UNDER_20', 'OAUTH_RELOGIN_REQUIRED', 'OAUTH_TOKEN_MISMATCH'] as const) {
      expect(ERROR_MESSAGES[code]).toBe(ACCOUNT_ERRORS[code]);
    }
  });
});

describe('areas (พื้นที่จากหมุด)', () => {
  it('AreaAtPointQuery coerces query strings and rejects out-of-range', () => {
    expect(AreaAtPointQuery.parse({ lat: '13.7305', lng: '100.581' })).toEqual({ lat: 13.7305, lng: 100.581 });
    expect(AreaAtPointQuery.safeParse({ lat: 91, lng: 100 }).success).toBe(false);
    expect(AreaAtPointQuery.safeParse({ lat: 13 }).success).toBe(false);
  });
  it('shop forms no longer carry district_id (DB derives it from the pin)', () => {
    expect('district_id' in BarInfoBody.shape).toBe(false);
    expect(BarInfoBody.parse({ name: 'ร้าน', district_id: '00000000-0000-0000-0000-000000000000' })).toEqual({ name: 'ร้าน' });
    expect(MerchantJoinBody.safeParse({}).success).toBe(false);
  });
});

describe('tambon search', () => {
  it('accepts q (≥ 2 chars) or code, not both or neither', () => {
    expect(TambonSearchQuery.parse({ q: ' คลองตัน ' })).toEqual({ q: 'คลองตัน' });
    expect(TambonSearchQuery.parse({ code: 'TH103902' })).toEqual({ code: 'TH103902' });
    expect(TambonSearchQuery.safeParse({ q: 'ก' }).success).toBe(false);
    expect(TambonSearchQuery.safeParse({}).success).toBe(false);
    expect(TambonSearchQuery.safeParse({ q: 'คลอง', code: 'TH103902' }).success).toBe(false);
    expect(TambonSearchQuery.safeParse({ code: 'TH1039' }).success).toBe(false);
  });
});
