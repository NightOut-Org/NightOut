import { Injectable } from '@nestjs/common';
import type * as C from '@nightout/contracts';
import { SupabaseService } from '../../supabase/supabase.service';

/** รูปโปรไฟล์อยู่ใน bucket avatars (public) ใต้ <user_id>/<ไฟล์> */
export const AVATAR_BUCKET = 'avatars';

/**
 * account · รูปโปรไฟล์ — เรียก rpc แล้วลบไฟล์เก่าที่ไม่ใช้แล้วออกจาก Storage (`removed_paths` จาก DB · service_role)
 */
@Injectable()
export class AccountAvatarService {
  constructor(private readonly db: SupabaseService) {}

  /** ตั้งรูปจากไฟล์ที่อัปโหลดแล้ว (rpc app_set_avatar · DB ตรวจว่า path อยู่ในโฟลเดอร์ของผู้ใช้และมีไฟล์จริง) */
  set(actor: string, path: string): Promise<C.AvatarResult> {
    return this.write<C.AvatarResult>('app_set_avatar', { p_actor: actor, p_path: path, p_url: this.db.publicUrl(AVATAR_BUCKET, path) });
  }

  /** ลบรูปของตัวเอง (rpc app_remove_avatar) */
  remove(actor: string): Promise<C.AvatarResult> {
    return this.write<C.AvatarResult>('app_remove_avatar', { p_actor: actor });
  }

  /** แอดมินลบรูปไม่เหมาะสม (rpc admin_remove_user_avatar · audit + แจ้งเจ้าของบัญชี) */
  adminRemove(actor: string, user: string, reason: string): Promise<C.RemoveUserAvatarResult> {
    return this.write<C.RemoveUserAvatarResult>('admin_remove_user_avatar', { p_actor: actor, p_user: user, p_reason: reason });
  }

  /** เรียก rpc เขียน → ลบไฟล์ใน removed_paths → คืนผลลัพธ์ (ไม่มี removed_paths) */
  private async write<T extends object>(fn: string, args: Record<string, unknown>): Promise<T> {
    const { removed_paths, ...rest } = await this.db.rpc<T & { removed_paths?: string[] }>(fn, args);
    if (removed_paths?.length) await this.db.removeObjects(AVATAR_BUCKET, removed_paths);
    return rest as T;
  }
}
