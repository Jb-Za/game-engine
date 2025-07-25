import { Coordinates, InputManager } from "../input/InputManager";
// import { Mat3x3 } from "../math/Mat3x3";
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
    public far = 1000;

    // CAMERA MOVEMENT
    private sensitivity = 0.005;
    private yaw = 0;
    private pitch = 0;
    private _targetObject: any | null = null; // todo: fix type

    public get targetObject() {
        return this._targetObject;
    }

    public set targetObject(value: any | null) { // todo: fix type
        this._targetObject = value;
        if (value != null) {
            this.eye = Vec3.add(value.position, new Vec3(0, 0.5, 0));
            this.target = value.position;
        }
    }

    // MATRICES
    private perspective = Mat4x4.identity();
    private view = Mat4x4.identity();
    private projectionView = Mat4x4.identity();

    private rotation = Mat4x4.identity();

    constructor(device: GPUDevice, private aspectRatio: number, private inputmanager?: InputManager) { // todo: fix type
        this.buffer = new UniformBuffer(device, this.projectionView, "Camera Buffer");
        this.eyeBuffer = new UniformBuffer(device, 16, "Camera Eye Buffer");
        if (this.inputmanager != null) {
            this.inputmanager.onMouseMove.addListener(this.onMouseMove.bind(this));
        }
    }

    public update() {
        if (this.inputmanager != null) {
            if (this.targetObject != null) {
                const targetPosition = this.targetObject.position;
                const targetRotation = this.targetObject.rotation;
                //this.target = Vec3.add(targetPosition, new Vec3(0, 1, 0)); // Look at head height

                // // Get the forward direction from the rotation (assuming rotation is a matrix)
                const rotMat = Mat4x4.rotationFromQuaternion(targetRotation);
                const forward = Mat4x4.multiplyVec(rotMat, new Vec3(0, 0, -1));
                // // Calculate the camera position 3 units behind the target, and 1 unit above
                const cameraOffset = Vec3.multiplyScalar(forward, 3);
                const cameraHeight = new Vec3(0, 1.5, 0); // 1 unit above
                this.eye = Vec3.add(Vec3.add(targetPosition, cameraOffset), cameraHeight);
                //this.eye = Vec3.add(Vec3.add(targetPosition, new Vec3(1,0,0)), new Vec3(0, 1, 0));

                this.target = Vec3.add(targetPosition, new Vec3(0, 1, 0));

                this.view = Mat4x4.lookAt(this.eye, this.target, this.up);
            }
            else {
                let movementSpeed = 0.02;
                if (this.inputmanager.isKeyDown('Shift')) {
                    movementSpeed = 0.02 * 5;
                }
                const forward = new Vec3(0, 0, -1);
                const right = new Vec3(-1, 0, 0);
                //const up = new Vec3(0, 1, 0);

                const rotatedForward = Mat4x4.multiplyVec(this.rotation, forward);
                const rotatedRight = Mat4x4.multiplyVec(this.rotation, right);

                if (this.inputmanager.isKeyDown('w') || this.inputmanager.isKeyDown('W')) {
                    this.eye = Vec3.add(this.eye, Vec3.multiplyScalar(rotatedForward, movementSpeed));
                    this.target = Vec3.add(this.target, Vec3.multiplyScalar(rotatedForward, movementSpeed));
                }
                if (this.inputmanager.isKeyDown('s') || this.inputmanager.isKeyDown('S')) {
                    this.eye = Vec3.subtract(this.eye, Vec3.multiplyScalar(rotatedForward, movementSpeed));
                    this.target = Vec3.subtract(this.target, Vec3.multiplyScalar(rotatedForward, movementSpeed));
                }
                if (this.inputmanager.isKeyDown('a') || this.inputmanager.isKeyDown('A')) {
                    this.eye = Vec3.subtract(this.eye, Vec3.multiplyScalar(rotatedRight, movementSpeed));
                    this.target = Vec3.subtract(this.target, Vec3.multiplyScalar(rotatedRight, movementSpeed));
                }
                if (this.inputmanager.isKeyDown('d') || this.inputmanager.isKeyDown('D')) {
                    this.eye = Vec3.add(this.eye, Vec3.multiplyScalar(rotatedRight, movementSpeed));
                    this.target = Vec3.add(this.target, Vec3.multiplyScalar(rotatedRight, movementSpeed));
                }

            }

            this.view = Mat4x4.lookAt(this.eye, this.target, this.up);
        }

        this.perspective = Mat4x4.perspective(this.fov, this.aspectRatio, this.near, this.far);
        this.projectionView = Mat4x4.multiply(this.perspective, this.view);

        this.buffer.update(this.projectionView);
        this.eyeBuffer.update(this.eye);
    }

    public onMouseMove(mouseMovement: Coordinates) {
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