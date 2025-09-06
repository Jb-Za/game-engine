import { Camera } from "../camera/Camera";
import { ShadowCamera } from "../camera/ShadowCamera";
import { AmbientLight } from "../lights/AmbientLight";
import { DirectionalLight } from "../lights/DirectionalLight";
import { PointLightsCollection } from "../lights/PointLight";
import { Color } from "../math/Color";
import { Vec3 } from "../math/Vec3";
import { Quaternion } from "../math/Quaternion";
import { RenderPipeline } from "../render_pipelines/RenderPipeline";
import { Texture2D } from "../texture/Texture2D";
import { Ball } from "./Ball";
// import { Ball } from "./Ball";
import { Cube } from "./Cube";
import { Arrow } from "./Arrow";
import { GLTFAnimationPlayer } from "../gltf/GLTFAnimationPlayer";
import { GridPlane } from "./GridPlane";
import { GridPlaneTerrain, TerrainParameters } from "./GridPlaneTerrain";
import { PlaneWater, WaterParameters } from "./PlaneWater";
import { TerrainRenderPipeline } from "../render_pipelines/TerrainRenderPipeline";
import { WaterRenderPipeline } from "../render_pipelines/WaterRenderPipeline";
import { GLTFGameObject } from "../gltf/GLTFGameObject";
// import { Floor } from "./Floor";
// import { Paddle } from "./Paddle";

export class ObjectMap {
  public _objects = new Map<string, GameObject>();

  public get objects(): Map<string, GameObject> {
    return this._objects;
  }
  private objectIdCounter: number = 0;

  public get objectCount(): number {
    return this.objectIdCounter;
  }

  public createObjectId(string: string): string {
    return `${string}_${this.objectIdCounter}`;
  }

  // Function to spawn a game object. TODO, Create optional light/shadow passing in
  public createCube(objectParameters: ObjectParameters, shadowTexture: Texture2D, randomColor: boolean) {
    const cube = new Cube(
      objectParameters.device,
      objectParameters.camera,
      objectParameters.shadowCamera,
      objectParameters.ambientLight,
      objectParameters.directionalLight,
      objectParameters.pointLights
    );
    cube.pipeline.shadowTexture = shadowTexture;
    if(randomColor === true){
        cube.color = this.generateRandomColor();
    }
    // Assign a unique ID to the object
    this.objectIdCounter++;
    this._objects.set(this.createObjectId('Cube'), cube);
    return cube;
  }

  public createGridPlane(objectParameters: ObjectParameters, shadowTexture: Texture2D, randomColor: boolean) {
    const gridPlane = new GridPlane(
      objectParameters.device,
      objectParameters.camera,
      objectParameters.shadowCamera,
      objectParameters.ambientLight,
      objectParameters.directionalLight,
      objectParameters.pointLights
    );
    gridPlane.pipeline.shadowTexture = shadowTexture;
    if(randomColor === true){
        gridPlane.color = this.generateRandomColor();
    }
    // Assign a unique ID to the object
    this.objectIdCounter++;
    this._objects.set(this.createObjectId('GridPlane'), gridPlane);
    return gridPlane;
  }

    public createGridPlaneTerrain(objectParameters: ObjectParameters, shadowTexture: Texture2D, randomColor: boolean, terrainParams?: TerrainParameters) {
    const gridPlane = new GridPlaneTerrain(
      objectParameters.device,
      objectParameters.camera,
      objectParameters.shadowCamera,
      objectParameters.ambientLight,
      objectParameters.directionalLight,
      objectParameters.pointLights,
      terrainParams
    );
    gridPlane.pipeline.shadowTexture = shadowTexture;
    if(randomColor === true){
        gridPlane.color = this.generateRandomColor();
    }
    // Assign a unique ID to the object
    this.objectIdCounter++;
    this._objects.set(this.createObjectId('GridPlaneTerrain'), gridPlane);
    return gridPlane;
  }

  public createSphere(objectParameters: ObjectParameters, shadowTexture: Texture2D, randomColor: boolean) {
    const sphere = new Ball(
      objectParameters.device,
      objectParameters.camera,
      objectParameters.shadowCamera,
      objectParameters.ambientLight,
      objectParameters.directionalLight,
      objectParameters.pointLights
    );
    sphere.pipeline.shadowTexture = shadowTexture;
    if(randomColor === true){
      sphere.color = this.generateRandomColor();
    }
    // Assign a unique ID to the object
    this.objectIdCounter++;
    this._objects.set(this.createObjectId('Sphere'), sphere);
    return sphere;
  }

  public createArrow(objectParameters: ObjectParameters, shadowTexture: Texture2D, randomColor: boolean, color?: Color) {
    const arrow = new Arrow(
      objectParameters.device,
      objectParameters.camera,
      objectParameters.shadowCamera,
      objectParameters.ambientLight,
      objectParameters.directionalLight,
      objectParameters.pointLights
    );
    arrow.pipeline.shadowTexture = shadowTexture;
    if(randomColor === true){
      arrow.color = this.generateRandomColor();
    }
    else{
      arrow.color = color || new Color(1, 0, 0, 1); // Default to red if no color is provided
    }
    // Assign a unique ID to the object
    this.objectIdCounter++;
    this._objects.set(this.createObjectId('Arrow'), arrow);
    return arrow;
  }
  public createPlaneWater(objectParameters: ObjectParameters, shadowTexture: Texture2D, waterParams?: WaterParameters) {
    const planeWater = new PlaneWater(
      objectParameters.device,
      objectParameters.camera,
      objectParameters.shadowCamera,
      objectParameters.ambientLight,
      objectParameters.directionalLight,
      objectParameters.pointLights,
      waterParams
    );
    planeWater.pipeline.shadowTexture = shadowTexture;
    // Assign a unique ID to the object
    this.objectIdCounter++;
    this._objects.set(this.createObjectId('PlaneWater'), planeWater);
    return planeWater;
  }  public createGLTF(objectParameters: ObjectParameters, shadowTexture: Texture2D, filePath: string, name?: string) {
    const gltfObject = new GLTFGameObject(
      objectParameters.device,
      objectParameters.camera,
      objectParameters.shadowCamera,
      objectParameters.ambientLight,
      objectParameters.directionalLight,
      objectParameters.pointLights,
      objectParameters.presentationFormat || navigator.gpu.getPreferredCanvasFormat(),
      objectParameters.depthTexture || objectParameters.device.createTexture({
        size: [1280, 720],
        format: "depth32float",
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      }),
      new Vec3(1, 1, 1), // Default scale
      new Vec3(0, 0, 0), // Default position
      new Quaternion(), // Default rotation
      true // Enable lighting
    );
    
    // Initialize the GLTF object asynchronously
    gltfObject.initialize(filePath, shadowTexture).then(() => {
      console.log(`GLTF object ${name || 'unnamed'} loaded successfully from ${filePath}`);
    }).catch(error => {
      console.error('Failed to initialize GLTF object:', error);
    });
    
    // Assign a unique ID to the object
    this.objectIdCounter++;
    const objectId = name ? `gltf_${name}_${this.objectIdCounter}` : this.createObjectId('GLTF');
    this._objects.set(objectId, gltfObject);
    return gltfObject;
  }

  private generateRandomColor() : Color {
    return new Color(Math.random(), Math.random(), Math.random(), Math.random());
  }
}

export interface GameObject {
    pipeline: RenderPipeline | TerrainRenderPipeline | WaterRenderPipeline;
    scale: Vec3;
    position: Vec3;
    rotation: Quaternion;
    color: Color;
    draw: Function;
    update: Function;
    drawShadows: Function;
    animationPlayer?: GLTFAnimationPlayer;
    visible: boolean;
    filePath?: string; // For objects, store the file path
    name?: string;
    
    orbit?: boolean; // TODO: Decouple orbiting from the game object. this was POC
    orbitDistance?: number;
    orbitSpeed?: number;
    orthogonalVector?: Vec3;
    orbitAxis?: Vec3;
    orbitDirection?: number;
    orbitInitialPosition?: Vec3;
    orbitPoint?: Vec3;
    // Add any other common properties and methods here
}

export interface ObjectParameters {
  device: GPUDevice;
  camera: Camera;
  shadowCamera: ShadowCamera;
  ambientLight: AmbientLight;
  directionalLight: DirectionalLight;
  pointLights: PointLightsCollection;
  presentationFormat?: GPUTextureFormat;
  depthTexture?: GPUTexture;
}
