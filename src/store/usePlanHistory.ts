import { useCallback, useReducer } from 'react';
import type { PlanAction, PlanState } from './planReducer';
import { planReducer } from './planReducer';

const HISTORY_LIMIT = 100;

interface History {
  past: PlanState[];
  present: PlanState;
  future: PlanState[];
}

type HistoryAction =
  | { type: 'DO'; action: PlanAction }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'REPLACE'; state: PlanState };

function historyReducer(history: History, action: HistoryAction): History {
  switch (action.type) {
    case 'DO':
      return {
        past: [...history.past, history.present].slice(-HISTORY_LIMIT),
        present: planReducer(history.present, action.action),
        future: [],
      };
    case 'UNDO': {
      const prev = history.past[history.past.length - 1];
      if (!prev) return history;
      return {
        past: history.past.slice(0, -1),
        present: prev,
        future: [history.present, ...history.future],
      };
    }
    case 'REDO': {
      const next = history.future[0];
      if (!next) return history;
      return { past: [...history.past, history.present], present: next, future: history.future.slice(1) };
    }
    case 'REPLACE':
      return { past: [], present: action.state, future: [] };
    default:
      return history;
  }
}

/** Undo/redo is a single linear history over an editable plan's walls and
 * placed furniture. Every dispatch is a discrete, already-final edit (e.g.
 * "furniture moved from A to B") — callers of drag interactions should keep
 * in-progress positions in local component state and only dispatch once,
 * on drag end, so a whole drag is one undo step rather than dozens. */
export function usePlanHistory(initial: PlanState) {
  const [history, dispatchHistory] = useReducer(historyReducer, {
    past: [],
    present: initial,
    future: [],
  });

  const dispatch = useCallback((action: PlanAction) => dispatchHistory({ type: 'DO', action }), []);
  const undo = useCallback(() => dispatchHistory({ type: 'UNDO' }), []);
  const redo = useCallback(() => dispatchHistory({ type: 'REDO' }), []);
  const replace = useCallback((state: PlanState) => dispatchHistory({ type: 'REPLACE', state }), []);

  return {
    state: history.present,
    dispatch,
    undo,
    redo,
    replace,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}
