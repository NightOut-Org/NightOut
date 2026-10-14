import type * as C from '@nightout/contracts';
import type { SafetyCheckResult } from '@nightout/types';
import { SAFETY_INSPECTION_MAX_PHOTOS, countSafetyChecks } from '@nightout/utils';
import type { Dayjs } from 'dayjs';
import { useEffect, useRef, useState } from 'react';
import { uploadInspectionPhoto } from '../api';

/** ผลของ 1 ข้อ — `files[i]` ยังอยู่ในเครื่อง · `paths[i]` = อัปโหลดแล้ว (ลองบันทึกใหม่ไม่อัปซ้ำ) · `urls[i]` = พรีวิว (object URL) */
export interface InspectionItemDraft {
  result?: SafetyCheckResult;
  note: string;
  files: File[];
  paths: (string | undefined)[];
  urls: string[];
}
const EMPTY_ITEM: InspectionItemDraft = { result: undefined, note: '', files: [], paths: [], urls: [] };

/**
 * draft ของ Drawer ลงพื้นที่ตรวจ (ร้านเดียว · Drawer mount ใหม่ทุกร้าน) — ผลต่อข้อ + หมายเหตุ + รูป ≤ 3/ข้อ + หมายเหตุรวม + วันเวลาที่ลงพื้นที่
 * `upload()` อัปโหลดเฉพาะรูปที่ยังไม่มี path แล้วคืน body ของ POST /admin/bars/:id/safety-inspections
 */
export function useInspectionDraft(barId: string, keys: readonly string[]) {
  const [items, setItems] = useState<ReadonlyMap<string, InspectionItemDraft>>(new Map());
  const [note, setNote] = useState('');
  const [inspectedAt, setInspectedAt] = useState<Dayjs | null>(null);
  const urls = useRef(new Set<string>());

  useEffect(() => {
    const created = urls.current;
    return () => created.forEach((u) => URL.revokeObjectURL(u));
  }, []);
  const revoke = (u: string) => {
    URL.revokeObjectURL(u);
    urls.current.delete(u);
  };

  const itemOf = (key: string): InspectionItemDraft => items.get(key) ?? EMPTY_ITEM;
  const edit = (key: string, fn: (it: InspectionItemDraft) => InspectionItemDraft) =>
    setItems((m) => new Map(m).set(key, fn(m.get(key) ?? EMPTY_ITEM)));

  const setResult = (key: string, result: SafetyCheckResult) => edit(key, (it) => ({ ...it, result }));
  const setItemNote = (key: string, value: string) => edit(key, (it) => ({ ...it, note: value }));
  /** เพิ่มรูป (ตรวจชนิด/ขนาดมาแล้ว) — เกินโควตาตัดทิ้ง · คืนจำนวนที่รับไว้ (ผู้เรียกแจ้งเตือนถ้าน้อยกว่าที่เลือก) */
  const addFiles = (key: string, files: File[]): number => {
    const room = Math.max(0, SAFETY_INSPECTION_MAX_PHOTOS - itemOf(key).files.length);
    const accepted = files.slice(0, room);
    if (!accepted.length) return 0;
    const previews = accepted.map((f) => {
      const u = URL.createObjectURL(f);
      urls.current.add(u);
      return u;
    });
    edit(key, (it) => ({
      ...it,
      files: [...it.files, ...accepted],
      paths: [...it.paths, ...accepted.map(() => undefined)],
      urls: [...it.urls, ...previews],
    }));
    return accepted.length;
  };
  const removeFile = (key: string, i: number) => {
    const u = itemOf(key).urls[i];
    if (u) revoke(u);
    edit(key, (it) => ({
      ...it,
      files: it.files.filter((_, j) => j !== i),
      paths: it.paths.filter((_, j) => j !== i),
      urls: it.urls.filter((_, j) => j !== i),
    }));
  };
  /** ข้อที่ยังไม่เลือกผล = ไม่ได้ตรวจ */
  const fillRestNA = () =>
    setItems((m) => {
      const next = new Map(m);
      for (const k of keys) {
        const it = next.get(k) ?? EMPTY_ITEM;
        if (!it.result) next.set(k, { ...it, result: 'NA' });
      }
      return next;
    });

  const decided = keys.flatMap((k) => {
    const it = items.get(k);
    return it?.result ? [{ key: k, ...it, result: it.result }] : [];
  });
  const done = decided.length;
  const total = keys.length;
  const counts = countSafetyChecks(decided);
  const canSave = total > 0 && done === total && counts.pass + counts.fail > 0;
  const dirty =
    note.trim() !== '' ||
    inspectedAt !== null ||
    [...items.values()].some((it) => it.result || it.note.trim() || it.files.length);
  const photoCount = decided.reduce((n, it) => n + it.files.length, 0);

  /** อัปโหลดรูปที่ยังไม่อัปโหลด (onProgress "done/total") → body · อัปโหลดพลาด = throw (path ที่สำเร็จแล้วเก็บไว้ใน draft) */
  const upload = async (onProgress: (done: number, total: number) => void): Promise<C.SafetyInspectionBody> => {
    const pending = decided.flatMap((it) =>
      it.files.flatMap((file, i) => (it.paths[i] ? [] : [{ key: it.key, i, file }])),
    );
    const got = new Map<string, string>();
    let n = 0;
    onProgress(n, pending.length);
    for (const p of pending) {
      const path = await uploadInspectionPhoto(barId, p.file);
      got.set(`${p.key}:${p.i}`, path);
      // เก็บ path กลับเข้า draft ทันที — ลองใหม่หลังพลาดจะไม่อัปโหลดซ้ำ
      edit(p.key, (it) => ({ ...it, paths: it.paths.map((x, j) => (j === p.i ? path : x)) }));
      onProgress(++n, pending.length);
    }
    const trimmed = note.trim();
    return {
      ...(inspectedAt ? { inspected_at: inspectedAt.toISOString() } : {}),
      ...(trimmed ? { note: trimmed } : {}),
      items: decided.map((it) => {
        const photos = it.files.map((_, i) => it.paths[i] ?? got.get(`${it.key}:${i}`)!);
        const itemNote = it.note.trim();
        return {
          key: it.key,
          result: it.result,
          ...(itemNote ? { note: itemNote } : {}),
          ...(photos.length ? { photo_paths: photos } : {}),
        };
      }),
    };
  };

  const reset = () => {
    urls.current.forEach((u) => URL.revokeObjectURL(u));
    urls.current.clear();
    setItems(new Map());
    setNote('');
    setInspectedAt(null);
  };

  return {
    itemOf,
    resultOf: (key: string) => itemOf(key).result,
    setResult,
    setItemNote,
    addFiles,
    removeFile,
    fillRestNA,
    note,
    setNote,
    inspectedAt,
    setInspectedAt,
    done,
    total,
    counts,
    canSave,
    dirty,
    photoCount,
    upload,
    reset,
  };
}
