import { Camera } from "../camera/Camera";
import { ShadowCamera } from "../camera/ShadowCamera";
import { GridPlaneTerrain } from "../game_objects/GridPlaneTerrain";
import { ObjectMap } from "../game_objects/ObjectMap";
import { AmbientLight } from "../lights/AmbientLight";
import { DirectionalLight } from "../lights/DirectionalLight";
import { PointLightsCollection } from "../lights/PointLight";
import { Texture2D } from "../texture/Texture2D";

export interface SceneObjects {
    gridPlanes?: GridPlaneTerrain[];
    waterPlane?: any;
    objectMap: ObjectMap;
    device: GPUDevice;
    camera: Camera;
    shadowCamera: ShadowCamera;
    ambientLight: AmbientLight;
    directionalLight: DirectionalLight;
    pointLights: PointLightsCollection;
    shadowTexture: Texture2D;
    gameObjects: any[];
};