import { Camera } from "../../camera/Camera";
import { GeometryBuffersCollection } from "../../attribute_buffers/GeometryBuffersCollection";
import { AmbientLight } from "../../lights/AmbientLight";
import { Color } from "../../math/Color";
import { Vec3 } from "../../math/Vec3";
import { Texture2D } from "../../texture/Texture2D";
import { DirectionalLight } from "../../lights/DirectionalLight";
import { PointLightsCollection } from "../../lights/PointLight";
import { InputManager } from "../../input/InputManager";
import { ShadowCamera } from "../../camera/ShadowCamera";
import { ObjectMap } from "../../game_objects/ObjectMap";
import { GridPlaneTerrain } from "../../game_objects/GridPlaneTerrain";
import type { TerrainParams, WaterParams } from "../../components/TerrainWaterControls";
import { SceneObjects } from "../../sceneEditor/Interfaces";
// (Line removed)

let animationFrameId: number | null = null;

let sceneObjects: SceneObjects | null = null;

// Functions to update terrain and water from React controls
export function updateTerrainParams(params: TerrainParams) {
    if (!sceneObjects) return;

    // Remove old terrain
    sceneObjects.gridPlanes!.forEach(gridPlane => {
        const index = sceneObjects!.gameObjects.indexOf(gridPlane);
        if (index > -1) {
            sceneObjects!.gameObjects.splice(index, 1);
        }
    });
    sceneObjects.gridPlanes = [];

    // Create new terrain with updated parameters
    for (let i = 0; i < 9; i++) {
        const position = new Vec3(64 * ((i % 3) - 1), 0, 64 * (Math.floor(i / 3) - 1));
        const terrainParams = {
            seed: params.seed,
            offset: params.offset,
            octaves: params.octaves,
            heightMultiplier: params.heightMultiplier,
            persistence: params.persistence,
            lacunarity: params.lacunarity,
            scale: params.scale,
            position: position
        };

        const gridPlane = sceneObjects.objectMap.createGridPlaneTerrain(
            {
                device: sceneObjects.device,
                camera: sceneObjects.camera,
                shadowCamera: sceneObjects.shadowCamera,
                ambientLight: sceneObjects.ambientLight,
                directionalLight: sceneObjects.directionalLight,
                pointLights: sceneObjects.pointLights
            },
            sceneObjects.shadowTexture,
            false,
            terrainParams
        );
        gridPlane.scale = new Vec3(1, 1, 1);
        gridPlane.color = new Color(0.8, 0.8, 0.8, 1);
        sceneObjects.gameObjects.push(gridPlane);
        sceneObjects.gridPlanes.push(gridPlane);
    }
}

export function updateWaterParams(params: WaterParams) {
    if (!sceneObjects || !sceneObjects.waterPlane) return;

    // Update water properties
    sceneObjects.waterPlane.setWaveParameters(params.waveSpeed, params.waveHeight, params.waveFrequency);
    sceneObjects.waterPlane.setTransparency(params.transparency);
    sceneObjects.waterPlane.setWaterLevel(params.waterLevel);
    sceneObjects.waterPlane.reflectivity = params.reflectivity;
    sceneObjects.waterPlane.color = new Color(params.color.r, params.color.g, params.color.b, params.color.a);
    sceneObjects.waterPlane.scale = new Vec3(params.scale.x, params.scale.y, params.scale.z);
}

async function init(canvas: HTMLCanvasElement, device: GPUDevice, gpuContext: GPUCanvasContext, presentationFormat: GPUTextureFormat, infoElem: HTMLPreElement) {
    canvas!.addEventListener("click", async () => {
        await canvas!.requestPointerLock();
    });

    if (presentationFormat) { } // lazy linting

    // Input Manager
    const inputManager = new InputManager(canvas);
    GeometryBuffersCollection.initialize(device);
    const objectMap = new ObjectMap();

    // DEPTH TEXTURE
    const depthTexture = Texture2D.createDepthTexture(device, canvas.width, canvas.height);
    const shadowTexture = Texture2D.createShadowTexture(device, 2048, 2048);

    // LIGHTS
    const ambientLight = new AmbientLight(device);
    ambientLight.color = new Color(1, 1, 1, 1);
    ambientLight.intensity = 0.7;

    const directionalLight = new DirectionalLight(device);
    directionalLight.color = new Color(1, 1, 1, 1);
    directionalLight.intensity = 0.5;
   

    const pointLights = new PointLightsCollection(device, 3);
    pointLights.lights[0].intensity = 0;
    pointLights.lights[1].intensity = 0;
    pointLights.lights[2].intensity = 0;

    // CAMERA
    const camera = new Camera(device, canvas.width / canvas.height, inputManager);
    camera.eye = new Vec3(0, 60, 180);
    camera.target = new Vec3(0, 0, 0);

    const shadowCamera = new ShadowCamera(device);
    shadowCamera.eye = new Vec3(166, 30, 0);
    shadowCamera.target = new Vec3(0, 0, 0);
    shadowCamera.far = 300; // Increased far plane for larger terrain

    directionalLight.direction = Vec3.normalize(new Vec3(shadowCamera.target.x - shadowCamera.eye.x , shadowCamera.target.y - shadowCamera.eye.y , shadowCamera.target.z - shadowCamera.eye.z));


    // Arrays to store game objects and physics components
    const gameObjects: any[] = [];

    // === CREATE GRID PLANE SCENE OBJECTS ===

    const gridPlanes: GridPlaneTerrain[] = [];

    for (let i = 0; i < 9; i++) {
        // Create unique terrain parameters for each chunk
        const position = new Vec3(64 * ((i % 3) - 1), 0, 64 * (Math.floor(i / 3) - 1))
        const terrainParams = {
            seed: 1928371289,
            offset: {
                x: 0,
                y: 0
            },
            octaves: 16,
            heightMultiplier: 32.0,
            persistence: 0.5,
            lacunarity: 1.6,
            scale: 90.0,
            position: position
        };

        const gridPlane = objectMap.createGridPlaneTerrain({ device, camera, shadowCamera, ambientLight, directionalLight, pointLights }, shadowTexture, false, terrainParams);
        gridPlane.scale = new Vec3(1, 1, 1);
        // Position terrain chunks in a 3x3 grid
        //gridPlane.position = position;
        gridPlane.color = new Color(0.8, 0.8, 0.8, 1);
        gameObjects.push(gridPlane);
        gridPlanes.push(gridPlane);
    }

    // === CREATE WATER PLANE ===
    const waterPlane = objectMap.createPlaneWater({ device, camera, shadowCamera, ambientLight, directionalLight, pointLights }, shadowTexture, {
        waveSpeed: 0.5,
        waveHeight: 0.2,
        waveFrequency: 2.0,
        transparency: 0.7,
        reflectivity: 0.6,
        waterLevel: 8.0
    });
    waterPlane.scale = new Vec3(1.5, 1, 1.5); // Large water plane
    waterPlane.color = new Color(0.2, 0.5, 0.8, 0.8); // Water blue with transparency
    gameObjects.push(waterPlane);

    // Store scene objects globally for React controls
    sceneObjects = {
        gridPlanes,
        waterPlane,
        objectMap,
        device,
        camera,
        shadowCamera,
        ambientLight,
        directionalLight,
        pointLights,
        shadowTexture,
        gameObjects
    };

    // === GAME FUNCTIONS ===
    let pKeyPressed = false;
    let oKeyPressed = false;

    function handleInput(): void {
        // TODO: Add input handling logic
        // Example: Reset scene with R key
        if (inputManager.isKeyDown('r') || inputManager.isKeyDown('R')) {
            // Reset logic here
        }

        // Toggle terrain wireframe with debouncing
        const pKeyDown = inputManager.isKeyDown('p') || inputManager.isKeyDown('P');
        if (pKeyDown && !pKeyPressed) {
            if (sceneObjects && sceneObjects.gridPlanes) {
                sceneObjects.gridPlanes.forEach(gridPlane => {
                    gridPlane.wireframeMode = !gridPlane.wireframeMode;
                });
            }
        }
        pKeyPressed = pKeyDown;

        // Toggle water wireframe with debouncing
        const oKeyDown = inputManager.isKeyDown('o') || inputManager.isKeyDown('O');
        if (oKeyDown && !oKeyPressed) {
            if (sceneObjects && sceneObjects.waterPlane) {
                sceneObjects.waterPlane.wireframeMode = !sceneObjects.waterPlane.wireframeMode;
            }
        }
        oKeyPressed = oKeyDown;
    }

    // === RENDER LOOP ===
    let lastTime = performance.now();
    const jsTime = performance.now() - lastTime;
    function renderLoop(currentTime: number) {
        const deltaTime = (currentTime - lastTime) / 1000;
        lastTime = currentTime;
        if (infoElem != null) {
            infoElem.textContent = `fps: ${(1 / deltaTime).toFixed(1)}\njs: ${jsTime.toFixed(1)}ms\n` +
                `Mouse - Look Around\n` +
                `O - Toggle Wireframe for Water Plane\n` +
                `P - Toggle Wireframe for Terrain Planes\n` +
                `camera.eye: ${sceneObjects?.camera.eye.toString()}\n` +
                `camera.target: ${sceneObjects?.camera.target.toString()}\n`;
        }

        handleInput();

        // Update game objects
        gameObjects.forEach(obj => {
            if (obj && typeof obj.update === 'function') {
                // Pass deltaTime to objects that can use it (like water)
                obj.update(deltaTime);
            }
        });

        // Update lights
        ambientLight.update();
        directionalLight.update();
        pointLights.update();

        // Update cameras
        camera.update();
        shadowCamera.update();

        // === SHADOW PASS ===
        const shadowCommandEncoder = device.createCommandEncoder();
        const shadowRenderPass = shadowCommandEncoder.beginRenderPass({
            colorAttachments: [],
            depthStencilAttachment: {
                view: shadowTexture.texture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store'
            }
        });
        gameObjects.forEach(obj => {
            if (obj && typeof obj.drawShadows === 'function') {
                obj.drawShadows(shadowRenderPass);
            }
        });
        shadowRenderPass.end();
        device.queue.submit([shadowCommandEncoder.finish()]);

        // === MAIN RENDER PASS ===
        const commandEncoder = device.createCommandEncoder();
        const textureView = gpuContext.getCurrentTexture().createView();
        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: textureView,
                clearValue: { r: 0.4, g: 0.9, b: 0.9, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store'
            }],
            depthStencilAttachment: {
                view: depthTexture.texture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store'
            }
        });
        // Render game objects
        gameObjects.forEach(obj => {
            if (obj && typeof obj.draw === 'function') {
                obj.draw(renderPass);
            }
        });
        renderPass.end();
        device.queue.submit([commandEncoder.finish()]);
        animationFrameId = requestAnimationFrame(renderLoop);
    }

    renderLoop(performance.now());
}

export function dispose() {
    if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

export { init };
