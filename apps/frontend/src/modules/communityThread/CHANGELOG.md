# CHANGELOG — frontend · communityThread

## 2026-10-11 — ชุมชน: แนบรูป/วิดีโอในกระทู้และความเห็น
- แสดงรูป/วิดีโอ: กระทู้เป็นกริดตามดีไซน์ · ความเห็น/ตอบกลับเป็นภาพย่อ · กดดูเต็มจอเลื่อนดูทีละไฟล์ / เล่นวิดีโอ (`ui/components/communityMediaView.tsx`)
- ช่องตอบแนบรูป/วิดีโอได้: มือถือปุ่มรูป/วิดีโอหน้าช่องพิมพ์ · จอใหญ่ปุ่ม "รูปภาพ / วิดีโอ" ใต้ช่องพิมพ์ + บอกข้อจำกัด · ภาพย่อเหนือช่องพิมพ์ + ตัวนับ x/6 · มีไฟล์แล้วส่งได้โดยไม่ต้องพิมพ์ · ไฟล์อยู่ในร่างตอบด้วย
- ไฟล์: `components/replyComposer.tsx` · `components/commentList.tsx` · `page.tsx` · ของกลาง `ui/components/communityMediaPicker.tsx` · `services/api/storage.ts` (`uploadCommunityMedia`)

## 2026-10-10 — ชุมชน: ปักหมุดส่วนตัว + ฉบับร่างเก็บที่ backend

- หน้าใหม่ `/community/t/:id`: เนื้อหา · การ์ดร้านที่แท็ก (จองโต๊ะ/ดูร้าน) · ถูกใจ / บันทึก / ปักหมุด / แชร์ / รายงาน / แก้-ลบ (เจ้าของ) · ความเห็น + ตอบกลับ 1 ชั้น (เรียงล่าสุด/เก่าสุด) · กระทู้ที่เกี่ยวข้อง · นับยอดเข้าชม
- ช่องตอบ: มือถือติดขอบล่าง (route handle `hideBottomNav` ซ่อนเมนูล่าง) · **ร่างตอบบันทึกที่ backend** เมื่อหยุดพิมพ์ 1 วิ (กลับมาเติมให้ + "ใช้ร่างที่ค้างไว้ · เริ่มใหม่") · ยังไม่ล็อกอิน → modal login แล้วกลับหน้าเดิม
- ไฟล์: `page.tsx` · `api.ts` · `components/{commentList,replyComposer,reportModal}.tsx` · ของกลาง `hooks/useAutosaveDraft.ts` · `ui/components/draftStatus.tsx` · `layouts/main.tsx`
