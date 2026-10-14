# CHANGELOG — admin/modules/ranking

## 2026-10-13 — คะแนนรวมจริง + ปุ่มคำนวณใหม่
- อ่าน view `admin_ranking` แทน `admin_bars` (เอา `useRankedBars` ออก) · เรียงคะแนนรวมมากไปน้อย (ยังไม่คำนวณอยู่ท้าย)
- คอลัมน์: อันดับ · ร้าน · ประเภท (กรองได้) · ย่าน (กรองได้) · อันดับในประเภท / ย่าน · ดาว (ร้านใหม่ / ↑↓ เทียบรอบก่อน) · คะแนนรวม · รีวิว /50 · เช็กอิน /30 · โหวตสัปดาห์/เดือน · Safety /20 · ป้าย "โฆษณา · ไม่มีผลต่อคะแนน"
- ส่วนหัว: สูตร (รีวิว 50 · เช็กอิน 30 · Safety 20 · ไม่มีเช็กอิน = รีวิว + Safety คิดเต็ม 100 · คำนวณทุกคืน 00:05) + "คำนวณล่าสุด …" + ปุ่ม "คำนวณใหม่" (`recomputeRankingAction` → `POST ranking/recompute`) · ป้าย Audit Log `ranking.recompute`
- endpoint/migration: `POST /admin/ranking/recompute` · `20261013001030_catalog_ranking_scores`
- ไฟล์: `page.tsx`, `api.ts`

## 2026-10-09 — ย้าย API เข้า `api.ts` ของโมดูล (ADR 0007)
- เพิ่ม `api.ts`: `useRankedBars` — ชื่อ view / path / body ของหน้านี้ย้ายมาอยู่ที่เดียว (เดิมเขียนในหน้าผ่าน `useAdminView('admin_x', …)` / `act.mutate({ method, path, body })`) · body มี type จาก `@nightout/contracts`
- หน้า / form / modal ของโมดูลเรียกผ่าน `./api` · พฤติกรรมเดิม (query key, ข้อความแจ้งผล, invalidate `['admin']`)
