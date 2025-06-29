import { useState } from 'react';
import WebGPUScene from './components/WebGPUScene';
import LandingPage from './components/LandingPage';
import { SceneInfo } from './scenes/sceneList';
import './App.css';

function App() {
  const [selectedScene, setSelectedScene] = useState<SceneInfo | null>(null);

  return (
    <div className="app">
      {!selectedScene ? (
        <LandingPage onSelectScene={setSelectedScene} />
      ) : (
        <WebGPUScene 
          scene={selectedScene} 
          onBack={() => setSelectedScene(null)} 
        />
      )}
    </div>
  );
}

export default App;
