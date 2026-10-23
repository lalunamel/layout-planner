import { describe, expect, it } from 'vitest';
import { moveToSlot } from './list';

// Slots are the gaps between items: slot 0 is before the first item, slot
// list.length is after the last.
describe('moveToSlot', () => {
  const list = ['a', 'b', 'c', 'd'];

  it('moves an item down', () => {
    expect(moveToSlot(list, 0, 3)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveToSlot(list, 1, 4)).toEqual(['a', 'c', 'd', 'b']);
  });

  it('moves an item up', () => {
    expect(moveToSlot(list, 3, 0)).toEqual(['d', 'a', 'b', 'c']);
    expect(moveToSlot(list, 2, 1)).toEqual(['a', 'c', 'b', 'd']);
  });

  it('leaves the list alone when dropped next to itself', () => {
    expect(moveToSlot(list, 1, 1)).toBe(list);
    expect(moveToSlot(list, 1, 2)).toBe(list);
  });

  it('ignores an out-of-range item', () => {
    expect(moveToSlot(list, 9, 0)).toBe(list);
  });
});
