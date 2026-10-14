import { useAdminView, type AdminActionInput } from '@/services/adminData';

/** API ของหน้าดาว / อันดับ · backend: domains/catalog (admin_ranking · POST /admin/ranking/recompute) */

/** GET /admin/views/admin_ranking — ร้านที่แสดงอยู่ + คะแนนรอบสัปดาห์ล่าสุด (แยกส่วน) + โหวตสัปดาห์/เดือน (หน้าเรียงเอง) */
export const useRanking = () => useAdminView('admin_ranking');

/** POST /admin/ranking/recompute — คำนวณดาว/อันดับของทุกร้านใหม่ทันที (เหมือน job ทุกคืน · audit) */
export const recomputeRankingAction = (): AdminActionInput => ({ method: 'POST', path: 'ranking/recompute' });
