# CHANGELOG — admin/modules/barLocations

## 2026-10-21 — เลิกใช้ " · " คั่นข้อความที่ผู้ใช้เห็น (ส่วนที่เหลือ)
- ข้อความในหน้า (หัวข้อ Drawer คำอธิบาย ป้าย ข้อความสำเร็จ) เปลี่ยนจากต่อด้วย " · " เป็นประโยค วงเล็บ หรือคำเชื่อม (และ / โดย / เมื่อ) · ชื่อ + จำนวนคน = "สมชาย (4 คน)" · ไม่เปลี่ยนพฤติกรรม
- ไฟล์: หน้าและคอมโพเนนต์ในโมดูลนี้ที่เคยมี " · " ในข้อความ

## 2026-10-13 — ตำแหน่งร้าน (หมุด) + แอดมินตรวจหมุด
- หน้าใหม่ `/bar-locations` "ตรวจตำแหน่งร้าน" (เมนูต่อจาก "รูปร้าน") แท็บ `?tab=`: **รอตรวจ (N)** (ที่อยู่ใหม่ · ระยะที่ย้ายหมุด + ป้าย "ย้ายไกล" เกิน 500 ม. · ผู้ส่ง · เวลา) · **ร้านทั้งหมด** (ที่อยู่ · รถไฟฟ้า · ที่จอดรถ · ตรวจหมุดล่าสุด / ยังไม่ปักหมุด / ยังไม่เคยตรวจ) · **ประวัติ** · ค้นหาชื่อร้าน · `?bar=<id>` เปิด Drawer ของร้านนั้น
- Drawer ตรวจ (`components/reviewDrawer.tsx`): แผนที่หมุดเดิม/หมุดใหม่ + ตารางเทียบ ตอนนี้ / ร้านขอ (`components/locationCompare.tsx`) → อนุมัติ · ปรับหมุดแล้วอนุมัติ · ตีกลับพร้อมเหตุผล
- Drawer แก้แทนร้าน (`components/editDrawer.tsx`): แก้หมุด/ที่อยู่/ที่จอดรถ/รถไฟฟ้า + ข้อความถึงร้าน · มีคำขอค้าง = เตือนว่าจะยกเลิกคำขอนั้น · ไม่แก้อะไรแต่ยังไม่เคยตรวจ = "ยืนยันหมุดเดิม" · Drawer ประวัติ (`components/historyDrawer.tsx`) ดู ก่อน / ร้านขอ / ใช้จริง
- mount เฉพาะ Drawer ที่เปิดอยู่ (React Router ใช้ `useBlocker` ได้ทีละตัว) · ออกจาก Drawer ตอนยังไม่บันทึก = ถามก่อน · ทุกการกระทำ audit + แจ้งทีมร้าน
- `api.ts`: `useBarLocations` (`admin_bar_locations`) · `useLocationHistory` (`admin_bar_location_requests`) · `reviewLocationAction` (`POST bar-location-requests/:id/review`) · `setBarLocationAction` (`PUT bars/:id/location`) · `searchPlace` / `reversePlace` (`GET /geocode/*`)
- ของกลางใหม่: `ui/components/PinMap.tsx` (Leaflet + OSM raster · เพิ่ม `leaflet` / `react-leaflet` / `@types/leaflet` ใน `apps/admin/package.json`) · `ui/components/BarLocationEditor.tsx` (ฟอร์มตำแหน่ง + `useLocationDirty`) · `ui/utils/location.ts` · ป้าย `AUDIT_ACTION` `bar.location.*` ใน `ui/utils/labels.ts` · `AdminViewRows` ใน `services/api/backoffice.ts` · route + เมนู
- ไฟล์หลัก: `page.tsx`, `api.ts`, `components/*` · migration `20261013000600_bar_location_pins`
