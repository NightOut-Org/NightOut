import { describe, expect, it, vi } from 'vitest';
import type { SupabaseService } from '../../supabase/supabase.service';
import { shuffled } from './mini-ads.public.controller';
import { MINI_ADS_BUCKET, MiniAdsService } from './mini-ads.service';

describe('shuffled (public mini-ads)', () => {
  it('returns a permutation without mutating the input', () => {
    const input = [1, 2, 3, 4, 5, 6];
    const copy = [...input];
    const out = shuffled(input);
    expect(input).toEqual(copy);
    expect(out).not.toBe(input);
    expect([...out].sort((a, b) => a - b)).toEqual(copy);
  });
  it('is deterministic with a fixed random', () => {
    expect(shuffled([1, 2, 3, 4], () => 0)).toEqual([2, 3, 4, 1]);
    expect(shuffled([1, 2, 3, 4], () => 0.999)).toEqual([1, 2, 3, 4]);
  });
  it('handles empty and single-item lists', () => {
    expect(shuffled([])).toEqual([]);
    expect(shuffled(['a'])).toEqual(['a']);
  });
});

describe('MiniAdsService (Backoffice writes)', () => {
  const fake = (result: object) => {
    const rpc = vi.fn().mockResolvedValue(result);
    const removeObjects = vi.fn().mockResolvedValue(undefined);
    return { svc: new MiniAdsService({ rpc, removeObjects } as unknown as SupabaseService), rpc, removeObjects };
  };

  it('stores images in the site-media bucket', () => {
    expect(MINI_ADS_BUCKET).toBe('site-media');
  });

  it('strips removed_paths and deletes those files from site-media', async () => {
    const { svc, rpc, removeObjects } = fake({ id: 'a', title: 't', removed_paths: ['ads/old.webp'] });
    const out = await svc.save('actor', 'a', { title: 't', confirm_no_alcohol: true });
    expect(out).toEqual({ id: 'a', title: 't' });
    expect(rpc).toHaveBeenCalledWith('admin_save_mini_ad', {
      p_actor: 'actor',
      p_id: 'a',
      p: { title: 't', confirm_no_alcohol: true },
    });
    expect(removeObjects).toHaveBeenCalledWith('site-media', ['ads/old.webp']);
  });

  it('does not call removeObjects when nothing was removed', async () => {
    const empty = fake({ id: 'a', title: 't', removed_paths: [] });
    await empty.svc.save('actor', null, { active: false });
    expect(empty.rpc).toHaveBeenCalledWith('admin_save_mini_ad', { p_actor: 'actor', p_id: null, p: { active: false } });
    expect(empty.removeObjects).not.toHaveBeenCalled();

    const missing = fake({ id: 'a', deleted: true });
    expect(await missing.svc.remove('actor', 'a')).toEqual({ id: 'a', deleted: true });
    expect(missing.rpc).toHaveBeenCalledWith('admin_delete_mini_ad', { p_actor: 'actor', p_id: 'a' });
    expect(missing.removeObjects).not.toHaveBeenCalled();
  });

  it('deletes the image of a deleted ad', async () => {
    const { svc, removeObjects } = fake({ id: 'a', deleted: true, removed_paths: ['ads/x.webp'] });
    expect(await svc.remove('actor', 'a')).toEqual({ id: 'a', deleted: true });
    expect(removeObjects).toHaveBeenCalledWith('site-media', ['ads/x.webp']);
  });
});
