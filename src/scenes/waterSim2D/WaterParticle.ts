import { Vec2 } from "../../math/Vec2";

/**
 * WaterParticle (skeleton)
 * - Minimal structure for a 2D SPH particle to be implemented by the user.
 * - Contains fields and method stubs only; no heavy implementation.
 */
export class WaterParticle {
  // state
  position: Vec2;
  velocity: Vec2;
  force: Vec2;

  // simulation quantities
  density: number = 0;
  nearDensity: number = 0;  // Added for near-field interactions
  pressure: number = 0;
  nearPressure: number = 0; // Added for near-field interactions

  // particle properties
  radius: number; // smoothing length (h)
  mass: number;
  public densityRadius: number = 1;

  // tunable physical params
  restDensity: number;
  stiffness: number;
  nearStiffness: number; // Added for near-field pressure
  viscosity: number;
  gravity: Vec2;

  containerBounds = {
    minX: -8,
    maxX: 8,
    minY: -6,
    maxY: 6
  };
  constructor(
    position: Vec2 = new Vec2(0, 0),
    opts?: {
      radius?: number;
      mass?: number;
      restDensity?: number;
      stiffness?: number;
      nearStiffness?: number;  // Added
      viscosity?: number;
      gravity?: Vec2;
    }
  ) {
    this.position = position;
    this.velocity = new Vec2(0, 0);
    this.force = new Vec2(0, 0);

    this.radius = opts?.radius ?? 0.2;
    this.mass = opts?.mass ?? 1.0;

    this.restDensity = opts?.restDensity ?? 1.0;
    this.stiffness = opts?.stiffness ?? 5.0;
    this.nearStiffness = opts?.nearStiffness ?? 2.0;
    this.viscosity = opts?.viscosity ?? 0.5;
    this.gravity = opts?.gravity ?? new Vec2(0, -9.81);
  }

  // Optional kernel helpers (implement when needed)
  private static poly6(r: number, h: number): number {
    if (r >= h) return 0; // Outside smoothing radius

    const h2 = h * h;
    const diff = h2 - r * r;
    //return (315 / (64 * Math.PI * Math.pow(h, 9))) * Math.pow(diff, 3); // 3d kernel constants
    return (4 / (Math.PI * Math.pow(h, 8))) * Math.pow(diff, 3);
  }

  private static spikyGradient(r: number, h: number): number {
    if (r >= h || r <= 0) return 0;

    // 2D Spiky gradient kernel magnitude
    const diff = h - r;
    return (10 / (Math.PI * Math.pow(h, 5))) * diff; // Fixed: removed extra diff

    // 3D Spiky gradient (correct formula):
    // return (45 / (Math.PI * Math.pow(h, 6))) * Math.pow(h - r, 2);
  }

private static viscosityLaplacian(r: number, h: number): number {
  if (r >= h || r <= 0) return 0;
  
  // 2D Viscosity laplacian kernel
  return (20 / (3 * Math.PI * Math.pow(h, 5))) * (h - r);

  // 3D Viscosity laplacian (correct formula):
  // return (45 / (Math.PI * Math.pow(h, 6))) * (h - r);
}

// Cubic kernel for near-density calculations (like the reference)
private static cubicKernel(r: number, h: number): number {
  if (r >= h) return 0;
  
  const q = r / h;
  if (q < 1) {
    const diff = 1 - q;
    return (2 / (3 * h)) * diff * diff * diff;
  }
  return 0;
}  // ---------- core SPH steps (stubs) ----------
  computeDensityPressure(neighbors: { particle: WaterParticle, distance: number }[]): void {
    const h = this.densityRadius;
    
    // Self-contribution for both density and near-density
    this.density = this.mass * WaterParticle.poly6(0, h);
    this.nearDensity = this.mass * WaterParticle.cubicKernel(0, h);

    for (const neighbor of neighbors) {
      if (neighbor.distance <= h) {
        this.density += neighbor.particle.mass * WaterParticle.poly6(neighbor.distance, h);
        this.nearDensity += neighbor.particle.mass * WaterParticle.cubicKernel(neighbor.distance, h);
      }
    }

    // Pressure calculations - using more stable formulas
    this.density = Math.max(this.density, 0.1); // Prevent zero density
    this.nearDensity = Math.max(this.nearDensity, 0.01);
    
    this.pressure = this.stiffness * Math.max(0, this.density - this.restDensity);
    this.nearPressure = this.nearStiffness * this.nearDensity;
  }

  computeForces(neighbors: { particle: WaterParticle, distance: number }[]): void {
    this.force = new Vec2(0, 0); // reset force

    // 1. Gravity (body force)
    this.force.y += this.gravity.y * this.mass;

    const h = this.densityRadius;

    // 2. Simple but strong repulsion forces from neighbors
    for (const neighbor of neighbors) {
      if (neighbor.distance <= h && neighbor.distance > 0) {
        const dx = this.position.x - neighbor.particle.position.x;
        const dy = this.position.y - neighbor.particle.position.y;
        
        // Unit direction vector from neighbor to this particle
        const nx = dx / neighbor.distance;
        const ny = dy / neighbor.distance;

        // Much weaker repulsion force for stable fluid
        const repulsionStrength = 5.0; // Reduced from 100.0
        const repulsionForce = repulsionStrength / (neighbor.distance + 0.1);
        
        this.force.x += repulsionForce * nx;
        this.force.y += repulsionForce * ny;
      }
    }
  }

  integrate(dt: number): void {
    // Semi-implicit Euler integration
    // acceleration = force / mass
    const ax = this.force.x / this.mass;
    const ay = this.force.y / this.mass;

    // Update velocity: v = v + a * dt
    this.velocity.x += ax * dt;
    this.velocity.y += ay * dt;

    // Add damping to help fluid come to rest
    const damping = 0.98; // Slight velocity reduction each frame
    this.velocity.x *= damping;
    this.velocity.y *= damping;

    // Limit velocity to prevent instability
    const maxSpeed = 5.0;
    const speed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y);
    if (speed > maxSpeed) {
      this.velocity.x = (this.velocity.x / speed) * maxSpeed;
      this.velocity.y = (this.velocity.y / speed) * maxSpeed;
    }

    // Update position: p = p + v * dt
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
  }

  // convenience: single-step update
  update(neighbors: { particle: WaterParticle, distance: number }[], dt: number): void {
    this.computeDensityPressure(neighbors);
    this.computeForces(neighbors);
    this.integrate(dt);

    // this.position = Vec2.add(this.position, this.force)

    // Fixed boundary collision - proper velocity reflection
    const damping = 0.8;  // Less aggressive damping
    const margin = 0.05;  // Smaller margin

    if (this.position.x < this.containerBounds.minX + margin) {
      this.position.x = this.containerBounds.minX + margin;
      this.velocity.x = Math.abs(this.velocity.x) * damping; // Bounce right
    }
    if (this.position.x > this.containerBounds.maxX - margin) {
      this.position.x = this.containerBounds.maxX - margin;
      this.velocity.x = -Math.abs(this.velocity.x) * damping; // Bounce left
    }
    if (this.position.y < this.containerBounds.minY + margin) {
      this.position.y = this.containerBounds.minY + margin;
      if (this.velocity.y < 0) { // Only reflect if moving downward
        this.velocity.y = -this.velocity.y * damping; // Bounce up
      }
    }
    if (this.position.y > this.containerBounds.maxY - margin) {
      this.position.y = this.containerBounds.maxY - margin;
      if (this.velocity.y > 0) { // Only reflect if moving upward
        this.velocity.y = -this.velocity.y * damping; // Bounce down
      }
    }

  }
}