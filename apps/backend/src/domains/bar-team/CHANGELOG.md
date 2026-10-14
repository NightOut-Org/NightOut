# bar-team — ประวัติการแก้ไข

## 2026-10-13 — Staff / PR ห้ามเห็นเงินของร้าน
- ใหม่ `is_bar_manager(bar)` (เจ้าของ/ผู้จัดการที่ตอบรับแล้ว) แทน `is_bar_member` ทุกจุดที่เป็นเงิน: RLS ของ `bar_payout_accounts` `bar_payouts` `bar_credit_ledger` `commission_rules` `invoices` `billing_events` `promoted_listing_payments` + rpc `bar_deposit_ledger` → Staff ได้แถวว่าง · `my_bar_detail.payout_account` เป็น null ให้ Staff (view security_invoker)
- การจองรายใบ (สถานะ Table Fee ของแต่ละการจอง) ทีมร้านทุกบทบาทยังเห็นตามเดิม
- migration `20261013000100_bar_team_money_rbac`

