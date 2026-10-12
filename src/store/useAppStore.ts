import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FloorPlan, FurnitureTemplate, Underlay } from '../model/types';
import { makeId } from '../model/geometry';
import * as storage from './storage';
import { usePlanHistory } from './usePlanHistory';

function seedPlan(name: string): FloorPlan {
  return { id: makeId('plan'), name, updatedAt: new Date().toISOString(), walls: [], placed: [] };
}

export function useAppStore() {
  const [plans, setPlans] = useState<FloorPlan[]>(() => storage.loadPlans());
  const [library, setLibrary] = useState<FurnitureTemplate[]>(() => storage.loadLibrary());
  const [activePlanId, setActivePlanId] = useState<string | null>(() => {
    const saved = storage.loadActivePlanId();
    const loaded = storage.loadPlans();
    if (saved && loaded.some((p) => p.id === saved)) return saved;
    return loaded[0]?.id ?? null;
  });

  const [underlayImage, setUnderlayImageState] = useState<string | null>(() =>
    activePlanId ? storage.loadUnderlayImage(activePlanId) : null,
  );

  useEffect(() => {
    setUnderlayImageState(activePlanId ? storage.loadUnderlayImage(activePlanId) : null);
  }, [activePlanId]);

  const activePlanMeta = useMemo(
    () => plans.find((p) => p.id === activePlanId) ?? null,
    [plans, activePlanId],
  );

  const history = usePlanHistory(
    activePlanMeta
      ? { walls: activePlanMeta.walls, placed: activePlanMeta.placed }
      : { walls: [], placed: [] },
  );

  // Reload history whenever the active plan switches.
  useEffect(() => {
    history.replace(
      activePlanMeta
        ? { walls: activePlanMeta.walls, placed: activePlanMeta.placed }
        : { walls: [], placed: [] },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePlanId]);

  // Write edits back into the plans list + localStorage as they happen.
  useEffect(() => {
    if (!activePlanId) return;
    setPlans((prev) => {
      const next = prev.map((p) =>
        p.id === activePlanId
          ? { ...p, walls: history.state.walls, placed: history.state.placed, updatedAt: new Date().toISOString() }
          : p,
      );
      storage.savePlans(next);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history.state]);

  useEffect(() => {
    if (activePlanId) storage.saveActivePlanId(activePlanId);
  }, [activePlanId]);

  useEffect(() => {
    storage.saveLibrary(library);
  }, [library]);

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

  const renamePlan = useCallback((id: string, name: string) => {
    setPlans((prev) => {
      const next = prev.map((p) => (p.id === id ? { ...p, name } : p));
      storage.savePlans(next);
      return next;
    });
  }, []);

  const deletePlan = useCallback(
    (id: string) => {
      storage.deleteUnderlayImage(id);
      setPlans((prev) => {
        const next = prev.filter((p) => p.id !== id);
        storage.savePlans(next);
        if (activePlanId === id) setActivePlanId(next[0]?.id ?? null);
        return next;
      });
    },
    [activePlanId],
  );

  const openPlan = useCallback((id: string) => setActivePlanId(id), []);

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

  const addTemplate = useCallback((template: FurnitureTemplate) => {
    setLibrary((prev) => [...prev, template]);
  }, []);

  const deleteTemplate = useCallback((id: string) => {
    setLibrary((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return {
    plans,
    library,
    activePlanId,
    activePlanMeta,
    planState: history.state,
    dispatchPlan: history.dispatch,
    undo: history.undo,
    redo: history.redo,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    createPlan,
    renamePlan,
    deletePlan,
    openPlan,
    underlayImage,
    setUnderlayImage,
    setUnderlay,
    addTemplate,
    deleteTemplate,
  };
}
