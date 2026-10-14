-- =====================================================================
-- booking · บัตรจองที่แชร์ (/share/:token) แสดงยอดหารต่อหัว (requirement "ลิงก์หารเงิน / Share to Gang")
--   + deposit_required = Table Fee ของการจองนี้ — หน้าเว็บหารด้วย pax ให้เพื่อนเห็นว่าต้องโอนคืนผู้จองคนละเท่าไร
--   ผู้จองจ่ายคนเดียว (ไม่มี Split-Pay) · ยังไม่มีข้อมูลส่วนตัว (ไม่มีเบอร์ / อีเมล / QR)
-- เปลี่ยนชนิดผลลัพธ์ → ต้อง drop แล้วสร้างใหม่
-- =====================================================================
set search_path = public, extensions;

drop function if exists public.get_share_card(text);

create function public.get_share_card(p_token text)
returns table (booking_datetime timestamptz, pax smallint, status public.booking_status, zone_name text,
               bar_name text, bar_slug extensions.citext, address text, lat numeric, lng numeric,
               host_first_name text, going_count bigint, deposit_required numeric)
language sql stable security definer set search_path = '' as $$
  select bk.booking_datetime, bk.pax, bk.status, z.name, b.name, b.slug, b.address, b.lat, b.lng,
         split_part(u.display_name, ' ', 1),
         (select count(*) from public.booking_share_joins j where j.share_id = s.id),
         bk.deposit_required
  from public.booking_shares s
  join public.bookings    bk on bk.id = s.booking_id
  join public.bars        b  on b.id  = bk.bar_id
  join public.table_zones z  on z.id  = bk.zone_id
  join public.users       u  on u.id  = bk.user_id
  where s.share_token = p_token and s.revoked_at is null
$$;

revoke all on function public.get_share_card(text) from public;
grant execute on function public.get_share_card(text) to anon, authenticated, service_role;
