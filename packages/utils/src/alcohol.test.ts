import { describe, expect, it } from 'vitest';
import { ALCOHOL_WARNING_TEXT, ALCOHOL_WORDS, alcoholWordsIn } from './alcohol';

describe('alcoholWordsIn (เตือน ไม่บล็อก — คอมเมนต์ #87)', () => {
  it('finds Thai words', () => {
    expect(alcoholWordsIn('โปรเบียร์ก่อน 2 ทุ่ม')).toEqual(['เบียร์']);
    expect(alcoholWordsIn('มีเหล้าและไวน์')).toEqual(['เหล้า', 'ไวน์']);
  });
  it('matches Latin words case-insensitively on word boundaries only', () => {
    expect(alcoholWordsIn('Cold BEER tonight')).toEqual(['beer']);
    expect(alcoholWordsIn('Beerus fan night')).toEqual([]);
    expect(alcoholWordsIn('Tequila shots!')).toEqual(['tequila', 'shots']);
  });
  it('finds brands and promo phrases', () => {
    expect(alcoholWordsIn('Leo ถังละ 999')).toEqual(['leo']);
    expect(alcoholWordsIn('Johnnie  Walker night')).toEqual(['johnnie walker']);
    expect(alcoholWordsIn('Happy Hour 2 ทุ่ม')).toEqual(['happy hour']);
    expect(alcoholWordsIn('ซื้อ 1 แถม 1 เบียร์')).toContain('ซื้อ 1 แถม 1 เบียร์');
  });
  it('empty / null → [] · dedupes in order of first appearance', () => {
    expect(alcoholWordsIn('')).toEqual([]);
    expect(alcoholWordsIn(null)).toEqual([]);
    expect(alcoholWordsIn(undefined)).toEqual([]);
    expect(alcoholWordsIn('beer เบียร์ BEER เบียร์')).toEqual(['beer', 'เบียร์']);
  });
  it('a normal mixer / food promo → []', () => {
    expect(alcoholWordsIn('มาก่อน 3 ทุ่ม รีฟิลมิกเซอร์ 4 จ่าย 3 + น้ำแข็งฟรี')).toEqual([]);
    expect(alcoholWordsIn('ส่วนลดวันเกิด 10% ค่าอาหาร')).toEqual([]);
  });
  it('word list + warning text', () => {
    expect(ALCOHOL_WORDS.length).toBeGreaterThan(30);
    expect(ALCOHOL_WARNING_TEXT).toContain('ม.30');
  });
});
