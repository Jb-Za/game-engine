import { Camera } from "../camera/Camera";
import { ShadowCamera } from "../camera/ShadowCamera";
import { AmbientLight } from "../lights/AmbientLight";
import { DirectionalLight } from "../lights/DirectionalLight";
import { PointLightsCollection } from "../lights/PointLight";
import { Color } from "../math/Color";
import { Vec3 } from "../math/Vec3";
import { RenderPipeline } from "../render_pipelines/RenderPipeline";
import { Texture2D } from "../texture/Texture2D";
import { Ball } from "./Ball";
// import { Ball } from "./Ball";
import { Cube } from "./Cube";
import { Arrow } from "./Arrow";
import { Quaternion } from "../math/Quaternion";
import { GLTFAnimationPlayer } from "../gltf/GLTFAnimationPlayer";
// import { Floor } from "./Floor";
// import { Paddle } from "./Paddle";

export class ObjectMap {
  public _objects = new Map<number, GameObject>();

  public get objects(): Map<number, GameObject> {
    return this._objects;
  }
  private objectIdCounter: number = 0;

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
    const id = this.objectIdCounter++;
    this._objects.set(id, cube);
    return cube;
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
    const id = this.objectIdCounter++;
    this._objects.set(id, sphere);
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
    const id = this.objectIdCounter++;
    this._objects.set(id, arrow);
    return arrow;
  }

  private generateRandomColor() : Color {
    return new Color(Math.random(), Math.random(), Math.random(), Math.random());
  }
}

export interface GameObject {
    pipeline: RenderPipeline;
    scale: Vec3;
    position: Vec3;
    rotation: Quaternion;
    color: Color;
    draw: Function;
    update: Function;
    drawShadows: Function;
    animationPlayer?: GLTFAnimationPlayer;
    
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

interface ObjectParameters {
  device: GPUDevice;
  camera: Camera;
  shadowCamera: ShadowCamera;
  ambientLight: AmbientLight;
  directionalLight: DirectionalLight;
  pointLights: PointLightsCollection;
}
