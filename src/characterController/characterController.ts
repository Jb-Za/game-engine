import { Vec3 } from "../math/Vec3";
import { InputManager } from "../input/InputManager";
import { Quaternion } from "../math/Quaternion";
import { GameObject } from "../game_objects/ObjectMap";

export class CharacterController {
    private object: GameObject;
    private input: InputManager;
    public moveSpeed: number = 0.1;
    public rotationSpeed: number = 0.05; // radians per frame

    constructor(object: any, inputManager: InputManager) {
        this.object = object as GameObject; // Todo: Gltf objects not implemented correctly yet.
        this.input = inputManager;
    }

    // Call this every frame
    // doing this on frame update might cause issues in the future.
    // consider using a fixed update loop for physics and movement,
    // or based on the event listener
    public update() {
        let forwardInput = 0;
        let rotateX = 0, rotateY = 0, rotateZ = 0;
        if (this.input.isKeyDown('w')) forwardInput += 1;
        if (this.input.isKeyDown('s')) forwardInput -= 1;
        if (this.input.isKeyDown('d')) rotateY += 1;
        if (this.input.isKeyDown('a')) rotateY -= 1;


        if (this.input.isKeyDown('i')) rotateX += 1;
        if (this.input.isKeyDown('k')) rotateX -= 1;
        if (this.input.isKeyDown('o')) rotateY += 1;
        if (this.input.isKeyDown('l')) rotateY -= 1;
        if (this.input.isKeyDown('p')) rotateZ += 1;
        if (this.input.isKeyDown(';')) rotateZ -= 1;

        if (rotateX !== 0 || rotateY !== 0 || rotateZ !== 0) {
            // Create rotation quaternion for each axis
            const deltaQx = Quaternion.fromAxisAngle(new Vec3(1, 0, 0), rotateX * this.rotationSpeed);
            const deltaQy = Quaternion.fromAxisAngle(new Vec3(0, 1, 0), rotateY * this.rotationSpeed);
            const deltaQz = Quaternion.fromAxisAngle(new Vec3(0, 0, 1), rotateZ * this.rotationSpeed);

            // Combine rotations: Z * Y * X (order matters)
            let deltaQ = Quaternion.multiply(deltaQz, Quaternion.multiply(deltaQy, deltaQx));
            // Apply to current rotation - reverse order for world-space rotation
            const newQ = Quaternion.multiply(deltaQ, this.object.rotation);
            this.object.rotation = Quaternion.normalize(newQ);
        }

        // Only move if input
        if (forwardInput !== 0) {
            const forward = Quaternion.rotateVector(this.object.rotation, new Vec3(0, 0, 1));
            // Calculate movement direction
            let moveDir = Vec3.multiplyScalar(forward, forwardInput);
            // Normalize and apply speed
            moveDir = Vec3.normalize(moveDir);
            moveDir = Vec3.multiplyScalar(moveDir, this.moveSpeed);
            // Update object's position
            this.object.position = Vec3.add(this.object.position, moveDir);
        }
    }
}
