-- =====================================================================
-- NightOut · booking — ตั้งตัวรัน job ด้วย pg_cron ใน DB โดยตรง (2026-10-14)
--   เดิม: หัวไฟล์ …20261002001400 / …20261013001030 ให้ตั้ง pg_cron → pg_net → NestJS /api/jobs/* เอง (ยังไม่เคยตั้ง)
--         ระหว่างนั้น backend ของเครื่อง dev ทุกเครื่องที่ต่อ DB จริงยิง rpc run_booking_timeouts ทุกนาทีซ้ำกัน
--         → API log เต็มโควตา และบนเว็บจริงไม่มีตัวรัน job ถ้าไม่มีใครเปิด dev
--   ใหม่: pg_cron เรียกฟังก์ชันใน DB ตรง (ไม่ผ่าน HTTP · ไม่ต้องมี api_url / job_secret ใน Vault · ไม่เกิด API log)
--     nightout-booking-timeouts  ทุก 1 นาที     → run_booking_timeouts() (หมดเวลา · เตือน 15 / 5 นาที · ปลดโต๊ะ · ปิดโต๊ะ)
--     nightout-tier              00:05 เวลาไทย  → run_tier_scores() (คะแนน / ดาว / อันดับ)
--     nightout-job-cleanup       02:15 เวลาไทย  → ล้าง cron.job_run_details > 3 วัน + job_runs ที่ไม่ได้ทำอะไรและไม่ error > 7 วัน
--   แจ้งเตือนเขียนตรงจากฟังก์ชัน (app_notify) จึงไม่ต้องผ่าน NestJS · endpoint /api/jobs/* ยังอยู่ไว้เรียกมือ
--   เครื่อง dev: LocalJobsScheduler ปิดเป็นค่าเริ่มต้นแล้ว (JOBS_LOCAL_INTERVAL_MS = 0) — เปิดเองเฉพาะ DB ในเครื่องที่ไม่มี pg_cron
--   cron.schedule ชื่อเดิม = แทนของเดิม (รันซ้ำได้)
-- =====================================================================

select cron.schedule('nightout-booking-timeouts', '* * * * *', $$ select public.run_booking_timeouts() $$);

select cron.schedule('nightout-tier', '5 17 * * *', $$ select public.run_tier_scores() $$);  -- 00:05 เวลาไทย

select cron.schedule('nightout-job-cleanup', '15 19 * * *', $$
  delete from cron.job_run_details where end_time < now() - interval '3 days';
  delete from public.job_runs where processed = 0 and error is null and started_at < now() - interval '7 days';
$$);  -- 02:15 เวลาไทย
