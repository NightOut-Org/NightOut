-- =====================================================================
-- รีวิว: เปิดให้รีวิวได้เมื่อการจองมัดจำผ่านแล้ว ไม่ต้องรอเช็กอิน (requirement 2026-10-11 · docs/REQUIREMENTS.md)
-- สถานะที่รีวิวได้: CONFIRMED / CHECKED_IN / COMPLETED / NO_SHOW (= REVIEWABLE_BOOKING_STATUSES ใน @nightout/utils)
-- ยังคง 1 การจอง = 1 รีวิว · รหัส error เปลี่ยนจาก REVIEW_REQUIRES_CHECKIN → REVIEW_REQUIRES_BOOKING
-- =====================================================================

create or replace function public.check_review_booking() returns trigger
language plpgsql set search_path = '' as $$
declare
  b record;
begin
  select status, user_id into b from public.bookings where id = new.booking_id;
  if b.status is null or b.status not in ('CONFIRMED','CHECKED_IN','COMPLETED','NO_SHOW') then
    raise exception 'REVIEW_REQUIRES_BOOKING' using errcode = 'check_violation';
  end if;
  if b.user_id <> new.user_id then
    raise exception 'REVIEW_NOT_OWNER' using errcode = 'check_violation';
  end if;
  return new;
end $$;

-- รีวิว (การจองที่มัดจำผ่านแล้ว 1 ครั้ง) · ไฟล์แนบอัปโหลดเข้า review-media/<user_id>/<review_id>/... ก่อนเรียก
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
  -- คะแนนเฉลี่ยแบบสะสม (ร้านเดโมมีจำนวนรีวิวตั้งต้นจาก seed)
  update public.bar_stats
     set rating_avg = round((coalesce(rating_avg, 0) * rating_count + p_rating)::numeric / (rating_count + 1), 2),
         rating_count = rating_count + 1
   where bar_id = bk.bar_id;
  perform public.app_notify_team(bk.bar_id, 'REVIEW_NEW', 'มีรีวิวใหม่', u.display_name || ' ให้ ' || p_rating || ' ดาว', '/merchant/reviews', bk.id);
  return jsonb_build_object('id', p_review_id, 'bar_id', bk.bar_id);
end $$;


revoke all on function public.app_add_review(uuid, uuid, uuid, integer, text, jsonb) from public, anon, authenticated;
grant execute on function public.app_add_review(uuid, uuid, uuid, integer, text, jsonb) to service_role;
