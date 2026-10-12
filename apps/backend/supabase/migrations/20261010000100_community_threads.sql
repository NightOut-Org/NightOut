-- =====================================================================
-- NightOut · community — ชุมชน/กระทู้ (นอก MVP — อนุมัติ 2026-10-10)
--   - community_categories   : หมวดกระทู้ (staff_only = ตั้งได้เฉพาะทีม NightOut เช่น "ประกาศ")
--   - community_threads      : กระทู้ (แท็กร้านได้ 1 ร้าน) · status PUBLISHED / HIDDEN (แอดมินซ่อน) / REMOVED (แอดมินลบ) / DELETED (เจ้าของลบ)
--   - community_comments     : ความคิดเห็น + ตอบกลับ 1 ชั้น (parent_id = ความเห็นหลัก)
--   - community_thread_likes / community_comment_likes / community_saves (บันทึกไว้อ่าน)
--   - community_pins         : ปักหมุดส่วนตัว — ผู้ใช้ปักกระทู้ให้ขึ้นบนสุดในฟีดของตัวเอง (คนอื่นไม่เห็น) สูงสุด 3 กระทู้
--   - community_drafts       : ฉบับร่างเก็บที่ backend (ตามไปทุกอุปกรณ์) · NEW 1 ร่าง/บัญชี · REPLY 1 ร่าง/กระทู้ · EDIT 1 ร่าง/กระทู้ · เกิน 7 วันไม่นับ/ลบทิ้ง
--   - community_reports      : รายงานกระทู้/ความเห็น → Backoffice /community
--   - อ่าน: ฟังก์ชัน security definer (คำนวณ is_pinned / is_saved / is_liked จาก auth.uid()) · เขียน: app_* / admin_* ผ่าน NestJS เท่านั้น
-- =====================================================================
set search_path = public, extensions;

-- ---------------------------------------------------------------------
-- 1. ตาราง
-- ---------------------------------------------------------------------
create table public.community_categories (
  slug        text primary key check (slug ~ '^[a-z][a-z0-9-]{1,30}$'),
  name        text not null check (char_length(name) between 1 and 40),
  sort_order  smallint not null default 0,
  staff_only  boolean not null default false,        -- ตั้งกระทู้ได้เฉพาะบัญชีที่เข้า Backoffice ได้
  is_active   boolean not null default true
);

insert into public.community_categories (slug, name, sort_order, staff_only) values
  ('live',     'ดนตรีสด',       1, false),
  ('review',   'รีวิว',          2, false),
  ('buddy',    'หาเพื่อนเที่ยว',  3, false),
  ('drinks',   'เครื่องดื่ม',     4, false),
  ('qa',       'ถาม-ตอบ',       5, false),
  ('announce', 'ประกาศ',        6, true);

create table public.community_threads (
  id                uuid primary key default gen_random_uuid(),
  author_id         uuid not null references public.users(id) on delete cascade,
  category          text not null references public.community_categories(slug),
  title             text not null check (char_length(title) between 3 and 120),
  body              text not null default '' check (char_length(body) <= 5000),
  bar_id            uuid references public.bars(id) on delete set null,
  status            text not null default 'PUBLISHED' check (status in ('PUBLISHED', 'HIDDEN', 'REMOVED', 'DELETED')),
  reply_count       integer not null default 0,
  like_count        integer not null default 0,
  view_count        integer not null default 0,
  last_activity_at  timestamptz not null default now(),
  edited_at         timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index community_threads_author_id_fk on public.community_threads (author_id);
create index community_threads_category_fk on public.community_threads (category);
create index community_threads_bar_id_fk on public.community_threads (bar_id);
create index community_threads_feed on public.community_threads (status, created_at desc);
create trigger community_threads_updated_at before update on public.community_threads for each row execute function public.set_updated_at();

create table public.community_comments (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null references public.community_threads(id) on delete cascade,
  parent_id   uuid references public.community_comments(id) on delete cascade,
  author_id   uuid not null references public.users(id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 2000),
  status      text not null default 'PUBLISHED' check (status in ('PUBLISHED', 'HIDDEN', 'REMOVED', 'DELETED')),
  like_count  integer not null default 0,
  created_at  timestamptz not null default now()
);
create index community_comments_thread_id_fk on public.community_comments (thread_id, created_at);
create index community_comments_parent_id_fk on public.community_comments (parent_id);
create index community_comments_author_id_fk on public.community_comments (author_id);

create table public.community_thread_likes (
  thread_id   uuid not null references public.community_threads(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (thread_id, user_id)
);
create index community_thread_likes_user_id_fk on public.community_thread_likes (user_id);

create table public.community_comment_likes (
  comment_id  uuid not null references public.community_comments(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (comment_id, user_id)
);
create index community_comment_likes_user_id_fk on public.community_comment_likes (user_id);

create table public.community_saves (
  user_id     uuid not null references public.users(id) on delete cascade,
  thread_id   uuid not null references public.community_threads(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, thread_id)
);
create index community_saves_thread_id_fk on public.community_saves (thread_id);

-- ปักหมุดส่วนตัว (สูงสุด 3 กระทู้ต่อบัญชี — ตรวจใน app_community_set_pin)
create table public.community_pins (
  user_id     uuid not null references public.users(id) on delete cascade,
  thread_id   uuid not null references public.community_threads(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, thread_id)
);
create index community_pins_thread_id_fk on public.community_pins (thread_id);

-- ฉบับร่าง — payload = ช่องในฟอร์ม (NEW/EDIT: category, title, body, bar_id · REPLY: body, parent_id)
create table public.community_drafts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  kind        text not null check (kind in ('NEW', 'REPLY', 'EDIT')),
  thread_id   uuid references public.community_threads(id) on delete cascade,
  payload     jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) <= 32768),
  updated_at  timestamptz not null default now(),
  check ((kind = 'NEW') = (thread_id is null))
);
create unique index community_drafts_slot on public.community_drafts (user_id, kind, coalesce(thread_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index community_drafts_thread_id_fk on public.community_drafts (thread_id);

create table public.community_reports (
  id           uuid primary key default gen_random_uuid(),
  thread_id    uuid references public.community_threads(id) on delete cascade,
  comment_id   uuid references public.community_comments(id) on delete cascade,
  reporter_id  uuid not null references public.users(id) on delete cascade,
  reason       text not null check (reason in ('SPAM', 'OFFENSIVE', 'ADVERTISING', 'PRIVACY', 'OTHER')),
  detail       text check (char_length(detail) <= 300),
  status       text not null default 'OPEN' check (status in ('OPEN', 'RESOLVED')),
  resolved_by  uuid references public.users(id) on delete set null,
  resolved_at  timestamptz,
  created_at   timestamptz not null default now(),
  check (num_nonnulls(thread_id, comment_id) = 1)
);
create unique index community_reports_thread_once on public.community_reports (reporter_id, thread_id) where thread_id is not null;
create unique index community_reports_comment_once on public.community_reports (reporter_id, comment_id) where comment_id is not null;
create index community_reports_thread_id_fk on public.community_reports (thread_id);
create index community_reports_comment_id_fk on public.community_reports (comment_id);
create index community_reports_reporter_id_fk on public.community_reports (reporter_id);
create index community_reports_resolved_by_fk on public.community_reports (resolved_by);

-- RLS: หมวดอ่านได้ทุกคน · ที่เหลืออ่านผ่านฟังก์ชัน security definer · แอดมินอ่านตรงได้ (view admin_community_*) · เขียนผ่าน service role เท่านั้น
do $$ declare t text; begin
  foreach t in array array['community_categories', 'community_threads', 'community_comments', 'community_thread_likes',
                           'community_comment_likes', 'community_saves', 'community_pins', 'community_drafts', 'community_reports'] loop
    execute format('alter table public.%I enable row level security', t);
    -- …001600 สร้าง admin_read ให้ตารางที่มีตอนนั้นเท่านั้น — ตารางใหม่ต้องเพิ่มเอง
    execute format('create policy admin_read on public.%I for select to authenticated using (public.is_admin())', t);
    execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;
create policy community_categories_read on public.community_categories for select using (is_active);
grant select on public.community_categories to anon;

-- ---------------------------------------------------------------------
-- 2. ตัวช่วย (service_role / ฟังก์ชัน security definer ใช้ภายใน)
-- ---------------------------------------------------------------------
-- ผู้เขียน: ชื่อที่แสดง + เป็นทีม NightOut ไหม (ตาราง users อ่านได้แค่แถวตัวเอง)
create or replace function public.community_author(p_user uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', u.id,
    'name', case when u.deleted_at is null then u.display_name else 'บัญชีถูกลบ' end,
    'is_staff', public.role_enters_backoffice(u.role))
  from public.users u where u.id = p_user
$$;

-- ร้านที่ถูกแท็ก (เฉพาะร้านที่แสดงอยู่)
create or replace function public.community_bar(p_bar uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', b.id, 'slug', b.slug::text, 'name', b.name)
  from public.bars b where b.id = p_bar and b.status = 'APPROVED'
$$;

-- นับความเห็นที่แสดงอยู่ใหม่ (ความเห็นตอบกลับนับเฉพาะเมื่อความเห็นหลักยังแสดง) — เรียกหลังเพิ่ม/ลบ/ซ่อน
create or replace function public.community_refresh_counts(p_thread uuid) returns void
language sql set search_path = '' as $$
  update public.community_threads t set reply_count = (
    select count(*) from public.community_comments c
    left join public.community_comments p on p.id = c.parent_id
    where c.thread_id = p_thread and c.status = 'PUBLISHED' and (c.parent_id is null or p.status = 'PUBLISHED'))
  where t.id = p_thread
$$;

-- ตรวจข้อมูลกระทู้ก่อนบันทึก (NestJS ตรวจด้วย zod แล้ว — ด่านสุดท้ายใน DB)
create or replace function public.community_thread_check(p_user public.users, p_category text, p_title text, p_body text, p_bar uuid)
returns void language plpgsql stable set search_path = '' as $$
declare c public.community_categories;
begin
  if p_user.banned_at is not null then raise exception 'COMMUNITY_BANNED' using errcode = '42501'; end if;
  select * into c from public.community_categories where slug = p_category and is_active;
  if not found then raise exception 'INVALID_COMMUNITY_CATEGORY' using errcode = '22023'; end if;
  if c.staff_only and not public.role_enters_backoffice(p_user.role) then
    raise exception 'COMMUNITY_CATEGORY_STAFF_ONLY' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_title, ''))) not between 3 and 120 or char_length(coalesce(p_body, '')) > 5000 then
    raise exception 'INVALID_COMMUNITY_THREAD' using errcode = '22023';
  end if;
  if p_bar is not null and not exists (select 1 from public.bars where id = p_bar and status = 'APPROVED') then
    raise exception 'BAR_NOT_FOUND' using errcode = 'P0002';
  end if;
end $$;

-- 1 แถวในฟีด (ไม่มีเนื้อหาเต็ม)
create or replace function public.community_thread_row(t public.community_threads, p_me uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', t.id,
    'title', t.title,
    'excerpt', left(regexp_replace(t.body, '\s+', ' ', 'g'), 160),
    'category', t.category,
    'category_name', (select c.name from public.community_categories c where c.slug = t.category),
    'author', public.community_author(t.author_id),
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

-- ---------------------------------------------------------------------
-- 3. อ่าน (security definer · ตรวจสิทธิ์ด้วย auth.uid() ในตัว · grant anon + authenticated)
-- ---------------------------------------------------------------------
create or replace function public.community_categories_list() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'slug', c.slug, 'name', c.name, 'sort_order', c.sort_order, 'staff_only', c.staff_only,
           'thread_count', (select count(*) from public.community_threads t where t.category = c.slug and t.status = 'PUBLISHED'))
         order by c.sort_order), '[]'::jsonb)
  from public.community_categories c where c.is_active
$$;

-- ฟีดกระทู้
--   p_scope: all (ทุกคน · กระทู้ที่ฉันปักหมุดขึ้นก่อน) · mine (กระทู้ของฉัน รวมที่ถูกซ่อน) · saved (ที่บันทึกไว้) · pinned (ที่ปักหมุด)
--   p_sort : latest · popular (ถูกใจ + ตอบกลับ) · unanswered (ยังไม่มีคำตอบ)
--   คืน { items, has_more }
create or replace function public.community_feed(
  p_scope text default 'all', p_category text default null, p_sort text default 'latest', p_q text default null,
  p_bar uuid default null, p_limit integer default 20, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_q text := nullif(trim(coalesce(p_q, '')), '');
  v_like text;
  v_rows jsonb;
begin
  if coalesce(p_scope, 'all') not in ('all', 'mine', 'saved', 'pinned')
     or coalesce(p_sort, 'latest') not in ('latest', 'popular', 'unanswered') then
    raise exception 'INVALID_COMMUNITY_QUERY' using errcode = '22023';
  end if;
  if coalesce(p_scope, 'all') <> 'all' and v_me is null then raise exception 'NOT_AUTHENTICATED' using errcode = '42501'; end if;
  if v_q is not null then
    v_like := '%' || replace(replace(replace(left(v_q, 80), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  with base as (
    select t,
      (v_me is not null and exists (select 1 from public.community_pins p where p.user_id = v_me and p.thread_id = t.id)) as pinned
    from public.community_threads t
    where case when p_scope = 'mine' then t.author_id = v_me and t.status in ('PUBLISHED', 'HIDDEN')
               else t.status = 'PUBLISHED' end
      and (p_scope <> 'saved' or exists (select 1 from public.community_saves s where s.user_id = v_me and s.thread_id = t.id))
      and (p_scope <> 'pinned' or exists (select 1 from public.community_pins p where p.user_id = v_me and p.thread_id = t.id))
      and (p_category is null or t.category = p_category)
      and (p_bar is null or t.bar_id = p_bar)
      and (coalesce(p_sort, 'latest') <> 'unanswered' or t.reply_count = 0)
      and (v_like is null or t.title ilike v_like or t.body ilike v_like
           or exists (select 1 from public.bars b where b.id = t.bar_id and b.name ilike v_like))
  ), ranked as (
    select b.t, row_number() over (order by
        (coalesce(p_scope, 'all') = 'all' and b.pinned) desc,
        case when p_sort = 'popular' then (b.t).like_count + (b.t).reply_count * 2 end desc nulls last,
        (b.t).created_at desc) as rn
    from base b
  )
  select coalesce(jsonb_agg(public.community_thread_row(r.t, v_me) order by r.rn), '[]'::jsonb) into v_rows
  from ranked r where r.rn > v_offset and r.rn <= v_offset + v_limit + 1;

  return jsonb_build_object(
    'items', coalesce((select jsonb_agg(e order by i) from jsonb_array_elements(v_rows) with ordinality x(e, i) where i <= v_limit), '[]'::jsonb),
    'has_more', jsonb_array_length(v_rows) > v_limit);
end $$;

-- อ่านกระทู้ + ความเห็นทั้งหมด (แบน — หน้าเว็บจัดตอบกลับใต้ความเห็นหลักเอง)
-- กระทู้ถูกซ่อน: เจ้าของยังเห็น (หน้าเว็บแจ้งว่าถูกซ่อน) · ลบแล้ว = ไม่พบ
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
    'comments', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id,
               'parent_id', c.parent_id,
               'body', c.body,
               'author', public.community_author(c.author_id),
               'like_count', c.like_count,
               'created_at', c.created_at,
               'is_mine', v_me is not null and c.author_id = v_me,
               'is_liked', v_me is not null and exists (
                 select 1 from public.community_comment_likes l where l.comment_id = c.id and l.user_id = v_me))
             order by c.created_at)
      from public.community_comments c
      left join public.community_comments p on p.id = c.parent_id
      where c.thread_id = t.id and c.status = 'PUBLISHED' and (c.parent_id is null or p.status = 'PUBLISHED')), '[]'::jsonb));
end $$;

-- ร้านที่ถูกพูดถึงมากที่สุดในช่วง p_days วัน
create or replace function public.community_trending_bars(p_days integer default 7, p_limit integer default 3) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'slug', x.slug, 'name', x.name, 'thread_count', x.n)
                            order by x.n desc, x.name), '[]'::jsonb)
  from (
    select b.id, b.slug::text as slug, b.name, count(*) as n
    from public.community_threads t
    join public.bars b on b.id = t.bar_id and b.status = 'APPROVED'
    where t.status = 'PUBLISHED' and t.created_at > now() - make_interval(days => least(greatest(coalesce(p_days, 7), 1), 90))
    group by b.id
    order by n desc, b.name
    limit least(greatest(coalesce(p_limit, 3), 1), 10)
  ) x
$$;

-- ร่างของฉันที่ยังไม่หมดอายุ (7 วัน)
create or replace function public.my_community_drafts() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'NOT_AUTHENTICATED' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', d.id, 'kind', d.kind, 'thread_id', d.thread_id, 'payload', d.payload, 'updated_at', d.updated_at)
                     order by d.updated_at desc)
    from public.community_drafts d
    where d.user_id = v_me and d.updated_at > now() - interval '7 days'), '[]'::jsonb);
end $$;

-- ---------------------------------------------------------------------
-- 4. ลูกค้า (app_* · service_role)
-- ---------------------------------------------------------------------
create or replace function public.app_community_create_thread(p_actor uuid, p_category text, p_title text, p_body text, p_bar uuid default null)
returns jsonb language plpgsql set search_path = '' as $$
declare u public.users; v_id uuid;
begin
  u := public.app_assert_user(p_actor);
  perform public.community_thread_check(u, p_category, p_title, p_body, p_bar);
  insert into public.community_threads (author_id, category, title, body, bar_id)
  values (p_actor, p_category, trim(p_title), coalesce(trim(p_body), ''), p_bar)
  returning id into v_id;
  delete from public.community_drafts where user_id = p_actor and kind = 'NEW';
  perform public.app_audit(p_actor, 'community.thread.create', 'community_threads', v_id,
                           jsonb_build_object('category', p_category, 'bar_id', p_bar));
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.app_community_update_thread(p_actor uuid, p_thread uuid, p_category text, p_title text, p_body text, p_bar uuid default null)
returns jsonb language plpgsql set search_path = '' as $$
declare u public.users; t public.community_threads;
begin
  u := public.app_assert_user(p_actor);
  select * into t from public.community_threads where id = p_thread and status in ('PUBLISHED', 'HIDDEN') for update;
  if not found then raise exception 'THREAD_NOT_FOUND' using errcode = 'P0002'; end if;
  if t.author_id <> p_actor then raise exception 'NOT_THREAD_OWNER' using errcode = '42501'; end if;
  perform public.community_thread_check(u, p_category, p_title, p_body, p_bar);
  update public.community_threads
     set category = p_category, title = trim(p_title), body = coalesce(trim(p_body), ''), bar_id = p_bar, edited_at = now()
   where id = p_thread;
  delete from public.community_drafts where user_id = p_actor and kind = 'EDIT' and thread_id = p_thread;
  perform public.app_audit(p_actor, 'community.thread.update', 'community_threads', p_thread,
                           jsonb_build_object('category', p_category, 'bar_id', p_bar));
  return jsonb_build_object('id', p_thread);
end $$;

create or replace function public.app_community_delete_thread(p_actor uuid, p_thread uuid)
returns jsonb language plpgsql set search_path = '' as $$
declare t public.community_threads;
begin
  perform public.app_assert_user(p_actor);
  select * into t from public.community_threads where id = p_thread and status in ('PUBLISHED', 'HIDDEN') for update;
  if not found then raise exception 'THREAD_NOT_FOUND' using errcode = 'P0002'; end if;
  if t.author_id <> p_actor then raise exception 'NOT_THREAD_OWNER' using errcode = '42501'; end if;
  update public.community_threads set status = 'DELETED' where id = p_thread;
  delete from public.community_drafts where thread_id = p_thread;
  delete from public.community_pins where thread_id = p_thread;
  perform public.app_audit(p_actor, 'community.thread.delete', 'community_threads', p_thread, jsonb_build_object('status', 'DELETED'));
  return jsonb_build_object('id', p_thread, 'status', 'DELETED');
end $$;

-- ตอบกระทู้ · p_parent = ความเห็นที่ตอบ (ตอบกลับซ้อนได้ชั้นเดียว — ตอบใต้ตอบกลับ = ผูกกับความเห็นหลัก)
create or replace function public.app_community_add_comment(p_actor uuid, p_thread uuid, p_body text, p_parent uuid default null)
returns jsonb language plpgsql set search_path = '' as $$
declare u public.users; t public.community_threads; p public.community_comments; v_parent uuid; v_id uuid; v_link text;
begin
  u := public.app_assert_user(p_actor);
  if u.banned_at is not null then raise exception 'COMMUNITY_BANNED' using errcode = '42501'; end if;
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 2000 then raise exception 'INVALID_COMMUNITY_COMMENT' using errcode = '22023'; end if;
  select * into t from public.community_threads where id = p_thread and status = 'PUBLISHED' for update;
  if not found then raise exception 'THREAD_NOT_FOUND' using errcode = 'P0002'; end if;
  if p_parent is not null then
    select * into p from public.community_comments where id = p_parent and thread_id = p_thread and status = 'PUBLISHED';
    if not found then raise exception 'COMMENT_NOT_FOUND' using errcode = 'P0002'; end if;
    v_parent := coalesce(p.parent_id, p.id);
  end if;

  insert into public.community_comments (thread_id, parent_id, author_id, body)
  values (p_thread, v_parent, p_actor, trim(p_body))
  returning id into v_id;
  update public.community_threads set last_activity_at = now() where id = p_thread;
  perform public.community_refresh_counts(p_thread);
  delete from public.community_drafts where user_id = p_actor and kind = 'REPLY' and thread_id = p_thread;

  v_link := '/community/t/' || p_thread;
  if t.author_id <> p_actor then
    perform public.app_notify(t.author_id, 'COMMUNITY_REPLY', 'มีคนตอบกระทู้ของคุณ',
                              u.display_name || ' ตอบ "' || left(t.title, 60) || '"', v_link);
  end if;
  if p.id is not null and p.author_id <> p_actor and p.author_id <> t.author_id then
    perform public.app_notify(p.author_id, 'COMMUNITY_REPLY', 'มีคนตอบความคิดเห็นของคุณ',
                              u.display_name || ' ตอบใน "' || left(t.title, 60) || '"', v_link);
  end if;
  return jsonb_build_object('id', v_id, 'thread_id', p_thread, 'parent_id', v_parent);
end $$;

create or replace function public.app_community_delete_comment(p_actor uuid, p_comment uuid)
returns jsonb language plpgsql set search_path = '' as $$
declare c public.community_comments;
begin
  perform public.app_assert_user(p_actor);
  select * into c from public.community_comments where id = p_comment and status = 'PUBLISHED' for update;
  if not found then raise exception 'COMMENT_NOT_FOUND' using errcode = 'P0002'; end if;
  if c.author_id <> p_actor then raise exception 'NOT_COMMENT_OWNER' using errcode = '42501'; end if;
  update public.community_comments set status = 'DELETED' where id = p_comment;
  perform public.community_refresh_counts(c.thread_id);
  return jsonb_build_object('id', p_comment, 'thread_id', c.thread_id, 'status', 'DELETED');
end $$;

create or replace function public.app_community_set_like(p_actor uuid, p_thread uuid, p_on boolean)
returns jsonb language plpgsql set search_path = '' as $$
declare v_count integer;
begin
  perform public.app_assert_user(p_actor);
  if not exists (select 1 from public.community_threads where id = p_thread and status = 'PUBLISHED') then
    raise exception 'THREAD_NOT_FOUND' using errcode = 'P0002';
  end if;
  if p_on then
    insert into public.community_thread_likes (thread_id, user_id) values (p_thread, p_actor) on conflict do nothing;
  else
    delete from public.community_thread_likes where thread_id = p_thread and user_id = p_actor;
  end if;
  select count(*) into v_count from public.community_thread_likes where thread_id = p_thread;
  update public.community_threads set like_count = v_count where id = p_thread;
  return jsonb_build_object('thread_id', p_thread, 'liked', p_on, 'like_count', v_count);
end $$;

create or replace function public.app_community_set_comment_like(p_actor uuid, p_comment uuid, p_on boolean)
returns jsonb language plpgsql set search_path = '' as $$
declare v_count integer;
begin
  perform public.app_assert_user(p_actor);
  if not exists (select 1 from public.community_comments where id = p_comment and status = 'PUBLISHED') then
    raise exception 'COMMENT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if p_on then
    insert into public.community_comment_likes (comment_id, user_id) values (p_comment, p_actor) on conflict do nothing;
  else
    delete from public.community_comment_likes where comment_id = p_comment and user_id = p_actor;
  end if;
  select count(*) into v_count from public.community_comment_likes where comment_id = p_comment;
  update public.community_comments set like_count = v_count where id = p_comment;
  return jsonb_build_object('comment_id', p_comment, 'liked', p_on, 'like_count', v_count);
end $$;

create or replace function public.app_community_set_save(p_actor uuid, p_thread uuid, p_on boolean)
returns jsonb language plpgsql set search_path = '' as $$
begin
  perform public.app_assert_user(p_actor);
  if p_on then
    if not exists (select 1 from public.community_threads where id = p_thread and status = 'PUBLISHED') then
      raise exception 'THREAD_NOT_FOUND' using errcode = 'P0002';
    end if;
    insert into public.community_saves (user_id, thread_id) values (p_actor, p_thread) on conflict do nothing;
  else
    delete from public.community_saves where user_id = p_actor and thread_id = p_thread;
  end if;
  return jsonb_build_object('thread_id', p_thread, 'saved', p_on);
end $$;

-- ปักหมุดส่วนตัว — กระทู้ขึ้นบนสุดในฟีดของฉันเท่านั้น · ปักพร้อมกันได้ 3 กระทู้ (นับเฉพาะกระทู้ที่ยังแสดงอยู่)
create or replace function public.app_community_set_pin(p_actor uuid, p_thread uuid, p_on boolean)
returns jsonb language plpgsql set search_path = '' as $$
declare v_count integer;
begin
  perform public.app_assert_user(p_actor);
  if p_on then
    if not exists (select 1 from public.community_threads where id = p_thread and status = 'PUBLISHED') then
      raise exception 'THREAD_NOT_FOUND' using errcode = 'P0002';
    end if;
    if not exists (select 1 from public.community_pins where user_id = p_actor and thread_id = p_thread) then
      -- กระทู้ที่ถูกซ่อน/ลบไปแล้วไม่กินโควตา — เก็บกวาดออกก่อนนับ
      delete from public.community_pins p using public.community_threads t
       where p.user_id = p_actor and t.id = p.thread_id and t.status <> 'PUBLISHED';
      select count(*) into v_count from public.community_pins where user_id = p_actor;
      if v_count >= 3 then raise exception 'COMMUNITY_PIN_LIMIT' using errcode = 'P0001'; end if;
      insert into public.community_pins (user_id, thread_id) values (p_actor, p_thread);
    end if;
  else
    delete from public.community_pins where user_id = p_actor and thread_id = p_thread;
  end if;
  select count(*) into v_count from public.community_pins where user_id = p_actor;
  return jsonb_build_object('thread_id', p_thread, 'pinned', p_on, 'pin_count', v_count);
end $$;

create or replace function public.app_community_report(p_actor uuid, p_thread uuid, p_comment uuid, p_reason text, p_detail text default null)
returns jsonb language plpgsql set search_path = '' as $$
declare v_thread uuid := p_thread;
begin
  perform public.app_assert_user(p_actor);
  if num_nonnulls(p_thread, p_comment) <> 1 then raise exception 'INVALID_COMMUNITY_REPORT' using errcode = '22023'; end if;
  if p_comment is not null then
    select thread_id into v_thread from public.community_comments where id = p_comment and status = 'PUBLISHED';
    if v_thread is null then raise exception 'COMMENT_NOT_FOUND' using errcode = 'P0002'; end if;
  elsif not exists (select 1 from public.community_threads where id = p_thread and status = 'PUBLISHED') then
    raise exception 'THREAD_NOT_FOUND' using errcode = 'P0002';
  end if;
  insert into public.community_reports (thread_id, comment_id, reporter_id, reason, detail)
  values (p_thread, p_comment, p_actor, p_reason, nullif(trim(coalesce(p_detail, '')), ''))
  on conflict do nothing;
  if found then
    perform public.app_notify_admins('COMMUNITY_REPORTED', 'มีการรายงานในชุมชน',
                                     case when p_comment is null then 'กระทู้' else 'ความคิดเห็น' end || ' ถูกรายงาน รอตรวจสอบ', '/community');
  end if;
  return jsonb_build_object('thread_id', v_thread, 'comment_id', p_comment, 'reported', true);
end $$;

-- บันทึกร่าง (แทนที่ร่างเดิมของช่องเดียวกัน) · ร่างเกิน 7 วันของบัญชีนี้ถูกลบทิ้งทุกครั้งที่บันทึก
create or replace function public.app_community_save_draft(p_actor uuid, p_kind text, p_thread uuid, p_payload jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare t public.community_threads; d public.community_drafts;
begin
  perform public.app_assert_user(p_actor);
  if p_kind not in ('NEW', 'REPLY', 'EDIT') or (p_kind = 'NEW') <> (p_thread is null)
     or jsonb_typeof(coalesce(p_payload, 'null'::jsonb)) <> 'object' or pg_column_size(p_payload) > 32768 then
    raise exception 'INVALID_COMMUNITY_DRAFT' using errcode = '22023';
  end if;
  if p_thread is not null then
    select * into t from public.community_threads where id = p_thread and status in ('PUBLISHED', 'HIDDEN');
    if not found or (p_kind = 'REPLY' and t.status <> 'PUBLISHED') then
      raise exception 'THREAD_NOT_FOUND' using errcode = 'P0002';
    end if;
    if p_kind = 'EDIT' and t.author_id <> p_actor then raise exception 'NOT_THREAD_OWNER' using errcode = '42501'; end if;
  end if;

  delete from public.community_drafts where user_id = p_actor and updated_at <= now() - interval '7 days';
  update public.community_drafts set payload = p_payload, updated_at = now()
   where user_id = p_actor and kind = p_kind and thread_id is not distinct from p_thread
  returning * into d;
  if not found then
    insert into public.community_drafts (user_id, kind, thread_id, payload)
    values (p_actor, p_kind, p_thread, p_payload)
    returning * into d;
  end if;
  return jsonb_build_object('id', d.id, 'kind', d.kind, 'thread_id', d.thread_id, 'payload', d.payload, 'updated_at', d.updated_at);
end $$;

create or replace function public.app_community_delete_draft(p_actor uuid, p_kind text, p_thread uuid default null)
returns jsonb language plpgsql set search_path = '' as $$
begin
  perform public.app_assert_user(p_actor);
  delete from public.community_drafts where user_id = p_actor and kind = p_kind and thread_id is not distinct from p_thread;
  return jsonb_build_object('kind', p_kind, 'thread_id', p_thread, 'deleted', found);
end $$;

-- นับยอดเข้าชม (NestJS เรียกตอนเปิดกระทู้ · ไม่ต้องล็อกอิน)
create or replace function public.community_add_view(p_thread uuid) returns jsonb
language sql set search_path = '' as $$
  update public.community_threads set view_count = view_count + 1 where id = p_thread and status = 'PUBLISHED'
  returning jsonb_build_object('thread_id', id, 'view_count', view_count)
$$;

-- ---------------------------------------------------------------------
-- 5. Backoffice
-- ---------------------------------------------------------------------
-- p_target: THREAD / COMMENT · p_action: KEEP (ปิดรายงาน) / HIDE / REMOVE / RESTORE · ทุกครั้งปิดรายงานที่ค้าง + audit
create or replace function public.admin_community_moderate(p_actor uuid, p_target text, p_id uuid, p_action text, p_reason text default null)
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_before text; v_status text; v_author uuid; v_thread uuid; v_title text;
begin
  perform public.admin_assert(p_actor);
  if p_target not in ('THREAD', 'COMMENT') or p_action not in ('KEEP', 'HIDE', 'REMOVE', 'RESTORE') then
    raise exception 'INVALID_COMMUNITY_MODERATION' using errcode = '22023';
  end if;

  if p_target = 'THREAD' then
    select status, author_id, id, title into v_before, v_author, v_thread, v_title from public.community_threads where id = p_id for update;
    if not found or v_before = 'DELETED' then raise exception 'THREAD_NOT_FOUND' using errcode = 'P0002'; end if;
  else
    select c.status, c.author_id, c.thread_id, t.title into v_before, v_author, v_thread, v_title
      from public.community_comments c join public.community_threads t on t.id = c.thread_id where c.id = p_id for update of c;
    if not found or v_before = 'DELETED' then raise exception 'COMMENT_NOT_FOUND' using errcode = 'P0002'; end if;
  end if;

  v_status := case p_action when 'KEEP' then v_before when 'HIDE' then 'HIDDEN' when 'REMOVE' then 'REMOVED' else 'PUBLISHED' end;
  if p_target = 'THREAD' then
    update public.community_threads set status = v_status where id = p_id;
    update public.community_reports set status = 'RESOLVED', resolved_by = p_actor, resolved_at = now()
     where thread_id = p_id and status = 'OPEN';
  else
    update public.community_comments set status = v_status where id = p_id;
    update public.community_reports set status = 'RESOLVED', resolved_by = p_actor, resolved_at = now()
     where comment_id = p_id and status = 'OPEN';
    perform public.community_refresh_counts(v_thread);
  end if;

  perform public.admin_audit(p_actor, 'community.' || lower(p_target) || '.' || lower(p_action),
                             case p_target when 'THREAD' then 'community_threads' else 'community_comments' end, p_id,
                             jsonb_build_object('status', v_before), jsonb_build_object('status', v_status, 'reason', p_reason));
  if p_action in ('HIDE', 'REMOVE') and v_before <> v_status then
    perform public.app_notify(v_author, 'COMMUNITY_MODERATED',
                              case p_target when 'THREAD' then 'กระทู้ของคุณถูก' else 'ความคิดเห็นของคุณถูก' end
                                || case p_action when 'HIDE' then 'ซ่อน' else 'ลบ' end,
                              coalesce(nullif(trim(p_reason), ''), 'ไม่เป็นไปตามกติกาชุมชน') || ' · "' || left(v_title, 60) || '"',
                              case when p_target = 'THREAD' and p_action = 'REMOVE' then '/community/me' else '/community/t/' || v_thread end);
  end if;
  return jsonb_build_object('id', p_id, 'target', p_target, 'status', v_status);
end $$;

create view public.admin_community_threads with (security_invoker = true) as
select
  t.id, t.title, t.body, t.category, c.name as category_name, t.status,
  t.author_id, u.display_name as author_name,
  case when b.id is null then null else jsonb_build_object('id', b.id, 'slug', b.slug::text, 'name', b.name) end as bar,
  t.reply_count, t.like_count, t.view_count, t.created_at, t.edited_at,
  (select count(*) from public.community_reports r where r.thread_id = t.id and r.status = 'OPEN')::integer as open_report_count,
  coalesce((select jsonb_agg(jsonb_build_object('reason', r.reason, 'detail', r.detail, 'status', r.status, 'created_at', r.created_at)
                             order by r.created_at)
            from public.community_reports r where r.thread_id = t.id), '[]'::jsonb) as reports
from public.community_threads t
join public.community_categories c on c.slug = t.category
left join public.users u on u.id = t.author_id
left join public.bars b on b.id = t.bar_id
where public.is_admin() and t.status <> 'DELETED';

create view public.admin_community_comments with (security_invoker = true) as
select
  cm.id, cm.thread_id, t.title as thread_title, cm.parent_id, cm.body, cm.status,
  cm.author_id, u.display_name as author_name, cm.like_count, cm.created_at,
  (select count(*) from public.community_reports r where r.comment_id = cm.id and r.status = 'OPEN')::integer as open_report_count,
  coalesce((select jsonb_agg(jsonb_build_object('reason', r.reason, 'detail', r.detail, 'status', r.status, 'created_at', r.created_at)
                             order by r.created_at)
            from public.community_reports r where r.comment_id = cm.id), '[]'::jsonb) as reports
from public.community_comments cm
join public.community_threads t on t.id = cm.thread_id
left join public.users u on u.id = cm.author_id
where public.is_admin() and cm.status <> 'DELETED';

revoke all on public.admin_community_threads, public.admin_community_comments from anon;
grant select on public.admin_community_threads, public.admin_community_comments to authenticated;

-- ---------------------------------------------------------------------
-- 6. สิทธิ์ของฟังก์ชัน
-- ---------------------------------------------------------------------
-- อ่าน: ทุกคน (ตรวจสิทธิ์ในตัว)
revoke all on function public.community_categories_list() from public;
revoke all on function public.community_feed(text, text, text, text, uuid, integer, integer) from public;
revoke all on function public.community_thread(uuid) from public;
revoke all on function public.community_trending_bars(integer, integer) from public;
revoke all on function public.my_community_drafts() from public, anon;
grant execute on function public.community_categories_list() to anon, authenticated, service_role;
grant execute on function public.community_feed(text, text, text, text, uuid, integer, integer) to anon, authenticated, service_role;
grant execute on function public.community_thread(uuid) to anon, authenticated, service_role;
grant execute on function public.community_trending_bars(integer, integer) to anon, authenticated, service_role;
grant execute on function public.my_community_drafts() to authenticated, service_role;

-- ตัวช่วย + เขียน: service_role เท่านั้น
revoke all on function public.community_author(uuid) from public, anon, authenticated;
revoke all on function public.community_bar(uuid) from public, anon, authenticated;
revoke all on function public.community_refresh_counts(uuid) from public, anon, authenticated;
revoke all on function public.community_thread_check(public.users, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.community_thread_row(public.community_threads, uuid) from public, anon, authenticated;
revoke all on function public.community_add_view(uuid) from public, anon, authenticated;
revoke all on function public.app_community_create_thread(uuid, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.app_community_update_thread(uuid, uuid, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.app_community_delete_thread(uuid, uuid) from public, anon, authenticated;
revoke all on function public.app_community_add_comment(uuid, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.app_community_delete_comment(uuid, uuid) from public, anon, authenticated;
revoke all on function public.app_community_set_like(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.app_community_set_comment_like(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.app_community_set_save(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.app_community_set_pin(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.app_community_report(uuid, uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.app_community_save_draft(uuid, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.app_community_delete_draft(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.admin_community_moderate(uuid, text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.community_author(uuid) to service_role;
grant execute on function public.community_bar(uuid) to service_role;
grant execute on function public.community_refresh_counts(uuid) to service_role;
grant execute on function public.community_thread_check(public.users, text, text, text, uuid) to service_role;
grant execute on function public.community_thread_row(public.community_threads, uuid) to service_role;
grant execute on function public.community_add_view(uuid) to service_role;
grant execute on function public.app_community_create_thread(uuid, text, text, text, uuid) to service_role;
grant execute on function public.app_community_update_thread(uuid, uuid, text, text, text, uuid) to service_role;
grant execute on function public.app_community_delete_thread(uuid, uuid) to service_role;
grant execute on function public.app_community_add_comment(uuid, uuid, text, uuid) to service_role;
grant execute on function public.app_community_delete_comment(uuid, uuid) to service_role;
grant execute on function public.app_community_set_like(uuid, uuid, boolean) to service_role;
grant execute on function public.app_community_set_comment_like(uuid, uuid, boolean) to service_role;
grant execute on function public.app_community_set_save(uuid, uuid, boolean) to service_role;
grant execute on function public.app_community_set_pin(uuid, uuid, boolean) to service_role;
grant execute on function public.app_community_report(uuid, uuid, uuid, text, text) to service_role;
grant execute on function public.app_community_save_draft(uuid, text, uuid, jsonb) to service_role;
grant execute on function public.app_community_delete_draft(uuid, text, uuid) to service_role;
grant execute on function public.admin_community_moderate(uuid, text, uuid, text, text) to service_role;
