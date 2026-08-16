import { useEffect, useState } from 'react';
import type { Tool } from './model/types';
import { useAppStore } from './store/useAppStore';
import { Canvas } from './components/Canvas';
import './App.css';

export default function App() {
  const store = useAppStore();
  const [tool, setTool] = useState<Tool>('wall');

  useEffect(() => {
    if (store.plans.length === 0) {
      store.createPlan('Untitled Plan');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.plans.length]);

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
      </div>
    </div>
  );
}
