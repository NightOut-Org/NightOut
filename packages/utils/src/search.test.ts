import { describe, expect, it } from 'vitest';
import {
  MAX_GROUP_SIZE,
  SEARCH_BUDGET_MAX,
  SEARCH_BUDGET_MIN,
  SEARCH_BUDGET_PRESETS,
  SEARCH_BUDGET_STEP,
  budgetSearchQuery,
  fitsGroup,
  parseBudgetSearch,
} from './index';

const parse = (qs: string) => parseBudgetSearch(new URLSearchParams(qs));

describe('search — constants', () => {
  it('budget range, step and presets line up', () => {
    expect(SEARCH_BUDGET_MIN).toBe(100);
    expect(SEARCH_BUDGET_MAX).toBe(2000);
    expect(SEARCH_BUDGET_STEP).toBe(50);
    expect(MAX_GROUP_SIZE).toBe(12);
    for (const p of SEARCH_BUDGET_PRESETS) {
      expect(p).toBeGreaterThanOrEqual(SEARCH_BUDGET_MIN);
      expect(p).toBeLessThan(SEARCH_BUDGET_MAX);
      expect(p % SEARCH_BUDGET_STEP).toBe(0);
    }
    expect([...SEARCH_BUDGET_PRESETS]).toEqual([...SEARCH_BUDGET_PRESETS].sort((a, b) => a - b));
  });
});

describe('search — parseBudgetSearch', () => {
  it('reads all four fields from the Hero query', () => {
    expect(parse('?q=rooftop&district=ห้วยขวาง&budget=400&people=8')).toEqual({
      q: 'rooftop',
      district: 'ห้วยขวาง',
      budget: 400,
      people: 8,
    });
  });

  it('missing or empty params mean "no filter"', () => {
    expect(parse('')).toEqual({});
    expect(parse('?q=&district=%20%20&budget=&people=')).toEqual({});
  });

  it('trims q and district', () => {
    expect(parse('?q=%20%20live%20music%20&district=%20ทองหล่อ%20')).toEqual({ q: 'live music', district: 'ทองหล่อ' });
  });

  it('budget below the minimum is raised to the minimum', () => {
    expect(parse('?budget=50').budget).toBe(SEARCH_BUDGET_MIN);
  });

  it('budget at/over the maximum or not a number means unlimited', () => {
    expect(parse('?budget=5000').budget).toBeUndefined();
    expect(parse(`?budget=${SEARCH_BUDGET_MAX}`).budget).toBeUndefined();
    expect(parse('?budget=abc').budget).toBeUndefined();
    expect(parse('?budget=0').budget).toBeUndefined();
    expect(parse('?budget=-300').budget).toBeUndefined();
    expect(parse('?budget=Infinity').budget).toBeUndefined();
  });

  it('keeps a valid budget (rounded to whole baht)', () => {
    expect(parse('?budget=1950').budget).toBe(1950);
    expect(parse('?budget=399.6').budget).toBe(400);
  });

  it('people must be a positive whole number · above the max is capped', () => {
    expect(parse('?people=0').people).toBeUndefined();
    expect(parse('?people=-1').people).toBeUndefined();
    expect(parse('?people=x').people).toBeUndefined();
    expect(parse('?people=2.5').people).toBeUndefined();
    expect(parse('?people=40').people).toBe(MAX_GROUP_SIZE);
    expect(parse('?people=1').people).toBe(1);
    expect(parse(`?people=${MAX_GROUP_SIZE}`).people).toBe(MAX_GROUP_SIZE);
  });

  it('accepts any object with get() (not only URLSearchParams)', () => {
    const m = new Map([['people', '6']]);
    expect(parseBudgetSearch({ get: (k) => m.get(k) ?? null })).toEqual({ people: 6 });
  });
});

describe('search — budgetSearchQuery', () => {
  it('orders q, district, budget, people and has no leading "?"', () => {
    expect(budgetSearchQuery({ people: 8, budget: 400, district: 'Thonglor', q: 'rooftop' })).toBe(
      'q=rooftop&district=Thonglor&budget=400&people=8',
    );
  });

  it('skips empty values', () => {
    expect(budgetSearchQuery({})).toBe('');
    expect(budgetSearchQuery({ q: '   ', district: '', budget: undefined, people: undefined })).toBe('');
    expect(budgetSearchQuery({ q: ' bar ', people: 4 })).toBe('q=bar&people=4');
  });

  it('drops numbers that would not filter (unlimited budget, bad people)', () => {
    expect(budgetSearchQuery({ budget: SEARCH_BUDGET_MAX })).toBe('');
    expect(budgetSearchQuery({ budget: Number.NaN, people: 0 })).toBe('');
  });

  it('encodes Thai text and reserved characters', () => {
    const qs = budgetSearchQuery({ q: 'ร้าน & บาร์', district: 'ห้วยขวาง' });
    expect(qs).toBe(`q=${encodeURIComponent('ร้าน & บาร์')}&district=${encodeURIComponent('ห้วยขวาง')}`);
    expect(qs).not.toMatch(/[ก-๙ ]/);
  });

  it('round-trips through parseBudgetSearch', () => {
    const cases = [
      { q: 'rooftop', district: 'ห้วยขวาง', budget: 400, people: 8 },
      { district: 'ทองหล่อ', people: 2 },
      { q: 'ร้าน & บาร์ #1', budget: 1500 },
      {},
    ];
    for (const s of cases) expect(parseBudgetSearch(new URLSearchParams(budgetSearchQuery(s)))).toEqual(s);
  });
});

describe('search — fitsGroup', () => {
  const zones = [{ capacityPax: 6 }, { capacityPax: 10 }];
  it('needs at least one zone that seats the whole group', () => {
    expect(fitsGroup(zones, 8)).toBe(true);
    expect(fitsGroup(zones, 10)).toBe(true);
    expect(fitsGroup(zones, 12)).toBe(false);
  });
  it('no group size = every bar fits', () => {
    expect(fitsGroup(zones, undefined)).toBe(true);
    expect(fitsGroup(zones)).toBe(true);
    expect(fitsGroup([])).toBe(true);
  });
  it('a bar without zones cannot take a group', () => {
    expect(fitsGroup([], 2)).toBe(false);
  });
});
