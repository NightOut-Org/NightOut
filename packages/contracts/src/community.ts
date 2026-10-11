import { z } from 'zod';
import { objectPath, text, uuid } from './common';

/** โดเมน community — ชุมชน/กระทู้ · ความคิดเห็น · ถูกใจ · บันทึก · ปักหมุดส่วนตัว · ฉบับร่าง · รายงาน · แอดมินจัดการ */

/** ปักหมุดส่วนตัวได้พร้อมกันกี่กระทู้ (DB ตรวจซ้ำใน app_community_set_pin) */
export const COMMUNITY_PIN_MAX = 3;
/** ร่างเก็บไว้กี่วัน (DB ไม่คืนร่างที่เก่ากว่านี้ และลบทิ้งตอนบันทึกร่างครั้งถัดไป) */
export const COMMUNITY_DRAFT_TTL_DAYS = 7;
export const COMMUNITY_TITLE_MAX = 120;
export const COMMUNITY_BODY_MAX = 5000;
export const COMMUNITY_COMMENT_MAX = 2000;
/** ไฟล์แนบต่อกระทู้/ความเห็น (กติกาเดียวกับรีวิว — DB ตรวจซ้ำใน community_media_norm) */
export const COMMUNITY_MEDIA_LIMITS = { maxFiles: 6, imageMB: 15, videoMB: 60, videoSeconds: 60 } as const;

/** ไฟล์ 1 ชิ้น (อัปโหลดเข้า bucket community-media/<user_id>/… ก่อน แล้วส่ง path) */
export const CommunityMediaItem = z.object({
  path: objectPath,
  kind: z.enum(['IMAGE', 'VIDEO']),
  thumb_path: objectPath.nullish().describe('ภาพปกวิดีโอ'),
  duration_sec: z.number().min(0).max(COMMUNITY_MEDIA_LIMITS.videoSeconds + 0.5).nullish(),
  size_bytes: z.number().int().min(0).max(COMMUNITY_MEDIA_LIMITS.videoMB * 1024 * 1024).nullish(),
});
export type CommunityMediaItem = z.infer<typeof CommunityMediaItem>;
const mediaList = z.array(CommunityMediaItem).max(COMMUNITY_MEDIA_LIMITS.maxFiles, `แนบได้สูงสุด ${COMMUNITY_MEDIA_LIMITS.maxFiles} ไฟล์`);

export const CommunitySort = z.enum(['latest', 'popular', 'unanswered']);
export type CommunitySort = z.infer<typeof CommunitySort>;
export const CommunityScope = z.enum(['mine', 'saved', 'pinned']);
export type CommunityScope = z.infer<typeof CommunityScope>;

const categorySlug = z.string().regex(/^[a-z][a-z0-9-]{1,30}$/, 'หมวดไม่ถูกต้อง');

/** GET /public/community/threads */
export const CommunityFeedQuery = z.object({
  category: categorySlug.optional(),
  sort: CommunitySort.default('latest'),
  q: text(80).optional(),
  bar_id: uuid.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});
export type CommunityFeedQuery = z.input<typeof CommunityFeedQuery>;

/** GET /me/community/threads */
export const MyCommunityFeedQuery = CommunityFeedQuery.extend({ scope: CommunityScope });
export type MyCommunityFeedQuery = z.input<typeof MyCommunityFeedQuery>;

/** POST /community/threads · PATCH /community/threads/:id */
export const CommunityThreadBody = z.object({
  category: categorySlug,
  title: z.string().trim().min(3, 'หัวข้ออย่างน้อย 3 ตัวอักษร').max(COMMUNITY_TITLE_MAX),
  body: z.string().trim().max(COMMUNITY_BODY_MAX).default(''),
  bar_id: uuid.nullish(),
  media: mediaList.default([]).describe('ไฟล์ทั้งชุดของกระทู้ (แก้กระทู้ = แทนที่ทั้งชุด)'),
});
export type CommunityThreadBody = z.input<typeof CommunityThreadBody>;

/** POST /community/threads/:id/comments */
export const CommunityCommentBody = z
  .object({
    body: z.string().trim().max(COMMUNITY_COMMENT_MAX).default(''),
    parent_id: uuid.nullish().describe('ตอบความเห็นไหน (ไม่ใส่ = ตอบกระทู้)'),
    media: mediaList.default([]),
  })
  .refine((b) => b.body.length > 0 || b.media.length > 0, { message: 'พิมพ์ความคิดเห็นหรือแนบไฟล์ก่อนส่ง', path: ['body'] });
export type CommunityCommentBody = z.input<typeof CommunityCommentBody>;

/** PUT /community/threads/:id/like · /save · /pin · PUT /community/comments/:id/like */
export const CommunityToggleBody = z.object({ on: z.boolean() });
export type CommunityToggleBody = z.infer<typeof CommunityToggleBody>;

export const CommunityReportReason = z.enum(['SPAM', 'OFFENSIVE', 'ADVERTISING', 'PRIVACY', 'OTHER']);
export type CommunityReportReason = z.infer<typeof CommunityReportReason>;

/** POST /community/reports — ระบุ thread_id หรือ comment_id อย่างใดอย่างหนึ่ง */
export const CommunityReportBody = z
  .object({
    thread_id: uuid.optional(),
    comment_id: uuid.optional(),
    reason: CommunityReportReason,
    detail: text(300).nullish(),
  })
  .refine((b) => !!b.thread_id !== !!b.comment_id, { message: 'ระบุกระทู้หรือความคิดเห็นอย่างใดอย่างหนึ่ง', path: ['thread_id'] });
export type CommunityReportBody = z.infer<typeof CommunityReportBody>;

// ---------------------------------------------------------------------
// ฉบับร่าง
// ---------------------------------------------------------------------
/** NEW = ตั้งกระทู้ใหม่ (1 ร่างต่อบัญชี) · REPLY = ตอบกระทู้ (1 ร่างต่อกระทู้) · EDIT = แก้กระทู้ (1 ร่างต่อกระทู้) */
export const CommunityDraftKind = z.enum(['NEW', 'REPLY', 'EDIT']);
export type CommunityDraftKind = z.infer<typeof CommunityDraftKind>;

/** ช่องในฟอร์มที่เก็บไว้ (ไม่ตรวจความยาวขั้นต่ำ — ร่างยังพิมพ์ไม่เสร็จได้) */
export const CommunityDraftPayload = z.object({
  category: categorySlug.nullish(),
  title: z.string().max(COMMUNITY_TITLE_MAX).nullish(),
  body: z.string().max(COMMUNITY_BODY_MAX).nullish(),
  bar_id: uuid.nullish(),
  parent_id: uuid.nullish(),
  media: mediaList.nullish(),
});
export type CommunityDraftPayload = z.infer<typeof CommunityDraftPayload>;

/** PUT /me/community/drafts */
export const SaveCommunityDraftBody = z
  .object({ kind: CommunityDraftKind, thread_id: uuid.nullish(), payload: CommunityDraftPayload })
  .refine((b) => (b.kind === 'NEW') === !b.thread_id, { message: 'ร่างกระทู้ใหม่ไม่มี thread_id · ร่างตอบ/แก้ต้องมี', path: ['thread_id'] });
export type SaveCommunityDraftBody = z.infer<typeof SaveCommunityDraftBody>;

/** DELETE /me/community/drafts/:kind?thread_id= */
export const DeleteCommunityDraftQuery = z.object({ thread_id: uuid.optional() });
export type DeleteCommunityDraftQuery = z.infer<typeof DeleteCommunityDraftQuery>;

// ---------------------------------------------------------------------
// Backoffice
// ---------------------------------------------------------------------
/** POST /admin/community/threads/:id/moderate · /admin/community/comments/:id/moderate */
export const ModerateCommunityBody = z.object({
  action: z.enum(['KEEP', 'HIDE', 'REMOVE', 'RESTORE']),
  reason: z.string().trim().min(1).max(500).optional(),
});
export type ModerateCommunityBody = z.infer<typeof ModerateCommunityBody>;

// ---------------------------------------------------------------------
// response
// ---------------------------------------------------------------------
export type CommunityStatus = 'PUBLISHED' | 'HIDDEN' | 'REMOVED' | 'DELETED';

export interface CommunityCategory {
  slug: string;
  name: string;
  sort_order: number;
  /** ตั้งกระทู้ได้เฉพาะทีม NightOut (เช่น ประกาศ) */
  staff_only: boolean;
  thread_count: number;
}

export interface CommunityAuthor {
  id: string;
  name: string;
  /** ทีม NightOut (บัญชีที่เข้า Backoffice ได้) */
  is_staff: boolean;
}

export interface CommunityBarRef {
  id: string;
  slug: string;
  name: string;
}

export interface CommunityThreadSummary {
  id: string;
  title: string;
  excerpt: string;
  category: string;
  category_name: string;
  author: CommunityAuthor;
  bar: CommunityBarRef | null;
  status: CommunityStatus;
  reply_count: number;
  like_count: number;
  view_count: number;
  created_at: string;
  last_activity_at: string;
  edited_at: string | null;
  is_mine: boolean;
  /** ฉันปักหมุดไว้ (เห็นเฉพาะเจ้าของหมุด) */
  is_pinned: boolean;
  is_saved: boolean;
  is_liked: boolean;
}

export interface CommunityFeedResult {
  items: CommunityThreadSummary[];
  has_more: boolean;
}

/** ไฟล์แนบที่หน้าเว็บแสดง — url / thumb_url = signed URL ที่ backend ขอในนามผู้เรียก (null = ไม่มีสิทธิ์/ไม่พบไฟล์) */
export interface CommunityMedia {
  id: string;
  kind: 'IMAGE' | 'VIDEO';
  path: string;
  thumb_path: string | null;
  duration_sec: number | null;
  url: string | null;
  thumb_url: string | null;
}

export interface CommunityComment {
  id: string;
  parent_id: string | null;
  body: string;
  author: CommunityAuthor;
  like_count: number;
  created_at: string;
  is_mine: boolean;
  is_liked: boolean;
  media: CommunityMedia[];
}

export interface CommunityThreadDetail extends CommunityThreadSummary {
  body: string;
  media: CommunityMedia[];
  /** ความเห็นทั้งหมดเรียงตามเวลา (แบน — parent_id ชี้ความเห็นหลัก) */
  comments: CommunityComment[];
}

export interface CommunityTrendingBar extends CommunityBarRef {
  thread_count: number;
}

export interface CommunityDraft {
  id: string;
  kind: CommunityDraftKind;
  thread_id: string | null;
  payload: CommunityDraftPayload;
  updated_at: string;
}

export interface CreateCommunityThreadResult {
  id: string;
}
export interface AddCommunityCommentResult {
  id: string;
  thread_id: string;
  parent_id: string | null;
}
export interface CommunityLikeResult {
  liked: boolean;
  like_count: number;
}
export interface CommunityPinResult {
  thread_id: string;
  pinned: boolean;
  pin_count: number;
}
export interface CommunitySaveResult {
  thread_id: string;
  saved: boolean;
}

export const COMMUNITY_ERRORS = {
  THREAD_NOT_FOUND: 'ไม่พบกระทู้นี้ หรือกระทู้ถูกลบไปแล้ว',
  COMMENT_NOT_FOUND: 'ไม่พบความคิดเห็นนี้ หรือถูกลบไปแล้ว',
  NOT_THREAD_OWNER: 'แก้หรือลบได้เฉพาะกระทู้ของตัวเอง',
  NOT_COMMENT_OWNER: 'ลบได้เฉพาะความคิดเห็นของตัวเอง',
  NOT_AUTHENTICATED: 'เข้าสู่ระบบก่อน',
  COMMUNITY_BANNED: 'บัญชีนี้ถูกระงับ ตั้งกระทู้หรือแสดงความคิดเห็นไม่ได้',
  COMMUNITY_CATEGORY_STAFF_ONLY: 'หมวดนี้ตั้งกระทู้ได้เฉพาะทีม NightOut',
  INVALID_COMMUNITY_CATEGORY: 'เลือกหมวดหมู่ก่อนโพสต์',
  INVALID_COMMUNITY_THREAD: 'หัวข้อ 3–120 ตัวอักษร และรายละเอียดไม่เกิน 5,000 ตัวอักษร',
  INVALID_COMMUNITY_COMMENT: 'พิมพ์ความคิดเห็น (ไม่เกิน 2,000 ตัวอักษร) หรือแนบรูป/วิดีโอก่อนส่ง',
  INVALID_COMMUNITY_MEDIA: 'ไฟล์แนบไม่ถูกต้อง — แนบได้สูงสุด 6 ไฟล์ วิดีโอไม่เกิน 60 วินาที และต้องอัปโหลดเสร็จก่อน',
  INVALID_COMMUNITY_QUERY: 'ตัวกรองกระทู้ไม่ถูกต้อง',
  INVALID_COMMUNITY_REPORT: 'ระบุกระทู้หรือความคิดเห็นที่จะรายงาน',
  INVALID_COMMUNITY_DRAFT: 'บันทึกร่างไม่สำเร็จ — ข้อมูลร่างไม่ถูกต้อง',
  INVALID_COMMUNITY_MODERATION: 'คำสั่งจัดการกระทู้ไม่ถูกต้อง',
  COMMUNITY_PIN_LIMIT: `ปักหมุดได้สูงสุด ${COMMUNITY_PIN_MAX} กระทู้ — เลิกปักกระทู้อื่นก่อน`,
} as const satisfies Record<string, string>;
