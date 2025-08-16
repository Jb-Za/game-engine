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
  pressure: number = 0;

  // particle properties
  radius: number; // smoothing length (h)
  mass: number;

  // tunable physical params
  restDensity: number;
  stiffness: number;
  viscosity: number;
  gravity: Vec2;

  constructor(
    position: Vec2 = new Vec2(0, 0),
    opts?: {
      radius?: number;
      mass?: number;
      restDensity?: number;
      stiffness?: number;
      viscosity?: number;
      gravity?: Vec2;
    }
  ) {
    this.position = position;
    this.velocity = new Vec2(0, 0);
    this.force = new Vec2(0, 0);

    this.radius = opts?.radius ?? 0.25;
    this.mass = opts?.mass ?? 1.0;

    this.restDensity = opts?.restDensity ?? 1000.0;
    this.stiffness = opts?.stiffness ?? 200.0;
    this.viscosity = opts?.viscosity ?? 0.1;
    this.gravity = opts?.gravity ?? new Vec2(0, -9.81);
  }

  // Optional kernel helpers (implement when needed)
  private static poly6(r: number, h: number): number {
    // parameters referenced to avoid unused-variable compiler errors
    void r; void h;
    // TODO: implement kernel
    return 0;
  }

  private static spikyGradient(r: number, h: number): number {
    void r; void h;
    // TODO: implement kernel gradient magnitude
    return 0;
  }

  private static viscosityLaplacian(r: number, h: number): number {
    void r; void h;
    // TODO: implement viscosity laplacian
    return 0;
  }

  // ---------- core SPH steps (stubs) ----------
  computeDensityPressure(neighbors: WaterParticle[]): void {
    // reference parameter to avoid unused warning
    void neighbors;
    // TODO: iterate neighbors and compute this.density and this.pressure
  }

  computeForces(neighbors: WaterParticle[]): void {
    void neighbors;
    // TODO: compute pressure, viscosity and body forces into this.force
  }

  integrate(dt: number): void {
    void dt;
    // TODO: semi-implicit integrate using this.force to update velocity and position
  }

  // convenience: single-step update
  update(neighbors: WaterParticle[], dt: number): void {
    this.computeDensityPressure(neighbors);
    this.computeForces(neighbors);
    this.integrate(dt);
  }
}