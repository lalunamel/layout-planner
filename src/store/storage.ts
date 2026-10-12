import type { FloorPlan, FurnitureTemplate } from '../model/types';
import type { View } from '../model/view';

const PLANS_KEY = 'apartment-planner:plans';
const LIBRARY_KEY = 'apartment-planner:library';
const ACTIVE_PLAN_KEY = 'apartment-planner:activePlanId';
const VIEW_KEY = 'apartment-planner:view';

function readJson<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadPlans(): FloorPlan[] {
  return readJson<FloorPlan[]>(PLANS_KEY, []);
}

export function savePlans(plans: FloorPlan[]): void {
  localStorage.setItem(PLANS_KEY, JSON.stringify(plans));
}

export function loadLibrary(): FurnitureTemplate[] {
  return readJson<FurnitureTemplate[]>(LIBRARY_KEY, []);
}

export function saveLibrary(library: FurnitureTemplate[]): void {
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
}

export function loadActivePlanId(): string | null {
  return localStorage.getItem(ACTIVE_PLAN_KEY);
}

export function saveActivePlanId(id: string): void {
  localStorage.setItem(ACTIVE_PLAN_KEY, id);
}

export function loadView(): View | null {
  return readJson<View | null>(VIEW_KEY, null);
}

export function saveView(view: View): void {
  localStorage.setItem(VIEW_KEY, JSON.stringify(view));
}

const UNDERLAY_KEY_PREFIX = 'apartment-planner:underlay:';

export function loadUnderlayImage(planId: string): string | null {
  return localStorage.getItem(UNDERLAY_KEY_PREFIX + planId);
}

/** Returns false (leaving any previous image in place) when the browser
 * refuses the write, e.g. because localStorage is full. */
export function saveUnderlayImage(planId: string, dataUrl: string): boolean {
  try {
    localStorage.setItem(UNDERLAY_KEY_PREFIX + planId, dataUrl);
    return true;
  } catch {
    return false;
  }
}

export function deleteUnderlayImage(planId: string): void {
  localStorage.removeItem(UNDERLAY_KEY_PREFIX + planId);
}
