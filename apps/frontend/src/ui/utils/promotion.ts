import { bangkokClock, groupDealsToday, type DealsToday } from '@nightout/utils';
import type { Bar, BarPromotion } from '@/services/data';

/** คำอธิบายโปร + เงื่อนไขเวลาเช็กอิน เช่น "มิกเซอร์ 4 จ่าย 3 · เช็กอินก่อน 20:00 น." */
export const promoNote = (p: Pick<BarPromotion, 'description' | 'cutoffTime'>) =>
  p.cutoffTime ? `${p.description} · เช็กอินก่อน ${p.cutoffTime} น.` : p.description;

/** ร้านปิดวันนี้ไหม (เวลาเปิด-ปิดรายวัน · 0 = อาทิตย์) */
export const isClosedOn = (hours: Bar['hours'], day: number) =>
  hours.some((h) => h.day === day && h.closed);

/** ดีลวันนี้ของร้าน (เวลากรุงเทพ) — live ยังจองทัน · ended เลย cutoff แล้ว · otherDays โปรวันอื่น · ร้านปิดวันนี้ = ไม่มีดีล */
export function barDealsToday(
  bar: Pick<Bar, 'promotions' | 'hours'>,
  now: number = Date.now(),
): DealsToday<BarPromotion> & { closedToday: boolean } {
  const closedToday = isClosedOn(bar.hours, bangkokClock(now).day);
  return { ...groupDealsToday(bar.promotions, now, { closedToday }), closedToday };
}
