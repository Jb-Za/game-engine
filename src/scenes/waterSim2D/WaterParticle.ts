import { Color } from "../../math/Color";
import { Vec2 } from "../../math/Vec2";

/**
 * WaterParticle - Simple data structure
 * Contains only the particle's own physical properties and state
 */
export class WaterParticle {
  // Physical state
  position: Vec2;
  velocity: Vec2;
  force: Vec2;
  scale: Vec2 = new Vec2(1,1);

  // Computed simulation properties
  density: number = 0;
  nearDensity: number = 0;
  pressure: number = 0;

  // Particle properties
  radius: number;
  mass: number;

  color: Color = new Color(0, 0.3, 1, 1); // Default color for visualization
  constructor(
    position: Vec2 = new Vec2(0, 0),
    opts?: {
      radius?: number;
      mass?: number;
    }
  ) {
    this.position = position;
    this.velocity = new Vec2(0, 0);
    this.force = new Vec2(0, 0);

    this.radius = opts?.radius ?? 0.2;
    this.mass = opts?.mass ?? 1.0;
  }

  // Simple integration step - just updates position and velocity based on forces
   integrate(dt: number): void {
    // This is now handled in the simulator's predictive approach
    this.velocity = Vec2.add(this.velocity, Vec2.scale(this.force, dt / this.mass));
    this.position = Vec2.add(this.position, Vec2.scale(this.velocity, dt));
    this.force = new Vec2(0, 0);
  }

  // Add a force to this particle
  addForce(force: Vec2): void {
    this.force = Vec2.add(this.force, force);
  }
}
