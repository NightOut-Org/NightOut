import { describe, expect, it } from 'vitest';
import { promptPayPayload } from './promptpay';

describe('promptPayPayload', () => {
  it('builds a PromptPay payload with CRC', () => {
    const p = promptPayPayload('0812345678', 500);
    expect(p.startsWith('000201')).toBe(true);
    expect(p).toMatch(/6304[0-9A-F]{4}$/);
    expect(p).toContain('5406500.00');
  });
});
