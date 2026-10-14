# CHANGELOG — admin/modules/miniAds

## 2026-10-13 — Native Mini-Ads (โฆษณาแบนเนอร์เล็ก)
- หน้าใหม่ `/mini-ads` เมนู "โฆษณา (Mini-Ads)" — แอดมินทุกคน (MFA) เพิ่ม/แก้/ลบ · ตาราง: ภาพ · ตำแหน่ง · ช่วงวันที่ · สถานะ (กำลังแสดง/รอเริ่ม/ปิดอยู่/หมดเวลา) · เห็น/คลิก/CTR · สวิตช์เปิดใช้งาน
- Drawer: ภาพ 16:9 (อัปโหลดตอนบันทึก เข้า `site-media/ads/<uuid>` · นามสกุลตามชนิดไฟล์จริง) + ตัวอย่างการ์ด · ผู้ลงโฆษณา · หัวข้อ · คำอธิบาย · ปุ่ม · ลิงก์ · ตำแหน่ง · ช่วงวันที่ · บันทึกภายใน · ติ๊กยืนยันไม่ใช่แบรนด์/สินค้าแอลกอฮอล์ (บังคับตอนสร้างและแก้เนื้อหา) · ส่งเฉพาะ field ที่แก้
- พิมพ์คำแอลกอฮอล์/ชวนดื่ม → Alert สีเหลืองเตือน (`alcoholWordsIn` · คอมเมนต์ #87) แต่ยังบันทึกได้
- ไฟล์: `page.tsx` · `api.ts` (`useMiniAds` = view `admin_mini_ads` · `createMiniAdAction` / `updateMiniAdAction` / `deleteMiniAdAction`) · `form/miniAdDrawer.tsx` · `components/miniAdPreview.tsx` · `utils/{media,dates,labels}.ts` · `router/index.tsx` · `configs/menu.tsx` · `services/api/backoffice.ts`
