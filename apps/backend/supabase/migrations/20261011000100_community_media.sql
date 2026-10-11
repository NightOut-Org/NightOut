-- =====================================================================
-- NightOut · community — แนบรูป/วิดีโอในกระทู้และความคิดเห็น (สูงสุด 6 ไฟล์ · วิดีโอ ≤ 60 วิ / 60MB ตามกติกาของรีวิว)
--   - bucket community-media (private) : <user_id>/<ไฟล์> · อัปโหลดทันทีที่เลือก (ร่างเก็บ path ไว้ → เปิดร่างจากเครื่องไหนก็เห็นไฟล์)
--   - อ่านไฟล์: เจ้าของ · แอดมิน · ทุกคนเมื่อไฟล์อยู่ในกระทู้/ความเห็นที่แสดงอยู่ (NestJS ขอ signed URL ในนามผู้เรียก)
--   - ตาราง community_media (1 แถว = 1 ไฟล์ของกระทู้หรือความเห็น)
--   - payload ของร่างมี media [] · ตรวจ path จริงใน Storage (community_media_norm)
--   - ฟังก์ชันเขียนคืน removed_paths = ไฟล์ของเจ้าของที่ไม่มีกระทู้/ความเห็น/ร่างไหนอ้างแล้ว → NestJS ลบออกจาก Storage
--   - ความเห็นที่มีไฟล์แนบ ไม่ต้องพิมพ์ข้อความก็ส่งได้
-- =====================================================================
set search_path = public, extensions;

-- ---------------------------------------------------------------------
-- 1. Storage
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('community-media', 'community-media', false, 62914560,
   array['image/jpeg','image/png','image/webp','image/heic','video/mp4','video/quicktime','video/webm'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------
-- 2. ตาราง
-- ---------------------------------------------------------------------
create table public.community_media (
  id            uuid primary key default gen_random_uuid(),
  thread_id     uuid references public.community_threads(id) on delete cascade,
  comment_id    uuid references public.community_comments(id) on delete cascade,
  owner_id      uuid not null references public.users(id) on delete cascade,
  kind          public.media_kind not null,
  storage_path  text not null unique,                -- community-media: <owner_id>/<ไฟล์>
  thumb_path    text,                                -- ภาพปกวิดีโอ
  duration_sec  smallint check (duration_sec is null or duration_sec between 0 and 60),
  size_bytes    integer check (size_bytes is null or size_bytes <= 62914560),
  sort_order    smallint not null default 0,
  created_at    timestamptz not null default now(),
  check (num_nonnulls(thread_id, comment_id) = 1)
);
create index community_media_thread_id_fk on public.community_media (thread_id, sort_order);
create index community_media_comment_id_fk on public.community_media (comment_id, sort_order);
create index community_media_owner_id_fk on public.community_media (owner_id);
create index community_media_thumb_path on public.community_media (thumb_path) where thumb_path is not null;

alter table public.community_media enable row level security;
-- …001600 สร้าง admin_read ให้ตารางที่มีตอนนั้นเท่านั้น — ตารางใหม่ต้องเพิ่มเอง
create policy admin_read on public.community_media for select to authenticated using (public.is_admin());
revoke insert, update, delete, truncate on public.community_media from anon, authenticated;
grant select on public.community_media to authenticated;

-- ความเห็นที่มีแต่ไฟล์แนบ → ข้อความว่างได้ (ฟังก์ชันตรวจว่าต้องมีข้อความหรือไฟล์อย่างใดอย่างหนึ่ง)
alter table public.community_comments drop constraint community_comments_body_check;
alter table public.community_comments add constraint community_comments_body_check check (char_length(body) <= 2000);

-- ---------------------------------------------------------------------
-- 3. ตัวช่วย
-- ---------------------------------------------------------------------
-- ไฟล์อยู่ในโฟลเดอร์ของเจ้าของ และอัปโหลดขึ้น Storage แล้วจริง
create or replace function public.community_media_path_ok(p_owner uuid, p_path text) returns boolean
language sql stable set search_path = '' as $$
  select p_path is not null
     and p_path ~ ('^' || p_owner::text || '/[A-Za-z0-9][A-Za-z0-9._-]{0,120}$')
     and exists (select 1 from storage.objects o where o.bucket_id = 'community-media' and o.name = p_path)
$$;

-- ตรวจ + จัดรูปรายการไฟล์ [{path, kind, thumb_path?, duration_sec?, size_bytes?}] (null / ไม่ส่ง = [])
create or replace function public.community_media_norm(p_owner uuid, p_media jsonb) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  m jsonb; v_out jsonb := '[]'::jsonb; v_seen text[] := '{}';
  v_path text; v_kind text; v_thumb text; v_dur integer; v_size bigint;
begin
  if p_media is null or jsonb_typeof(p_media) = 'null' then return '[]'::jsonb; end if;
  if jsonb_typeof(p_media) <> 'array' or jsonb_array_length(p_media) > 6 then
    raise exception 'INVALID_COMMUNITY_MEDIA' using errcode = '22023', detail = 'max 6';
  end if;
  for m in select * from jsonb_array_elements(p_media) loop
    if jsonb_typeof(m) <> 'object' then raise exception 'INVALID_COMMUNITY_MEDIA' using errcode = '22023'; end if;
    v_path := m->>'path';
    v_kind := m->>'kind';
    v_thumb := nullif(m->>'thumb_path', '');
    v_dur := case when jsonb_typeof(m->'duration_sec') = 'number' then round((m->>'duration_sec')::numeric)::integer end;
    v_size := case when jsonb_typeof(m->'size_bytes') = 'number' then round((m->>'size_bytes')::numeric)::bigint end;
    if coalesce(v_kind, '') not in ('IMAGE', 'VIDEO')
       or not public.community_media_path_ok(p_owner, v_path)
       or v_path = any (v_seen)
       or (v_thumb is not null and (v_kind <> 'VIDEO' or v_thumb = v_path or not public.community_media_path_ok(p_owner, v_thumb)))
       or (v_dur is not null and (v_dur < 0 or v_dur > 60))
       or (v_size is not null and (v_size < 0 or v_size > 62914560)) then
      raise exception 'INVALID_COMMUNITY_MEDIA' using errcode = '22023', detail = coalesce(v_path, '');
    end if;
    v_seen := v_seen || v_path;
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'path', v_path, 'kind', v_kind, 'thumb_path', v_thumb, 'duration_sec', v_dur, 'size_bytes', v_size));
  end loop;
  return v_out;
end $$;

-- path ทั้งหมด (ไฟล์ + ภาพปก) ในรายการไฟล์
create or replace function public.community_media_paths(p_media jsonb) returns text[]
language sql immutable set search_path = '' as $$
  select coalesce(array_agg(x), '{}') from (
    select e->>'path' as x from jsonb_array_elements(case when jsonb_typeof(p_media) = 'array' then p_media else '[]'::jsonb end) e
    union all
    select e->>'thumb_path' from jsonb_array_elements(case when jsonb_typeof(p_media) = 'array' then p_media else '[]'::jsonb end) e
  ) t where x is not null
$$;

-- ไฟล์ของเจ้าของ (จากรายการ path เดิม) ที่ไม่มีกระทู้/ความเห็น/ร่างไหนอ้างแล้ว — ลบออกจาก Storage ได้
create or replace function public.community_paths_unused(p_owner uuid, p_paths text[]) returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(distinct x), '[]'::jsonb)
  from unnest(coalesce(p_paths, '{}')) x
  where x is not null
    and x like p_owner::text || '/%'
    and not exists (select 1 from public.community_media m where m.storage_path = x or m.thumb_path = x)
    and not exists (select 1 from public.community_drafts d
                    where d.user_id = p_owner and x = any (public.community_media_paths(d.payload->'media')))
$$;

-- แทนที่ไฟล์ทั้งชุดของกระทู้/ความเห็น (p_media ผ่าน community_media_norm แล้ว) · คืน path เดิมทั้งหมด
create or replace function public.community_media_set(p_owner uuid, p_thread uuid, p_comment uuid, p_media jsonb) returns text[]
language plpgsql set search_path = '' as $$
declare v_old text[];
begin
  select coalesce(array_agg(x), '{}') into v_old from (
    select storage_path as x from public.community_media where thread_id is not distinct from p_thread and comment_id is not distinct from p_comment
    union all
    select thumb_path from public.community_media where thread_id is not distinct from p_thread and comment_id is not distinct from p_comment
  ) t where x is not null;
  delete from public.community_media where thread_id is not distinct from p_thread and comment_id is not distinct from p_comment;
  insert into public.community_media (thread_id, comment_id, owner_id, kind, storage_path, thumb_path, duration_sec, size_bytes, sort_order)
  select p_thread, p_comment, p_owner, (e->>'kind')::public.media_kind, e->>'path', e->>'thumb_path',
         (e->>'duration_sec')::smallint, (e->>'size_bytes')::integer, (o - 1)::smallint
  from jsonb_array_elements(coalesce(p_media, '[]'::jsonb)) with ordinality t(e, o);
  return v_old;
end $$;

-- ไฟล์ของกระทู้/ความเห็น สำหรับหน้าเว็บ (NestJS เติม url / thumb_url)
create or replace function public.community_media_json(p_thread uuid, p_comment uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', m.id, 'kind', m.kind, 'path', m.storage_path, 'thumb_path', m.thumb_path, 'duration_sec', m.duration_sec)
         order by m.sort_order), '[]'::jsonb)
  from public.community_media m
  where m.thread_id is not distinct from p_thread and m.comment_id is not distinct from p_comment
$$;

-- Storage: ไฟล์อยู่ในกระทู้/ความเห็นที่แสดงอยู่ (ทุกคนอ่านได้)
create or replace function public.community_media_path_is_public(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.community_media m
    left join public.community_comments c on c.id = m.comment_id
    left join public.community_comments p on p.id = c.parent_id
    join public.community_threads t on t.id = coalesce(m.thread_id, c.thread_id)
    where (m.storage_path = p_name or m.thumb_path = p_name)
      and t.status = 'PUBLISHED'
      and (m.comment_id is null or (c.status = 'PUBLISHED' and (c.parent_id is null or p.status = 'PUBLISHED'))))
$$;

create policy "community-media: read" on storage.objects for select to anon, authenticated
  using (bucket_id = 'community-media' and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or public.community_media_path_is_public(name)
    or public.is_admin()));
create policy "community-media: owner write" on storage.objects for insert to authenticated
  with check (bucket_id = 'community-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "community-media: owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'community-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------
-- 4. อ่าน — กระทู้ + ไฟล์แนบ
-- ---------------------------------------------------------------------
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
               'media', public.community_media_json(null, c.id),
               'is_mine', v_me is not null and c.author_id = v_me,
               'is_liked', v_me is not null and exists (
                 select 1 from public.community_comment_likes l where l.comment_id = c.id and l.user_id = v_me))
             order by c.created_at)
      from public.community_comments c
      left join public.community_comments p on p.id = c.parent_id
      where c.thread_id = t.id and c.status = 'PUBLISHED' and (c.parent_id is null or p.status = 'PUBLISHED')), '[]'::jsonb));
end $$;

-- ---------------------------------------------------------------------
-- 5. เขียน (ลายเซ็นใหม่ → ลบตัวเดิมก่อน กัน overload ชนกัน)
-- ---------------------------------------------------------------------
drop function public.app_community_create_thread(uuid, text, text, text, uuid);
drop function public.app_community_update_thread(uuid, uuid, text, text, text, uuid);
drop function public.app_community_add_comment(uuid, uuid, text, uuid);

-- ตั้งกระทู้ + ไฟล์แนบ · ร่าง NEW ถูกลบ (ไฟล์ในร่างที่ไม่ได้ใช้ → removed_paths)
create or replace function public.app_community_create_thread(p_actor uuid, p_category text, p_title text, p_body text,
                                                              p_bar uuid default null, p_media jsonb default '[]'::jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare u public.users; v_id uuid; v_media jsonb; v_draft text[];
begin
  u := public.app_assert_user(p_actor);
  perform public.community_thread_check(u, p_category, p_title, p_body, p_bar);
  v_media := public.community_media_norm(p_actor, p_media);
  insert into public.community_threads (author_id, category, title, body, bar_id)
  values (p_actor, p_category, trim(p_title), coalesce(trim(p_body), ''), p_bar)
  returning id into v_id;
  perform public.community_media_set(p_actor, v_id, null, v_media);
  select coalesce(array_agg(x), '{}') into v_draft
    from public.community_drafts d, unnest(public.community_media_paths(d.payload->'media')) x
   where d.user_id = p_actor and d.kind = 'NEW';
  delete from public.community_drafts where user_id = p_actor and kind = 'NEW';
  perform public.app_audit(p_actor, 'community.thread.create', 'community_threads', v_id,
                           jsonb_build_object('category', p_category, 'bar_id', p_bar, 'media', jsonb_array_length(v_media)));
  return jsonb_build_object('id', v_id, 'removed_paths', public.community_paths_unused(p_actor, v_draft));
end $$;

-- แก้กระทู้ · p_media null = คงไฟล์เดิม · [] = เอาไฟล์ออกทั้งหมด
create or replace function public.app_community_update_thread(p_actor uuid, p_thread uuid, p_category text, p_title text, p_body text,
                                                              p_bar uuid default null, p_media jsonb default null)
returns jsonb language plpgsql set search_path = '' as $$
declare u public.users; t public.community_threads; v_old text[] := '{}'; v_draft text[];
begin
  u := public.app_assert_user(p_actor);
  select * into t from public.community_threads where id = p_thread and status in ('PUBLISHED', 'HIDDEN') for update;
  if not found then raise exception 'THREAD_NOT_FOUND' using errcode = 'P0002'; end if;
  if t.author_id <> p_actor then raise exception 'NOT_THREAD_OWNER' using errcode = '42501'; end if;
  perform public.community_thread_check(u, p_category, p_title, p_body, p_bar);
  if p_media is not null then
    v_old := public.community_media_set(p_actor, p_thread, null, public.community_media_norm(p_actor, p_media));
  end if;
  update public.community_threads
     set category = p_category, title = trim(p_title), body = coalesce(trim(p_body), ''), bar_id = p_bar, edited_at = now()
   where id = p_thread;
  select coalesce(array_agg(x), '{}') into v_draft
    from public.community_drafts d, unnest(public.community_media_paths(d.payload->'media')) x
   where d.user_id = p_actor and d.kind = 'EDIT' and d.thread_id = p_thread;
  delete from public.community_drafts where user_id = p_actor and kind = 'EDIT' and thread_id = p_thread;
  perform public.app_audit(p_actor, 'community.thread.update', 'community_threads', p_thread,
                           jsonb_build_object('category', p_category, 'bar_id', p_bar));
  return jsonb_build_object('id', p_thread, 'removed_paths', public.community_paths_unused(p_actor, v_old || v_draft));
end $$;

-- เจ้าของลบกระทู้ = จบถาวร → ลบไฟล์แนบของกระทู้ (ความเห็นของคนอื่นคงไว้ในระบบ แต่ไม่แสดงแล้ว)
create or replace function public.app_community_delete_thread(p_actor uuid, p_thread uuid)
returns jsonb language plpgsql set search_path = '' as $$
declare t public.community_threads; v_old text[]; v_draft text[];
begin
  perform public.app_assert_user(p_actor);
  select * into t from public.community_threads where id = p_thread and status in ('PUBLISHED', 'HIDDEN') for update;
  if not found then raise exception 'THREAD_NOT_FOUND' using errcode = 'P0002'; end if;
  if t.author_id <> p_actor then raise exception 'NOT_THREAD_OWNER' using errcode = '42501'; end if;
  update public.community_threads set status = 'DELETED' where id = p_thread;
  v_old := public.community_media_set(p_actor, p_thread, null, '[]'::jsonb);
  select coalesce(array_agg(x), '{}') into v_draft
    from public.community_drafts d, unnest(public.community_media_paths(d.payload->'media')) x
   where d.thread_id = p_thread and d.user_id = p_actor;
  delete from public.community_drafts where thread_id = p_thread;
  delete from public.community_pins where thread_id = p_thread;
  perform public.app_audit(p_actor, 'community.thread.delete', 'community_threads', p_thread, jsonb_build_object('status', 'DELETED'));
  return jsonb_build_object('id', p_thread, 'status', 'DELETED', 'removed_paths', public.community_paths_unused(p_actor, v_old || v_draft));
end $$;

-- ตอบกระทู้ + ไฟล์แนบ (ข้อความหรือไฟล์อย่างใดอย่างหนึ่ง) · ร่าง REPLY ของกระทู้นี้ถูกลบ
create or replace function public.app_community_add_comment(p_actor uuid, p_thread uuid, p_body text, p_parent uuid default null,
                                                            p_media jsonb default '[]'::jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare
  u public.users; t public.community_threads; p public.community_comments;
  v_parent uuid; v_id uuid; v_link text; v_media jsonb; v_body text := trim(coalesce(p_body, '')); v_draft text[];
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

  insert into public.community_comments (thread_id, parent_id, author_id, body)
  values (p_thread, v_parent, p_actor, v_body)
  returning id into v_id;
  perform public.community_media_set(p_actor, null, v_id, v_media);
  update public.community_threads set last_activity_at = now() where id = p_thread;
  perform public.community_refresh_counts(p_thread);
  select coalesce(array_agg(x), '{}') into v_draft
    from public.community_drafts d, unnest(public.community_media_paths(d.payload->'media')) x
   where d.user_id = p_actor and d.kind = 'REPLY' and d.thread_id = p_thread;
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
  return jsonb_build_object('id', v_id, 'thread_id', p_thread, 'parent_id', v_parent,
                            'removed_paths', public.community_paths_unused(p_actor, v_draft));
end $$;

create or replace function public.app_community_delete_comment(p_actor uuid, p_comment uuid)
returns jsonb language plpgsql set search_path = '' as $$
declare c public.community_comments; v_old text[];
begin
  perform public.app_assert_user(p_actor);
  select * into c from public.community_comments where id = p_comment and status = 'PUBLISHED' for update;
  if not found then raise exception 'COMMENT_NOT_FOUND' using errcode = 'P0002'; end if;
  if c.author_id <> p_actor then raise exception 'NOT_COMMENT_OWNER' using errcode = '42501'; end if;
  update public.community_comments set status = 'DELETED' where id = p_comment;
  v_old := public.community_media_set(p_actor, null, p_comment, '[]'::jsonb);
  perform public.community_refresh_counts(c.thread_id);
  return jsonb_build_object('id', p_comment, 'thread_id', c.thread_id, 'status', 'DELETED',
                            'removed_paths', public.community_paths_unused(p_actor, v_old));
end $$;

-- บันทึกร่าง — payload.media ตรวจ path จริง · ไฟล์ที่ร่างเดิมมีแต่ร่างใหม่ไม่มี (และร่างที่หมดอายุ) → removed_paths
create or replace function public.app_community_save_draft(p_actor uuid, p_kind text, p_thread uuid, p_payload jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare t public.community_threads; d public.community_drafts; v_old text[]; v_payload jsonb;
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

create or replace function public.app_community_delete_draft(p_actor uuid, p_kind text, p_thread uuid default null)
returns jsonb language plpgsql set search_path = '' as $$
declare v_old text[]; v_deleted boolean;
begin
  perform public.app_assert_user(p_actor);
  select coalesce(array_agg(x), '{}') into v_old
    from public.community_drafts d, unnest(public.community_media_paths(d.payload->'media')) x
   where d.user_id = p_actor and d.kind = p_kind and d.thread_id is not distinct from p_thread;
  delete from public.community_drafts where user_id = p_actor and kind = p_kind and thread_id is not distinct from p_thread;
  v_deleted := found;
  return jsonb_build_object('kind', p_kind, 'thread_id', p_thread, 'deleted', v_deleted,
                            'removed_paths', public.community_paths_unused(p_actor, v_old));
end $$;

-- ---------------------------------------------------------------------
-- 6. Backoffice — view + ไฟล์แนบ (path · Backoffice ขอ signed URL เอง)
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
            from public.community_media m where m.thread_id = t.id), '[]'::jsonb) as media
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
            from public.community_media m where m.comment_id = cm.id), '[]'::jsonb) as media
from public.community_comments cm
join public.community_threads t on t.id = cm.thread_id
left join public.users u on u.id = cm.author_id
where public.is_admin() and cm.status <> 'DELETED';

revoke all on public.admin_community_threads, public.admin_community_comments from anon;
grant select on public.admin_community_threads, public.admin_community_comments to authenticated;

-- ---------------------------------------------------------------------
-- 7. สิทธิ์ของฟังก์ชัน
-- ---------------------------------------------------------------------
revoke all on function public.community_media_path_is_public(text) from public;
grant execute on function public.community_media_path_is_public(text) to anon, authenticated, service_role;
revoke all on function public.community_thread(uuid) from public;
grant execute on function public.community_thread(uuid) to anon, authenticated, service_role;

revoke all on function public.community_media_path_ok(uuid, text) from public, anon, authenticated;
revoke all on function public.community_media_norm(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.community_media_paths(jsonb) from public, anon, authenticated;
revoke all on function public.community_paths_unused(uuid, text[]) from public, anon, authenticated;
revoke all on function public.community_media_set(uuid, uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.community_media_json(uuid, uuid) from public, anon, authenticated;
revoke all on function public.app_community_create_thread(uuid, text, text, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.app_community_update_thread(uuid, uuid, text, text, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.app_community_delete_thread(uuid, uuid) from public, anon, authenticated;
revoke all on function public.app_community_add_comment(uuid, uuid, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.app_community_delete_comment(uuid, uuid) from public, anon, authenticated;
revoke all on function public.app_community_save_draft(uuid, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.app_community_delete_draft(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.community_media_path_ok(uuid, text) to service_role;
grant execute on function public.community_media_norm(uuid, jsonb) to service_role;
grant execute on function public.community_media_paths(jsonb) to service_role;
grant execute on function public.community_paths_unused(uuid, text[]) to service_role;
grant execute on function public.community_media_set(uuid, uuid, uuid, jsonb) to service_role;
grant execute on function public.community_media_json(uuid, uuid) to service_role;
grant execute on function public.app_community_create_thread(uuid, text, text, text, uuid, jsonb) to service_role;
grant execute on function public.app_community_update_thread(uuid, uuid, text, text, text, uuid, jsonb) to service_role;
grant execute on function public.app_community_delete_thread(uuid, uuid) to service_role;
grant execute on function public.app_community_add_comment(uuid, uuid, text, uuid, jsonb) to service_role;
grant execute on function public.app_community_delete_comment(uuid, uuid) to service_role;
grant execute on function public.app_community_save_draft(uuid, text, uuid, jsonb) to service_role;
grant execute on function public.app_community_delete_draft(uuid, text, uuid) to service_role;
