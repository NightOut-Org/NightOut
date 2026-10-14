import dayjs, { type Dayjs } from 'dayjs';

/**
 * ช่วงวันที่ของโฆษณา — คิดตามเวลาไทย (Asia/Bangkok) เสมอ ไม่ขึ้นกับ timezone ของเบราว์เซอร์
 * UI: วันสุดท้าย "รวม" · DB: ends_at "ไม่รวม" (= เที่ยงคืนต้นวันถัดไป)
 */
const BANGKOK_YMD = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' });

/** instant (ISO) → วันที่ตามเวลาไทย 'YYYY-MM-DD' */
const bangkokYmd = (ms: number) => BANGKOK_YMD.format(new Date(ms));

/** วันเริ่ม–วันสุดท้าย (รวม) ใน UI → starts_at / ends_at (ไม่รวม) ที่ส่งให้ API */
export function toPeriod(start: Dayjs, end: Dayjs): { starts_at: string; ends_at: string } {
  return {
    starts_at: `${start.format('YYYY-MM-DD')}T00:00:00+07:00`,
    ends_at: `${end.add(1, 'day').format('YYYY-MM-DD')}T00:00:00+07:00`,
  };
}

/** starts_at / ends_at จาก DB → [วันเริ่ม, วันสุดท้าย (รวม)] สำหรับ RangePicker */
export function fromPeriod(starts_at: string, ends_at: string): [Dayjs, Dayjs] {
  return [dayjs(bangkokYmd(Date.parse(starts_at))), dayjs(bangkokYmd(Date.parse(ends_at) - 1))];
}

const thDate = (ms: number) =>
  new Date(ms).toLocaleDateString('th-TH', { dateStyle: 'medium', timeZone: 'Asia/Bangkok' });

/** '20 ต.ค. 2569 – 19 พ.ย. 2569' (วันสุดท้ายรวม) */
export function periodLabel(starts_at: string, ends_at: string): string {
  return `${thDate(Date.parse(starts_at))} – ${thDate(Date.parse(ends_at) - 1)}`;
}

/** วันนี้ตามเวลาไทย (เรียกใน handler / useState initializer เท่านั้น — ไม่เรียกใน render) */
export const todayBangkok = (): Dayjs => dayjs(bangkokYmd(Date.now()));
