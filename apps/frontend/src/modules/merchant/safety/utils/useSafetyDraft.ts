import type * as C from '@nightout/contracts';
import { useState } from 'react';
import type { Bar, SafetyValue } from '@/services/data';
import { uploadSafetyProof } from '../api';

type SafetyRow = Bar['safety'][number];
/** การแก้ของ 1 ข้อ — `file` = หลักฐานที่ยังไม่อัปโหลด · `path` = อัปโหลดแล้ว (บันทึกพลาดแล้วกดใหม่ ไม่อัปโหลดซ้ำ) */
interface Edit {
  value?: SafetyValue;
  file?: File;
  path?: string;
}

/**
 * draft ของหน้า /merchant/safety (key = รหัสข้อ) — เลือก มี/ไม่มี/ไม่ระบุ และแนบหลักฐานในเครื่องก่อน
 * `upload()` อัปโหลดหลักฐานที่ยังไม่อัปโหลด แล้วคืน body ของ PUT /merchant/bars/:barId/safety
 */
export function useSafetyDraft(bar: Bar) {
  const [draft, setDraft] = useState<Map<string, Edit>>(new Map());

  const edit = (key: string, fn: (e: Edit) => Edit) =>
    setDraft((prev) => {
      const next = new Map(prev);
      const e = fn(prev.get(key) ?? {});
      if (e.value === undefined && !e.file) next.delete(key);
      else next.set(key, e);
      return next;
    });

  // ข้อที่ server เปลี่ยนไปแล้วจนตรงกับ draft ไม่นับ
  const items = bar.safety.flatMap((s) => {
    const e = draft.get(s.key);
    if (!e) return [];
    const value = e.value !== undefined && e.value !== s.value ? e.value : undefined;
    return value !== undefined || e.file ? [{ key: s.key, value, edit: e }] : [];
  });

  return {
    /** ค่าที่แสดง (draft ก่อน) */
    valueOf: (s: SafetyRow) => draft.get(s.key)?.value ?? s.value,
    valueChanged: (s: SafetyRow) => {
      const v = draft.get(s.key)?.value;
      return v !== undefined && v !== s.value;
    },
    /** ชื่อไฟล์หลักฐานที่รอส่ง */
    fileOf: (s: SafetyRow) => draft.get(s.key)?.file?.name,
    /** เลือกกลับเป็นค่าเดิม = ไม่นับว่าแก้ */
    setValue: (s: SafetyRow, v: SafetyValue) =>
      edit(s.key, (e) => ({ ...e, value: v === s.value ? undefined : v })),
    setFile: (s: SafetyRow, file: File) => edit(s.key, (e) => ({ ...e, file, path: undefined })),
    count: items.length,
    upload: async (
      onProgress: (done: number, total: number) => void,
    ): Promise<C.SaveSafetyBody> => {
      const pending = items.filter((i) => i.edit.file && !i.edit.path);
      const paths = new Map(items.map((i) => [i.key, i.edit.path]));
      onProgress(0, pending.length);
      for (const [n, i] of pending.entries()) {
        const path = await uploadSafetyProof(bar.id, i.key, i.edit.file!);
        paths.set(i.key, path);
        setDraft((prev) => {
          const next = new Map(prev);
          const e = next.get(i.key);
          if (e) next.set(i.key, { ...e, path });
          return next;
        });
        onProgress(n + 1, pending.length);
      }
      return {
        items: items.map((i) => ({
          key: i.key,
          ...(i.value !== undefined ? { value: i.value } : {}),
          ...(i.edit.file ? { evidence_path: paths.get(i.key)! } : {}),
        })),
      };
    },
    reset: () => setDraft(new Map()),
  };
}
