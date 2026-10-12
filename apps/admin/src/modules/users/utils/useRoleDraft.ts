import type * as C from '@nightout/contracts';
import type { Db } from '@nightout/types';
import { useState } from 'react';

export type Role = Db.Enums<'user_role'>;
/** ชั้นที่ไม่ผูกกับร้าน — แก้เป็นชั้นนี้แล้วหลุดจากทุกร้าน (admin_set_user_role) */
export const LEAVES_BARS: Role[] = ['CUSTOMER', 'ADMIN', 'SUPER_ADMIN'];

/** ผลกระทบของการเปลี่ยนชั้นบัญชี 1 คน — แสดงในหน้าต่างยืนยันตอนบันทึก */
export function roleNotes(u: Db.AdminUser, role: Role, selfId: string | undefined): string[] {
  return [
    role === 'ADMIN' && 'เข้าหลังบ้านได้ (ตั้ง MFA ตอนเข้าครั้งแรก) แต่แก้ชั้นบัญชีไม่ได้',
    role === 'SUPER_ADMIN' && 'เข้าหลังบ้านได้ และแก้ชั้นบัญชีของทุกคนได้',
    LEAVES_BARS.includes(role) &&
      u.bars.length > 0 &&
      `หลุดจากร้าน ${u.bars.map((b) => b.name).join(', ')} (เลิกเป็นเจ้าของและออกจากทีม)`,
    u.id === selfId &&
      u.role === 'SUPER_ADMIN' &&
      role !== 'SUPER_ADMIN' &&
      'นี่คือบัญชีของคุณ — หลังเปลี่ยน คุณจะแก้ชั้นบัญชีไม่ได้อีก',
  ].filter((n): n is string => !!n);
}

/**
 * draft ชั้นบัญชีของหน้า /users (key = id ผู้ใช้) — เลือกกลับเป็นค่าเดิม = ลบออกจาก draft
 * `changes` = body ของ PATCH /admin/users/roles (เฉพาะคนที่ต่างจาก server และยังไม่ถูกลบ)
 */
export function useRoleDraft(rows: Db.AdminUser[]) {
  const [draft, setDraft] = useState<Map<string, Role>>(new Map());

  const set = (u: Db.AdminUser, role: Role) =>
    setDraft((prev) => {
      const next = new Map(prev);
      if (role === u.role) next.delete(u.id);
      else next.set(u.id, role);
      return next;
    });

  const changed = rows.flatMap((u) => {
    const role = draft.get(u.id);
    return role && role !== u.role && !u.deleted_at ? [{ user: u, role }] : [];
  });
  const changes: C.SetUsersRoleBody['changes'] = changed.map(({ user, role }) => ({
    id: user.id,
    role,
  }));

  return {
    roleOf: (u: Db.AdminUser) => draft.get(u.id) ?? u.role,
    isChanged: (u: Db.AdminUser) => draft.has(u.id) && draft.get(u.id) !== u.role,
    set,
    changed,
    changes,
    reset: () => setDraft(new Map()),
  };
}
