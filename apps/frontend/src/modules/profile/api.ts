import type * as C from '@nightout/contracts';
import { Rest } from '@nightout/utils/rest';
import { uploadAvatar } from '@/services/api/storage';
import { currentProfile, setProfileName, setProfilePhone } from '@/services/sync';

/** API ของหน้าโปรไฟล์ · backend: domains/account */

/** PATCH /me/profile — ตั้งชื่อใน session ก่อนส่ง (Rest โหลด store ใหม่ด้วยชื่อนี้) · บันทึกไม่สำเร็จ = คืนชื่อเดิม */
export async function updateProfile(patch: C.UpdateProfileBody) {
  const prevName = currentProfile()?.displayName;
  if (patch.display_name) setProfileName(patch.display_name);
  try {
    await Rest.patch('/me/profile', patch);
  } catch (e) {
    if (patch.display_name && prevName !== undefined) setProfileName(prevName);
    throw e;
  }
}

/** อัปโหลดรูปเข้า bucket avatars แล้ว PUT /me/avatar — DB ตรวจ path + ลบรูปเดิมให้ */
export async function setAvatar(userId: string, file: Blob) {
  const path = await uploadAvatar(userId, file);
  return Rest.put<C.AvatarResult>('/me/avatar', { path } satisfies C.SetAvatarBody);
}

/** DELETE /me/avatar — กลับไปใช้ตัวย่อชื่อ */
export const removeAvatar = () => Rest.delete<C.AvatarResult>('/me/avatar');

/** PATCH /me/phone — เบอร์ที่ใช้ติดต่อตอนจอง · การจองที่ยังไม่ถึงเวลาเปลี่ยนเป็นเบอร์ใหม่ด้วย */
export async function updateMyPhone(body: C.UpdateMyPhoneBody) {
  const r = await Rest.patch<C.UpdateMyPhoneResult>('/me/phone', body);
  setProfilePhone(r.phone_e164);
  return r;
}
