-- =====================================================================
-- NightOut · site-content — เอาการแก้หน้าแรกจาก Backoffice ออก (เจ้าของตัดสิน 2026-10-15)
--   หน้า /home-content เหลือแค่เมนู navbar (…20261015000300) จึงไม่มีใครเรียกฟังก์ชันเขียนหน้าแรกแล้ว
--   - drop admin_save_home_page / admin_save_home_content / admin_save_home_category / admin_save_home_popular + ตัวตรวจค่า
--   - drop view admin_home_content / admin_home_popular (ไม่มีหน้าอ่าน)
--   เก็บไว้: ตาราง home_content / home_categories / home_popular_bars + view public_home_* (หน้าแรกยังอ่าน GET /public/home)
--            view admin_home_categories (หน้า /styles ใช้เตือนลิงก์การ์ดหมวด)
-- =====================================================================
drop function if exists public.admin_save_home_page(uuid, jsonb, jsonb, uuid[]);
drop function if exists public.admin_save_home_content(uuid, jsonb);
drop function if exists public.admin_save_home_category(uuid, text, jsonb);
drop function if exists public.admin_save_home_popular(uuid, uuid[]);
drop function if exists public.home_content_check(public.home_content);
drop function if exists public.home_category_check(public.home_categories);
drop function if exists public.home_image_ok(text);

drop view if exists public.admin_home_content;
drop view if exists public.admin_home_popular;
