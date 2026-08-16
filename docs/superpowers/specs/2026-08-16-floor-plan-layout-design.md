# Floor Plan Layout

**Purpose:** A web version of drawing your new apartment's floor plan on graph paper and cutting out tiny to-scale versions of furniture to see how they'll fit.

**Features:**

- Create a floor plan by clicking to place wall vertices, snapped to a grid (1ft major lines, 6in sub-lines at higher zoom)
- Two modes: **Layout** (draw/edit walls) and **Furnish** (place/arrange furniture); switching modes changes the toolbar and locks the walls in Furnish
- Create furniture in an independent modal editor: name field (placeholder "Couch"), same drawing tools as Layout mode, Save/Cancel — furniture is a shared library, reused across all plans
- Furniture panel (right sidebar) lists saved items as cards: rounded corners, soft blue/white theme, name below, kebab menu (edit/delete/duplicate), bouncy hover-lift, hand cursor
- Drag-and-drop furniture from the panel onto the floor plan
- Select and move furniture with a pointer tool
- Rotate furniture via a drag handle, snapping every 45°
- Manage multiple named floor plans via a "My Plans" overlay: open, rename, delete (kebab menu), create new
- Undo/redo for edits
- Walls have zero-thickness geometry (no area impact) but render with a visible stroke

**Technical notes:**

- Data persists in localStorage (plans + furniture library)
- Built with React + TypeScript + Vite, deployed to GitHub Pages as a standard static site

**Not in v1 (later phases):** doors/windows, image-to-floorplan import, JSON export/import, 3D view.
