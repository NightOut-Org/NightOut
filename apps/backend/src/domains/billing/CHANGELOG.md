# billing — ประวัติการแก้ไข

## 2026-10-13 — ค่าคอมเฉพาะเจ้าของ/ผู้จัดการ · หน้าปิดไว้จนถึง Phase 2
- RLS `billing_events` / `invoices` / `commission_rules` ของทีมร้าน → `is_bar_manager` · ฝั่งแอดมิน (`admin_read` + view `admin_billing_events`) → `is_super_admin()`
- หน้า `/merchant/billing` และ Backoffice `/billing` เอา route/เมนูออก (Phase 2) — endpoint `GET /merchant/bars/:barId/billing-events` ยังอยู่
- migration `20261013000100_bar_team_money_rbac` · `20261013000200_backoffice_super_admin_reads`

