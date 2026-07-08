import { useRef, useState } from 'react';
import { useEditorStore } from './store/editorStore';
import { MediaElementContext } from './lib/mediaElementContext';
import { AudioElementContext } from './lib/audioElementContext';
import { MediaUploader } from './components/MediaUploader';
import { Homepage } from './components/Homepage';
import { PreviewStage } from './components/PreviewStage';
import { Timeline } from './components/Timeline';
import { FiltersPanel } from './components/FiltersPanel';
import { AdjustPanel } from './components/AdjustPanel';
import { CropPanel } from './components/CropPanel';
import { SpeedPanel } from './components/SpeedPanel';
import { EffectsPanel } from './components/EffectsPanel';
import { OverlaysPanel } from './components/OverlaysPanel';
import { MusicPanel } from './components/MusicPanel';
import { ExportBar } from './components/ExportBar';
import type { ToolTab } from './types';
import './App.css';

const TABS: { key: ToolTab; label: string }[] = [
  { key: 'filters', label: 'Filters' },
  { key: 'adjust', label: 'Adjust' },
  { key: 'crop', label: 'Crop' },
  { key: 'speed', label: 'Speed' },
  { key: 'effects', label: 'Effects' },
  { key: 'overlays', label: 'Text & Shapes' },
  { key: 'music', label: 'Music' },
];

function App() {
  const hasClips = useEditorStore((s) => s.clips.length > 0);
  const music = useEditorStore((s) => s.music);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const [activeTool, setActiveTool] = useState<ToolTab>('filters');

  return (
    <MediaElementContext.Provider value={videoElRef}>
      <AudioElementContext.Provider value={audioElRef}>
        <div className="app">
          {hasClips && (
            <header className="app__header">
              <h1>Video &amp; Photo Editor</h1>
              <ExportBar />
            </header>
          )}
          <main className={`app__main ${!hasClips ? 'app__main--home' : ''}`}>
            {!hasClips ? (
              <Homepage />
            ) : (
              <>
                <div className="app__stage">
                  <PreviewStage activeTool={activeTool} />
                  <Timeline />
                </div>
                <aside className="app__sidebar">
                  <div className="tool-tabs">
                    {TABS.map((tab) => (
                      <button
                        key={tab.key}
                        className={`tool-tab ${activeTool === tab.key ? 'tool-tab--active' : ''}`}
                        onClick={() => setActiveTool(tab.key)}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  {activeTool === 'filters' && <FiltersPanel />}
                  {activeTool === 'adjust' && <AdjustPanel />}
                  {activeTool === 'crop' && <CropPanel />}
                  {activeTool === 'speed' && <SpeedPanel />}
                  {activeTool === 'effects' && <EffectsPanel />}
                  {activeTool === 'overlays' && <OverlaysPanel />}
                  {activeTool === 'music' && <MusicPanel />}
                  <div className="app__replace">
                    <MediaUploader />
                  </div>
                </aside>
              </>
            )}
          </main>
          {music && <audio ref={audioElRef} src={music.url} preload="auto" />}
        </div>
      </AudioElementContext.Provider>
    </MediaElementContext.Provider>
  );
}

export default App;
