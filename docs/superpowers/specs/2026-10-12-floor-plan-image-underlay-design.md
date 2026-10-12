# Floor Plan Image Underlay

**Purpose:** Let a user drop a floor-plan image from a real-estate listing onto a plan, calibrate it to the app's grid using a room of known size, lock it, and place furniture on top — no manual wall drawing required.

## Understanding

**Stated by the user**

- Add a floor-plan image (e.g. a listing PNG, ~40 KB) as the background of a plan.
- Calibrate its scale against the app's grid using a room or item whose size is known (most listing images print room dimensions).
- Once calibrated, the image is locked and saved; furniture is placed on top.
- Drawing walls is unnecessary when an image is present.
- Keep storage in localStorage; images are small and only need structural detail.
- Later: support images without printed dimensions (the measure step below already covers this by measuring a standard-size item such as a 3 ft door).

**Assumptions (confirmed during design)**

- One image per plan.
- Uniform scale — the image is never stretched on one axis.
- Walls remain available and optional; a plan may have an image, walls, both, or neither.
- The image is not part of undo/redo; calibration has its own Cancel.

## 1. New-plan modal

- The plans drawer's **New** button opens a modal instead of creating a plan immediately.
- A centered title text field at the top, autofocused, placeholder "Untitled Floor Plan". An empty title falls back to "Untitled Floor Plan".
- Below it, two large side-by-side cards:
  - **Manually create floor plan** (left) — creates a blank plan, identical to today's behavior.
  - **Upload floor plan image** (right) — clicking opens a file picker. Dropping an image file onto the card, or pasting an image with ⌘V while the modal is open, does the same.
- After an image is chosen: it is processed (see §4 Import), the plan is created with the given title, the modal closes, and calibration mode starts.
- A non-image or unreadable file shows an inline error on the upload card; the modal stays open.
- Esc, backdrop click, or × closes the modal without creating a plan.
- Visual style matches the existing furniture editor modal.
- First launch (zero plans) keeps today's behavior: a blank "Untitled Floor Plan" is created silently, with no modal.

## 2. Calibration mode

**Entering**

- The image is placed centered in the current view, sized to fit the visible area, at full opacity and unlocked.
- A calibration bar appears across the top of the canvas showing the current step's instruction plus **Cancel** and **Done** buttons.
- Furniture and walls remain visible but are non-interactive. Zoom and pan keep working. Undo/redo are disabled.

**Step 1 — Measure**

- The user drags a dashed box over a region of the image with a known size.
- On release, a small popover anchored to the box asks for **width × height**.
  - Each dimension is a row with two numeric fields, `[ 8 ] ft [ 6 ] in` — feet and inches, never decimals or typed `'`/`"` symbols. Fields accept digits only; a blank field counts as 0; inches must be 0–11.
  - Either field may be left empty; one dimension is enough (covers measuring a single door or tub). At least one is required to apply.
  - Invalid input (inches ≥ 12, or a zero length) highlights that row and names the problem.
- **Apply** computes feet-per-image-pixel from the entered dimension(s):
  - One dimension: `scale = realFt / boxImagePx` along that axis.
  - Both: the average of the two per-axis scales.
- After scaling, the image is translated so the measured box's top-left corner lands on the nearest 1 ft grid intersection.
- Dragging a new box at any time re-measures and replaces the previous result.

**Step 2 — Fine-tune**

- Dragging the image (outside the measure gesture) moves it freely, no snapping.
- Corner handles resize it with aspect ratio locked, anchored at the opposite corner.

How measure vs. move is distinguished: before the first Apply, a drag on the image draws a measure box. After Apply, a drag on the image moves it, and the calibration bar offers a **Measure again** button that returns to the measure gesture.

**Exiting**

- **Done** saves the underlay and locks it.
- **Cancel** restores the underlay as it was before entering calibration. For a brand-new upload (no previous underlay), Cancel removes the image and its stored data, leaving a blank plan. For **Replace image**, Cancel restores the old image and its calibration.

## 3. Locked image and toolbar

**Rendering**

- Draw order (bottom → top): image, grid, walls, furniture, overlays.
- The locked image renders at ~55% opacity so furniture outlines read clearly; the grid stays visible over the image's white background.
- A locked image has `pointer-events: none`; all existing interactions (select, drag furniture, wall tool, rotate) work unchanged.

**Toolbar image button** (icon-only, placed next to undo/redo)

- Plan has no image: click → file picker → calibration mode. Works for existing plans, including manually drawn ones.
- Plan has an image: click → small menu:
  - **Recalibrate** — enter calibration mode with the current image and placement.
  - **Replace image** — file picker → calibration mode with the new image; Cancel keeps the old image.
  - **Remove image** — confirmation prompt (not undoable), then removes the underlay and its stored data.
- Paste and drop are only supported in the new-plan modal; on an existing plan, the toolbar button is the entry point.

## 4. Storage, import, edge cases

**Data model**

```ts
interface Underlay {
  x: number;       // world feet, image top-left
  y: number;       // world feet, image top-left
  widthFt: number; // rendered width in feet; height = widthFt * naturalH / naturalW
}

interface FloorPlan {
  // ...existing fields
  underlay?: Underlay;
}
```

- `underlay` lives on `FloorPlan` (saved with the plans list) but **not** in `PlanState`, so undo/redo history is unaffected.
- The image itself is stored as a data URL under its own localStorage key, `apartment-planner:underlay:<planId>`, so furniture/wall edits never re-serialize image data.
- Image natural dimensions are read when the image loads; they are not stored.

**Import**

- Accept any file with an `image/*` MIME type the browser can decode.
- If the longest side is ≤ 2000 px, store the original file as a data URL unchanged.
- Otherwise, downscale on an offscreen canvas so the longest side is 2000 px and encode as PNG (keeps line drawings crisp and small).

**Edge cases**

- Writing the image key is wrapped in try/catch; a quota error shows "Not enough browser storage for this image".
  - New plan from the modal: the image is written when the plan is created, so a quota error creates no plan.
  - Add/Replace on an existing plan: the new image is only written on **Done**, so the stored image always matches the stored placement (a reload mid-calibration keeps the old image). A quota error on Done keeps the user in calibration with the old image intact.
- Deleting a plan also removes its image key.
- A plan with `underlay` but no stored image (key missing or unreadable) renders as having no image; the toolbar offers **Add floor plan image**.

## 5. Testing

- Add **Vitest** as a dev dependency with a `test` script.
- Unit tests for pure logic:
  - Feet + inches combination (blank fields, inches range, zero length, non-digits).
  - Box → scale computation (one dimension, both dimensions, averaging).
  - Grid snapping of the measured box's top-left.
  - Underlay storage round-trip and cleanup on plan delete (localStorage stubbed via jsdom/happy-dom).
- UI (modal, calibration flow, toolbar menu, locked-image pass-through) is verified in the browser preview against the sample listing image.

## Out of scope

- Multiple images per plan, rotating the image, non-uniform scaling.
- Paste/drop onto the main canvas.
- Moving image storage to IndexedDB.
- Automatic dimension detection (OCR) from the image.
