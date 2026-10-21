import type { AppNotification, Bar, Booking, DemoUser, PromotionOrder, Review } from './models';

/**
 * cache ในหน่วยความจำของหน้าเว็บ — sync.ts เติมจาก NestJS API (/public/catalog, /me/overview) แล้วหน้าอ่านผ่าน selectors.ts
 * ไม่เก็บลง localStorage (ข้อมูลจริงอยู่ใน DB) · ไม่มีข้อมูลตั้งต้นปลอม
 */
export interface CacheState {
  bars: Bar[];
  reviews: Review[];
  bookings: Booking[];
  notifications: AppNotification[];
  users: DemoUser[];
  favorites: Record<string, string[]>;
  promotions: PromotionOrder[];
}

type Listener = () => void;

const SESSION_KEY = 'nightout-demo-session';
/** key ของข้อมูลเดโมรุ่นเก่า (ล้างทิ้งครั้งเดียวจากเครื่องผู้ใช้) */
const LEGACY_KEY = 'nightout-demo-v1';

const emptyState = (): CacheState => ({
  bars: [],
  reviews: [],
  bookings: [],
  notifications: [],
  users: [],
  favorites: {},
  promotions: [],
});

const state: CacheState = emptyState();
let version = 0;
const listeners = new Set<Listener>();
const memory = new Map<string, string>();

function storage(kind: 'local' | 'session' = 'local') {
  try {
    if (kind === 'local' && typeof localStorage !== 'undefined') return localStorage;
    if (kind === 'session' && typeof sessionStorage !== 'undefined') return sessionStorage;
  } catch {
    /* blocked */
  }
  return {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => void memory.set(k, v),
    removeItem: (k: string) => void memory.delete(k),
  };
}

try {
  storage().removeItem(LEGACY_KEY);
} catch {
  /* ignore */
}

/** อ่าน cache ปัจจุบัน (อย่าแก้ตรง — ใช้ mutate) */
export function getState(): CacheState {
  return state;
}

/** แก้ cache แล้วแจ้ง subscriber */
export function mutate<T>(fn: (s: CacheState) => T): T {
  const result = fn(state);
  version++;
  listeners.forEach((l) => l());
  return result;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** ใช้กับ useSyncExternalStore */
export function getVersion(): number {
  return version;
}

export function getSessionUserId(): string | null {
  return storage('session').getItem(SESSION_KEY) ?? storage().getItem(SESSION_KEY);
}

/** remember = false → เก็บแค่ใน tab นี้ (sessionStorage) ปิดเบราว์เซอร์แล้วหลุด */
export function setSessionUserId(id: string | null, remember = true): void {
  storage().removeItem(SESSION_KEY);
  storage('session').removeItem(SESSION_KEY);
  if (id) storage(remember ? 'local' : 'session').setItem(SESSION_KEY, id);
  version++;
  listeners.forEach((l) => l());
}
