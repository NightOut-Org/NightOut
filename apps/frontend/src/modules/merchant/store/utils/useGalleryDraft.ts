import type * as C from '@nightout/contracts';
import { BAR_GALLERY_MAX } from '@nightout/contracts';
import { coverFirst, galleryCoverPath } from '@nightout/utils';
import { useEffect, useRef, useState } from 'react';
import type { Bar } from '@/services/data';
import { uploadGalleryPhoto } from '../api';

/** รูปในแกลเลอรี — `path` = อยู่ใน Storage แล้ว · `file` = ยังไม่อัปโหลด (พรีวิวจาก object URL) */
export interface GalleryItem {
  key: string;
  path?: string;
  file?: File;
  url: string;
}

/**
 * draft ของรูปร้าน (ปก + แกลเลอรี) — เพิ่ม/ลบ/ตั้งปกในเครื่องก่อน แล้วอัปโหลด + บันทึกพร้อมข้อมูลร้านตอนกดบันทึก
 * `upload()` อัปโหลดเฉพาะไฟล์ที่ยังไม่อัปโหลด (เก็บ path กลับเข้า draft — บันทึกพลาดแล้วกดใหม่ ไม่อัปโหลดซ้ำ) แล้วคืน `media` ของ PUT /merchant/bars/:barId/store
 */
export function useGalleryDraft(bar: Bar) {
  const [draft, setDraft] = useState<{ items: GalleryItem[]; coverKey: string | null } | null>(
    null,
  );
  const urls = useRef(new Set<string>());

  useEffect(() => {
    const created = urls.current;
    return () => created.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const photos = bar.gallery ?? [];
  const serverCover = galleryCoverPath(
    bar.coverUrl,
    photos.map((p) => p.path),
  );
  const serverPaths = coverFirst(
    photos.map((p) => p.path),
    serverCover,
  );
  const serverItems: GalleryItem[] = serverPaths.map((p) => ({
    key: p,
    path: p,
    url: photos.find((g) => g.path === p)!.url,
  }));

  const base = draft ?? { items: serverItems, coverKey: serverCover };
  // ปกขึ้นก่อนเสมอ (รูปแรก = ปก)
  const items = base.coverKey
    ? [
        ...base.items.filter((g) => g.key === base.coverKey),
        ...base.items.filter((g) => g.key !== base.coverKey),
      ]
    : base.items;
  const keys = items.map((g) => g.path ?? g.key);
  const changed =
    draft !== null &&
    (keys.length !== serverPaths.length ||
      keys.some((k, i) => k !== serverPaths[i]) ||
      (base.coverKey ?? null) !== (serverCover ?? null));

  const edit = (
    fn: (b: { items: GalleryItem[]; coverKey: string | null }) => {
      items: GalleryItem[];
      coverKey: string | null;
    },
  ) => setDraft((d) => fn(d ?? { items: serverItems, coverKey: serverCover }));

  return {
    items,
    room: BAR_GALLERY_MAX - items.length,
    changed,
    isNew: (g: GalleryItem) => !g.path || !serverPaths.includes(g.path),
    /** เพิ่มรูป (ตรวจไฟล์มาแล้ว) — ยังไม่มีปก → รูปแรกที่เพิ่มเป็นปก */
    add: (files: File[]) =>
      edit((b) => {
        const added = files.map((file) => {
          const url = URL.createObjectURL(file);
          urls.current.add(url);
          return { key: `new:${crypto.randomUUID()}`, file, url };
        });
        return { items: [...b.items, ...added], coverKey: b.coverKey ?? added[0]?.key ?? null };
      }),
    setCover: (key: string) => edit((b) => ({ ...b, coverKey: key })),
    /** เอารูปออก — ลบปก → รูปถัดไปเป็นปก */
    remove: (key: string) =>
      edit((b) => {
        const next = b.items.filter((x) => x.key !== key);
        const rest = next.filter((x) => x.key !== b.coverKey);
        return { items: next, coverKey: key === b.coverKey ? (rest[0]?.key ?? null) : b.coverKey };
      }),
    upload: async (onProgress: (done: number, total: number) => void): Promise<C.BarMediaBody> => {
      const pending = items.filter((g) => !g.path);
      const paths = new Map(items.map((g) => [g.key, g.path]));
      onProgress(0, pending.length);
      for (const [i, g] of pending.entries()) {
        const path = await uploadGalleryPhoto(bar.id, g.file!);
        paths.set(g.key, path);
        setDraft(
          (d) => d && { ...d, items: d.items.map((x) => (x.key === g.key ? { ...x, path } : x)) },
        );
        onProgress(i + 1, pending.length);
      }
      return {
        paths: items.map((g) => paths.get(g.key)!),
        cover_path: base.coverKey ? (paths.get(base.coverKey) ?? null) : null,
      };
    },
    reset: () => {
      urls.current.forEach((u) => URL.revokeObjectURL(u));
      urls.current.clear();
      setDraft(null);
    },
  };
}
