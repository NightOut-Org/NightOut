import { getVersion, subscribe } from '@/services/cache';
import { useSyncExternalStore } from 'react';

/**
 * Re-render เมื่อ cache (services/cache.ts) เปลี่ยน แล้วเรียก selectors ตรงๆ ใน render
 * (ตอนต่อ Supabase / NestJS จริง ให้เปลี่ยนเป็น TanStack Query ทีละหน้า)
 */
export function useDemo(): number {
  return useSyncExternalStore(subscribe, getVersion, getVersion);
}
