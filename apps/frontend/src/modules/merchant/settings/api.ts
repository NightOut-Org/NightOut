import type * as C from '@nightout/contracts';
import { Rest } from '@nightout/utils/rest';

/** API ของหน้าตั้งค่าร้าน (การจอง + บัญชีรับเงิน) · backend: domains/bar */

/** PUT /merchant/bars/:barId/settings — บันทึกทั้งหน้าครั้งเดียว: ตั้งค่าการจอง และ/หรือ บัญชีรับเงิน (ธุรกรรมเดียว) */
export async function saveSettings(barId: string, body: C.SettingsPageBody) {
  return Rest.put<C.SettingsPageResult>(`/merchant/bars/${barId}/settings`, body);
}
