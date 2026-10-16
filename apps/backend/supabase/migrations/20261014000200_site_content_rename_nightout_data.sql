-- =====================================================================
-- NightOut · site-content — เปลี่ยนชื่อแบรนด์ที่ค้างในข้อมูล NightList → NightOut (2026-10-14)
--   …20261005000100_rename_nightout เปลี่ยนแค่โค้ด/ฟังก์ชัน ข้อมูลที่เขียนลงตารางก่อนหน้านั้นยังเป็นชื่อเดิม:
--     platform_settings deposit_promptpay / promotion_promptpay .name  ("NightList Co., Ltd." ใต้ QR PromptPay)
--     bars.perks (ร้านเดโม) · bar_promotions.description · notifications.title / body (แจ้งเตือนเก่า)
--   แทนเฉพาะแถวที่มีคำนี้ (ไม่แตะ updated_at แถวอื่น) · รันซ้ำได้
-- =====================================================================

update public.platform_settings
   set value = replace(value::text, 'NightList', 'NightOut')::jsonb
 where value::text like '%NightList%';

update public.bars
   set perks = (select array_agg(replace(p, 'NightList', 'NightOut') order by i) from unnest(perks) with ordinality as u(p, i))
 where array_to_string(perks, ' ') like '%NightList%';

update public.bar_promotions
   set description = replace(description, 'NightList', 'NightOut')
 where description like '%NightList%';

update public.notifications
   set title = replace(title, 'NightList', 'NightOut'),
       body  = replace(body, 'NightList', 'NightOut')
 where title like '%NightList%' or body like '%NightList%';
