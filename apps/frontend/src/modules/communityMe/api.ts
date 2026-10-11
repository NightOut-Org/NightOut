import type * as C from '@nightout/contracts';
import { Rest } from '@nightout/utils/rest';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

/** API ของหน้ากระทู้ของฉัน (/community/me) · backend: domains/community */

const PAGE = 20;

/** GET /me/community/threads?scope= — mine | saved | pinned */
export const useMyThreads = (scope: C.CommunityScope) =>
  useInfiniteQuery({
    queryKey: ['community', 'me', scope],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      Rest.get<C.CommunityFeedResult>('/me/community/threads', {
        params: { scope, limit: PAGE, offset: pageParam } satisfies C.MyCommunityFeedQuery,
      }),
    getNextPageParam: (last, pages) => (last.has_more ? pages.length * PAGE : undefined),
  });

/** GET /me/community/drafts */
export const useMyDrafts = () =>
  useQuery({
    queryKey: ['community', 'drafts'],
    queryFn: () => Rest.get<C.CommunityDraft[]>('/me/community/drafts'),
  });

/** GET /public/community/threads/:id — หัวข้อของกระทู้ที่ร่างตอบ/แก้ค้างอยู่ */
export const useThreadTitle = (id: string | null) =>
  useQuery({
    queryKey: ['community', 'thread-title', id],
    queryFn: () => Rest.get<C.CommunityThreadDetail>(`/public/community/threads/${id}`),
    enabled: !!id,
    select: (t) => t.title,
    staleTime: 5 * 60_000,
    retry: false,
  });

/** DELETE /me/community/drafts/:kind */
export const deleteDraft = (d: C.CommunityDraft) =>
  Rest.delete(`/me/community/drafts/${d.kind}`, {
    params: (d.thread_id ? { thread_id: d.thread_id } : {}) satisfies C.DeleteCommunityDraftQuery,
  });

/** PUT /community/threads/:id/pin */
export const setPin = (id: string, on: boolean) =>
  Rest.put<C.CommunityPinResult>(`/community/threads/${id}/pin`, {
    on,
  } satisfies C.CommunityToggleBody);
