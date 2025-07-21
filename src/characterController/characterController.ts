import { Vec3 } from "../math/Vec3";
import { InputManager } from "../input/InputManager";
import { Quaternion } from "../math/Quaternion";
import { GameObject } from "../game_objects/ObjectMap";
import { GLTFGameObject } from "../gltf/GLTFGameObject";

export class CharacterController {
    private object: GameObject;
    private input: InputManager;
    public moveSpeed: number = 0.1;
    public rotationSpeed: number = 0.05; // radians per frame

    constructor(object: any, inputManager: InputManager) {
        this.object = object as GLTFGameObject; // Todo: Gltf objects not implemented correctly yet.
        this.input = inputManager;
    }

    // Call this every frame
    // doing this on frame update might cause issues in the future.
    // consider using a fixed update loop for physics and movement,
    // or based on the event listener
    public update() {
        let forwardInput = 0;
        let rotateX = 0, rotateY = 0, rotateZ = 0;

        if (this.input.isKeyDown('w') || this.input.isKeyDown('W')) forwardInput -= 1;
        if (this.input.isKeyDown('s') || this.input.isKeyDown('S')) forwardInput += 1;
        if (this.input.isKeyDown('d') || this.input.isKeyDown('D')) rotateY -= 1;
        if (this.input.isKeyDown('a') || this.input.isKeyDown('A')) rotateY += 1;

        // Handle jump input
        const isJumping = false; //this.input.isKeyDown(' '); // Space key

        if (this.input.isKeyDown('i')) rotateX += 1;
        if (this.input.isKeyDown('k')) rotateX -= 1;
        if (this.input.isKeyDown('o')) rotateY += 1;
        if (this.input.isKeyDown('l')) rotateY -= 1;
        if (this.input.isKeyDown('p')) rotateZ += 1;
        if (this.input.isKeyDown(';')) rotateZ -= 1;

        if (rotateX !== 0 || rotateY !== 0 || rotateZ !== 0) {
            // Apply rotation using quaternion
            const deltaQy = Quaternion.fromAxisAngle(new Vec3(0, 1, 0), rotateY * this.rotationSpeed);
            this.object.rotation = Quaternion.multiply(deltaQy, this.object.rotation);
            this.object.rotation = Quaternion.normalize(this.object.rotation);
        }

        // Only move if input
        if (forwardInput !== 0) {
            const isRunning = this.input.isKeyDown('Shift');
            
            if (this.object.animationPlayer != null) {
                if (isJumping && this.object.animationPlayer.activeAnimation !== 2) {
                    this.object.animationPlayer.activeAnimation = 2; // Jump animation
                } else if (!isJumping && isRunning && this.object.animationPlayer.activeAnimation !== 3) {
                    this.object.animationPlayer.activeAnimation = 3; // Running animation
                } else if (!isJumping && !isRunning && this.object.animationPlayer.activeAnimation !== 4) {
                    this.object.animationPlayer.activeAnimation = 4; // Walking animation
                }
            }
            
            const forward = this.object.rotation.getForwardVector();

            // Calculate movement direction with speed based on running/walking
            const currentSpeed = isRunning ? this.moveSpeed * 2 : this.moveSpeed;
            let moveDir = Vec3.multiplyScalar(forward, forwardInput)
            // Normalize and apply speed
            moveDir = Vec3.normalize(moveDir);
            moveDir = Vec3.multiplyScalar(moveDir, currentSpeed);
            // Update object's position
            this.object.position = Vec3.add(this.object.position, moveDir);
        }
        else if (isJumping) {
            if (this.object.animationPlayer != null && this.object.animationPlayer.activeAnimation !== 2) {
                this.object.animationPlayer.activeAnimation = 2; // Jump animation
            }
        }
        else {
            if (this.object.animationPlayer != null && this.object.animationPlayer.activeAnimation !== 1) {
                this.object.animationPlayer.activeAnimation = 1; // Idle animation
            }
        }
    }
}
