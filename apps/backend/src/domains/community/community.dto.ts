import * as C from '@nightout/contracts';
import { createZodDto } from 'nestjs-zod';

export class CommunityFeedQueryDto extends createZodDto(C.CommunityFeedQuery) {}
export class MyCommunityFeedQueryDto extends createZodDto(C.MyCommunityFeedQuery) {}
export class CommunityThreadDto extends createZodDto(C.CommunityThreadBody) {}
export class CommunityCommentDto extends createZodDto(C.CommunityCommentBody) {}
export class CommunityToggleDto extends createZodDto(C.CommunityToggleBody) {}
export class CommunityReportDto extends createZodDto(C.CommunityReportBody) {}
export class SaveCommunityDraftDto extends createZodDto(C.SaveCommunityDraftBody) {}
export class DeleteCommunityDraftQueryDto extends createZodDto(C.DeleteCommunityDraftQuery) {}
export class ModerateCommunityDto extends createZodDto(C.ModerateCommunityBody) {}

/** query ของฟีด → พารามิเตอร์ของ rpc community_feed (ค่า default มาจาก zod แล้ว) */
export const feedArgs = (q: CommunityFeedQueryDto, scope: 'all' | C.CommunityScope = 'all') => ({
  p_scope: scope,
  p_category: q.category ?? null,
  p_sort: q.sort ?? 'latest',
  p_q: q.q || null,
  p_bar: q.bar_id ?? null,
  p_limit: q.limit ?? 20,
  p_offset: q.offset ?? 0,
});
