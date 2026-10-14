import { beforeEach, describe, expect, it } from 'vitest';
import {
  addReview,
  barLedger,
  getBooking,
  settleDeposit,
  checkInByCode,
  createBooking,
  demoLoginAs,
  getBar,
  listBars,
  promptPayPayload,
  resetDemo,
  reviewDeposit,
  submitDeposit,
  tierList,
  transition,
  verifySafety,
} from './index';
import { getState, mutate } from './index';

beforeEach(() => resetDemo());

describe('demo data', () => {
  it('has 15 approved fictional bars with tiers', () => {
    expect(listBars()).toHaveLength(15);
    const tiers = tierList();
    expect(tiers.S.length + tiers.A.length + tiers.B.length + tiers.C.length).toBe(14); // 1 ร้านใหม่
  });

  it('full booking flow: deposit → confirm → check-in → review', () => {
    demoLoginAs('customer');
    const bar = getBar('bar-1')!;
    const date = new Date(Date.now() + 2 * 86_400_000).toISOString();
    const b = createBooking({
      barId: bar.id,
      zoneId: bar.zones[1]!.id,
      datetime: date,
      pax: 4,
    });
    expect(b.status).toBe('AWAITING_DEPOSIT');
    submitDeposit(b.id, 'data:image/png;base64,xx');
    // แอดมินแพลตฟอร์มตรวจสลิป → เงินถูกถือไว้ที่แพลตฟอร์ม
    reviewDeposit(b.id, true, 'admin');
    expect(getBooking(b.id)!.deposit?.settlement).toBe('HELD');
    const checked = checkInByCode(bar.id, b.code, 'staff');
    expect(checked.status).toBe('CHECKED_IN');
    // เช็กอินแล้ว → มัดจำเป็นของร้าน รอโอน → แอดมินโอน/เก็บเครดิต
    expect(getBooking(b.id)!.deposit?.settlement).toBe('PAYOUT_PENDING');
    settleDeposit(b.id, 'CREDIT', 'admin');
    expect(barLedger(bar.id).credit).toBeGreaterThanOrEqual(500);
    transition(b.id, 'COMPLETED', 'STAFF', 'staff');
    expect(addReview(b.id, 5, 'ดีมาก').rating).toBe(5);
    expect(() => addReview(b.id, 4, 'ซ้ำ')).toThrow();
  });

  it('builds a PromptPay payload with CRC', () => {
    const p = promptPayPayload('0812345678', 500);
    expect(p.startsWith('000201')).toBe(true);
    expect(p).toMatch(/6304[0-9A-F]{4}$/);
    expect(p).toContain('5406500.00');
  });
});

describe('listBars — budget search (Hero ?budget=&people=)', () => {
  const biggestZone = (barId: string) => Math.max(0, ...getBar(barId)!.zones.map((z) => z.capacityPax));

  it('people: only bars with a zone that seats the whole group', () => {
    const all = listBars();
    expect(listBars({ people: 999 })).toHaveLength(0);
    expect(listBars({ people: 1 })).toHaveLength(all.length);
    const bar = all[0]!;
    const max = biggestZone(bar.id);
    expect(listBars({ people: max }).some((b) => b.id === bar.id)).toBe(true);
    expect(listBars({ people: max + 1 }).some((b) => b.id === bar.id)).toBe(false);
  });

  it('a bar without price data is hidden once a budget is set', () => {
    const id = getState().bars.find((b) => b.status === 'APPROVED')!.id;
    mutate((s) => {
      s.bars.find((b) => b.id === id)!.avgPerPerson = 0;
    });
    expect(listBars().some((b) => b.id === id)).toBe(true);
    expect(listBars({ maxBudget: 2000 }).some((b) => b.id === id)).toBe(false);
  });

  it('budget keeps bars priced at or under the limit', () => {
    const prices = listBars().map((b) => b.avgPerPerson);
    const limit = [...prices].sort((a, b) => a - b)[Math.floor(prices.length / 2)]!;
    const within = listBars({ maxBudget: limit });
    expect(within.length).toBeGreaterThan(0);
    expect(within.every((b) => b.avgPerPerson > 0 && b.avgPerPerson <= limit)).toBe(true);
    expect(within).toHaveLength(prices.filter((p) => p > 0 && p <= limit).length);
  });
});

describe('safety verify (evidence only)', () => {
  it('marks the item ADMIN_VERIFIED by EVIDENCE with a date, never as an on-site visit', () => {
    const bar = getState().bars[0]!;
    const key = bar.safety[0]!.key;
    mutate((s) => {
      const f = s.bars[0]!.safety[0]!;
      f.source = 'SELF_DECLARED';
      f.verifyMethod = null;
      f.verifiedAt = null;
    });
    verifySafety(bar.id, key, 'admin');
    const f = getState().bars[0]!.safety.find((x) => x.key === key)!;
    expect(f.source).toBe('ADMIN_VERIFIED');
    expect(f.verifyMethod).toBe('EVIDENCE');
    expect(f.verifiedAt).toBeTruthy();
  });
});
