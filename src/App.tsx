import { useEffect, useRef, useState } from 'react';
import { importImageFile, loadImageSize, NOT_AN_IMAGE, type ImportedImage } from './model/imageImport';
import type { FurnitureTemplate, Point, Underlay } from './model/types';
import { imageRectToWorld, underlayFromScale, underlayRect, type Rect, type Size } from './model/underlay';
import { makeId } from './model/geometry';
import { useAppStore } from './store/useAppStore';
import { Canvas, type CanvasMode } from './components/Canvas';
import { FurniturePanel } from './components/FurniturePanel';
import { FurnitureEditorModal } from './components/FurnitureEditorModal';
import { PlansDrawer } from './components/PlansDrawer';
import { NewPlanModal } from './components/NewPlanModal';
import { UnderlayButton } from './components/UnderlayButton';
import { CalibrationModal } from './components/calibration/CalibrationPanel';
import './App.css';

type EditorState = { editing: FurnitureTemplate | null } | null;

/** Calibrating an image for an existing plan (Add, Replace or Recalibrate).
 * `previous` is the current placement when recalibrating the same image. */
type CalibrationState = { planId: string; src: string; natural: Size; previous?: Underlay } | null;

const STORAGE_FULL = 'Not enough browser storage for this image';

export default function App() {
  const store = useAppStore();
  const [mode, setMode] = useState<CanvasMode>('pointer');
  const [spaceHeld, setSpaceHeld] = useState(false);
  const effectiveMode: CanvasMode = spaceHeld ? 'pan' : mode;
  const [editor, setEditor] = useState<EditorState>(null);
  const [draggingTemplate, setDraggingTemplate] = useState<FurnitureTemplate | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [newPlanOpen, setNewPlanOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [editingName, setEditingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const [calibration, setCalibration] = useState<CalibrationState>(null);
  const [fitRequest, setFitRequest] = useState<{ id: number; rect: Rect } | null>(null);

  // With no plans at all, the new-plan modal is the empty state.
  const noPlans = store.plans.length === 0;

  useEffect(() => {
    if (editingName) {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }
  }, [editingName]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.key.toLowerCase() !== 'z') return;
      if (calibration || newPlanOpen || noPlans) return;
      e.preventDefault();
      if (e.shiftKey) {
        store.redo();
      } else {
        store.undo();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.undo, store.redo, calibration, newPlanOpen, noPlans]);

  // Holding spacebar temporarily switches to Pan mode, like Figma/Photoshop —
  // releasing it restores whichever mode was active before.
  useEffect(() => {
    function isTypingTarget(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      return !!target && ['INPUT', 'TEXTAREA'].includes(target.tagName);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== 'Space' || isTypingTarget(e)) return;
      e.preventDefault();
      setSpaceHeld(true);
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code !== 'Space' || isTypingTarget(e)) return;
      setSpaceHeld(false);
    }
    function onBlur() {
      setSpaceHeld(false);
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  // Custom drag for placing furniture from the panel onto the canvas — not
  // native HTML5 drag-and-drop, so we control the cursor (a plain grab/
  // grabbing hand, no browser copy-cursor badge) and can render a true-to-
  // scale preview of the actual shape inside Canvas's own SVG.
  useEffect(() => {
    if (!draggingTemplate) return;
    document.body.style.cursor = 'grabbing';
    function onUp() {
      setDraggingTemplate(null);
    }
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
    };
  }, [draggingTemplate]);

  function handleSaveFurniture(name: string, points: Point[]) {
    if (editor?.editing) {
      store.updateTemplate(editor.editing.id, { name, points });
    } else {
      store.addTemplate({ id: makeId('furniture'), name, points });
    }
    setEditor(null);
  }

  async function handleAddOrReplaceFile(file: File) {
    const planId = store.activePlanId;
    if (!planId) return;
    let imported: ImportedImage;
    try {
      imported = await importImageFile(file);
    } catch {
      window.alert(NOT_AN_IMAGE);
      return;
    }
    setCalibration({ planId, src: imported.dataUrl, natural: imported.size });
  }

  async function handleRecalibrate() {
    const planId = store.activePlanId;
    const src = store.underlayImage;
    const previous = store.activePlanMeta?.underlay;
    if (!planId || !src || !previous) return;
    try {
      setCalibration({ planId, src, natural: await loadImageSize(src), previous });
    } catch {
      // An unreadable stored image can't be recalibrated; Replace still works.
    }
  }

  function handleRemoveImage() {
    const planId = store.activePlanId;
    if (!planId || !window.confirm('Remove the floor plan image? This can’t be undone.')) return;
    store.setUnderlay(planId, undefined);
    store.setUnderlayImage(planId, null);
  }

  function showWholeImage(underlay: Underlay, natural: Size) {
    setFitRequest((prev) => ({ id: (prev?.id ?? 0) + 1, rect: underlayRect(underlay, natural) }));
  }

  function handleCalibrationSave(boxPx: Rect, ftPerPx: number): string | null {
    if (!calibration) return null;
    const { planId, src, natural, previous } = calibration;
    // Recalibrating keeps the measured area where it already was, so furniture
    // placed around it stays put; a new image starts at the origin.
    const anchor = previous ? imageRectToWorld(previous, natural, boxPx) : { x: 0, y: 0 };
    const underlay = underlayFromScale(natural, boxPx, ftPerPx, anchor);
    if (src !== store.underlayImage && !store.setUnderlayImage(planId, src)) return STORAGE_FULL;
    store.setUnderlay(planId, underlay);
    showWholeImage(underlay, natural);
    setCalibration(null);
    return null;
  }

  function handleCreateManual(name: string) {
    store.createPlan(name);
    setNewPlanOpen(false);
  }

  function handleCreateFromImage(name: string, image: ImportedImage, boxPx: Rect, ftPerPx: number): string | null {
    const plan = store.createPlan(name, image.dataUrl);
    if (!plan) return STORAGE_FULL;
    const underlay = underlayFromScale(image.size, boxPx, ftPerPx, { x: 0, y: 0 });
    store.setUnderlay(plan.id, underlay);
    showWholeImage(underlay, image.size);
    setNewPlanOpen(false);
    return null;
  }

  function commitName() {
    if (store.activePlanId && nameDraft.trim()) {
      store.renamePlan(store.activePlanId, nameDraft.trim());
    }
    setEditingName(false);
  }

  return (
    <div className="app">
      <div className="toolbar">
        <button className="iconButton" onClick={() => setDrawerOpen(true)} aria-label="Floor Plans" title="Floor Plans">
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
          </svg>
        </button>
        {editingName ? (
          <input
            ref={nameInputRef}
            className="planNameInput"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitName();
              if (e.key === 'Escape') setEditingName(false);
            }}
          />
        ) : (
          <span
            className="planName"
            onClick={() => {
              setNameDraft(store.activePlanMeta?.name ?? '');
              setEditingName(true);
            }}
          >
            {store.activePlanMeta?.name ?? ''}
          </span>
        )}
        <div className="spacer" />
        <button
          className={effectiveMode === 'pointer' ? 'iconButton active' : 'iconButton'}
          onClick={() => setMode('pointer')}
          aria-label="Create point"
          title="Create point"
        >
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M4 3l7 17 2.5-6.5L20 11 4 3z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          className={effectiveMode === 'pan' ? 'iconButton active' : 'iconButton'}
          onClick={() => setMode('pan')}
          aria-label="Pan"
          title="Pan"
        >
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path
              d="M7 11V5.5a1.5 1.5 0 0 1 3 0V10M10 10.5V4.5a1.5 1.5 0 0 1 3 0V10M13 10V5.5a1.5 1.5 0 0 1 3 0V11M16 11.5V9a1.5 1.5 0 0 1 3 0v5c0 3.5-2 6.5-6 6.5h-1c-3 0-4.5-1-6-3l-2.2-3.3a1.4 1.4 0 0 1 2.2-1.7L7 15.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <UnderlayButton
          hasImage={!!(store.underlayImage && store.activePlanMeta?.underlay)}
          disabled={noPlans}
          onAddFile={handleAddOrReplaceFile}
          onRecalibrate={handleRecalibrate}
          onReplaceFile={handleAddOrReplaceFile}
          onRemove={handleRemoveImage}
        />
        <div className="toolbarDivider" />
        <button
          className="iconButton"
          onClick={() => store.undo()}
          disabled={!store.canUndo}
          aria-label="Undo"
          title="Undo"
        >
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M9 7 4 12l5 5M4 12h11a5 5 0 0 1 0 10h-1" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          className="iconButton"
          onClick={() => store.redo()}
          disabled={!store.canRedo}
          aria-label="Redo"
          title="Redo"
        >
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M15 7l5 5-5 5M20 12H9a5 5 0 0 0 0 10h1" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <div className="body">
        <Canvas
          mode={effectiveMode}
          state={store.planState}
          dispatch={store.dispatchPlan}
          library={store.library}
          draggingTemplate={draggingTemplate}
          onPlaceDraggingTemplate={() => setDraggingTemplate(null)}
          underlay={
            store.underlayImage && store.activePlanMeta?.underlay
              ? { src: store.underlayImage, rect: store.activePlanMeta.underlay }
              : null
          }
          fitRequest={fitRequest}
        />
        <FurniturePanel
          library={store.library}
          onNew={() => setEditor({ editing: null })}
          onEdit={(template) => setEditor({ editing: template })}
          onDuplicate={store.duplicateTemplate}
          onDelete={store.deleteTemplate}
          onStartDrag={(template, e) => {
            if (noPlans) return;
            e.preventDefault();
            setDraggingTemplate(template);
          }}
        />
      </div>
      {editor && (
        <FurnitureEditorModal editing={editor.editing} onSave={handleSaveFurniture} onCancel={() => setEditor(null)} />
      )}
      {calibration && (
        <CalibrationModal
          src={calibration.src}
          natural={calibration.natural}
          onSave={handleCalibrationSave}
          onCancel={() => setCalibration(null)}
        />
      )}
      {(newPlanOpen || noPlans) && (
        <NewPlanModal
          onCreateManual={handleCreateManual}
          onCreateFromImage={handleCreateFromImage}
          onCancel={noPlans ? undefined : () => setNewPlanOpen(false)}
        />
      )}
      <PlansDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        plans={store.plans}
        activePlanId={store.activePlanId}
        onOpenPlan={store.openPlan}
        onNewPlan={() => {
          setDrawerOpen(false);
          setNewPlanOpen(true);
        }}
        onRenamePlan={store.renamePlan}
        onDeletePlan={(id) => {
          // Deleting the last plan leaves only the empty state; don't keep the drawer over it.
          if (store.plans.length === 1) setDrawerOpen(false);
          store.deletePlan(id);
        }}
      />
    </div>
  );
}
