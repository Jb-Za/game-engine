import { GeometryBuffersCollection } from "../../attribute_buffers/GeometryBuffersCollection";
import { Texture2D } from "../../texture/Texture2D";
import { InputManager } from "../../input/InputManager";
import { Scene } from "../../sceneEditor/Scene";
import sceneDataJson from "./testscene.json";
import { Camera } from "../../camera/Camera";
import { AmbientLight } from "../../lights/AmbientLight";
import { DirectionalLight } from "../../lights/DirectionalLight";
import { PointLightsCollection } from "../../lights/PointLight";
import { ShadowCamera } from "../../camera/ShadowCamera";

let scene: Scene | null = null;
let animationFrameId: number | null = null;

// Module-level resources 
let _device: GPUDevice | null = null;
let _gpuContext: GPUCanvasContext | null = null;
let _presentationFormat: GPUTextureFormat | null = null;
let _canvas: HTMLCanvasElement | null = null;
let _infoElem: HTMLPreElement | null = null;
let _inputManager: InputManager | null = null;
let _depthTexture: Texture2D | null = null;
let _shadowTexture: Texture2D | null = null;

let camera: Camera | null = null;
let ambientLight: AmbientLight | null = null;
let directionalLight: DirectionalLight | null = null;
let pointLights: PointLightsCollection | null = null;
let shadowCamera: ShadowCamera | null = null;

async function init(
    canvas: HTMLCanvasElement,
    device: GPUDevice,
    gpuContext: GPUCanvasContext,
    presentationFormat: GPUTextureFormat,
    infoElem: HTMLPreElement
) {
    // Enable pointer lock for FPS-style camera control
    canvas?.addEventListener("click", async () => {
        await canvas?.requestPointerLock();
    });

    const sceneData = sceneDataJson as any;

    // Store module-level references
    _canvas = canvas;
    _device = device;
    _gpuContext = gpuContext;
    _presentationFormat = presentationFormat;
    _infoElem = infoElem;

    // Input Manager for game controls
    _inputManager = new InputManager(canvas);
    GeometryBuffersCollection.initialize(device);

    // Create shared depth and shadow textures
    _depthTexture = Texture2D.createDepthTexture(device, canvas.width, canvas.height);
    _shadowTexture = Texture2D.createShadowTexture(device, 4096, 4096);

    // Load the scene
    loadScene(sceneData);

    // === GAME INPUT HANDLING ===
    function handleInput(): void {
        if (!_inputManager) return;

        // Camera reset
        if (_inputManager.isKeyDown('r') || _inputManager.isKeyDown('R')) {
            if (camera) {
                camera.eye.x = 10;
                camera.eye.y = 4;
                camera.eye.z = 10;
                camera.target.x = 0;
                camera.target.y = 0;
                camera.target.z = 0;
            }
        }

        // Toggle fullscreen with F key
        if (_inputManager.isKeyDown('f') || _inputManager.isKeyDown('F')) {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
            } else {
                document.exitFullscreen();
            }
        }

        // Exit pointer lock with Escape
        if (_inputManager.isKeyDown('Escape')) {
            document.exitPointerLock();
        }

        // Example: Sprint mode with Shift
        if (_inputManager.isKeyDown('Shift')) {
            // You could modify camera movement speed here
        }
    }

    // === RENDER LOOP ===
    let lastTime = performance.now();
    function renderLoop(currentTime: number) {
        const deltaTime = (currentTime - lastTime) / 1000;
        lastTime = currentTime;

        // Display FPS
        if (_infoElem != null) {
            _infoElem.textContent = `FPS: ${(1 / deltaTime).toFixed(1)}\n`;
            
            // Show game controls
            _infoElem.textContent += `Controls:\n`;
            _infoElem.textContent += `WASD - Move camera\n`;
            _infoElem.textContent += `Mouse - Look around\n`;
            _infoElem.textContent += `R - Reset camera\n`;
        }

        handleInput();

        if (!scene) {
            animationFrameId = requestAnimationFrame(renderLoop);
            return;
        }

        // Get scene components
        const sceneObjects = scene.getSceneObjects();
        camera = scene.getCamera();
        ambientLight = scene.getAmbientLight();
        directionalLight = scene.getDirectionalLight();
        pointLights = scene.getPointLights();
        shadowCamera = scene.getShadowCamera();

        // Update scene components
        camera.update();
        ambientLight.update();
        directionalLight.update();
        pointLights.update();
        shadowCamera.update();

        // Update game objects
        sceneObjects.objects.forEach(obj => {
            if (obj && typeof obj.update === 'function') {
                obj.update(deltaTime);
            }
        });

        // === SHADOW PASS ===
        const shadowCommandEncoder = _device!.createCommandEncoder();
        const shadowRenderPass = shadowCommandEncoder.beginRenderPass({
            colorAttachments: [],
            depthStencilAttachment: {
                view: _shadowTexture!.texture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store'
            }
        });

        sceneObjects.objects.forEach(obj => {
            if (obj && typeof obj.drawShadows === 'function') {
                obj.drawShadows(shadowRenderPass);
            }
        });
        shadowRenderPass.end();
        _device!.queue.submit([shadowCommandEncoder.finish()]);

        // === MAIN RENDER PASS ===
        const commandEncoder = _device!.createCommandEncoder();
        const textureView = _gpuContext!.getCurrentTexture().createView();
        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: textureView,
                clearValue: { r: 0.2, g: 0.2, b: 0.25, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store'
            }],
            depthStencilAttachment: {
                view: _depthTexture!.texture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store'
            }
        });

        // Render game objects
        sceneObjects.objects.forEach(obj => {
            if (obj && typeof obj.draw === 'function' && obj.visible !== false) {
                obj.draw(renderPass);
            }
        });

        renderPass.end();
        _device!.queue.submit([commandEncoder.finish()]);
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

// Export the main init function
export { init };

function disposeScene(): void {
    camera = null;
    ambientLight = null;
    directionalLight = null;
    pointLights = null;
    shadowCamera = null;
}

function loadScene(sceneJson: any): void {
    disposeScene();

    // Create the scene instance
    try {
        scene = new Scene(
            sceneJson, 
            _device!, 
            _canvas!.width / _canvas!.height, 
            _inputManager!, 
            _shadowTexture!, 
            _presentationFormat!, 
            _depthTexture!.texture
        );
        console.log('Play scene loaded successfully');
    } catch (e) {
        console.error('Failed to load play scene:', e);
    }
}