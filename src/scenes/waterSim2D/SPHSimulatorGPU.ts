import { Vec2 } from "../../math/Vec2";
import { SPHComputeManager } from "./SPHComputeManager";
import { WaterParticle } from "./WaterParticle";

export class SPHSimulatorGPU {
  private computeManager: SPHComputeManager;

  private particles: WaterParticle[] = [];
  private _targetDensity: number = 8.0;
  private _pressureMultiplier: number = 10.0;
  private _nearPressureMultiplier: number = 1.2;
  private _gravity: number = -2.0;
  private _viscosityStrength: number = 15;
  private _smoothingRadius: number = 0.6;
  private _collisionDamping: number = 0.95;

  // Property setters that update GPU buffers
  public get targetDensity(): number {
    return this._targetDensity;
  }
  public set targetDensity(value: number) {
    this._targetDensity = value;
    this.computeManager.setTargetDensity(value);
  }

  public get pressureMultiplier(): number {
    return this._pressureMultiplier;
  }

  public set pressureMultiplier(value: number) {
    this._pressureMultiplier = value;
    this.computeManager.setPressureMultiplier(value);
  }

  public get nearPressureMultiplier(): number {
    return this._nearPressureMultiplier;
  }

  public set nearPressureMultiplier(value: number) {
    this._nearPressureMultiplier = value;
    this.computeManager.setNearPressureMultiplier(value);
  }

  public get gravity(): number {
    return this._gravity;
  }

  public set gravity(value: number) {
    this._gravity = value;
    this.computeManager.setGravity(value);
  }

  public get viscosityStrength(): number {
    return this._viscosityStrength;
  }

  public set viscosityStrength(value: number) {
    this._viscosityStrength = value;
    this.computeManager.setViscosityStrength(value);
  }

  public get smoothingRadius(): number {
    return this._smoothingRadius;
  }

  public set smoothingRadius(value: number) {
    this._smoothingRadius = value;
    this.computeManager.setSmoothingRadius(value);
  }

  public get collisionDamping(): number {
    return this._collisionDamping;
  }
  public set collisionDamping(value: number) {
    this._collisionDamping = value;
    // Note: collisionDamping setter not yet implemented in SPHComputeManager
    // this.computeManager.setCollisionDamping(value);
  }

  // For debugging/visualization purposes
  public showParticle: number = 100;
  private mousePosition: Vec2 = new Vec2(0, 0);
  private isMousePressed: boolean = false;
  private isMouseRightPressed: boolean = false;
  private mouseForceStrength: number = 0;
  private mouseRadius: number = 0;

  constructor(device: GPUDevice, gridCellSize: number, particles: WaterParticle[], _gridBounds: any, parameters: any) {
    this.computeManager = new SPHComputeManager(device, particles, parameters);
    this.particles = particles;
    this.smoothingRadius = gridCellSize;
  }  
  
  update(dt: number): void {
    // Dispatch compute shaders instead of CPU calculations
    this.computeManager.update(dt, {
      mousePosition: this.mousePosition,
      mouseRadius: this.mouseRadius,
      mouseForceStrength: this.mouseForceStrength,
      isMousePressed: this.isMousePressed,
      isMouseRightPressed: this.isMouseRightPressed,
    });
  }

  // Mouse interaction methods
  public setMousePosition(worldX: number, worldY: number): void {
    this.mousePosition.x = worldX;
    this.mousePosition.y = worldY;
  }

  public setMousePressed(pressed: boolean, rightClick: boolean = false): void {
    this.isMousePressed = pressed;
    this.isMouseRightPressed = rightClick;
  }

  public setMouseForceStrength(strength: number): void {
    this.mouseForceStrength = strength;
  }

  public setMouseRadius(radius: number): void {
    this.mouseRadius = radius;
  }
  public getparticles(): WaterParticle[] {
    return this.particles;
  }

  // Add getter for GPU-only rendering access
  public getComputeManager(): SPHComputeManager {
    return this.computeManager;
  }

  // Get mouse interaction info for visualization
  public getMouseInteractionInfo(): { position: Vec2; radius: number; isPressed: boolean; isPull: boolean } {
    return {
      position: this.mousePosition,
      radius: this.mouseRadius,
      isPressed: this.isMousePressed,
      isPull: this.isMouseRightPressed,
    };
  }
}
