import { useEffect, useReducer, useRef, useState } from 'react';
import { calibrationReducer, type CalibrationRestore } from './model/calibration';
import { importImageFile, loadImageSize } from './model/imageImport';
import type { FurnitureTemplate, Point } from './model/types';
import { makeId } from './model/geometry';
import { useAppStore } from './store/useAppStore';
import { Canvas, type CanvasMode } from './components/Canvas';
import { FurniturePanel } from './components/FurniturePanel';
import { FurnitureEditorModal } from './components/FurnitureEditorModal';
import { PlansDrawer } from './components/PlansDrawer';
import { NewPlanModal } from './components/NewPlanModal';
import { UnderlayButton } from './components/UnderlayButton';
import './App.css';

type EditorState = { editing: FurnitureTemplate | null } | null;

const STORAGE_FULL = 'Not enough browser storage for this image';
const NOT_AN_IMAGE = "That file isn't an image this browser can read";

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
  const [calibration, dispatchCalibration] = useReducer(calibrationReducer, null);
  const calibrating = calibration !== null;

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
      if (calibrating) return;
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
  }, [store.undo, store.redo, calibrating]);

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

  async function startCalibrationFromFile(planId: string, file: File, restore: CalibrationRestore): Promise<string | null> {
    let imported;
    try {
      imported = await importImageFile(file);
    } catch {
      return NOT_AN_IMAGE;
    }
    // The new image is only written on Done, so the stored image always
    // matches the stored placement, even if the tab closes mid-calibration.
    dispatchCalibration({ type: 'START', planId, src: imported.dataUrl, natural: imported.size, draft: null, restore });
    return null;
  }

  function currentRestore(): CalibrationRestore {
    return { src: store.underlayImage, underlay: store.activePlanMeta?.underlay };
  }

  async function handleAddOrReplaceFile(file: File) {
    if (!store.activePlanId) return;
    const error = await startCalibrationFromFile(store.activePlanId, file, currentRestore());
    if (error) window.alert(error);
  }

  async function handleRecalibrate() {
    const planId = store.activePlanId;
    const src = store.underlayImage;
    const underlay = store.activePlanMeta?.underlay;
    if (!planId || !src || !underlay) return;
    let natural;
    try {
      natural = await loadImageSize(src);
    } catch {
      return;
    }
    dispatchCalibration({ type: 'START', planId, src, natural, draft: underlay, restore: { src, underlay } });
  }

  function handleRemoveImage() {
    const planId = store.activePlanId;
    if (!planId || !window.confirm('Remove the floor plan image? This can’t be undone.')) return;
    store.setUnderlay(planId, undefined);
    store.setUnderlayImage(planId, null);
  }

  function handleCalibrationDone() {
    if (!calibration) return;
    const { planId, src, draft, restore } = calibration;
    if (src !== restore.src && !store.setUnderlayImage(planId, src)) {
      window.alert(STORAGE_FULL);
      return;
    }
    if (draft) store.setUnderlay(planId, draft);
    dispatchCalibration({ type: 'END' });
  }

  function handleCalibrationCancel() {
    if (!calibration) return;
    // A brand-new plan's image was stored up front by createPlan; drop it.
    // Add/Replace/Recalibrate wrote nothing yet, so there is nothing to undo.
    if (calibration.restore.src === null) store.setUnderlayImage(calibration.planId, null);
    dispatchCalibration({ type: 'END' });
  }

  function handleCreateManual(name: string) {
    store.createPlan(name);
    setNewPlanOpen(false);
  }

  async function handleUploadNewPlan(name: string, file: File): Promise<string | null> {
    let imported;
    try {
      imported = await importImageFile(file);
    } catch {
      return NOT_AN_IMAGE;
    }
    const plan = store.createPlan(name, imported.dataUrl);
    if (!plan) return STORAGE_FULL;
    dispatchCalibration({
      type: 'START',
      planId: plan.id,
      src: imported.dataUrl,
      natural: imported.size,
      draft: null,
      restore: { src: null, underlay: undefined },
    });
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
        <button className="iconButton" disabled={calibrating} onClick={() => setDrawerOpen(true)} aria-label="Floor Plans" title="Floor Plans">
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
          disabled={calibrating || noPlans}
          onAddFile={handleAddOrReplaceFile}
          onRecalibrate={handleRecalibrate}
          onReplaceFile={handleAddOrReplaceFile}
          onRemove={handleRemoveImage}
        />
        <div className="toolbarDivider" />
        <button
          className="iconButton"
          onClick={() => store.undo()}
          disabled={!store.canUndo || calibrating}
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
          disabled={!store.canRedo || calibrating}
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
          calibration={
            calibration
              ? {
                  session: calibration,
                  dispatch: dispatchCalibration,
                  onDone: handleCalibrationDone,
                  onCancel: handleCalibrationCancel,
                }
              : null
          }
        />
        <FurniturePanel
          library={store.library}
          onNew={() => setEditor({ editing: null })}
          onEdit={(template) => setEditor({ editing: template })}
          onDuplicate={store.duplicateTemplate}
          onDelete={store.deleteTemplate}
          onStartDrag={(template, e) => {
            if (calibrating || noPlans) return;
            e.preventDefault();
            setDraggingTemplate(template);
          }}
        />
      </div>
      {editor && (
        <FurnitureEditorModal editing={editor.editing} onSave={handleSaveFurniture} onCancel={() => setEditor(null)} />
      )}
      {(newPlanOpen || noPlans) && (
        <NewPlanModal
          onCreateManual={handleCreateManual}
          onUpload={handleUploadNewPlan}
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
