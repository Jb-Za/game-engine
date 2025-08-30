export class SmoothingKernels {
  static Poly6ScalingFactor: number = 315 / (64 * Math.PI);
  static SpikyPow3ScalingFactor: number = -45 / (Math.PI);
  static SpikyPow2ScalingFactor: number = 30 / (Math.PI);
  static SpikyPow3DerivativeScalingFactor: number = 135 / (Math.PI);
  static SpikyPow2DerivativeScalingFactor: number = -60 / (Math.PI);

  static SmoothingKernelPoly6(dst: number, radius: number): number {
    if (dst < radius) {
      const v = radius * radius - dst * dst;
      return v * v * v * this.Poly6ScalingFactor;
    }
    return 0;
  }

  static SpikyKernelPow3(dst: number, radius: number): number {
    if (dst < radius) {
      const v = radius - dst;
      return v * v * v * this.SpikyPow3ScalingFactor;
    }
    return 0;
  }

  static SpikyKernelPow2(dst: number, radius: number): number {
    if (dst < radius) {
      const v = radius - dst;
      return v * v * this.SpikyPow2ScalingFactor;
    }
    return 0;
  }

  static DerivativeSpikyPow3(dst: number, radius: number): number {
    if (dst <= radius) {
      const v = radius - dst;
      return -v * v * this.SpikyPow3DerivativeScalingFactor;
    }
    return 0;
  }

  static DerivativeSpikyPow2(dst: number, radius: number): number {
    if (dst <= radius) {
      const v = radius - dst;
      return -v * this.SpikyPow2DerivativeScalingFactor;
    }
    return 0;
  }
}
