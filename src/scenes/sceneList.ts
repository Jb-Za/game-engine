export type SceneInfo = {
  id: string;
  name: string;
  description: string;
  thumbnail: string; // Path to a thumbnail image
  importPath: string; // Path to the scene module
  components: string[]; // List of components to include in the scene
};

export const scenes: SceneInfo[] = [  {
    id: "gltf",
    name: "GLTF Import Scene",
    description: "A demo of GLTF model loading and rendering with animated models.",
    thumbnail: "/thumbnails/walking-character.svg",
    importPath: "../scenes/GLTFImportScene/GLTFImportScene.ts",
    components: ['backButton','animationMenu']
  },  {
    id: "shadow",
    name: "Shadow Demo",
    description: "A demonstration of shadow mapping techniques.",
    thumbnail: "/thumbnails/shadow.svg",
    importPath: "../scenes/shadowDemoScene.ts",
    components: ['backButton']
  },  {
    id: "pong",
    name: "Pong Game",
    description: "A simple Pong game implementation (Currently Broken).",
    thumbnail: "/thumbnails/pong.svg",
    importPath: "../scenes/pong-broken.ts", 
    components: ['backButton']
  },
   {
    id: "characterController",
    name: "Character Controller Scene",
    description: "(A WIP)A Scene to showcase a character controller with a GLTF model.",
    thumbnail: "/thumbnails/shadow.svg",
    importPath: "../scenes/characterControllerScene/characterControllerScene.ts", 
    components: ['backButton']
  } 
];
