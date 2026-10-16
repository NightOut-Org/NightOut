-- =====================================================================
-- รีวิว: คะแนนเฉลี่ย / จำนวนรีวิวของร้าน (bar_stats.rating_avg / rating_count) คิดจากรีวิวจริงเท่านั้น
-- เดิม: seed ใส่ตัวเลขตั้งต้นปลอม (เช่น 978) แล้ว app_add_review บวกเพิ่มทีละ 1 → หน้าร้าน "979 รีวิว" แต่แท็บรีวิวมี 1
--       และซ่อน/ลบรีวิวแล้วตัวเลขไม่ลด
-- ใหม่: refresh_bar_rating() นับจากรีวิว PUBLISHED · trigger บน reviews เรียกทุกครั้งที่เพิ่ม/แก้คะแนน/เปลี่ยนสถานะ/ลบ
--       app_add_review เลิกบวกเอง (trigger ทำให้) · คำนวณใหม่ทุกร้านท้ายไฟล์
-- คะแนนรีวิวเป็นส่วนหนึ่งของ rankingScore → หลัง db:push กด "คำนวณใหม่" ที่ Backoffice /ranking
-- =====================================================================

create or replace function public.refresh_bar_rating(p_bar uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.bar_stats st
     set rating_avg   = agg.avg_rating,
         rating_count = agg.n
    from (select round(avg(r.rating)::numeric, 2) as avg_rating, count(*)::integer as n
            from public.reviews r
           where r.bar_id = p_bar and r.status = 'PUBLISHED') agg
   where st.bar_id = p_bar;
end $$;

create or replace function public.reviews_refresh_bar_rating() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then perform public.refresh_bar_rating(old.bar_id); end if;
  if tg_op in ('INSERT', 'UPDATE') and (tg_op = 'INSERT' or new.bar_id is distinct from old.bar_id) then
    perform public.refresh_bar_rating(new.bar_id);
  end if;
  return null;
end $$;

drop trigger if exists reviews_refresh_bar_rating on public.reviews;
create trigger reviews_refresh_bar_rating
  after insert or delete or update of rating, status, bar_id on public.reviews
  for each row execute function public.reviews_refresh_bar_rating();

-- app_add_review ตัวล่าสุด (…20261011000200) ตัดการบวก rating_count เอง — trigger ด้านบนคำนวณให้
create or replace function public.app_add_review(p_actor uuid, p_booking uuid, p_review_id uuid, p_rating integer,
                                                 p_comment text, p_media jsonb default '[]'::jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare u public.users; bk public.bookings; m jsonb; v_prefix text; i integer := 0;
begin
  u := public.app_assert_user(p_actor);
  select * into bk from public.bookings where id = p_booking;
  if not found or bk.user_id <> p_actor then raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0002'; end if;
  if bk.status not in ('CONFIRMED','CHECKED_IN','COMPLETED','NO_SHOW') then raise exception 'REVIEW_REQUIRES_BOOKING' using errcode = 'P0001'; end if;
  if exists (select 1 from public.reviews where booking_id = bk.id) then raise exception 'REVIEW_EXISTS' using errcode = 'P0001'; end if;
  if p_rating is null or p_rating not between 1 and 5 then raise exception 'INVALID_RATING' using errcode = '22023'; end if;
  if jsonb_typeof(coalesce(p_media, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_media, '[]'::jsonb)) > 6 then
    raise exception 'REVIEW_MEDIA_LIMIT' using errcode = '22023';
  end if;
  insert into public.reviews (id, booking_id, user_id, bar_id, rating, comment, has_media)
  values (coalesce(p_review_id, gen_random_uuid()), bk.id, p_actor, bk.bar_id, p_rating, nullif(trim(p_comment), ''),
          jsonb_array_length(coalesce(p_media, '[]'::jsonb)) > 0)
  returning id into p_review_id;
  v_prefix := p_actor::text || '/' || p_review_id::text || '/';
  for m in select * from jsonb_array_elements(coalesce(p_media, '[]'::jsonb)) loop
    if left(m->>'path', length(v_prefix)) <> v_prefix then raise exception 'INVALID_MEDIA_PATH' using errcode = '22023'; end if;
    insert into public.review_media (review_id, kind, storage_path, thumb_path, duration_sec, size_bytes, sort_order)
    values (p_review_id, coalesce(m->>'kind', 'IMAGE')::public.media_kind, m->>'path',
            case when left(m->>'thumb_path', length(v_prefix)) = v_prefix then m->>'thumb_path' end,
            nullif(m->>'duration_sec', '')::numeric::smallint, nullif(m->>'size_bytes', '')::integer, i);
    i := i + 1;
  end loop;
  perform public.app_notify_team(bk.bar_id, 'REVIEW_NEW', 'มีรีวิวใหม่', u.display_name || ' ให้ ' || p_rating || ' ดาว', '/merchant/reviews', bk.id);
  return jsonb_build_object('id', p_review_id, 'bar_id', bk.bar_id);
end $$;

-- คำนวณใหม่ทุกร้านจากรีวิวจริง (ร้านที่ไม่มีรีวิว → avg null · count 0)
update public.bar_stats st
   set rating_avg   = agg.avg_rating,
       rating_count = coalesce(agg.n, 0)
  from public.bar_stats s
  left join lateral (select round(avg(r.rating)::numeric, 2) as avg_rating, count(*)::integer as n
                       from public.reviews r
                      where r.bar_id = s.bar_id and r.status = 'PUBLISHED') agg on true
 where st.bar_id = s.bar_id;

revoke all on function public.refresh_bar_rating(uuid) from public, anon, authenticated;
revoke all on function public.reviews_refresh_bar_rating() from public, anon, authenticated;
grant execute on function public.refresh_bar_rating(uuid) to service_role;
revoke all on function public.app_add_review(uuid, uuid, uuid, integer, text, jsonb) from public, anon, authenticated;
grant execute on function public.app_add_review(uuid, uuid, uuid, integer, text, jsonb) to service_role;
