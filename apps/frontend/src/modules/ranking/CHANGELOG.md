# CHANGELOG — apps/frontend/src/modules/ranking

## 2026-10-13 — อันดับจากข้อมูลจริง (`GET /public/ranking`)
- ใหม่ `api.ts`: `useRanking(period, category?)` → `GET /public/ranking` (key `['catalog', 'ranking', …]` · แคช 5 นาที) แทน mock `rankingByPeriod()`
- `page.tsx`: URL `?period=WEEK|MONTH` เดิม (แปลงเป็น WEEKLY/MONTHLY) · กำลังโหลด = Spin · โหลดไม่สำเร็จ = Result + ปุ่มลองใหม่ · ทุกร้านโหวต 0 = บอก "ยังไม่มีโหวตในรอบนี้ — เรียงตามคะแนนรวม" · ข้อความท้ายหน้าอธิบายรอบ/อัปเดตทุกคืน/โหวต/ร้านรีวิวน้อยกว่า 5/โฆษณาไม่มีผล
- ของกลางที่ใช้: ใหม่ `ui/utils/ranking.ts` `toRankedBars()` (แถวอันดับ → ร้านใน store ของ catalog · ข้ามร้านที่ไม่อยู่ใน store แล้วนับอันดับใหม่ · ดาว/Tier จากรอบนั้น) · `services/data.ts` เอา `rankingByPeriod` ออก (คง type `RankedBar` / `RankingPeriod`)
- ไฟล์: `api.ts`, `page.tsx`
