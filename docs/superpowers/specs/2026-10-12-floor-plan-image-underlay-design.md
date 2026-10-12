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
- After an image is chosen it is processed (see §4 Import) and the same modal grows into the calibration step (§2). **Back** returns to the choice cards with the title kept. The plan is only created on **Save**.
- A non-image or unreadable file shows an inline error on the upload card; the modal stays open.
- Esc, backdrop click, or × closes the modal without creating a plan.
- Visual style matches the existing furniture editor modal.
- With zero plans (first launch, or after deleting the last plan) the modal is the empty state: it opens automatically and can't be dismissed (no ×, Esc or backdrop close). No plan is ever auto-created.

## 2. Calibration (in a modal)

Calibration is its own modal step, never a mode on the main canvas. It is reached from the new-plan modal (Upload) or opened directly from the toolbar (Add, Replace, Recalibrate).

- **Header:** "Outline an area with a labeled length and width on the uploaded floor plan", with a small hint: drag to outline · scroll to zoom · hold Space and drag to pan.
- **Body:** the image, fit to the panel. Wheel zooms around the cursor; middle-drag or Space-drag pans. A left-drag outlines an area (solid blue outline, light fill); drawing again replaces it. Outlines under 6 screen px in both directions are ignored.
- **Footer:** Width ↔ and Height ↕ rows, each `[ ] ft [ ] in` (digits only, blank counts as 0, inches 0–11); one side is enough. A status line guides the next step or shows errors. **Cancel** (or **Back** in the new-plan modal) and **Save**, enabled once there is an outline and a size.
- **Live preview:** once a size is entered, a 1 ft grid is drawn over the image starting at the outline's corner, so the scale can be checked before saving.
- **Save:** feet-per-pixel comes from the entered side(s) (averaged when both are given). The image is placed so the outlined area's top-left lands on a grid line — at the origin for a new or replaced image, or where that area already was when recalibrating (so furniture stays put). The plan then opens with the image locked and the view zoomed to fit it.
- **Cancel / Esc:** closes without changing anything.
- There is no drag-to-position or resize afterwards; users are assumed to measure accurately. To change the scale, Recalibrate.

## 3. Locked image and toolbar

**Rendering**

- Draw order (bottom → top): image, grid, walls, furniture, overlays.
- The locked image renders at ~55% opacity so furniture outlines read clearly; the grid stays visible over the image's white background.
- A locked image has `pointer-events: none`; all existing interactions (select, drag furniture, wall tool, rotate) work unchanged.

**Toolbar image button** (icon-only, placed next to undo/redo)

- Plan has no image: click → file picker → calibration modal. Works for existing plans, including manually drawn ones.
- Plan has an image: click → small menu:
  - **Recalibrate** — opens the calibration modal for the current image.
  - **Replace image** — file picker → calibration modal for the new image; Cancel keeps the old image.
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
  - Nothing is written until **Save**, so a reload or Cancel mid-calibration leaves the plan as it was. A quota error on Save shows in the calibration status line and keeps the modal open; no plan is created and an existing image is untouched.
- Deleting a plan also removes its image key.
- A plan with `underlay` but no stored image (key missing or unreadable) renders as having no image; the toolbar offers **Add floor plan image**.

## 5. Testing

- Add **Vitest** as a dev dependency with a `test` script.
- Unit tests for pure logic:
  - Feet + inches combination (blank fields, inches range, zero length, non-digits).
  - Box → scale computation (one dimension, both dimensions, averaging).
  - Placement: the outlined area's top-left snaps to the grid line nearest its anchor; view fitting.
  - Underlay storage round-trip and cleanup on plan delete (localStorage stubbed via jsdom/happy-dom).
- UI (modals, calibration step, toolbar menu, locked-image pass-through) is verified in the browser preview against the sample listing image.

## Out of scope

- Multiple images per plan, rotating the image, non-uniform scaling, manual resize handles.
- Paste/drop onto the main canvas.
- Moving image storage to IndexedDB.
- Automatic dimension detection (OCR) from the image.
