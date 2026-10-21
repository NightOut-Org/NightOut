-- =====================================================================
-- account: เปลี่ยนชั้นบัญชีเป็นเจ้าของร้าน / พนักงานร้าน ต้องมีร้านที่ผูกอยู่แล้ว
--   เดิม admin_set_user_role (Backoffice /users "บันทึกชั้นบัญชี") ตั้ง MERCHANT / STAFF ให้บัญชีที่ไม่มีร้านได้
--   → ผู้ใช้เข้า /merchant แล้วเจอ "บัญชีนี้ยังไม่ได้ผูกกับร้าน" (ไม่มีข้อมูลร้าน)
--   ตอนนี้: MERCHANT ต้องเป็น OWNER / MANAGER ที่รับเชิญแล้วและยังไม่ถูกถอด อย่างน้อย 1 ร้าน
--           STAFF ต้องอยู่ในทีมร้าน (ทุกบทบาท) ที่รับเชิญแล้วและยังไม่ถูกถอด อย่างน้อย 1 ร้าน
--   ไม่ผ่าน → ROLE_NEEDS_BAR (ให้ใช้ "สร้างบัญชี" ที่เลือกร้านได้ หรือให้ร้านเชิญเข้าทีม / ให้ผู้ใช้สมัครร้านที่ /merchant/join)
--   ส่วนอื่นเหมือน 20261006000500 ทุกอย่าง
-- =====================================================================

create or replace function public.admin_set_user_role(p_actor uuid, p_user uuid, p_role public.user_role)
returns jsonb language plpgsql set search_path = '' as $$
declare old_role public.user_role; v_detached int := 0;
begin
  perform public.admin_assert(p_actor);
  perform public.super_admin_assert(p_actor);
  select role into old_role from public.users where id = p_user and deleted_at is null for update;
  if not found then raise exception 'USER_NOT_FOUND' using errcode = 'P0002'; end if;
  if old_role = p_role then
    return jsonb_build_object('id', p_user, 'role', p_role, 'bars_detached', 0);
  end if;
  if old_role = 'SUPER_ADMIN' then perform public.assert_keeps_super_admin(p_user); end if;

  if p_role in ('MERCHANT', 'STAFF') and not exists (
    select 1 from public.bar_staff s
    where s.user_id = p_user and s.revoked_at is null and s.accepted_at is not null
      and (p_role = 'STAFF' or s.role in ('OWNER', 'MANAGER'))
  ) then
    raise exception 'ROLE_NEEDS_BAR' using errcode = 'P0001';
  end if;

  if p_role in ('CUSTOMER', 'ADMIN', 'SUPER_ADMIN') then
    update public.bars set owner_id = null where owner_id = p_user;
    update public.bar_staff set revoked_at = now() where user_id = p_user and revoked_at is null;
    get diagnostics v_detached = row_count;
  end if;

  update public.users set role = p_role where id = p_user;
  perform public.admin_audit(p_actor, 'user.role', 'users', p_user, jsonb_build_object('role', old_role),
    jsonb_build_object('role', p_role, 'bars_detached', v_detached));
  return jsonb_build_object('id', p_user, 'role', p_role, 'bars_detached', v_detached);
end $$;

revoke all on function public.admin_set_user_role(uuid, uuid, public.user_role) from public, anon, authenticated;
grant execute on function public.admin_set_user_role(uuid, uuid, public.user_role) to service_role;
