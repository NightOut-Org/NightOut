import type { RoleInfo } from '@nightout/contracts';
import { Rest } from '@nightout/utils/rest';

/** GET /me/roles — ทุกชั้นบัญชีพร้อมชื่อและสี · ใช้ทุกหน้าผ่าน hooks/useRoles (navbar + /profile) */
export const fetchRoles = () => Rest.get<RoleInfo[]>('/me/roles');
