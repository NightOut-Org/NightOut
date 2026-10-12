import type * as C from '@nightout/contracts';
import { useAdminView, type AdminActionInput } from '@/services/adminData';

/** API ของหน้าทีมงาน NightOut · backend: domains/backoffice (อ่าน) · domains/site-team (site-team.admin.controller.ts) */

export const useTeamMembers = () => useAdminView('admin_team_members', { order: { column: 'sort_order', ascending: true } });

/** POST /admin/team-members (Super Admin) */
export const createTeamMemberAction = (body: C.TeamMemberBody): AdminActionInput => ({ method: 'POST', path: 'team-members', body });

/** PATCH /admin/team-members/:id — Drawer แก้ข้อมูลรายคน */
export const updateTeamMemberAction = (memberId: string, body: C.UpdateTeamMemberBody): AdminActionInput => ({
  method: 'PATCH',
  path: `team-members/${memberId}`,
  body,
});

/** DELETE /admin/team-members/:id (Super Admin) */
export const deleteTeamMemberAction = (memberId: string): AdminActionInput => ({ method: 'DELETE', path: `team-members/${memberId}` });

/** PATCH /admin/team-members — บันทึกลำดับ (Super Admin) + แสดงบนเว็บหลายแถว ครั้งเดียว */
export const saveTeamPageAction = (body: C.SaveTeamPageBody): AdminActionInput => ({ method: 'PATCH', path: 'team-members', body });
