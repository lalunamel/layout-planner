export interface Point {
  x: number;
  y: number;
}

export interface Wall {
  id: string;
  a: Point;
  b: Point;
}

/** A reusable piece of furniture. `points` is a closed polygon in local
 * space (feet), with (0,0) as its own origin — not tied to any plan. */
export interface FurnitureTemplate {
  id: string;
  name: string;
  points: Point[];
}

/** One instance of a FurnitureTemplate placed in a plan. */
export interface PlacedFurniture {
  id: string;
  templateId: string;
  x: number;
  y: number;
  rotation: number;
}

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
