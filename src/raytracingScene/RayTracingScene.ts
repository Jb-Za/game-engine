import { Vec3 } from "../math/Vec3";
import { Vec2 } from "../math/Vec2";
import { Camera } from "../camera/Camera";
import { RayTracedPlane, RayTracedSphere, RaytracerMaterial } from "../raytracing/Interface";
import { InputManager } from "../input/InputManager";

export interface RayTracedSphereWithId extends RayTracedSphere {
    id: string;
}

export interface RayTracedPlaneWithId extends RayTracedPlane {
    id: string;
}

export class RayTracingScene {
    private _camera: Camera;
    private _spheres: RayTracedSphereWithId[] = [];
    private _planes: RayTracedPlaneWithId[] = [];

    constructor(device: GPUDevice, aspectRatio: number, inputManager: InputManager) {
        this._camera = new Camera(device, aspectRatio, inputManager);
        this._camera.eye = new Vec3(0.65, 0.7, 0.91);
        this._camera.target = new Vec3(-0.16, 0.51, 0.38);

        // Initialize with default scene objects
        this.initializeDefaultScene();
    }

    // Getters
    public getCamera(): Camera { return this._camera; }
    public getSpheres(): RayTracedSphereWithId[] { return this._spheres; }
    public getPlanes(): RayTracedPlaneWithId[] { return this._planes; }

    // Get spheres without ID for rendering pipeline
    public getSpheresForRendering(): RayTracedSphere[] {
        return this._spheres.map(sphere => ({
            center: sphere.center,
            radius: sphere.radius,
            material: sphere.material
        }));
    }

    // Get planes without ID for rendering pipeline
    public getPlanesForRendering(): RayTracedPlane[] {
        return this._planes.map(plane => ({
            position: plane.position,
            normal: plane.normal,
            material: plane.material,
            size: plane.size
        }));
    }

    private initializeDefaultScene() {
        // Add default light source
        this.addSphere("sphere_0", new Vec3(-5, -2, 0.5), 1.0, { 
            color: new Vec3(1, 1, 1), 
            reflectivity: 0, 
            roughness: 0, 
            emissionStrength: 20, 
            emissionColor: new Vec3(1, 1, 1),
            indexOfRefraction: 0
        });

        // Add green reflective sphere
        this.addSphere("sphere_1", new Vec3(-1, 0.5, 0), 0.5, { 
            color: new Vec3(1, 1, 1), 
            reflectivity: 0, 
            roughness: 1, 
            emissionStrength: 0, 
            emissionColor: new Vec3(1, 1, 1),
            indexOfRefraction: 3.0
        });

        // Add glass sphere
        this.addSphere("sphere_2", new Vec3(-1, 0.1, -1), 0.5, { 
            color: new Vec3(0.2, 1, 0.2), 
            reflectivity: 1, 
            roughness: 0, 
            emissionStrength: 0, 
            emissionColor: new Vec3(1, 1, 1),
            indexOfRefraction: 0
        });

        // Add large sphere
        this.addSphere("sphere_3", new Vec3(0, 6, -3), 6, { 
            color: new Vec3(0.8, 0.5, 0.5), 
            roughness: 1, 
            emissionStrength: 0 
        });

        // // Add floor
        // this.addPlane("floor", new Vec3(0, -1, 0), new Vec3(0, 1, 0), { 
        //     color: new Vec3(0.5, 0.5, 0.5), 
        //     roughness: 1, 
        //     emissionStrength: 0 
        // }, new Vec2(10, 10));
    }

    public addSphere(id: string, position: Vec3, radius: number, material: RaytracerMaterial): RayTracedSphereWithId {
        const sphere: RayTracedSphereWithId = {
            id,
            center: position,
            radius,
            material
        };
        this._spheres.push(sphere);
        return sphere;
    }

    public addPlane(id: string, position: Vec3, normal: Vec3, material: RaytracerMaterial, size: Vec2): RayTracedPlaneWithId {
        const plane: RayTracedPlaneWithId = {
            id,
            position,
            normal,
            material,
            size
        };
        this._planes.push(plane);
        return plane;
    }

    public removeSphere(id: string): void {
        this._spheres = this._spheres.filter(sphere => sphere.id !== id);
    }

    public removePlane(id: string): void {
        this._planes = this._planes.filter(plane => plane.id !== id);
    }

    public addNewObject(type: 'sphere' | 'light'): RayTracingScene {
        const id = `${type}_${Date.now()}`;
        
        switch(type) {
            case 'sphere':
                this.addSphere(id, new Vec3(0, 0, 0), 0.5, {
                    color: new Vec3(1, 0, 0),
                    roughness: 0.5,
                    emissionStrength: 0
                });
                break;
            // case 'plane':
            //     this.addPlane(id, new Vec3(0, 0, 0), new Vec3(0, 1, 0), {
            //         color: new Vec3(0.7, 0.7, 0.7),
            //         roughness: 1,
            //         emissionStrength: 0
            //     }, new Vec2(5, 5));
            //     break;
            case 'light':
                this.addSphere(id, new Vec3(0, 2, 0), 0.3, {
                    color: new Vec3(1, 1, 1),
                    roughness: 0,
                    emissionStrength: 10,
                    emissionColor: new Vec3(1, 1, 1)
                });
                break;
        }
        return this;
    }

    public deleteObject(id: string): void {
        this.removeSphere(id);
        this.removePlane(id);
    }

    public updateSphere(id: string, updates: Partial<RayTracedSphereWithId>): void {
        const sphereIndex = this._spheres.findIndex(sphere => sphere.id === id);
        if (sphereIndex !== -1) {
            this._spheres[sphereIndex] = { ...this._spheres[sphereIndex], ...updates };
        }
    }

    public updatePlane(id: string, updates: Partial<RayTracedPlaneWithId>): void {
        const planeIndex = this._planes.findIndex(plane => plane.id === id);
        if (planeIndex !== -1) {
            this._planes[planeIndex] = { ...this._planes[planeIndex], ...updates };
        }
    }
}
