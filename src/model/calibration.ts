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
