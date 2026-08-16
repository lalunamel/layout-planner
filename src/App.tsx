import { useEffect, useRef, useState } from 'react';
import type { FurnitureTemplate, Point } from './model/types';
import { makeId } from './model/geometry';
import { useAppStore } from './store/useAppStore';
import { Canvas } from './components/Canvas';
import { FurniturePanel } from './components/FurniturePanel';
import { FurnitureEditorModal } from './components/FurnitureEditorModal';
import { PlansDrawer } from './components/PlansDrawer';
import './App.css';

type EditorState = { editing: FurnitureTemplate | null } | null;

export default function App() {
  const store = useAppStore();
  const [editor, setEditor] = useState<EditorState>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [editingName, setEditingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const focusNameOnNextPlan = useRef(false);

  useEffect(() => {
    if (store.plans.length === 0) {
      store.createPlan('Untitled Plan');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.plans.length]);

  useEffect(() => {
    if (focusNameOnNextPlan.current && store.activePlanMeta) {
      focusNameOnNextPlan.current = false;
      setNameDraft(store.activePlanMeta.name);
      setEditingName(true);
    }
  }, [store.activePlanMeta]);

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
  }, [store.undo, store.redo]);

  function handleSaveFurniture(name: string, points: Point[]) {
    if (editor?.editing) {
      store.updateTemplate(editor.editing.id, { name, points });
    } else {
      store.addTemplate({ id: makeId('furniture'), name, points });
    }
    setEditor(null);
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
        <button className="iconButton" onClick={() => setDrawerOpen(true)} aria-label="My Plans" title="My Plans">
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
        <Canvas state={store.planState} dispatch={store.dispatchPlan} library={store.library} />
        <FurniturePanel
          library={store.library}
          onNew={() => setEditor({ editing: null })}
          onEdit={(template) => setEditor({ editing: template })}
          onDuplicate={store.duplicateTemplate}
          onDelete={store.deleteTemplate}
        />
      </div>
      {editor && (
        <FurnitureEditorModal editing={editor.editing} onSave={handleSaveFurniture} onCancel={() => setEditor(null)} />
      )}
      <PlansDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        plans={store.plans}
        activePlanId={store.activePlanId}
        onOpenPlan={store.openPlan}
        onNewPlan={() => {
          focusNameOnNextPlan.current = true;
          store.createPlan('Untitled Plan');
          setDrawerOpen(false);
        }}
        onRenamePlan={store.renamePlan}
        onDeletePlan={store.deletePlan}
      />
    </div>
  );
}
