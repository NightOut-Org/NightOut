# CHANGELOG — apps/admin/src/modules/barBlacklist

## 2026-10-13 — สร้างหน้า Blacklist ร้าน (ร้านไม่มีโต๊ะให้ลูกค้า)
- หน้าใหม่ `/bar-blacklist` (เมนู "Blacklist ร้าน" ต่อจาก "จัดการร้าน"): ตาราง Segmented มีประวัติไม่มีโต๊ะ / ติด Blacklist / ทั้งหมด + ค้นหาชื่อร้าน · จำนวนครั้งทั้งหมด / 90 วัน (≥ 2 ครั้งใน 90 วัน = ป้ายเตือน แสดงอย่างเดียว ไม่ Blacklist อัตโนมัติ)
- Drawer `?bar=<id>` (`components/strikeDrawer.tsx` · ลิงก์จากแจ้งเตือนแอดมินและป้ายในหน้า `/bars`): ประวัติไม่มีโต๊ะ (รหัสจอง · ที่มา ทีมร้าน / ข้อร้องเรียนลูกค้า · รายละเอียด · ผู้บันทึก) + ปุ่ม Blacklist / ปลด
- `modal/blacklistModal.tsx` เหตุผลบังคับ 3–500 ตัวอักษร (ร้านเห็น · ลง Audit Log) → `POST /admin/bars/:id/blacklist` · `/blacklist/lift` · `modal/reportNoTableModal.tsx` "บันทึกข้อร้องเรียน: ร้านไม่มีโต๊ะ" (รหัสจอง + รายละเอียด) → `POST /admin/bar-strikes` คืน Table Fee แทนร้าน (เข้า "รอคืนลูกค้า" ที่ `/deposits`) + บันทึกประวัติ — requirement "Dispute & Refund Management"
- อ่าน view `admin_bar_blacklist` (`api.ts`) · route ใน `router/index.tsx` · เมนู `configs/menu.tsx` · ป้าย Audit Log `bar.blacklist` / `bar.unblacklist` / `bar.strike.no_table` (`ui/utils/labels.ts`)
- ไฟล์: `page.tsx`, `api.ts`, `components/strikeDrawer.tsx`, `modal/blacklistModal.tsx`, `modal/reportNoTableModal.tsx`
