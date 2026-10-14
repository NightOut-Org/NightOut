-- =====================================================================
-- backoffice · สิ่งที่แอดมินทั่วไปไม่เห็น (requirement: Admin "ไม่ได้: ดูการเงิน, ค่าคอม, Audit Log" — ผ่อนตามเจ้าของ 2026-10-13)
--   · Audit Log: แอดมินเห็นได้ ยกเว้นรายการที่ Super Admin เป็นคนทำ (actor_role = SUPER_ADMIN) · Super Admin เห็นทั้งหมด
--   · ค่าคอม (billing_events / invoices / commission_rules + view admin_billing_events): Super Admin เท่านั้น
-- is_super_admin() = ชั้น SUPER_ADMIN + token ผ่าน MFA (aal2) — คู่กับ is_admin()
-- =====================================================================
set search_path = public, extensions;

create or replace function public.is_super_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((auth.jwt() ->> 'aal') = 'aal2', false)
     and exists (select 1 from public.users where id = auth.uid() and role = 'SUPER_ADMIN' and deleted_at is null)
$$;

-- Audit Log ------------------------------------------------------------
drop policy if exists admin_read on public.audit_logs;
create policy admin_read on public.audit_logs for select to authenticated
  using (public.is_super_admin() or (public.is_admin() and actor_role is distinct from 'SUPER_ADMIN'));

create or replace view public.admin_audit_logs with (security_invoker = true) as
select
  a.id, a.action, a.entity_type, a.entity_id, a.before, a.after, a.created_at, a.actor_role,
  case when u.id is null then null else jsonb_build_object('id', u.id, 'email', u.email, 'display_name', u.display_name) end as actor
from public.audit_logs a
left join public.users u on u.id = a.actor_id
where public.is_super_admin() or (public.is_admin() and a.actor_role is distinct from 'SUPER_ADMIN');

-- ค่าคอม (Phase 2 · หน้า /billing ปิดไว้) -----------------------------------
drop policy if exists admin_read on public.billing_events;
create policy admin_read on public.billing_events for select to authenticated using (public.is_super_admin());
drop policy if exists admin_read on public.invoices;
create policy admin_read on public.invoices for select to authenticated using (public.is_super_admin());
drop policy if exists admin_read on public.commission_rules;
create policy admin_read on public.commission_rules for select to authenticated using (public.is_super_admin());

create or replace view public.admin_billing_events with (security_invoker = true) as
select
  be.id, be.event_type, be.base_amount, be.amount, be.status, be.period, be.created_at,
  jsonb_build_object('id', b.id, 'name', b.name) as bar,
  bk.code as booking_code
from public.billing_events be
join public.bars     b  on b.id  = be.bar_id
join public.bookings bk on bk.id = be.booking_id
where public.is_super_admin();
