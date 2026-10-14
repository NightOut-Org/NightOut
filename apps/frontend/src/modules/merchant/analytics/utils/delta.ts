/** ▲/▼ เทียบช่วงก่อนหน้า · lowerIsBetter = อัตราปลดโต๊ะ (ลดลงเป็นสีเขียว) · '%' แต่ช่วงก่อนเป็น 0 → null (เทียบไม่ได้) */
export function delta(cur: number, prev: number, unit: '%' | 'pt', lowerIsBetter = false) {
  if (unit === '%' && prev === 0) return null;
  const d = unit === '%' ? Math.round(((cur - prev) / prev) * 100) : cur - prev;
  if (d === 0) return { text: 'เท่าเดิม', cls: 'text-muted' };
  const good = lowerIsBetter ? d < 0 : d > 0;
  return {
    text: `${d > 0 ? '▲' : '▼'} ${Math.abs(d)}${unit === '%' ? '%' : ' จุด'}`,
    cls: good ? 'text-(--crowd-available)' : 'text-(--crowd-full)',
  };
}
