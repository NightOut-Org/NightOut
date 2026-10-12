-- =====================================================================
-- bar · บันทึกหน้า /merchant/safety ในคำขอเดียว (CLAUDE.md "ฟอร์ม · การบันทึก")
--   p_items = [{ "key": text, "value"?: safety_value, "evidence_path"?: text }] — เฉพาะข้อที่เปลี่ยน
--   value → app_set_safety (กลับเป็น SELF_DECLARED + คำนวณคะแนนใหม่) · evidence_path → เก็บหลักฐาน (ไฟล์ bar-verifications/<bar_id>/…)
-- ธุรกรรมเดียว · แจ้งแอดมินเรื่องหลักฐาน 1 ครั้งต่อการบันทึก (เดิมแจ้งทีละไฟล์)
-- =====================================================================
create or replace function public.app_save_safety(p_actor uuid, p_bar uuid, p_items jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare
  it jsonb;
  v_key text;
  v_path text;
  n_value integer := 0;
  keys_ev text[] := '{}';
begin
  perform public.app_assert_user(p_actor);
  perform public.app_assert_manager(p_actor, p_bar);
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 50
     or jsonb_array_length(p_items) <> (select count(distinct upper(x->>'key')) from jsonb_array_elements(p_items) x) then
    raise exception 'INVALID_SAFETY_ITEMS' using errcode = '22023';
  end if;

  for it in select * from jsonb_array_elements(p_items) loop
    v_key := upper(it->>'key');
    if not exists (select 1 from public.safety_features where key = v_key) then
      raise exception 'SAFETY_FEATURE_NOT_FOUND' using errcode = 'P0002';
    end if;
    if not (it ? 'value') and not (it ? 'evidence_path') then
      raise exception 'INVALID_SAFETY_ITEMS' using errcode = '22023';
    end if;

    if it ? 'value' then
      perform public.app_set_safety(p_actor, p_bar, v_key, (it->>'value')::public.safety_value);
      n_value := n_value + 1;
    end if;

    if it ? 'evidence_path' then
      v_path := it->>'evidence_path';
      if v_path is null or split_part(v_path, '/', 1) <> p_bar::text then
        raise exception 'INVALID_EVIDENCE_PATH' using errcode = '22023';
      end if;
      insert into public.bar_safety_features (bar_id, feature_key, evidence_path, source)
      values (p_bar, v_key, v_path, 'SELF_DECLARED')
      on conflict (bar_id, feature_key) do update set evidence_path = excluded.evidence_path;
      keys_ev := keys_ev || v_key;
    end if;
  end loop;

  if cardinality(keys_ev) > 0 then
    perform public.app_audit(p_actor, 'bar.safety.evidence', 'bars', p_bar, jsonb_build_object('keys', to_jsonb(keys_ev)));
    perform public.app_notify_admins('SAFETY_EVIDENCE', 'มีหลักฐาน Safety รอตรวจ',
      (select name from public.bars where id = p_bar) || ' · ' || array_to_string(keys_ev, ', '), '/safety', null, p_bar);
  end if;

  return jsonb_build_object('bar_id', p_bar, 'values_updated', n_value, 'evidence_added', cardinality(keys_ev));
end $$;

revoke all on function public.app_save_safety(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.app_save_safety(uuid, uuid, jsonb) to service_role;
