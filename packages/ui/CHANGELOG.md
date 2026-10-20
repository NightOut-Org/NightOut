# CHANGELOG — @nightout/ui

## 2026-10-16 — ThemeToggle ไม่ค้าง tooltip บนจอสัมผัส
- tooltip "เปลี่ยนเป็นโหมด…" แสดงเฉพาะอุปกรณ์ที่ hover ได้ (`(hover: hover) and (pointer: fine)`) — จอสัมผัสจำลอง hover ตอนแตะ ทำให้ tooltip ค้างหลังกด · `aria-label` ยังบอกชื่อปุ่ม · ไฟล์ `components/ThemeToggle.tsx`


## 2026-10-08 — ลบไอคอนการ์ดหมวดหน้าแรก
- ลบ `HOME_CATEGORY_ICONS` / `homeCategoryIcon` (ไม่มีที่ใช้แล้ว หลังเอาไอคอนหมวดออกจากหน้าแรกและ Backoffice)
- ไฟล์: `src/components/homeCategoryIcons.ts` (ลบ), `src/index.ts`
