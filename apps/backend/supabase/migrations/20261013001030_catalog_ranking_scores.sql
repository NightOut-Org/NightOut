-- =====================================================================
-- NightOut · catalog — คำนวณคะแนน / ดาว / อันดับร้าน (tier_scores + bar_stats) — เจ้าของตัดสิน 2026-10-13
--   สูตร (ต้องตรงกับ rankingScore() ใน packages/utils/src/ranking.ts · ปัด round(x, 2) ทุกส่วน):
--     รีวิว 0–50   = 50 × (avg_b − 1) / 4 · avg_b = (5 × 3.5 + rating_avg × n) / (5 + n)   (Bayesian · n = rating_count
--                    · rating_avg null หรือ n ≤ 0 → n = 0) · clamp 0–50
--     เช็กอิน 0–30 = 30 × min(1, ln(1 + c) / ln(31))   (c = การจองที่เช็กอินใน 90 วันล่าสุด · ติดลบ = 0)
--     Safety 0–20  = 20 × clamp(bar_stats.safety_score, 0, 100) / 100   (null = 0)
--     รวม          = c ≥ 1: round(min(100, รีวิว + เช็กอิน + Safety), 2)
--                    c = 0: round(min(100, (รีวิว + Safety) × 100 / 70), 2)   (เจ้าของตัดสิน — ไม่ลงโทษร้านที่ยังไม่มีข้อมูลเช็กอิน)
--     ดาว          = rating_count < 5 → ร้านใหม่ (ไม่มีดาว) · ≥ 90 = 5★ S · ≥ 75 = 4★ A · ≥ 60 = 3★ B · ≥ 40 = 2★ C · ต่ำกว่า = 1★ C
--     ไม่มีคะแนนความครบของราคา (price_info_score = 0) · โฆษณา / โปรโมทไม่มีผล
--   รอบ: WEEKLY (จันทร์ เวลาไทย) + MONTHLY (วันที่ 1) ของวันนี้ · โหวต = การจองที่เช็กอินในรอบนั้น (checkin_count)
--     อันดับในประเภทร้าน / ในย่าน (ไม่รวมร้านใหม่) · bar_stats.score / current_stars / current_tier / is_new = รอบสัปดาห์ล่าสุด
--
--   ตั้ง pg_cron หลัง deploy (แทนบรรทัด /api/jobs/tier?period=WEEKLY ในหัวไฟล์ …20261002001400):
--   select cron.schedule('nightout-tier', '5 17 * * *', $$ select net.http_post(url := (select decrypted_secret from vault.decrypted_secrets where name = 'api_url') || '/api/jobs/tier', headers := jsonb_build_object('x-job-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'job_secret'))) $$);  -- 00:05 เวลาไทยทุกคืน
--
--   หมายเหตุ deploy: seed ไม่มีแถว tier_scores และ migration นี้ไม่รัน job → /public/ranking ว่างจนกว่าจะรันครั้งแรก
--     หลัง db:push / supabase db reset กด "คำนวณใหม่" ที่ Backoffice /ranking ครั้งแรก หรือเรียก /api/jobs/tier
-- =====================================================================
set search_path = public, extensions;

create index if not exists bookings_bar_checked_in on public.bookings (bar_id, checked_in_at) where checked_in_at is not null;

-- ---------------------------------------------------------------------
-- 1. job คำนวณคะแนน (ทุกคืน + ปุ่ม "คำนวณใหม่")
-- ---------------------------------------------------------------------
create or replace function public.run_tier_scores() returns jsonb
language plpgsql set search_path = '' as $$
declare v_run bigint; v_now timestamptz := now(); v_today date; v_week date; v_month date; v_bars integer;
begin
  insert into public.job_runs (job) values ('tier') returning id into v_run;
  v_today := (v_now at time zone 'Asia/Bangkok')::date;
  -- cast เป็น timestamp (ไม่มี time zone) ก่อน → TimeZone ของ session ไม่ทำให้ขอบรอบเลื่อน
  v_week  := date_trunc('week', v_today::timestamp)::date;    -- จันทร์
  v_month := date_trunc('month', v_today::timestamp)::date;

  with base as (
    select b.id as bar_id, b.category, b.district_id,
           coalesce(st.rating_count, 0) as n,
           case when st.rating_avg is null or coalesce(st.rating_count, 0) <= 0 then 0 else st.rating_count end::numeric as n_eff,
           coalesce(st.rating_avg, 0)::numeric as avg,
           least(greatest(coalesce(st.safety_score, 0), 0), 100)::numeric as safety,
           (select count(*) from public.bookings bk
             where bk.bar_id = b.id and bk.status in ('CHECKED_IN', 'COMPLETED')
               and bk.checked_in_at >= v_now - interval '90 days')::integer as checkins
    from public.bars b
    left join public.bar_stats st on st.bar_id = b.id
    where b.status = 'APPROVED'
  ), parts as (
    select base.*,
           round(least(50, greatest(0, 50 * ((5 * 3.5 + avg * n_eff) / (5 + n_eff) - 1) / 4)), 2) as review_score,
           round(30 * least(1, ln(1 + greatest(checkins, 0)::numeric) / ln(31::numeric)), 2) as checkin_score,
           round(20 * safety / 100, 2) as safety_score
    from base
  ), scored as (
    select parts.*,
           case when checkins > 0 then round(least(100, review_score + checkin_score + safety_score), 2)
                else round(least(100, (review_score + safety_score) * 100.0 / 70), 2) end as total_score
    from parts
  ), starred as (
    select scored.*, (n < 5) as is_new,
           (case when n < 5 then null when total_score >= 90 then 5 when total_score >= 75 then 4
                 when total_score >= 60 then 3 when total_score >= 40 then 2 else 1 end)::smallint as stars
    from scored
  ), tiered as (
    select starred.*,
           (case when stars is null then null when stars = 5 then 'S' when stars = 4 then 'A'
                 when stars = 3 then 'B' else 'C' end)::public.tier_letter as tier
    from starred
  ), periods (period_type, period_start, from_at, to_at) as (
    values ('WEEKLY'::public.rank_period, v_week,
            v_week::timestamp at time zone 'Asia/Bangkok', (v_week + 7)::timestamp at time zone 'Asia/Bangkok'),
           ('MONTHLY'::public.rank_period, v_month,
            v_month::timestamp at time zone 'Asia/Bangkok', (v_month + interval '1 month') at time zone 'Asia/Bangkok')
  )
  insert into public.tier_scores (bar_id, period_type, period_start, category, district_id,
                                  review_score, checkin_score, safety_score, price_info_score, total_score,
                                  stars, tier, is_new, review_count, checkin_count, prev_stars, computed_at)
  select t.bar_id, p.period_type, p.period_start, t.category, t.district_id,
         t.review_score, t.checkin_score, t.safety_score, 0, t.total_score,
         t.stars, t.tier, t.is_new, t.n,
         (select count(*) from public.bookings bk
           where bk.bar_id = t.bar_id and bk.status in ('CHECKED_IN', 'COMPLETED')
             and bk.checked_in_at >= p.from_at and bk.checked_in_at < p.to_at)::integer,
         (select ts.stars from public.tier_scores ts
           where ts.bar_id = t.bar_id and ts.period_type = p.period_type and ts.period_start < p.period_start
           order by ts.period_start desc limit 1),
         v_now
  from tiered t cross join periods p
  on conflict (bar_id, period_type, period_start) do update set
    category = excluded.category, district_id = excluded.district_id,
    review_score = excluded.review_score, checkin_score = excluded.checkin_score, safety_score = excluded.safety_score,
    price_info_score = excluded.price_info_score, total_score = excluded.total_score,
    stars = excluded.stars, tier = excluded.tier, is_new = excluded.is_new,
    review_count = excluded.review_count, checkin_count = excluded.checkin_count,
    prev_stars = excluded.prev_stars, computed_at = excluded.computed_at;

  -- ร้านที่ไม่แสดงแล้ว (ระงับ / ติด Blacklist / ไม่อนุมัติ) ออกจากรอบปัจจุบัน
  delete from public.tier_scores ts using public.bars b
   where b.id = ts.bar_id and b.status <> 'APPROVED'
     and ((ts.period_type = 'WEEKLY' and ts.period_start = v_week) or (ts.period_type = 'MONTHLY' and ts.period_start = v_month));

  -- อันดับของรอบปัจจุบัน (ไม่รวมร้านใหม่ · ไม่มีย่าน = ไม่มีอันดับในย่าน)
  with r as (
    select ts.id,
           case when ts.is_new then null
                else rank() over (partition by ts.period_type, ts.category, ts.is_new order by ts.total_score desc) end as rc,
           case when ts.is_new or ts.district_id is null then null
                else rank() over (partition by ts.period_type, ts.district_id, ts.is_new order by ts.total_score desc) end as rd
    from public.tier_scores ts
    where (ts.period_type = 'WEEKLY' and ts.period_start = v_week) or (ts.period_type = 'MONTHLY' and ts.period_start = v_month)
  )
  update public.tier_scores t set rank_in_category = r.rc, rank_in_district = r.rd
  from r where r.id = t.id and (t.rank_in_category, t.rank_in_district) is distinct from (r.rc, r.rd);

  -- คะแนน / ดาวที่การ์ดร้านแสดง = รอบสัปดาห์ล่าสุด
  update public.bar_stats st set score = t.total_score, current_stars = t.stars, current_tier = t.tier, is_new = t.is_new
  from public.tier_scores t
  where t.bar_id = st.bar_id and t.period_type = 'WEEKLY' and t.period_start = v_week
    and (st.score, st.current_stars, st.current_tier, st.is_new) is distinct from (t.total_score, t.stars, t.tier, t.is_new);

  select count(*) into v_bars from public.tier_scores where period_type = 'WEEKLY' and period_start = v_week;
  update public.job_runs set finished_at = now(), processed = v_bars where id = v_run;
  return jsonb_build_object('bars', v_bars, 'weekly_period_start', v_week, 'monthly_period_start', v_month, 'computed_at', v_now);
end $$;

-- ---------------------------------------------------------------------
-- 2. ปุ่ม "คำนวณใหม่" (แอดมิน)
-- ---------------------------------------------------------------------
create or replace function public.admin_recompute_ranking(p_actor uuid) returns jsonb
language plpgsql set search_path = '' as $$
declare r jsonb;
begin
  perform public.admin_assert(p_actor);
  r := public.run_tier_scores();
  perform public.admin_audit(p_actor, 'ranking.recompute', 'tier_scores', null, null, r);
  return r;
end $$;

-- ---------------------------------------------------------------------
-- 3. อันดับสาธารณะ (รอบล่าสุด · เรียงตามโหวตแล้วคะแนนรวม · ไม่รวมร้านใหม่ · เฉพาะร้านที่แสดงอยู่ตอนนี้)
-- ---------------------------------------------------------------------
create or replace function public.public_ranking(p_period public.rank_period default 'WEEKLY',
                                                 p_category public.bar_category default null,
                                                 p_limit integer default 10)
returns table (bar_id uuid, rank integer, votes integer, total_score numeric, stars smallint,
               tier public.tier_letter, period_start date, computed_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select t.bar_id,
         (row_number() over (order by t.checkin_count desc, t.total_score desc, t.bar_id))::integer,
         t.checkin_count, t.total_score, t.stars, t.tier, t.period_start, t.computed_at
  from public.tier_scores t
  where t.period_type = coalesce(p_period, 'WEEKLY'::public.rank_period)
    and t.period_start = (select max(x.period_start) from public.tier_scores x
                           where x.period_type = coalesce(p_period, 'WEEKLY'::public.rank_period))
    and not t.is_new
    and (p_category is null or t.category = p_category)
    and public.bar_is_public(t.bar_id)
  order by t.checkin_count desc, t.total_score desc, t.bar_id
  limit least(greatest(coalesce(p_limit, 10), 1), 50)
$$;

-- ---------------------------------------------------------------------
-- 4. view ของ Backoffice /ranking (ร้านที่แสดงอยู่ + รอบสัปดาห์ / เดือนล่าสุดของทั้งระบบ)
-- ---------------------------------------------------------------------
create or replace view public.admin_ranking with (security_invoker = true) as
select
  b.id, b.slug, b.name, b.category, b.district_id,
  case when d.id is null then null else jsonb_build_object('id', d.id, 'slug', d.slug, 'name_th', d.name_th) end as district,
  st.rating_avg, coalesce(st.rating_count, 0) as rating_count, st.safety_score as safety_percent,
  w.review_score, w.checkin_score, w.safety_score, w.total_score, w.stars, w.tier, coalesce(w.is_new, true) as is_new,
  w.rank_in_category, w.rank_in_district, w.prev_stars,
  coalesce(w.checkin_count, 0) as votes_week, coalesce(m.checkin_count, 0) as votes_month,
  w.computed_at, public.bar_is_promoted(b.id) as is_promoted
from public.bars b
left join public.districts d  on d.id = b.district_id
left join public.bar_stats st on st.bar_id = b.id
left join public.tier_scores w on w.bar_id = b.id and w.period_type = 'WEEKLY'
  and w.period_start = (select max(x.period_start) from public.tier_scores x where x.period_type = 'WEEKLY')
left join public.tier_scores m on m.bar_id = b.id and m.period_type = 'MONTHLY'
  and m.period_start = (select max(x.period_start) from public.tier_scores x where x.period_type = 'MONTHLY')
where b.status = 'APPROVED' and public.is_admin();

-- ---------------------------------------------------------------------
-- 5. สิทธิ์
-- ---------------------------------------------------------------------
revoke all on function public.run_tier_scores() from public, anon, authenticated;
revoke all on function public.admin_recompute_ranking(uuid) from public, anon, authenticated;
grant execute on function public.run_tier_scores() to service_role;
grant execute on function public.admin_recompute_ranking(uuid) to service_role;

revoke all on function public.public_ranking(public.rank_period, public.bar_category, integer) from public;
grant execute on function public.public_ranking(public.rank_period, public.bar_category, integer) to anon, authenticated, service_role;

revoke all on public.admin_ranking from anon;
grant select on public.admin_ranking to authenticated;
