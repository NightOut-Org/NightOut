-- =====================================================================
-- NightOut · catalog — หน้าจัดอันดับนับเฉพาะการเช็กอินผ่าน NightOut (เจ้าของตัดสิน 2026-10-24)
--   แทนกติกาเดิม (…20261013001030: เรียงตามโหวต แล้วคะแนนรวม · ไม่รวมร้านรีวิว < 5)
--   อันดับ = จำนวนการจองที่เช็กอินในรอบ (checkin_count) มากไปน้อย
--     เท่ากัน = ร้านที่ถึงยอดนั้นก่อนอยู่บน (last_checkin_at = เวลาเช็กอินล่าสุดในรอบ · เก่ากว่า = ดีกว่า)
--     ยังไม่มีเช็กอินในรอบ = ต่อท้าย เรียงตามชื่อร้าน
--   ไม่ใช้คะแนนรวม / ไม่ตัดร้านรีวิวน้อย · ดาว / Tier บนการ์ดร้าน (bar_stats) ยังใช้สูตรเดิมของ run_tier_scores()
--   ยังอ่านจาก tier_scores ที่ job คำนวณทุกคืน 00:05 (+ ปุ่ม "คำนวณใหม่") เหมือนเดิม
--   หลัง db:push: last_checkin_at ของรอบปัจจุบันว่างจนกว่าจะรัน job → กด "คำนวณใหม่" ที่ Backoffice /ranking
-- =====================================================================
set search_path = public, extensions;

alter table public.tier_scores add column if not exists last_checkin_at timestamptz;   -- เช็กอินล่าสุดในรอบ (ตัดสินเมื่อโหวตเท่ากัน)
comment on column public.tier_scores.last_checkin_at is 'เวลาเช็กอินล่าสุดในรอบ · โหวตเท่ากัน = ร้านที่ถึงยอดก่อน (ค่าเก่ากว่า) อยู่บน';

create index if not exists tier_scores_votes on public.tier_scores (period_type, period_start, checkin_count desc, last_checkin_at);

-- ---------------------------------------------------------------------
-- 1. job คำนวณ — เหมือน …20261013001030 + เก็บ last_checkin_at
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
                                  stars, tier, is_new, review_count, checkin_count, last_checkin_at, prev_stars, computed_at)
  select t.bar_id, p.period_type, p.period_start, t.category, t.district_id,
         t.review_score, t.checkin_score, t.safety_score, 0, t.total_score,
         t.stars, t.tier, t.is_new, t.n,
         coalesce(v.votes, 0), v.last_at,
         (select ts.stars from public.tier_scores ts
           where ts.bar_id = t.bar_id and ts.period_type = p.period_type and ts.period_start < p.period_start
           order by ts.period_start desc limit 1),
         v_now
  from tiered t cross join periods p
  left join lateral (
    select count(*)::integer as votes, max(bk.checked_in_at) as last_at
    from public.bookings bk
    where bk.bar_id = t.bar_id and bk.status in ('CHECKED_IN', 'COMPLETED')
      and bk.checked_in_at >= p.from_at and bk.checked_in_at < p.to_at
  ) v on true
  on conflict (bar_id, period_type, period_start) do update set
    category = excluded.category, district_id = excluded.district_id,
    review_score = excluded.review_score, checkin_score = excluded.checkin_score, safety_score = excluded.safety_score,
    price_info_score = excluded.price_info_score, total_score = excluded.total_score,
    stars = excluded.stars, tier = excluded.tier, is_new = excluded.is_new,
    review_count = excluded.review_count, checkin_count = excluded.checkin_count,
    last_checkin_at = excluded.last_checkin_at,
    prev_stars = excluded.prev_stars, computed_at = excluded.computed_at;

  -- ร้านที่ไม่แสดงแล้ว (ระงับ / ติด Blacklist / ไม่อนุมัติ) ออกจากรอบปัจจุบัน
  delete from public.tier_scores ts using public.bars b
   where b.id = ts.bar_id and b.status <> 'APPROVED'
     and ((ts.period_type = 'WEEKLY' and ts.period_start = v_week) or (ts.period_type = 'MONTHLY' and ts.period_start = v_month));

  -- อันดับดาวของรอบปัจจุบัน (ไม่รวมร้านใหม่ · ไม่มีย่าน = ไม่มีอันดับในย่าน) — Backoffice /ranking
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
-- 2. อันดับสาธารณะ — เช็กอินล้วน (เปลี่ยนคอลัมน์ที่คืน → drop ก่อน)
-- ---------------------------------------------------------------------
drop function if exists public.public_ranking(public.rank_period, public.bar_category, integer);

create function public.public_ranking(p_period public.rank_period default 'WEEKLY',
                                      p_category public.bar_category default null,
                                      p_limit integer default 10)
returns table (bar_id uuid, rank integer, votes integer, last_checkin_at timestamptz,
               stars smallint, tier public.tier_letter, is_new boolean, period_start date, computed_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select t.bar_id,
         (row_number() over (order by t.checkin_count desc, t.last_checkin_at asc nulls last, b.name, t.bar_id))::integer,
         t.checkin_count, t.last_checkin_at, t.stars, t.tier, t.is_new, t.period_start, t.computed_at
  from public.tier_scores t
  join public.bars b on b.id = t.bar_id
  where t.period_type = coalesce(p_period, 'WEEKLY'::public.rank_period)
    and t.period_start = (select max(x.period_start) from public.tier_scores x
                           where x.period_type = coalesce(p_period, 'WEEKLY'::public.rank_period))
    and (p_category is null or t.category = p_category)
    and public.bar_is_public(t.bar_id)
  order by t.checkin_count desc, t.last_checkin_at asc nulls last, b.name, t.bar_id
  limit least(greatest(coalesce(p_limit, 10), 1), 50)
$$;

-- ---------------------------------------------------------------------
-- 3. สิทธิ์
-- ---------------------------------------------------------------------
revoke all on function public.run_tier_scores() from public, anon, authenticated;
grant execute on function public.run_tier_scores() to service_role;

revoke all on function public.public_ranking(public.rank_period, public.bar_category, integer) from public;
grant execute on function public.public_ranking(public.rank_period, public.bar_category, integer) to anon, authenticated, service_role;
