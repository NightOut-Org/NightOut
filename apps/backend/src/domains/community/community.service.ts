import { Injectable } from '@nestjs/common';
import type { CommunityMedia, CommunityThreadDetail } from '@nightout/contracts';
import { SupabaseService } from '../../supabase/supabase.service';

export const COMMUNITY_BUCKET = 'community-media';
/** อายุ signed URL ของไฟล์แนบ (หน้าอ่านกระทู้โหลดใหม่ก่อนหมดแน่นอน) */
const SIGN_SECONDS = 6 * 3600;

type RawMedia = Omit<CommunityMedia, 'url' | 'thumb_url'>;
type RawThread = Omit<CommunityThreadDetail, 'media' | 'comments'> & {
  media: RawMedia[];
  comments: (Omit<CommunityThreadDetail['comments'][number], 'media'> & { media: RawMedia[] })[];
};

/**
 * community — งานที่มากกว่าเรียก rpc ครั้งเดียว
 * - เขียนแล้วลบไฟล์ที่ไม่มีใครอ้างแล้วออกจาก Storage (`removed_paths` จาก DB · service_role)
 * - เติม signed URL ให้ไฟล์แนบของกระทู้ในนามผู้เรียก (Storage policy ตัดสินว่าเห็นไฟล์ไหน)
 */
@Injectable()
export class CommunityService {
  constructor(private readonly db: SupabaseService) {}

  /** เรียก rpc เขียน → ลบไฟล์ใน removed_paths → คืนผลลัพธ์ (ไม่มี removed_paths) */
  async write<T extends object>(fn: string, args: Record<string, unknown>): Promise<T> {
    const { removed_paths, ...rest } = await this.db.rpc<T & { removed_paths?: string[] }>(fn, args);
    if (removed_paths?.length) await this.db.removeObjects(COMMUNITY_BUCKET, removed_paths);
    return rest as T;
  }

  /** กระทู้ + ความเห็น พร้อม url / thumb_url ของไฟล์แนบ */
  async thread(token: string | null, id: string): Promise<CommunityThreadDetail> {
    const t = await this.db.rpcAs<RawThread>(token, 'community_thread', { p_id: id });
    const all = [...t.media, ...t.comments.flatMap((c) => c.media)];
    const paths = [...new Set(all.flatMap((m) => (m.thumb_path ? [m.path, m.thumb_path] : [m.path])))];
    const urls = paths.length ? await this.db.signUrlsAs(token, COMMUNITY_BUCKET, paths, SIGN_SECONDS) : {};
    const sign = (list: RawMedia[]): CommunityMedia[] =>
      list.map((m) => ({ ...m, url: urls[m.path] ?? null, thumb_url: m.thumb_path ? (urls[m.thumb_path] ?? null) : null }));
    return { ...t, media: sign(t.media), comments: t.comments.map((c) => ({ ...c, media: sign(c.media) })) };
  }
}
