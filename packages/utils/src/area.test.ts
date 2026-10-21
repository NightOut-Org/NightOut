import { describe, expect, it } from 'vitest';
import { amphoeLabel, areaLine, areaMatches, provinceLabel, tambonLabel } from './area';

const bkk = {
  district: 'ทองหล่อ',
  tambon: 'คลองตันเหนือ',
  amphoe: 'วัฒนา',
  province: 'กรุงเทพมหานคร',
  provinceCode: 'TH10',
};
const cnx = {
  district: null,
  tambon: 'สุเทพ',
  amphoe: 'เมืองเชียงใหม่',
  province: 'เชียงใหม่',
  provinceCode: 'TH50',
};

describe('area labels', () => {
  it('Bangkok uses เขต/แขวง and short province', () => {
    expect(amphoeLabel(bkk)).toBe('เขตวัฒนา');
    expect(tambonLabel(bkk)).toBe('แขวงคลองตันเหนือ');
    expect(provinceLabel(bkk)).toBe('กรุงเทพฯ');
  });
  it('other provinces use อำเภอ/ตำบล', () => {
    expect(amphoeLabel(cnx)).toBe('อำเภอเมืองเชียงใหม่');
    expect(tambonLabel(cnx)).toBe('ตำบลสุเทพ');
    expect(provinceLabel(cnx)).toBe('เชียงใหม่');
  });
  it('areaLine prefers ย่าน, falls back to tambon, skips missing parts', () => {
    expect(areaLine(bkk)).toBe('ย่านทองหล่อ เขตวัฒนา กรุงเทพฯ');
    expect(areaLine(cnx)).toBe('ตำบลสุเทพ อำเภอเมืองเชียงใหม่ เชียงใหม่');
    expect(areaLine(cnx, { tambon: false })).toBe('อำเภอเมืองเชียงใหม่ เชียงใหม่');
    expect(areaLine({})).toBe('');
  });
});

describe('areaMatches', () => {
  it('matches any level, ignoring prefixes', () => {
    expect(areaMatches(bkk, 'ทองหล่อ')).toBe(true);
    expect(areaMatches(bkk, 'ย่านทองหล่อ')).toBe(true);
    expect(areaMatches(bkk, 'เขตวัฒนา')).toBe(true);
    expect(areaMatches(bkk, 'กทม')).toBe(true);
    expect(areaMatches(cnx, 'จังหวัดเชียงใหม่')).toBe(true);
    expect(areaMatches(cnx, 'วัฒนา')).toBe(false);
    expect(areaMatches(cnx, '  ')).toBe(true);
  });
});
