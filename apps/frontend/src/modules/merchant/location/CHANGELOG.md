# CHANGELOG — frontend/modules/merchant/location

## 2026-10-13 — ตำแหน่งร้าน (หมุด) + แอดมินตรวจหมุด
- หน้าใหม่ `/merchant/location` "ตำแหน่งร้าน": แผนที่ปักหมุด (แตะแผนที่ · ลากหมุด · ค้นหาที่อยู่เมื่อกดค้นหา · วางพิกัด/ลิงก์ Google Maps · ตำแหน่งของฉัน) + หมุดเดิมสีเทาให้เทียบ + ระยะที่ย้าย · ช่องที่อยู่ (ปุ่ม "ใช้ที่อยู่จากหมุด") ที่จอดรถ รถไฟฟ้าใกล้สุด
- ร้านที่แสดงอยู่ → "ส่งให้ทีมตรวจ" (ระหว่างรอ ลูกค้าเห็นหมุดเดิม) · ร้านที่ยังไม่แสดง → "บันทึกตำแหน่ง" (ตรวจพร้อมการอนุมัติร้าน) · ป้ายสถานะ 1 อัน (ยังไม่ปักหมุดจริง / ร้านยังไม่เปิดแสดง / รอตรวจ + ยกเลิกคำขอ / ตีกลับพร้อมเหตุผล / ผ่านแล้ว / ทีม NightOut ปรับหรือตั้งให้) · แก้ค่ากลับเป็นหมุดที่ลูกค้าเห็นระหว่างรอตรวจ = เสนอยกเลิกคำขอแทนการส่ง
- ทีมร้านทุกบทบาทเปิดได้ (route อยู่นอก `RequireBarRole`) · Staff ดูอย่างเดียว (แผนที่/ช่อง disabled ไม่มีปุ่ม) · ออกจากหน้าตอนยังไม่บันทึก = ถามก่อน
- `api.ts`: `saveLocation` (`PUT /merchant/bars/:barId/location`) · `cancelLocationRequest` (`DELETE …/location-request`) · `searchPlace` (`GET /geocode/search`) · `reversePlace` (`GET /geocode/reverse`)
- ของกลางใหม่: `ui/components/locationPicker.tsx` · `ui/components/barLocationFields.tsx` · `ui/utils/barLocation.ts` · `services/barsRepo.ts` (map `parking_note` / `transit_*` / `location_request`) · route ใน `router/index.tsx` · เมนู "ตำแหน่งร้าน" ใน `layouts/merchant.tsx` (กลุ่ม "ร้าน" · Staff เป็นปุ่มบนแถบ desktop)
- ไฟล์หลัก: `page.tsx`, `api.ts` · migration `20261013000600_bar_location_pins`
