# Layout Planner

A web version of drawing your new apartment's floor plan on graph paper and cutting out tiny to-scale versions of furniture to see how they'll fit.

## Original product plan

**Purpose:** A web version of drawing your new apartment's floor plan on graph paper and cutting out tiny to-scale versions of furniture to see how they'll fit.

**Features:**

- Create a floor plan by clicking to place wall vertices, snapped to a grid (1ft major lines, 6in sub-lines at higher zoom)
- No separate modes — one continuous canvas. A wall tool draws walls; a pointer/select tool selects and moves anything (furniture or wall vertices) and shows the rotate handle on selected furniture. The furniture panel is always active.
- Toolbar is icon-only (no text labels, no hint text) — undo/redo included
- Create furniture in an independent modal editor: name field (placeholder "Couch"), same drawing tools as the main canvas, Save/Cancel — furniture is a shared library, reused across all plans
- Furniture panel (right sidebar) lists saved items as cards: rounded corners, soft blue/white theme, name below, kebab menu (edit/delete/duplicate), bouncy hover-lift, hand cursor on hover
- Drag-and-drop furniture from the panel onto the floor plan; click-and-drag a placed item to move it
- Rotate furniture via a drag handle, snapping every 45°
- Manage multiple named floor plans via a left-side slide-out drawer: plans listed vertically, a "New" button at the top, rename/delete via kebab menu
- Scroll-wheel zoom is scoped to the canvas, not the page
- Undo/redo for edits
- Walls have zero-thickness geometry (no area impact) but render with a visible stroke

**Technical notes:**

- Data persists in localStorage (plans + furniture library)
- Built with React + TypeScript + Vite, deployed to GitHub Pages as a standard static site

**Not in v1 (later phases):** doors/windows, image-to-floorplan import, JSON export/import, 3D view.

*(Note: the tool has since evolved past this original plan in several ways — e.g. the "two modes" and "45° rotation" described above were later changed. This section is kept as-written for reference.)*
