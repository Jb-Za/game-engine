import React from 'react';
import { scenes, SceneInfo } from '../scenes/sceneList';
import './LandingPage.css';

type LandingPageProps = {
  onSelectScene: (scene: SceneInfo) => void;
};

const LandingPage: React.FC<LandingPageProps> = ({ onSelectScene }) => {
  return (
    <div className="landing-page">
      <header>
        <h1>WebGPU Game Engine</h1>
        <p>Select a demo scene to explore</p>
      </header>
      
      <div className="scene-grid">
        {scenes.map((scene) => (
          <div 
            key={scene.id}
            className="scene-tile" 
            onClick={() => onSelectScene(scene)}
          >
            <div className="scene-tile-content">
              <div className="scene-thumb">
                <img 
                  src={scene.thumbnail} 
                  alt={scene.name} 
                  onError={(e) => {
                    // Fallback for missing thumbnails
                    e.currentTarget.src = "/vite.svg";
                  }}
                />
              </div>
              <h2>{scene.name}</h2>
              <p>{scene.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LandingPage;
