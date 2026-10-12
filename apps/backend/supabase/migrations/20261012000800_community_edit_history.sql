-- =====================================================================
-- NightOut · community — แก้ไขความเห็น + ประวัติการแก้ไข (กระทู้และความเห็น)
--   - เจ้าของแก้ความเห็นได้ (ข้อความ + ไฟล์แนบทั้งชุด) · community_comments.edited_at
--   - ทุกครั้งที่แก้แล้วเนื้อหาเปลี่ยนจริง เก็บเวอร์ชันก่อนหน้าใน community_revisions (แก้/ลบไม่ได้ · ทุกคนที่เห็นกระทู้/ความเห็นดูได้)
--   - ไฟล์ของเวอร์ชันเก่ายังอยู่ใน Storage (ประวัติอ้างอยู่) · ลบเมื่อเจ้าของลบกระทู้/ความเห็นนั้น
--   - ร่างแก้ความเห็น EDIT_COMMENT (1 ร่าง/กระทู้ · payload.comment_id) — ไฟล์ที่เลือกระหว่างแก้แล้วกดยกเลิก backend ลบให้
--   - อ่านประวัติ: community_history('THREAD' | 'COMMENT', id) · Backoffice: คอลัมน์ revisions ใน admin_community_*
-- =====================================================================
set search_path = public, extensions;

-- ---------------------------------------------------------------------
-- 1. ตาราง
-- ---------------------------------------------------------------------
alter table public.community_comments add column edited_at timestamptz;

alter table public.community_drafts drop constraint community_drafts_kind_check;
alter table public.community_drafts add constraint community_drafts_kind_check
  check (kind in ('NEW', 'REPLY', 'EDIT', 'EDIT_COMMENT'));

-- 1 แถว = เนื้อหา 1 เวอร์ชันที่ถูกแก้ทับไปแล้ว (เวอร์ชันปัจจุบันอยู่ในกระทู้/ความเห็นเอง)
create table public.community_revisions (
  id           uuid primary key default gen_random_uuid(),
  thread_id    uuid references public.community_threads(id) on delete cascade,
  comment_id   uuid references public.community_comments(id) on delete cascade,
  title        text,                                   -- กระทู้เท่านั้น
  category     text,                                   -- กระทู้เท่านั้น (slug)
  bar_id       uuid references public.bars(id) on delete set null,
  body         text not null default '',
  media        jsonb not null default '[]'::jsonb check (jsonb_typeof(media) = 'array'),
  media_paths  text[] generated always as (public.community_media_paths(media)) stored,
  version_at   timestamptz not null,                   -- เวอร์ชันนี้เริ่มแสดงเมื่อไร (สร้าง / แก้ครั้งก่อน)
  replaced_at  timestamptz not null default now(),     -- ถูกแก้ทับเมื่อไร
  check (num_nonnulls(thread_id, comment_id) = 1)
);
create index community_revisions_thread_id_fk on public.community_revisions (thread_id, replaced_at desc);
create index community_revisions_comment_id_fk on public.community_revisions (comment_id, replaced_at desc);
create index community_revisions_bar_id_fk on public.community_revisions (bar_id);
create index community_revisions_media_paths on public.community_revisions using gin (media_paths);

alter table public.community_revisions enable row level security;
-- …001600 สร้าง admin_read ให้ตารางที่มีตอนนั้นเท่านั้น — ตารางใหม่ต้องเพิ่มเอง
create policy admin_read on public.community_revisions for select to authenticated using (public.is_admin());
revoke insert, update, delete, truncate on public.community_revisions from anon, authenticated;
grant select on public.community_revisions to authenticated;

-- ---------------------------------------------------------------------
-- 2. ตัวช่วย
-- ---------------------------------------------------------------------
-- ไฟล์ปัจจุบันของกระทู้/ความเห็น (เก็บลงประวัติ — มี id เดิม หน้าเว็บใช้เป็น key)
create or replace function public.community_media_snapshot(p_thread uuid, p_comment uuid) returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', m.id, 'kind', m.kind, 'path', m.storage_path, 'thumb_path', m.thumb_path,
           'duration_sec', m.duration_sec, 'size_bytes', m.size_bytes) order by m.sort_order), '[]'::jsonb)
  from public.community_media m
  where m.thread_id is not distinct from p_thread and m.comment_id is not distinct from p_comment
$$;

-- ลายเซ็นของรายการไฟล์ (ไฟล์ + ภาพปก ตามลำดับ) — ไว้ดูว่าไฟล์เปลี่ยนไหม
create or replace function public.community_media_sig(p_media jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_array(e->>'path', e->>'thumb_path') order by o), '[]'::jsonb)
  from jsonb_array_elements(case when jsonb_typeof(p_media) = 'array' then p_media else '[]'::jsonb end) with ordinality t(e, o)
$$;

-- ไฟล์ของเจ้าของที่ไม่มีกระทู้/ความเห็น/ร่าง/ประวัติไหนอ้างแล้ว — ลบออกจาก Storage ได้
create or replace function public.community_paths_unused(p_owner uuid, p_paths text[]) returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(distinct x), '[]'::jsonb)
  from unnest(coalesce(p_paths, '{}')) x
  where x is not null
    and x like p_owner::text || '/%'
    and not exists (select 1 from public.community_media m where m.storage_path = x or m.thumb_path = x)
    and not exists (select 1 from public.community_drafts d
                    where d.user_id = p_owner and x = any (public.community_media_paths(d.payload->'media')))
    and not exists (select 1 from public.community_revisions r where r.media_paths @> array[x])
$$;

-- Storage: ไฟล์อยู่ในกระทู้/ความเห็นที่แสดงอยู่ — รวมไฟล์ในประวัติการแก้ไขของกระทู้/ความเห็นนั้น (ทุกคนอ่านได้)
create or replace function public.community_media_path_is_public(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from (
      select m.thread_id, m.comment_id from public.community_media m where m.storage_path = p_name or m.thumb_path = p_name
      union all
      select r.thread_id, r.comment_id from public.community_revisions r where r.media_paths @> array[p_name]
    ) x
    left join public.community_comments c on c.id = x.comment_id
    left join public.community_comments p on p.id = c.parent_id
    join public.community_threads t on t.id = coalesce(x.thread_id, c.thread_id)
    where t.status = 'PUBLISHED'
      and (x.comment_id is null or (c.status = 'PUBLISHED' and (c.parent_id is null or p.status = 'PUBLISHED'))))
$$;

-- path ไฟล์ทั้งหมดในประวัติของกระทู้/ความเห็น
create or replace function public.community_revision_paths(p_thread uuid, p_comment uuid) returns text[]
language sql stable set search_path = '' as $$
  select coalesce(array_agg(x), '{}')
  from public.community_revisions r, unnest(r.media_paths) x
  where r.thread_id is not distinct from p_thread and r.comment_id is not distinct from p_comment
$$;

-- ---------------------------------------------------------------------
-- 3. อ่าน
-- ---------------------------------------------------------------------
-- กระทู้ + ความเห็น (เพิ่ม edited_at ของความเห็น)
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
               'author', public.community_author(c.author_id),
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

-- ประวัติการแก้ไข — ใหม่สุดก่อน (แถวแรก = เวอร์ชันปัจจุบัน) · เห็นได้เท่ากับที่เห็นกระทู้/ความเห็นนั้น (แอดมินเห็นทุกสถานะ)
--   p_target: THREAD / COMMENT · คืน [{title?, category_name?, bar?, body, media, at, is_current}]
create or replace function public.community_history(p_target text, p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid(); v_admin boolean := public.is_admin();
  t public.community_threads; c public.community_comments; p public.community_comments;
begin
  if p_target = 'THREAD' then
    select * into t from public.community_threads where id = p_id;
    if not found or not (t.status = 'PUBLISHED' or (t.status = 'HIDDEN' and t.author_id = v_me) or (v_admin and t.status <> 'DELETED')) then
      raise exception 'THREAD_NOT_FOUND' using errcode = 'P0002';
    end if;
    return jsonb_build_array(jsonb_build_object(
             'title', t.title,
             'category_name', (select g.name from public.community_categories g where g.slug = t.category),
             'bar', (select jsonb_build_object('id', b.id, 'slug', b.slug::text, 'name', b.name) from public.bars b where b.id = t.bar_id),
             'body', t.body,
             'media', public.community_media_json(t.id, null),
             'at', coalesce(t.edited_at, t.created_at),
             'is_current', true))
        || coalesce((
             select jsonb_agg(jsonb_build_object(
                      'title', r.title,
                      'category_name', (select g.name from public.community_categories g where g.slug = r.category),
                      'bar', (select jsonb_build_object('id', b.id, 'slug', b.slug::text, 'name', b.name) from public.bars b where b.id = r.bar_id),
                      'body', r.body,
                      'media', r.media,
                      'at', r.version_at,
                      'is_current', false) order by r.replaced_at desc)
             from public.community_revisions r where r.thread_id = t.id), '[]'::jsonb);
  elsif p_target = 'COMMENT' then
    select * into c from public.community_comments where id = p_id;
    if found then
      select * into t from public.community_threads where id = c.thread_id;
      select * into p from public.community_comments where id = c.parent_id;
    end if;
    if c.id is null or not (
         (c.status = 'PUBLISHED' and t.status = 'PUBLISHED' and (c.parent_id is null or p.status = 'PUBLISHED'))
         or (v_admin and c.status <> 'DELETED')) then
      raise exception 'COMMENT_NOT_FOUND' using errcode = 'P0002';
    end if;
    return jsonb_build_array(jsonb_build_object(
             'body', c.body,
             'media', public.community_media_json(null, c.id),
             'at', coalesce(c.edited_at, c.created_at),
             'is_current', true))
        || coalesce((
             select jsonb_agg(jsonb_build_object('body', r.body, 'media', r.media, 'at', r.version_at, 'is_current', false)
                              order by r.replaced_at desc)
             from public.community_revisions r where r.comment_id = c.id), '[]'::jsonb);
  end if;
  raise exception 'INVALID_COMMUNITY_QUERY' using errcode = '22023';
end $$;

-- ---------------------------------------------------------------------
-- 4. เขียน
-- ---------------------------------------------------------------------
-- แก้กระทู้ · p_media null = คงไฟล์เดิม · เนื้อหาเปลี่ยนจริง → เก็บเวอร์ชันเดิมลงประวัติ + edited_at
create or replace function public.app_community_update_thread(p_actor uuid, p_thread uuid, p_category text, p_title text, p_body text,
                                                              p_bar uuid default null, p_media jsonb default null)
returns jsonb language plpgsql set search_path = '' as $$
declare
  u public.users; t public.community_threads; v_old text[] := '{}'; v_draft text[];
  v_snap jsonb; v_media jsonb; v_title text := trim(p_title); v_body text := coalesce(trim(p_body), '');
begin
  u := public.app_assert_user(p_actor);
  select * into t from public.community_threads where id = p_thread and status in ('PUBLISHED', 'HIDDEN') for update;
  if not found then raise exception 'THREAD_NOT_FOUND' using errcode = 'P0002'; end if;
  if t.author_id <> p_actor then raise exception 'NOT_THREAD_OWNER' using errcode = '42501'; end if;
  perform public.community_thread_check(u, p_category, p_title, p_body, p_bar);
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
       set category = p_category, title = v_title, body = v_body, bar_id = p_bar, edited_at = now()
     where id = p_thread;
    perform public.app_audit(p_actor, 'community.thread.update', 'community_threads', p_thread,
                             jsonb_build_object('category', p_category, 'bar_id', p_bar));
  end if;

  select coalesce(array_agg(x), '{}') into v_draft
    from public.community_drafts d, unnest(public.community_media_paths(d.payload->'media')) x
   where d.user_id = p_actor and d.kind = 'EDIT' and d.thread_id = p_thread;
  delete from public.community_drafts where user_id = p_actor and kind = 'EDIT' and thread_id = p_thread;
  return jsonb_build_object('id', p_thread, 'removed_paths', public.community_paths_unused(p_actor, v_old || v_draft));
end $$;

-- แก้ความเห็นของตัวเอง · p_media null = คงไฟล์เดิม · [] = เอาไฟล์ออกทั้งหมด · ร่าง EDIT_COMMENT ของความเห็นนี้ถูกลบ
create or replace function public.app_community_update_comment(p_actor uuid, p_comment uuid, p_body text, p_media jsonb default null)
returns jsonb language plpgsql set search_path = '' as $$
declare
  u public.users; c public.community_comments; v_old text[] := '{}'; v_draft text[];
  v_snap jsonb; v_media jsonb; v_body text := trim(coalesce(p_body, '')); v_edited timestamptz;
begin
  u := public.app_assert_user(p_actor);
  if u.banned_at is not null then raise exception 'COMMUNITY_BANNED' using errcode = '42501'; end if;
  select * into c from public.community_comments where id = p_comment and status = 'PUBLISHED' for update;
  if not found then raise exception 'COMMENT_NOT_FOUND' using errcode = 'P0002'; end if;
  if c.author_id <> p_actor then raise exception 'NOT_COMMENT_OWNER' using errcode = '42501'; end if;
  if not exists (select 1 from public.community_threads where id = c.thread_id and status = 'PUBLISHED') then
    raise exception 'THREAD_NOT_FOUND' using errcode = 'P0002';
  end if;
  v_snap := public.community_media_snapshot(null, p_comment);
  v_media := case when p_media is null then v_snap else public.community_media_norm(p_actor, p_media) end;
  if char_length(v_body) > 2000 or (v_body = '' and jsonb_array_length(v_media) = 0) then
    raise exception 'INVALID_COMMUNITY_COMMENT' using errcode = '22023';
  end if;

  v_edited := c.edited_at;
  if c.body is distinct from v_body or public.community_media_sig(v_snap) <> public.community_media_sig(v_media) then
    insert into public.community_revisions (comment_id, body, media, version_at)
    values (p_comment, c.body, v_snap, coalesce(c.edited_at, c.created_at));
    if p_media is not null then
      v_old := public.community_media_set(p_actor, null, p_comment, v_media);
    end if;
    update public.community_comments set body = v_body, edited_at = now() where id = p_comment returning edited_at into v_edited;
    perform public.app_audit(p_actor, 'community.comment.update', 'community_comments', p_comment,
                             jsonb_build_object('thread_id', c.thread_id, 'media', jsonb_array_length(v_media)));
  end if;

  select coalesce(array_agg(x), '{}') into v_draft
    from public.community_drafts d, unnest(public.community_media_paths(d.payload->'media')) x
   where d.user_id = p_actor and d.kind = 'EDIT_COMMENT' and d.thread_id = c.thread_id and d.payload->>'comment_id' = p_comment::text;
  delete from public.community_drafts
   where user_id = p_actor and kind = 'EDIT_COMMENT' and thread_id = c.thread_id and payload->>'comment_id' = p_comment::text;
  return jsonb_build_object('id', p_comment, 'thread_id', c.thread_id, 'edited_at', v_edited,
                            'removed_paths', public.community_paths_unused(p_actor, v_old || v_draft));
end $$;

-- เจ้าของลบกระทู้ = จบถาวร → ลบไฟล์แนบ + ประวัติของตัวกระทู้ (ความเห็นของคนอื่นคงไว้ในระบบ แต่ไม่แสดงแล้ว)
create or replace function public.app_community_delete_thread(p_actor uuid, p_thread uuid)
returns jsonb language plpgsql set search_path = '' as $$
declare t public.community_threads; v_old text[]; v_rev text[]; v_draft text[];
begin
  perform public.app_assert_user(p_actor);
  select * into t from public.community_threads where id = p_thread and status in ('PUBLISHED', 'HIDDEN') for update;
  if not found then raise exception 'THREAD_NOT_FOUND' using errcode = 'P0002'; end if;
  if t.author_id <> p_actor then raise exception 'NOT_THREAD_OWNER' using errcode = '42501'; end if;
  update public.community_threads set status = 'DELETED' where id = p_thread;
  v_old := public.community_media_set(p_actor, p_thread, null, '[]'::jsonb);
  v_rev := public.community_revision_paths(p_thread, null);
  delete from public.community_revisions where thread_id = p_thread;
  select coalesce(array_agg(x), '{}') into v_draft
    from public.community_drafts d, unnest(public.community_media_paths(d.payload->'media')) x
   where d.thread_id = p_thread and d.user_id = p_actor;
  delete from public.community_drafts where thread_id = p_thread;
  delete from public.community_pins where thread_id = p_thread;
  perform public.app_audit(p_actor, 'community.thread.delete', 'community_threads', p_thread, jsonb_build_object('status', 'DELETED'));
  return jsonb_build_object('id', p_thread, 'status', 'DELETED',
                            'removed_paths', public.community_paths_unused(p_actor, v_old || v_rev || v_draft));
end $$;

-- เจ้าของลบความเห็น → ลบไฟล์แนบ + ประวัติ + ร่างแก้ความเห็นนี้
create or replace function public.app_community_delete_comment(p_actor uuid, p_comment uuid)
returns jsonb language plpgsql set search_path = '' as $$
declare c public.community_comments; v_old text[]; v_rev text[]; v_draft text[];
begin
  perform public.app_assert_user(p_actor);
  select * into c from public.community_comments where id = p_comment and status = 'PUBLISHED' for update;
  if not found then raise exception 'COMMENT_NOT_FOUND' using errcode = 'P0002'; end if;
  if c.author_id <> p_actor then raise exception 'NOT_COMMENT_OWNER' using errcode = '42501'; end if;
  update public.community_comments set status = 'DELETED' where id = p_comment;
  v_old := public.community_media_set(p_actor, null, p_comment, '[]'::jsonb);
  v_rev := public.community_revision_paths(null, p_comment);
  delete from public.community_revisions where comment_id = p_comment;
  select coalesce(array_agg(x), '{}') into v_draft
    from public.community_drafts d, unnest(public.community_media_paths(d.payload->'media')) x
   where d.user_id = p_actor and d.kind = 'EDIT_COMMENT' and d.payload->>'comment_id' = p_comment::text;
  delete from public.community_drafts
   where user_id = p_actor and kind = 'EDIT_COMMENT' and payload->>'comment_id' = p_comment::text;
  perform public.community_refresh_counts(c.thread_id);
  return jsonb_build_object('id', p_comment, 'thread_id', c.thread_id, 'status', 'DELETED',
                            'removed_paths', public.community_paths_unused(p_actor, v_old || v_rev || v_draft));
end $$;

-- บันทึกร่าง (+ EDIT_COMMENT: payload.comment_id ต้องเป็นความเห็นของฉันที่แสดงอยู่ในกระทู้นั้น)
create or replace function public.app_community_save_draft(p_actor uuid, p_kind text, p_thread uuid, p_payload jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare t public.community_threads; d public.community_drafts; v_old text[]; v_payload jsonb; v_comment uuid;
begin
  perform public.app_assert_user(p_actor);
  if p_kind not in ('NEW', 'REPLY', 'EDIT', 'EDIT_COMMENT') or (p_kind = 'NEW') <> (p_thread is null)
     or jsonb_typeof(coalesce(p_payload, 'null'::jsonb)) <> 'object' or pg_column_size(p_payload) > 32768 then
    raise exception 'INVALID_COMMUNITY_DRAFT' using errcode = '22023';
  end if;
  if p_thread is not null then
    select * into t from public.community_threads where id = p_thread and status in ('PUBLISHED', 'HIDDEN');
    if not found or (p_kind in ('REPLY', 'EDIT_COMMENT') and t.status <> 'PUBLISHED') then
      raise exception 'THREAD_NOT_FOUND' using errcode = 'P0002';
    end if;
    if p_kind = 'EDIT' and t.author_id <> p_actor then raise exception 'NOT_THREAD_OWNER' using errcode = '42501'; end if;
  end if;
  if p_kind = 'EDIT_COMMENT' then
    if coalesce(p_payload->>'comment_id', '') !~ '^[0-9a-fA-F-]{36}$' then
      raise exception 'INVALID_COMMUNITY_DRAFT' using errcode = '22023';
    end if;
    v_comment := (p_payload->>'comment_id')::uuid;
    if not exists (select 1 from public.community_comments
                   where id = v_comment and thread_id = p_thread and status = 'PUBLISHED' and author_id = p_actor) then
      raise exception 'COMMENT_NOT_FOUND' using errcode = 'P0002';
    end if;
  end if;
  v_payload := case when p_payload ? 'media'
                    then jsonb_set(p_payload, '{media}', public.community_media_norm(p_actor, p_payload->'media'))
                    else p_payload end;

  select coalesce(array_agg(x), '{}') into v_old
    from public.community_drafts dd, unnest(public.community_media_paths(dd.payload->'media')) x
   where dd.user_id = p_actor
     and (dd.updated_at <= now() - interval '7 days' or (dd.kind = p_kind and dd.thread_id is not distinct from p_thread));
  delete from public.community_drafts where user_id = p_actor and updated_at <= now() - interval '7 days';
  update public.community_drafts set payload = v_payload, updated_at = now()
   where user_id = p_actor and kind = p_kind and thread_id is not distinct from p_thread
  returning * into d;
  if not found then
    insert into public.community_drafts (user_id, kind, thread_id, payload)
    values (p_actor, p_kind, p_thread, v_payload)
    returning * into d;
  end if;
  return jsonb_build_object('id', d.id, 'kind', d.kind, 'thread_id', d.thread_id, 'payload', d.payload, 'updated_at', d.updated_at,
                            'removed_paths', public.community_paths_unused(p_actor, v_old));
end $$;

-- ---------------------------------------------------------------------
-- 5. Backoffice — เพิ่ม revisions (เวอร์ชันก่อนหน้า ใหม่สุดก่อน) + edited_at ของความเห็น (ต่อท้ายคอลัมน์เดิม)
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
            from public.community_revisions rv where rv.thread_id = t.id), '[]'::jsonb) as revisions
from public.community_threads t
join public.community_categories c on c.slug = t.category
left join public.users u on u.id = t.author_id
left join public.bars b on b.id = t.bar_id
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
            from public.community_revisions rv where rv.comment_id = cm.id), '[]'::jsonb) as revisions
from public.community_comments cm
join public.community_threads t on t.id = cm.thread_id
left join public.users u on u.id = cm.author_id
where public.is_admin() and cm.status <> 'DELETED';

-- ---------------------------------------------------------------------
-- 6. สิทธิ์ของฟังก์ชัน
-- ---------------------------------------------------------------------
revoke all on function public.community_history(text, uuid) from public;
grant execute on function public.community_history(text, uuid) to anon, authenticated, service_role;

revoke all on function public.community_media_snapshot(uuid, uuid) from public, anon, authenticated;
revoke all on function public.community_media_sig(jsonb) from public, anon, authenticated;
revoke all on function public.community_revision_paths(uuid, uuid) from public, anon, authenticated;
revoke all on function public.app_community_update_comment(uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.community_media_snapshot(uuid, uuid) to service_role;
grant execute on function public.community_media_sig(jsonb) to service_role;
grant execute on function public.community_revision_paths(uuid, uuid) to service_role;
grant execute on function public.app_community_update_comment(uuid, uuid, text, jsonb) to service_role;
