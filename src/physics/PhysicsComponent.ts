import { GameObject } from "../game_objects/ObjectMap";
import { RigidBody, RigidBodyType } from "./RigidBody";
import { Collider, BoxCollider, SphereCollider } from "./Collider";
import { PhysicsWorld } from "./PhysicsWorld";
import { Vec3 } from "../math/Vec3";
import { Quaternion } from "../math/Quaternion";

export class PhysicsComponent {
    private rigidBody: RigidBody;
    private collider: Collider;
    private gameObject: GameObject;
    private physicsWorld: PhysicsWorld;
    private physicsId: number = -1;
    
    // Sync settings
    private syncPosition: boolean = true;
    private syncRotation: boolean = true;
    
    constructor(
        gameObject: GameObject,
        physicsWorld: PhysicsWorld,
        colliderType: 'box' | 'sphere' = 'box',
        mass: number = 1.0
    ) {
        this.gameObject = gameObject;
        this.physicsWorld = physicsWorld;
        
        // Create rigid body using GameObject's current transform
        this.rigidBody = new RigidBody(
            gameObject.position,
            gameObject.rotation,
            mass
        );
        
        // Create collider based on type
        if (colliderType === 'sphere') {
            const radius = Math.max(gameObject.scale.x, gameObject.scale.y, gameObject.scale.z) * 1.05;
            this.collider = new SphereCollider(gameObject.position, radius);
        } else {
            const size = Vec3.multiplyScalar(gameObject.scale, 0.5 * 1.05);
            this.collider = new BoxCollider(gameObject.position, gameObject.rotation, size);
        }
        
        // Add to physics world
        this.physicsId = this.physicsWorld.addObject(this.rigidBody, this.collider);
    }
    
    // Rigid body control methods
    public setMass(mass: number): void {
        this.rigidBody.setMass(mass);
    }
    
    public setType(type: RigidBodyType): void {
        this.rigidBody.type = type;
    }
    
    public setUseGravity(useGravity: boolean): void {
        this.rigidBody.useGravity = useGravity;
    }
    
    public addForce(force: Vec3): void {
        this.rigidBody.addForce(force);
    }
    
    public addImpulse(impulse: Vec3): void {
        this.rigidBody.addImpulse(impulse);
    }
    
    public setVelocity(velocity: Vec3): void {
        this.rigidBody.velocity = velocity;
    }
    
    public getVelocity(): Vec3 {
        return this.rigidBody.velocity;
    }
    
    public setAngularVelocity(angularVelocity: Vec3): void {
        this.rigidBody.angularVelocity = angularVelocity;
    }
    
    public getAngularVelocity(): Vec3 {
        return this.rigidBody.angularVelocity;
    }
    
    // Collider control methods
    public setIsTrigger(isTrigger: boolean): void {
        this.collider.isTrigger = isTrigger;
    }
    
    public setFriction(friction: number): void {
        this.collider.friction = friction;
    }
    
    public setRestitution(restitution: number): void {
        this.collider.restitution = restitution;
    }
    
    // Transform synchronization
    public setSyncPosition(sync: boolean): void {
        this.syncPosition = sync;
    }
    
    public setSyncRotation(sync: boolean): void {
        this.syncRotation = sync;
    }
    
    /**
     * Call this in your GameObject's update method to sync physics with rendering
     */
    public updateGameObjectTransform(): void {
        if (this.rigidBody.type === RigidBodyType.KINEMATIC) {
            // For kinematic objects, sync physics from GameObject
            this.syncPhysicsFromGameObject();
        } else {
            // For dynamic objects, sync GameObject from physics
            this.syncGameObjectFromPhysics();
        }
    }
    
    private syncPhysicsFromGameObject(): void {
        let needsUpdate = false;
        
        if (this.syncPosition) {
            if (this.rigidBody.position.x !== this.gameObject.position.x ||
                this.rigidBody.position.y !== this.gameObject.position.y ||
                this.rigidBody.position.z !== this.gameObject.position.z) {
                this.rigidBody.position = this.gameObject.position;
                needsUpdate = true;
            }
        }
        if (this.syncRotation) {
            if (this.rigidBody.rotation.x !== this.gameObject.rotation.x ||
                this.rigidBody.rotation.y !== this.gameObject.rotation.y ||
                this.rigidBody.rotation.z !== this.gameObject.rotation.z ||
                this.rigidBody.rotation.w !== this.gameObject.rotation.w) {
                this.rigidBody.rotation = this.gameObject.rotation;
                needsUpdate = true;
            }
        }
        
        // Mark collider as dirty if we updated the rigid body
        if (needsUpdate) {
            this.collider.markDirty();
        }
    }
    
    private syncGameObjectFromPhysics(): void {
        if (this.syncPosition) {
            this.gameObject.position = this.rigidBody.position;
        }
        if (this.syncRotation) {
            this.gameObject.rotation = this.rigidBody.rotation;
        }
        // Scale is typically not affected by physics
    }
    
    /**
     * Manual position override (useful for teleporting objects)
     */
    public setPosition(position: Vec3): void {
        this.rigidBody.position = position;
        this.gameObject.position = position;
        this.rigidBody.wakeUp();
        this.collider.markDirty();
    }
    
    /**
     * Manual rotation override
     */
    public setRotation(rotation: Quaternion): void {
        this.rigidBody.rotation = rotation;
        this.gameObject.rotation = rotation;
        this.rigidBody.wakeUp();
        this.collider.markDirty();
    }
    
    /**
     * Check if this object is colliding with another physics object
     */
    public isCollidingWith(other: PhysicsComponent): boolean {
        const collisions = this.physicsWorld.getCollisionPairs();
        return collisions.some(collision => 
            (collision.colliderA === this.collider && collision.colliderB === other.collider) ||
            (collision.colliderA === other.collider && collision.colliderB === this.collider)
        );
    }
    
    /**
     * Get all current collisions involving this object
     */
    public getCollisions(): any[] {
        const collisions = this.physicsWorld.getCollisionPairs();
        return collisions.filter(collision => 
            collision.colliderA === this.collider || collision.colliderB === this.collider
        );
    }
    
    /**
     * Remove this component from the physics world
     */
    public destroy(): void {
        if (this.physicsId !== -1) {
            this.physicsWorld.removeObject(this.physicsId);
            this.physicsId = -1;
        }
    }
    
    // Getters for debugging/inspection
    public getRigidBody(): RigidBody {
        return this.rigidBody;
    }
    
    public getCollider(): Collider {
        return this.collider;
    }
    
    public getPhysicsId(): number {
        return this.physicsId;
    }
    
    public isActive(): boolean {
        const physicsObject = this.physicsWorld.getObject(this.physicsId);
        return physicsObject ? physicsObject.isActive : false;
    }
    
    public setActive(active: boolean): void {
        const physicsObject = this.physicsWorld.getObject(this.physicsId);
        if (physicsObject) {
            physicsObject.isActive = active;
        }
    }
}
