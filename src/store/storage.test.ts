import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteUnderlayImage, loadUnderlayImage, saveUnderlayImage } from './storage';

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, String(v)),
  };
}

describe('underlay image storage', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage());
  });

  it('round-trips an image per plan under its own key', () => {
    expect(saveUnderlayImage('plan-a', 'data:image/png;base64,AAA')).toBe(true);
    expect(loadUnderlayImage('plan-a')).toBe('data:image/png;base64,AAA');
    expect(localStorage.getItem('apartment-planner:underlay:plan-a')).toBe('data:image/png;base64,AAA');
    expect(loadUnderlayImage('plan-b')).toBeNull();
  });

  it('deletes only the given plan image', () => {
    saveUnderlayImage('plan-a', 'A');
    saveUnderlayImage('plan-b', 'B');
    deleteUnderlayImage('plan-a');
    expect(loadUnderlayImage('plan-a')).toBeNull();
    expect(loadUnderlayImage('plan-b')).toBe('B');
  });

  it('reports a quota failure and keeps the previous image', () => {
    saveUnderlayImage('plan-a', 'OLD');
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    expect(saveUnderlayImage('plan-a', 'NEW')).toBe(false);
    expect(loadUnderlayImage('plan-a')).toBe('OLD');
  });
});
