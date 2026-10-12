# Floor Plan Image Underlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user add a listing floor-plan image to a plan, calibrate it to the grid by measuring a room of known size, lock it, and place furniture on top.

**Architecture:** Pure math (dimension parsing, measure → scale, aspect-locked resize, fit-to-view) lives in `src/model/underlay.ts`; calibration session state is a pure reducer in `src/model/calibration.ts` driven from `App`. The image data URL is stored under its own localStorage key per plan, while the small `underlay` placement record lives on `FloorPlan` (outside undo history). `Canvas` renders the image under the grid, and during calibration renders an SVG interaction overlay plus an HTML HUD (instruction bar + measure popover).

**Tech Stack:** React 19, TypeScript 6, Vite 8, Bun (package manager), oxlint, Vitest (added in Task 1).

**Spec:** `docs/superpowers/specs/2026-10-12-floor-plan-image-underlay-design.md`

## Global Constraints

- Storage stays in localStorage. Image key: `apartment-planner:underlay:<planId>` (matches the existing `apartment-planner:` prefix).
- Imported images: longest side ≤ 2000 px; originals ≤ 2000 px are stored unchanged; larger ones are downscaled and encoded as PNG.
- Quota failure message, verbatim: `Not enough browser storage for this image`.
- Default plan title, verbatim: `Untitled Floor Plan`.
- Modal card labels, verbatim: `Manually create floor plan` (left), `Upload floor plan image` (right).
- Image menu items, verbatim: `Recalibrate`, `Replace image`, `Remove image`. No-image button title: `Add floor plan image`.
- Locked image opacity: `0.55`. During calibration: `1`.
- Uniform scale only; one image per plan; the underlay is never part of undo/redo.
- Toolbar stays icon-only (labels via `title`/`aria-label`).
- Run tests with `bun run test`, lint with `bun run lint`, typecheck+build with `bun run build`.

## Review Focus

1. **Dimensions typed the way listings print them** — `8' 6"`, `8'-6"`, curly quotes `8’ 6”`, `12 ft 4 in` must parse; garbage must be rejected, never silently become 0. → Task 1 parser tests.
2. **Storage full during Replace** — the old image and placement must survive untouched. → Task 3 storage test (`saveUnderlayImage` returns `false` and leaves the previous value).
3. **Measuring a single line** — a box that is essentially a horizontal line with only the width filled in must work; filling in only the zero-length side must be rejected without NaN/Infinity. → Task 2 `measureUnderlay` tests.
4. **Huge screenshots** — a 4000×3000 image must come in at 2000×1500, and a portrait 1200×3600 at 667×2000. → Task 2 `fitWithin` tests.
5. **Cancel semantics** — Cancel on a brand-new upload removes the image; Cancel on Recalibrate/Replace restores the prior image + placement; reload mid-calibration leaves a plan with no visible image and the toolbar offering Add. → Task 4 reducer tests + Task 7 Step 4 / Task 8 Step 4 browser checks.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `package.json` | Modify | Add `vitest` dev dep + `test` script |
| `src/model/types.ts` | Modify | `Underlay` type; `FloorPlan.underlay?` |
| `src/model/underlay.ts` | Create | Pure math: parsing, rect conversions, measure, resize, fit |
| `src/model/underlay.test.ts` | Create | Tests for the above |
| `src/store/storage.ts` | Modify | Image key load/save/delete |
| `src/store/storage.test.ts` | Create | Storage tests with an in-memory localStorage stub |
| `src/store/useAppStore.ts` | Modify | `underlayImage`, `setUnderlayImage`, `setUnderlay`, `createPlan(name, imageDataUrl?)`, delete cleanup |
| `src/model/calibration.ts` | Create | Calibration session reducer |
| `src/model/calibration.test.ts` | Create | Reducer tests |
| `src/model/imageImport.ts` | Create | File → validated, downscaled data URL; `loadImageSize` |
| `src/hooks/useImageSize.ts` | Create | React hook wrapping `loadImageSize` |
| `src/components/UnderlayImage.tsx` | Create | SVG `<image>` for an underlay |
| `src/components/calibration/CalibrationOverlay.tsx` | Create | SVG gestures: measure box, move, corner resize |
| `src/components/calibration/CalibrationHud.tsx` | Create | HTML instruction bar + measure popover |
| `src/components/calibration/Calibration.module.css` | Create | Styles for the HUD |
| `src/components/Canvas.tsx` | Modify | Render underlay + calibration layers; suppress normal editing while calibrating |
| `src/components/UnderlayButton.tsx` | Create | Toolbar image button, file picker, menu |
| `src/components/UnderlayButton.module.css` | Create | Menu styles |
| `src/components/NewPlanModal.tsx` | Create | Title field + two choice cards, picker/drop/paste |
| `src/components/NewPlanModal.module.css` | Create | Modal styles |
| `src/App.tsx` | Modify | Wire calibration reducer, toolbar button, new-plan modal |

---

### Task 1: Vitest setup and dimension parser

**Files:**
- Modify: `package.json`
- Create: `src/model/underlay.ts`
- Test: `src/model/underlay.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `parseFeetInches(input: string): number | null` exported from `src/model/underlay.ts`. Returns feet (> 0) or `null` for empty/invalid/non-positive input.

- [ ] **Step 1: Add Vitest**

Run: `bun add -d vitest`

Then add a `test` script to `package.json` `scripts` (keep the others):

```json
"test": "vitest run"
```

No Vitest config is needed: the default `node` environment and the default `**/*.test.ts` glob are what we want. Test files import `describe/it/expect/vi` explicitly from `vitest`.

- [ ] **Step 2: Write the failing test**

Create `src/model/underlay.test.ts`:

```ts
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
```

Note: `"8'6"` (missing the closing `"`) is rejected on purpose — a trailing bare number after feet is ambiguous.

- [ ] **Step 3: Run test to verify it fails**

Run: `bun run test`
Expected: FAIL — cannot resolve `./underlay` / `parseFeetInches` is not a function.

- [ ] **Step 4: Write minimal implementation**

Create `src/model/underlay.ts`:

```ts
const NUMBER = String.raw`(\d+(?:\.\d+)?)`;
const FEET_INCHES = new RegExp(String.raw`^(?:${NUMBER}\s*')?\s*-?\s*(?:${NUMBER}\s*")?$`);
const BARE_NUMBER = new RegExp(String.raw`^${NUMBER}$`);

/** Parse a length the way floor-plan listings print it (8'6", 8' 6",
 * 8'-6", 8ft 6in, 8.5 …) into feet. A bare number means feet. Returns
 * null for empty, malformed, or non-positive input. */
export function parseFeetInches(input: string): number | null {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[’′]/g, "'")
    .replace(/[”″]/g, '"')
    .replace(/\s*(?:feet|foot|ft)\b/g, "'")
    .replace(/\s*(?:inches|inch|in)\b/g, '"');
  if (!normalized) return null;

  let feet: number;
  const bare = BARE_NUMBER.exec(normalized);
  if (bare) {
    feet = Number(bare[1]);
  } else {
    const match = FEET_INCHES.exec(normalized);
    if (!match || (match[1] === undefined && match[2] === undefined)) return null;
    feet = Number(match[1] ?? 0) + Number(match[2] ?? 0) / 12;
  }
  return Number.isFinite(feet) && feet > 0 ? feet : null;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run test`
Expected: PASS (all parse/reject cases).

If `'8ft6ft'` passes as valid, the regex is wrong — it normalizes to `8'6'`, which must not match `FEET_INCHES` (only one `'` group is allowed). Fix the implementation, not the test.

- [ ] **Step 6: Lint, typecheck, commit**

Run: `bun run lint && bun run build`
Expected: no errors.

```bash
git add package.json bun.lock src/model/underlay.ts src/model/underlay.test.ts
git commit -m "Add Vitest and a feet/inches dimension parser for calibration"
```

---

### Task 2: Underlay geometry

**Files:**
- Modify: `src/model/types.ts`
- Modify: `src/model/underlay.ts`
- Test: `src/model/underlay.test.ts`

**Interfaces:**
- Consumes: `snap(value, resolution)` and `MAJOR_GRID_FT` from `src/model/geometry.ts`; `Point` from `src/model/types.ts`.
- Produces (all exported from `src/model/underlay.ts` unless noted):
  - `interface Underlay { x: number; y: number; widthFt: number }` — exported from `src/model/types.ts`.
  - `interface Size { width: number; height: number }`
  - `interface Rect { x: number; y: number; width: number; height: number }`
  - `interface RealSize { width: number | null; height: number | null }`
  - `type Corner = 'nw' | 'ne' | 'sw' | 'se'`
  - `const MAX_IMAGE_SIDE_PX = 2000`
  - `const MIN_UNDERLAY_WIDTH_FT = 1`
  - `fitWithin(size: Size, maxSide: number): Size`
  - `underlayHeightFt(u: Underlay, natural: Size): number`
  - `underlayRect(u: Underlay, natural: Size): Rect`
  - `normalizeRect(a: Point, b: Point): Rect`
  - `pointInRect(p: Point, r: Rect): boolean`
  - `worldRectToImage(u: Underlay, natural: Size, r: Rect): Rect`
  - `imageRectToWorld(u: Underlay, natural: Size, r: Rect): Rect`
  - `fitUnderlayToView(view: Rect, natural: Size): Underlay`
  - `measureUnderlay(u: Underlay, natural: Size, box: Rect, real: RealSize): Underlay | null`
  - `resizeFromCorner(u: Underlay, natural: Size, corner: Corner, pointer: Point): Underlay`

- [ ] **Step 1: Add the `Underlay` type**

In `src/model/types.ts`, add above `FloorPlan` and extend `FloorPlan`:

```ts
/** Placement of a plan's background floor-plan image, in world feet.
 * Height follows from the image's aspect ratio. */
export interface Underlay {
  x: number;
  y: number;
  widthFt: number;
}

export interface FloorPlan {
  id: string;
  name: string;
  updatedAt: string;
  walls: Wall[];
  placed: PlacedFurniture[];
  underlay?: Underlay;
}
```

- [ ] **Step 2: Write the failing tests**

Append to `src/model/underlay.test.ts` (and extend the import line to include the new names):

```ts
import {
  fitUnderlayToView,
  fitWithin,
  imageRectToWorld,
  measureUnderlay,
  normalizeRect,
  parseFeetInches,
  pointInRect,
  resizeFromCorner,
  underlayHeightFt,
  underlayRect,
  worldRectToImage,
} from './underlay';

const natural = { width: 1000, height: 500 };
const base = { x: 0, y: 0, widthFt: 100 }; // 0.1 ft per image px

describe('fitWithin', () => {
  it('leaves small images alone', () => {
    expect(fitWithin({ width: 800, height: 600 }, 2000)).toEqual({ width: 800, height: 600 });
    expect(fitWithin({ width: 2000, height: 1000 }, 2000)).toEqual({ width: 2000, height: 1000 });
  });
  it('scales landscape images by the longest side', () => {
    expect(fitWithin({ width: 4000, height: 3000 }, 2000)).toEqual({ width: 2000, height: 1500 });
  });
  it('scales portrait images by the longest side, rounding', () => {
    expect(fitWithin({ width: 1200, height: 3600 }, 2000)).toEqual({ width: 667, height: 2000 });
  });
});

describe('underlay rects', () => {
  it('derives height from the aspect ratio', () => {
    expect(underlayHeightFt(base, natural)).toBe(50);
    expect(underlayRect({ x: 2, y: 3, widthFt: 10 }, natural)).toEqual({ x: 2, y: 3, width: 10, height: 5 });
  });
  it('normalizes a rect dragged in any direction', () => {
    expect(normalizeRect({ x: 5, y: 1 }, { x: 2, y: 4 })).toEqual({ x: 2, y: 1, width: 3, height: 3 });
  });
  it('hit-tests inclusive of edges', () => {
    const r = { x: 0, y: 0, width: 10, height: 5 };
    expect(pointInRect({ x: 10, y: 5 }, r)).toBe(true);
    expect(pointInRect({ x: 10.01, y: 2 }, r)).toBe(false);
  });
  it('round-trips world <-> image pixel rects', () => {
    const u = { x: 4, y: -2, widthFt: 50 }; // 0.05 ft/px
    const world = { x: 9, y: 3, width: 5, height: 2.5 };
    const px = worldRectToImage(u, natural, world);
    expect(px.x).toBeCloseTo(100);
    expect(px.y).toBeCloseTo(100);
    expect(px.width).toBeCloseTo(100);
    expect(px.height).toBeCloseTo(50);
    const back = imageRectToWorld(u, natural, px);
    expect(back.x).toBeCloseTo(9);
    expect(back.y).toBeCloseTo(3);
    expect(back.width).toBeCloseTo(5);
    expect(back.height).toBeCloseTo(2.5);
  });
});

describe('fitUnderlayToView', () => {
  it('fits within 80% of the view, centered', () => {
    expect(fitUnderlayToView({ x: 0, y: 0, width: 40, height: 30 }, natural)).toEqual({ x: 4, y: 7, widthFt: 32 });
  });
  it('is limited by height for tall images', () => {
    const u = fitUnderlayToView({ x: 10, y: 10, width: 40, height: 30 }, { width: 500, height: 1000 });
    expect(u.widthFt).toBeCloseTo(12); // 80% of 30 = 24 tall → 12 wide
    expect(u.x).toBeCloseTo(10 + (40 - 12) / 2);
    expect(u.y).toBeCloseTo(10 + (30 - 24) / 2);
  });
});

describe('measureUnderlay', () => {
  it('scales from one dimension, anchoring the box on a grid line', () => {
    const box = { x: 10, y: 5, width: 10, height: 5 }; // 100 x 50 image px
    const u = measureUnderlay(base, natural, box, { width: 20, height: null })!;
    expect(u.widthFt).toBeCloseTo(200); // 0.2 ft/px
    expect(u.x).toBeCloseTo(-10); // box px x=100 → 10 - 100*0.2
    expect(u.y).toBeCloseTo(-5);
  });
  it('averages the two per-axis scales when both are given', () => {
    const box = { x: 10, y: 5, width: 10, height: 5 };
    const u = measureUnderlay(base, natural, box, { width: 20, height: 12 })!; // 0.2 and 0.24
    expect(u.widthFt).toBeCloseTo(220);
  });
  it('snaps the measured box top-left to the nearest 1 ft grid line', () => {
    const box = { x: 10.4, y: 5.6, width: 10, height: 5 }; // px x=104, y=56
    const u = measureUnderlay(base, natural, box, { width: 20, height: null })!;
    const measured = imageRectToWorld(u, natural, worldRectToImage(base, natural, box));
    expect(measured.x).toBeCloseTo(10);
    expect(measured.y).toBeCloseTo(6);
    expect(measured.width).toBeCloseTo(20);
  });
  it('measures a single horizontal line using only the width', () => {
    const line = { x: 10, y: 5, width: 3, height: 0 };
    const u = measureUnderlay(base, natural, line, { width: 3, height: null })!;
    expect(u.widthFt).toBeCloseTo(100);
  });
  it('rejects a dimension for a side the box does not have', () => {
    const line = { x: 10, y: 5, width: 3, height: 0 };
    expect(measureUnderlay(base, natural, line, { width: null, height: 4 })).toBeNull();
  });
  it('rejects when no dimension is given', () => {
    expect(measureUnderlay(base, natural, { x: 0, y: 0, width: 1, height: 1 }, { width: null, height: null })).toBeNull();
  });
});

describe('resizeFromCorner', () => {
  const u = { x: 0, y: 0, widthFt: 10 }; // 10 x 5
  it('resizes from the south-east corner, anchored at north-west', () => {
    expect(resizeFromCorner(u, natural, 'se', { x: 20, y: 6 })).toEqual({ x: 0, y: 0, widthFt: 20 });
  });
  it('uses whichever axis implies the larger size', () => {
    expect(resizeFromCorner(u, natural, 'se', { x: 4, y: 10 })).toEqual({ x: 0, y: 0, widthFt: 20 });
  });
  it('resizes from the north-west corner, anchored at south-east', () => {
    expect(resizeFromCorner(u, natural, 'nw', { x: -10, y: 0 })).toEqual({ x: -10, y: -5, widthFt: 20 });
  });
  it('resizes from the north-east and south-west corners', () => {
    expect(resizeFromCorner(u, natural, 'ne', { x: 20, y: 0 })).toEqual({ x: 0, y: -5, widthFt: 20 });
    expect(resizeFromCorner(u, natural, 'sw', { x: -10, y: 5 })).toEqual({ x: -10, y: 0, widthFt: 20 });
  });
  it('never shrinks below the minimum width', () => {
    expect(resizeFromCorner(u, natural, 'se', { x: 0.1, y: 0.1 }).widthFt).toBe(1);
  });
});
```

(Keep the existing `parseFeetInches` block; merge the imports into the single import statement at the top.)

- [ ] **Step 3: Run tests to verify they fail**

Run: `bun run test`
Expected: FAIL — the new functions are not exported.

- [ ] **Step 4: Implement**

Append to `src/model/underlay.ts` (add imports at the top of the file):

```ts
import type { Point, Underlay } from './types';
import { MAJOR_GRID_FT, snap } from './geometry';

export interface Size {
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Real-world size the user typed for a measured box; either side may be omitted. */
export interface RealSize {
  width: number | null;
  height: number | null;
}

export type Corner = 'nw' | 'ne' | 'sw' | 'se';

export const MAX_IMAGE_SIDE_PX = 2000;
export const MIN_UNDERLAY_WIDTH_FT = 1;
const FIT_FRACTION = 0.8;

export function fitWithin(size: Size, maxSide: number): Size {
  const longest = Math.max(size.width, size.height);
  if (longest <= maxSide) return size;
  const k = maxSide / longest;
  return { width: Math.round(size.width * k), height: Math.round(size.height * k) };
}

export function underlayHeightFt(u: Underlay, natural: Size): number {
  return (u.widthFt * natural.height) / natural.width;
}

export function underlayRect(u: Underlay, natural: Size): Rect {
  return { x: u.x, y: u.y, width: u.widthFt, height: underlayHeightFt(u, natural) };
}

export function normalizeRect(a: Point, b: Point): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

export function pointInRect(p: Point, r: Rect): boolean {
  return p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
}

function feetPerPixel(u: Underlay, natural: Size): number {
  return u.widthFt / natural.width;
}

export function worldRectToImage(u: Underlay, natural: Size, r: Rect): Rect {
  const k = feetPerPixel(u, natural);
  return { x: (r.x - u.x) / k, y: (r.y - u.y) / k, width: r.width / k, height: r.height / k };
}

export function imageRectToWorld(u: Underlay, natural: Size, r: Rect): Rect {
  const k = feetPerPixel(u, natural);
  return { x: u.x + r.x * k, y: u.y + r.y * k, width: r.width * k, height: r.height * k };
}

/** Initial placement for a freshly imported image: as large as fits in 80%
 * of the visible area, centered. */
export function fitUnderlayToView(view: Rect, natural: Size): Underlay {
  const aspect = natural.height / natural.width;
  const widthFt = Math.min(view.width * FIT_FRACTION, (view.height * FIT_FRACTION) / aspect);
  const heightFt = widthFt * aspect;
  return {
    x: view.x + (view.width - widthFt) / 2,
    y: view.y + (view.height - heightFt) / 2,
    widthFt,
  };
}

/** Rescale the image so `box` (world feet, drawn over the current
 * placement) becomes `real` feet, then shift it so the box's top-left lands
 * on the nearest grid intersection. With both sides given, the two
 * per-axis scales are averaged. Returns null when no usable side exists. */
export function measureUnderlay(u: Underlay, natural: Size, box: Rect, real: RealSize): Underlay | null {
  const px = worldRectToImage(u, natural, box);
  const scales: number[] = [];
  if (real.width !== null && px.width > 0) scales.push(real.width / px.width);
  if (real.height !== null && px.height > 0) scales.push(real.height / px.height);
  if (scales.length === 0) return null;
  const k = scales.reduce((sum, s) => sum + s, 0) / scales.length;
  const anchorX = snap(box.x, MAJOR_GRID_FT);
  const anchorY = snap(box.y, MAJOR_GRID_FT);
  return { x: anchorX - px.x * k, y: anchorY - px.y * k, widthFt: natural.width * k };
}

/** Aspect-locked resize by dragging `corner` to `pointer`, keeping the
 * opposite corner fixed. The axis implying the larger size wins. */
export function resizeFromCorner(u: Underlay, natural: Size, corner: Corner, pointer: Point): Underlay {
  const aspect = natural.height / natural.width;
  const w = u.widthFt;
  const h = w * aspect;
  const west = corner === 'nw' || corner === 'sw';
  const north = corner === 'nw' || corner === 'ne';
  const anchorX = west ? u.x + w : u.x;
  const anchorY = north ? u.y + h : u.y;
  const widthFt = Math.max(
    Math.abs(pointer.x - anchorX),
    Math.abs(pointer.y - anchorY) / aspect,
    MIN_UNDERLAY_WIDTH_FT,
  );
  return {
    x: west ? anchorX - widthFt : anchorX,
    y: north ? anchorY - widthFt * aspect : anchorY,
    widthFt,
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun run test`
Expected: PASS. `toEqual` on `resizeFromCorner` uses exact numbers chosen to be float-exact; if one fails by ~1e-15, switch that assertion to `toBeCloseTo` per field rather than changing the math.

- [ ] **Step 6: Lint, typecheck, commit**

Run: `bun run lint && bun run build`

```bash
git add src/model/types.ts src/model/underlay.ts src/model/underlay.test.ts
git commit -m "Add underlay geometry: measure-to-scale, corner resize, fit to view"
```

---

### Task 3: Image storage and store wiring

**Files:**
- Modify: `src/store/storage.ts`
- Test: `src/store/storage.test.ts`
- Modify: `src/store/useAppStore.ts`

**Interfaces:**
- Consumes: `Underlay` from `src/model/types.ts`.
- Produces:
  - `storage.loadUnderlayImage(planId: string): string | null`
  - `storage.saveUnderlayImage(planId: string, dataUrl: string): boolean` — `false` on any storage error (quota), previous value untouched.
  - `storage.deleteUnderlayImage(planId: string): void`
  - From `useAppStore()` (added to the returned object):
    - `underlayImage: string | null` — the active plan's image data URL.
    - `setUnderlayImage(planId: string, dataUrl: string | null): boolean` — `null` deletes; returns `false` on quota failure.
    - `setUnderlay(planId: string, underlay: Underlay | undefined): void`
    - `createPlan(name: string, imageDataUrl?: string): FloorPlan | null` — `null` only when the image could not be stored (no plan is created then).
    - `deletePlan` now also deletes the plan's image key.

- [ ] **Step 1: Write the failing test**

Create `src/store/storage.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test`
Expected: FAIL — `saveUnderlayImage` etc. not exported.

- [ ] **Step 3: Implement storage**

In `src/store/storage.ts`, add below the existing key constants and functions:

```ts
const UNDERLAY_KEY_PREFIX = 'apartment-planner:underlay:';

export function loadUnderlayImage(planId: string): string | null {
  return localStorage.getItem(UNDERLAY_KEY_PREFIX + planId);
}

/** Returns false (leaving any previous image in place) when the browser
 * refuses the write, e.g. because localStorage is full. */
export function saveUnderlayImage(planId: string, dataUrl: string): boolean {
  try {
    localStorage.setItem(UNDERLAY_KEY_PREFIX + planId, dataUrl);
    return true;
  } catch {
    return false;
  }
}

export function deleteUnderlayImage(planId: string): void {
  localStorage.removeItem(UNDERLAY_KEY_PREFIX + planId);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test`
Expected: PASS.

- [ ] **Step 5: Wire into `useAppStore`**

In `src/store/useAppStore.ts`:

1. Import `Underlay`: `import type { FloorPlan, FurnitureTemplate, Underlay } from '../model/types';`

2. Add image state right after the `activePlanId` state:

```ts
  const [underlayImage, setUnderlayImageState] = useState<string | null>(() =>
    activePlanId ? storage.loadUnderlayImage(activePlanId) : null,
  );

  useEffect(() => {
    setUnderlayImageState(activePlanId ? storage.loadUnderlayImage(activePlanId) : null);
  }, [activePlanId]);
```

(The lazy initializer reads `activePlanId` declared just above it — keep this order.)

3. Replace `createPlan`:

```ts
  const createPlan = useCallback((name: string, imageDataUrl?: string): FloorPlan | null => {
    const plan = seedPlan(name);
    if (imageDataUrl !== undefined && !storage.saveUnderlayImage(plan.id, imageDataUrl)) return null;
    setPlans((prev) => {
      const next = [plan, ...prev];
      storage.savePlans(next);
      return next;
    });
    setActivePlanId(plan.id);
    return plan;
  }, []);
```

4. In `deletePlan`, call `storage.deleteUnderlayImage(id);` as the first line of the callback body (before `setPlans`).

5. Add two callbacks after `openPlan`:

```ts
  const setUnderlayImage = useCallback(
    (planId: string, dataUrl: string | null): boolean => {
      if (dataUrl === null) {
        storage.deleteUnderlayImage(planId);
      } else if (!storage.saveUnderlayImage(planId, dataUrl)) {
        return false;
      }
      if (planId === activePlanId) setUnderlayImageState(dataUrl);
      return true;
    },
    [activePlanId],
  );

  const setUnderlay = useCallback((planId: string, underlay: Underlay | undefined) => {
    setPlans((prev) => {
      const next = prev.map((p) =>
        p.id === planId ? { ...p, underlay, updatedAt: new Date().toISOString() } : p,
      );
      storage.savePlans(next);
      return next;
    });
  }, []);
```

`underlay: undefined` is dropped by `JSON.stringify`, so removing it needs no special case.

6. Add `underlayImage`, `setUnderlayImage`, `setUnderlay` to the returned object.

The existing history write-back effect spreads `...p`, so it preserves `underlay` — do not change it.

- [ ] **Step 6: Typecheck, lint, test, commit**

Run: `bun run test && bun run lint && bun run build`
Expected: all pass. `App.tsx` still calls `store.createPlan('Untitled Floor Plan')` and ignores the return value — that still typechecks.

```bash
git add src/store/storage.ts src/store/storage.test.ts src/store/useAppStore.ts
git commit -m "Store floor plan images per plan and expose underlay setters"
```

---

### Task 4: Calibration session reducer

**Files:**
- Create: `src/model/calibration.ts`
- Test: `src/model/calibration.test.ts`

**Interfaces:**
- Consumes: `Underlay` (types), `Size`, `Rect`, `RealSize`, `measureUnderlay`, `worldRectToImage` (underlay.ts).
- Produces (exported from `src/model/calibration.ts`):

```ts
export type CalibrationStep = 'measure' | 'adjust';
export interface CalibrationRestore { src: string | null; underlay: Underlay | undefined }
export interface CalibrationSession {
  planId: string;
  src: string;
  natural: Size;
  draft: Underlay | null;          // null until the canvas fits it to the view
  step: CalibrationStep;
  pendingBox: Rect | null;         // world feet; drawn, awaiting dimensions
  measuredBoxPx: Rect | null;      // image px; last applied measurement
  restore: CalibrationRestore;     // what Cancel puts back
}
export type CalibrationAction =
  | { type: 'START'; planId: string; src: string; natural: Size; draft: Underlay | null; restore: CalibrationRestore }
  | { type: 'SET_DRAFT'; draft: Underlay }
  | { type: 'SET_PENDING_BOX'; box: Rect | null }
  | { type: 'APPLY_MEASURE'; real: RealSize }
  | { type: 'MEASURE_AGAIN' }
  | { type: 'END' };
export function calibrationReducer(state: CalibrationSession | null, action: CalibrationAction): CalibrationSession | null;
```

Step rules: `START` with `draft: null` (new/replaced image) begins in `measure`; with a draft (Recalibrate) begins in `adjust`.

- [ ] **Step 1: Write the failing test**

Create `src/model/calibration.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { calibrationReducer, type CalibrationSession } from './calibration';

const natural = { width: 1000, height: 500 };
const restore = { src: null, underlay: undefined };

function started(draft: CalibrationSession['draft']): CalibrationSession {
  return calibrationReducer(null, { type: 'START', planId: 'p', src: 'img', natural, draft, restore })!;
}

describe('calibrationReducer', () => {
  it('starts a fresh image in the measure step', () => {
    const s = started(null);
    expect(s.step).toBe('measure');
    expect(s.draft).toBeNull();
    expect(s.pendingBox).toBeNull();
    expect(s.restore).toEqual(restore);
  });

  it('starts a recalibration in the adjust step', () => {
    expect(started({ x: 0, y: 0, widthFt: 10 }).step).toBe('adjust');
  });

  it('applies a measurement: rescales, records the box, moves to adjust', () => {
    let s = calibrationReducer(started(null), { type: 'SET_DRAFT', draft: { x: 0, y: 0, widthFt: 100 } });
    s = calibrationReducer(s, { type: 'SET_PENDING_BOX', box: { x: 10, y: 5, width: 10, height: 5 } });
    s = calibrationReducer(s, { type: 'APPLY_MEASURE', real: { width: 20, height: null } })!;
    expect(s.step).toBe('adjust');
    expect(s.pendingBox).toBeNull();
    expect(s.draft!.widthFt).toBeCloseTo(200);
    expect(s.measuredBoxPx!.x).toBeCloseTo(100);
    expect(s.measuredBoxPx!.width).toBeCloseTo(100);
  });

  it('ignores APPLY_MEASURE that cannot be measured', () => {
    let s = calibrationReducer(started(null), { type: 'SET_DRAFT', draft: { x: 0, y: 0, widthFt: 100 } });
    s = calibrationReducer(s, { type: 'SET_PENDING_BOX', box: { x: 10, y: 5, width: 3, height: 0 } });
    const after = calibrationReducer(s, { type: 'APPLY_MEASURE', real: { width: null, height: 4 } });
    expect(after).toBe(s);
  });

  it('ignores APPLY_MEASURE with no pending box', () => {
    const s = calibrationReducer(started(null), { type: 'SET_DRAFT', draft: { x: 0, y: 0, widthFt: 100 } });
    expect(calibrationReducer(s, { type: 'APPLY_MEASURE', real: { width: 5, height: null } })).toBe(s);
  });

  it('measure again clears the boxes and returns to measure', () => {
    const s = calibrationReducer(
      { ...started({ x: 0, y: 0, widthFt: 10 }), measuredBoxPx: { x: 1, y: 1, width: 1, height: 1 } },
      { type: 'MEASURE_AGAIN' },
    )!;
    expect(s.step).toBe('measure');
    expect(s.measuredBoxPx).toBeNull();
    expect(s.pendingBox).toBeNull();
  });

  it('ends the session', () => {
    expect(calibrationReducer(started(null), { type: 'END' })).toBeNull();
  });

  it('ignores non-START actions when idle', () => {
    expect(calibrationReducer(null, { type: 'MEASURE_AGAIN' })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test`
Expected: FAIL — cannot resolve `./calibration`.

- [ ] **Step 3: Implement**

Create `src/model/calibration.ts`:

```ts
import type { Underlay } from './types';
import { measureUnderlay, worldRectToImage, type RealSize, type Rect, type Size } from './underlay';

export type CalibrationStep = 'measure' | 'adjust';

/** What Cancel puts back: the image and placement from before calibration
 * started. `src: null` means the plan had no image (a brand-new upload). */
export interface CalibrationRestore {
  src: string | null;
  underlay: Underlay | undefined;
}

export interface CalibrationSession {
  planId: string;
  src: string;
  natural: Size;
  draft: Underlay | null;
  step: CalibrationStep;
  pendingBox: Rect | null;
  measuredBoxPx: Rect | null;
  restore: CalibrationRestore;
}

export type CalibrationAction =
  | { type: 'START'; planId: string; src: string; natural: Size; draft: Underlay | null; restore: CalibrationRestore }
  | { type: 'SET_DRAFT'; draft: Underlay }
  | { type: 'SET_PENDING_BOX'; box: Rect | null }
  | { type: 'APPLY_MEASURE'; real: RealSize }
  | { type: 'MEASURE_AGAIN' }
  | { type: 'END' };

export function calibrationReducer(
  state: CalibrationSession | null,
  action: CalibrationAction,
): CalibrationSession | null {
  if (action.type === 'START') {
    return {
      planId: action.planId,
      src: action.src,
      natural: action.natural,
      draft: action.draft,
      step: action.draft ? 'adjust' : 'measure',
      pendingBox: null,
      measuredBoxPx: null,
      restore: action.restore,
    };
  }
  if (!state) return state;

  switch (action.type) {
    case 'SET_DRAFT':
      return { ...state, draft: action.draft };

    case 'SET_PENDING_BOX':
      return { ...state, pendingBox: action.box };

    case 'APPLY_MEASURE': {
      if (!state.draft || !state.pendingBox) return state;
      const next = measureUnderlay(state.draft, state.natural, state.pendingBox, action.real);
      if (!next) return state;
      return {
        ...state,
        draft: next,
        step: 'adjust',
        pendingBox: null,
        measuredBoxPx: worldRectToImage(state.draft, state.natural, state.pendingBox),
      };
    }

    case 'MEASURE_AGAIN':
      return { ...state, step: 'measure', pendingBox: null, measuredBoxPx: null };

    case 'END':
      return null;

    default:
      return state;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test`
Expected: PASS.

- [ ] **Step 5: Lint, typecheck, commit**

Run: `bun run lint && bun run build`

```bash
git add src/model/calibration.ts src/model/calibration.test.ts
git commit -m "Add calibration session reducer"
```

---

### Task 5: Image import and locked underlay rendering

**Files:**
- Create: `src/model/imageImport.ts`
- Create: `src/hooks/useImageSize.ts`
- Create: `src/components/UnderlayImage.tsx`
- Modify: `src/components/Canvas.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `fitWithin`, `MAX_IMAGE_SIDE_PX`, `Size`, `underlayHeightFt` (underlay.ts); `store.underlayImage`, `store.activePlanMeta.underlay` (Task 3).
- Produces:
  - `importImageFile(file: File): Promise<{ dataUrl: string; size: Size }>` — rejects with `Error('not-image')` for non-images or undecodable files.
  - `loadImageSize(src: string): Promise<Size>`
  - `useImageSize(src: string | null): Size | null`
  - `<UnderlayImage src: string; underlay: Underlay; opacity: number />` — renders nothing until the image size is known.
  - `Canvas` new prop: `underlay: { src: string; rect: Underlay } | null` (the locked image).

This task has no unit tests (all DOM image decoding; `fitWithin` is already covered). Verify in the browser.

- [ ] **Step 1: Create `src/model/imageImport.ts`**

```ts
import { fitWithin, MAX_IMAGE_SIDE_PX, type Size } from './underlay';

export interface ImportedImage {
  dataUrl: string;
  size: Size;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('not-image'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => (img.naturalWidth > 0 && img.naturalHeight > 0 ? resolve(img) : reject(new Error('not-image')));
    img.onerror = () => reject(new Error('not-image'));
    img.src = src;
  });
}

export async function loadImageSize(src: string): Promise<Size> {
  const img = await loadImage(src);
  return { width: img.naturalWidth, height: img.naturalHeight };
}

/** Read an image file into a data URL, downscaling (to PNG, which keeps
 * line drawings crisp) when its longest side exceeds MAX_IMAGE_SIDE_PX. */
export async function importImageFile(file: File): Promise<ImportedImage> {
  if (!file.type.startsWith('image/')) throw new Error('not-image');
  const original = await readAsDataUrl(file);
  const img = await loadImage(original);
  const natural = { width: img.naturalWidth, height: img.naturalHeight };
  const target = fitWithin(natural, MAX_IMAGE_SIDE_PX);
  if (target === natural) return { dataUrl: original, size: natural };

  const canvas = document.createElement('canvas');
  canvas.width = target.width;
  canvas.height = target.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('not-image');
  ctx.drawImage(img, 0, 0, target.width, target.height);
  return { dataUrl: canvas.toDataURL('image/png'), size: target };
}
```

(`fitWithin` returns the same object when no resize is needed, so the identity check is exact.)

- [ ] **Step 2: Create `src/hooks/useImageSize.ts`**

```ts
import { useEffect, useState } from 'react';
import { loadImageSize } from '../model/imageImport';
import type { Size } from '../model/underlay';

/** Natural pixel size of an image source, or null while loading / on error. */
export function useImageSize(src: string | null): Size | null {
  const [loaded, setLoaded] = useState<{ src: string; size: Size } | null>(null);

  useEffect(() => {
    if (!src) return;
    let cancelled = false;
    loadImageSize(src)
      .then((size) => {
        if (!cancelled) setLoaded({ src, size });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [src]);

  return loaded && loaded.src === src ? loaded.size : null;
}
```

- [ ] **Step 3: Create `src/components/UnderlayImage.tsx`**

```tsx
import type { Underlay } from '../model/types';
import { underlayHeightFt } from '../model/underlay';
import { useImageSize } from '../hooks/useImageSize';

export function UnderlayImage({ src, underlay, opacity }: { src: string; underlay: Underlay; opacity: number }) {
  const natural = useImageSize(src);
  if (!natural) return null;
  return (
    <image
      href={src}
      x={underlay.x}
      y={underlay.y}
      width={underlay.widthFt}
      height={underlayHeightFt(underlay, natural)}
      preserveAspectRatio="none"
      opacity={opacity}
      style={{ pointerEvents: 'none' }}
    />
  );
}
```

- [ ] **Step 4: Render it in `Canvas`**

In `src/components/Canvas.tsx`:

1. Imports: add `Underlay` to the `../model/types` type import, and `import { UnderlayImage } from './UnderlayImage';`.
2. Add to `CanvasProps`: `underlay: { src: string; rect: Underlay } | null;` and destructure `underlay` in the component signature.
3. Add `const LOCKED_UNDERLAY_OPACITY = 0.55;` next to `VERTEX_HIT_PX`.
4. Immediately **before** `<rect ref={bgRef} … fill="url(#gridMajor)" />`, insert:

```tsx
          {underlay && <UnderlayImage src={underlay.src} underlay={underlay.rect} opacity={LOCKED_UNDERLAY_OPACITY} />}
```

The grid rect stays on top of the image and keeps receiving background clicks, so the image never intercepts input.

- [ ] **Step 5: Pass it from `App`**

In `src/App.tsx`, add to `<Canvas …>`:

```tsx
          underlay={
            store.underlayImage && store.activePlanMeta?.underlay
              ? { src: store.underlayImage, rect: store.activePlanMeta.underlay }
              : null
          }
```

- [ ] **Step 6: Verify in the browser**

Start the preview (`preview_start` name `layout-planner`). In the page, run via `javascript_tool` (seeds a test image without UI):

```js
const plans = JSON.parse(localStorage.getItem('apartment-planner:plans'));
const id = localStorage.getItem('apartment-planner:activePlanId');
const c = document.createElement('canvas'); c.width = 400; c.height = 200;
const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0,0,400,200);
g.strokeStyle = '#000'; g.lineWidth = 6; g.strokeRect(20,20,360,160);
localStorage.setItem('apartment-planner:underlay:' + id, c.toDataURL());
plans.find(p => p.id === id).underlay = { x: 0, y: 0, widthFt: 20 };
localStorage.setItem('apartment-planner:plans', JSON.stringify(plans));
location.reload();
```

Expected: a faded 20 ft × 10 ft rectangle drawing under the grid lines at the origin; clicking on it still starts a wall (pointer mode); dragging furniture over it works; no console errors. Then remove the seed (`delete` the `underlay` field and the key) and reload.

- [ ] **Step 7: Lint, typecheck, test, commit**

Run: `bun run test && bun run lint && bun run build`

```bash
git add src/model/imageImport.ts src/hooks/useImageSize.ts src/components/UnderlayImage.tsx src/components/Canvas.tsx src/App.tsx
git commit -m "Render a plan's locked floor plan image under the grid"
```

---

### Task 6: Calibration overlay and HUD on the canvas

**Files:**
- Create: `src/components/calibration/CalibrationOverlay.tsx`
- Create: `src/components/calibration/CalibrationHud.tsx`
- Create: `src/components/calibration/Calibration.module.css`
- Modify: `src/components/Canvas.tsx`

**Interfaces:**
- Consumes: `CalibrationSession`, `CalibrationAction` (Task 4); `Rect`, `Corner`, `normalizeRect`, `pointInRect`, `underlayRect`, `imageRectToWorld`, `fitUnderlayToView`, `resizeFromCorner`, `measureUnderlay`, `parseFeetInches` (Tasks 1–2); `DimensionLabel` from `./DrawingAids`; `CanvasMode` from `Canvas.tsx`; `UnderlayImage` (Task 5).
- Produces:
  - `Canvas` new prop: `calibration: { session: CalibrationSession; dispatch: (a: CalibrationAction) => void; onDone: () => void; onCancel: () => void } | null`.
  - `<CalibrationOverlay session dispatch viewRect scale mode toWorld />` (SVG).
  - `<CalibrationHud session dispatch scale worldToScreen onDone onCancel />` (HTML).

Behavior (from spec §2):
- Measure step: left-drag anywhere draws a dashed box; on release, if the box is ≥ 6 screen px in width **or** height, it becomes `pendingBox` and the popover opens; otherwise it is discarded.
- Adjust step: left-drag inside the image moves it; dragging a corner handle resizes it aspect-locked; the last measured box is drawn dashed with dimension labels, moving with the image.
- Middle-drag and Space/pan mode still pan; wheel still zooms. Furniture and walls get no input.

- [ ] **Step 1: Create `Calibration.module.css`**

```css
.bar {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 8px 8px 16px;
  background: #fff;
  border: 1px solid var(--paper-grid-major);
  border-radius: 12px;
  box-shadow: var(--shadow-hover);
  font-size: 13px;
  color: var(--ink);
  white-space: nowrap;
  z-index: 10;
}

.instruction {
  font-weight: 600;
}

.popover {
  position: absolute;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: #fff;
  border: 1px solid var(--paper-grid-major);
  border-radius: 12px;
  box-shadow: var(--shadow-hover);
  font-size: 13px;
  z-index: 11;
}

.fields {
  display: flex;
  align-items: flex-start;
  gap: 6px;
}

.times {
  padding-top: 8px;
  color: var(--ink-soft);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.field label {
  font-size: 11px;
  color: var(--ink-soft);
}

.field input {
  width: 84px;
  font: inherit;
  border: 1px solid var(--paper-grid-major);
  border-radius: 8px;
  padding: 6px 8px;
  background: var(--blue-50);
}

.field input:focus {
  outline: none;
  border-color: var(--blue-500);
  background: #fff;
}

.field input.invalid {
  border-color: var(--danger);
}

.error {
  color: var(--danger);
  font-size: 12px;
  max-width: 200px;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btnPrimary,
.btnGhost {
  border-radius: 8px;
  padding: 7px 14px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.btnPrimary {
  background: var(--blue-500);
  color: #fff;
  border: none;
}

.btnPrimary:hover {
  background: var(--blue-600);
}

.btnGhost {
  background: none;
  border: 1px solid var(--paper-grid-major);
  color: var(--ink-soft);
}

.btnGhost:hover {
  background: var(--blue-50);
  color: var(--ink);
}
```

- [ ] **Step 2: Create `CalibrationOverlay.tsx`**

```tsx
import { useEffect, useState } from 'react';
import type { Point, Underlay } from '../../model/types';
import type { CalibrationAction, CalibrationSession } from '../../model/calibration';
import {
  fitUnderlayToView,
  imageRectToWorld,
  normalizeRect,
  pointInRect,
  resizeFromCorner,
  underlayRect,
  type Corner,
  type Rect,
} from '../../model/underlay';
import { DimensionLabel } from '../DrawingAids';
import type { CanvasMode } from '../Canvas';

const MIN_MEASURE_PX = 6;
const HANDLE_PX = 10;

type Drag =
  | { kind: 'measure'; start: Point; current: Point }
  | { kind: 'move'; start: Point; original: Underlay }
  | { kind: 'resize'; corner: Corner; original: Underlay }
  | null;

interface CalibrationOverlayProps {
  session: CalibrationSession;
  dispatch: (action: CalibrationAction) => void;
  viewRect: Rect;
  scale: number;
  mode: CanvasMode;
  toWorld: (clientX: number, clientY: number) => Point;
}

export function CalibrationOverlay({ session, dispatch, viewRect, scale, mode, toWorld }: CalibrationOverlayProps) {
  const [drag, setDrag] = useState<Drag>(null);
  const { draft, natural, step } = session;

  // A fresh image has no placement yet: fit it to whatever is on screen.
  useEffect(() => {
    if (!draft && viewRect.width > 0) {
      dispatch({ type: 'SET_DRAFT', draft: fitUnderlayToView(viewRect, natural) });
    }
  }, [draft, viewRect, natural, dispatch]);

  useEffect(() => {
    if (!drag) return;
    function onMove(e: MouseEvent) {
      const world = toWorld(e.clientX, e.clientY);
      if (drag!.kind === 'measure') {
        setDrag({ ...drag!, current: world });
      } else if (drag!.kind === 'move') {
        dispatch({
          type: 'SET_DRAFT',
          draft: {
            ...drag!.original,
            x: drag!.original.x + world.x - drag!.start.x,
            y: drag!.original.y + world.y - drag!.start.y,
          },
        });
      } else {
        dispatch({ type: 'SET_DRAFT', draft: resizeFromCorner(drag!.original, natural, drag!.corner, world) });
      }
    }
    function onUp() {
      if (drag!.kind === 'measure') {
        const box = normalizeRect(drag!.start, drag!.current);
        if (box.width * scale >= MIN_MEASURE_PX || box.height * scale >= MIN_MEASURE_PX) {
          dispatch({ type: 'SET_PENDING_BOX', box });
        }
      }
      setDrag(null);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [drag, dispatch, natural, scale, toWorld]);

  if (!draft) return null;
  const imageRect = underlayRect(draft, natural);

  function handleMouseDown(e: React.MouseEvent) {
    if (e.button !== 0 || mode !== 'pointer') return; // middle-drag / pan mode bubble to Canvas
    e.stopPropagation();
    const world = toWorld(e.clientX, e.clientY);
    if (step === 'measure') {
      dispatch({ type: 'SET_PENDING_BOX', box: null });
      setDrag({ kind: 'measure', start: world, current: world });
    } else if (pointInRect(world, imageRect)) {
      setDrag({ kind: 'move', start: world, original: draft! });
    }
  }

  function startResize(e: React.MouseEvent, corner: Corner) {
    if (e.button !== 0 || mode !== 'pointer') return;
    e.stopPropagation();
    setDrag({ kind: 'resize', corner, original: draft! });
  }

  const liveBox = drag?.kind === 'measure' ? normalizeRect(drag.start, drag.current) : session.pendingBox;
  const measuredBox = step === 'adjust' && session.measuredBoxPx ? imageRectToWorld(draft, natural, session.measuredBoxPx) : null;
  const handle = HANDLE_PX / scale;
  const corners: { corner: Corner; x: number; y: number; cursor: string }[] = [
    { corner: 'nw', x: imageRect.x, y: imageRect.y, cursor: 'nwse-resize' },
    { corner: 'ne', x: imageRect.x + imageRect.width, y: imageRect.y, cursor: 'nesw-resize' },
    { corner: 'sw', x: imageRect.x, y: imageRect.y + imageRect.height, cursor: 'nesw-resize' },
    { corner: 'se', x: imageRect.x + imageRect.width, y: imageRect.y + imageRect.height, cursor: 'nwse-resize' },
  ];
  const isMoving = drag?.kind === 'move';

  return (
    <g>
      <rect
        x={viewRect.x}
        y={viewRect.y}
        width={viewRect.width}
        height={viewRect.height}
        fill="transparent"
        style={{ pointerEvents: mode === 'pointer' ? 'all' : 'none', cursor: step === 'measure' ? 'crosshair' : 'default' }}
        onMouseDown={handleMouseDown}
      />
      <rect
        x={imageRect.x}
        y={imageRect.y}
        width={imageRect.width}
        height={imageRect.height}
        fill="transparent"
        stroke="var(--blue-500)"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        style={{
          pointerEvents: mode === 'pointer' ? 'all' : 'none',
          cursor: step === 'measure' ? 'crosshair' : isMoving ? 'grabbing' : 'move',
        }}
        onMouseDown={handleMouseDown}
      />
      {liveBox && (
        <rect
          x={liveBox.x}
          y={liveBox.y}
          width={liveBox.width}
          height={liveBox.height}
          fill="rgba(79, 134, 214, 0.12)"
          stroke="var(--blue-600)"
          strokeWidth={2}
          strokeDasharray="6 4"
          vectorEffect="non-scaling-stroke"
          style={{ pointerEvents: 'none' }}
        />
      )}
      {measuredBox && (
        <g style={{ pointerEvents: 'none' }}>
          <rect
            x={measuredBox.x}
            y={measuredBox.y}
            width={measuredBox.width}
            height={measuredBox.height}
            fill="none"
            stroke="var(--blue-600)"
            strokeWidth={2}
            strokeDasharray="6 4"
            vectorEffect="non-scaling-stroke"
          />
          {measuredBox.width > 0 && (
            <DimensionLabel
              a={{ x: measuredBox.x, y: measuredBox.y }}
              b={{ x: measuredBox.x + measuredBox.width, y: measuredBox.y }}
              scale={scale}
              color="var(--blue-600)"
            />
          )}
          {measuredBox.height > 0 && (
            <DimensionLabel
              a={{ x: measuredBox.x, y: measuredBox.y }}
              b={{ x: measuredBox.x, y: measuredBox.y + measuredBox.height }}
              scale={scale}
              color="var(--blue-600)"
            />
          )}
        </g>
      )}
      {step === 'adjust' &&
        corners.map(({ corner, x, y, cursor }) => (
          <rect
            key={corner}
            x={x - handle / 2}
            y={y - handle / 2}
            width={handle}
            height={handle}
            rx={2 / scale}
            fill="#fff"
            stroke="var(--blue-600)"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            style={{ pointerEvents: mode === 'pointer' ? 'all' : 'none', cursor }}
            onMouseDown={(e) => startResize(e, corner)}
          />
        ))}
    </g>
  );
}
```

- [ ] **Step 3: Create `CalibrationHud.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react';
import type { Point } from '../../model/types';
import type { CalibrationAction, CalibrationSession } from '../../model/calibration';
import { measureUnderlay, parseFeetInches, type Rect } from '../../model/underlay';
import styles from './Calibration.module.css';

interface CalibrationHudProps {
  session: CalibrationSession;
  dispatch: (action: CalibrationAction) => void;
  worldToScreen: (p: Point) => { left: number; top: number };
  onDone: () => void;
  onCancel: () => void;
}

export function CalibrationHud({ session, dispatch, worldToScreen, onDone, onCancel }: CalibrationHudProps) {
  let instruction = 'Drag to move · drag corners to resize';
  if (session.step === 'measure') {
    instruction = session.pendingBox ? "Enter the box's real size" : 'Drag a box over a room whose size you know';
  }
  return (
    <>
      <div className={styles.bar}>
        <span className={styles.instruction}>{instruction}</span>
        {session.step === 'adjust' && (
          <button className={styles.btnGhost} onClick={() => dispatch({ type: 'MEASURE_AGAIN' })}>
            Measure again
          </button>
        )}
        <button className={styles.btnGhost} onClick={onCancel}>
          Cancel
        </button>
        <button className={styles.btnPrimary} onClick={onDone}>
          Done
        </button>
      </div>
      {session.pendingBox && (
        <MeasurePopover
          key={`${session.pendingBox.x},${session.pendingBox.y},${session.pendingBox.width},${session.pendingBox.height}`}
          session={session}
          box={session.pendingBox}
          position={worldToScreen({
            x: session.pendingBox.x + session.pendingBox.width,
            y: session.pendingBox.y + session.pendingBox.height,
          })}
          dispatch={dispatch}
        />
      )}
    </>
  );
}

function MeasurePopover({
  session,
  box,
  position,
  dispatch,
}: {
  session: CalibrationSession;
  box: Rect;
  position: { left: number; top: number };
  dispatch: (action: CalibrationAction) => void;
}) {
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [invalid, setInvalid] = useState<{ width: boolean; height: boolean }>({ width: false, height: false });
  const widthRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    widthRef.current?.focus();
  }, []);

  function apply() {
    const w = width.trim() ? parseFeetInches(width) : null;
    const h = height.trim() ? parseFeetInches(height) : null;
    const bad = { width: !!width.trim() && w === null, height: !!height.trim() && h === null };
    setInvalid(bad);
    if (bad.width || bad.height) {
      setError('Use a size like 8\'6", 8.5 or 8ft 6in');
      return;
    }
    if (w === null && h === null) {
      setError('Enter a width, a height, or both');
      return;
    }
    if (!session.draft || !measureUnderlay(session.draft, session.natural, box, { width: w, height: h })) {
      setError('That side of the box has no length — draw a bigger box');
      return;
    }
    dispatch({ type: 'APPLY_MEASURE', real: { width: w, height: h } });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') apply();
    if (e.key === 'Escape') {
      e.stopPropagation();
      dispatch({ type: 'SET_PENDING_BOX', box: null });
    }
  }

  return (
    <div
      className={styles.popover}
      style={{ left: position.left + 8, top: position.top + 8 }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className={styles.fields}>
        <div className={styles.field}>
          <label htmlFor="measure-width">Width</label>
          <input
            id="measure-width"
            ref={widthRef}
            className={invalid.width ? styles.invalid : undefined}
            placeholder={`8'6"`}
            value={width}
            onChange={(e) => setWidth(e.target.value)}
            onKeyDown={onKeyDown}
          />
        </div>
        <span className={styles.times}>×</span>
        <div className={styles.field}>
          <label htmlFor="measure-height">Height</label>
          <input
            id="measure-height"
            className={invalid.height ? styles.invalid : undefined}
            placeholder={`12'4"`}
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            onKeyDown={onKeyDown}
          />
        </div>
      </div>
      {error && <div className={styles.error}>{error}</div>}
      <div className={styles.actions}>
        <button className={styles.btnGhost} onClick={() => dispatch({ type: 'SET_PENDING_BOX', box: null })}>
          Cancel
        </button>
        <button className={styles.btnPrimary} onClick={apply}>
          Apply
        </button>
      </div>
    </div>
  );
}
```

Note: the CSS uses `.field input.invalid`; with CSS modules the `invalid` class is `styles.invalid` (as written above).

- [ ] **Step 4: Integrate into `Canvas`**

In `src/components/Canvas.tsx`:

1. Imports:

```ts
import type { CalibrationAction, CalibrationSession } from '../model/calibration';
import { CalibrationOverlay } from './calibration/CalibrationOverlay';
import { CalibrationHud } from './calibration/CalibrationHud';
```

2. Add to `CanvasProps` and destructure:

```ts
  calibration: {
    session: CalibrationSession;
    dispatch: (action: CalibrationAction) => void;
    onDone: () => void;
    onCancel: () => void;
  } | null;
```

3. Clear editing state when calibration starts — next to the existing `useEffect(…, [mode])`:

```ts
  const calibrating = calibration !== null;
  useEffect(() => {
    if (!calibrating) return;
    setDrawingPoints(null);
    setSelectedFurnitureId(null);
    setSelectedWallId(null);
  }, [calibrating]);
```

4. Guard normal editing while calibrating:
   - In the keydown effect's Delete/Backspace branch, add `if (calibrating) return;` as its first line, and add `calibrating` to that effect's dependency array.
   - `handleSvgClick`: after the `suppressClickRef` block, add `if (calibrating) return;`.
   - `handleSvgMouseUp`: change the first line to `if (!draggingTemplate || calibrating) return;`.
   - `showGhost`: `const showGhost = mode === 'pointer' && !dragCtx && !calibrating && hoverPoint;`

5. Add a `worldToScreen` helper next to `toWorld`:

```ts
  function worldToScreen(p: Point): { left: number; top: number } {
    return { left: (p.x - view.x) * view.scale, top: (p.y - view.y) * view.scale };
  }
```

6. Image rendering: replace the line added in Task 5 with:

```tsx
          {calibration?.session.draft ? (
            <UnderlayImage src={calibration.session.src} underlay={calibration.session.draft} opacity={1} />
          ) : (
            !calibration &&
            underlay && <UnderlayImage src={underlay.src} underlay={underlay.rect} opacity={LOCKED_UNDERLAY_OPACITY} />
          )}
```

7. As the **last child of `<svg>`** (after the furniture `<g>` and anything else currently last), add:

```tsx
          {calibration && (
            <CalibrationOverlay
              session={calibration.session}
              dispatch={calibration.dispatch}
              viewRect={{ x: view.x, y: view.y, width: vw, height: vh }}
              scale={view.scale}
              mode={mode}
              toWorld={toWorld}
            />
          )}
```

8. After the closing `</svg>` / `{size.width > 0 && …}` block, still inside the `.wrap` div, add:

```tsx
      {calibration && (
        <CalibrationHud
          session={calibration.session}
          dispatch={calibration.dispatch}
          worldToScreen={worldToScreen}
          onDone={calibration.onDone}
          onCancel={calibration.onCancel}
        />
      )}
```

`viewRect` is a new object each render; `CalibrationOverlay`'s fit effect only acts while `draft` is null, so it dispatches exactly once.

9. In `App.tsx`, pass `calibration={null}` to `<Canvas>` for now so it typechecks (Task 7 wires it for real).

- [ ] **Step 5: Lint, typecheck, test**

Run: `bun run test && bun run lint && bun run build`
Expected: pass. (Behavior is exercised in Task 7, which provides entry points.)

- [ ] **Step 6: Commit**

```bash
git add src/components/calibration src/components/Canvas.tsx src/App.tsx
git commit -m "Add calibration overlay and HUD to the canvas"
```

---

### Task 7: Toolbar image button and calibration wiring in App

**Files:**
- Create: `src/components/UnderlayButton.tsx`
- Create: `src/components/UnderlayButton.module.css`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `calibrationReducer` (Task 4); `importImageFile`, `loadImageSize` (Task 5); `store.underlayImage`, `store.setUnderlayImage`, `store.setUnderlay` (Task 3); `Canvas` `calibration` prop (Task 6).
- Produces:
  - `<UnderlayButton hasImage: boolean; disabled: boolean; onAddFile(file: File); onRecalibrate(); onReplaceFile(file: File); onRemove() />`
  - In `App`: `startCalibrationFromFile(planId: string, file: File, restore: CalibrationRestore): Promise<string | null>` (returns an error message, or null on success) — reused by Task 8.

- [ ] **Step 1: Create `UnderlayButton.module.css`**

```css
.wrap {
  position: relative;
}

.menu {
  position: absolute;
  top: 40px;
  right: 0;
  background: #fff;
  border: 1px solid var(--paper-grid-major);
  border-radius: 10px;
  box-shadow: var(--shadow-hover);
  min-width: 150px;
  z-index: 92;
  overflow: hidden;
}

.menu button {
  display: block;
  width: 100%;
  text-align: left;
  border: none;
  background: none;
  padding: 9px 12px;
  font-size: 13px;
  cursor: pointer;
  color: var(--ink);
}

.menu button:hover {
  background: var(--blue-50);
}

.danger {
  color: var(--danger);
}

.fileInput {
  display: none;
}
```

- [ ] **Step 2: Create `UnderlayButton.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react';
import styles from './UnderlayButton.module.css';

interface UnderlayButtonProps {
  hasImage: boolean;
  disabled: boolean;
  onAddFile: (file: File) => void;
  onRecalibrate: () => void;
  onReplaceFile: (file: File) => void;
  onRemove: () => void;
}

export function UnderlayButton({ hasImage, disabled, onAddFile, onRecalibrate, onReplaceFile, onRemove }: UnderlayButtonProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const purposeRef = useRef<'add' | 'replace'>('add');

  useEffect(() => {
    if (!menuOpen) return;
    function onDocMouseDown(e: MouseEvent) {
      if (!(e.target as HTMLElement | null)?.closest('[data-underlay-menu]')) setMenuOpen(false);
    }
    window.addEventListener('mousedown', onDocMouseDown);
    return () => window.removeEventListener('mousedown', onDocMouseDown);
  }, [menuOpen]);

  function pick(purpose: 'add' | 'replace') {
    purposeRef.current = purpose;
    setMenuOpen(false);
    fileRef.current?.click();
  }

  const label = hasImage ? 'Floor plan image' : 'Add floor plan image';

  return (
    <div className={styles.wrap} data-underlay-menu>
      <button
        className={menuOpen ? 'iconButton active' : 'iconButton'}
        disabled={disabled}
        aria-label={label}
        title={label}
        onClick={() => (hasImage ? setMenuOpen((o) => !o) : pick('add'))}
      >
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="9" cy="10" r="1.6" />
          <path d="M21 16l-5-5-8 8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {menuOpen && (
        <div className={styles.menu}>
          <button
            onClick={() => {
              setMenuOpen(false);
              onRecalibrate();
            }}
          >
            Recalibrate
          </button>
          <button onClick={() => pick('replace')}>Replace image</button>
          <button
            className={styles.danger}
            onClick={() => {
              setMenuOpen(false);
              onRemove();
            }}
          >
            Remove image
          </button>
        </div>
      )}
      <input
        ref={fileRef}
        className={styles.fileInput}
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          if (purposeRef.current === 'replace') onReplaceFile(file);
          else onAddFile(file);
        }}
      />
    </div>
  );
}
```

- [ ] **Step 3: Wire calibration into `App.tsx`**

1. Imports:

```ts
import { useEffect, useReducer, useRef, useState } from 'react';
import { calibrationReducer, type CalibrationRestore } from './model/calibration';
import { importImageFile, loadImageSize } from './model/imageImport';
import { UnderlayButton } from './components/UnderlayButton';
```

(This replaces the existing `react` import line.)

At module scope, above `function App()`:

```ts
const STORAGE_FULL = 'Not enough browser storage for this image';
const NOT_AN_IMAGE = "That file isn't an image this browser can read";
```

2. State, after the other `useState`s:

```ts
  const [calibration, dispatchCalibration] = useReducer(calibrationReducer, null);
  const calibrating = calibration !== null;
```

3. Handlers inside `App`:

```ts
  async function startCalibrationFromFile(planId: string, file: File, restore: CalibrationRestore): Promise<string | null> {
    let imported;
    try {
      imported = await importImageFile(file);
    } catch {
      return NOT_AN_IMAGE;
    }
    if (!store.setUnderlayImage(planId, imported.dataUrl)) return STORAGE_FULL;
    dispatchCalibration({ type: 'START', planId, src: imported.dataUrl, natural: imported.size, draft: null, restore });
    return null;
  }

  function currentRestore(): CalibrationRestore {
    return { src: store.underlayImage, underlay: store.activePlanMeta?.underlay };
  }

  async function handleAddOrReplaceFile(file: File) {
    if (!store.activePlanId) return;
    const error = await startCalibrationFromFile(store.activePlanId, file, currentRestore());
    if (error) window.alert(error);
  }

  async function handleRecalibrate() {
    const planId = store.activePlanId;
    const src = store.underlayImage;
    const underlay = store.activePlanMeta?.underlay;
    if (!planId || !src || !underlay) return;
    let natural;
    try {
      natural = await loadImageSize(src);
    } catch {
      return;
    }
    dispatchCalibration({ type: 'START', planId, src, natural, draft: underlay, restore: { src, underlay } });
  }

  function handleRemoveImage() {
    const planId = store.activePlanId;
    if (!planId || !window.confirm('Remove the floor plan image? This can’t be undone.')) return;
    store.setUnderlay(planId, undefined);
    store.setUnderlayImage(planId, null);
  }

  function handleCalibrationDone() {
    if (!calibration) return;
    if (calibration.draft) store.setUnderlay(calibration.planId, calibration.draft);
    dispatchCalibration({ type: 'END' });
  }

  function handleCalibrationCancel() {
    if (!calibration) return;
    const { planId, src, restore } = calibration;
    if (restore.src === null) store.setUnderlayImage(planId, null);
    else if (restore.src !== src) store.setUnderlayImage(planId, restore.src);
    dispatchCalibration({ type: 'END' });
  }
```

`store.setUnderlay` is never called during a session, so the plan's saved underlay is still `restore.underlay` on Cancel — nothing to restore there.

4. Block conflicting actions while calibrating:
   - Undo/redo keydown effect: add `if (calibrating) return;` before `e.preventDefault()`, and add `calibrating` to its dependency array.
   - Floor Plans (hamburger) button: add `disabled={calibrating}`.
   - Undo button: `disabled={!store.canUndo || calibrating}`; Redo: `disabled={!store.canRedo || calibrating}`.
   - `FurniturePanel` `onStartDrag`: `if (calibrating) return;` before `e.preventDefault()`.

5. Toolbar: insert the button right before the existing `<div className="toolbarDivider" />`:

```tsx
        <UnderlayButton
          hasImage={!!(store.underlayImage && store.activePlanMeta?.underlay)}
          disabled={calibrating}
          onAddFile={handleAddOrReplaceFile}
          onRecalibrate={handleRecalibrate}
          onReplaceFile={handleAddOrReplaceFile}
          onRemove={handleRemoveImage}
        />
```

6. Replace `calibration={null}` on `<Canvas>` with:

```tsx
          calibration={
            calibration
              ? {
                  session: calibration,
                  dispatch: dispatchCalibration,
                  onDone: handleCalibrationDone,
                  onCancel: handleCalibrationCancel,
                }
              : null
          }
```

`dispatchCalibration` from `useReducer` is stable, so `CalibrationOverlay`'s effects don't re-fire on every render.

- [ ] **Step 4: Verify in the browser**

The preview browser's native file picker can't be driven, so feed a `File` to the hidden input from `javascript_tool`. Copy the user's sample listing image into `public/` temporarily — **do not commit it**:

```bash
cp /private/tmp/claude-501/-Users-cody-workspace/8d787393-f5fa-4ed5-b331-4ea001aaf480/images/1.png public/__sample.png
```

Then in the page:

```js
const blob = await (await fetch('/__sample.png')).blob();
const file = new File([blob], 'plan.png', { type: 'image/png' });
const input = document.querySelector('input[type=file]');
const dt = new DataTransfer(); dt.items.add(file); input.files = dt.files;
input.dispatchEvent(new Event('change', { bubbles: true }));
```

Check, with screenshots:
1. Image appears at full opacity, fit to view; bar reads "Drag a box over a room whose size you know".
2. Drag a box over the kitchen; popover opens; type `8'6"` × `12'4"`; Apply → image rescales, dashed box shows labels ≈ 8'-6" / 12'-4", top-left on a grid line; bar shows Measure again.
3. Drag the image; drag a corner — aspect stays locked.
4. Done → image locks at ~55% opacity under the grid; furniture drag-and-drop and wall drawing work over it.
5. Image button → Recalibrate → Cancel → placement unchanged.
6. Replace image → Cancel → old image back.
7. Remove image → confirm → gone; button title is "Add floor plan image".
8. Garbage in the popover (`abc`) → red field + message; height-only on a flat line → "That side of the box has no length…".

Delete `public/__sample.png` afterwards.

- [ ] **Step 5: Lint, typecheck, test, commit**

Run: `bun run test && bun run lint && bun run build`

```bash
git add src/components/UnderlayButton.tsx src/components/UnderlayButton.module.css src/App.tsx
git commit -m "Add toolbar image button with recalibrate, replace and remove"
```

---

### Task 8: New-plan modal

**Files:**
- Create: `src/components/NewPlanModal.tsx`
- Create: `src/components/NewPlanModal.module.css`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `store.createPlan(name, imageDataUrl?)` (Task 3); `importImageFile` (Task 5); `calibrationReducer` START (Task 4).
- Produces: `<NewPlanModal onCreateManual(name: string); onUpload(name: string, file: File): Promise<string | null>; onCancel() />` — `onUpload` resolves to an error message (modal stays open, shows it on the upload card) or `null` (App closes the modal).

- [ ] **Step 1: Create `NewPlanModal.module.css`**

```css
.scrim {
  position: fixed;
  inset: 0;
  background: rgba(20, 30, 50, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.panel {
  position: relative;
  width: 600px;
  max-width: 94vw;
  background: #fff;
  border-radius: 16px;
  box-shadow: var(--shadow-hover);
  padding: 36px 32px 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 28px;
}

.close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--ink-soft);
  font-size: 18px;
  cursor: pointer;
}

.close:hover {
  background: var(--blue-50);
  color: var(--ink);
}

.title {
  width: 70%;
  text-align: center;
  font-size: 18px;
  font-weight: 600;
  color: var(--ink);
  border: 1px solid var(--paper-grid-major);
  border-radius: 10px;
  padding: 10px 12px;
  background: var(--blue-50);
}

.title:focus {
  outline: none;
  border-color: var(--blue-500);
  background: #fff;
}

.choices {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  width: 100%;
}

.card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 180px;
  padding: 20px;
  border: 1px solid var(--blue-200);
  border-radius: 14px;
  background: var(--blue-50);
  color: var(--ink);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.15s, border-color 0.15s;
}

.card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-card-hover);
  border-color: var(--blue-400);
}

.card svg {
  color: var(--blue-600);
}

.dropActive {
  border-color: var(--blue-500);
  border-style: dashed;
  background: var(--blue-100);
}

.hint {
  font-size: 12px;
  font-weight: 400;
  color: var(--ink-soft);
}

.error {
  font-size: 12px;
  font-weight: 500;
  color: var(--danger);
  text-align: center;
}

.fileInput {
  display: none;
}

@media (max-width: 520px) {
  .choices {
    grid-template-columns: 1fr;
  }
  .title {
    width: 100%;
  }
}
```

- [ ] **Step 2: Create `NewPlanModal.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react';
import styles from './NewPlanModal.module.css';

export const DEFAULT_PLAN_NAME = 'Untitled Floor Plan';

interface NewPlanModalProps {
  onCreateManual: (name: string) => void;
  onUpload: (name: string, file: File) => Promise<string | null>;
  onCancel: () => void;
}

export function NewPlanModal({ onCreateManual, onUpload, onCancel }: NewPlanModalProps) {
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const titleRef = useRef<HTMLInputElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const name = title.trim() || DEFAULT_PLAN_NAME;

  async function upload(file: File) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const message = await onUpload(name, file);
    setBusy(false);
    if (message) setError(message);
  }

  // Keep the latest upload() reachable from the window-level listeners.
  const uploadRef = useRef(upload);
  uploadRef.current = upload;

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    function onPaste(e: ClipboardEvent) {
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'));
      if (!file) return; // plain-text paste into the title field proceeds normally
      e.preventDefault();
      void uploadRef.current(file);
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('paste', onPaste);
    };
  }, [onCancel]);

  return (
    <div className={styles.scrim} onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className={styles.panel} role="dialog" aria-label="New floor plan">
        <button className={styles.close} onClick={onCancel} aria-label="Close" title="Close">
          ×
        </button>
        <input
          ref={titleRef}
          className={styles.title}
          placeholder={DEFAULT_PLAN_NAME}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onCreateManual(name)}
        />
        <div className={styles.choices}>
          <button className={styles.card} onClick={() => onCreateManual(name)}>
            <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
              <path d="M4 20V4h9v6h7v10H4z" strokeLinejoin="round" />
              <path d="M13 4l7 6" strokeLinecap="round" />
            </svg>
            Manually create floor plan
          </button>
          <button
            className={`${styles.card} ${dropActive ? styles.dropActive : ''}`}
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDropActive(true);
            }}
            onDragLeave={() => setDropActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDropActive(false);
              const file = e.dataTransfer.files[0];
              if (file) void upload(file);
            }}
          >
            <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <circle cx="9" cy="10" r="1.6" />
              <path d="M21 16l-5-5-8 8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Upload floor plan image
            <span className={styles.hint}>Click, drop, or paste</span>
            {error && <span className={styles.error}>{error}</span>}
          </button>
        </div>
        <input
          ref={fileRef}
          className={styles.fileInput}
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void upload(file);
          }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire into `App.tsx`**

1. Import: `import { DEFAULT_PLAN_NAME, NewPlanModal } from './components/NewPlanModal';`
2. State: `const [newPlanOpen, setNewPlanOpen] = useState(false);`
3. Remove the now-unused "focus the header name on a new plan" mechanism: delete `focusNameOnNextPlan` and the `useEffect` that reads it. (Header rename by clicking the name stays.)
4. Replace the literal in the first-launch effect with `store.createPlan(DEFAULT_PLAN_NAME);`.
5. Change `PlansDrawer`'s `onNewPlan` to:

```tsx
        onNewPlan={() => {
          setDrawerOpen(false);
          setNewPlanOpen(true);
        }}
```

6. Handlers:

```ts
  function handleCreateManual(name: string) {
    store.createPlan(name);
    setNewPlanOpen(false);
  }

  async function handleUploadNewPlan(name: string, file: File): Promise<string | null> {
    let imported;
    try {
      imported = await importImageFile(file);
    } catch {
      return NOT_AN_IMAGE;
    }
    const plan = store.createPlan(name, imported.dataUrl);
    if (!plan) return STORAGE_FULL;
    dispatchCalibration({
      type: 'START',
      planId: plan.id,
      src: imported.dataUrl,
      natural: imported.size,
      draft: null,
      restore: { src: null, underlay: undefined },
    });
    setNewPlanOpen(false);
    return null;
  }
```

(This duplicates the import/error mapping of `startCalibrationFromFile` deliberately: here the image must be stored by `createPlan` *before* the plan exists, so no plan is created on quota failure.)

7. Render, next to the furniture editor modal:

```tsx
      {newPlanOpen && (
        <NewPlanModal
          onCreateManual={handleCreateManual}
          onUpload={handleUploadNewPlan}
          onCancel={() => setNewPlanOpen(false)}
        />
      )}
```

`onCancel` is a new arrow each render, which re-subscribes the modal's window listeners — harmless.

- [ ] **Step 4: Verify in the browser**

With `public/__sample.png` present again (temporary, uncommitted):

1. Drawer → New → modal shows centered title (focused, placeholder "Untitled Floor Plan") and two cards. Screenshot.
2. Esc, backdrop click, × each close it with no new plan in the drawer.
3. Type "Manual test" → Manually create → plan "Manual test" active, blank, header shows the name.
4. New → leave title empty → upload via `javascript_tool` (same hidden-input trick, selecting the modal's `input[type=file]`) → plan "Untitled Floor Plan" created, calibration bar visible.
5. Cancel on that calibration → plan remains, no image; `localStorage` has no `apartment-planner:underlay:<thatId>` key.
6. New → upload a non-image `File` (`new File(['hello'], 'a.txt', { type: 'text/plain' })`) → inline error on the upload card, modal stays open.
7. Paste: dispatch a `ClipboardEvent('paste')` with a `DataTransfer` holding the image file → starts calibration.
8. Quota: in `javascript_tool`, temporarily patch `Storage.prototype.setItem` to throw for keys starting with `apartment-planner:underlay:` → upload → card shows "Not enough browser storage for this image"; drawer has no new plan. Restore the original `setItem`.
9. Reload mid-calibration on a fresh upload → plan shows no image; toolbar image button title is "Add floor plan image".
10. Mobile width (`resize_window` preset `mobile`): cards stack, no horizontal scroll. Reset to `desktop`.

Delete `public/__sample.png`.

- [ ] **Step 5: Lint, typecheck, test, commit**

Run: `bun run test && bun run lint && bun run build`

```bash
git add src/components/NewPlanModal.tsx src/components/NewPlanModal.module.css src/App.tsx
git commit -m "Add new-plan modal with manual and image-upload choices"
```

---

### Task 9: End-to-end pass with the real listing image

**Files:** none expected; fix-ups only if issues are found (commit each fix separately).

- [ ] **Step 1: Full flow with the sample listing**

With the sample at `public/__sample.png` (temporary): New → title "Apartment 225" → upload → measure the kitchen box with `8'6"` × `12'4"` → Apply → fine-tune → Done. Then drag two furniture items onto the living room and rotate one. Screenshot the result.

Expected: the kitchen's dashed box labels read 8'-6" and 12'-4"; the living room (printed 9'0" × 16'7") measures close to that against the grid; furniture renders opaque above the faded image.

- [ ] **Step 2: Persistence**

Reload. Expected: same plan, image locked at the same place and scale, furniture intact. Switch to another plan and back — image follows its plan only. Delete the plan from the drawer → its `apartment-planner:underlay:<id>` key is gone.

- [ ] **Step 3: Undo isolation**

On the image plan: move a furniture item, then Recalibrate → move image → Done → ⌘Z. Expected: only the furniture move is undone; the image placement stays.

- [ ] **Step 4: Final checks and cleanup**

Run: `bun run test && bun run lint && bun run build`
Delete `public/__sample.png`; `git status` must show no stray files.
