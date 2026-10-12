import type * as C from '@nightout/contracts';
import { BAR_GALLERY_MAX } from '@nightout/contracts';
import type { Db } from '@nightout/types';
import { coverFirst } from '@nightout/utils';
import { useEffect, useRef, useState } from 'react';
import { uploadBarImage } from '../api';
import { coverPathOf, mediaUrl } from './media';

/** รูปในแกลเลอรี — `path` = อยู่ใน Storage แล้ว · `file` = ยังไม่อัปโหลด (พรีวิวจาก object URL) */
export interface GalleryItem {
  key: string;
  path?: string;
  file?: File;
  url: string;
}
/** รูปเมนูที่แก้ — null = ลบรูป */
type MenuEdit = { path?: string; file?: File; url: string } | null;
type MenuRow = Db.AdminBarMedia['menu'][number];

interface Draft {
  barId: string | null;
  /** null = ยังไม่แตะแกลเลอรี */
  gallery: GalleryItem[] | null;
  coverKey: string | null;
  menu: Map<string, MenuEdit>;
}
const empty = (barId: string | null): Draft => ({
  barId,
  gallery: null,
  coverKey: null,
  menu: new Map(),
});

/**
 * draft ของ Drawer รูปร้าน (ร้านเดียว) — เพิ่ม/ลบ/ตั้งปกแกลเลอรี + เปลี่ยน/ลบรูปเมนู ในเครื่องก่อน
 * `upload()` อัปโหลดไฟล์ใหม่ทั้งหมดแล้วคืน body ของ PUT /admin/bars/:id/media · บันทึกพลาด = ผู้เรียกลบไฟล์ที่เพิ่งอัปโหลด (draft ยังเก็บไฟล์ในเครื่อง กดบันทึกใหม่ได้)
 * เปลี่ยนร้าน = เริ่ม draft ใหม่
 */
export function useBarMediaDraft(bar: Db.AdminBarMedia | null) {
  const [draft, setDraft] = useState<Draft>(() => empty(bar?.id ?? null));
  const urls = useRef(new Set<string>());
  const cur = draft.barId === (bar?.id ?? null) ? draft : empty(bar?.id ?? null);

  const preview = (file: File) => {
    const url = URL.createObjectURL(file);
    urls.current.add(url);
    return url;
  };
  const revokeAll = () => {
    urls.current.forEach((u) => URL.revokeObjectURL(u));
    urls.current.clear();
  };
  useEffect(() => {
    const created = urls.current;
    return () => created.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  // ----------------------------- ค่าจาก server -----------------------------
  const serverCover = bar ? coverPathOf(bar) : null;
  const serverPaths = bar
    ? coverFirst(
        bar.media.map((m) => m.storage_path),
        serverCover,
      )
    : [];
  const serverItems: GalleryItem[] = serverPaths.map((p) => ({
    key: p,
    path: p,
    url: mediaUrl(p),
  }));

  // ----------------------------- ค่าที่แสดง -----------------------------
  const gallery = cur.gallery ?? serverItems;
  const coverKey = cur.gallery ? cur.coverKey : serverCover;
  const items = coverKey
    ? [...gallery.filter((g) => g.key === coverKey), ...gallery.filter((g) => g.key !== coverKey)]
    : gallery;
  const room = BAR_GALLERY_MAX - items.length;

  const editGallery = (
    fn: (
      g: GalleryItem[],
      cover: string | null,
    ) => { gallery: GalleryItem[]; coverKey: string | null },
  ) =>
    setDraft((d) => {
      const base = d.barId === (bar?.id ?? null) ? d : empty(bar?.id ?? null);
      return {
        ...base,
        ...fn(base.gallery ?? serverItems, base.gallery ? base.coverKey : serverCover),
      };
    });

  /** เพิ่มรูป (ตรวจไฟล์มาแล้ว) — ยังไม่มีปก → รูปแรกที่เพิ่มเป็นปก */
  const addPhotos = (files: File[]) =>
    editGallery((g, cover) => {
      const added = files.map((file) => ({
        key: `new:${crypto.randomUUID()}`,
        file,
        url: preview(file),
      }));
      return { gallery: [...g, ...added], coverKey: cover ?? added[0]?.key ?? null };
    });
  const setCover = (key: string) => editGallery((g) => ({ gallery: g, coverKey: key }));
  /** ลบรูป — ลบปก → รูปถัดไปเป็นปก */
  const removePhoto = (key: string) =>
    editGallery((g, cover) => {
      const next = g.filter((x) => x.key !== key);
      const ordered = cover
        ? [...next.filter((x) => x.key === cover), ...next.filter((x) => x.key !== cover)]
        : next;
      return { gallery: next, coverKey: key === cover ? (ordered[0]?.key ?? null) : cover };
    });

  const menuOf = (m: MenuRow): { url: string | null; changed: boolean } => {
    if (!cur.menu.has(m.id))
      return { url: m.image_path ? mediaUrl(m.image_path) : null, changed: false };
    const e = cur.menu.get(m.id);
    return { url: e ? e.url : null, changed: true };
  };
  const editMenu = (m: MenuRow, e: MenuEdit | undefined) =>
    setDraft((d) => {
      const base = d.barId === (bar?.id ?? null) ? d : empty(bar?.id ?? null);
      const menu = new Map(base.menu);
      // กลับเป็นค่าเดิม (ลบรูปที่ไม่มีอยู่แล้ว) = ไม่นับว่าแก้
      if (e === undefined || (e === null && !m.image_path)) menu.delete(m.id);
      else menu.set(m.id, e);
      return { ...base, menu };
    });
  const setMenuPhoto = (m: MenuRow, file: File) => editMenu(m, { file, url: preview(file) });
  const removeMenuPhoto = (m: MenuRow) => editMenu(m, null);

  // ----------------------------- นับการแก้ -----------------------------
  const itemPaths = items.map((g) => g.path ?? g.key);
  const galleryChanged =
    cur.gallery !== null &&
    (itemPaths.length !== serverPaths.length ||
      itemPaths.some((p, i) => p !== serverPaths[i]) ||
      (coverKey ?? null) !== (serverCover ?? null));
  const added = items.filter((g) => !serverPaths.includes(g.path ?? '')).length;
  const removed = serverPaths.filter((p) => !items.some((g) => g.path === p)).length;
  const coverChanged = galleryChanged && (items[0]?.path ?? items[0]?.key ?? null) !== serverCover;
  const count =
    (galleryChanged ? Math.max(1, added + removed + (coverChanged ? 1 : 0)) : 0) + cur.menu.size;

  /**
   * อัปโหลดไฟล์ที่ยังไม่อัปโหลด (onProgress "i/n") แล้วคืน body · อัปโหลดพลาด = throw (draft เก็บไฟล์ที่สำเร็จแล้ว)
   */
  /** `uploaded` = path ที่อัปโหลดในรอบนี้ (ใส่ให้ทีละไฟล์ — บันทึก/อัปโหลดพลาดแล้วผู้เรียกลบไฟล์เหล่านี้ทิ้ง) */
  const upload = async (
    onProgress: (done: number, total: number) => void,
    uploaded: string[],
  ): Promise<C.AdminBarMediaBody> => {
    if (!bar) throw new Error('ไม่พบร้าน');
    const pendingGallery = galleryChanged ? items.filter((g) => !g.path) : [];
    const pendingMenu = [...cur.menu.entries()].filter(([, e]) => e?.file && !e.path);
    const total = pendingGallery.length + pendingMenu.length;
    const galleryPath = new Map(items.map((g) => [g.key, g.path]));
    const menuPath = new Map(
      [...cur.menu.entries()].map(([id, e]) => [id, e ? (e.path ?? null) : null]),
    );
    let done = 0;
    onProgress(done, total);

    for (const g of pendingGallery) {
      const path = await uploadBarImage(bar.id, 'gallery', g.file!);
      uploaded.push(path);
      galleryPath.set(g.key, path);
      onProgress(++done, total);
    }
    for (const [id, e] of pendingMenu) {
      const path = await uploadBarImage(bar.id, 'menu', e!.file!);
      uploaded.push(path);
      menuPath.set(id, path);
      onProgress(++done, total);
    }

    const paths = items.map((g) => galleryPath.get(g.key)!);
    const cover = coverKey ? (galleryPath.get(coverKey) ?? null) : null;
    return {
      ...(galleryChanged ? { gallery: { paths, cover_path: cover } } : {}),
      ...(cur.menu.size
        ? { menu_images: [...menuPath.entries()].map(([id, path]) => ({ id, path })) }
        : {}),
    };
  };

  return {
    items,
    coverKey,
    room,
    isNew: (g: GalleryItem) => !g.path || !serverPaths.includes(g.path),
    addPhotos,
    setCover,
    removePhoto,
    menuOf,
    setMenuPhoto,
    removeMenuPhoto,
    count,
    upload,
    reset: () => {
      revokeAll();
      setDraft(empty(bar?.id ?? null));
    },
  };
}
