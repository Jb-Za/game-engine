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
import { PhysicsWorld, PhysicsComponent } from "../physics";

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
    
    // 2. Sync physics with game objects
    cubePhysics.updateGameObjectTransform();
    
    // 3. Update game objects
    cube.update();
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
```

## Integration with Existing Code

### Modifying Existing GameObjects

To add physics to your existing game objects (Cube, Ball, etc.), you can:

1. **Add PhysicsComponent as optional property:**
```typescript
export class Cube {
    // ...existing properties...
    public physics?: PhysicsComponent;
    
    public enablePhysics(physicsWorld: PhysicsWorld, mass: number = 1.0) {
        this.physics = new PhysicsComponent(this, physicsWorld, 'box', mass);
    }
}
```

2. **Update the object's update method:**
```typescript
public update() {
    // Sync physics if enabled
    if (this.physics) {
        this.physics.updateGameObjectTransform();
    }
    
    // ...existing update code...
}
```

### Character Controller Integration

For your existing character controller, you can replace manual movement with physics:

```typescript
export class CharacterController {
    private physics?: PhysicsComponent;
    
    public enablePhysics(physicsWorld: PhysicsWorld) {
        this.physics = new PhysicsComponent(this.object, physicsWorld, 'box', 1.0);
        this.physics.setType(RigidBodyType.DYNAMIC);
        this.physics.setUseGravity(true);
    }
    
    public update() {
        if (this.physics) {
            // Apply movement forces instead of direct position changes
            const force = this.calculateMovementForce();
            this.physics.addForce(force);
            this.physics.updateGameObjectTransform();
        } else {
            // Fallback to existing movement system
            // ...existing movement code...
        }
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
Physics runs at a fixed 60 FPS timestep for consistency, regardless of frame rate.

## Scene Example

I've created a complete physics demo scene at:
`src/scenes/physicsTestScene/physicsTestScene.ts`

The scene demonstrates:
- Falling cubes and spheres
- Static floor and walls
- Force application
- Real-time physics stats
- Interactive spawning

## Next Steps for Production

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

The current system provides a solid foundation for most game physics needs while being easily extensible for more advanced features.
