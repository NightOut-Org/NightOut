import { describe, expect, it } from 'vitest';
import { facebookBirthdate, googleBirthdate, isAtLeastAge, isOAuthProvider } from './age';

describe('googleBirthdate', () => {
  it('เลือกวันเกิดจากบัญชี Google ก่อนแถว primary ของโปรไฟล์', () => {
    expect(
      googleBirthdate([
        { metadata: { primary: true, source: { type: 'PROFILE' } }, date: { year: 1990, month: 1, day: 2 } },
        { metadata: { source: { type: 'ACCOUNT' } }, date: { year: 2001, month: 12, day: 31 } },
      ]),
    ).toBe('2001-12-31');
  });

  it('ข้ามแถวที่ไม่มีปีเกิด แล้วใช้แถวถัดไปที่ครบ', () => {
    expect(
      googleBirthdate([
        { metadata: { source: { type: 'ACCOUNT' } }, date: { month: 5, day: 9 } },
        { metadata: { primary: true }, date: { year: 1999, month: 5, day: 9 } },
      ]),
    ).toBe('1999-05-09');
  });

  it('ไม่มีวันเกิด / ไม่ครบ / วันไม่จริง = null', () => {
    expect(googleBirthdate(undefined)).toBeNull();
    expect(googleBirthdate([])).toBeNull();
    expect(googleBirthdate([{ date: { month: 5, day: 9 } }])).toBeNull();
    expect(googleBirthdate([{ date: { year: 2001, month: 2, day: 30 } }])).toBeNull();
  });
});

describe('facebookBirthdate', () => {
  it('แปลง MM/DD/YYYY เป็น YYYY-MM-DD', () => {
    expect(facebookBirthdate('08/17/2000')).toBe('2000-08-17');
  });

  it('ซ่อนปีหรือวัน/เดือน = ไม่ครบ', () => {
    expect(facebookBirthdate('08/17')).toBeNull();
    expect(facebookBirthdate('2000')).toBeNull();
    expect(facebookBirthdate('')).toBeNull();
    expect(facebookBirthdate(null)).toBeNull();
    expect(facebookBirthdate('13/01/2000')).toBeNull();
  });
});

describe('isAtLeastAge', () => {
  const today = new Date('2026-10-15T10:00:00Z');
  it('ครบ 20 ปีวันนี้ = ผ่าน · พรุ่งนี้ถึงครบ = ไม่ผ่าน', () => {
    expect(isAtLeastAge('2006-10-15', 20, today)).toBe(true);
    expect(isAtLeastAge('2006-10-16', 20, today)).toBe(false);
    expect(isAtLeastAge('1990-01-01', 20, today)).toBe(true);
  });
});

describe('isOAuthProvider', () => {
  it('รับเฉพาะ google / facebook', () => {
    expect(isOAuthProvider('google')).toBe(true);
    expect(isOAuthProvider('facebook')).toBe(true);
    expect(isOAuthProvider('email')).toBe(false);
    expect(isOAuthProvider(undefined)).toBe(false);
  });
});
