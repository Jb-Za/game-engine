import { Vec3 } from "../math/Vec3";
import { RigidBody, RigidBodyType } from "./RigidBody";
import { Collider, CollisionInfo } from "./Collider";

export interface PhysicsObject {
    rigidBody: RigidBody;
    collider: Collider;
    id: number;
    isActive: boolean;
}

export class PhysicsWorld {
    private objects: Map<number, PhysicsObject> = new Map();
    private objectIdCounter: number = 0;
    
    // Physics settings
    public gravity: Vec3 = new Vec3(0, -9.81, 0);
    public timeStep: number = 1/60; // Fixed timestep for physics
    private accumulator: number = 0;
    public maxSubSteps: number = 10;
    
    // Collision detection settings
    public enableBroadPhase: boolean = true;
    public collisionPairs: CollisionInfo[] = [];
    
    // Performance tracking
    public lastFrameCollisionChecks: number = 0;
    
    // Simple spatial optimization
    private spatialGridSize: number = 10.0; // Grid cell size
    private spatialGrid: Map<string, PhysicsObject[]> = new Map();
    
    constructor() {
        console.log("Physics World initialized");
    }
    
    public addObject(rigidBody: RigidBody, collider: Collider): number {
        const id = this.objectIdCounter++;
        const physicsObject: PhysicsObject = {
            rigidBody,
            collider,
            id,
            isActive: true
        };
        
        this.objects.set(id, physicsObject);
        return id;
    }
    
    public removeObject(id: number): boolean {
        return this.objects.delete(id);
    }
    
    public getObject(id: number): PhysicsObject | undefined {
        return this.objects.get(id);
    }
    
    public getAllObjects(): PhysicsObject[] {
        return Array.from(this.objects.values());
    }
    
    public step(deltaTime: number): void {
        // Accumulate time for fixed timestep
        this.accumulator += deltaTime;
        
        let subSteps = 0;
        while (this.accumulator >= this.timeStep && subSteps < this.maxSubSteps) {
            this.physicsStep(this.timeStep);
            this.accumulator -= this.timeStep;
            subSteps++;
        }
        
        // Handle remaining time with interpolation if needed
        // For now, we'll just cap the accumulator
        if (this.accumulator >= this.timeStep) {
            this.accumulator = this.timeStep;
        }
    }
    
    private physicsStep(deltaTime: number): void {
        // Clear previous collision data
        this.collisionPairs = [];
        this.lastFrameCollisionChecks = 0;
        
        // Update all rigid bodies
        this.integrateRigidBodies(deltaTime);
        
        // Synchronize collider positions with rigid bodies
        this.synchronizeColliders();
        
        // Multiple collision detection and resolution iterations for stability
        // Reduced from 5 to 3 iterations for better performance
        for (let i = 0; i < 3; i++) {
            // Detect collisions
            this.detectCollisions();
            
            if (this.collisionPairs.length === 0) break;
            
            // Resolve collisions
            this.resolveCollisions();
            
            // Re-synchronize colliders after position corrections
            this.synchronizeColliders();
            
            // Clear collision pairs for next iteration
            this.collisionPairs = [];
        }
        
        // Final collision detection for persistent collision tracking
        this.detectCollisions();
    }
    
    private integrateRigidBodies(deltaTime: number): void {
        for (const [_, obj] of this.objects) {
            if (!obj.isActive || obj.rigidBody.type === RigidBodyType.STATIC) continue;
            
            obj.rigidBody.integrate(deltaTime, this.gravity);
        }
    }
    
    private synchronizeColliders(): void {
        for (const [_, obj] of this.objects) {
            if (!obj.isActive) continue;
            
            // Only update collider position/rotation for dynamic and kinematic objects
            // Static objects don't move, so their colliders shouldn't be updated
            // Also skip sleeping objects to save performance
            if (obj.rigidBody.type !== RigidBodyType.STATIC && !obj.rigidBody.isSleeping) {
                // Mark collider as dirty if position or rotation changed
                if (obj.collider.position.x !== obj.rigidBody.position.x ||
                    obj.collider.position.y !== obj.rigidBody.position.y ||
                    obj.collider.position.z !== obj.rigidBody.position.z ||
                    obj.collider.rotation.x !== obj.rigidBody.rotation.x ||
                    obj.collider.rotation.y !== obj.rigidBody.rotation.y ||
                    obj.collider.rotation.z !== obj.rigidBody.rotation.z ||
                    obj.collider.rotation.w !== obj.rigidBody.rotation.w) {
                    
                    obj.collider.position = obj.rigidBody.position;
                    obj.collider.rotation = obj.rigidBody.rotation;
                    obj.collider.markDirty();
                }
            }
            // Note: Scale is set during collider creation and shouldn't change during physics simulation
        }
    }
    
    private detectCollisions(): void {
        const activeObjects = Array.from(this.objects.values()).filter(obj => obj.isActive);
        
        // Skip objects that are sleeping to improve performance
        const awakeObjects = activeObjects.filter(obj => 
            obj.rigidBody.type === RigidBodyType.STATIC || !obj.rigidBody.isSleeping
        );
        
        // Use spatial grid for better performance with many objects
        if (awakeObjects.length > 20) {
            this.detectCollisionsWithSpatialGrid(awakeObjects);
        } else {
            this.detectCollisionsBruteForce(awakeObjects);
        }
    }
    
    private detectCollisionsBruteForce(awakeObjects: PhysicsObject[]): void {
        // Broad phase - use AABB for quick rejection
        const broadPhasePairs: [PhysicsObject, PhysicsObject][] = [];
        
        for (let i = 0; i < awakeObjects.length; i++) {
            for (let j = i + 1; j < awakeObjects.length; j++) {
                const objA = awakeObjects[i];
                const objB = awakeObjects[j];
                
                // Skip if both are static
                if (objA.rigidBody.type === RigidBodyType.STATIC && 
                    objB.rigidBody.type === RigidBodyType.STATIC) {
                    continue;
                }
                
                // Broad phase check
                if (this.enableBroadPhase) {
                    const aabbA = objA.collider.getAABB();
                    const aabbB = objB.collider.getAABB();
                    
                    if (!aabbA.intersects(aabbB)) {
                        continue;
                    }
                }
                
                broadPhasePairs.push([objA, objB]);
            }
        }
        
        // Narrow phase - detailed collision detection
        this.processCollisionPairs(broadPhasePairs);
    }
    
    private detectCollisionsWithSpatialGrid(awakeObjects: PhysicsObject[]): void {
        // Clear and rebuild spatial grid
        this.spatialGrid.clear();
        
        // Add objects to spatial grid
        for (const obj of awakeObjects) {
            const aabb = obj.collider.getAABB();
            const cells = this.getAABBCells(aabb);
            
            for (const cell of cells) {
                if (!this.spatialGrid.has(cell)) {
                    this.spatialGrid.set(cell, []);
                }
                this.spatialGrid.get(cell)!.push(obj);
            }
        }
        
        // Check collisions within each grid cell
        const broadPhasePairs: [PhysicsObject, PhysicsObject][] = [];
        const checkedPairs = new Set<string>();
        
        for (const [_, cellObjects] of this.spatialGrid) {
            for (let i = 0; i < cellObjects.length; i++) {
                for (let j = i + 1; j < cellObjects.length; j++) {
                    const objA = cellObjects[i];
                    const objB = cellObjects[j];
                    
                    // Create unique pair identifier
                    const pairId = objA.id < objB.id ? `${objA.id}_${objB.id}` : `${objB.id}_${objA.id}`;
                    if (checkedPairs.has(pairId)) continue;
                    checkedPairs.add(pairId);
                    
                    // Skip if both are static
                    if (objA.rigidBody.type === RigidBodyType.STATIC && 
                        objB.rigidBody.type === RigidBodyType.STATIC) {
                        continue;
                    }
                    
                    // Broad phase check
                    if (this.enableBroadPhase) {
                        const aabbA = objA.collider.getAABB();
                        const aabbB = objB.collider.getAABB();
                        
                        if (!aabbA.intersects(aabbB)) {
                            continue;
                        }
                    }
                    
                    broadPhasePairs.push([objA, objB]);
                }
            }
        }
        
        // Narrow phase - detailed collision detection
        this.processCollisionPairs(broadPhasePairs);
    }
    
    private getAABBCells(aabb: { min: Vec3, max: Vec3 }): string[] {
        const cells: string[] = [];
        
        const minX = Math.floor(aabb.min.x / this.spatialGridSize);
        const maxX = Math.floor(aabb.max.x / this.spatialGridSize);
        const minY = Math.floor(aabb.min.y / this.spatialGridSize);
        const maxY = Math.floor(aabb.max.y / this.spatialGridSize);
        const minZ = Math.floor(aabb.min.z / this.spatialGridSize);
        const maxZ = Math.floor(aabb.max.z / this.spatialGridSize);
        
        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                for (let z = minZ; z <= maxZ; z++) {
                    cells.push(`${x},${y},${z}`);
                }
            }
        }
        
        return cells;
    }
    
    private processCollisionPairs(broadPhasePairs: [PhysicsObject, PhysicsObject][]): void {
        for (const [objA, objB] of broadPhasePairs) {
            this.lastFrameCollisionChecks++;
            
            const collision = objA.collider.checkCollision(objB.collider);
            if (collision.isColliding) {
                this.collisionPairs.push(collision);
            }
        }
    }
    
    private resolveCollisions(): void {
        // Single pass collision resolution with iterative position correction
        for (const collision of this.collisionPairs) {
            this.resolveCollision(collision);
        }
    }
    
    private resolveCollision(collision: CollisionInfo): void {
        const objA = this.getObjectFromCollider(collision.colliderA);
        const objB = this.getObjectFromCollider(collision.colliderB);
        
        if (!objA || !objB) return;
        
        const rbA = objA.rigidBody;
        const rbB = objB.rigidBody;
        
        // Skip collision if both objects are static
        if (rbA.type === RigidBodyType.STATIC && rbB.type === RigidBodyType.STATIC) {
            return;
        }
        
        // Position correction (separate overlapping objects)
        this.correctPosition(rbA, rbB, collision);
        
        // Skip velocity resolution for triggers
        if (collision.colliderA.isTrigger || collision.colliderB.isTrigger) {
            return;
        }
        
        // Velocity resolution (bounce/slide)
        this.resolveVelocity(rbA, rbB, collision);
    }
    
    private correctPosition(rbA: RigidBody, rbB: RigidBody, collision: CollisionInfo): void {
        // Handle static vs dynamic objects properly
        const correctionPercent = 0.99; // Correct 99% of penetration each iteration
        const minCorrection = 0.001; // Small minimum correction threshold
        const correctionAmount = Math.max(collision.penetrationDepth * correctionPercent, minCorrection);
        const correction = Vec3.multiplyScalar(collision.normal, correctionAmount);
        
        // If one object is static, only move the dynamic one
        if (rbA.type === RigidBodyType.STATIC && rbB.type === RigidBodyType.DYNAMIC) {
            // Move object B away from static object A
            rbB.position = Vec3.add(rbB.position, correction);
            rbB.wakeUp();
        } else if (rbB.type === RigidBodyType.STATIC && rbA.type === RigidBodyType.DYNAMIC) {
            // Move object A away from static object B
            rbA.position = Vec3.subtract(rbA.position, correction);
            rbA.wakeUp();
        } else if (rbA.type === RigidBodyType.DYNAMIC && rbB.type === RigidBodyType.DYNAMIC) {
            // Both dynamic - use mass ratios
            const totalMass = rbA.mass + rbB.mass;
            if (totalMass === 0) return;
            
            const ratioA = rbB.mass / totalMass;
            const ratioB = rbA.mass / totalMass;
            
            rbA.position = Vec3.subtract(rbA.position, Vec3.multiplyScalar(correction, ratioA));
            rbB.position = Vec3.add(rbB.position, Vec3.multiplyScalar(correction, ratioB));
            
            rbA.wakeUp();
            rbB.wakeUp();
        }
        // If both are static or kinematic, no position correction needed
    }
    
    private resolveVelocity(rbA: RigidBody, rbB: RigidBody, collision: CollisionInfo): void {
        // Calculate relative velocity
        const relativeVelocity = Vec3.subtract(rbB.velocity, rbA.velocity);
        const velocityAlongNormal = Vec3.dot(relativeVelocity, collision.normal);
        
        // Objects are separating, no need to resolve
        if (velocityAlongNormal > 0) return;
        
        // Calculate restitution (bounciness)
        const restitution = Math.min(collision.colliderA.restitution, collision.colliderB.restitution);
        
        // Calculate impulse scalar
        let impulseScalar = -(1 + restitution) * velocityAlongNormal;
        impulseScalar /= rbA.inverseMass + rbB.inverseMass;
        
        const impulse = Vec3.multiplyScalar(collision.normal, impulseScalar);
        
        // Apply impulse
        if (rbA.type === RigidBodyType.DYNAMIC) {
            rbA.velocity = Vec3.subtract(rbA.velocity, Vec3.multiplyScalar(impulse, rbA.inverseMass));
            
            // Additional velocity correction for objects moving towards static objects
            if (rbB.type === RigidBodyType.STATIC) {
                const velocityIntoStatic = Vec3.dot(rbA.velocity, collision.normal);
                if (velocityIntoStatic < 0) {
                    // Remove velocity component that would push into the static object
                    const correction = Vec3.multiplyScalar(collision.normal, velocityIntoStatic);
                    rbA.velocity = Vec3.subtract(rbA.velocity, correction);
                }
            }
        }
        
        if (rbB.type === RigidBodyType.DYNAMIC) {
            rbB.velocity = Vec3.add(rbB.velocity, Vec3.multiplyScalar(impulse, rbB.inverseMass));
            
            // Additional velocity correction for objects moving towards static objects
            if (rbA.type === RigidBodyType.STATIC) {
                const velocityIntoStatic = Vec3.dot(rbB.velocity, Vec3.multiplyScalar(collision.normal, -1));
                if (velocityIntoStatic < 0) {
                    // Remove velocity component that would push into the static object
                    const correction = Vec3.multiplyScalar(collision.normal, -velocityIntoStatic);
                    rbB.velocity = Vec3.add(rbB.velocity, correction);
                }
            }
        }
        
        // Apply friction
        this.applyFriction(rbA, rbB, collision, impulseScalar);
    }
    
    private applyFriction(rbA: RigidBody, rbB: RigidBody, collision: CollisionInfo, normalImpulse: number): void {
        // Calculate relative velocity
        const relativeVelocity = Vec3.subtract(rbB.velocity, rbA.velocity);
        
        // Calculate tangent vector (friction direction)
        const normalComponent = Vec3.multiplyScalar(collision.normal, Vec3.dot(relativeVelocity, collision.normal));
        const tangent = Vec3.subtract(relativeVelocity, normalComponent);
        
        if (Vec3.length(tangent) < 0.001) return; // No tangential velocity
        
        const tangentNormalized = Vec3.normalize(tangent);
        
        // Calculate friction impulse
        let frictionImpulse = -Vec3.dot(relativeVelocity, tangentNormalized);
        frictionImpulse /= rbA.inverseMass + rbB.inverseMass;
        
        // Apply Coulomb friction
        const friction = Math.sqrt(collision.colliderA.friction * collision.colliderB.friction);
        const maxFriction = Math.abs(normalImpulse) * friction;
        
        let frictionVector: Vec3;
        if (Math.abs(frictionImpulse) < maxFriction) {
            frictionVector = Vec3.multiplyScalar(tangentNormalized, frictionImpulse);
        } else {
            frictionVector = Vec3.multiplyScalar(tangentNormalized, -maxFriction);
        }
        
        // Apply friction impulse
        if (rbA.type === RigidBodyType.DYNAMIC) {
            rbA.velocity = Vec3.subtract(rbA.velocity, Vec3.multiplyScalar(frictionVector, rbA.inverseMass));
        }
        
        if (rbB.type === RigidBodyType.DYNAMIC) {
            rbB.velocity = Vec3.add(rbB.velocity, Vec3.multiplyScalar(frictionVector, rbB.inverseMass));
        }
    }
    
    private getObjectFromCollider(collider: Collider): PhysicsObject | undefined {
        for (const [_, obj] of this.objects) {
            if (obj.collider === collider) {
                return obj;
            }
        }
        return undefined;
    }
    
    // Utility methods
    public setGravity(gravity: Vec3): void {
        this.gravity = gravity;
    }
    
    public getCollisionPairs(): CollisionInfo[] {
        return this.collisionPairs;
    }
    
    public getPerformanceStats(): { collisionChecks: number, objectCount: number } {
        return {
            collisionChecks: this.lastFrameCollisionChecks,
            objectCount: this.objects.size
        };
    }
    
    public raycast(origin: Vec3, direction: Vec3, maxDistance: number): PhysicsObject | null {
        // Simple raycast implementation - can be improved with spatial partitioning
        let closestObject: PhysicsObject | null = null;
        let closestDistance = maxDistance;
        
        for (const [_, obj] of this.objects) {
            if (!obj.isActive) continue;
            
            const aabb = obj.collider.getAABB();
            const distance = this.raycastAABB(origin, direction, aabb);
            
            if (distance !== null && distance < closestDistance) {
                closestDistance = distance;
                closestObject = obj;
            }
        }
        
        return closestObject;
    }
    
    private raycastAABB(origin: Vec3, direction: Vec3, aabb: { min: Vec3, max: Vec3 }): number | null {
        const dirfrac = new Vec3(
            direction.x === 0 ? 1e30 : 1.0 / direction.x,
            direction.y === 0 ? 1e30 : 1.0 / direction.y,
            direction.z === 0 ? 1e30 : 1.0 / direction.z
        );
        
        const t1 = (aabb.min.x - origin.x) * dirfrac.x;
        const t2 = (aabb.max.x - origin.x) * dirfrac.x;
        const t3 = (aabb.min.y - origin.y) * dirfrac.y;
        const t4 = (aabb.max.y - origin.y) * dirfrac.y;
        const t5 = (aabb.min.z - origin.z) * dirfrac.z;
        const t6 = (aabb.max.z - origin.z) * dirfrac.z;
        
        const tmin = Math.max(Math.max(Math.min(t1, t2), Math.min(t3, t4)), Math.min(t5, t6));
        const tmax = Math.min(Math.min(Math.max(t1, t2), Math.max(t3, t4)), Math.max(t5, t6));
        
        if (tmax < 0 || tmin > tmax) {
            return null;
        }
        
        return tmin > 0 ? tmin : tmax;
    }
}
