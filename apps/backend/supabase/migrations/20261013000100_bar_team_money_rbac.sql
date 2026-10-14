-- =====================================================================
-- bar-team · Staff / PR ห้ามเห็นเงินของร้าน (requirement: "Staff ดูได้เฉพาะคิว ห้ามดูยอดเงินรวม")
--   is_bar_manager(bar) = เจ้าของ / ผู้จัดการ ที่ตอบรับแล้ว — ใช้แทน is_bar_member ทุกจุดที่เป็นเงิน
--   · สมุด Table Fee ของร้าน (bar_deposit_ledger)
--   · บัญชีรับเงิน → my_bar_detail.payout_account เป็น null ให้ Staff เอง (view เป็น security_invoker)
--   · รอบโอน / เครดิตร้าน · ค่าคอม / ใบแจ้งหนี้ / กติกาค่าคอม · การจ่ายค่าโปรโมท
-- ทีมร้านทุกบทบาทยังเห็นการจองรายใบ (สถานะ Table Fee ของแต่ละการจอง) ตามเดิม — ใช้เช็กอิน/คืนเงินหน้างาน
-- =====================================================================
set search_path = public, extensions;

create or replace function public.is_bar_manager(p_bar uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.bar_staff
    where bar_id = p_bar and user_id = auth.uid() and role in ('OWNER', 'MANAGER')
      and accepted_at is not null and revoked_at is null)
$$;

drop policy if exists bar_payout_accounts_read on public.bar_payout_accounts;
create policy bar_payout_accounts_read on public.bar_payout_accounts for select using (public.is_bar_manager(bar_id));

drop policy if exists bar_payouts_read_team on public.bar_payouts;
create policy bar_payouts_read_team on public.bar_payouts for select using (public.is_bar_manager(bar_id));

drop policy if exists bar_credit_ledger_read_team on public.bar_credit_ledger;
create policy bar_credit_ledger_read_team on public.bar_credit_ledger for select using (public.is_bar_manager(bar_id));

drop policy if exists commission_rules_read_team on public.commission_rules;
create policy commission_rules_read_team on public.commission_rules for select using (public.is_bar_manager(bar_id));

drop policy if exists invoices_read_team on public.invoices;
create policy invoices_read_team on public.invoices for select using (public.is_bar_manager(bar_id));

drop policy if exists billing_events_read_team on public.billing_events;
create policy billing_events_read_team on public.billing_events for select using (public.is_bar_manager(bar_id));

drop policy if exists promoted_listing_payments_read_team on public.promoted_listing_payments;
create policy promoted_listing_payments_read_team on public.promoted_listing_payments for select using (
  exists (select 1 from public.promoted_listings p where p.id = promoted_listing_id and public.is_bar_manager(p.bar_id)));

-- สมุด Table Fee ของร้าน (ไม่มี path สลิป — ร้านห้ามเห็นสลิปลูกค้า) · เจ้าของ / ผู้จัดการ เท่านั้น
create or replace function public.bar_deposit_ledger(p_bar uuid)
returns table (deposit_id uuid, booking_id uuid, booking_code text, booking_datetime timestamptz, customer_name text,
               amount numeric, status public.deposit_status, settlement public.deposit_settlement,
               verified_at timestamptz, settled_at timestamptz, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select d.id, bk.id, bk.code, bk.booking_datetime, u.display_name, d.amount, d.status, d.settlement,
         d.verified_at, d.settled_at, d.created_at
  from public.deposits d
  join public.bookings bk on bk.id = d.booking_id
  left join public.users u on u.id = bk.user_id
  where d.bar_id = p_bar and public.is_bar_manager(p_bar)
  order by bk.booking_datetime desc, d.created_at desc
$$;
