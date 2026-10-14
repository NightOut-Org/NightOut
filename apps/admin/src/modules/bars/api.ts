import type * as C from '@nightout/contracts';
import type { Db } from '@nightout/types';
import { Rest } from '@nightout/utils/rest';
import { useQuery } from '@tanstack/react-query';
import { backofficeKeys, useAdminView, type AdminActionInput } from '@/services/adminData';
import { fetchAdminView } from '@/services/api/backoffice';

/** API ของหน้าร้านทั้งหมด · backend: domains/backoffice (อ่าน) · domains/bar (bar.admin.controller.ts) */

/** GET /admin/views/admin_bars เรียงตามชื่อ */
export const useBars = () => useAdminView('admin_bars', { order: { column: 'name', ascending: true } });

/** GET /admin/views/admin_bar_blacklist?is_blacklisted=true — ร้านที่ติด Blacklist (ป้าย + ซ่อนสวิตช์แสดง · ปลดที่ /bar-blacklist) */
export const useBlacklistedBars = () =>
  useAdminView('admin_bar_blacklist', { filters: [['is_blacklisted', true]] });

/** PATCH /admin/bars/status — บันทึกการแสดง ↔ ระงับ ทุกร้านที่แก้ในหน้า ครั้งเดียว (ส่งให้ useAdminAction().mutate พร้อม success) */
export const barsStatusAction = (body: C.SetBarsStatusBody): AdminActionInput => ({ method: 'PATCH', path: 'bars/status', body });

/** GET /admin/views/admin_bar_details?id=… — ข้อมูลร้าน + เมนูของร้านเดียว (Drawer "แก้ข้อมูลร้าน") · id = null ไม่โหลด */
export const useBarDetails = (id: string | null) =>
  useQuery({
    queryKey: backofficeKeys.view('admin_bar_details', { id }),
    enabled: !!id,
    queryFn: () => fetchAdminView('admin_bar_details', { filters: [['id', id!]] }).then((r) => r[0] ?? null),
  });

/** GET /admin/master/districts — ย่านทั้งหมดไว้เลือกใน Drawer */
export const useDistricts = () =>
  useQuery({
    queryKey: ['admin', 'master', 'districts'],
    staleTime: 10 * 60_000,
    queryFn: () => Rest.get<Db.Tables<'districts'>[]>('/admin/master/districts', { params: { order: 'sort_order.asc' } }),
  });

/** GET /admin/views/admin_styles — สไตล์ร้านทั้งหมด (รวมที่ซ่อน) ไว้เลือกใน Drawer */
export const useStyleOptions = () => useAdminView('admin_styles', { order: { column: 'sort_order', ascending: true } });

/** PUT /admin/bars/:id/details — แก้ข้อมูลร้าน และ/หรือ เมนูและราคาแทนร้าน บันทึกครั้งเดียว (audit + แจ้งทีมร้าน) */
export const barDetailsAction = (barId: string, body: C.AdminBarDetailsBody): AdminActionInput => ({ method: 'PUT', path: `bars/${barId}/details`, body });
