## 2026-10-12 — Drawer รูปร้านแก้ก่อน แล้วกดบันทึกครั้งเดียว
- เพิ่ม/เอาออก/ตั้งปกแกลเลอรี และเพิ่ม/เปลี่ยน/ลบรูปเมนู แก้แค่ใน Drawer (พรีวิวจากเครื่อง · ป้าย "ใหม่ · ยังไม่บันทึก" / "จะลบรูป") แล้วกด "บันทึก" ที่หัว Drawer ครั้งเดียว
- กดบันทึก = อัปโหลดรูปใหม่ (แสดง "กำลังอัปโหลด n/N") แล้วบันทึกทั้งหมดในคำขอเดียว · แจ้งทีมร้าน 1 ครั้ง · ระหว่างบันทึกทั้ง Drawer disabled และปิดไม่ได้ · พลาด = การแก้ยังอยู่ และลบไฟล์ที่เพิ่งอัปโหลดทิ้ง (`POST /admin/bars/:id/media/discard`) · ปิด Drawer / ออกจากหน้าตอนยังไม่บันทึก = ถามก่อน
- endpoint `PUT /admin/bars/:id/media` เปลี่ยน body เป็น `{ gallery?, menu_images? }` (`admin_save_bar_media` · migration `20261012000100_bar_save_page_batch`) · เลิกใช้ `PUT /admin/menu-items/:id/image`
- ไฟล์: `components/barMediaDrawer.tsx` · `utils/useBarMediaDraft.ts` (ใหม่) · `api.ts` · `page.tsx` (ส่ง `onSaved={refetch}`)

## 2026-10-09 — สร้างหน้ารูปร้าน (`/bar-media`)
- ตารางทุกร้าน: รูปปก · จำนวนรูปแกลเลอรี/รูปเมนู · กรอง ทั้งหมด / ยังไม่มีปก / มีรูปแล้ว · ค้นหาชื่อร้าน
- Drawer ของร้าน (`?bar=<id>` ลิงก์ตรงได้): ปก + แกลเลอรี (อัปโหลดแทนร้าน · ตั้งเป็นปก · ลบรูปไม่เหมาะสม) และรูปเมนูทีละรายการ (เพิ่ม/เปลี่ยน/ลบ) · ลิงก์ "ดูหน้าร้าน" · ทุกการกระทำลง audit log และแจ้งทีมร้าน · Admin กับ Super Admin สิทธิ์เท่ากัน
- endpoint: `PUT /admin/bars/:id/media` (`admin_set_bar_media`) · `PUT /admin/menu-items/:id/image` (`admin_set_menu_item_image`) · อ่าน view `admin_bar_media` (migration `20261009000100_bar_media_images`)
- ไฟล์: `page.tsx` · `components/barMediaDrawer.tsx` · `api.ts` · `utils/media.ts` · route ใน `router/index.tsx` + เมนู `configs/menu.tsx` · `AdminViewRows` ใน `services/api/backoffice.ts`

