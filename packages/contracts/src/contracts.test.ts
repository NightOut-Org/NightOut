import { describe, expect, it } from 'vitest';
import { CreateBookingBody, ERROR_MESSAGES, errorMessageOf, ReviewDepositBody, SaveTeamPageBody, TeamMemberBody, UpdateTeamMemberBody } from './index';
import { canCreateRole, CreateUserBody } from './account';
import { SaveHomePageBody, UpdateHomeCategoryBody, UpdateHomeContentBody, UpdateHomePopularBody } from './site-content';
import { SetUsersRoleBody } from './account';
import { AdminBarMediaBody, BAR_GALLERY_MAX, BarMediaBody, BarStoreBody, MenuBody, PromotionsPageBody, SaveSafetyBody, SettingsPageBody, SetBarsStatusBody } from './bar';
import { PUBLIC_BUCKETS, UploadBucket } from './storage';
import { CommunityCommentBody, CommunityFeedQuery, CommunityReportBody, CommunityThreadBody, MyCommunityFeedQuery, SaveCommunityDraftBody } from './community';

describe('booking', () => {
  const base = {
    bar_id: '96e5917b-2acc-5f7f-b4ca-fc9a3b00f07d',
    zone_id: '786b8848-090f-50da-b21a-90cc60073677',
    datetime: '2026-10-10T21:00:00+07:00',
    pax: 2,
  };
  const terms = { accepted: true as const, terms_version: 'deposit-v1', terms_text: 'ฉันได้อ่านและยอมรับเงื่อนไขมัดจำ ฿500' };
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

describe('save page: home page · merchant settings', () => {
  it('home page: content and/or changed category cards (unique slots) and/or popular', () => {
    expect(SaveHomePageBody.safeParse({ content: { hero_title_lead: 'คืนนี้ไป' } }).success).toBe(true);
    expect(SaveHomePageBody.safeParse({ categories: [{ slot: 'pub', title: 'ผับ' }] }).success).toBe(true);
    expect(SaveHomePageBody.safeParse({ popular: { bar_ids: [] } }).success).toBe(true);
    expect(SaveHomePageBody.safeParse({ categories: [{ slot: 'nope', title: 'x' }] }).success).toBe(false);
    expect(SaveHomePageBody.safeParse({ categories: [{ slot: 'pub' }, { slot: 'pub' }] }).success).toBe(false);
    expect(SaveHomePageBody.safeParse({ categories: [] }).success).toBe(false);
    expect(SaveHomePageBody.safeParse({}).success).toBe(false);
  });
  it('settings: booking and/or payout (at least one)', () => {
    expect(SettingsPageBody.safeParse({ booking: { grace_minutes: 30 } }).success).toBe(true);
    expect(SettingsPageBody.safeParse({ payout: { bank_code: 'กสิกรไทย', account_name: 'ร้าน', account_no: '1234567890' } }).success).toBe(true);
    expect(SettingsPageBody.safeParse({ booking: { grace_minutes: 20 } }).success).toBe(false);
    expect(SettingsPageBody.safeParse({}).success).toBe(false);
  });
});

describe('site-content', () => {
  it('partial update keeps only sent fields', () => {
    expect(UpdateHomeContentBody.parse({ categories_title: ' คืนนี้อยากได้ฟีลไหน ' })).toEqual({ categories_title: 'คืนนี้อยากได้ฟีลไหน' });
    expect(UpdateHomeContentBody.parse({ hero_image_url: null })).toEqual({ hero_image_url: null });
  });
  it('rejects unsafe images and external links', () => {
    expect(UpdateHomeCategoryBody.safeParse({ image_url: 'javascript:alert(1)' }).success).toBe(false);
    expect(UpdateHomeCategoryBody.safeParse({ link_to: 'https://evil.example' }).success).toBe(false);
    expect(UpdateHomeCategoryBody.safeParse({ link_to: '//evil.example' }).success).toBe(false);
    expect(UpdateHomeCategoryBody.safeParse({ title: '' }).success).toBe(false);
    expect(UpdateHomeCategoryBody.safeParse({ link_to: '/search?style=Rooftop' }).success).toBe(true);
  });
  it('popular bars: up to 8 unique uuids', () => {
    const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
    expect(UpdateHomePopularBody.safeParse({ bar_ids: [] }).success).toBe(true);
    expect(UpdateHomePopularBody.safeParse({ bar_ids: [1, 2, 3, 4, 5, 6, 7, 8].map(id) }).success).toBe(true);
    expect(UpdateHomePopularBody.safeParse({ bar_ids: [1, 2, 3, 4, 5, 6, 7, 8, 9].map(id) }).success).toBe(false);
    expect(UpdateHomePopularBody.safeParse({ bar_ids: [id(1), id(1)] }).success).toBe(false);
    expect(UpdateHomePopularBody.safeParse({ bar_ids: ['not-a-uuid'] }).success).toBe(false);
    expect(UpdateHomeContentBody.safeParse({ popular_title: ' ' }).success).toBe(false);
  });
});

describe('account', () => {
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
    expect(Object.keys(ERROR_MESSAGES).length).toBeGreaterThan(70);
  });

  it('errorMessageOf: exact code → embedded code → unknown stays as-is', () => {
    expect(errorMessageOf('ZONE_FULL')).toBe(ERROR_MESSAGES.ZONE_FULL);
    expect(errorMessageOf('SUPABASE_UNREACHABLE: fetch failed')).toBe(ERROR_MESSAGES.SUPABASE_UNREACHABLE);
    expect(errorMessageOf('SOMETHING_NEW')).toBe('SOMETHING_NEW');
  });
});
