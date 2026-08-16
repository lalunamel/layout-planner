import { useEffect, useState } from 'react';
import type { FurnitureTemplate, Point, Tool } from './model/types';
import { makeId } from './model/geometry';
import { useAppStore } from './store/useAppStore';
import { Canvas } from './components/Canvas';
import { FurniturePanel } from './components/FurniturePanel';
import { FurnitureEditorModal } from './components/FurnitureEditorModal';
import './App.css';

type EditorState = { editing: FurnitureTemplate | null } | null;

export default function App() {
  const store = useAppStore();
  const [tool, setTool] = useState<Tool>('wall');
  const [editor, setEditor] = useState<EditorState>(null);

  useEffect(() => {
    if (store.plans.length === 0) {
      store.createPlan('Untitled Plan');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.plans.length]);

  function handleSaveFurniture(name: string, points: Point[]) {
    if (editor?.editing) {
      store.updateTemplate(editor.editing.id, { name, points });
    } else {
      store.addTemplate({ id: makeId('furniture'), name, points });
    }
    setEditor(null);
  }

  return (
    <div className="app">
      <div className="toolbar">
        <button className={tool === 'wall' ? 'active' : ''} onClick={() => setTool('wall')}>
          Wall
        </button>
        <button className={tool === 'select' ? 'active' : ''} onClick={() => setTool('select')}>
          Select
        </button>
        <span className="planName">{store.activePlanMeta?.name ?? ''}</span>
      </div>
      <div className="body">
        <Canvas tool={tool} state={store.planState} dispatch={store.dispatchPlan} library={store.library} />
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
    </div>
  );
}
