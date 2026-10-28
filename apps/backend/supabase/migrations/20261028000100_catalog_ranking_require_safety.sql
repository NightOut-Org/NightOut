-- =====================================================================
-- หน้าจัดอันดับ: ร้านที่ Safety 0/100 ไม่ติดอันดับ (ตกลง 2026-10-28)
--   public_ranking กรอง bar_stats.safety_score > 0 (ค่าสด ไม่รอ job · null = 0)
--   อันดับนับใหม่หลังกรอง (row_number ต่อเนื่อง) · สูตรดาว/คะแนน (run_tier_scores) เหมือนเดิม
-- =====================================================================

create or replace function public.public_ranking(p_period public.rank_period default 'WEEKLY',
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
  join public.bar_stats st on st.bar_id = t.bar_id
  where t.period_type = coalesce(p_period, 'WEEKLY'::public.rank_period)
    and t.period_start = (select max(x.period_start) from public.tier_scores x
                           where x.period_type = coalesce(p_period, 'WEEKLY'::public.rank_period))
    and (p_category is null or t.category = p_category)
    and public.bar_is_public(t.bar_id)
    and coalesce(st.safety_score, 0) > 0
  order by t.checkin_count desc, t.last_checkin_at asc nulls last, b.name, t.bar_id
  limit least(greatest(coalesce(p_limit, 10), 1), 50)
$$;

revoke all on function public.public_ranking(public.rank_period, public.bar_category, integer) from public;
grant execute on function public.public_ranking(public.rank_period, public.bar_category, integer) to anon, authenticated, service_role;
