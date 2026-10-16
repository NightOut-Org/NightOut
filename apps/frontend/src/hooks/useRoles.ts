import type { RoleInfo } from '@nightout/contracts';
import type { UserRole } from '@nightout/types';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { ROLE_DEFAULT_COLORS, ROLE_META, roleTone, type RoleTone } from '@/configs/roles';
import { fetchRoles } from '@/services/api/roles';

const CACHE_KEY = 'nightout-roles';

const isRoleRows = (v: unknown): v is RoleInfo[] =>
  Array.isArray(v) &&
  v.length > 0 &&
  v.every((r) => typeof r === 'object' && r !== null && (r as RoleInfo).code in ROLE_META && typeof (r as RoleInfo).color === 'string');

/** ชุดล่าสุดที่เคยโหลด — เปิดเว็บครั้งถัดไปเห็นสีที่แอดมินตั้งทันที ไม่กระพริบจากสีตั้งต้น */
function readCache(): RoleInfo[] | undefined {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const v: unknown = raw ? JSON.parse(raw) : undefined;
    return isRoleRows(v) ? v : undefined;
  } catch {
    return undefined;
  }
}

/**
 * ชื่อและสีของชั้นบัญชีจาก DB (Super Admin แก้สีที่ Backoffice /settings) — ใช้เฉพาะตอนล็อกอินแล้ว
 * ยังไม่มา / โหลดไม่ได้ = ชุดล่าสุดใน localStorage หรือสีตั้งต้นในโค้ด
 */
export function useRoles() {
  const q = useQuery({
    queryKey: ['account', 'roles'],
    queryFn: fetchRoles,
    staleTime: 10 * 60_000,
    placeholderData: readCache,
  });

  useEffect(() => {
    if (q.isPlaceholderData || !isRoleRows(q.data)) return;
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(q.data));
    } catch {
      /* เต็ม/ถูกปิด — ไม่เป็นไร */
    }
  }, [q.data, q.isPlaceholderData]);

  const rows = isRoleRows(q.data) ? q.data : undefined;
  const tone = useCallback(
    (code: UserRole): RoleTone => roleTone(rows?.find((r) => r.code === code)?.color ?? ROLE_DEFAULT_COLORS[code]),
    [rows],
  );
  const label = useCallback((code: UserRole) => rows?.find((r) => r.code === code)?.label_th || ROLE_META[code].label, [rows]);
  return { tone, label };
}
