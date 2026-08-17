import type { Point, Wall, PlacedFurniture } from '../model/types';

export interface PlanState {
  walls: Wall[];
  placed: PlacedFurniture[];
}

export type PlanAction =
  | { type: 'ADD_WALLS'; walls: Wall[] }
  | { type: 'MOVE_VERTEX'; from: Point; to: Point }
  | { type: 'MOVE_WALL'; wallId: string; dx: number; dy: number }
  | { type: 'DELETE_WALL'; wallId: string }
  | { type: 'ADD_FURNITURE'; item: PlacedFurniture }
  | { type: 'MOVE_FURNITURE'; id: string; x: number; y: number }
  | { type: 'ROTATE_FURNITURE'; id: string; rotation: number }
  | { type: 'DELETE_FURNITURE'; id: string };

function pointsEqual(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}

export function planReducer(state: PlanState, action: PlanAction): PlanState {
  switch (action.type) {
    case 'ADD_WALLS':
      return { ...state, walls: [...state.walls, ...action.walls] };

    case 'MOVE_VERTEX': {
      const walls = state.walls.map((w) => ({
        ...w,
        a: pointsEqual(w.a, action.from) ? action.to : w.a,
        b: pointsEqual(w.b, action.from) ? action.to : w.b,
      }));
      return { ...state, walls };
    }

    case 'MOVE_WALL': {
      const wall = state.walls.find((w) => w.id === action.wallId);
      if (!wall) return state;
      const newA = { x: wall.a.x + action.dx, y: wall.a.y + action.dy };
      const newB = { x: wall.b.x + action.dx, y: wall.b.y + action.dy };
      const walls = state.walls.map((w) => ({
        ...w,
        a: pointsEqual(w.a, wall.a) ? newA : pointsEqual(w.a, wall.b) ? newB : w.a,
        b: pointsEqual(w.b, wall.a) ? newA : pointsEqual(w.b, wall.b) ? newB : w.b,
      }));
      return { ...state, walls };
    }

    case 'DELETE_WALL':
      return { ...state, walls: state.walls.filter((w) => w.id !== action.wallId) };

    case 'ADD_FURNITURE':
      return { ...state, placed: [...state.placed, action.item] };

    case 'MOVE_FURNITURE':
      return {
        ...state,
        placed: state.placed.map((p) => (p.id === action.id ? { ...p, x: action.x, y: action.y } : p)),
      };

    case 'ROTATE_FURNITURE':
      return {
        ...state,
        placed: state.placed.map((p) => (p.id === action.id ? { ...p, rotation: action.rotation } : p)),
      };

    case 'DELETE_FURNITURE':
      return { ...state, placed: state.placed.filter((p) => p.id !== action.id) };

    default:
      return state;
  }
}
