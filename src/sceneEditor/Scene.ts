import { Camera } from "../camera/Camera";
import { ShadowCamera } from "../camera/ShadowCamera";
import { ObjectMap, ObjectParameters } from "../game_objects/ObjectMap";
import { InputManager } from "../input/InputManager";
import { AmbientLight } from "../lights/AmbientLight";
import { DirectionalLight } from "../lights/DirectionalLight";
import { PointLightsCollection } from "../lights/PointLight";
import { Color } from "../math/Color";
import { Quaternion } from "../math/Quaternion";
import { Vec3 } from "../math/Vec3";
import { Texture2D } from "../texture/Texture2D";

interface SceneObject {
    id: string,
    position: number[],
    rotation: number[],
    color: number[],
    scale: number[]
}

interface PointLight {
    color: Color,
    intensity: number,
    position: Vec3,
    specularIntensity: number,
    specularColor: Color
}

interface SceneConfiguration {
    Camera: {
        position: number[],
        target: number[],
        up: number[],
        fov: number
    },
    AmbientLight: {
        color: number[],
        intensity: number
    },
    DirectionalLight: {
        color: number[],
        intensity: number,
        direction: number[],
        specularIntensity: number,
        specularColor: number[]
    },
    shadowCamera: {
        position: number[],
        target: number[]
    },
    PointLights: PointLight[],
    sceneObjects: SceneObject[]
}

export class Scene {
    private _camera: Camera;
    private _ambientLight: AmbientLight;
    private _directionalLight: DirectionalLight;
    private _pointLights: PointLightsCollection;
    private _shadowCamera: ShadowCamera;
    private _sceneObjects: ObjectMap;
    private _objectParameters: ObjectParameters;
    private _shadowTexture: Texture2D;


    public getCamera(): Camera {
        return this._camera;
    }

    public getAmbientLight(): AmbientLight {
        return this._ambientLight;
    }

    public getDirectionalLight(): DirectionalLight {
        return this._directionalLight;
    }

    public getPointLights(): PointLightsCollection {
        return this._pointLights;
    }

    public getShadowCamera(): ShadowCamera {
        return this._shadowCamera;
    }

    public getSceneObjects(): ObjectMap {
        return this._sceneObjects;
    }

    public addSceneObjects(objects: SceneObject[]): ObjectMap {
        objects.forEach(object => {
            const position = new Vec3(object.position[0], object.position[1], object.position[2]);
            const rotation = new Quaternion(object.rotation[0], object.rotation[1], object.rotation[2], 1);
            const color = new Color(object.color[0], object.color[1], object.color[2], object.color[3]);
            const scale = new Vec3(object.scale[0], object.scale[1], object.scale[2]);
            const objectType = object.id.split('_')[0].toLowerCase(); // Extract type from ID like "cube_123456789"
            switch (objectType) {
                case "cube":
                    const cube = this._sceneObjects.createCube(this._objectParameters, this._shadowTexture, false);
                    cube.position = position;
                    cube.rotation = rotation;
                    cube.color = color;
                    cube.scale = scale;
                    break;
                case "sphere":
                    const sphere = this._sceneObjects.createSphere(this._objectParameters, this._shadowTexture, false);
                    sphere.position = position;
                    sphere.rotation = rotation;
                    sphere.color = color;
                    sphere.scale = scale;
                    break;
                case "gltf":
                    break; // TODO: Add GLTF support
                default:
                    break;
            }
        });
        
        // Return the updated scene objects
        return this._sceneObjects;
    }

    public deleteSceneObject(id: string): void {
        this._sceneObjects.objects.delete(id);
    }

    public addNewObject(type: string): Scene {
        const objectId = `${type}_${Date.now()}`;
        const object = {
            id: objectId,
            position: [0,0,0], //TODO: make this camera.target at some point
            rotation: [0,0,0],
            color: [1,1,1,1],
            scale: [1,1,1]
        }
        this.addSceneObjects([object]);
        
        // Return the entire scene for re-parsing
        return this;
    }

    constructor(SceneData: SceneConfiguration, device: GPUDevice, aspectRatio: number, inputManager: InputManager, shadowTexture: Texture2D) {
        this._camera = this.setupCamera(device, aspectRatio, inputManager, SceneData.Camera ?? null);
        this._shadowCamera = this.setupShadowCamera(device, SceneData.shadowCamera ?? null);
        this._ambientLight = this.setupAmbientLight(device, SceneData.AmbientLight ?? null);
        this._directionalLight = this.setupDirectionalLight(device, SceneData.DirectionalLight ?? null);
        this._pointLights = this.setupPointLights(device, SceneData.PointLights ?? null);
        this._shadowTexture = shadowTexture;

        this._objectParameters = {
            device: device,
            camera: this._camera,
            shadowCamera: this._shadowCamera,
            ambientLight: this._ambientLight,
            directionalLight: this._directionalLight,
            pointLights: this._pointLights,
        };
        this._sceneObjects = new ObjectMap();
        this.setupSceneObjects(device, SceneData.sceneObjects ?? null);
    }

    private setupCamera(device: GPUDevice, aspectRatio: number, inputManager: InputManager, cameraData: SceneConfiguration["Camera"] | null): Camera {
        const camera = new Camera(device, aspectRatio, inputManager);

        if (cameraData != null) {
            camera.eye = new Vec3(cameraData.position[0] ?? 0, cameraData.position[1] ?? 0, cameraData.position[2] ?? 0);
            camera.target = new Vec3(cameraData.target[0] ?? 0, cameraData.target[1] ?? 0, cameraData.target[2] ?? 0);
            camera.fov = cameraData.fov ?? 75;
        }

        return camera;
    }

    private setupAmbientLight(device: GPUDevice, ambientLightData: SceneConfiguration["AmbientLight"] | null): AmbientLight {
        const ambientLight = new AmbientLight(device);

        if (ambientLightData != null) {
            ambientLight.color = new Color(ambientLightData.color[0] ?? 0, ambientLightData.color[1] ?? 0, ambientLightData.color[2] ?? 0);
            ambientLight.intensity = ambientLightData.intensity ?? 1;
        }

        return ambientLight;
    }

    private setupShadowCamera(device: GPUDevice, shadowCameraData: SceneConfiguration["shadowCamera"] | null): ShadowCamera {
        const shadowCamera = new ShadowCamera(device);

        if (shadowCameraData != null) {
            shadowCamera.eye = new Vec3(shadowCameraData.position[0] ?? 0, shadowCameraData.position[1] ?? 0, shadowCameraData.position[2] ?? 0);
            shadowCamera.target = new Vec3(shadowCameraData.target[0] ?? 0, shadowCameraData.target[1] ?? 0, shadowCameraData.target[2] ?? 0);
        }

        return shadowCamera;
    }

    private setupDirectionalLight(device: GPUDevice, directionalLightData: SceneConfiguration["DirectionalLight"] | null): DirectionalLight {
        const directionalLight = new DirectionalLight(device);

        if (directionalLightData != null) {
            directionalLight.color = new Color(directionalLightData.color[0] ?? 0, directionalLightData.color[1] ?? 0, directionalLightData.color[2] ?? 0);
            directionalLight.intensity = directionalLightData.intensity ?? 0;
            directionalLight.specularIntensity = directionalLightData.specularIntensity ?? 0;
            directionalLight.specularColor = new Color(directionalLightData.specularColor[0] ?? 0, directionalLightData.specularColor[1] ?? 0, directionalLightData.specularColor[2] ?? 0);
            directionalLight.direction = new Vec3(directionalLightData.direction[0] ?? 0, directionalLightData.direction[1] ?? 0, directionalLightData.direction[2] ?? 0);
        }

        return directionalLight;
    }

    private setupPointLights(device: GPUDevice, pointLightData: SceneConfiguration["PointLights"] | null): PointLightsCollection {
        const pointLights = new PointLightsCollection(device, pointLightData?.length ?? 0);

        if (pointLightData != null) {
            for (let i = 0; i < pointLightData.length; i++) {
                pointLights.lights[i].color = new Color(pointLightData[i].color[0] ?? 0, pointLightData[i].color[1] ?? 0, pointLightData[i].color[2] ?? 0);
                pointLights.lights[i].intensity = pointLightData[i].intensity ?? 1;
                pointLights.lights[i].position = new Vec3(pointLightData[i].position[0] ?? 0, pointLightData[i].position[1] ?? 0, pointLightData[i].position[2] ?? 0);
                pointLights.lights[i].specularIntensity = pointLightData[i].specularIntensity ?? 0;
                pointLights.lights[i].specularColor = new Color(pointLightData[i].specularColor[0] ?? 0, pointLightData[i].specularColor[1] ?? 0, pointLightData[i].specularColor[2] ?? 0);

            }
        }

        return pointLights;
    }

    private setupSceneObjects(_device: GPUDevice, sceneObjects: SceneConfiguration["sceneObjects"] | null): void {
        if (sceneObjects) {
            this.addSceneObjects(sceneObjects);
        }
    }
}