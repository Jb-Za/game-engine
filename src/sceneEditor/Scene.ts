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
    scale: number[],
    filePath?: string,  // For GLTF objects
    name?: string      // For GLTF objects
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
    ShadowCamera: {
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

    public saveScene(): void{
        // Convert internal Map of scene objects into a serializable array
        const sceneObjectsArray: SceneObject[] = [];

        for (const [id, obj] of this._sceneObjects._objects.entries()) {
            const position = obj.position ? [obj.position.x ?? 0, obj.position.y ?? 0, obj.position.z ?? 0] : [0, 0, 0];
            const rotation = obj.rotation ? [obj.rotation.x ?? 0, obj.rotation.y ?? 0, obj.rotation.z ?? 0] : [0, 0, 0];
            const scale = obj.scale ? [obj.scale.x ?? 1, obj.scale.y ?? 1, obj.scale.z ?? 1] : [1, 1, 1];
            const color = obj.color ? [
                (obj.color.r ?? 1),
                (obj.color.g ?? 1),
                (obj.color.b ?? 1),
                (obj.color.a ?? 1)
            ] : [1, 1, 1, 1];

            const entry: any = {
                id: id,
                position: position,
                rotation: rotation,
                color: color,
                scale: scale,
                filePath: obj.filePath ? obj.filePath : undefined
            };

            sceneObjectsArray.push(entry as SceneObject);
        }

        const shadowCameraData = this._shadowCamera ? {
            position: [this._shadowCamera.eye.x, this._shadowCamera.eye.y, this._shadowCamera.eye.z],
            target: [this._shadowCamera.target.x, this._shadowCamera.target.y, this._shadowCamera.target.z]
        } : null;

        const cameraData = this._camera ? {
            position: [this._camera.eye.x, this._camera.eye.y, this._camera.eye.z],
            target: [this._camera.target.x, this._camera.target.y, this._camera.target.z],
            //up: [this._camera.up.x, this._camera.up.y, this._camera.up.z],
            fov: this._camera.fov
        } : null;

        const directionalLightData = this._directionalLight ? {
            color: [this._directionalLight.color.r, this._directionalLight.color.g, this._directionalLight.color.b, this._directionalLight.color.a],
            intensity: this._directionalLight.intensity,
            direction: [this._directionalLight.direction.x, this._directionalLight.direction.y, this._directionalLight.direction.z],
            specularIntensity: this._directionalLight.specularIntensity,
            specularColor: [this._directionalLight.specularColor.r, this._directionalLight.specularColor.g, this._directionalLight.specularColor.b, this._directionalLight.specularColor.a]
        } : null;

        const ambientLightData = this._ambientLight ? {
            color: [this._ambientLight.color.r, this._ambientLight.color.g, this._ambientLight.color.b, this._ambientLight.color.a],
            intensity: this._ambientLight.intensity
        } : null;

        const pointLightsData = this._pointLights ? this._pointLights.lights.map(light => ({
            color: new Color(light.color.r, light.color.g, light.color.b, light.color.a),
            intensity: light.intensity,
            position: new Vec3(light.position.x, light.position.y, light.position.z),
            specularIntensity: light.specularIntensity,
            specularColor: new Color(light.specularColor.r, light.specularColor.g, light.specularColor.b, light.specularColor.a)
        })) : null;

        const sceneData = {
            sceneObjects: sceneObjectsArray,
            ShadowCamera: shadowCameraData,
            Camera: cameraData,
            DirectionalLight: directionalLightData,
            AmbientLight: ambientLightData,
            PointLights: pointLightsData
        };

        const json = JSON.stringify(sceneData, null, 2);

        // download to device
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'scene.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    public addSceneObjects(objects: SceneObject[]): ObjectMap {
        for (const object of objects) {
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
                    // Create GLTF object using the provided data
                    if (object.filePath) {
                        const gltfObject = this._sceneObjects.createGLTF(
                            this._objectParameters, 
                            this._shadowTexture, 
                            object.filePath, 
                            object.name
                        );
                        gltfObject.position = position;
                        gltfObject.rotation = rotation;
                        gltfObject.scale = scale;
                        gltfObject.filePath = object.filePath;
                        gltfObject.name = object.name || "GLTF Object";                        
                        if(gltfObject.gltfScene && gltfObject.gltfScene.boundingBox){
                            gltfObject.gltfScene.boundingBox.max = Vec3.multiply(gltfObject.gltfScene.boundingBox.max, scale);
                            gltfObject.gltfScene.boundingBox.min = Vec3.multiply(gltfObject.gltfScene.boundingBox.min, scale);

                            // const cube = this._sceneObjects.createCube(this._objectParameters, this._shadowTexture, true);
                            // cube.position = Vec3.add(position, Vec3.scale(Vec3.add(gltfObject.gltfScene.boundingBox.min, gltfObject.gltfScene.boundingBox.max), 0.5));
                            // cube.scale = Vec3.subtract(gltfObject.gltfScene.boundingBox.max, gltfObject.gltfScene.boundingBox.min);
                            // cube.color = new Color(1, 1, 0, 0.25); // Yellow with some transparency
                            // cube.visible = false; // Hide the bounding box by default

                            // gltfObject.boundingBoxCube = cube;
                            gltfObject.boundingBox = gltfObject.gltfScene.boundingBox;
                        }

                        // Note: GLTF objects manage their own color internally
                    }
                    break;
                default:
                    break;
            }
        };



        // Return the updated scene objects
        return this._sceneObjects;
    }

    public deleteSceneObject(id: string): void {
        this._sceneObjects.objects.delete(id);
    }

    public async addNewObject(type: string, data?: any): Promise<Scene> {
        const objectId = `${type}_${Date.now()}`;
        let object: any = {
            id: objectId,
            position: [0,0,0], //TODO: make this camera.target at some point
            rotation: [0,0,0],
            color: [1,1,1,1],
            scale: [1,1,1]
        };

        // Add GLTF-specific data if provided
        if (type === 'gltf' && data) {
            object = {
                ...object,
                filePath: data.filePath,
                name: data.name || `gltf_${Date.now()}`
            };
        }

        this.addSceneObjects([object]);
        
        // Return the entire scene for re-parsing
        return this;
    }    
    
    constructor(SceneData: SceneConfiguration, device: GPUDevice, aspectRatio: number, inputManager: InputManager, shadowTexture: Texture2D, presentationFormat: GPUTextureFormat, depthTexture: GPUTexture) {
        this._camera = this.setupCamera(device, aspectRatio, inputManager, SceneData.Camera ?? null);
        this._ambientLight = this.setupAmbientLight(device, SceneData.AmbientLight ?? null);
        this._directionalLight = this.setupDirectionalLight(device, SceneData.DirectionalLight ?? null);
        this._shadowCamera = this.setupShadowCamera(device, SceneData.ShadowCamera ?? null);
        this._pointLights = this.setupPointLights(device, SceneData.PointLights ?? null);
        this._shadowTexture = shadowTexture;

        this._objectParameters = {
            device: device,
            camera: this._camera,
            shadowCamera: this._shadowCamera,
            ambientLight: this._ambientLight,
            directionalLight: this._directionalLight,
            pointLights: this._pointLights,
            presentationFormat: presentationFormat,
            depthTexture: depthTexture,
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

    private setupShadowCamera(device: GPUDevice, shadowCameraData: SceneConfiguration["ShadowCamera"] | null): ShadowCamera {
        const shadowCamera = new ShadowCamera(device);

        const sunRadius = 10;
        const sceneCenter = new Vec3(0, 0, 0);
        // we use directional light to simulate sunlight

        const sunPosition = Vec3.add(
            sceneCenter,
            Vec3.scale(this._directionalLight.direction, -sunRadius)
        );

        if (shadowCameraData != null) {
            shadowCamera.eye = new Vec3(sunPosition.x, sunPosition.y, sunPosition.z);
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

    private async setupSceneObjects(_device: GPUDevice, sceneObjects: SceneConfiguration["sceneObjects"] | null): Promise<void> {
        if (sceneObjects) {
            await this.addSceneObjects(sceneObjects);
        }
    }
}