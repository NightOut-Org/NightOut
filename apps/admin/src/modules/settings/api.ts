import type { AccountRoleOption, AdminMasterTable, SaveRoleColorsBody } from '@nightout/contracts';
import { Rest } from '@nightout/utils/rest';
import { useQuery } from '@tanstack/react-query';
import type { AdminActionInput } from '@/services/adminData';

/** API ของหน้าตั้งค่าระบบ · backend: domains/backoffice · domains/account (account.admin.controller.ts — สีชั้นบัญชี) */

/** GET /admin/roles — ทุกชั้นบัญชีพร้อมสี เรียงต่ำ → สูง */
export const useRoleColors = () =>
  useQuery({ queryKey: ['admin', 'roles'], staleTime: 10 * 60_000, queryFn: () => Rest.get<AccountRoleOption[]>('/admin/roles') });

/** PUT /admin/roles/colors (SUPER_ADMIN) — บันทึกสีเฉพาะชั้นที่เปลี่ยน */
export const saveRoleColorsAction = (body: SaveRoleColorsBody): AdminActionInput => ({ method: 'PUT', path: 'roles/colors', body });

/** GET /admin/master/:table — ตาราง master (styles, safety_features, platform_settings) เรียงจากน้อยไปมาก */
export const useMasterTable = <T,>(table: AdminMasterTable, orderBy: string) =>
  useQuery({ queryKey: ['admin', 'master', table], queryFn: () => Rest.get<T[]>(`/admin/master/${table}`, { params: { order: `${orderBy}.asc` } }) });
