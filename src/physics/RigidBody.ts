import { Vec3 } from "../math/Vec3";
import { Quaternion } from "../math/Quaternion";
import { Mat4x4 } from "../math/Mat4x4";

export enum RigidBodyType {
    STATIC,     // Immovable objects (walls, terrain)
    DYNAMIC,    // Moveable objects affected by forces
    KINEMATIC   // Moveable objects controlled by script
}

export class RigidBody {
    // Transform
    public position: Vec3;
    public rotation: Quaternion;
    
    // Linear motion
    public velocity: Vec3 = new Vec3(0, 0, 0);
    public acceleration: Vec3 = new Vec3(0, 0, 0);
    public force: Vec3 = new Vec3(0, 0, 0);
    
    // Angular motion
    public angularVelocity: Vec3 = new Vec3(0, 0, 0);
    public angularAcceleration: Vec3 = new Vec3(0, 0, 0);
    public torque: Vec3 = new Vec3(0, 0, 0);
    
    // Physical properties
    public mass: number = 1.0;
    public inverseMass: number = 1.0;
    public linearDamping: number = 0.98;   // Air resistance (0-1)
    public angularDamping: number = 0.98;  // Rotational air resistance
    public restitution: number = 0.5;      // Bounciness (0-1)
    public friction: number = 0.5;         // Surface friction (0-1)
    
    // State
    public type: RigidBodyType = RigidBodyType.DYNAMIC;
    public isKinematic: boolean = false;
    public useGravity: boolean = true;
    public isSleeping: boolean = false;
    
    // Sleep thresholds
    private sleepVelocityThreshold: number = 0.01;
    private sleepAngularVelocityThreshold: number = 0.01;
    private sleepTimer: number = 0;
    private sleepTime: number = 1.0; // seconds before object sleeps
    
    constructor(
        position: Vec3 = new Vec3(0, 0, 0), 
        rotation: Quaternion = new Quaternion(),
        mass: number = 1.0
    ) {
        this.position = position;
        this.rotation = rotation;
        this.setMass(mass);
    }
    
    public setMass(mass: number): void {
        this.mass = mass;
        this.inverseMass = mass > 0 ? 1.0 / mass : 0; // Infinite mass for static objects
        
        if (mass === 0) {
            this.type = RigidBodyType.STATIC;
        }
    }
    
    public addForce(force: Vec3): void {
        if (this.type !== RigidBodyType.DYNAMIC) return;
        this.force = Vec3.add(this.force, force);
        this.wakeUp();
    }
    
    public addForceAtPosition(force: Vec3, position: Vec3): void {
        if (this.type !== RigidBodyType.DYNAMIC) return;
        this.addForce(force);
        
        // Calculate torque: torque = cross(r, F) where r is offset from center of mass
        const offset = Vec3.subtract(position, this.position);
        const torque = Vec3.cross(offset, force);
        this.addTorque(torque);
    }
    
    public addTorque(torque: Vec3): void {
        if (this.type !== RigidBodyType.DYNAMIC) return;
        this.torque = Vec3.add(this.torque, torque);
        this.wakeUp();
    }
    
    public addImpulse(impulse: Vec3): void {
        if (this.type !== RigidBodyType.DYNAMIC) return;
        this.velocity = Vec3.add(this.velocity, Vec3.multiplyScalar(impulse, this.inverseMass));
        this.wakeUp();
    }
    
    public integrate(deltaTime: number, gravity: Vec3): void {
        if (this.type === RigidBodyType.STATIC || this.isSleeping) return;
        
        // Apply gravity
        if (this.useGravity && this.type === RigidBodyType.DYNAMIC) {
            this.addForce(Vec3.multiplyScalar(gravity, this.mass));
        }
        
        // Only integrate if dynamic
        if (this.type === RigidBodyType.DYNAMIC) {
            // Linear integration using Verlet integration for better stability
            this.acceleration = Vec3.multiplyScalar(this.force, this.inverseMass);
            
            // Update velocity: v = v + a * dt
            this.velocity = Vec3.add(this.velocity, Vec3.multiplyScalar(this.acceleration, deltaTime));
            
            // Clamp velocity to prevent tunneling
            const maxVelocity = 10; // Reduced max velocity to prevent tunneling
            const velocityMagnitude = Vec3.length(this.velocity);
            if (velocityMagnitude > maxVelocity) {
                this.velocity = Vec3.multiplyScalar(Vec3.normalize(this.velocity), maxVelocity);
            }
            
            // Apply linear damping
            this.velocity = Vec3.multiplyScalar(this.velocity, Math.pow(this.linearDamping, deltaTime));
            
            // Update position: x = x + v * dt
            this.position = Vec3.add(this.position, Vec3.multiplyScalar(this.velocity, deltaTime));
            
            // Angular integration (simplified)
            this.angularAcceleration = Vec3.multiplyScalar(this.torque, this.inverseMass); // Simplified, should use inertia tensor
            this.angularVelocity = Vec3.add(this.angularVelocity, Vec3.multiplyScalar(this.angularAcceleration, deltaTime));
            
            // Apply angular damping
            this.angularVelocity = Vec3.multiplyScalar(this.angularVelocity, Math.pow(this.angularDamping, deltaTime));
            
            // Update rotation
            if (Vec3.length(this.angularVelocity) > 0) {
                const axis = Vec3.normalize(this.angularVelocity);
                const angle = Vec3.length(this.angularVelocity) * deltaTime;
                const deltaRotation = Quaternion.fromAxisAngle(axis, angle);
                this.rotation = Quaternion.multiply(this.rotation, deltaRotation);
                this.rotation = Quaternion.normalize(this.rotation);
            }
        }
        
        // Clear forces for next frame
        this.force = new Vec3(0, 0, 0);
        this.torque = new Vec3(0, 0, 0);
        
        // Check for sleep
        this.updateSleep(deltaTime);
    }
    
    private updateSleep(deltaTime: number): void {
        if (this.type !== RigidBodyType.DYNAMIC) return;
        
        const velocityMagnitude = Vec3.length(this.velocity);
        const angularVelocityMagnitude = Vec3.length(this.angularVelocity);
        
        if (velocityMagnitude < this.sleepVelocityThreshold && 
            angularVelocityMagnitude < this.sleepAngularVelocityThreshold) {
            this.sleepTimer += deltaTime;
            
            if (this.sleepTimer >= this.sleepTime) {
                this.sleep();
            }
        } else {
            this.sleepTimer = 0;
        }
    }
    
    public sleep(): void {
        this.isSleeping = true;
        this.velocity = new Vec3(0, 0, 0);
        this.angularVelocity = new Vec3(0, 0, 0);
    }
    
    public wakeUp(): void {
        this.isSleeping = false;
        this.sleepTimer = 0;
    }
    
    public getTransformMatrix(): Mat4x4 {
        return Mat4x4.compose(
            [this.position.x, this.position.y, this.position.z],
            this.rotation,
            [1, 1, 1]
        );
    }
    
    public getKineticEnergy(): number {
        const linearKE = 0.5 * this.mass * Vec3.dot(this.velocity, this.velocity);
        const angularKE = 0.5 * this.mass * Vec3.dot(this.angularVelocity, this.angularVelocity); // Simplified
        return linearKE + angularKE;
    }
}
