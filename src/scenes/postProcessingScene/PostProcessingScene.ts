import { GeometryBuffersCollection } from "../../attribute_buffers/GeometryBuffersCollection";
import { Texture2D } from "../../texture/Texture2D";
import { InputManager } from "../../input/InputManager";
import { Scene } from "../../sceneEditor/Scene";
import sceneDataJson from "./scene.json";
import { Camera } from "../../camera/Camera";
import { AmbientLight } from "../../lights/AmbientLight";
import { DirectionalLight } from "../../lights/DirectionalLight";
import { PointLightsCollection } from "../../lights/PointLight";
import { ShadowCamera } from "../../camera/ShadowCamera";
import { PostProcessing } from "../../post_processing/PostProcessing";
import { PostProcessingEffects } from "../../post_processing/PostProcessingEffects";
import { Vec2 } from "../../math/Vec2";

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
let _postProcessing: PostProcessing | null = null;

let camera: Camera | null = null;
let ambientLight: AmbientLight | null = null;
let directionalLight: DirectionalLight | null = null;
let pointLights: PointLightsCollection | null = null;
let shadowCamera: ShadowCamera | null = null;

// Effect control variables
let currentEffectIndex = 0;

const getEffectDescription = (index: number): string => {
    const descriptions = [
        'Passthrough',
        'Grayscale', 
        'Sepia',
        'Invert',
        'Color Tint',
        'Brightness',
        'Vignette',
        'Blur',
        'Edge Detection',
        'blur + vignette'
    ];
    return descriptions[index] || 'Unknown';
};

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
    GeometryBuffersCollection.initialize(device);    // Create shared depth and shadow textures
    _depthTexture = Texture2D.createDepthTexture(device, canvas.width, canvas.height);
    _shadowTexture = Texture2D.createShadowTexture(device, 4096, 4096);

    // Initialize post-processing with multiple effects
    initPostProcessing();

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

         // Cycle through post-processing effects with number keys
        if (_inputManager.isKeyDown('1')) {
            _postProcessing?.setEffect('passthrough');
            currentEffectIndex = 0;
        } else if (_inputManager.isKeyDown('2')) {
            _postProcessing?.setEffect('grayscale');
            currentEffectIndex = 1;
        } else if (_inputManager.isKeyDown('3')) {
            _postProcessing?.setEffect('sepia');
            currentEffectIndex = 2;
        } else if (_inputManager.isKeyDown('4')) {
            _postProcessing?.setEffect('invert');
            currentEffectIndex = 3;
        } else if (_inputManager.isKeyDown('5')) {
            _postProcessing?.setEffect('colorTint');
            currentEffectIndex = 4;
        } else if (_inputManager.isKeyDown('6')) {
            _postProcessing?.setEffect('brightness');
            currentEffectIndex = 5;
        } else if (_inputManager.isKeyDown('7')) {
            _postProcessing?.setEffect('vignette');
            currentEffectIndex = 6;
        } else if (_inputManager.isKeyDown('8')) {
            _postProcessing?.setEffect('blur');
            currentEffectIndex = 7;
        } else if (_inputManager.isKeyDown('9')) {
            _postProcessing?.setEffect('differenceOfGaussians');
            currentEffectIndex = 8;
        }        
        // Example of parallel processing with 0 key
        if (_inputManager.isKeyDown('0')) {
            _postProcessing?.setEffect(['blur', 'vignette']); // Apply blur and vignette together
            currentEffectIndex = 9;
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
        lastTime = currentTime;        // Display FPS
        if (_infoElem != null) {
            _infoElem.textContent = `FPS: ${(1 / deltaTime).toFixed(1)}\n`;
            
            // Show game controls            _infoElem.textContent += `Controls:\n`;
            _infoElem.textContent += `WASD - Move camera\n`;
            _infoElem.textContent += `Mouse - Look around\n`;
            _infoElem.textContent += `R - Reset camera\n`;
            _infoElem.textContent += `1-9 - Post-processing effects\n`;
            _infoElem.textContent += `0 - Parallel effects demo\n`;
            _infoElem.textContent += `Current effect: ${getEffectDescription(currentEffectIndex)}\n`;
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
      
        // First pass: Render scene to offscreen texture
        const offscreenRenderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: _postProcessing!.getColorTexture().texture.createView(),
                clearValue: { r: 0.2, g: 0.2, b: 0.25, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store'
            },
            {
                view: _postProcessing!.getNormalTexture().texture.createView(), // normals
                clearValue: { r: 0.5, g: 0.5, b: 1.0, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store'
            },
            {
                view: _postProcessing!.getDepthTextureAsColor().texture.createView(), // linear depth
                clearValue: { r: 1.0, g: 0.0, b: 0.0, a: 1.0 },
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

        // Render game objects to offscreen texture
        sceneObjects.objects.forEach(obj => {
            if (obj && typeof obj.draw === 'function' && obj.visible !== false) {
                obj.draw(offscreenRenderPass);
            }        });
        offscreenRenderPass.end();

        // === POST-PROCESSING PASS ===
        const textureView = _gpuContext!.getCurrentTexture().createView();
        const postProcessRenderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: textureView,
                clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store'
            }]
        });

        if (_postProcessing) {
            _postProcessing.render(postProcessRenderPass);
        }
        
        postProcessRenderPass.end();

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

    // Clean up post-processing resources
    if (_postProcessing) {
        _postProcessing.dispose();
        _postProcessing = null;
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
            _depthTexture!.texture,
            true // usesPostProcessing = true for PostProcessingScene
        );
    } catch (e) {
        console.error('Failed to load post-processing scene:', e);
    }
}

function initPostProcessing() {
    if (!_device || !_canvas || !_presentationFormat) return;

    // Initialize PostProcessing with just passthrough
    _postProcessing = new PostProcessing(_device, {
        width: _canvas.width,
        height: _canvas.height,
        format: _presentationFormat
    });

    // Add all available effects (they can be used later)
    _postProcessing.addEffect(PostProcessingEffects.getGrayscale());
    _postProcessing.addEffect(PostProcessingEffects.getSepia());
    _postProcessing.addEffect(PostProcessingEffects.getInvert());
    _postProcessing.addEffect(PostProcessingEffects.getColorTint());
    _postProcessing.addEffect(PostProcessingEffects.getBrightness());
    _postProcessing.addEffect(PostProcessingEffects.getVignette());
    _postProcessing.addEffect(PostProcessingEffects.getBlur());
    _postProcessing.addEffect(PostProcessingEffects.getDifferenceOfGaussians());

    // Update uniforms for effects that need them
    _postProcessing.updateUniform('blur', 'texelSize', new Vec2(1.0 / _canvas.width, 1.0 / _canvas.height));
    _postProcessing.updateUniform('differenceOfGaussians', 'texelSize', new Vec2(1.0 / _canvas.width, 1.0 / _canvas.height));
    _postProcessing.updateUniform('differenceOfGaussians', 'sigma', new Float32Array([1.0]));
    _postProcessing.updateUniform('differenceOfGaussians', 'scale', new Float32Array([2.0]));
    _postProcessing.updateUniform('differenceOfGaussians', 'radius', new Float32Array([3.0]));
}
