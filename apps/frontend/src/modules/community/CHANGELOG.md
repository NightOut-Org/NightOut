# CHANGELOG — frontend · community

## 2026-10-10 — ชุมชน: ปักหมุดส่วนตัว + ฉบับร่างเก็บที่ backend
- หน้าใหม่ `/community` · `/community/c/:category` ตามดีไซน์ Claude Design "Community" (มือถือ: chip หมวด + ปุ่มลอย "ตั้งกระทู้" · จอใหญ่: หมวดซ้ายพร้อมจำนวน + ร้านที่ถูกพูดถึงสัปดาห์นี้/กติกาขวา)
- แท็บ ล่าสุด / ยอดนิยม / ยังไม่มีคำตอบ (`?sort=`) · ค้นหา (`?q=`) · โหลดเพิ่มทีละ 20
- **ปักหมุดส่วนตัว:** ปุ่มหมุดในทุกแถว (ล็อกอินแล้ว) · กระทู้ที่ปักขึ้นบนสุดพร้อมป้าย "ปักหมุด" · เกิน 3 แจ้งข้อความจาก API
- ปุ่ม "ตั้งกระทู้" มีจุดเมื่อมีร่างตั้งกระทู้ค้างอยู่ (`GET /me/community/drafts`)
- ไฟล์: `page.tsx` · `api.ts` · `components/feedAside.tsx` · ของกลาง `ui/components/communityThreadRow.tsx` · `communityAvatar.tsx` · `ui/utils/community.ts` · เมนู `configs/nav.ts`
