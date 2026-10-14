import { Injectable } from '@nestjs/common';
import type * as C from '@nightout/contracts';
import { SupabaseService } from '../../supabase/supabase.service';

const BUCKET = 'bar-media';

/** ผลจากฟังก์ชันเขียนรูปใน DB — `removed_paths` = ไฟล์ที่ไม่มีแถวไหนอ้างแล้ว (ลบจาก Storage แล้วไม่ส่งกลับหน้าเว็บ) */
type WithRemoved<T> = T & { removed_paths?: string[] };

/**
 * รูปร้าน (ปก + แกลเลอรี) และรูปเมนู — ใช้ร่วม merchant + admin controller
 * DB ไม่รู้โดเมน Storage → สร้าง URL ปกที่นี่ · เขียนเสร็จแล้วลบไฟล์ที่ไม่ใช้ออกจาก bucket bar-media
 */
@Injectable()
export class BarMediaService {
  constructor(private readonly db: SupabaseService) {}

  /** rpc app_set_bar_media / admin_set_bar_media */
  async setGallery(
    fn: 'app_set_bar_media' | 'admin_set_bar_media',
    actor: string,
    bar: string,
    b: C.BarMediaBody,
  ): Promise<C.BarMediaResult> {
    const r = await this.db.rpc<WithRemoved<C.BarMediaResult>>(fn, {
      p_actor: actor,
      p_bar: bar,
      p_paths: b.paths,
      p_cover_path: b.cover_path,
      p_cover_url: b.cover_path ? this.db.publicUrl(BUCKET, b.cover_path) : null,
    });
    return this.cleanup(r);
  }

  /** rpc app_save_bar_store — ข้อมูลร้าน และ/หรือ แกลเลอรี ในธุรกรรมเดียว */
  async saveStore(actor: string, bar: string, b: C.BarStoreBody): Promise<C.BarStoreResult> {
    return this.cleanup(
      await this.db.rpc<WithRemoved<C.BarStoreResult>>('app_save_bar_store', {
        p_actor: actor,
        p_bar: bar,
        p_info: b.info ?? null,
        ...this.galleryArgs(b.media),
      }),
    );
  }

  /** rpc admin_save_bar_media — แกลเลอรี และ/หรือ รูปเมนูที่เปลี่ยน ในธุรกรรมเดียว */
  async saveAdmin(
    actor: string,
    bar: string,
    b: C.AdminBarMediaBody,
  ): Promise<C.AdminBarMediaResult> {
    return this.cleanup(
      await this.db.rpc<WithRemoved<C.AdminBarMediaResult>>('admin_save_bar_media', {
        p_actor: actor,
        p_bar: bar,
        ...this.galleryArgs(b.gallery),
        p_menu: b.menu_images ?? null,
      }),
    );
  }

  /**
   * rpc admin_save_bar_details — แอดมินแก้ข้อมูลร้าน และ/หรือ เมนูทั้งชุดแทนร้าน ในธุรกรรมเดียว
   * (ไม่ส่งรูปเมนู → รูปของรายการที่คงอยู่ไม่เปลี่ยน · รายการที่เอาออก → ลบไฟล์รูป)
   */
  async saveAdminDetails(actor: string, bar: string, b: C.AdminBarDetailsBody): Promise<C.AdminBarDetailsResult> {
    return this.cleanup(
      await this.db.rpc<WithRemoved<C.AdminBarDetailsResult>>('admin_save_bar_details', {
        p_actor: actor,
        p_bar: bar,
        p_info: b.info ?? null,
        p_menu: b.menu ?? null,
      }),
    );
  }

  /** rpc app_set_menu — เมนูทั้งชุด (รูปที่ถูกแทน/ลบ → ลบไฟล์) */
  async setMenu(
    actor: string,
    bar: string,
    b: C.MenuBody,
  ): Promise<{ bar_id: string; count: number }> {
    return this.cleanup(
      await this.db.rpc<WithRemoved<{ bar_id: string; count: number }>>('app_set_menu', {
        p_actor: actor,
        p_bar: bar,
        p_items: b.items,
      }),
    );
  }

  /** ลบไฟล์ที่เพิ่งอัปโหลดแต่บันทึกไม่สำเร็จ — เฉพาะไฟล์ในโฟลเดอร์ของร้านนี้ที่ไม่มีแถวไหนอ้าง (bar_media_unused) */
  async discard(bar: string, paths: string[]): Promise<{ removed: number }> {
    const own = paths.filter((p) => p.startsWith(`${bar}/gallery/`) || p.startsWith(`${bar}/menu/`));
    if (!own.length) return { removed: 0 };
    const unused = await this.db.rpc<string[]>('bar_media_unused', { p_bar: bar, p_paths: own });
    await this.db.removeObjects(BUCKET, unused);
    return { removed: unused.length };
  }

  /** แกลเลอรีเป็นพารามิเตอร์ rpc (ไม่ส่ง = ไม่แตะ) — URL ปกสร้างที่นี่เพราะ DB ไม่รู้โดเมน Storage */
  private galleryArgs(g: C.BarMediaBody | undefined) {
    return {
      p_paths: g ? g.paths : null,
      p_cover_path: g?.cover_path ?? null,
      p_cover_url: g?.cover_path ? this.db.publicUrl(BUCKET, g.cover_path) : null,
    };
  }

  private async cleanup<T extends object>(r: WithRemoved<T>): Promise<T> {
    const { removed_paths = [], ...rest } = r;
    await this.db.removeObjects(BUCKET, removed_paths);
    return rest as T;
  }
}
