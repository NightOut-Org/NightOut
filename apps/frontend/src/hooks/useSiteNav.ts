import type { SiteNavItem } from '@nightout/contracts';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { DEFAULT_SITE_NAV, NAV_LINKS, toNavItems } from '@/configs/nav';
import { fetchSiteNav } from '@/services/api/siteNav';

const CACHE_KEY = 'nightout-site-nav';

const isNavRows = (v: unknown): v is SiteNavItem[] =>
  Array.isArray(v) && v.length > 0 && v.every((r) => typeof r === 'object' && r !== null && (r as SiteNavItem).key in NAV_LINKS);

/** เมนูชุดล่าสุดที่เคยโหลด — เปิดเว็บครั้งถัดไปเห็นลำดับที่แอดมินตั้งทันที ไม่กระพริบจากค่าตั้งต้น */
function readCache(): SiteNavItem[] | undefined {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const v: unknown = raw ? JSON.parse(raw) : undefined;
    return isNavRows(v) ? v : undefined;
  } catch {
    return undefined;
  }
}

/**
 * เมนู navbar (desktop) + แถบเมนูล่าง (มือถือ) ตามที่แอดมินจัดที่ Backoffice /home-content
 * ยังไม่มา / โหลดไม่ได้ = เมนูชุดล่าสุดใน localStorage หรือค่าตั้งต้นในโค้ด (navbar ไม่ว่าง)
 */
export function useSiteNav() {
  const q = useQuery({
    queryKey: ['site-content', 'nav'],
    queryFn: fetchSiteNav,
    staleTime: 5 * 60_000,
    placeholderData: readCache,
  });

  useEffect(() => {
    if (q.isPlaceholderData || !isNavRows(q.data)) return;
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(q.data));
    } catch {
      /* เต็ม/ถูกปิด — ไม่เป็นไร */
    }
  }, [q.data, q.isPlaceholderData]);

  const rows = isNavRows(q.data) ? q.data : DEFAULT_SITE_NAV;
  return useMemo(() => ({ desktop: toNavItems(rows, 'desktop'), mobile: toNavItems(rows, 'mobile') }), [rows]);
}
