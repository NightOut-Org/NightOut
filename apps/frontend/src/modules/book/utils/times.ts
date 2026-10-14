import { MAX_GROUP_SIZE } from '@nightout/utils';

/** เวลาที่จองได้ทุก 30 นาที 18:00–23:00 */
export const TIMES = Array.from({ length: 11 }, (_, i) => {
  const m = 18 * 60 + i * 30;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${m % 60 ? '30' : '00'}`;
});

/** จำนวนคน 1–MAX_GROUP_SIZE (12 · ค่าเดียวกับตัวเลือกจำนวนคนในหน้าค้นหา) */
export const PAX_OPTIONS = Array.from({ length: MAX_GROUP_SIZE }, (_, i) => ({ label: `${i + 1} คน`, value: i + 1 }));
