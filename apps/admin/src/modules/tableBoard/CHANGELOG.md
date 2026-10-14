# CHANGELOG — admin/modules/tableBoard

## 2026-10-13 — ผังโต๊ะร้าน /table-board (ดูอย่างเดียว)
- หน้าใหม่ `/table-board` "ผังโต๊ะร้าน" (ดูอย่างเดียว · เจ้าของอนุมัติ 2026-10-13): เลือกร้าน (`?bar=<id>` · รายชื่อจาก view `admin_bars`) → ผังโต๊ะ / ไทม์ไลน์คืนนี้ ข้อมูลชุดเดียวกับ `/merchant/floor` · โพลทุก 10 วิ · Drawer รายละเอียดโต๊ะ · ไม่มีปุ่มแก้ (ย้ายโต๊ะ / เช็กอิน / ตั้งกำลังใช้ เป็นงานของร้าน)
- endpoint `GET admin/bars/:barId/table-board` (rpc `bar_table_board` ผ่าน `is_admin()`) · เมนู "ผังโต๊ะร้าน" ต่อจาก "การจอง" (`configs/menu.tsx`) · route `router/index.tsx`
- ไฟล์: `page.tsx`, `api.ts`, `components/{boardGrid,boardTimeline,tableDrawer}.tsx`, `utils/board.ts`
