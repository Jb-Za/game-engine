# Physics System Integration Guide

## Overview

### Core Components:

1. **RigidBody** - Handles mass, velocity, forces, and integration
2. **Colliders** - BoxCollider and SphereCollider for collision detection  - TODO: Add Capsule
3. **PhysicsWorld** - Central manager for physics simulation
4. **PhysicsComponent** - Bridge between GameObjects and physics

## Quick Start

### 1. Basic Physics Setup

```typescript
import { PhysicsWorld, PhysicsComponent, RigidBodyType } from "../physics";

// Create physics world
const physicsWorld = new PhysicsWorld();
physicsWorld.setGravity(new Vec3(0, -9.81, 0));

// Add physics to existing GameObject
const cube = objectMap.createCube(objectParams, shadowTexture, false);
const cubePhysics = new PhysicsComponent(cube, physicsWorld, 'box', 1.0);
```

### 2. Main Game Loop Integration

```typescript
// In your main render loop:
function update(deltaTime: number) {
    // 1. Physics simulation
    physicsWorld.step(deltaTime);
    
    // 2. Sync physics with game objects (for each physics component)
    physicsComponents.forEach(physics => {
        if (physics.isActive()) {
            physics.updateGameObjectTransform();
        }
    });
    
    // 3. Update game objects
    gameObjects.forEach(obj => {
        if (obj && typeof obj.update === 'function') {
            obj.update();
        }
    });
}
```

### 3. Adding Forces and Interactions

```typescript
// Apply forces
cubePhysics.addForce(new Vec3(0, 50, 0)); // Upward force
cubePhysics.addImpulse(new Vec3(5, 0, 0)); // Instant velocity change

// Set properties
cubePhysics.setRestitution(0.8); // Bounciness (0-1)
cubePhysics.setFriction(0.5);    // Surface friction (0-1)
cubePhysics.setMass(2.0);        // Object mass

// Control physics behavior
cubePhysics.setUseGravity(true); // Enable/disable gravity for this object
```

## Advanced Usage

### Object Types

```typescript
import { RigidBodyType } from "../physics";

// Static objects (walls, floors) - don't move
cubePhysics.setType(RigidBodyType.STATIC);

// Dynamic objects - affected by forces and gravity
cubePhysics.setType(RigidBodyType.DYNAMIC);

// Kinematic objects - moved by script, not physics
cubePhysics.setType(RigidBodyType.KINEMATIC);
```

### Collision Detection

```typescript
// Check if objects are colliding
if (cubePhysics.isCollidingWith(spherePhysics)) {
    console.log("Collision detected!");
}

// Get all collisions for an object
const collisions = cubePhysics.getCollisions();
collisions.forEach(collision => {
    console.log("Contact point:", collision.contactPoint);
    console.log("Normal:", collision.normal);
});
```

### Manual Position Control

```typescript
// Teleport object (useful for respawning)
cubePhysics.setPosition(new Vec3(0, 10, 0));
cubePhysics.setRotation(new Quaternion());

// Set velocity directly
cubePhysics.setVelocity(new Vec3(5, 0, 0));

// Get current velocity
const currentVelocity = cubePhysics.getVelocity();

// Control angular velocity
cubePhysics.setAngularVelocity(new Vec3(0, 1, 0));
const angularVel = cubePhysics.getAngularVelocity();
```

## Integration with Existing Code

### Creating Physics-Enabled Objects

The current system uses **PhysicsComponent** to bridge GameObjects with physics. Here's the recommended pattern:

```typescript
// Create a physics-enabled cube
const cube = objectMap.createCube(objectParams, shadowTexture, false);
const cubePhysics = new PhysicsComponent(cube, physicsWorld, 'box', 1.0);

// Store both for easy management
const gameObjects = [cube];
const physicsComponents = [cubePhysics];

// In your update loop
physicsWorld.step(deltaTime);
physicsComponents.forEach(physics => {
    if (physics.isActive()) {
        physics.updateGameObjectTransform();
    }
});
```

### Advanced GameObject Integration (Optional)

If you want to extend your existing GameObject classes, you can add optional physics support:

```typescript
export class Cube {
    // ...existing properties...
    public physics?: PhysicsComponent;
    
    public addPhysics(physicsWorld: PhysicsWorld, mass: number = 1.0): PhysicsComponent {
        this.physics = new PhysicsComponent(this, physicsWorld, 'box', mass);
        return this.physics;
    }
    
    public update() {
        // Sync physics if enabled (usually handled externally)
        // if (this.physics) {
        //     this.physics.updateGameObjectTransform();
        // }
        
        // ...existing update code...
    }
}
```

### Character Controller Integration

For a character controller you could add physics like this:

```typescript
export class CharacterController {
    private physics?: PhysicsComponent;
    
    public addPhysics(physicsWorld: PhysicsWorld) {
        this.physics = new PhysicsComponent(this.object, physicsWorld, 'box', 1.0);
        this.physics.setType(RigidBodyType.DYNAMIC);
        this.physics.setUseGravity(true);
        // Reduce friction for smoother movement
        this.physics.setFriction(0.1);
    }
    
    public update() {
        if (this.physics) {
            // Apply movement forces instead of direct position changes
            const force = this.calculateMovementForce();
            this.physics.addForce(force);
            
            // Handle jumping
            if (this.jumpPressed && this.isGrounded()) {
                this.physics.addImpulse(new Vec3(0, 5, 0));
            }
            
            // Physics sync is handled externally in main loop
        } else {
            // Fallback to existing movement system
            // ...existing movement code...
        }
    }
    
    private isGrounded(): boolean {
        // Check if character is on ground using collision detection
        const collisions = this.physics?.getCollisions() || [];
        return collisions.some(collision => {
            // Check if collision normal points upward (ground)
            return collision.normal && collision.normal.y > 0.7;
        });
    }
}
```

## Performance Considerations

### 1. Broad Phase Collision Detection
The system uses AABB (Axis-Aligned Bounding Box) for quick collision rejection before expensive narrow-phase detection.

### 2. Sleeping Objects
Objects automatically "sleep" when they're not moving to save CPU:
```typescript
const stats = physicsWorld.getPerformanceStats();
console.log(`Collision checks: ${stats.collisionChecks}`);
```

### 3. Fixed Timestep
Physics runs at a fixed 120 FPS timestep (1/120 second) for consistency, with up to 5 sub-steps per frame to maintain stability regardless of frame rate.

this can be configured

## Scene Examples

**Physics Test Scene:** `src/scenes/physicsTestScene/physicsTestScene.ts`
- Falling cubes and spheres
- Static floor and walls
- Force application
- Real-time physics stats
- Interactive spawning

**Plinko Physics Scene:** `src/scenes/plinkoScene/plinkoScene.ts`
- Demonstrates binomial distribution through physics
- Sphere-sphere and sphere-box collisions
- Ball pooling system for performance
- Real-time distribution tracking
- Interactive ball spawning

## TODO

### 1. Enhanced Colliders
- Capsule colliders for characters
- Mesh colliders for complex geometry
- Compound colliders for complex objects

### 2. Constraints and Joints
- Hinge joints (doors, wheels)
- Spring constraints
- Distance constraints

### 3. Spatial Partitioning
- Octree or grid-based broad phase
- Better performance for large numbers of objects

### 4. Advanced Features
- Continuous collision detection (for fast objects)
- Multiple physics materials
- Trigger volumes
- Raycasting improvements
