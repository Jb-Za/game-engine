export type SceneInfo = {
  id: string;
  name: string;
  description: string;
  thumbnail: string; // Path to a thumbnail image
  importPath: string; // Path to the scene module
  components: string[]; // List of components to include in the scene
};

export const scenes: SceneInfo[] = [{
  id: "gltf",
  name: "GLTF Import Scene",
  description: "A demo of GLTF model loading and rendering with animated models.",
  thumbnail: "/thumbnails/walking-character.svg",
  importPath: "../scenes/GLTFImportScene/GLTFImportScene.ts",
  components: ['backButton', 'animationMenu']
}, {
  id: "shadow",
  name: "Shadow Demo",
  description: "A demonstration of shadow mapping techniques.",
  thumbnail: "/thumbnails/shadow.svg",
  importPath: "../scenes/shadowDemoScene.ts",
  components: ['backButton']
}, {
  id: "physics",
  name: "Physics Demo",
  description: "A demonstration of rigid body physics with colliders, gravity, and forces.",
  thumbnail: "/thumbnails/shadow.svg", // Using shadow thumbnail for now
  importPath: "../scenes/physicsTestScene/physicsTestScene.ts",
  components: ['backButton']
}, {
  id: "plinko",
  name: "Plinko Physics",
  description: "Classic Plinko game demonstrating sphere-sphere and sphere-box collisions with bouncing physics.",
  thumbnail: "/thumbnails/plinko.svg",
  importPath: "../scenes/plinkoScene/plinkoScene.ts",
  components: ['backButton']
},
{
  id: "characterController",
  name: "Character Controller Scene",
  description: "(A WIP) A Scene to showcase a character controller with a GLTF model.",
  thumbnail: "/thumbnails/shadow.svg",
  importPath: "../scenes/characterControllerScene/characterControllerScene.ts",
  components: ['backButton']
},
{
  id: "gridPlane",
  name: "Terrain & Water Scene",
  description: "Procedural terrain generation with animated water simulation and real-time parameter controls.",
  thumbnail: "/thumbnails/terrain.svg",
  importPath: "../scenes/TerrainGeneratorScene/TerrainGeneratorScene.ts",
  components: ['backButton', 'terrainControls']
},
{
  id: "sceneEditor",
  name: "Scene Editor",
  description: "React-based scene editor with real-time controls",
  thumbnail: "/thumbnails/shadow.svg",
  importPath: "../scenes/SceneEditor/SceneEditor.ts",
  components: ['backButton', 'sceneEditorControls']
},
{
  id: "raytracing",
  name: "Ray Tracing Scene",
  description: "ray tracing scene editor with real-time material and geometry controls.",
  thumbnail: "/thumbnails/raytracing.svg",
  importPath: "../scenes/raytracingSceneEditor/raytracingSceneEditor.ts",
  components: ['backButton', 'rayTracingSceneEditorControls']
}
];


// {
//   id: "raytracer",
//   name: "Ray Tracing Demo",
//   description: "A scene demonstrating compute shader-based ray tracing with spheres and planes.",
//   thumbnail: "/thumbnails/raytracing.svg",
//   importPath: "../scenes/raytracerScene/rayTracerScene.ts",
//   components: ['backButton', 'rayTracingControls']
// },