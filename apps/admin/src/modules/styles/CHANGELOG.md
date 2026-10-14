# CHANGELOG — apps/admin/src/modules/styles

## 2026-10-13 — หน้าใหม่ — สไตล์ร้าน (`/styles`)
- เจ้าของตัดสิน 2026-10-13: Backoffice เพิ่ม / เปลี่ยนชื่อ / เปลี่ยนไอคอน / ซ่อน / เรียงลำดับสไตล์ร้านได้ (ลบไม่ได้ ใช้ซ่อน) · ประเภทร้าน/ประเภทโปรยังแก้ผ่าน migration
- `page.tsx`: ตาราง ลำดับ (ปุ่มขึ้น/ลง) · ไอคอน · ชื่อที่แสดง (ว่าง/ซ้ำ = ช่องแดง บันทึกไม่ได้) · ร้านที่ใช้ · ลูกค้าที่ชอบ · สวิตช์แสดง · ป้าย "ใหม่" / "ยังไม่บันทึก" · ปุ่ม "เพิ่มสไตล์" + SaveBar · `useUnsavedGuard` · เตือนเมื่อการ์ดหมวดหน้าแรกลิงก์ `/search?style=` ด้วยชื่อสไตล์ที่กำลังเปลี่ยนชื่อ/ซ่อน (→ `/home-content`)
- `utils/useStylesDraft.ts` (draft + add/rename/setIcon/toggle/move/reset · นับการแก้ · ตรวจชื่อว่าง/ซ้ำไม่สนตัวพิมพ์ · `body()`) · `utils/styleIcons.tsx` (ชื่อไอคอน `STYLE_ICONS` → Phosphor · ไม่รู้จัก = `Tag`)
- `api.ts`: `useStyles()` (view `admin_styles`) · `useHomeCategories()` (view `admin_home_categories`) · `saveStylesAction` (`PUT styles`) · route `styles` (`router/index.tsx`) + เมนู "สไตล์ร้าน" ต่อจาก "ดาว / อันดับ" (`configs/menu.tsx`) · ป้าย Audit Log `style.create` · `style.update`
- endpoint/migration: `PUT /admin/styles` · `20261013001020_catalog_styles_manage`
- ไฟล์: `page.tsx`, `api.ts`, `utils/useStylesDraft.ts`, `utils/styleIcons.tsx`
