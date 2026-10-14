-- =====================================================================
-- NightOut · community — สิทธิ์ทีมร้านในชุมชน (Phase 1 · นอก MVP อนุมัติ 2026-10-11)
--   - "ทีมร้าน" = bar_staff ที่รับคำเชิญแล้วและยังไม่ถูกถอด ของร้านที่เคยเปิดแสดง (APPROVED / SUSPENDED รวมติด Blacklist) · ทุกบทบาท
--       ร้าน SUSPENDED: ยังมีป้าย แต่ตั้งข่าวไม่ได้ (ต้องแท็กร้านที่แสดงอยู่) · ร้าน DRAFT / PENDING_REVIEW / REJECTED = ลูกค้าปกติ
--   - ป้าย "ทีมร้าน · <ชื่อร้าน>": community_threads.team_bar_id / community_comments.team_bar_id = snapshot ตอนโพสต์
--       (ร้านที่แท็กถ้าอยู่ทีมนั้น ไม่งั้นร้านแรกที่เข้าทีม) · แก้กระทู้ตอนอยู่ทีม = คำนวณใหม่ · ข้อมูลเดิม backfill จากทีมปัจจุบัน
--   - หมวดใหม่ "ข่าวจากร้าน" (shop-news · team_only) — เฉพาะทีมร้าน ต้องแท็กร้านตัวเอง ≤ 3 กระทู้/ร้าน ใน 7 วันล่าสุด
--       (นับทุกสถานะ รวมที่ลบ/ถูกซ่อน) · เปลี่ยนหมวด/ร้านที่แท็กหลังโพสต์ไม่ได้
--   - ทีมร้านตั้งกระทู้หมวดอื่นไม่ได้ (คอมเมนต์/ตอบได้ทุกกระทู้ · กระทู้เก่าก่อนเข้าทีมแก้ได้ในหมวดเดิม
--       แต่แท็กร้านที่ตัวเองอยู่ทีมเพิ่มนอกหมวดข่าวไม่ได้ — COMMUNITY_TEAM_OWN_TAG)
--   - ถูกใจของทีมร้านในกระทู้ที่แท็กร้านตัวเอง (กระทู้ + ความเห็นในกระทู้นั้น) counted = false → ไม่นับใน like_count
--   - ร้านมาแรง (community_trending_bars) ไม่นับกระทู้ที่ทีมร้านแท็กร้านตัวเอง · เสมอกันเรียงตามยอดถูกใจที่นับ
--   - อ่าน my_community_team() · view admin_community_* + team_bar, excluded_like_count
-- =====================================================================
set search_path = public, extensions;

-- ---------------------------------------------------------------------
-- 1. คอลัมน์ + หมวดใหม่
-- ---------------------------------------------------------------------
alter table public.community_categories add column team_only boolean not null default false;   -- ตั้งได้เฉพาะทีมร้าน
alter table public.community_categories add constraint community_categories_scope_check check (not (staff_only and team_only));
insert into public.community_categories (slug, name, sort_order, staff_only, team_only)
values ('shop-news', 'ข่าวจากร้าน', 7, false, true)
on conflict (slug) do update set name = excluded.name, staff_only = false, team_only = true, is_active = true;

alter table public.community_threads  add column team_bar_id uuid references public.bars(id) on delete set null;
alter table public.community_comments add column team_bar_id uuid references public.bars(id) on delete set null;
create index community_threads_team_bar_id_fk  on public.community_threads (team_bar_id);
create index community_comments_team_bar_id_fk on public.community_comments (team_bar_id);

alter table public.community_thread_likes  add column counted boolean not null default true;   -- false = ทีมร้านถูกใจในกระทู้ที่แท็กร้านตัวเอง
alter table public.community_comment_likes add column counted boolean not null default true;

-- ---------------------------------------------------------------------
-- 2. ตัวช่วย (service_role / ฟังก์ชัน security definer ใช้ภายใน)
-- ---------------------------------------------------------------------
-- อยู่ในทีมของร้านนี้ (รับคำเชิญแล้ว · ยังไม่ถูกถอด · ร้านเคยเปิดแสดง: APPROVED / SUSPENDED) — ทุกบทบาท
create or replace function public.community_is_team(p_user uuid, p_bar uuid) returns boolean
language sql stable set search_path = '' as $$
  select p_user is not null and p_bar is not null and exists (
    select 1 from public.bar_staff s join public.bars b on b.id = s.bar_id
    where s.user_id = p_user and s.bar_id = p_bar and s.accepted_at is not null and s.revoked_at is null
      and b.status in ('APPROVED', 'SUSPENDED'))
$$;

-- ร้านสำหรับป้ายทีมร้าน: p_prefer (ร้านที่แท็ก) ถ้าอยู่ทีมนั้น · ไม่งั้นร้านที่แสดงอยู่ก่อนร้านที่ถูกระงับ แล้วร้านแรกที่เข้าทีม · null = ไม่ใช่ทีมร้าน
create or replace function public.community_team_bar(p_user uuid, p_prefer uuid default null) returns uuid
language sql stable set search_path = '' as $$
  select s.bar_id from public.bar_staff s join public.bars b on b.id = s.bar_id
  where s.user_id = p_user and s.accepted_at is not null and s.revoked_at is null and b.status in ('APPROVED', 'SUSPENDED')
  order by (s.bar_id = p_prefer) is true desc, (b.status = 'APPROVED') desc, s.accepted_at, s.bar_id
  limit 1
$$;

-- ป้าย {id, slug, name} · slug = null เมื่อร้านไม่แสดงแล้ว · p_bar null = null
create or replace function public.community_team_badge(p_bar uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('id', b.id, 'slug', case when b.status = 'APPROVED' then b.slug::text end, 'name', b.name)
  from public.bars b where b.id = p_bar
$$;

-- ข่าวจากร้าน (หมวด team_only) ที่ร้านนี้ตั้งใน 7 วันล่าสุด — นับทุกสถานะ (ลบแล้วโพสต์ใหม่ไม่ได้โควตาคืน)
create or replace function public.community_shop_news_used(p_bar uuid) returns integer
language sql stable set search_path = '' as $$
  select count(*)::integer from public.community_threads t
  join public.community_categories c on c.slug = t.category and c.team_only
  where t.bar_id = p_bar and t.created_at > now() - interval '7 days'
$$;

-- กติกาทีมร้าน (เรียกหลัง community_thread_check) · คืน team_bar_id ที่จะเก็บในกระทู้ (null = ไม่ใช่ทีมร้าน)
--   p_old = กระทู้เดิม (แก้กระทู้) · null = ตั้งใหม่ · โควตา 3/ร้าน/7 วัน ต้องตรงกับ COMMUNITY_SHOP_NEWS_WEEKLY_MAX
create or replace function public.community_team_rules(p_user public.users, p_category text, p_bar uuid,
                                                       p_old public.community_threads default null)
returns uuid language plpgsql set search_path = '' as $$
declare
  c public.community_categories;
  v_old_team_only boolean := false;
  v_team boolean := exists (
    select 1 from public.bar_staff s join public.bars b on b.id = s.bar_id
    where s.user_id = p_user.id and s.accepted_at is not null and s.revoked_at is null
      and b.status in ('APPROVED', 'SUSPENDED'));
begin
  select * into c from public.community_categories where slug = p_category;
  if p_old.id is not null then
    select g.team_only into v_old_team_only from public.community_categories g where g.slug = p_old.category;
  end if;

  if c.team_only or coalesce(v_old_team_only, false) then
    -- ข่าวจากร้าน: หมวด/ร้านที่แท็กล็อกหลังโพสต์ · ย้ายกระทู้อื่นมาเป็นข่าวไม่ได้
    if p_old.id is not null and (p_old.category <> p_category or p_old.bar_id is distinct from p_bar) then
      raise exception 'COMMUNITY_SHOP_NEWS_LOCKED' using errcode = '22023';
    end if;
    if not v_team then raise exception 'COMMUNITY_CATEGORY_TEAM_ONLY' using errcode = '42501'; end if;
    if not public.community_is_team(p_user.id, p_bar) then
      raise exception 'COMMUNITY_SHOP_NEWS_OWN_BAR' using errcode = '42501';
    end if;
    if p_old.id is null then
      perform pg_advisory_xact_lock(hashtextextended('community:shop-news:' || p_bar::text, 0));   -- กันโพสต์พร้อมกันเกินโควตา
      if public.community_shop_news_used(p_bar) >= 3 then
        raise exception 'COMMUNITY_SHOP_NEWS_LIMIT' using errcode = 'P0001';
      end if;
    end if;
    return p_bar;
  end if;

  -- หมวดทั่วไป: ทีมร้านตั้งใหม่/ย้ายหมวดไม่ได้ (แก้กระทู้เดิมในหมวดเดิมได้) · หมวด staff_only ตรวจใน community_thread_check แล้ว
  if v_team and not c.staff_only and (p_old.id is null or p_old.category <> p_category) then
    raise exception 'COMMUNITY_TEAM_CATEGORY' using errcode = '42501';
  end if;
  -- แก้กระทู้เดิมในหมวดทั่วไป: แท็กร้านที่ตัวเองอยู่ทีมเพิ่มไม่ได้ (กันใช้กระทู้เก่าเป็นข่าวร้านนอกโควตา) · คงแท็กเดิมได้
  if v_team and p_bar is not null and p_old.bar_id is distinct from p_bar and public.community_is_team(p_user.id, p_bar) then
    raise exception 'COMMUNITY_TEAM_OWN_TAG' using errcode = '42501';
  end if;
  -- ป้าย: ตั้งใหม่ / แก้ตอนอยู่ทีม = คำนวณใหม่ (เลือกร้านที่แท็กก่อน → ร้านมาแรงไม่นับเมื่อแท็กร้านตัวเอง)
  --       แก้ตอนไม่อยู่ทีมแล้ว = คงป้ายเดิม
  if p_old.id is null or v_team then
    return public.community_team_bar(p_user.id, p_bar);
  end if;
  return p_old.team_bar_id;
end $$;

-- คำนวณ counted ของถูกใจทั้งกระทู้ใหม่ (ทีมของร้านที่แท็ก = ไม่นับ) แล้วนับ like_count ของกระทู้ + ทุกความเห็นในกระทู้ใหม่
-- ใช้ตอนร้านที่แท็กเปลี่ยน และตอน backfill (ใช้ทีมปัจจุบัน)
create or replace function public.community_refresh_likes(p_thread uuid) returns void
language plpgsql set search_path = '' as $$
declare v_bar uuid;
begin
  select bar_id into v_bar from public.community_threads where id = p_thread;
  update public.community_thread_likes l set counted = not public.community_is_team(l.user_id, v_bar)
   where l.thread_id = p_thread and l.counted is distinct from not public.community_is_team(l.user_id, v_bar);
  update public.community_comment_likes l set counted = not public.community_is_team(l.user_id, v_bar)
    from public.community_comments c
   where c.id = l.comment_id and c.thread_id = p_thread
     and l.counted is distinct from not public.community_is_team(l.user_id, v_bar);
  -- อัปเดตเฉพาะแถวที่ยอดเปลี่ยน (กัน trigger updated_at ของทุกกระทู้ตอน backfill)
  update public.community_threads t
     set like_count = x.n
    from (select count(*)::integer as n from public.community_thread_likes l where l.thread_id = p_thread and l.counted) x
   where t.id = p_thread and t.like_count is distinct from x.n;
  update public.community_comments c
     set like_count = x.n
    from (select c2.id, (select count(*)::integer from public.community_comment_likes l where l.comment_id = c2.id and l.counted) as n
            from public.community_comments c2 where c2.thread_id = p_thread) x
   where c.id = x.id and c.like_count is distinct from x.n;
end $$;

-- ---------------------------------------------------------------------
-- 3. Backfill (ทีมปัจจุบัน)
-- ---------------------------------------------------------------------
-- เฉพาะแถวที่ได้ป้ายจริง (ไม่แตะกระทู้อื่น → updated_at ไม่เปลี่ยนทั้งตาราง)
update public.community_threads t set team_bar_id = public.community_team_bar(t.author_id, t.bar_id)
 where t.team_bar_id is null and t.status <> 'DELETED'
   and public.community_team_bar(t.author_id, t.bar_id) is not null;
update public.community_comments c set team_bar_id = public.community_team_bar(c.author_id, t.bar_id)
  from public.community_threads t
 where t.id = c.thread_id and c.team_bar_id is null and c.status <> 'DELETED'
   and public.community_team_bar(c.author_id, t.bar_id) is not null;
do $$ declare r record; begin
  for r in select id from public.community_threads where bar_id is not null loop
    perform public.community_refresh_likes(r.id);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 4. อ่าน
-- ---------------------------------------------------------------------
-- หมวด + team_only
create or replace function public.community_categories_list() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'slug', c.slug, 'name', c.name, 'sort_order', c.sort_order, 'staff_only', c.staff_only, 'team_only', c.team_only,
           'thread_count', (select count(*) from public.community_threads t where t.category = c.slug and t.status = 'PUBLISHED'))
         order by c.sort_order), '[]'::jsonb)
  from public.community_categories c where c.is_active
$$;

-- 1 แถวในฟีด — author + team (ป้ายทีมร้านตอนโพสต์)
create or replace function public.community_thread_row(t public.community_threads, p_me uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', t.id,
    'title', t.title,
    'excerpt', left(regexp_replace(t.body, '\s+', ' ', 'g'), 160),
    'category', t.category,
    'category_name', (select c.name from public.community_categories c where c.slug = t.category),
    'author', public.community_author(t.author_id) || jsonb_build_object('team', public.community_team_badge(t.team_bar_id)),
    'bar', public.community_bar(t.bar_id),
    'status', t.status,
    'reply_count', t.reply_count,
    'like_count', t.like_count,
    'view_count', t.view_count,
    'created_at', t.created_at,
    'last_activity_at', t.last_activity_at,
    'edited_at', t.edited_at,
    'is_mine', p_me is not null and t.author_id = p_me,
    'is_pinned', p_me is not null and exists (select 1 from public.community_pins p where p.user_id = p_me and p.thread_id = t.id),
    'is_saved', p_me is not null and exists (select 1 from public.community_saves s where s.user_id = p_me and s.thread_id = t.id),
    'is_liked', p_me is not null and exists (select 1 from public.community_thread_likes l where l.user_id = p_me and l.thread_id = t.id))
$$;

-- กระทู้ + ความเห็น (ความเห็นมี author.team) — นอกนั้นเหมือน 20261012000800
create or replace function public.community_thread(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); t public.community_threads;
begin
  select * into t from public.community_threads where id = p_id;
  if not found or not (t.status = 'PUBLISHED' or (t.status = 'HIDDEN' and t.author_id = v_me)) then
    raise exception 'THREAD_NOT_FOUND' using errcode = 'P0002';
  end if;
  return public.community_thread_row(t, v_me) || jsonb_build_object(
    'body', t.body,
    'media', public.community_media_json(t.id, null),
    'comments', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id,
               'parent_id', c.parent_id,
               'body', c.body,
               'author', public.community_author(c.author_id) || jsonb_build_object('team', public.community_team_badge(c.team_bar_id)),
               'like_count', c.like_count,
               'created_at', c.created_at,
               'edited_at', c.edited_at,
               'media', public.community_media_json(null, c.id),
               'is_mine', v_me is not null and c.author_id = v_me,
               'is_liked', v_me is not null and exists (
                 select 1 from public.community_comment_likes l where l.comment_id = c.id and l.user_id = v_me))
             order by c.created_at)
      from public.community_comments c
      left join public.community_comments p on p.id = c.parent_id
      where c.thread_id = t.id and c.status = 'PUBLISHED' and (c.parent_id is null or p.status = 'PUBLISHED')), '[]'::jsonb));
end $$;

-- ร้านมาแรง — ไม่นับกระทู้ที่ทีมร้านแท็กร้านตัวเอง · เสมอกันเรียงตามยอดถูกใจ (ที่นับ) แล้วชื่อร้าน
create or replace function public.community_trending_bars(p_days integer default 7, p_limit integer default 3) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'slug', x.slug, 'name', x.name, 'thread_count', x.n)
                            order by x.n desc, x.likes desc, x.name), '[]'::jsonb)
  from (
    select b.id, b.slug::text as slug, b.name, count(*) as n, coalesce(sum(t.like_count), 0) as likes
    from public.community_threads t
    join public.bars b on b.id = t.bar_id and b.status = 'APPROVED'
    where t.status = 'PUBLISHED'
      and t.team_bar_id is distinct from t.bar_id
      and t.created_at > now() - make_interval(days => least(greatest(coalesce(p_days, 7), 1), 90))
    group by b.id
    order by n desc, likes desc, b.name
    limit least(greatest(coalesce(p_limit, 3), 1), 10)
  ) x
$$;

-- ร้านที่ฉันอยู่ในทีม (แสดงอยู่ + ถูกระงับ) + โควตาข่าวจากร้าน · can_post = ร้านแสดงอยู่ (ตั้งข่าวได้) · [] = ไม่ใช่ทีมร้าน
create or replace function public.my_community_team() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'NOT_AUTHENTICATED' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'bar_id', b.id,
             'slug', b.slug::text,
             'name', b.name,
             'role', s.role,
             'can_post', b.status = 'APPROVED',
             'shop_news_used', x.used,
             'shop_news_limit', 3,
             'next_slot_at', case when x.used >= 3 then x.recent[x.used - 3 + 1] + interval '7 days' end)
           order by (b.status = 'APPROVED') desc, s.accepted_at, b.id)
    from public.bar_staff s
    join public.bars b on b.id = s.bar_id and b.status in ('APPROVED', 'SUSPENDED')
    cross join lateral (
      select count(*)::integer as used, array_agg(t.created_at order by t.created_at) as recent
      from public.community_threads t
      join public.community_categories c on c.slug = t.category and c.team_only
      where t.bar_id = b.id and t.created_at > now() - interval '7 days') x
    where s.user_id = v_me and s.accepted_at is not null and s.revoked_at is null), '[]'::jsonb);
end $$;

-- ---------------------------------------------------------------------
-- 5. เขียน (ลายเซ็นเดิม — สร้างทับ)
-- ---------------------------------------------------------------------
-- ตั้งกระทู้ + ไฟล์แนบ (จาก 20261011000100) + กติกาทีมร้าน · team_bar_id = ป้ายตอนโพสต์
create or replace function public.app_community_create_thread(p_actor uuid, p_category text, p_title text, p_body text,
                                                              p_bar uuid default null, p_media jsonb default '[]'::jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare u public.users; v_id uuid; v_media jsonb; v_draft text[]; v_team uuid;
begin
  u := public.app_assert_user(p_actor);
  perform public.community_thread_check(u, p_category, p_title, p_body, p_bar);
  v_team := public.community_team_rules(u, p_category, p_bar, null::public.community_threads);
  v_media := public.community_media_norm(p_actor, p_media);
  insert into public.community_threads (author_id, category, title, body, bar_id, team_bar_id)
  values (p_actor, p_category, trim(p_title), coalesce(trim(p_body), ''), p_bar, v_team)
  returning id into v_id;
  perform public.community_media_set(p_actor, v_id, null, v_media);
  select coalesce(array_agg(x), '{}') into v_draft
    from public.community_drafts d, unnest(public.community_media_paths(d.payload->'media')) x
   where d.user_id = p_actor and d.kind = 'NEW';
  delete from public.community_drafts where user_id = p_actor and kind = 'NEW';
  perform public.app_audit(p_actor, 'community.thread.create', 'community_threads', v_id,
                           jsonb_build_object('category', p_category, 'bar_id', p_bar, 'media', jsonb_array_length(v_media),
                                              'team_bar_id', v_team));
  return jsonb_build_object('id', v_id, 'removed_paths', public.community_paths_unused(p_actor, v_draft));
end $$;

-- แก้กระทู้ (จาก 20261012000800) + กติกาทีมร้าน · ร้านที่แท็กเปลี่ยน → คำนวณถูกใจที่นับทั้งกระทู้ใหม่
create or replace function public.app_community_update_thread(p_actor uuid, p_thread uuid, p_category text, p_title text, p_body text,
                                                              p_bar uuid default null, p_media jsonb default null)
returns jsonb language plpgsql set search_path = '' as $$
declare
  u public.users; t public.community_threads; v_old text[] := '{}'; v_draft text[];
  v_snap jsonb; v_media jsonb; v_title text := trim(p_title); v_body text := coalesce(trim(p_body), ''); v_team uuid;
begin
  u := public.app_assert_user(p_actor);
  select * into t from public.community_threads where id = p_thread and status in ('PUBLISHED', 'HIDDEN') for update;
  if not found then raise exception 'THREAD_NOT_FOUND' using errcode = 'P0002'; end if;
  if t.author_id <> p_actor then raise exception 'NOT_THREAD_OWNER' using errcode = '42501'; end if;
  perform public.community_thread_check(u, p_category, p_title, p_body, p_bar);
  v_team := public.community_team_rules(u, p_category, p_bar, t);
  v_snap := public.community_media_snapshot(p_thread, null);
  v_media := case when p_media is null then v_snap else public.community_media_norm(p_actor, p_media) end;

  if t.title is distinct from v_title or t.body is distinct from v_body or t.category is distinct from p_category
     or t.bar_id is distinct from p_bar or public.community_media_sig(v_snap) <> public.community_media_sig(v_media) then
    insert into public.community_revisions (thread_id, title, category, bar_id, body, media, version_at)
    values (p_thread, t.title, t.category, t.bar_id, t.body, v_snap, coalesce(t.edited_at, t.created_at));
    if p_media is not null then
      v_old := public.community_media_set(p_actor, p_thread, null, v_media);
    end if;
    update public.community_threads
       set category = p_category, title = v_title, body = v_body, bar_id = p_bar, team_bar_id = v_team, edited_at = now()
     where id = p_thread;
    if t.bar_id is distinct from p_bar then perform public.community_refresh_likes(p_thread); end if;
    perform public.app_audit(p_actor, 'community.thread.update', 'community_threads', p_thread,
                             jsonb_build_object('category', p_category, 'bar_id', p_bar, 'team_bar_id', v_team));
  end if;

  select coalesce(array_agg(x), '{}') into v_draft
    from public.community_drafts d, unnest(public.community_media_paths(d.payload->'media')) x
   where d.user_id = p_actor and d.kind = 'EDIT' and d.thread_id = p_thread;
  delete from public.community_drafts where user_id = p_actor and kind = 'EDIT' and thread_id = p_thread;
  return jsonb_build_object('id', p_thread, 'removed_paths', public.community_paths_unused(p_actor, v_old || v_draft));
end $$;

-- ตอบกระทู้ + ไฟล์แนบ (จาก 20261011000100) + ป้ายทีมร้าน (ร้านที่แท็กถ้าอยู่ทีมนั้น) · แจ้งเตือนบอกว่าเป็นทีมร้าน
create or replace function public.app_community_add_comment(p_actor uuid, p_thread uuid, p_body text, p_parent uuid default null,
                                                            p_media jsonb default '[]'::jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare
  u public.users; t public.community_threads; p public.community_comments;
  v_parent uuid; v_id uuid; v_link text; v_media jsonb; v_body text := trim(coalesce(p_body, '')); v_draft text[];
  v_team uuid; v_who text;
begin
  u := public.app_assert_user(p_actor);
  if u.banned_at is not null then raise exception 'COMMUNITY_BANNED' using errcode = '42501'; end if;
  v_media := public.community_media_norm(p_actor, p_media);
  if char_length(v_body) > 2000 or (v_body = '' and jsonb_array_length(v_media) = 0) then
    raise exception 'INVALID_COMMUNITY_COMMENT' using errcode = '22023';
  end if;
  select * into t from public.community_threads where id = p_thread and status = 'PUBLISHED' for update;
  if not found then raise exception 'THREAD_NOT_FOUND' using errcode = 'P0002'; end if;
  if p_parent is not null then
    select * into p from public.community_comments where id = p_parent and thread_id = p_thread and status = 'PUBLISHED';
    if not found then raise exception 'COMMENT_NOT_FOUND' using errcode = 'P0002'; end if;
    v_parent := coalesce(p.parent_id, p.id);
  end if;
  v_team := public.community_team_bar(p_actor, t.bar_id);

  insert into public.community_comments (thread_id, parent_id, author_id, body, team_bar_id)
  values (p_thread, v_parent, p_actor, v_body, v_team)
  returning id into v_id;
  perform public.community_media_set(p_actor, null, v_id, v_media);
  update public.community_threads set last_activity_at = now() where id = p_thread;
  perform public.community_refresh_counts(p_thread);
  select coalesce(array_agg(x), '{}') into v_draft
    from public.community_drafts d, unnest(public.community_media_paths(d.payload->'media')) x
   where d.user_id = p_actor and d.kind = 'REPLY' and d.thread_id = p_thread;
  delete from public.community_drafts where user_id = p_actor and kind = 'REPLY' and thread_id = p_thread;

  v_link := '/community/t/' || p_thread;
  v_who := u.display_name || coalesce(' (ทีมร้าน · ' || (select b.name from public.bars b where b.id = v_team) || ')', '');
  if t.author_id <> p_actor then
    perform public.app_notify(t.author_id, 'COMMUNITY_REPLY', 'มีคนตอบกระทู้ของคุณ',
                              v_who || ' ตอบ "' || left(t.title, 60) || '"', v_link);
  end if;
  if p.id is not null and p.author_id <> p_actor and p.author_id <> t.author_id then
    perform public.app_notify(p.author_id, 'COMMUNITY_REPLY', 'มีคนตอบความคิดเห็นของคุณ',
                              v_who || ' ตอบใน "' || left(t.title, 60) || '"', v_link);
  end if;
  return jsonb_build_object('id', v_id, 'thread_id', p_thread, 'parent_id', v_parent,
                            'removed_paths', public.community_paths_unused(p_actor, v_draft));
end $$;

-- ถูกใจกระทู้ · ทีมของร้านที่แท็ก = ไม่นับ (counted false) · like_count นับเฉพาะที่นับ
create or replace function public.app_community_set_like(p_actor uuid, p_thread uuid, p_on boolean)
returns jsonb language plpgsql set search_path = '' as $$
declare t public.community_threads; v_count integer; v_counted boolean;
begin
  perform public.app_assert_user(p_actor);
  select * into t from public.community_threads where id = p_thread and status = 'PUBLISHED' for update;
  if not found then raise exception 'THREAD_NOT_FOUND' using errcode = 'P0002'; end if;
  if p_on then
    insert into public.community_thread_likes (thread_id, user_id, counted)
    values (p_thread, p_actor, not public.community_is_team(p_actor, t.bar_id))
    on conflict do nothing;
  else
    delete from public.community_thread_likes where thread_id = p_thread and user_id = p_actor;
  end if;
  select count(*) filter (where counted) into v_count from public.community_thread_likes where thread_id = p_thread;
  update public.community_threads set like_count = v_count where id = p_thread;
  select l.counted into v_counted from public.community_thread_likes l where l.thread_id = p_thread and l.user_id = p_actor;
  return jsonb_build_object('thread_id', p_thread, 'liked', p_on, 'like_count', v_count, 'counted', coalesce(v_counted, false));
end $$;

-- ถูกใจความเห็น · ทีมของร้านที่กระทู้แท็ก = ไม่นับ
create or replace function public.app_community_set_comment_like(p_actor uuid, p_comment uuid, p_on boolean)
returns jsonb language plpgsql set search_path = '' as $$
declare v_bar uuid; v_count integer; v_counted boolean;
begin
  perform public.app_assert_user(p_actor);
  select t.bar_id into v_bar
    from public.community_comments c join public.community_threads t on t.id = c.thread_id
   where c.id = p_comment and c.status = 'PUBLISHED' for update of c;
  if not found then raise exception 'COMMENT_NOT_FOUND' using errcode = 'P0002'; end if;
  if p_on then
    insert into public.community_comment_likes (comment_id, user_id, counted)
    values (p_comment, p_actor, not public.community_is_team(p_actor, v_bar))
    on conflict do nothing;
  else
    delete from public.community_comment_likes where comment_id = p_comment and user_id = p_actor;
  end if;
  select count(*) filter (where counted) into v_count from public.community_comment_likes where comment_id = p_comment;
  update public.community_comments set like_count = v_count where id = p_comment;
  select l.counted into v_counted from public.community_comment_likes l where l.comment_id = p_comment and l.user_id = p_actor;
  return jsonb_build_object('comment_id', p_comment, 'liked', p_on, 'like_count', v_count, 'counted', coalesce(v_counted, false));
end $$;

-- ---------------------------------------------------------------------
-- 6. Backoffice — เพิ่ม team_bar (ป้ายทีมร้านตอนโพสต์) + excluded_like_count (ถูกใจจากทีมร้านที่ไม่นับ) ต่อท้ายคอลัมน์เดิม
-- ---------------------------------------------------------------------
create or replace view public.admin_community_threads with (security_invoker = true) as
select
  t.id, t.title, t.body, t.category, c.name as category_name, t.status,
  t.author_id, u.display_name as author_name,
  case when b.id is null then null else jsonb_build_object('id', b.id, 'slug', b.slug::text, 'name', b.name) end as bar,
  t.reply_count, t.like_count, t.view_count, t.created_at, t.edited_at,
  (select count(*) from public.community_reports r where r.thread_id = t.id and r.status = 'OPEN')::integer as open_report_count,
  coalesce((select jsonb_agg(jsonb_build_object('reason', r.reason, 'detail', r.detail, 'status', r.status, 'created_at', r.created_at)
                             order by r.created_at)
            from public.community_reports r where r.thread_id = t.id), '[]'::jsonb) as reports,
  coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'kind', m.kind, 'path', m.storage_path, 'thumb_path', m.thumb_path,
                                                'duration_sec', m.duration_sec) order by m.sort_order)
            from public.community_media m where m.thread_id = t.id), '[]'::jsonb) as media,
  coalesce((select jsonb_agg(jsonb_build_object('title', rv.title, 'body', rv.body, 'media', rv.media,
                                                'version_at', rv.version_at, 'replaced_at', rv.replaced_at) order by rv.replaced_at desc)
            from public.community_revisions rv where rv.thread_id = t.id), '[]'::jsonb) as revisions,
  case when tb.id is null then null else jsonb_build_object('id', tb.id, 'slug', tb.slug::text, 'name', tb.name) end as team_bar,
  (select count(*) from public.community_thread_likes l where l.thread_id = t.id and not l.counted)::integer as excluded_like_count
from public.community_threads t
join public.community_categories c on c.slug = t.category
left join public.users u on u.id = t.author_id
left join public.bars b on b.id = t.bar_id
left join public.bars tb on tb.id = t.team_bar_id
where public.is_admin() and t.status <> 'DELETED';

create or replace view public.admin_community_comments with (security_invoker = true) as
select
  cm.id, cm.thread_id, t.title as thread_title, cm.parent_id, cm.body, cm.status,
  cm.author_id, u.display_name as author_name, cm.like_count, cm.created_at,
  (select count(*) from public.community_reports r where r.comment_id = cm.id and r.status = 'OPEN')::integer as open_report_count,
  coalesce((select jsonb_agg(jsonb_build_object('reason', r.reason, 'detail', r.detail, 'status', r.status, 'created_at', r.created_at)
                             order by r.created_at)
            from public.community_reports r where r.comment_id = cm.id), '[]'::jsonb) as reports,
  coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'kind', m.kind, 'path', m.storage_path, 'thumb_path', m.thumb_path,
                                                'duration_sec', m.duration_sec) order by m.sort_order)
            from public.community_media m where m.comment_id = cm.id), '[]'::jsonb) as media,
  cm.edited_at,
  coalesce((select jsonb_agg(jsonb_build_object('title', null, 'body', rv.body, 'media', rv.media,
                                                'version_at', rv.version_at, 'replaced_at', rv.replaced_at) order by rv.replaced_at desc)
            from public.community_revisions rv where rv.comment_id = cm.id), '[]'::jsonb) as revisions,
  case when tb.id is null then null else jsonb_build_object('id', tb.id, 'slug', tb.slug::text, 'name', tb.name) end as team_bar,
  (select count(*) from public.community_comment_likes l where l.comment_id = cm.id and not l.counted)::integer as excluded_like_count
from public.community_comments cm
join public.community_threads t on t.id = cm.thread_id
left join public.users u on u.id = cm.author_id
left join public.bars tb on tb.id = cm.team_bar_id
where public.is_admin() and cm.status <> 'DELETED';

revoke all on public.admin_community_threads, public.admin_community_comments from anon;
grant select on public.admin_community_threads, public.admin_community_comments to authenticated;

-- ---------------------------------------------------------------------
-- 7. สิทธิ์ของฟังก์ชัน
-- ---------------------------------------------------------------------
-- ตัวช่วย: service_role เท่านั้น
revoke all on function public.community_is_team(uuid, uuid) from public, anon, authenticated;
revoke all on function public.community_team_bar(uuid, uuid) from public, anon, authenticated;
revoke all on function public.community_team_badge(uuid) from public, anon, authenticated;
revoke all on function public.community_shop_news_used(uuid) from public, anon, authenticated;
revoke all on function public.community_team_rules(public.users, text, uuid, public.community_threads) from public, anon, authenticated;
revoke all on function public.community_refresh_likes(uuid) from public, anon, authenticated;
grant execute on function public.community_is_team(uuid, uuid) to service_role;
grant execute on function public.community_team_bar(uuid, uuid) to service_role;
grant execute on function public.community_team_badge(uuid) to service_role;
grant execute on function public.community_shop_news_used(uuid) to service_role;
grant execute on function public.community_team_rules(public.users, text, uuid, public.community_threads) to service_role;
grant execute on function public.community_refresh_likes(uuid) to service_role;
-- อ่าน: ร้านในทีมของฉัน (ตรวจ auth.uid() ในตัว)
revoke all on function public.my_community_team() from public, anon;
grant execute on function public.my_community_team() to authenticated, service_role;
-- ที่สร้างทับ: ย้ำสิทธิ์เดิม
revoke all on function public.community_categories_list() from public;
revoke all on function public.community_thread(uuid) from public;
revoke all on function public.community_trending_bars(integer, integer) from public;
grant execute on function public.community_categories_list() to anon, authenticated, service_role;
grant execute on function public.community_thread(uuid) to anon, authenticated, service_role;
grant execute on function public.community_trending_bars(integer, integer) to anon, authenticated, service_role;
revoke all on function public.community_thread_row(public.community_threads, uuid) from public, anon, authenticated;
grant execute on function public.community_thread_row(public.community_threads, uuid) to service_role;
revoke all on function public.app_community_create_thread(uuid, text, text, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.app_community_update_thread(uuid, uuid, text, text, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.app_community_add_comment(uuid, uuid, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.app_community_set_like(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.app_community_set_comment_like(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.app_community_create_thread(uuid, text, text, text, uuid, jsonb) to service_role;
grant execute on function public.app_community_update_thread(uuid, uuid, text, text, text, uuid, jsonb) to service_role;
grant execute on function public.app_community_add_comment(uuid, uuid, text, uuid, jsonb) to service_role;
grant execute on function public.app_community_set_like(uuid, uuid, boolean) to service_role;
grant execute on function public.app_community_set_comment_like(uuid, uuid, boolean) to service_role;
