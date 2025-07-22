// Physics system exports
export { RigidBody, RigidBodyType } from "./RigidBody";
export { Collider, BoxCollider, SphereCollider, AABB } from "./Collider";
export type { ColliderType, CollisionInfo } from "./Collider";
export { PhysicsWorld } from "./PhysicsWorld";
export type { PhysicsObject } from "./PhysicsWorld";
export { PhysicsComponent } from "./PhysicsComponent";

// Example usage:
/*
// 1. Create a physics world
const physicsWorld = new PhysicsWorld();

// 2. For existing GameObjects, add physics
const cube = objectMap.createCube(objectParams, shadowTexture, false);
const cubePhysics = new PhysicsComponent(cube, physicsWorld, 'box', 1.0);

// 3. In your main loop:
physicsWorld.step(deltaTime);
cubePhysics.updateGameObjectTransform();
cube.update();

// 4. Add forces
cubePhysics.addForce(new Vec3(0, 10, 0)); // Upward force
cubePhysics.addImpulse(new Vec3(5, 0, 0)); // Instant velocity change
*/
