export type Tool = 'wall' | 'select';

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

export interface FloorPlan {
  id: string;
  name: string;
  updatedAt: string;
  walls: Wall[];
  placed: PlacedFurniture[];
}
