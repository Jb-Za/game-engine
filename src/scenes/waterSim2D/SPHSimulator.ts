import { Vec2 } from "../../math/Vec2";
import { WaterParticle } from "./WaterParticle";
import { SpatialGrid } from "./SpatialGrid";
import { Color } from "../../math/Color";
import { SmoothingKernels } from "./SmoothingKernels";

// HEAVILY MODIFIED FROM ORIGINAL SOURCE: Sebastian Lague's Fluid Simulation
// https://github.com/SebLague/Fluid-Sim/blob/Episode-01/Assets/Scripts/Sim%202D/Compute/FluidSim2D.compute
// https://youtu.be/rSKMYc1CQHE?si=ZIyLBBSWt8DvbO_r

export class SPHSimulator {
  private particles: WaterParticle[] = [];
  private predictedPositions: Vec2[] = [];
  
  
  private targetDensity: number = 8.0;
  public pressureMultiplier: number = 10.0;
  private nearPressureMultiplier: number = 1.2;
  private gravity: number = -2.0;
  private viscosityStrength: number = 15;
  public smoothingRadius: number = 0.6;
  private collisionDamping: number = 0.95;
  
  // Spatial hashing
  private spatialOffsets: number[];
  private spatialIndices: { index: number; hash: number; key: number }[];

  public showParticle: number = 100;
  private numParticles: number = 0;
  private neighborIndices: number[] = [];

  private containerBounds = {
    minX: -12,
    maxX: 12,
    minY: -10,
    maxY: 10,
  };
  mousePosition: Vec2 = new Vec2(0, 0);
  isMousePressed: boolean = false;;
  isMouseRightPressed: boolean = false;
  mouseForceStrength: number = 0;
  mouseRadius: number = 0;

  constructor(gridCellSize: number, numParticles: number, gridBounds: { minX: number; maxX: number; minY: number; maxY: number }) {
    this.numParticles = numParticles;
    this.smoothingRadius = gridCellSize;

    this.spatialOffsets = new Array(numParticles).fill(numParticles);
    this.spatialIndices = new Array(numParticles);
    this.predictedPositions = new Array(numParticles);

    this.containerBounds = gridBounds;
  }

  addParticles(particles: WaterParticle[]): void {
    this.particles = particles;
    // Initialize predicted positions
    for (let i = 0; i < particles.length; i++) {
      this.predictedPositions[i] = new Vec2(particles[i].position.x, particles[i].position.y);
    }
  }

  // Step 1: External Forces (gravity) and prediction
  private applyExternalForces(dt: number): void {
    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];
      
      // Start with gravity
      let gravityAccel = new Vec2(0, this.gravity);
      
      // Input interactions modify gravity (like the compute shader)
      if (this.isMousePressed || this.isMouseRightPressed && this.mouseForceStrength !== 0) {
        const inputPointOffset = Vec2.subtract(this.mousePosition, particle.position);
        const sqrDst = Vec2.dot(inputPointOffset, inputPointOffset);
        const radiusSquared = this.mouseRadius * this.mouseRadius;
        
        if (sqrDst < radiusSquared) {
          const dst = Math.sqrt(sqrDst);
          const edgeT = dst / this.mouseRadius;
          const centreT = 1 - edgeT;
          const dirToCentre = dst > 0 ? Vec2.scale(inputPointOffset, 1 / dst) : new Vec2(0, 0);
          
          // Apply force direction: positive = pull, negative = push
          const forceDirection = this.isMouseRightPressed ? 1.0 : -1.0;
          const interactionStrength = this.mouseForceStrength * forceDirection;
          
          const gravityWeight = 1 - (centreT * Math.min(Math.abs(interactionStrength) / 10, 1));
          let accel = Vec2.scale(gravityAccel, gravityWeight);
          
          const interactionForce = Vec2.scale(dirToCentre, centreT * interactionStrength);
          accel = Vec2.add(accel, interactionForce);
          
          // Velocity damping near mouse
          const velocityDamping = Vec2.scale(particle.velocity, -centreT);
          accel = Vec2.add(accel, velocityDamping);
          
          particle.velocity = Vec2.add(particle.velocity, Vec2.scale(accel, dt));
        } else {
          // Apply normal gravity when outside interaction radius
          particle.velocity = Vec2.add(particle.velocity, Vec2.scale(gravityAccel, dt));
        }
      } else {
        // Apply normal gravity when no mouse interaction
        particle.velocity = Vec2.add(particle.velocity, Vec2.scale(gravityAccel, dt));
      }
      
      // Predict position
      this.predictedPositions[i] = Vec2.add(particle.position, Vec2.scale(particle.velocity, dt));
    }
  }

  // Step 2: Update spatial hash using predicted positions
  private updateSpatialHash(): void {
    // Reset offsets
    this.spatialOffsets.fill(this.numParticles);
    
    // Update spatial indices using predicted positions
    for (let i = 0; i < this.particles.length; i++) {
      const cell = SpatialGrid.getCell2D(this.predictedPositions[i], this.smoothingRadius);
      const hash = SpatialGrid.hashCell2D(cell);
      const key = SpatialGrid.keyFromHash(hash, this.numParticles);
      
      this.spatialIndices[i] = {
        index: i,
        hash: hash,
        key: key
      };
    }

    this.spatialIndices.sort((a, b) => {
      if (a.key !== b.key) return a.key - b.key;
      return a.hash - b.hash;
    });

    // Build offset array
    for (let i = 0; i < this.spatialIndices.length; i++) {
      const key = this.spatialIndices[i].key;
      if (this.spatialOffsets[key] === this.numParticles) {
        this.spatialOffsets[key] = i;
      }
    }
  }

  // Step 3: Calculate densities using predicted positions
  private calculateDensities(): void {
    for (let i = 0; i < this.particles.length; i++) {
      const pos = this.predictedPositions[i];
      const densityData = this.calculateDensityAtPosition(pos);
      
      this.particles[i].density = densityData.x;
      this.particles[i].nearDensity = densityData.y;
    }
  }

  private calculateDensityAtPosition(pos: Vec2): Vec2 {
    const originCell = SpatialGrid.getCell2D(pos, this.smoothingRadius);
    const sqrRadius = this.smoothingRadius * this.smoothingRadius;
    let density = 0;
    let nearDensity = 0;

    // Check all 9 neighboring cells
    for (let i = 0; i < SpatialGrid.CELL_OFFSETS.length; i++) {
      const offset = SpatialGrid.CELL_OFFSETS[i];
      const cell = new Vec2(originCell.x + offset.x, originCell.y + offset.y);
      const hash = SpatialGrid.hashCell2D(cell);
      const key = SpatialGrid.keyFromHash(hash, this.numParticles);
      let currIndex = this.spatialOffsets[key];

      while (currIndex < this.numParticles) {
        const indexData = this.spatialIndices[currIndex];
        currIndex++;
        
        if (indexData.key !== key) break;
        if (indexData.hash !== hash) continue;

        const neighborIndex = indexData.index;
        const neighborPos = this.predictedPositions[neighborIndex];
        const offsetToNeighbor = Vec2.subtract(neighborPos, pos);
        const sqrDstToNeighbor = Vec2.dot(offsetToNeighbor, offsetToNeighbor);

        if (sqrDstToNeighbor > sqrRadius) continue;

        const dst = Math.sqrt(sqrDstToNeighbor);
        density += SmoothingKernels.SpikyKernelPow2(dst, this.smoothingRadius);
        nearDensity += SmoothingKernels.SpikyKernelPow3(dst, this.smoothingRadius);
      }
    }

    return new Vec2(density, nearDensity);
  }

  // Step 4: Calculate pressure forces
  private calculatePressureForces(dt: number): void {
    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];
      const density = particle.density;
      const nearDensity = particle.nearDensity;
      const pressure = this.pressureFromDensity(density);
      const nearPressure = this.nearPressureFromDensity(nearDensity);
      
      let pressureForce = new Vec2(0, 0);
      const pos = this.predictedPositions[i];
      const originCell = SpatialGrid.getCell2D(pos, this.smoothingRadius);
      const sqrRadius = this.smoothingRadius * this.smoothingRadius;

      // Check neighbors
      for (let j = 0; j < SpatialGrid.CELL_OFFSETS.length; j++) {
        const offset = SpatialGrid.CELL_OFFSETS[j];
        const cell = new Vec2(originCell.x + offset.x, originCell.y + offset.y);
        const hash = SpatialGrid.hashCell2D(cell);
        const key = SpatialGrid.keyFromHash(hash, this.numParticles);
        let currIndex = this.spatialOffsets[key];

        while (currIndex < this.numParticles) {
          const indexData = this.spatialIndices[currIndex];
          currIndex++;
          
          if (indexData.key !== key) break;
          if (indexData.hash !== hash) continue;

          const neighborIndex = indexData.index;
          if (neighborIndex === i) continue; // Skip self

          const neighborPos = this.predictedPositions[neighborIndex];
          const offsetToNeighbor = Vec2.subtract(neighborPos, pos);
          const sqrDstToNeighbor = Vec2.dot(offsetToNeighbor, offsetToNeighbor);

          if (sqrDstToNeighbor > sqrRadius) continue;

          const dst = Math.sqrt(sqrDstToNeighbor);
          const dirToNeighbor = dst > 0 ? Vec2.scale(offsetToNeighbor, 1 / dst) : new Vec2(0, 1);

          const neighbor = this.particles[neighborIndex];
          const neighborPressure = this.pressureFromDensity(neighbor.density);
          const neighborNearPressure = this.nearPressureFromDensity(neighbor.nearDensity);

          const sharedPressure = (pressure + neighborPressure) * 0.5;
          const sharedNearPressure = (nearPressure + neighborNearPressure) * 0.5;

          const densityDerivative = SmoothingKernels.DerivativeSpikyPow2(dst, this.smoothingRadius);
          const nearDensityDerivative = SmoothingKernels.DerivativeSpikyPow3(dst, this.smoothingRadius);

         const force1 = Vec2.scale(dirToNeighbor, -densityDerivative * sharedPressure);
        const force2 = Vec2.scale(dirToNeighbor, -nearDensityDerivative * sharedNearPressure);
          
          pressureForce = Vec2.add(pressureForce, force1);
          pressureForce = Vec2.add(pressureForce, force2);
        }
      }

      const acceleration = Vec2.scale(pressureForce, 1 / density);
      particle.velocity = Vec2.add(particle.velocity, Vec2.scale(acceleration, dt));
    }
  }

  // Step 5: Calculate viscosity forces
  private calculateViscosity(dt: number): void {
    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];
      const pos = this.predictedPositions[i];
      const velocity = particle.velocity;
      
      let viscosityForce = new Vec2(0, 0);
      const originCell = SpatialGrid.getCell2D(pos, this.smoothingRadius);
      const sqrRadius = this.smoothingRadius * this.smoothingRadius;

      // Check neighbors for viscosity
      for (let j = 0; j < SpatialGrid.CELL_OFFSETS.length; j++) {
        const offset = SpatialGrid.CELL_OFFSETS[j];
        const cell = new Vec2(originCell.x + offset.x, originCell.y + offset.y);
        const hash = SpatialGrid.hashCell2D(cell);
        const key = SpatialGrid.keyFromHash(hash, this.numParticles);
        let currIndex = this.spatialOffsets[key];

        while (currIndex < this.numParticles) {
          const indexData = this.spatialIndices[currIndex];
          currIndex++;
          
          if (indexData.key !== key) break;
          if (indexData.hash !== hash) continue;

          const neighborIndex = indexData.index;
          if (neighborIndex === i) continue;

          const neighborPos = this.predictedPositions[neighborIndex];
          const offsetToNeighbor = Vec2.subtract(neighborPos, pos);
          const sqrDstToNeighbor = Vec2.dot(offsetToNeighbor, offsetToNeighbor);

          if (sqrDstToNeighbor > sqrRadius) continue;

          const dst = Math.sqrt(sqrDstToNeighbor);
          const neighbor = this.particles[neighborIndex];
          const velocityDiff = Vec2.subtract(neighbor.velocity, velocity);
          const viscosityKernel = SmoothingKernels.SmoothingKernelPoly6(dst, this.smoothingRadius);
          
          viscosityForce = Vec2.add(viscosityForce, Vec2.scale(velocityDiff, viscosityKernel));
        }
      }

      particle.velocity = Vec2.add(particle.velocity, Vec2.scale(viscosityForce, this.viscosityStrength * dt));
    }
  }

  // Step 6: Update positions and handle collisions
  private updatePositions(dt: number): void {
    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];
      
      // Update position
      particle.position = Vec2.add(particle.position, Vec2.scale(particle.velocity, dt));

      particle.color = this.getParticleDensityColor(i);
      
      // Handle collisions
      this.handleBoundaryCollisions(particle);
    }
  }

  public getParticleDensityInfo(particleIndex: number): { density: number; nearDensity: number; pressure: number; targetDensity: number } {
    const particle = this.particles[particleIndex];
    return {
      density: particle.density,
      nearDensity: particle.nearDensity,
      pressure: this.pressureFromDensity(particle.density),
      targetDensity: this.targetDensity
    };
  }

  public getParticleDensityColor(particleIndex: number): Color {
    const particle = this.particles[particleIndex];
    const density = particle.density;
    
    
    // Normalize density to 0-1 range for color mapping
    const normalizedDensity = Math.min(Math.max((density - 0) / (this.targetDensity * 2), 0), 1);
    
    if (density < 0.1) {
      // Very low density - bright blue
      return new Color(0, 0.5, 1, 1);
    } else if (normalizedDensity < 0.33) {
      // Low density - blue to cyan
      const t = normalizedDensity * 3;
      return new Color(0, t, 1, 1);
    } else if (normalizedDensity < 0.66) {
      // Medium density - cyan to green (target range)
      const t = (normalizedDensity - 0.33) * 3;
      return new Color(0, 1, 1 - t, 1);
    } else {
      // High density - green to red
      const t = (normalizedDensity - 0.66) * 3;
      return new Color(t, 1 - t, 0, 1);
    }
  }

  // Helper functions
  private pressureFromDensity(density: number): number {
    return (density - this.targetDensity) * this.pressureMultiplier;
  }

  private nearPressureFromDensity(nearDensity: number): number {
    return this.nearPressureMultiplier * nearDensity;
  }

  // Main simulation step - now matches compute shader structure
  update(dt: number): void {
    // Step 1: External Forces
    this.applyExternalForces(dt);
    
    // Step 2: Update Spatial Hash
    this.updateSpatialHash();
    
    // Step 3: Calculate Densities
    this.calculateDensities();
    
    // Step 4: Calculate Pressure Force
    this.calculatePressureForces(dt);
    
    // Step 5: Calculate Viscosity
    this.calculateViscosity(dt);
    
    // Step 6: Update Positions
    this.updatePositions(dt);


    
    // Update neighbor visualization for selected particle
    this.neighborIndices = this.findNeighborsForVisualization(this.showParticle);
  }

  private findNeighborsForVisualization(particleIndex: number): number[] {
    const neighbors: number[] = [];
    const particle = this.particles[particleIndex];
    const pos = particle.position;
    const originCell = SpatialGrid.getCell2D(pos, this.smoothingRadius);
    const sqrRadius = this.smoothingRadius * this.smoothingRadius;

    for (let i = 0; i < SpatialGrid.CELL_OFFSETS.length; i++) {
      const offset = SpatialGrid.CELL_OFFSETS[i];
      const cell = new Vec2(originCell.x + offset.x, originCell.y + offset.y);
      const hash = SpatialGrid.hashCell2D(cell);
      const key = SpatialGrid.keyFromHash(hash, this.numParticles);
      let currIndex = this.spatialOffsets[key];

      while (currIndex < this.numParticles) {
        const indexData = this.spatialIndices[currIndex];
        currIndex++;
        
        if (indexData.key !== key) break;
        if (indexData.hash !== hash) continue;

        const neighborIndex = indexData.index;
        if (neighborIndex === particleIndex) continue;

        const neighborPos = this.particles[neighborIndex].position;
        const offsetToNeighbor = Vec2.subtract(neighborPos, pos);
        const sqrDstToNeighbor = Vec2.dot(offsetToNeighbor, offsetToNeighbor);

        if (sqrDstToNeighbor > sqrRadius) continue;

        neighbors.push(neighborIndex);
      }
    }

    return neighbors;
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

  // Get mouse interaction info for visualization
  public getMouseInteractionInfo(): { position: Vec2; radius: number; isPressed: boolean; isPull: boolean } {
    return {
      position: this.mousePosition,
      radius: this.mouseRadius,
      isPressed: this.isMousePressed,
      isPull: this.isMouseRightPressed
    };
  }

  public getSelectedParticleNeighbors(): number[] {
    return this.neighborIndices;
  }

  public handleBoundaryCollisions(particle: WaterParticle): void {
    const damping = this.collisionDamping;
    const margin = 0.05;

    if (particle.position.x < this.containerBounds.minX + margin) {
      particle.position.x = this.containerBounds.minX + margin;
      particle.velocity.x = Math.abs(particle.velocity.x) * damping;
    }
    if (particle.position.x > this.containerBounds.maxX - margin) {
      particle.position.x = this.containerBounds.maxX - margin;
      particle.velocity.x = -Math.abs(particle.velocity.x) * damping;
    }
    if (particle.position.y < this.containerBounds.minY + margin) {
      particle.position.y = this.containerBounds.minY + margin;
      if (particle.velocity.y < 0) {
        particle.velocity.y = -particle.velocity.y * damping;
      }
    }
    if (particle.position.y > this.containerBounds.maxY - margin) {
      particle.position.y = this.containerBounds.maxY - margin;
      if (particle.velocity.y > 0) {
        particle.velocity.y = -particle.velocity.y * damping;
      }
    }
  }

  getParticles(): WaterParticle[] {
    return this.particles;
  }
}