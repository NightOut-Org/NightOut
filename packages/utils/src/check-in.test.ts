import { describe, expect, it } from 'vitest';
import { CHECK_IN_QR_PREFIX, checkInQrValue, parseCheckInScan } from './index';

const ID = '3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b';

describe('check-in — QR value', () => {
  it('matches app_check_in / get_share_card (NIGHTOUT:<booking id>)', () => {
    expect(CHECK_IN_QR_PREFIX).toBe('NIGHTOUT:');
    expect(checkInQrValue(ID)).toBe(`NIGHTOUT:${ID}`);
  });
});

describe('check-in — parseCheckInScan', () => {
  it('accepts the E-Ticket QR in any case, with spaces around it', () => {
    expect(parseCheckInScan(`NIGHTOUT:${ID}`)).toBe(`NIGHTOUT:${ID}`);
    expect(parseCheckInScan(`nightout:${ID.toUpperCase()}`)).toBe(`NIGHTOUT:${ID}`);
    expect(parseCheckInScan(`  NightOut:${ID}\n`)).toBe(`NIGHTOUT:${ID}`);
  });

  it('round-trips checkInQrValue', () => {
    expect(parseCheckInScan(checkInQrValue(ID))).toBe(checkInQrValue(ID));
  });

  it('rejects a QR whose booking id is not a uuid', () => {
    expect(parseCheckInScan('NIGHTOUT:')).toBeNull();
    expect(parseCheckInScan('NIGHTOUT:not-a-uuid')).toBeNull();
    expect(parseCheckInScan(`NIGHTOUT:${ID}x`)).toBeNull();
    expect(parseCheckInScan(`NIGHTOUT:${ID.replace(/-/g, '')}`)).toBeNull();
  });

  it('normalizes a typed booking code to NL-XXXXXX', () => {
    expect(parseCheckInScan('NL-3F8K2A')).toBe('NL-3F8K2A');
    expect(parseCheckInScan('nl-3f8k2a')).toBe('NL-3F8K2A');
    expect(parseCheckInScan('NL3F8K2A')).toBe('NL-3F8K2A');
    expect(parseCheckInScan(' nl3f8k2a ')).toBe('NL-3F8K2A');
  });

  it('rejects codes that are too short, too long or have other characters', () => {
    expect(parseCheckInScan('NL-3F8')).toBeNull();
    expect(parseCheckInScan('NL-3F8K2A9B7C1')).toBeNull();
    expect(parseCheckInScan('NL-3F8_2A')).toBeNull();
    expect(parseCheckInScan('NL-')).toBeNull();
    expect(parseCheckInScan('3F8K2A')).toBeNull();
  });

  it('anything else is not a NightOut E-Ticket', () => {
    expect(parseCheckInScan('https://x.y')).toBeNull();
    expect(parseCheckInScan(`https://nightout.app/bookings/${ID}`)).toBeNull();
    expect(parseCheckInScan(ID)).toBeNull();
    expect(parseCheckInScan('')).toBeNull();
    expect(parseCheckInScan('   ')).toBeNull();
  });
});
