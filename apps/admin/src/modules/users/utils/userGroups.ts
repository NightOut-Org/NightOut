import type { Db } from '@nightout/types';

/** แท็บของหน้า /users (?tab=) — แยกตามชั้นบัญชีที่บันทึกแล้ว (แก้ชั้นบัญชีค้างไว้ยังอยู่แท็บเดิมจนกดบันทึก) */
export type UserGroup = 'customers' | 'shop' | 'team' | 'inactive';
export const USER_GROUPS: readonly UserGroup[] = ['customers', 'shop', 'team', 'inactive'];

export const USER_GROUP_LABEL: Record<UserGroup, string> = {
  customers: 'ลูกค้า',
  shop: 'ทีมร้าน',
  team: 'ทีม NightOut',
  inactive: 'ถูกแบน / ลบแล้ว',
};

/** บัญชีที่ถูกแบนหรือลบแล้วรวมไว้แท็บเดียว ไม่ว่าชั้นบัญชีไหน */
export const userGroupOf = (u: Db.AdminUser): UserGroup => {
  if (u.banned_at || u.deleted_at) return 'inactive';
  if (u.role === 'MERCHANT' || u.role === 'STAFF') return 'shop';
  if (u.role === 'ADMIN' || u.role === 'SUPER_ADMIN') return 'team';
  return 'customers';
};

export const groupUsers = (users: readonly Db.AdminUser[]) => {
  const groups: Record<UserGroup, Db.AdminUser[]> = { customers: [], shop: [], team: [], inactive: [] };
  for (const u of users) groups[userGroupOf(u)].push(u);
  return groups;
};
