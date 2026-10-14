import { describe, expect, it } from 'vitest';
import {
  LEGACY_DEFAULT_PIN,
  LOCATION_REQUEST_SOURCE_LABELS,
  LOCATION_REQUEST_STATUS_LABELS,
  MAP_DEFAULT_CENTER,
  THAILAND_BOUNDS,
  TRANSIT_LINES,
  TRANSIT_LINE_LABELS,
  distanceMeters,
  formatDistance,
  formatTransit,
  isInThailand,
  isLegacyDefaultPin,
  parseLatLng,
  roundCoord,
} from './index';

describe('location — Thailand bounds', () => {
  it('accepts points inside Thailand', () => {
    expect(isInThailand(13.7563, 100.5018)).toBe(true); // กรุงเทพฯ
    expect(isInThailand(20.0, 99.9)).toBe(true); // เชียงราย
    expect(isInThailand(MAP_DEFAULT_CENTER.lat, MAP_DEFAULT_CENTER.lng)).toBe(true);
  });
  it('includes the edges of the box', () => {
    expect(isInThailand(THAILAND_BOUNDS.south, THAILAND_BOUNDS.west)).toBe(true);
    expect(isInThailand(THAILAND_BOUNDS.north, THAILAND_BOUNDS.east)).toBe(true);
  });
  it('rejects points outside Thailand and non-finite numbers', () => {
    expect(isInThailand(35.68, 139.69)).toBe(false); // โตเกียว
    expect(isInThailand(Number.NaN, 100.5)).toBe(false);
    expect(isInThailand(13.7, Number.POSITIVE_INFINITY)).toBe(false);
  });
});

describe('location — legacy default pin', () => {
  it('matches the pin app_merchant_join used to hard-code', () => {
    expect(isLegacyDefaultPin(LEGACY_DEFAULT_PIN.lat, LEGACY_DEFAULT_PIN.lng)).toBe(true);
    expect(isLegacyDefaultPin(13.7563, 100.5018)).toBe(true);
    expect(isLegacyDefaultPin(13.7563004, 100.5017996)).toBe(true);
  });
  it('does not match a real pin', () => {
    expect(isLegacyDefaultPin(13.7564, 100.5018)).toBe(false);
    expect(isLegacyDefaultPin(13.7563, 100.5028)).toBe(false);
  });
});

describe('location — roundCoord', () => {
  it('keeps 6 decimals like numeric(9,6)', () => {
    expect(roundCoord(13.75634567)).toBe(13.756346);
    expect(roundCoord(100.5)).toBe(100.5);
  });
});

describe('location — transit', () => {
  it('lists every line with a Thai-friendly label', () => {
    expect(TRANSIT_LINES).toEqual(['BTS', 'MRT', 'ARL', 'SRT']);
    for (const line of TRANSIT_LINES) expect(TRANSIT_LINE_LABELS[line]).toBeTruthy();
  });
  it('formats line + station + walking minutes', () => {
    expect(formatTransit({ line: 'BTS', station: 'อารีย์', walkMinutes: 5 })).toBe('BTS อารีย์ · เดิน 5 นาที');
    expect(formatTransit({ line: 'ARL', station: 'มักกะสัน', walkMinutes: 10 })).toBe('Airport Rail Link มักกะสัน · เดิน 10 นาที');
  });
  it('omits the walk when not given', () => {
    expect(formatTransit({ line: 'MRT', station: 'สุขุมวิท' })).toBe('MRT สุขุมวิท');
    expect(formatTransit({ line: 'MRT', station: 'สุขุมวิท', walkMinutes: null })).toBe('MRT สุขุมวิท');
  });
  it('returns null when there is no transit info', () => {
    expect(formatTransit(null)).toBeNull();
    expect(formatTransit(undefined)).toBeNull();
    expect(formatTransit({ line: 'BTS', station: '   ' })).toBeNull();
  });
});

describe('location — distance', () => {
  it('measures 0.01° latitude ≈ 1112 m (haversine)', () => {
    const d = distanceMeters({ lat: 13.7, lng: 100.5 }, { lat: 13.71, lng: 100.5 });
    expect(Math.abs(d - 1112)).toBeLessThanOrEqual(5);
    expect(distanceMeters({ lat: 13.7, lng: 100.5 }, { lat: 13.7, lng: 100.5 })).toBe(0);
  });
  it('formats metres below 1 km and kilometres with 1 decimal above', () => {
    expect(formatDistance(999)).toBe('999 ม.');
    expect(formatDistance(35.4)).toBe('35 ม.');
    expect(formatDistance(1234)).toBe('1.2 กม.');
    expect(formatDistance(999.6)).toBe('1.0 กม.');
  });
});

describe('location — parseLatLng', () => {
  const pin = { lat: 13.7563, lng: 100.5018 };
  it('reads "lat, lng" and "lat lng"', () => {
    expect(parseLatLng('13.7563, 100.5018')).toEqual(pin);
    expect(parseLatLng('  13.7563 100.5018  ')).toEqual(pin);
    expect(parseLatLng('13.7563,100.5018')).toEqual(pin);
  });
  it('reads a Google Maps "@lat,lng" link', () => {
    expect(parseLatLng('https://www.google.com/maps/place/Some+Bar/@13.7563,100.5018,17z')).toEqual(pin);
  });
  it('reads a Google Maps "?q=lat,lng" / "query=" link', () => {
    expect(parseLatLng('https://maps.google.com/?q=13.7563,100.5018')).toEqual(pin);
    expect(parseLatLng('https://www.google.com/maps/search/?api=1&query=13.7563%2C100.5018')).toEqual(pin);
  });
  it('prefers the place pin "!3dlat!4dlng" over the viewport "@"', () => {
    expect(
      parseLatLng('https://www.google.com/maps/place/X/@13.70,100.40,15z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d13.7563!4d100.5018'),
    ).toEqual(pin);
  });
  it('rounds to 6 decimals', () => {
    expect(parseLatLng('13.75634567, 100.50181234')).toEqual({ lat: 13.756346, lng: 100.501812 });
  });
  it('returns null for unreadable text or a point outside Thailand', () => {
    expect(parseLatLng('abc')).toBeNull();
    expect(parseLatLng('')).toBeNull();
    expect(parseLatLng('35.68,139.69')).toBeNull();
    expect(parseLatLng('100.5018, 13.7563')).toBeNull();
  });
});

describe('location — request labels', () => {
  it('has Thai labels for every status and source', () => {
    expect(LOCATION_REQUEST_STATUS_LABELS).toEqual({ PENDING: 'รอตรวจ', APPROVED: 'ผ่านแล้ว', REJECTED: 'ตีกลับ', CANCELLED: 'ยกเลิก' });
    expect(LOCATION_REQUEST_SOURCE_LABELS).toEqual({ MERCHANT: 'ร้านขอแก้', ADMIN: 'ทีม NightOut ตั้งแทน' });
  });
});
