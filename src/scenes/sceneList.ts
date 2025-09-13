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
  thumbnail: "/thumbnails/undefined.svg",
  importPath: "../scenes/GLTFImportScene/GLTFImportScene.ts",
  components: ['backButton', 'animationMenu']
}, 
{
  id: "plinko",
  name: "Plinko Physics",
  description: "Classic Plinko game demonstrating sphere-sphere and sphere-box collisions with bouncing physics.",
  thumbnail: "/thumbnails/undefined.svg",
  importPath: "../scenes/plinkoScene/plinkoScene.ts",
  components: ['backButton']
},
{
  id: "gridPlane",
  name: "Terrain Generator Scene (WIP)",
  description: "Procedural terrain generation. Planned addition of erosion and texture mapping",
  thumbnail: "/thumbnails/undefined.svg",
  importPath: "../scenes/TerrainGeneratorScene/TerrainGeneratorScene.ts",
  components: ['backButton', 'terrainControls']
},
{
  id: "sceneEditor",
  name: "Scene Editor",
  description: "React-based scene editor with real-time controls",
  thumbnail: "/thumbnails/undefined.svg",
  importPath: "../scenes/SceneEditor/SceneEditor.ts",
  components: ['backButton', 'sceneEditorControls']
},
{
  id: "Play Scene",
  name: "Play Scene",
  description: "load and play the scene that we edited in the scene editor.",
  thumbnail: "/thumbnails/undefined.svg",
  importPath: "../scenes/SceneEditor/PlayScene.ts",
  components: ['backButton']
},
{
  id: "raytracing",
  name: "Ray Tracing Scene",
  description: "ray tracing scene editor with real-time material and geometry controls.",
  thumbnail: "/thumbnails/undefined.svg",
  importPath: "../scenes/raytracingSceneEditor/raytracingSceneEditor.ts",
  components: ['backButton', 'rayTracingSceneEditorControls']
},
{
  id: "waterSim2D GPU",
  name: "Water Simulation 2D",
  description: "SPH fluid simulation using GPU compute shaders",
  thumbnail: "/thumbnails/undefined.svg",
  importPath: "../scenes/waterSim2D/waterSim2DGPU.ts",
  components: ['backButton']
},
{
  id: "shadow",
  name: "Shadow Demo",
  description: "A demonstration of rasterized shadow mapping techniques.",
  thumbnail: "/thumbnails/undefined.svg",
  importPath: "../scenes/shadowDemoScene.ts",
  components: ['backButton']
},
{
  id: "postProcessing",
  name: "Post Processing",
  description: "A demonstration of post-processing effects.",
  thumbnail: "/thumbnails/undefined.svg",
  importPath: "../scenes/postProcessingScene/PostProcessingScene.ts",
  components: ['backButton']
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


// {
//   id: "waterSim2D CPU",
//   name: "Water Simulation 2D CPU",
//   description: "A 2D scene with water simulation effects.",
//   thumbnail: "/thumbnails/undefined.svg",
//   importPath: "../scenes/waterSim2D/waterSim2DCPU.ts",
//   components: ['backButton']
// },

// {
//   id: "characterController",
//   name: "Character Controller Scene",
//   description: "(A WIP) A Scene to showcase a character controller with a GLTF model.",
//   thumbnail: "/thumbnails/shadow.svg",
//   importPath: "../scenes/characterControllerScene/characterControllerScene.ts",
//   components: ['backButton']
// },

// {
//   id: "physics",
//   name: "Physics Demo",
//   description: "A demonstration of rigid body physics with colliders, gravity, and forces.",
//   thumbnail: "/thumbnails/undefined.svg",
//   importPath: "../scenes/physicsTestScene/physicsTestScene.ts",
//   components: ['backButton']
// },