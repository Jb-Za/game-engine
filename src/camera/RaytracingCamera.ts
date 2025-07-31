import { Vec3 } from "../math/Vec3";
import { UniformBuffer } from "../uniform_buffers/UniformBuffer";
import { Coordinates, InputManager } from "../input/InputManager";

export class RayTracingCamera {
    // Camera position and orientation
    public position = new Vec3(0, 0, -3);
    public forward = new Vec3(0, 0, 1);
    public right = new Vec3(1, 0, 0);
    public up = new Vec3(0, 1, 0);
    
    // Camera parameters
    public fov = 45; // degrees
    public aspectRatio: number;
    
    // Mouse control
    private yaw = 0;
    private pitch = 0;
    private sensitivity = 0.005;
    
    // Movement
    private movementSpeed = 0.02;
    
    // Buffer for sending data to shader
    public cameraBuffer: UniformBuffer;
    
    constructor(device: GPUDevice, aspectRatio: number, private inputManager?: InputManager) {
        this.aspectRatio = aspectRatio;
        
        // Create buffer for camera data (20 floats: eye, forward, right, up, halfWidth, halfHeight + padding)
        this.cameraBuffer = new UniformBuffer(
            device,
            20 * Float32Array.BYTES_PER_ELEMENT,
            "Ray Tracing Camera Buffer"
        );
        
        if (this.inputManager) {
            this.inputManager.onMouseMove.addListener(this.onMouseMove.bind(this));
        }
        
        this.updateVectors();
    }
    
    private updateVectors() {
        this.forward = new Vec3(
            Math.cos(this.yaw) * Math.cos(this.pitch),
            Math.sin(this.pitch),
            Math.sin(this.yaw) * Math.cos(this.pitch)
        );
        this.forward = Vec3.normalize(this.forward);
        
        // Calculate right vector (cross product of world up and forward)
        const worldUp = new Vec3(0, 1, 0);
        this.right = Vec3.normalize(Vec3.cross(worldUp, this.forward));
        
        // Calculate up vector (cross product of forward and right)
        this.up = Vec3.normalize(Vec3.cross(this.forward, this.right));
    }
    
    public update() {
        if (this.inputManager) {
            this.handleMovement();
        }
        
        this.updateVectors();
        this.updateBuffer();
    }
    
    private handleMovement() {
        if (!this.inputManager) return;
        
        let speed = this.movementSpeed;
        if (this.inputManager.isKeyDown('Shift')) {
            speed *= 5;
        }
        
        // Forward/backward movement
        if (this.inputManager.isKeyDown('w') || this.inputManager.isKeyDown('W')) {
            this.position = Vec3.add(this.position, Vec3.multiplyScalar(this.forward, speed));
        }
        if (this.inputManager.isKeyDown('s') || this.inputManager.isKeyDown('S')) {
            this.position = Vec3.subtract(this.position, Vec3.multiplyScalar(this.forward, speed));
        }
        
        // Left/right movement
        if (this.inputManager.isKeyDown('a') || this.inputManager.isKeyDown('A')) {
            this.position = Vec3.subtract(this.position, Vec3.multiplyScalar(this.right, speed));
        }
        if (this.inputManager.isKeyDown('d') || this.inputManager.isKeyDown('D')) {
            this.position = Vec3.add(this.position, Vec3.multiplyScalar(this.right, speed));
        }
        
        // Up/down movement
        if (this.inputManager.isKeyDown('q') || this.inputManager.isKeyDown('Q')) {
            this.position = Vec3.add(this.position, Vec3.multiplyScalar(this.up, speed));
        }
        if (this.inputManager.isKeyDown('e') || this.inputManager.isKeyDown('E')) {
            this.position = Vec3.subtract(this.position, Vec3.multiplyScalar(this.up, speed));
        }
        
        // Reset position
        if (this.inputManager.isKeyDown('r') || this.inputManager.isKeyDown('R')) {
            this.position = new Vec3(0, 0, -3);
            this.yaw = 0;
            this.pitch = 0;
        }
    }
    
    private updateBuffer() {
        // Calculate half dimensions for the image plane
        const fovYRadians = (this.fov * Math.PI) / 180;
        const halfHeight = Math.tan(fovYRadians / 2.0);
        const halfWidth = halfHeight * this.aspectRatio;
        
        const cameraData = new Float32Array([
            // eye (vec3f + padding)
            this.position.x, this.position.y, this.position.z, 0,
            // forward (vec3f + padding)
            this.forward.x, this.forward.y, this.forward.z, 0,
            // right (vec3f + padding)
            this.right.x, this.right.y, this.right.z, 0,
            // up (vec3f + padding)
            this.up.x, this.up.y, this.up.z, 0,
            // halfWidth, halfHeight, and padding
            halfWidth, halfHeight, 0, 0
        ]);
        
        this.cameraBuffer.update(cameraData);
    }
    
    private onMouseMove(mouseMovement: Coordinates) {
        // Update yaw and pitch based on mouse movement
        this.yaw += mouseMovement.x * this.sensitivity;
        this.pitch += mouseMovement.y * this.sensitivity;
        
        // Clamp pitch to prevent gimbal lock
        this.pitch = Math.max(Math.min(this.pitch, Math.PI / 2 - 0.01), -Math.PI / 2 + 0.01);
    }
    
    // Utility methods
    public setPosition(position: Vec3) {
        this.position = position;
    }
    
    public setFOV(fov: number) {
        this.fov = fov;
    }
    
    public setAspectRatio(aspectRatio: number) {
        this.aspectRatio = aspectRatio;
    }
    
    public lookAt(target: Vec3) {
        this.forward = Vec3.normalize(Vec3.subtract(target, this.position));
        const worldUp = new Vec3(0, 1, 0);
        this.right = Vec3.normalize(Vec3.cross(worldUp, this.forward));
        this.up = Vec3.normalize(Vec3.cross(this.forward, this.right));
    }
    
    public getCameraBuffer(): UniformBuffer {
        return this.cameraBuffer;
    }
    
    public getPosition(): Vec3 {
        return this.position;
    }
    
    public getForward(): Vec3 {
        return this.forward;
    }
}