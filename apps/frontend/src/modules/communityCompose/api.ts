import type * as C from '@nightout/contracts';
import { Rest } from '@nightout/utils/rest';
import { useQuery } from '@tanstack/react-query';

/** API ของหน้าตั้งกระทู้ / แก้กระทู้ (/community/new · /community/t/:id/edit) · backend: domains/community */

/** GET /public/community/categories */
export const useCategories = () =>
  useQuery({
    queryKey: ['community', 'categories'],
    queryFn: () => Rest.get<C.CommunityCategory[]>('/public/community/categories'),
    staleTime: 60_000,
  });

/** GET /public/community/threads/:id — ค่าเดิมของกระทู้ที่จะแก้ */
export const useThreadToEdit = (id: string | undefined, userId: string | null) =>
  useQuery({
    queryKey: ['community', 'thread', id, userId],
    queryFn: () => Rest.get<C.CommunityThreadDetail>(`/public/community/threads/${id}`),
    enabled: !!id,
  });

/** GET /me/community/drafts — โหลดใหม่ทุกครั้งที่เปิดฟอร์ม (ร่างอาจถูกแก้จากเครื่องอื่น/ช่องอื่น) */
export const useMyDrafts = () =>
  useQuery({
    queryKey: ['community', 'drafts'],
    queryFn: () => Rest.get<C.CommunityDraft[]>('/me/community/drafts'),
    refetchOnMount: 'always',
  });

/** POST /community/threads */
export const createThread = (body: C.CommunityThreadBody) =>
  Rest.post<C.CreateCommunityThreadResult>(
    '/community/threads',
    body satisfies C.CommunityThreadBody,
  );

/** PATCH /community/threads/:id */
export const updateThread = (id: string, body: C.CommunityThreadBody) =>
  Rest.patch<C.CreateCommunityThreadResult>(
    `/community/threads/${id}`,
    body satisfies C.CommunityThreadBody,
  );

/** PUT /me/community/drafts — ร่างตั้งกระทู้ (NEW) หรือร่างแก้กระทู้ (EDIT) */
export const saveDraft = (
  kind: 'NEW' | 'EDIT',
  threadId: string | null,
  payload: C.CommunityDraftPayload,
) =>
  Rest.put<C.CommunityDraft>('/me/community/drafts', {
    kind,
    thread_id: threadId,
    payload,
  } satisfies C.SaveCommunityDraftBody);

/** DELETE /me/community/drafts/:kind */
export const deleteDraft = (kind: 'NEW' | 'EDIT', threadId: string | null) =>
  Rest.delete(`/me/community/drafts/${kind}`, {
    params: (threadId ? { thread_id: threadId } : {}) satisfies C.DeleteCommunityDraftQuery,
  });
