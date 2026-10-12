import type * as C from '@nightout/contracts';
import { Rest } from '@nightout/utils/rest';
import { useQuery } from '@tanstack/react-query';

/** API ของหน้าอ่านกระทู้ (/community/t/:id) · backend: domains/community */

/** GET /public/community/threads/:id · key มี userId เพราะ is_liked / is_pinned เป็นของแต่ละคน */
export const useThread = (id: string, userId: string | null) =>
  useQuery({
    queryKey: ['community', 'thread', id, userId],
    queryFn: () => Rest.get<C.CommunityThreadDetail>(`/public/community/threads/${id}`),
  });

/** GET /public/community/threads — กระทู้อื่นในหมวดเดียวกัน (คอลัมน์ขวา) */
export const useRelatedThreads = (category: string | undefined) =>
  useQuery({
    queryKey: ['community', 'related', category],
    queryFn: () =>
      Rest.get<C.CommunityFeedResult>('/public/community/threads', {
        params: { category, sort: 'popular', limit: 6 } satisfies C.CommunityFeedQuery,
      }),
    enabled: !!category,
    staleTime: 60_000,
  });

/** GET /me/community/drafts — โหลดใหม่ทุกครั้งที่เปิดกระทู้ (ร่างตอบอาจพิมพ์ต่อจากเครื่องอื่น) */
export const useMyDrafts = (enabled: boolean) =>
  useQuery({
    queryKey: ['community', 'drafts'],
    queryFn: () => Rest.get<C.CommunityDraft[]>('/me/community/drafts'),
    enabled,
    refetchOnMount: 'always',
  });

/** POST /public/community/threads/:id/view */
export const addView = (id: string) => Rest.post(`/public/community/threads/${id}/view`);

/** POST /community/threads/:id/comments */
export const addComment = (threadId: string, body: C.CommunityCommentBody) =>
  Rest.post<C.AddCommunityCommentResult>(
    `/community/threads/${threadId}/comments`,
    body satisfies C.CommunityCommentBody,
  );

/** PATCH /community/comments/:id — แก้ความเห็นของตัวเอง (ข้อความ + ไฟล์ทั้งชุด) */
export const updateComment = (id: string, body: C.UpdateCommunityCommentBody) =>
  Rest.patch<C.UpdateCommunityCommentResult>(
    `/community/comments/${id}`,
    body satisfies C.UpdateCommunityCommentBody,
  );

/** GET /public/community/{threads|comments}/:id/history — ประวัติการแก้ไข (ใหม่สุดก่อน) */
export const useHistory = (target: { kind: 'thread' | 'comment'; id: string } | null) =>
  useQuery({
    queryKey: ['community', 'history', target?.kind, target?.id],
    queryFn: () =>
      Rest.get<C.CommunityRevision[]>(`/public/community/${target!.kind}s/${target!.id}/history`),
    enabled: !!target,
  });

/** DELETE /community/comments/:id */
export const deleteComment = (id: string) => Rest.delete(`/community/comments/${id}`);

/** DELETE /community/threads/:id */
export const deleteThread = (id: string) => Rest.delete(`/community/threads/${id}`);

/** PUT /community/threads/:id/like */
export const setThreadLike = (id: string, on: boolean) =>
  Rest.put<C.CommunityLikeResult>(`/community/threads/${id}/like`, {
    on,
  } satisfies C.CommunityToggleBody);

/** PUT /community/comments/:id/like */
export const setCommentLike = (id: string, on: boolean) =>
  Rest.put<C.CommunityLikeResult>(`/community/comments/${id}/like`, {
    on,
  } satisfies C.CommunityToggleBody);

/** PUT /community/threads/:id/save */
export const setSave = (id: string, on: boolean) =>
  Rest.put<C.CommunitySaveResult>(`/community/threads/${id}/save`, {
    on,
  } satisfies C.CommunityToggleBody);

/** PUT /community/threads/:id/pin — ปักหมุดส่วนตัว */
export const setPin = (id: string, on: boolean) =>
  Rest.put<C.CommunityPinResult>(`/community/threads/${id}/pin`, {
    on,
  } satisfies C.CommunityToggleBody);

/** POST /community/reports */
export const report = (body: C.CommunityReportBody) =>
  Rest.post('/community/reports', body satisfies C.CommunityReportBody);

/** PUT /me/community/drafts — ร่างตอบกระทู้ */
export const saveReplyDraft = (threadId: string, payload: C.CommunityDraftPayload) =>
  Rest.put<C.CommunityDraft>('/me/community/drafts', {
    kind: 'REPLY',
    thread_id: threadId,
    payload,
  } satisfies C.SaveCommunityDraftBody);

/** DELETE /me/community/drafts/REPLY?thread_id= */
export const deleteReplyDraft = (threadId: string) =>
  Rest.delete('/me/community/drafts/REPLY', {
    params: { thread_id: threadId } satisfies C.DeleteCommunityDraftQuery,
  });

/** PUT /me/community/drafts — ร่างแก้ความเห็น (1 ร่างต่อกระทู้ · payload.comment_id) */
export const saveCommentEditDraft = (threadId: string, payload: C.CommunityDraftPayload) =>
  Rest.put<C.CommunityDraft>('/me/community/drafts', {
    kind: 'EDIT_COMMENT',
    thread_id: threadId,
    payload,
  } satisfies C.SaveCommunityDraftBody);

/** DELETE /me/community/drafts/EDIT_COMMENT?thread_id= — ไฟล์ที่เลือกระหว่างแก้ backend ลบให้ */
export const deleteCommentEditDraft = (threadId: string) =>
  Rest.delete('/me/community/drafts/EDIT_COMMENT', {
    params: { thread_id: threadId } satisfies C.DeleteCommunityDraftQuery,
  });
