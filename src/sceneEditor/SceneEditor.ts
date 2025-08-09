import { Camera } from "../camera/Camera";
import { GeometryBuffersCollection } from "../attribute_buffers/GeometryBuffersCollection";
import { AmbientLight } from "../lights/AmbientLight";
import { Color } from "../math/Color";
import { Vec3 } from "../math/Vec3";
import { Texture2D } from "../texture/Texture2D";
import { DirectionalLight } from "../lights/DirectionalLight";
import { PointLightsCollection } from "../lights/PointLight";
import { InputManager } from "../input/InputManager";
import { ShadowCamera } from "../camera/ShadowCamera";
import { ObjectMap } from "../game_objects/ObjectMap";
import type { SceneEditorState, SceneObjectData } from "../components/SceneEditorControls";

let animationFrameId: number | null = null;

// Global references for scene objects that need to be updated
let sceneObjects: {
    objects: any[];
    objectMap: ObjectMap;
    device: GPUDevice;
    camera: Camera;
    shadowCamera: ShadowCamera;
    ambientLight: AmbientLight;
    directionalLight: DirectionalLight;
    pointLights: PointLightsCollection;
    shadowTexture: Texture2D;
    gameObjects: any[];
    objectDataMap: Map<string, any>; // Maps IDs to game objects
} | null = null;

export class SceneEditor {
  private canvas: HTMLCanvasElement;
  private device: GPUDevice;
  private gpuContext: GPUCanvasContext;

  scene!: Scene; // Make scene property public for serialization
  private selectionManager!: SelectionManager;
  private hierarchy!: SceneHierarchy;
  private propertyPanel!: PropertyPanel;

  private inputManager!: InputManager;
  private objectMap!: ObjectMap;

  // Rendering resources
  private depthTexture!: Texture2D;
  private shadowTexture!: Texture2D;

  // Lights and cameras
  private camera!: Camera;
  private shadowCamera!: ShadowCamera;
  private ambientLight!: AmbientLight;
  private directionalLight!: DirectionalLight;
  private pointLights!: PointLightsCollection;
  private isRunning: boolean = false;
  private playMode: boolean = true;
  private sceneSnapshot: any = null; // Stores serialized scene data when entering play mode
  
  constructor(canvas: HTMLCanvasElement, device: GPUDevice, gpuContext: GPUCanvasContext, _presentationFormat: GPUTextureFormat) {
    this.canvas = canvas;
    this.device = device;
    this.gpuContext = gpuContext;

    this.setupCanvas();
    this.initializeCore();
    this.setupUI();
    // createDefaultScene is now called from setupUI after components are ready
  }

  private setupCanvas(): void {
    // Create the main editor layout
    this.createEditorLayout();

    // Disable pointer lock for editor
    this.canvas.removeEventListener("click", this.requestPointerLock);
  }  private createEditorLayout(): void {
    // Create main container
    const editorContainer = document.createElement("div");
    editorContainer.id = "editor-container";
    editorContainer.style.cssText = `
            position: fixed;
            left: 0;
            width: 100vw;
            height: calc(100vh - 50px);
            display: flex;
            background: #1a1a1a;
            overflow: hidden;
            z-index: 998;
        `;

    // Create hierarchy panel
    const hierarchyPanel = document.createElement("div");
    hierarchyPanel.id = "hierarchy-panel";
    hierarchyPanel.style.cssText = `
            width: 300px;
            min-width: 200px;
            max-width: 600px;
            height: 100%;
            background: #2a2a2a;
            border-right: 1px solid #444;
            position: relative;
        `;

    // Create vertical splitter between hierarchy and scene
    const vSplitter1 = document.createElement("div");
    vSplitter1.className = "v-splitter";
    vSplitter1.style.cssText = `
            width: 4px;
            height: 100%;
            background: #444;
            cursor: col-resize;
            position: relative;
            flex-shrink: 0;
        `;

    // Create scene container (maintains aspect ratio)
    const sceneContainer = document.createElement("div");
    sceneContainer.id = "scene-container";
    sceneContainer.style.cssText = `
            flex: 1;
            display: flex;
            justify-content: center;
            align-items: center;
            background: #1a1a1a;
            position: relative;
            min-width: 400px;
        `;

    // Create canvas wrapper to maintain aspect ratio
    const canvasWrapper = document.createElement("div");
    canvasWrapper.id = "canvas-wrapper";
    canvasWrapper.style.cssText = `
            position: relative;
            width: 100%;
            height: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
        `;

    // Style the canvas
    this.canvas.style.cssText = `
            background: #1a1a1a;
            cursor: crosshair;
            border: 1px solid #444;
        `;

    // Create vertical splitter between scene and properties
    const vSplitter2 = document.createElement("div");
    vSplitter2.className = "v-splitter";
    vSplitter2.style.cssText = `
            width: 4px;
            height: 100%;
            background: #444;
            cursor: col-resize;
            position: relative;
            flex-shrink: 0;
        `;

    // Create properties panel
    const propertiesPanel = document.createElement("div");
    propertiesPanel.id = "properties-panel";
    propertiesPanel.style.cssText = `
            width: 300px;
            min-width: 200px;
            max-width: 600px;
            height: 100%;
            background: #2a2a2a;
            border-left: 1px solid #444;
            position: relative;
        `;

    // Assemble the layout
    canvasWrapper.appendChild(this.canvas);
    sceneContainer.appendChild(canvasWrapper);

    editorContainer.appendChild(hierarchyPanel);
    editorContainer.appendChild(vSplitter1);
    editorContainer.appendChild(sceneContainer);    editorContainer.appendChild(vSplitter2);
    editorContainer.appendChild(propertiesPanel);

    const controlsContainer = document.querySelector('.webgpu-container > div:first-child');
    
    // Configure body styles
    document.body.style.margin = "0";
    document.body.style.padding = "0";
    document.body.style.overflow = "hidden";
    
    // Clear body content but preserve UI controls if they exist
    const tempDiv = document.createElement('div');
    if (controlsContainer) tempDiv.appendChild(controlsContainer);
    document.body.innerHTML = "";
    document.body.appendChild(tempDiv.firstChild || document.createElement('div'));
    document.body.appendChild(editorContainer);

    // Setup resize functionality
    this.setupResizers(hierarchyPanel, vSplitter1, sceneContainer, vSplitter2, propertiesPanel);

    // Setup canvas resizing
    this.setupCanvasResize(canvasWrapper);

    // Initial canvas size
    this.resizeCanvas();
  }

  private setupResizers(hierarchyPanel: HTMLElement, vSplitter1: HTMLElement, sceneContainer: HTMLElement, vSplitter2: HTMLElement, propertiesPanel: HTMLElement): void {
    let isResizing = false;
    let currentSplitter: HTMLElement | null = null;

    const startResize = (e: MouseEvent, splitter: HTMLElement) => {
      isResizing = true;
      currentSplitter = splitter;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      e.preventDefault();
    };

    const doResize = (e: MouseEvent) => {
      if (!isResizing || !currentSplitter) return;

      const containerRect = document.getElementById("editor-container")!.getBoundingClientRect();
      const mouseX = e.clientX - containerRect.left;

      if (currentSplitter === vSplitter1) {
        // Resize hierarchy panel
        const newWidth = Math.max(200, Math.min(600, mouseX));
        hierarchyPanel.style.width = `${newWidth}px`;
      } else if (currentSplitter === vSplitter2) {
        // Resize properties panel
        const newWidth = Math.max(200, Math.min(600, containerRect.width - mouseX));
        propertiesPanel.style.width = `${newWidth}px`;
      }

      this.resizeCanvas();
    };

    const stopResize = () => {
      isResizing = false;
      currentSplitter = null;
      document.body.style.cursor = "default";
      document.body.style.userSelect = "auto";
    };

    // Add event listeners
    vSplitter1.addEventListener("mousedown", (e) => startResize(e, vSplitter1));
    vSplitter2.addEventListener("mousedown", (e) => startResize(e, vSplitter2));

    document.addEventListener("mousemove", doResize);
    document.addEventListener("mouseup", stopResize);

   

    // Add hover effects
    [vSplitter1, vSplitter2].forEach((splitter) => {
      splitter.addEventListener("mouseenter", () => {
        if (!isResizing) splitter.style.background = "#555";
      });
      splitter.addEventListener("mouseleave", () => {
        if (!isResizing) splitter.style.background = "#444";
      });
    });
  }

  private setupCanvasResize(canvasWrapper: HTMLElement): void {
    const resizeObserver = new ResizeObserver(() => {
      this.resizeCanvas();
    });
    resizeObserver.observe(canvasWrapper);
  }

  private resizeCanvas(): void {
    const sceneContainer = document.getElementById("scene-container");
    if (!sceneContainer) return;

    const containerRect = sceneContainer.getBoundingClientRect();
    const maxWidth = 1280;
    const maxHeight = 720;
    const aspectRatio = 16 / 9;

    // Calculate dimensions maintaining 16:9 aspect ratio
    let width = Math.min(containerRect.width - 40, maxWidth); // 20px padding on each side
    let height = width / aspectRatio;

    // If height exceeds container or max height, scale down
    if (height > containerRect.height - 40 || height > maxHeight) {
      height = Math.min(containerRect.height - 40, maxHeight);
      width = height * aspectRatio;
    }

    // Ensure minimum size
    width = Math.max(width, 400);
    height = Math.max(height, 225); // 400/16*9

    // Apply size to canvas
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    // Update depth texture to match canvas size
    if (this.depthTexture) {
      this.depthTexture = Texture2D.createDepthTexture(this.device, width, height);
    }

    // Update camera aspect ratio
    if (this.camera) {
      this.camera.aspectRatio = width / height;
      this.camera.update();
    }
  }

  private requestPointerLock = async () => {
    // Disabled in editor mode
  };

  private initializeCore(): void {
    // Input Manager
    this.inputManager = new InputManager(this.canvas);
    GeometryBuffersCollection.initialize(this.device);
    this.objectMap = new ObjectMap();

    // Depth and shadow textures
    this.depthTexture = Texture2D.createDepthTexture(this.device, this.canvas.width, this.canvas.height);
    this.shadowTexture = Texture2D.createShadowTexture(this.device, 2048, 2048);

    // Scene and selection
    this.scene = new Scene(this.device, this.objectMap);
    this.selectionManager = new SelectionManager();

    // Setup lights
    this.setupLights();

    // Setup cameras
    this.setupCameras();
  }

  private setupLights(): void {
    this.ambientLight = new AmbientLight(this.device);
    this.ambientLight.color = new Color(1, 1, 1, 1);
    this.ambientLight.intensity = 0.3;

    this.directionalLight = new DirectionalLight(this.device);
    this.directionalLight.color = new Color(1, 1, 1, 1);
    this.directionalLight.intensity = 0.7;
    this.directionalLight.direction = new Vec3(-1, -1, -1);

    this.pointLights = new PointLightsCollection(this.device, 3);
    this.pointLights.lights[0].intensity = 0;
    this.pointLights.lights[1].intensity = 0;
    this.pointLights.lights[2].intensity = 0;
  }

  private setupCameras(): void {
    this.camera = new Camera(this.device, this.canvas.width / this.canvas.height, this.inputManager);
    this.camera.eye = new Vec3(5, 5, 5);
    this.camera.target = new Vec3(0, 0, 0);
    this.camera.update(); // Update camera matrices and buffers

    this.shadowCamera = new ShadowCamera(this.device);
    this.shadowCamera.eye = new Vec3(-10, 10, 10);
    this.shadowCamera.target = new Vec3(0, 0, 0);
    this.shadowCamera.update(); // Update shadow camera matrices and buffers
  }
  private setupUI(): void {
    // Ensure the layout has been created
    setTimeout(() => {
      // Get the containers created by the layout
      const hierarchyContainer = document.getElementById("hierarchy-panel")!;
      const propertiesContainer = document.getElementById("properties-panel")!;

      if (!hierarchyContainer || !propertiesContainer) {
        console.error("Editor containers not found!");
        return;
      }

      this.hierarchy = new SceneHierarchy(this.scene, this.selectionManager, this, hierarchyContainer);
      this.propertyPanel = new PropertyPanel(this.scene, this.selectionManager, propertiesContainer);

      // Add editor-specific styles
      this.addEditorStyles();

      // Add play mode toolbar
      // this.createPlayModeToolbar();

      // Setup editor shortcuts
      this.setupShortcuts();

      // Create default scene now that UI is ready
      this.createDefaultScene();
    }, 0);
  }

    private openInScenePlayer(): void {
    const sceneData = this.scene.serialize();
    
    // Create a download for the scene.json file
    const dataStr = JSON.stringify(sceneData, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    // Create a temporary download link
    const a = document.createElement("a");
    a.href = url;
    a.download = "scene.json";
    a.textContent = "Download scene.json";
    a.style.position = "fixed";
    a.style.top = "10px";
    a.style.left = "10px";
    a.style.padding = "10px";
    a.style.background = "#2196F3";
    a.style.color = "white";
    a.style.zIndex = "9999";
    a.style.borderRadius = "4px";
    
    // Show instructions to the user
    const instructions = document.createElement("div");
    instructions.style.position = "fixed";
    instructions.style.top = "60px";
    instructions.style.left = "10px";
    instructions.style.padding = "10px";
    instructions.style.background = "rgba(0,0,0,0.7)";
    instructions.style.color = "white";
    instructions.style.zIndex = "9999";
    instructions.style.borderRadius = "4px";
    instructions.style.maxWidth = "400px";
    instructions.innerHTML = `
      <p>1. Click the blue button to download scene.json</p>
      <p>2. Move the file to: src/scenes/ScenePlayer/scene.json</p>
      <p>3. <a href="#scenePlayer" target="_blank" style="color: #2196F3;">Open Scene Player</a></p>
      <button id="close-instructions" style="background: #f44336; border: none; color: white; padding: 5px 10px; border-radius: 4px; cursor: pointer;">Close</button>
    `;
    
    // Add to document
    document.body.appendChild(a);
    document.body.appendChild(instructions);
    
    // Add event listener to close button
    setTimeout(() => {
      const closeButton = document.getElementById("close-instructions");
      if (closeButton) {
        closeButton.addEventListener("click", () => {
          a.remove();
          instructions.remove();
        });
      }
    }, 0);
    
    // Clean up URL object
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 60000); // Clean up after 1 minute
  }

  private togglePlayMode(): void {
    const playButton = document.querySelector(".play-mode-btn") as HTMLButtonElement;
    
    if (!this.playMode) {
      // Enter play mode
      this.playMode = true;
      
      // Store scene state
      this.sceneSnapshot = this.scene.serialize();
      
      // Initialize physics if not already done
      if (!this.scene.getPhysicsWorld()) {
        this.scene.initializePhysics();
      }
      
      // Set physics properties for all applicable objects
      this.scene.getAllObjects().forEach(obj => {
        const hasPhysics = obj.getProperty("hasPhysics");
        if (hasPhysics) {
          this.setupPhysicsForObject(obj);
        }
      });
      
      // Update button appearance
      if (playButton) {
        playButton.className = "play-mode-btn stop";
        playButton.innerHTML = `<span>■</span> Stop`;
        playButton.title = "Exit play mode and restore scene";
      }
    } else {
      // Exit play mode
      this.playMode = false;
      
      // Clean up physics components
      this.scene.getAllObjects().forEach(obj => {
        if (obj.physicsComponent) {
          obj.physicsComponent = undefined;
        }
      });
      
      // Restore scene from snapshot
      if (this.sceneSnapshot) {
        this.scene.deserialize(this.sceneSnapshot);
        this.updateRenderContext();
        this.sceneSnapshot = null;
      }
      
      // Refresh hierarchy
      this.hierarchy.refresh();
      
      // Update button appearance
      if (playButton) {
        playButton.className = "play-mode-btn play";
        playButton.innerHTML = `<span>▶</span> Play`;
        playButton.title = "Enter play mode with physics and animations";
      }
    }
  }private addEditorStyles(): void {
    const style = document.createElement("style");
    style.textContent = `
            body {
                margin: 0;
                padding: 0;
                overflow: hidden;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            }
            
            .hierarchy-panel .add-btn:hover {
                background: #106ebe !important;
            }
            
            .hierarchy-panel .hierarchy-item:hover {
                background: #333 !important;
            }
            
            .hierarchy-panel .hierarchy-item.selected:hover {
                background: #0078d4 !important;
            }
            
            .property-panel input:focus {
                border-color: #0078d4;
                outline: none;
            }
            
            .play-mode-btn {
                padding: 6px 12px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                display: flex;
                align-items: center;
                gap: 4px;
            }
            
            .play-mode-btn.play {
                background: #4CAF50;
                color: white;
            }
            
            .play-mode-btn.stop {
                background: #f44336;
                color: white;
            }
            
            .property-panel input[type="color"]::-webkit-color-swatch-wrapper {
                padding: 0;
            }
            
            .property-panel input[type="color"]::-webkit-color-swatch {
                border: none;
                border-radius: 2px;
            }
            
        `;
    document.head.appendChild(style);
  }

  private setupShortcuts(): void {
    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case "S":
            e.preventDefault();
            this.saveScene();
            break;
          case "o":
            e.preventDefault();
            this.loadScene();
            break;
          case "n":
            e.preventDefault();
            this.newScene();
            break;
          case "d":
            e.preventDefault();
            this.duplicateSelected();
            break;
        }
      }

      // Other shortcuts
      switch (e.key) {
        case "f":
          this.focusSelected();
          break;
        case "g":
          // TODO: Enter move mode
          break;
        case "r":
          // TODO: Enter rotate mode
          break;
        case "s":
          if (!e.ctrlKey && !e.metaKey) {
            // TODO: Enter scale mode
          }
          break;
      }
    });
  }
  private createDefaultScene(): void {
    // Set render context first, before creating objects
    this.updateRenderContext();

    // Create a default cube
    const cube = this.scene.addObject("cube", "Default Cube");
    cube.position = new Vec3(0, 0, 0);

    // Create ground plane
    const ground = this.scene.addObject("cube", "Ground");
    ground.position = new Vec3(0, -1, 0);
    ground.scale = new Vec3(10, 0.1, 10);
    ground.setProperty("color", new Color(0.3, 0.3, 0.3, 1));

    // Refresh UI if available
    if (this.hierarchy) {
      this.hierarchy.refresh();
    }
  }

  private updateRenderContext(): void {
    const renderContext = {
      device: this.device,
      camera: this.camera,
      shadowCamera: this.shadowCamera,
      ambientLight: this.ambientLight,
      directionalLight: this.directionalLight,
      pointLights: this.pointLights,
    };

    // Set the render context on the scene
    this.scene.setRenderContext(renderContext, this.shadowTexture);
  }

  private recreateGameObjectWithContext(sceneObject: SceneObject, renderContext: any): void {
    const { type } = sceneObject;

    // Store current properties
    const currentPosition = new Vec3(sceneObject.position.x, sceneObject.position.y, sceneObject.position.z);
    const currentScale = new Vec3(sceneObject.scale.x, sceneObject.scale.y, sceneObject.scale.z);
    const currentColor = sceneObject.getProperty("color");

    switch (type) {
      case "cube":
        sceneObject.gameObject = this.objectMap.createCube(renderContext, this.shadowTexture, false);
        break;
      case "sphere":
        sceneObject.gameObject = this.objectMap.createSphere(renderContext, this.shadowTexture, false);
        break;
    }

    if (sceneObject.gameObject) {
      // Restore properties
      sceneObject.position = currentPosition;
      sceneObject.scale = currentScale;
      if (currentColor) {
        sceneObject.setProperty("color", currentColor);
      }
      sceneObject.syncToGameObject();
    }
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.renderLoop(performance.now());
  }  private renderLoop = (_currentTime: number) => {
    if (!this.isRunning) return;

    const deltaTime = 16 / 1000; // Fixed 60fps for editor

    // Update scene with physics if in play mode
    if (this.playMode) {
      this.scene.update(deltaTime);
    }

    // Update lights and cameras
    this.ambientLight.update();
    this.directionalLight.update();
    this.pointLights.update();
    this.camera.update();
    this.shadowCamera.update();

    // Render shadow pass
    this.renderShadowPass();

    // Render main pass
    this.renderMainPass();

    animationFrameId = requestAnimationFrame(this.renderLoop);
  };

  private renderShadowPass(): void {
    const commandEncoder = this.device.createCommandEncoder();
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [],
      depthStencilAttachment: {
        view: this.shadowTexture.texture.createView(),
        depthClearValue: 1.0,
        depthLoadOp: "clear",
        depthStoreOp: "store",
      },
    });

    // Render all visible objects
    this.scene.getAllObjects().forEach((obj) => {
      if (obj.visible && obj.gameObject && typeof obj.gameObject.drawShadows === "function") {
        obj.gameObject.drawShadows(renderPass);
      }
    });

    renderPass.end();
    this.device.queue.submit([commandEncoder.finish()]);
  }  private setupPhysicsForObject(sceneObject: SceneObject): void {
    // Skip if physics already set up or no physics world
    if (sceneObject.physicsComponent || !this.scene.getPhysicsWorld()) {
      return;
    }
    
    // Create physics component based on object type
    const physicsWorld = this.scene.getPhysicsWorld()!;
    const rigidBodyType = sceneObject.getProperty("rigidBodyType") || "dynamic";
    const mass = sceneObject.getProperty("mass") || 1.0;
    
    // Skip if no game object
    if (!sceneObject.gameObject) return;
    
    // Create physics component
    const colliderType = sceneObject.type === 'sphere' ? 'sphere' : 'box';
    
    sceneObject.physicsComponent = new PhysicsComponent(
      sceneObject.gameObject,
      physicsWorld,
      colliderType,
      mass
    );
    
    // Set rigid body type
    if (rigidBodyType === "static") {
      sceneObject.physicsComponent.setType(RigidBodyType.STATIC);
    } else if (rigidBodyType === "kinematic") {
      sceneObject.physicsComponent.setType(RigidBodyType.KINEMATIC);
    } else {
      sceneObject.physicsComponent.setType(RigidBodyType.DYNAMIC);
    }
    
    // Set additional physics properties
    const restitution = sceneObject.getProperty("restitution");
    const friction = sceneObject.getProperty("friction");
      
    if (restitution !== undefined) {
      sceneObject.physicsComponent.setRestitution(restitution);
    }
      
    if (friction !== undefined) {
      sceneObject.physicsComponent.setFriction(friction);
    }
  }
  
  private renderMainPass(): void {
    const commandEncoder = this.device.createCommandEncoder();
    const textureView = this.gpuContext.getCurrentTexture().createView();

    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          clearValue: { r: 0.2, g: 0.2, b: 0.25, a: 1.0 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
      depthStencilAttachment: {
        view: this.depthTexture.texture.createView(),
        depthClearValue: 1.0,
        depthLoadOp: "clear",
        depthStoreOp: "store",
      },
    });

    // Render all visible objects
    this.scene.getAllObjects().forEach((obj) => {
      if (obj.visible && obj.gameObject && typeof obj.gameObject.draw === "function") {
        obj.gameObject.draw(renderPass);
      }
    });

    renderPass.end();
    this.device.queue.submit([commandEncoder.finish()]);
  }

  private saveScene(): void {
    const sceneData = this.scene.serialize();
    const dataStr = JSON.stringify(sceneData, null, 2);

    // Create download
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${this.scene.name || "scene"}.json`;
    a.click();
    URL.revokeObjectURL(url);

  console.log("Scene saved:", this.scene.name);
  }

  private loadScene(): void {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";

    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const sceneData = JSON.parse(e.target?.result as string);
            this.scene.deserialize(sceneData);
            this.updateRenderContext();
            this.hierarchy.refresh();
            console.log("Scene loaded:", this.scene.name);
          } catch (error) {
            console.error("Failed to load scene:", error);
          }
        };
        reader.readAsText(file);
      }
    };

    input.click();
  }

  private newScene(): void {
    // Clear current scene
    this.scene.getAllObjects().forEach((obj) => {
      this.scene.removeObject(obj.id);
    });

    this.selectionManager.deselect();
    this.scene.name = "New Scene";

    // Create default objects
    this.createDefaultScene();

    console.log("New scene created");
  }

  private duplicateSelected(): void {
    const selectedIds = this.selectionManager.getSelectedIds();
    const newObjects: SceneObject[] = [];

    selectedIds.forEach((id) => {
      const obj = this.scene.getObject(id);
      if (obj) {
        const newObj = this.scene.addObject(obj.type, `${obj.name} Copy`);
        newObj.position = new Vec3(obj.position.x + 1, obj.position.y, obj.position.z);
        newObj.scale = new Vec3(obj.scale.x, obj.scale.y, obj.scale.z);

        // Copy properties
        obj.properties.forEach((value, key) => {
          newObj.setProperty(key, value);
        });

        newObjects.push(newObj);
      }
    });

    // Select duplicated objects
    this.selectionManager.deselect();
    newObjects.forEach((obj) => {
      this.selectionManager.select(obj.id, true);
    });

    this.updateRenderContext();
    this.hierarchy.refresh();
  }

  private focusSelected(): void {
    const selectedIds = this.selectionManager.getSelectedIds();
    if (selectedIds.length === 0) return;

    // Calculate bounding box of selected objects
    let minPos = new Vec3(Infinity, Infinity, Infinity);
    let maxPos = new Vec3(-Infinity, -Infinity, -Infinity);

    selectedIds.forEach((id) => {
      const obj = this.scene.getObject(id);
      if (obj) {
        minPos.x = Math.min(minPos.x, obj.position.x);
        minPos.y = Math.min(minPos.y, obj.position.y);
        minPos.z = Math.min(minPos.z, obj.position.z);
        maxPos.x = Math.max(maxPos.x, obj.position.x);
        maxPos.y = Math.max(maxPos.y, obj.position.y);
        maxPos.z = Math.max(maxPos.z, obj.position.z);
      }
    });

    // Center camera on selection
    const center = new Vec3((minPos.x + maxPos.x) / 2, (minPos.y + maxPos.y) / 2, (minPos.z + maxPos.z) / 2);

    const distance = Math.max(maxPos.x - minPos.x, maxPos.y - minPos.y, maxPos.z - minPos.z) * 2;

    this.camera.target = center;
    this.camera.eye = new Vec3(center.x + distance, center.y + distance, center.z + distance);
  }

  public dispose(): void {
    this.isRunning = false;

    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    // Clean up UI
    this.hierarchy.getContainer().remove();
    this.propertyPanel.getContainer().remove();

    // Reset canvas style
    this.canvas.style.cssText = "";
  }
}

// Scene editor init function to match the expected interface
async function init(canvas: HTMLCanvasElement, device: GPUDevice, gpuContext: GPUCanvasContext, presentationFormat: GPUTextureFormat, infoElem: HTMLPreElement) {
  // Import control visibility fix and apply it
  
  // Hide info element in editor mode
  if (infoElem) {
    infoElem.style.display = "none";
  }

  const editor = new SceneEditor(canvas, device, gpuContext, presentationFormat);
  editor.start();

  // Add back button functionality 
  const backButton = document.querySelector('.back-button');
  if (backButton) {
    backButton.addEventListener('click', () => {
      // The WebGPUScene component will handle cleanup when back is clicked
      console.log('Scene Editor: Back button clicked');
    });
  }

  // Store editor instance for disposal
  (globalThis as any).__sceneEditor = editor;
  
  // Store scene for serialization
  (globalThis as any).__sceneEditor.scene = editor.scene;
}

export function dispose() {
  const editor = (globalThis as any).__sceneEditor;
  if (editor) {
    editor.dispose();
    delete (globalThis as any).__sceneEditor;
  }
}

export { init };
