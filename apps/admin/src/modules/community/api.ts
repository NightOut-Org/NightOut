import type * as C from '@nightout/contracts';
import { Rest } from '@nightout/utils/rest';
import { useQuery } from '@tanstack/react-query';
import { useAdminView, type AdminActionInput } from '@/services/adminData';

/** API ของหน้าชุมชน · backend: domains/backoffice (อ่าน) · domains/community (community.admin.controller.ts) */

export const useCommunityThreads = () =>
  useAdminView('admin_community_threads', { order: { column: 'created_at', ascending: false } });

export const useCommunityComments = () =>
  useAdminView('admin_community_comments', { order: { column: 'created_at', ascending: false } });

/** POST /admin/community/threads/:id/moderate — เก็บไว้ / ซ่อน / ลบ / แสดงอีกครั้ง */
export const moderateThreadAction = (
  threadId: string,
  body: C.ModerateCommunityBody,
): AdminActionInput => ({
  method: 'POST',
  path: `community/threads/${threadId}/moderate`,
  body,
});

/** POST /admin/community/comments/:id/moderate */
export const moderateCommentAction = (
  commentId: string,
  body: C.ModerateCommunityBody,
): AdminActionInput => ({
  method: 'POST',
  path: `community/comments/${commentId}/moderate`,
  body,
});

/** POST /storage/signed-urls — URL ชั่วคราวของไฟล์แนบ (bucket community-media · แอดมินอ่านได้ทุกไฟล์) · path → URL */
export const useMediaUrls = (paths: string[]) =>
  useQuery({
    queryKey: ['admin', 'community-media', paths],
    queryFn: async () => {
      const out: Record<string, string> = {};
      for (let i = 0; i < paths.length; i += 500) {
        const { urls } = await Rest.post<C.SignedUrlsResult>('/storage/signed-urls', {
          bucket: 'community-media',
          paths: paths.slice(i, i + 500),
          expires_in: 3600,
        } satisfies C.SignedUrlsBody);
        Object.assign(out, urls);
      }
      return out;
    },
    enabled: paths.length > 0,
    staleTime: 50 * 60_000,
  });
