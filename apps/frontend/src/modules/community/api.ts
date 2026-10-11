import type * as C from '@nightout/contracts';
import { Rest } from '@nightout/utils/rest';
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';

/** API ของหน้าฟีดชุมชน (/community · /community/c/:category) · backend: domains/community */

const PAGE = 20;

/** GET /public/community/categories */
export const useCommunityCategories = () =>
  useQuery({
    queryKey: ['community', 'categories'],
    queryFn: () => Rest.get<C.CommunityCategory[]>('/public/community/categories'),
    staleTime: 60_000,
  });

/** GET /public/community/threads — โหลดต่อทีละหน้า (ปุ่ม "ดูกระทู้เพิ่มเติม") · key มี userId เพราะหมุดเป็นของแต่ละคน */
export const useCommunityFeed = (
  q: Omit<C.CommunityFeedQuery, 'limit' | 'offset'>,
  userId: string | null,
) =>
  useInfiniteQuery({
    queryKey: ['community', 'feed', q, userId],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      Rest.get<C.CommunityFeedResult>('/public/community/threads', {
        params: { ...q, limit: PAGE, offset: pageParam } satisfies C.CommunityFeedQuery,
      }),
    getNextPageParam: (last, pages) => (last.has_more ? pages.length * PAGE : undefined),
    placeholderData: keepPreviousData,
  });

/** GET /public/community/trending-bars */
export const useTrendingBars = () =>
  useQuery({
    queryKey: ['community', 'trending-bars'],
    queryFn: () => Rest.get<C.CommunityTrendingBar[]>('/public/community/trending-bars'),
    staleTime: 5 * 60_000,
  });

/** GET /me/community/drafts — ใช้แค่บอกว่ามีร่างตั้งกระทู้ค้างอยู่ (จุดบนปุ่ม "ตั้งกระทู้") */
export const useHasNewDraft = (enabled: boolean) =>
  useQuery({
    queryKey: ['community', 'drafts'],
    queryFn: () => Rest.get<C.CommunityDraft[]>('/me/community/drafts'),
    enabled,
    select: (rows) => rows.some((d) => d.kind === 'NEW'),
  });

/** PUT /community/threads/:id/pin — ปักหมุดส่วนตัว */
export const setPin = (threadId: string, on: boolean) =>
  Rest.put<C.CommunityPinResult>(`/community/threads/${threadId}/pin`, {
    on,
  } satisfies C.CommunityToggleBody);
