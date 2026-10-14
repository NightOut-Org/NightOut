## 2026-10-13 — ป้ายดีลวันนี้บนการ์ดร้าน
- การ์ดร้าน (`ui/components/barCard.tsx` · ใช้ใน /search และ /favorites) แสดงป้าย "ดีลวันนี้ · <ชื่อโปร>" (+N ถ้ามีหลายโปร) บรรทัดเดียว ตัดคำเมื่อยาว · การ์ดใส่ `min-w-0` กันชื่อโปรยาวดันหน้าล้นจอ 375px
- ไฟล์: `ui/components/barCard.tsx`, `ui/components/dealBadge.tsx` (ใหม่)

## 2026-10-13 — Native Mini-Ads (โฆษณาแบนเนอร์เล็ก)
- ช่องโฆษณาแบนเนอร์เล็ก 1 ชิ้น เต็มแถวหลังร้านลำดับที่ 6 (ผลน้อยกว่า 6 = หลังร้านสุดท้าย) เฉพาะมุมมองรายการ · ไม่แสดงในแผนที่/ตอนไม่พบร้าน · ลำดับ จำนวน "พบ N ร้าน" และตัวกรองเหมือนเดิม
- เปลี่ยน query string ขณะอยู่หน้านี้ (เช่นคลิกโฆษณาที่ลิงก์ `/search?style=…`) = เริ่มตัวกรองใหม่จาก URL (`SearchPage` remount `SearchView` ด้วย `key`)
- ไฟล์: `page.tsx`

## 2026-10-13 — อ่านงบต่อหัว + จำนวนคนจาก Hero
- อ่าน `?q=&district=&budget=&people=` ด้วย `parseBudgetSearch` เป็นตัวกรองเริ่มต้น (ลิงก์เดิม `?q=&district=` / `?category=` / `?style=` ยังใช้ได้) · slider งบใช้ `SEARCH_BUDGET_MIN` / `SEARCH_BUDGET_MAX` / `SEARCH_BUDGET_STEP`
- ตัวกรองใหม่ "จำนวนคน" (1–12) → เฉพาะร้านที่มีโซนจุได้ทั้งกลุ่ม · หัวหน้าบอกงบรวมของกลุ่ม · ไม่พบผลบอกให้ลดจำนวนคน/เพิ่มงบ · ตั้งงบแล้วร้านที่ไม่มีข้อมูลราคาไม่แสดง (`packages/mock` `listBars`)
- ไฟล์: `page.tsx`

## 2026-10-08 — แผนที่ responsive และ fullscreen

- ใช้ความสูงตาม viewport ปัจจุบัน และเปิด map ใน Modal หลัง animation จบ โดยมี map ทำงานเพียงตัวเดียว
- Shared map layer ตรวจขนาด container, resize WebGL และใช้ raster สำรองเมื่อโหลดเกินเวลา/เกิด runtime error พร้อมแจ้งเมื่อ raster โหลดไม่ได้
- ไฟล์หลัก: `page.tsx`, `ui/components/barMap.tsx`, `ui/components/mapBaseLayer.tsx`, `ui/utils/mapStyle.ts`, `ui/utils/mapTiles.ts`
