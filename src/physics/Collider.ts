import { Vec3 } from "../math/Vec3";
import { Mat4x4 } from "../math/Mat4x4";
import { Quaternion } from "../math/Quaternion";

export enum ColliderType {
    BOX,
    SPHERE,
    CAPSULE,
    PLANE
}

export interface CollisionInfo {
    isColliding: boolean;
    contactPoint: Vec3;
    normal: Vec3;
    penetrationDepth: number;
    colliderA: Collider;
    colliderB: Collider;
}

export abstract class Collider {
    public position: Vec3;
    public rotation: Quaternion;
    public scale: Vec3;
    public type: ColliderType = ColliderType.BOX;
    public isTrigger: boolean = false;
    
    // Physics material properties
    public friction: number = 0.5; // surface friction (0-1)
    public restitution: number = 0.1; // bounciness (0-1)
    
    // AABB caching
    protected cachedAABB: AABB | null = null;
    protected lastPosition: Vec3 = new Vec3(0, 0, 0);
    protected lastRotation: Quaternion = new Quaternion();
    protected isDirty: boolean = true;
    
    constructor(
        position: Vec3 = new Vec3(0, 0, 0),
        rotation: Quaternion = new Quaternion(),
        scale: Vec3 = new Vec3(1, 1, 1)
    ) {
        this.position = position;
        this.rotation = rotation;
        this.scale = scale;
        this.lastPosition = new Vec3(position.x, position.y, position.z);
        this.lastRotation = new Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
    }
    
    protected checkIfDirty(): boolean {
        const posChanged = this.position.x !== this.lastPosition.x || 
                          this.position.y !== this.lastPosition.y || 
                          this.position.z !== this.lastPosition.z;
        const rotChanged = this.rotation.x !== this.lastRotation.x || 
                          this.rotation.y !== this.lastRotation.y || 
                          this.rotation.z !== this.lastRotation.z || 
                          this.rotation.w !== this.lastRotation.w;
        
        if (posChanged || rotChanged || this.isDirty) {
            this.lastPosition = new Vec3(this.position.x, this.position.y, this.position.z);
            this.lastRotation = new Quaternion(this.rotation.x, this.rotation.y, this.rotation.z, this.rotation.w);
            this.isDirty = false;
            return true;
        }
        return false;
    }

    /**
     * Call this to update the collider's position and rotation
     *
     * Mark this collider as dirty to force AABB recalculation
     * 
     * Call this when position or rotation changes outside of physics updates
     */
    public markDirty(): void {
        this.isDirty = true;
        this.cachedAABB = null;
    }
    
    public abstract checkCollision(other: Collider): CollisionInfo;
    public abstract getTransformMatrix(): Mat4x4;
    public abstract getAABB(): AABB; // Axis-Aligned Bounding Box for broad phase
}

// Axis-Aligned Bounding Box
export class AABB {
    public min: Vec3;
    public max: Vec3;
    
    constructor(min: Vec3, max: Vec3) {
        this.min = min;
        this.max = max;
    }
    
    public intersects(other: AABB): boolean {
        return (this.min.x <= other.max.x && this.max.x >= other.min.x) &&
               (this.min.y <= other.max.y && this.max.y >= other.min.y) &&
               (this.min.z <= other.max.z && this.max.z >= other.min.z);
    }
    
    public contains(point: Vec3): boolean {
        return point.x >= this.min.x && point.x <= this.max.x &&
               point.y >= this.min.y && point.y <= this.max.y &&
               point.z >= this.min.z && point.z <= this.max.z;
    }
    
    public getCenter(): Vec3 {
        return Vec3.multiplyScalar(Vec3.add(this.min, this.max), 0.5);
    }
    
    public getSize(): Vec3 {
        return Vec3.subtract(this.max, this.min);
    }
}

export class BoxCollider extends Collider {
    public size: Vec3; // Half extents
    
    constructor(
        position: Vec3 = new Vec3(0, 0, 0),
        rotation: Quaternion = new Quaternion(),
        size: Vec3 = new Vec3(0.5, 0.5, 0.5)
    ) {
        super(position, rotation);
        this.type = ColliderType.BOX;
        this.size = size;
    }
    
    public getTransformMatrix(): Mat4x4 {
        return Mat4x4.compose(
            [this.position.x, this.position.y, this.position.z],
            this.rotation,
            [this.size.x, this.size.y, this.size.z]
        );
    }
    
    public getAABB(): AABB {
        // Return cached AABB if object hasn't moved
        if (this.cachedAABB && !this.checkIfDirty()) {
            return this.cachedAABB;
        }
        
        // Get the 8 corners of the box in local space
        const corners = [
            new Vec3(-this.size.x, -this.size.y, -this.size.z),
            new Vec3( this.size.x, -this.size.y, -this.size.z),
            new Vec3(-this.size.x,  this.size.y, -this.size.z),
            new Vec3( this.size.x,  this.size.y, -this.size.z),
            new Vec3(-this.size.x, -this.size.y,  this.size.z),
            new Vec3( this.size.x, -this.size.y,  this.size.z),
            new Vec3(-this.size.x,  this.size.y,  this.size.z),
            new Vec3( this.size.x,  this.size.y,  this.size.z)
        ];
        
        const transform = this.getTransformMatrix();
        
        // Transform corners to world space
        const worldCorners = corners.map(corner => 
            Vec3.transformPoint(transform, corner)
        );
        
        // Find min and max
        let min = new Vec3(worldCorners[0].x, worldCorners[0].y, worldCorners[0].z);
        let max = new Vec3(worldCorners[0].x, worldCorners[0].y, worldCorners[0].z);
        
        for (const corner of worldCorners) {
            if (corner.x < min.x) min.x = corner.x;
            if (corner.y < min.y) min.y = corner.y;
            if (corner.z < min.z) min.z = corner.z;
            if (corner.x > max.x) max.x = corner.x;
            if (corner.y > max.y) max.y = corner.y;
            if (corner.z > max.z) max.z = corner.z;
        }
        
        this.cachedAABB = new AABB(min, max);
        return this.cachedAABB;
    }
    
    public checkCollision(other: Collider): CollisionInfo {
        const result: CollisionInfo = {
            isColliding: false,
            contactPoint: new Vec3(0, 0, 0),
            normal: new Vec3(0, 0, 0),
            penetrationDepth: 0,
            colliderA: this,
            colliderB: other
        };
        
        if (other.type === ColliderType.BOX) {
            return this.checkBoxBox(other as BoxCollider);
        } else if (other.type === ColliderType.SPHERE) {
            return this.checkBoxSphere(other as SphereCollider);
        }
        
        return result;
    }    
    
    private checkBoxBox(other: BoxCollider): CollisionInfo {
        // OBB vs OBB collision using Separating Axis Theorem (SAT)
        const result: CollisionInfo = {
            isColliding: false,
            contactPoint: new Vec3(0, 0, 0),
            normal: new Vec3(0, 0, 0),
            penetrationDepth: 0,
            colliderA: this,
            colliderB: other
        };
        
        //Quick AABB check first for broad phase
        const aabb1 = this.getAABB();
        const aabb2 = other.getAABB();
        if (!aabb1.intersects(aabb2)) {
            return result;
        }
        
        // Get rotation matrices from quaternions
        const rotMatA = Mat4x4.fromQuaternion(this.rotation);
        const rotMatB = Mat4x4.fromQuaternion(other.rotation);
        
        // Get the 3 axes for each box (local X, Y, Z axes in world space)
        // Mat4x4 is column-major, so columns are: [0,1,2,3], [4,5,6,7], [8,9,10,11], [12,13,14,15]
        const axesA = [
            new Vec3(rotMatA[0], rotMatA[1], rotMatA[2]),    // First column (local X)
            new Vec3(rotMatA[4], rotMatA[5], rotMatA[6]),    // Second column (local Y)
            new Vec3(rotMatA[8], rotMatA[9], rotMatA[10])    // Third column (local Z)
        ];
        
        const axesB = [
            new Vec3(rotMatB[0], rotMatB[1], rotMatB[2]),    // First column (local X)
            new Vec3(rotMatB[4], rotMatB[5], rotMatB[6]),    // Second column (local Y)
            new Vec3(rotMatB[8], rotMatB[9], rotMatB[10])    // Third column (local Z)
        ];
        
        // Vector from A to B
        const centerOffset = Vec3.subtract(other.position, this.position);
        
        let minPenetration = Number.POSITIVE_INFINITY;
        let bestAxis = new Vec3(1, 0, 0);
        
        // Test 15 potential separating axes:
        // - 3 face normals from box A
        // - 3 face normals from box B
        // - 9 cross products of edges from A and B
        
        const testAxes: Vec3[] = [
            ...axesA,
            ...axesB
        ];
        
        // Add edge cross products (9 axes)
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                const cross = Vec3.cross(axesA[i], axesB[j]);
                const len = Vec3.length(cross);
                if (len > 0.0001) { // Avoid nearly parallel edges
                    testAxes.push(Vec3.normalize(cross));
                }
            }
        }
        
        // Test each axis
        for (const axis of testAxes) {
            const axisLen = Vec3.length(axis);
            if (axisLen < 0.0001) continue; // Skip degenerate axes
            
            const normalizedAxis = Vec3.normalize(axis);
            
            // Project box A onto axis
            const projA = this.projectBoxOntoAxis(normalizedAxis, this.size, axesA);
            
            // Project box B onto axis
            const projB = this.projectBoxOntoAxis(normalizedAxis, other.size, axesB);
            
            // Project center offset onto axis
            const centerDist = Vec3.dot(centerOffset, normalizedAxis);
            const projBShifted = {
                min: projB.min + centerDist,
                max: projB.max + centerDist
            };
            
            // Check for separation
            const separation = Math.max(projA.min - projBShifted.max, projBShifted.min - projA.max);
            
            if (separation > 0.0001) {
                // Found a separating axis - boxes don't collide
                return result;
            }
            
            // Calculate penetration depth on this axis
            const penetration = Math.min(projA.max - projBShifted.min, projBShifted.max - projA.min);
            
            if (penetration < minPenetration) {
                minPenetration = penetration;
                bestAxis = normalizedAxis;
                
                // Make sure the normal points from A to B
                if (Vec3.dot(centerOffset, bestAxis) < 0) {
                    bestAxis = Vec3.multiplyScalar(bestAxis, -1);
                }
            }
        }
        
        // If we made it here, there's a collision
        result.isColliding = true;
        result.penetrationDepth = Math.max(minPenetration, 0.001);
        result.normal = bestAxis;
        
        // Calculate contact point (approximate as center point along collision normal)
        const contactOffset = Vec3.multiplyScalar(result.normal, result.penetrationDepth * 0.5);
        result.contactPoint = Vec3.add(this.position, contactOffset);
        
        return result;
    }
    
    /**
     * Project an OBB onto an axis
     * Returns the min and max projection values
     */
    private projectBoxOntoAxis(axis: Vec3, halfExtents: Vec3, boxAxes: Vec3[]): { min: number, max: number } {
        // Project the half extents onto the axis
        const r = 
            Math.abs(Vec3.dot(Vec3.multiplyScalar(boxAxes[0], halfExtents.x), axis)) +
            Math.abs(Vec3.dot(Vec3.multiplyScalar(boxAxes[1], halfExtents.y), axis)) +
            Math.abs(Vec3.dot(Vec3.multiplyScalar(boxAxes[2], halfExtents.z), axis));
        
        return { min: -r, max: r };
    }
    
    public checkBoxSphere(sphere: SphereCollider): CollisionInfo {
        const result: CollisionInfo = {
            isColliding: false,
            contactPoint: new Vec3(0, 0, 0),
            normal: new Vec3(0, 0, 0),
            penetrationDepth: 0,
            colliderA: this,
            colliderB: sphere
        };
        
        // Find the closest point on the box to the sphere center
        const aabb = this.getAABB();
        const closestPoint = new Vec3(
            Math.max(aabb.min.x, Math.min(sphere.position.x, aabb.max.x)),
            Math.max(aabb.min.y, Math.min(sphere.position.y, aabb.max.y)),
            Math.max(aabb.min.z, Math.min(sphere.position.z, aabb.max.z))
        );
        
        const distance = Vec3.length(Vec3.subtract(sphere.position, closestPoint));
        
        if (distance <= sphere.radius) {
            result.isColliding = true;
            result.penetrationDepth = Math.max(sphere.radius - distance, 0.001); // Ensure minimum penetration
            result.contactPoint = closestPoint;
            
            if (distance > 0) {
                result.normal = Vec3.normalize(Vec3.subtract(sphere.position, closestPoint));
            } else {
                const centerToBox = Vec3.subtract(this.position, sphere.position);
                result.normal = Vec3.normalize(centerToBox);
            }
        }
        
        return result;
    }
}

export class SphereCollider extends Collider {
    public radius: number;
    
    constructor(
        position: Vec3 = new Vec3(0, 0, 0),
        radius: number = 0.5
    ) {
        super(position);
        this.type = ColliderType.SPHERE;
        this.radius = radius;
    }
    
    public getTransformMatrix(): Mat4x4 {
        // Don't apply scale here since radius is already scaled
        return Mat4x4.compose(
            [this.position.x, this.position.y, this.position.z],
            this.rotation,
            [this.radius, this.radius, this.radius]
        );
    }
    
    public getAABB(): AABB {
        // Return cached AABB if object hasn't moved
        if (this.cachedAABB && !this.checkIfDirty()) {
            return this.cachedAABB;
        }
        
        // radius is already scaled during construction, so use it directly
        const min = Vec3.subtract(this.position, new Vec3(this.radius, this.radius, this.radius));
        const max = Vec3.add(this.position, new Vec3(this.radius, this.radius, this.radius));
        this.cachedAABB = new AABB(min, max);
        return this.cachedAABB;
    }
    
    public checkCollision(other: Collider): CollisionInfo {
        const result: CollisionInfo = {
            isColliding: false,
            contactPoint: new Vec3(0, 0, 0),
            normal: new Vec3(0, 0, 0),
            penetrationDepth: 0,
            colliderA: this,
            colliderB: other
        };
        
        if (other.type === ColliderType.SPHERE) {
            return this.checkSphereSphere(other as SphereCollider);
        } else if (other.type === ColliderType.BOX) {
            const boxResult = (other as BoxCollider).checkBoxSphere(this);
            // Flip the normal since we're checking from sphere's perspective
            result.isColliding = boxResult.isColliding;
            result.contactPoint = boxResult.contactPoint;
            result.normal = Vec3.multiplyScalar(boxResult.normal, -1);
            result.penetrationDepth = boxResult.penetrationDepth;
            result.colliderA = this;
            result.colliderB = other;
            return result;
        }
        
        return result;
    }
    
    private checkSphereSphere(other: SphereCollider): CollisionInfo {
        const result: CollisionInfo = {
            isColliding: false,
            contactPoint: new Vec3(0, 0, 0),
            normal: new Vec3(0, 0, 0),
            penetrationDepth: 0,
            colliderA: this,
            colliderB: other
        };
        
        const distance = Vec3.length(Vec3.subtract(other.position, this.position));
        const combinedRadius = this.radius + other.radius;
        
        if (distance <= combinedRadius) {
            result.isColliding = true;
            result.penetrationDepth = combinedRadius - distance;
            
            if (distance > 0) {
                result.normal = Vec3.normalize(Vec3.subtract(other.position, this.position));
                result.contactPoint = Vec3.add(this.position, Vec3.multiplyScalar(result.normal, this.radius));
            } else {
                result.normal = new Vec3(1, 0, 0); // Arbitrary direction
                result.contactPoint = this.position;
            }
        }
        
        return result;
    }
}
