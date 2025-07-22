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
    public friction: number = 0.5;
    public restitution: number = 0.1;
    
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
    
    public markDirty(): void {
        this.isDirty = true;
        this.cachedAABB = null;
    }
    
    public abstract checkCollision(other: Collider): CollisionInfo;
    public abstract getTransformMatrix(): Mat4x4;
    public abstract getAABB(): AABB; // Axis-Aligned Bounding Box for broad phase
}

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
        // Don't apply scale here since 'size' already contains the scaled half-extents
        return Mat4x4.compose(
            [this.position.x, this.position.y, this.position.z],
            this.rotation,
            [1, 1, 1] // Use unit scale since size is already scaled
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
        // Simplified AABB vs AABB collision for now
        // TODO: Implement full OBB vs OBB collision detection
        const aabb1 = this.getAABB();
        const aabb2 = other.getAABB();
        
        const result: CollisionInfo = {
            isColliding: false,
            contactPoint: new Vec3(0, 0, 0),
            normal: new Vec3(0, 0, 0),
            penetrationDepth: 0,
            colliderA: this,
            colliderB: other
        };
        
        if (aabb1.intersects(aabb2)) {
            result.isColliding = true;
            
            // Calculate overlap on each axis - CORRECTED FORMULA
            const overlapX = Math.min(aabb1.max.x, aabb2.max.x) - Math.max(aabb1.min.x, aabb2.min.x);
            const overlapY = Math.min(aabb1.max.y, aabb2.max.y) - Math.max(aabb1.min.y, aabb2.min.y);
            const overlapZ = Math.min(aabb1.max.z, aabb2.max.z) - Math.max(aabb1.min.z, aabb2.min.z);
            
            // Add minimum penetration tolerance to prevent micro-collisions
            const minPenetration = 0.001;
            
            // Find the axis with minimum overlap (separation axis)
            if (overlapX <= overlapY && overlapX <= overlapZ) {
                result.penetrationDepth = Math.max(overlapX, minPenetration);
                // Normal points from colliderA toward colliderB for proper separation
                result.normal = this.position.x < other.position.x ? new Vec3(1, 0, 0) : new Vec3(-1, 0, 0);
            } else if (overlapY <= overlapZ) {
                result.penetrationDepth = Math.max(overlapY, minPenetration);
                // Normal points from colliderA toward colliderB - for floor collisions, this pushes objects up
                result.normal = this.position.y < other.position.y ? new Vec3(0, 1, 0) : new Vec3(0, -1, 0);
            } else {
                result.penetrationDepth = Math.max(overlapZ, minPenetration);
                // Normal points from colliderA toward colliderB
                result.normal = this.position.z < other.position.z ? new Vec3(0, 0, 1) : new Vec3(0, 0, -1);
            }
            
            // Contact point is roughly the center of overlap
            result.contactPoint = Vec3.multiplyScalar(Vec3.add(aabb1.getCenter(), aabb2.getCenter()), 0.5);
        }
        
        return result;
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
                // Sphere center is inside box, need to find best separation direction
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
            [1, 1, 1] // Use unit scale since radius is already scaled
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
                // Spheres are at the exact same position
                result.normal = new Vec3(1, 0, 0); // Arbitrary direction
                result.contactPoint = this.position;
            }
        }
        
        return result;
    }
}
