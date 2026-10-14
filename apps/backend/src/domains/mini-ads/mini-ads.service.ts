import { Injectable } from '@nestjs/common';
import type * as C from '@nightout/contracts';
import { SupabaseService } from '../../supabase/supabase.service';

/** ภาพโฆษณาอยู่ใน bucket site-media (public) ใต้ ads/<uuid>.webp */
export const MINI_ADS_BUCKET = 'site-media';

/**
 * mini-ads — งานเขียนของ Backoffice: เรียก rpc แล้วลบภาพที่ไม่มีโฆษณาไหนใช้แล้วออกจาก Storage (`removed_paths` จาก DB · service_role)
 */
@Injectable()
export class MiniAdsService {
  constructor(private readonly db: SupabaseService) {}

  /** id = null → เพิ่ม · มี id → แก้เฉพาะ field ที่ส่ง (rpc admin_save_mini_ad) */
  save(actor: string, id: string | null, body: C.MiniAdBody | C.UpdateMiniAdBody): Promise<C.SaveMiniAdResult> {
    return this.write<C.SaveMiniAdResult>('admin_save_mini_ad', { p_actor: actor, p_id: id, p: body });
  }

  /** ลบถาวร (rpc admin_delete_mini_ad) */
  remove(actor: string, id: string): Promise<C.DeleteMiniAdResult> {
    return this.write<C.DeleteMiniAdResult>('admin_delete_mini_ad', { p_actor: actor, p_id: id });
  }

  /** เรียก rpc เขียน → ลบไฟล์ใน removed_paths → คืนผลลัพธ์ (ไม่มี removed_paths) */
  private async write<T extends object>(fn: string, args: Record<string, unknown>): Promise<T> {
    const { removed_paths, ...rest } = await this.db.rpc<T & { removed_paths?: string[] }>(fn, args);
    if (removed_paths?.length) await this.db.removeObjects(MINI_ADS_BUCKET, removed_paths);
    return rest as T;
  }
}
