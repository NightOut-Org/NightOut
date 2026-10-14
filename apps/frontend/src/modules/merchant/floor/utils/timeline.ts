/**
 * คณิตพิกเซลของไทม์ไลน์ — ช่วงเวลา (timelineRange) และการจัดแถวย่อย (packLanes) อยู่ใน @nightout/utils (มีเทสต์)
 */
export const HOUR_PX = 72;
export const NAME_COL_PX = 104;
/** ความสูงแถวย่อย — แถบการจองสูง LANE_PX - 6 = 44px (เป้าแตะ ≥ 44px) */
export const LANE_PX = 50;
export const ROW_MIN_PX = 56;
/** ความกว้างต่ำสุดของแถบ ให้ยังแตะ/ลากได้บนมือถือ */
export const BAR_MIN_PX = 28;
const HOUR_MS = 3_600_000;

/** ตำแหน่ง x (px) ของเวลา t ในไทม์ไลน์ที่เริ่ม start */
export const xOf = (t: number, start: number) => ((t - start) / HOUR_MS) * HOUR_PX;

/** ความกว้าง (px) ของช่วง [from, to) — อย่างน้อย BAR_MIN_PX ให้ยังแตะได้ */
export const widthOf = (from: number, to: number) => Math.max(BAR_MIN_PX, ((to - from) / HOUR_MS) * HOUR_PX);

/** ความกว้างทั้งแผง */
export const canvasWidth = (range: { start: number; end: number }) => xOf(range.end, range.start);

/** เส้นชั่วโมงเต็ม (start ปัดเป็นชั่วโมงแล้วจาก timelineRange) */
export function hourTicks(range: { start: number; end: number }): number[] {
  const ticks: number[] = [];
  for (let t = range.start; t <= range.end; t += HOUR_MS) ticks.push(t);
  return ticks;
}

/** ความสูงแถวของโต๊ะที่มีแถวย่อย n แถว */
export const rowHeight = (lanes: number) => Math.max(ROW_MIN_PX, lanes * LANE_PX + 8);

/** ตัดช่วงให้อยู่ในแผง */
export const clampSpan = (from: number, to: number, range: { start: number; end: number }) => ({
  start: Math.max(range.start, from),
  end: Math.min(range.end, Math.max(from, to)),
});
