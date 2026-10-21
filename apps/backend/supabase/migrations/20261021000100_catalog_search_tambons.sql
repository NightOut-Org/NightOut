-- NightOut · ค้นหาตำบล/แขวงทั้งประเทศ (7,425 แห่ง — ใหญ่เกินส่งใน /public/catalog) · ADR 0011
-- GET /public/tambons?q= (พิมพ์ในตัวกรองพื้นที่ของ /search) · ?code= (ชื่อของตำบลที่เลือกไว้ใน URL)
-- ชื่อตำบลซ้ำกันข้ามจังหวัดได้ (เช่น "ในเมือง") → หน้าเว็บกรองด้วยรหัส pcode ไม่ใช่ชื่อ

create index if not exists tambons_name_trgm on public.tambons using gin (name_th extensions.gin_trgm_ops);

create or replace function public.search_tambons(p_q text default null, p_code text default null, p_limit integer default 20)
returns table (code text, name_th text, amphoe_code text, amphoe_th text, province_code text, province_th text)
language sql stable set search_path = '' as $$
  select t.code, t.name_th, a.code, a.name_th, p.code, p.name_th
    from public.tambons t
    join public.amphoes a on a.code = t.amphoe_code
    join public.provinces p on p.code = a.province_code
   where (p_code is not null and t.code = p_code)
      or (p_code is null and length(btrim(coalesce(p_q, ''))) >= 2
          and t.name_th ilike '%' || replace(replace(replace(btrim(p_q), '\', '\\'), '%', '\%'), '_', '\_') || '%')
   order by (t.name_th = btrim(coalesce(p_q, ''))) desc,         -- ชื่อตรงทั้งคำก่อน
            (t.name_th ilike replace(replace(replace(btrim(coalesce(p_q, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%') desc,  -- ขึ้นต้นด้วยคำค้น
            t.name_th, p.name_th
   limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

revoke all on function public.search_tambons(text, text, integer) from public, anon, authenticated;
-- อ่านอย่างเดียวจาก master data สาธารณะ
grant execute on function public.search_tambons(text, text, integer) to anon, authenticated, service_role;
