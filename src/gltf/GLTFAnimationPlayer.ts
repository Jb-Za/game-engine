import { GLTFNode } from "./GLTFNode";

export class GLTFAnimationPlayer {
  private animations: any[];
  private nodes: any[];
  private currentTime: number;
  constructor(animations: any[], nodes: GLTFNode[]) {
    this.animations = animations;
    this.nodes = nodes;
    this.currentTime = 0;
    // TODO: parse and cache samplers/channels for efficiency
  }

  update(deltaTime: number) {
  this.currentTime += deltaTime;
  for (const anim of this.animations) {
    for (const channel of anim.channels) {
      const sampler = anim.samplers[channel.sampler];
      const node = this.nodes[channel.target.node];
      const input = sampler.input;   // keyframe times (Float32Array or array)
      const output = sampler.output; // keyframe values (array)
      const path = channel.target.path; // "translation", "rotation", "scale"
      if (!input || !output) continue;

      // Loop animation
      let time = this.currentTime % input[input.length - 1];

      // Find keyframes
      const [i0, i1] = this.findKeyframeIndices(input, time);
      const t0 = input[i0], t1 = input[i1];
      const localT = (time - t0) / (t1 - t0);

      // Get values
      if (path === "translation" || path === "scale") {
        const stride = 3;
        const v0 = output.slice(i0 * stride, i0 * stride + stride);
        const v1 = output.slice(i1 * stride, i1 * stride + stride);
        const value = this.lerpVec3(v0, v1, localT);
        if (path === "translation") node.setTranslation(value);
        else node.setScale(value);
      } else if (path === "rotation") {
        const stride = 4;
        const v0 = output.slice(i0 * stride, i0 * stride + stride);
        const v1 = output.slice(i1 * stride, i1 * stride + stride);
        const value = this.slerpQuat(v0, v1, localT);
        node.setRotation(value);
      }
    }
  }
  }

  // Find the two keyframes surrounding the current time
  private findKeyframeIndices(times: Float32Array, time: number): [number, number] {
    for (let i = 0; i < times.length - 1; ++i) {
      if (time >= times[i] && time < times[i + 1]) {
        return [i, i + 1];
      }
    }
    // Loop or clamp to last keyframe
    return [times.length - 2, times.length - 1];
  }

  private lerp(a: number, b: number, t: number): number {
    return a * (1 - t) + b * t;
  }

  private lerpVec3(a: number[], b: number[], t: number): number[] {
    return [this.lerp(a[0], b[0], t), this.lerp(a[1], b[1], t), this.lerp(a[2], b[2], t)];
  }

  // Spherical linear interpolation for quaternions
  private slerpQuat(a: number[], b: number[], t: number): number[] {
    // Simple slerp for unit quaternions
    let dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
    if (dot < 0) {
      b = b.map((v) => -v);
      dot = -dot;
    }
    if (dot > 0.9995) {
      // Linear interpolation for very close quats
      return this.lerpVec4(a, b, t);
    }
    const theta0 = Math.acos(dot);
    const theta = theta0 * t;
    const sinTheta = Math.sin(theta);
    const sinTheta0 = Math.sin(theta0);
    const s0 = Math.cos(theta) - (dot * sinTheta) / sinTheta0;
    const s1 = sinTheta / sinTheta0;
    return [s0 * a[0] + s1 * b[0], s0 * a[1] + s1 * b[1], s0 * a[2] + s1 * b[2], s0 * a[3] + s1 * b[3]];
  }

  private lerpVec4(a: number[], b: number[], t: number): number[] {
    return [this.lerp(a[0], b[0], t), this.lerp(a[1], b[1], t), this.lerp(a[2], b[2], t), this.lerp(a[3], b[3], t)];
  }
}
