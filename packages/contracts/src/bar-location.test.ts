import { describe, expect, it } from 'vitest';
import {
  AdminSetBarLocationBody,
  BAR_ERRORS,
  BarInfoBody,
  BarLocationBody,
  GeocodeReverseQuery,
  GeocodeSearchQuery,
  MerchantJoinBody,
  ReviewBarLocationBody,
} from './bar';
import { ADMIN_VIEWS } from './backoffice';
import { ERROR_MESSAGES } from './errors';

const bangkok = {
  lat: 13.7563,
  lng: 100.5018,
  address: '123 ซอยอารีย์ 1 พญาไท กรุงเทพฯ',
  parking_note: null,
  transit_line: null,
  transit_station: null,
  transit_walk_minutes: null,
};
const tokyo = { ...bangkok, lat: 35.68, lng: 139.69 };

describe('bar location — BarLocationBody', () => {
  it('accepts a Bangkok pin with every optional field empty', () => {
    expect(BarLocationBody.safeParse(bangkok).success).toBe(true);
    expect(BarLocationBody.safeParse({ lat: 13.7563, lng: 100.5018, address: 'ถนนสุขุมวิท' }).success).toBe(true);
  });
  it('accepts full transit + parking info', () => {
    const r = BarLocationBody.safeParse({
      ...bangkok,
      parking_note: '  จอดในซอยได้ 10 คัน ฟรี ',
      transit_line: 'BTS',
      transit_station: 'อารีย์',
      transit_walk_minutes: 5,
    });
    expect(r.success).toBe(true);
    expect(r.data?.parking_note).toBe('จอดในซอยได้ 10 คัน ฟรี');
  });
  it('rejects a pin outside Thailand', () => {
    const r = BarLocationBody.safeParse(tokyo);
    expect(r.success).toBe(false);
    expect(r.error?.issues.some((i) => i.path[0] === 'lat' && i.message === 'หมุดต้องอยู่ในประเทศไทย')).toBe(true);
  });
  it('requires the line and the station together', () => {
    const lineOnly = BarLocationBody.safeParse({ ...bangkok, transit_line: 'MRT' });
    expect(lineOnly.success).toBe(false);
    expect(lineOnly.error?.issues.some((i) => i.path[0] === 'transit_station')).toBe(true);
    const stationOnly = BarLocationBody.safeParse({ ...bangkok, transit_station: 'สุขุมวิท' });
    expect(stationOnly.success).toBe(false);
    const blankStation = BarLocationBody.safeParse({ ...bangkok, transit_line: 'MRT', transit_station: '   ' });
    expect(blankStation.success).toBe(false);
  });
  it('allows walking minutes only when a station is set', () => {
    const r = BarLocationBody.safeParse({ ...bangkok, transit_walk_minutes: 5 });
    expect(r.success).toBe(false);
    expect(r.error?.issues.some((i) => i.path[0] === 'transit_walk_minutes')).toBe(true);
  });
  it('rejects an unknown line, a too-long walk and a 2-character address', () => {
    expect(BarLocationBody.safeParse({ ...bangkok, transit_line: 'BRT', transit_station: 'สาทร' }).success).toBe(false);
    expect(BarLocationBody.safeParse({ ...bangkok, transit_line: 'BTS', transit_station: 'อารีย์', transit_walk_minutes: 61 }).success).toBe(false);
    expect(BarLocationBody.safeParse({ ...bangkok, address: 'ab' }).success).toBe(false);
    expect(BarLocationBody.safeParse({ ...bangkok, address: '  ab  ' }).success).toBe(false);
  });
});

describe('bar location — MerchantJoinBody', () => {
  const join = { name: 'ร้านทดสอบ', category: 'PUB_BAR', district_id: null, license: null };
  it('requires lat/lng', () => {
    expect(MerchantJoinBody.safeParse({ ...join, address: bangkok.address }).success).toBe(false);
    expect(MerchantJoinBody.safeParse({ ...join, ...bangkok }).success).toBe(true);
  });
  it('applies the same location checks', () => {
    expect(MerchantJoinBody.safeParse({ ...join, ...tokyo }).success).toBe(false);
    expect(MerchantJoinBody.safeParse({ ...join, ...bangkok, transit_line: 'BTS' }).success).toBe(false);
  });
});

describe('bar location — BarInfoBody no longer edits the address', () => {
  it('strips address', () => {
    const parsed = BarInfoBody.parse({ address: 'x', name: 'A' });
    expect(parsed).toEqual({ name: 'A' });
    expect('address' in parsed).toBe(false);
  });
});

describe('bar location — ReviewBarLocationBody', () => {
  it('approves with or without an adjusted location', () => {
    expect(ReviewBarLocationBody.safeParse({ approve: true }).success).toBe(true);
    expect(ReviewBarLocationBody.safeParse({ approve: true, location: bangkok }).success).toBe(true);
  });
  it('requires a reason to reject', () => {
    expect(ReviewBarLocationBody.safeParse({ approve: false }).success).toBe(false);
    expect(ReviewBarLocationBody.safeParse({ approve: false, reason: '  ' }).success).toBe(false);
    expect(ReviewBarLocationBody.safeParse({ approve: false, reason: 'หมุดไม่ตรงหน้าร้าน' }).success).toBe(true);
  });
  it('does not take a location when rejecting', () => {
    expect(ReviewBarLocationBody.safeParse({ approve: false, reason: 'x', location: bangkok }).success).toBe(false);
  });
  it('validates the adjusted location', () => {
    expect(ReviewBarLocationBody.safeParse({ approve: true, location: tokyo }).success).toBe(false);
  });
});

describe('bar location — AdminSetBarLocationBody', () => {
  it('takes an optional note and the same checks', () => {
    expect(AdminSetBarLocationBody.safeParse({ ...bangkok, note: 'ปรับหมุดให้ตรงหน้าร้าน' }).success).toBe(true);
    expect(AdminSetBarLocationBody.safeParse(bangkok).success).toBe(true);
    expect(AdminSetBarLocationBody.safeParse({ ...tokyo, note: null }).success).toBe(false);
    expect(AdminSetBarLocationBody.safeParse({ ...bangkok, transit_station: 'อารีย์' }).success).toBe(false);
  });
});

describe('bar location — geocode queries', () => {
  it('coerces reverse-geocode numbers from the query string', () => {
    expect(GeocodeReverseQuery.parse({ lat: '13.7', lng: '100.5' })).toEqual({ lat: 13.7, lng: 100.5 });
    expect(GeocodeReverseQuery.safeParse({ lat: '35.68', lng: '139.69' }).success).toBe(false);
  });
  it('defaults the search limit and bounds the text', () => {
    expect(GeocodeSearchQuery.parse({ q: ' อารีย์ ' })).toEqual({ q: 'อารีย์', limit: 5 });
    expect(GeocodeSearchQuery.parse({ q: 'สีลม', limit: '3' }).limit).toBe(3);
    expect(GeocodeSearchQuery.safeParse({ q: 'a' }).success).toBe(false);
    expect(GeocodeSearchQuery.safeParse({ q: 'สีลม', limit: '9' }).success).toBe(false);
  });
});

describe('bar location — errors + admin views', () => {
  it('has Thai messages for every new code', () => {
    for (const code of [
      'INVALID_BAR_LOCATION',
      'LOCATION_OUTSIDE_THAILAND',
      'LOCATION_UNCHANGED',
      'LOCATION_REQUEST_NOT_FOUND',
      'LOCATION_REQUEST_ALREADY_REVIEWED',
      'LOCATION_REJECT_REASON_REQUIRED',
      'BAR_LOCATION_NOT_SET',
      'GEOCODER_UNAVAILABLE',
      'GEOCODER_BUSY',
    ] as const) {
      expect(BAR_ERRORS[code]).toBeTruthy();
      expect(ERROR_MESSAGES[code]).toBe(BAR_ERRORS[code]);
    }
    expect(BAR_ERRORS.INVALID_BAR_INFO).toBe('กรอกชื่อร้านให้ครบ (1–80 ตัวอักษร)');
  });
  it('lists the two pin-review views', () => {
    expect(ADMIN_VIEWS).toContain('admin_bar_locations');
    expect(ADMIN_VIEWS).toContain('admin_bar_location_requests');
  });
});
