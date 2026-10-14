# CHANGELOG — backend · mini-ads

## 2026-10-13 — Native Mini-Ads (โฆษณาแบนเนอร์เล็ก)
- โดเมนใหม่ `mini-ads`: แบนเนอร์เล็กที่ทีม NightOut ลงเอง แสดงหน้าแรก/หน้าค้นหา · ไม่มีผลต่ออันดับหรือผลค้นหาร้าน
- migration `20261013001300_mini_ads_banners.sql`: ตาราง `mini_ads` · `mini_ad_daily_stats` (เห็น/คลิกรวมรายวันต่อตำแหน่ง ไม่เก็บข้อมูลผู้ใช้) · view `admin_mini_ads` · rpc `mini_ads_live` (anon อ่านได้เฉพาะที่กำลังแสดง ไม่มีบันทึกภายใน) · `mini_ad_track` · `admin_save_mini_ad` (สร้าง/แก้เนื้อหาต้องยืนยันไม่ใช่แบรนด์แอลกอฮอล์ → `no_alcohol_confirmed_at/by` · audit `mini_ad.create|update`) · `admin_delete_mini_ad` (audit `mini_ad.delete` พร้อมยอดรวม) · `mini_ad_check` · `mini_ad_is_live` · `mini_ad_unused_image_paths` · anon/ลูกค้าอ่านตารางตรงไม่ได้
- endpoint ใหม่: `GET /public/mini-ads?placement=` (สุ่มลำดับ ≤ 10) · `POST /public/mini-ads/:id/track` (ไม่ต้องล็อกอิน · 60 ครั้ง/นาที/IP) · `POST /admin/mini-ads` · `PATCH /admin/mini-ads/:id` · `DELETE /admin/mini-ads/:id` (แอดมินทุกคน + MFA)
- ภาพอยู่ bucket `site-media/ads/` · เปลี่ยนภาพ/ลบโฆษณา → `MiniAdsService` ลบไฟล์ที่ไม่มีโฆษณาไหนใช้แล้ว (`removed_paths`)
- ไฟล์: `mini-ads.module.ts` · `mini-ads.public.controller.ts` · `mini-ads.admin.controller.ts` · `mini-ads.service.ts` · `mini-ads.dto.ts` · เทสต์ `mini-ads.test.ts` + `test/app.test.ts` · `app.module.ts`
