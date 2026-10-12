import { describe, expect, it } from 'vitest';
import { parseFeetInches } from './underlay';

describe('parseFeetInches', () => {
  it.each([
    ["8'6\"", 8.5],
    ["8' 6\"", 8.5],
    ["8'-6\"", 8.5],
    ["8'", 8],
    ['6"', 0.5],
    ['8.5', 8.5],
    ['8', 8],
    ['8ft 6in', 8.5],
    ['8 ft 6 in', 8.5],
    ['8 ft', 8],
    ['12 feet 4 inches', 12 + 4 / 12],
    ['8’ 6”', 8.5],
    ['8′6″', 8.5],
    ['  9\'  ', 9],
    ['30in', 2.5],
  ])('parses %j as %d ft', (input, expected) => {
    expect(parseFeetInches(input)).toBeCloseTo(expected, 6);
  });

  it.each(['', '   ', 'abc', '8 6', "8'6", '-3', '0', "0'", '8..5', "6\" 8'", '8ft6ft'])(
    'rejects %j',
    (input) => {
      expect(parseFeetInches(input)).toBeNull();
    },
  );
});
