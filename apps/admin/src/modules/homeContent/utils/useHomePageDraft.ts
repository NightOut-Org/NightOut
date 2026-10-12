import type * as C from '@nightout/contracts';
import type { Db } from '@nightout/types';
import type { FormInstance } from 'antd';
import { Form } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { uploadSiteImage } from './media';

/** field ของ home_content ที่แก้ในหน้านี้ (Hero + หัวข้อ section) */
export const CONTENT_FIELDS = [
  'hero_title_lead',
  'hero_title_highlight',
  'hero_title_tail',
  'hero_subtitle',
  'hero_search_placeholder',
  'hero_image_url',
  'categories_eyebrow',
  'categories_title',
  'popular_eyebrow',
  'popular_title',
] as const;
type ContentField = (typeof CONTENT_FIELDS)[number];
export type ContentValues = Pick<Db.AdminHomeContent, ContentField>;
const CATEGORY_FIELDS = ['title', 'hint', 'link_to', 'image_url', 'badge'] as const;
export type CategoryValues = Pick<Db.AdminHomeCategory, (typeof CATEGORY_FIELDS)[number]>;

/** การ์ดที่แก้แล้ว — `file` = ภาพใหม่ที่ยังไม่อัปโหลด (พรีวิว `preview`) · อัปโหลดแล้วเก็บ URL ใน `values.image_url` */
interface CategoryEdit {
  values: CategoryValues;
  file?: File;
  preview?: string;
}

const norm = (v: unknown) => (typeof v === 'string' ? v.trim() : (v ?? null));

/**
 * draft ของหน้า /home-content ทั้งหน้า — Hero + หัวข้อ section (ฟอร์มเดียว) · การ์ดหมวด (Drawer กด "ตกลง") · ร้านยอดนิยม
 * ภาพ Hero/การ์ดอัปโหลดตอนบันทึก (`upload()` คืน body ของ PUT /admin/home-page · อัปโหลดแล้วไม่อัปโหลดซ้ำถ้าบันทึกพลาด)
 */
export function useHomePageDraft(
  form: FormInstance<ContentValues>,
  content: Db.AdminHomeContent | undefined,
  savedPopular: string[],
) {
  const [heroFile, setHeroFileState] = useState<{ file: File; preview: string } | null>(null);
  const [cards, setCards] = useState<Map<string, CategoryEdit>>(new Map());
  const [popular, setPopular] = useState<string[] | null>(null);
  const urls = useRef(new Set<string>());
  const watched = Form.useWatch([], form) as Partial<ContentValues> | undefined;

  useEffect(() => {
    const created = urls.current;
    return () => created.forEach((u) => URL.revokeObjectURL(u));
  }, []);
  // ค่าจาก server เข้าฟอร์ม (ตอนโหลด / หลังบันทึก)
  useEffect(() => {
    if (content) form.setFieldsValue(content);
  }, [content, form]);

  const preview = (file: File) => {
    const url = URL.createObjectURL(file);
    urls.current.add(url);
    return url;
  };

  /** field ที่ต่างจาก server (ภาพ Hero ใหม่นับด้วย) */
  const changedFields = content
    ? CONTENT_FIELDS.filter((f) => watched && f in watched && norm(watched[f]) !== norm(content[f]))
    : [];
  const contentDirty = changedFields.length > 0 || !!heroFile;

  const popularIds = popular ?? savedPopular;
  const popularDirty =
    popular !== null &&
    (popular.length !== savedPopular.length || popular.some((id, i) => id !== savedPopular[i]));

  return {
    heroPreview: heroFile?.preview,
    /** File = ภาพใหม่ · null = ใช้ภาพตั้งต้น */
    setHeroImage: (file: File | null) => {
      if (file) setHeroFileState({ file, preview: preview(file) });
      else {
        setHeroFileState(null);
        form.setFieldValue('hero_image_url', null);
      }
    },
    categoryOf: (c: Db.AdminHomeCategory) => {
      const e = cards.get(c.slot);
      return {
        values: e?.values ?? c,
        image: e?.preview ?? e?.values.image_url ?? c.image_url,
        changed: !!e,
      };
    },
    /** กด "ตกลง" ใน Drawer — ไม่เลือกภาพใหม่ = คงภาพที่เลือกไว้ก่อนหน้า · ค่ากลับมาตรงกับ server = ไม่นับว่าแก้ */
    setCategory: (c: Db.AdminHomeCategory, values: CategoryValues, file?: File) =>
      setCards((prev) => {
        const next = new Map(prev);
        const kept = file ? { file, preview: preview(file) } : prev.get(c.slot);
        // ช่องว่าง = null (ป้าย/คำอธิบายที่ลบออก ตรงกับค่าว่างจาก server)
        const same = CATEGORY_FIELDS.every((f) => (norm(values[f]) || null) === (norm(c[f]) || null));
        if (same && !kept?.file) next.delete(c.slot);
        else next.set(c.slot, { values, ...(kept?.file ? { file: kept.file, preview: kept.preview } : {}) });
        return next;
      }),
    popularIds,
    setPopular: (next: string[]) => setPopular(next),
    popularDirty,
    /** Hero/หัวข้อ = 1 · การ์ดละ 1 · ร้านยอดนิยม = 1 */
    count: (contentDirty ? 1 : 0) + cards.size + (popularDirty ? 1 : 0),

    upload: async (
      onProgress: (done: number, total: number) => void,
    ): Promise<C.SaveHomePageBody> => {
      const v = await form.validateFields();
      const pendingCards = [...cards.entries()].filter(([, e]) => e.file);
      const total = (heroFile ? 1 : 0) + pendingCards.length;
      let done = 0;
      onProgress(done, total);

      let heroUrl = v.hero_image_url ?? null;
      if (heroFile) {
        heroUrl = await uploadSiteImage(heroFile.file, 'hero');
        form.setFieldValue('hero_image_url', heroUrl);
        setHeroFileState(null);
        onProgress(++done, total);
      }
      const cardValues = new Map([...cards.entries()].map(([slot, e]) => [slot, e.values]));
      for (const [slot, e] of pendingCards) {
        const image_url = await uploadSiteImage(e.file!, 'category');
        cardValues.set(slot, { ...e.values, image_url });
        setCards((prev) => new Map(prev).set(slot, { values: { ...e.values, image_url } }));
        onProgress(++done, total);
      }

      const contentBody: C.UpdateHomeContentBody = {};
      for (const f of CONTENT_FIELDS) {
        const value = f === 'hero_image_url' ? heroUrl : v[f];
        if (content && norm(value) !== norm(content[f]))
          Object.assign(contentBody, {
            [f]: f === 'hero_image_url' ? value || null : (value ?? '').trim(),
          });
      }
      return {
        ...(Object.keys(contentBody).length ? { content: contentBody } : {}),
        ...(cardValues.size
          ? {
              categories: [...cardValues.entries()].map(([slot, c]) => ({
                slot: slot as C.HomeCategorySlot,
                title: c.title.trim(),
                hint: c.hint?.trim() ?? '',
                link_to: c.link_to.trim(),
                image_url: c.image_url,
                badge: c.badge?.trim() || null,
              })),
            }
          : {}),
        ...(popularDirty ? { popular: { bar_ids: popularIds } } : {}),
      };
    },
    reset: () => {
      urls.current.forEach((u) => URL.revokeObjectURL(u));
      urls.current.clear();
      setHeroFileState(null);
      setCards(new Map());
      setPopular(null);
      if (content) form.setFieldsValue(content);
    },
  };
}
