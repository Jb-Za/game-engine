export type SceneInfo = {
  id: string;
  name: string;
  description: string;
  thumbnail: string; // Path to a thumbnail image
  importPath: string; // Path to the scene module
};

export const scenes: SceneInfo[] = [
  {
    id: "gltf",
    name: "GLTF Import Scene",
    description: "A demo of GLTF model loading and rendering with animated models.",
    thumbnail: "/thumbnails/gltf.svg",
    importPath: "../scenes/GLTFImportScene",
  },
  {
    id: "shadow",
    name: "Shadow Demo",
    description: "A demonstration of shadow mapping techniques.",
    thumbnail: "/thumbnails/shadow.svg",
    importPath: "../scenes/shadowDemoScene",
  },
  {
    id: "pong",
    name: "Pong Game",
    description: "A simple Pong game implementation (WIP).",
    thumbnail: "/thumbnails/pong.svg",
    importPath: "../scenes/pong-broken", 
  }
];
