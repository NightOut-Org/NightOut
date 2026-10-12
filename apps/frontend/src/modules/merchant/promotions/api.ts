import type * as C from '@nightout/contracts';
import type { BarPromotion } from '@nightout/mock';
import { Rest } from '@nightout/utils/rest';

/** API ของหน้าโปรโมชันของร้าน + ค่าธรรมเนียม · backend: domains/bar */

/** โปรใน store → `items` ของ PUT /merchant/bars/:barId/promotions-page */
export const toPromotionItems = (list: BarPromotion[]): NonNullable<C.PromotionsPageBody['items']> =>
  list.map((p) => ({
    id: p.id,
    title: p.title,
    description: p.description || null,
    cutoff_time: p.cutoffTime ?? null,
    days: p.days ?? null,
    active: p.active,
  }));

/** PUT /merchant/bars/:barId/promotions-page — บันทึกทั้งหน้าครั้งเดียว: โปรทั้งชุด และ/หรือ ค่าธรรมเนียม (คืนจำนวนโปรที่รอแอดมินตรวจถ้อยคำ) */
export async function savePromotionsPage(barId: string, body: C.PromotionsPageBody) {
  return Rest.put<C.PromotionsPageResult>(`/merchant/bars/${barId}/promotions-page`, body);
}
