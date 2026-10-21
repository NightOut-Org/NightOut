-- NightOut · พื้นที่ของร้านหาจากหมุดเอง (นอก MVP — อนุมัติ 2026-10-20)
-- bars.tambon_code + bars.district_id คำนวณจาก lat/lng ทุกครั้งที่หมุดเปลี่ยน (สมัครร้าน · แอดมินอนุมัติ/แก้หมุด)
-- ค่า district_id ที่ส่งมาทาง app_merchant_join / app_update_bar_info / admin_save_bar_details ถูกแทนด้วยค่าจากหมุด
-- (หน้าเว็บไม่ส่งแล้ว — คง signature เดิมไว้เพื่อไม่ต้องประกาศฟังก์ชันยาวซ้ำ)

create or replace function public.bars_set_area()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.tambon_code := public.tambon_at(new.lat::float8, new.lng::float8);
  new.district_id := public.district_near(new.lat::float8, new.lng::float8);
  return new;
end;
$$;
revoke all on function public.bars_set_area() from public, anon, authenticated;

create trigger bars_set_area before insert or update of lat, lng, district_id on public.bars
  for each row execute function public.bars_set_area();

-- ร้านเดิมทั้งหมด (trigger คำนวณให้)
update public.bars set lat = lat;

-- พื้นที่ของร้าน (ตำบล → อำเภอ → จังหวัด) · สิทธิ์ตาม RLS ของ bars (ร้านที่แสดง / ทีมร้าน / แอดมิน)
create or replace view public.bar_areas with (security_invoker = true) as
select
  b.id          as bar_id,
  t.code        as tambon_code,
  t.name_th     as tambon_th,
  a.code        as amphoe_code,
  a.name_th     as amphoe_th,
  p.code        as province_code,
  p.name_th     as province_th
from public.bars b
join public.tambons   t on t.code = b.tambon_code
join public.amphoes   a on a.code = t.amphoe_code
join public.provinces p on p.code = a.province_code;

revoke all on public.bar_areas from anon, authenticated;
grant select on public.bar_areas to anon, authenticated;

-- Backoffice /ranking กรองตามจังหวัด / อำเภอ (GET /admin/views/admin_bar_areas · ADMIN + MFA)
create or replace view public.admin_bar_areas with (security_invoker = true) as
select a.* from public.bar_areas a where public.is_admin();

revoke all on public.admin_bar_areas from anon;
grant select on public.admin_bar_areas to authenticated;
