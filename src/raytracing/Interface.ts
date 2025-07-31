import { Vec3 } from "../math/Vec3";
import { Vec2 } from "../math/Vec2";

export interface RaytracerMaterial {
    color: Vec3;
    roughness: number; // 0 = mirror, 1 = diffuse
    // metallic: number; // 0 = non-metallic, 1 = metallic
    emissionStrength: number; // Optional emission strength for light-emitting materials
    emissionColor?: Vec3; // Optional emission color
}

export interface RayTracedSphere {
    center: Vec3;
    radius: number;
    material: RaytracerMaterial;
}

export interface RayTracedPlane {
    position: Vec3;
    normal: Vec3;
    material: RaytracerMaterial;
    size: Vec2; // width and height bounds
}

export interface CameraData {
    eye: Vec3;
    forward: Vec3;
    right: Vec3;
    up: Vec3;
    fov: number;
    aspect: number;
}