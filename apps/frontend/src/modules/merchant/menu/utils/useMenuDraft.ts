import { useEffect, useRef, useState } from 'react';
import type { MenuItem } from '@/services/data';
import { uploadMenuPhoto } from '../api';

/** รูปที่เลือกแต่ยังไม่อัปโหลด — `path` = อัปโหลดแล้ว (บันทึกพลาดแล้วกดใหม่ ไม่อัปโหลดซ้ำ) */
interface PendingPhoto {
  file: File;
  url: string;
  path?: string;
}
type ItemFields = Pick<MenuItem, 'category' | 'name' | 'price' | 'available'>;

const sameItem = (a: MenuItem, b: MenuItem) =>
  a.category === b.category &&
  a.name === b.name &&
  a.price === b.price &&
  a.available === b.available &&
  a.imagePath === b.imagePath;

/**
 * draft ของเมนู (หน้า /merchant/menu) — เพิ่ม/แก้/ลบรายการ · เปิด-ปิดการแสดง · เปลี่ยน/เอารูปออก ในเครื่องก่อน
 * `upload()` อัปโหลดรูปที่เลือกไว้ แล้วคืนเมนูทั้งชุดไว้ส่ง PUT /merchant/bars/:barId/menu (เส้นเดิมรับทั้งชุดอยู่แล้ว)
 * รายการใหม่มี id `new-…` (backend สร้าง id จริงให้)
 */
export function useMenuDraft(barId: string, server: MenuItem[]) {
  const [draft, setDraft] = useState<MenuItem[] | null>(null);
  const [photos, setPhotos] = useState<Map<string, PendingPhoto>>(new Map());
  const urls = useRef(new Set<string>());
  useEffect(() => {
    const created = urls.current;
    return () => created.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const list = draft ?? server;
  const edit = (fn: (l: MenuItem[]) => MenuItem[]) => setDraft((d) => fn(d ?? server));
  const preview = (file: File) => {
    const url = URL.createObjectURL(file);
    urls.current.add(url);
    return url;
  };
  /** photo: File = รูปใหม่ · null = เอารูปออก · undefined = ไม่แตะรูป */
  const setPhoto = (id: string, photo: File | null | undefined) => {
    if (photo === undefined) return;
    setPhotos((prev) => {
      const next = new Map(prev);
      if (photo) next.set(id, { file: photo, url: preview(photo) });
      else next.delete(id);
      return next;
    });
    if (photo === null)
      edit((l) =>
        l.map((m) => (m.id === id ? { ...m, imagePath: undefined, imageUrl: undefined } : m)),
      );
  };

  const byId = new Map(server.map((m) => [m.id, m]));
  const added = list.filter((m) => !byId.has(m.id)).length;
  const removed = server.filter((m) => !list.some((x) => x.id === m.id)).length;
  const modified = list.filter(
    (m) => byId.has(m.id) && (photos.has(m.id) || !sameItem(m, byId.get(m.id)!)),
  ).length;

  /** รายการพร้อมรูปพรีวิว (รูปที่เลือกไว้แทนรูปเดิม) */
  const items = list.map((m) => {
    const p = photos.get(m.id);
    return p ? { ...m, imageUrl: p.url } : m;
  });

  return {
    items,
    stateOf: (m: MenuItem): 'new' | 'changed' | null =>
      !byId.has(m.id)
        ? 'new'
        : photos.has(m.id) || !sameItem(m, byId.get(m.id)!)
          ? 'changed'
          : null,
    add: (fields: ItemFields, photo?: File | null) => {
      const id = `new-${crypto.randomUUID()}`;
      edit((l) => [...l, { ...fields, id }]);
      setPhoto(id, photo ?? undefined);
    },
    update: (id: string, fields: Partial<ItemFields>, photo?: File | null) => {
      edit((l) => l.map((m) => (m.id === id ? { ...m, ...fields } : m)));
      setPhoto(id, photo);
    },
    remove: (id: string) => {
      edit((l) => l.filter((m) => m.id !== id));
      setPhoto(id, null);
    },
    setPhoto,
    count: added + removed + modified,
    upload: async (onProgress: (done: number, total: number) => void): Promise<MenuItem[]> => {
      const pending = [...photos.entries()].filter(
        ([id, p]) => !p.path && list.some((m) => m.id === id),
      );
      const paths = new Map([...photos.entries()].map(([id, p]) => [id, p.path]));
      onProgress(0, pending.length);
      for (const [n, [id, p]] of pending.entries()) {
        const path = await uploadMenuPhoto(barId, p.file);
        paths.set(id, path);
        setPhotos((prev) => {
          const next = new Map(prev);
          const cur = next.get(id);
          if (cur) next.set(id, { ...cur, path });
          return next;
        });
        onProgress(n + 1, pending.length);
      }
      return list.map((m) => (paths.get(m.id) ? { ...m, imagePath: paths.get(m.id) } : m));
    },
    reset: () => {
      urls.current.forEach((u) => URL.revokeObjectURL(u));
      urls.current.clear();
      setDraft(null);
      setPhotos(new Map());
    },
  };
}
