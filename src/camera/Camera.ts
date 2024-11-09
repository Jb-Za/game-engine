import { Coordinates, InputManager } from "../input/InputManager";
import { Mat3x3 } from "../math/Mat3x3";
import { Mat4x4 } from "../math/Mat4x4";
import { Vec3 } from "../math/Vec3";
import { UniformBuffer } from "../uniform_buffers/UniformBuffer";

export class Camera {
    // BUFFER
    public buffer: UniformBuffer;
    public eyeBuffer: UniformBuffer;

    //TODO: getters and setters
    // VIEW PROPERTIES
    public eye = new Vec3(0, 0, -3);
    public target = new Vec3(0, 0, 0);
    private up = new Vec3(0, 1, 0);

    // PERSPECTIVE PROPERTIES
    public fov = 45;
    public near = 0.01;
    public far = 100;

    // CAMERA MOVEMENT
    private sensitivity = 0.005;
    private yaw = 0;
    private pitch = 0;

    // MATRICES
    private perspective = Mat4x4.identity();
    private view = Mat4x4.identity();
    private projectionView = Mat4x4.identity();

    private rotation = Mat4x4.identity();

    constructor(device: GPUDevice, private aspectRatio: number, private inputmanager?: InputManager) {
        this.buffer = new UniformBuffer(device, this.projectionView, "Camera Buffer");
        this.eyeBuffer = new UniformBuffer(device, 16, "Camera Eye Buffer");
        if(this.inputmanager != null){
            this.inputmanager.onMouseMove.addListener(this.onMouseMove.bind(this));
        }
    }

    public update() {
        if(this.inputmanager != null){
            const movementSpeed = 0.02;
            const forward = new Vec3(0, 0, -1);
            const right = new Vec3(-1, 0, 0);
            //const up = new Vec3(0, 1, 0);

            const rotatedForward = Mat4x4.multiplyVec(this.rotation, forward);
            const rotatedRight = Mat4x4.multiplyVec(this.rotation, right);
            
            if (this.inputmanager.isKeyDown('w')) {
                this.eye = Vec3.add(this.eye, Vec3.multiplyScalar(rotatedForward, movementSpeed));
                this.target = Vec3.add(this.target, Vec3.multiplyScalar(rotatedForward, movementSpeed));
            }
            if (this.inputmanager.isKeyDown('s')) {
                this.eye = Vec3.subtract(this.eye, Vec3.multiplyScalar(rotatedForward, movementSpeed));
                this.target = Vec3.subtract(this.target, Vec3.multiplyScalar(rotatedForward, movementSpeed));
            }
            if (this.inputmanager.isKeyDown('a')) {
                this.eye = Vec3.subtract(this.eye, Vec3.multiplyScalar(rotatedRight, movementSpeed));
                this.target = Vec3.subtract(this.target, Vec3.multiplyScalar(rotatedRight, movementSpeed));
            }
            if (this.inputmanager.isKeyDown('d')) {
                this.eye = Vec3.add(this.eye, Vec3.multiplyScalar(rotatedRight, movementSpeed));
                this.target = Vec3.add(this.target, Vec3.multiplyScalar(rotatedRight, movementSpeed));
            }
        }

        this.view = Mat4x4.lookAt(this.eye, this.target, this.up);
        this.perspective = Mat4x4.perspective(this.fov, this.aspectRatio, this.near, this.far);
        this.projectionView = Mat4x4.multiply(this.perspective, this.view);

        this.buffer.update(this.projectionView);
        this.eyeBuffer.update(this.eye);
    }

    public onMouseMove(mouseMovement: Coordinates){
        // Update yaw and pitch based on mouse movement
        this.yaw += -mouseMovement.x * this.sensitivity;
        this.pitch += mouseMovement.y * this.sensitivity;

        // Clamp pitch to prevent gimbal lock
        this.pitch = Math.max(Math.min(this.pitch, Math.PI / 2 - 0.01), -Math.PI / 2 + 0.01);

        // Calculate combined rotation matrix for yaw and pitch
        this.rotation = Mat4x4.multiply(Mat4x4.rotationY(this.yaw), Mat4x4.rotationX(this.pitch));

        // Forward vector in the camera's local space
        const forward = new Vec3(0, 0, -1);
        const rotatedForward = Mat4x4.multiplyVec(this.rotation, forward);

        // Update target by applying the rotated forward vector to the camera's eye position
        this.target = Vec3.add(this.eye, rotatedForward);
    }


}