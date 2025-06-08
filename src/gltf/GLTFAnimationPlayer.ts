import { Mat4x4 } from "../math/Mat4x4";
import { Vec3 } from "../math/Vec3";
import { GLTFScene } from "./GLB_Upload";
import { GLTFAnimation } from "./GLTFAnimation";
import { GLTFBufferView } from "./GLTFBufferView";

export class GLTFAnimationPlayer {
  private animation: GLTFAnimation;
  private nodes: any[];
  private accessors: any[];
  private time: number = 0;
  private playing: boolean = false;
  private loop: boolean = true;
  private duration: number = 0;
  private scene: GLTFScene;

  constructor(animation: GLTFAnimation, scene: GLTFScene, accessors: any[]) {
    this.animation = animation;
    this.scene = scene;
    this.nodes = scene.nodes;
    this.accessors = accessors;
    // Compute duration from all samplers' input accessors
    for (const sampler of animation.samplers) {
      const inputAccessor = accessors[sampler.input];
      const inputArray = inputAccessor.getArray();
      const lastTime = inputArray[inputArray.length - 1];
      if (lastTime > this.duration) this.duration = lastTime;
    }
  }

  play() {
    this.playing = true;
  }
  pause() {
    this.playing = false;
  }
  stop() {
    this.playing = false;
    this.time = 0;
  }

  update(deltaTime: number) {
    if (!this.playing) return;
    this.time += deltaTime;
    if (this.time > this.duration) {
      if (this.loop) this.time = 0;
      else {
        this.time = this.duration;
        this.playing = false;
      }
    }

    // Gather all joint node indices from all skins in the scene
    const jointNodeIndices = new Set<number>();
    if (this.scene && (this.scene as any).skins) {
      for (const skin of (this.scene as any).skins) {
        for (const jointIdx of skin.joints) {
          jointNodeIndices.add(jointIdx);
        }
      }
    }

    for (const [i, channel] of this.animation.channels.entries()) {
      const sampler = this.animation.samplers[channel.sampler];
      const input = this.accessors[sampler.input].getArray();
      const output = this.accessors[sampler.output].getArray();
      const nodeIdx = channel.target.node;
      const node = this.nodes[nodeIdx];
      // Debug info: is this node a joint, mesh, or both?
      const isJoint = jointNodeIndices.has(nodeIdx);
      const isMesh = node && node.mesh !== undefined;
      const nodeName = node && node.name ? node.name : "(no name)";
      //   console.log(`Animating node ${nodeIdx} [${nodeName}]: joint=${isJoint}, mesh=${isMesh}`);
      //   if (i < 5) {
      //     console.log('Node object:', node);
      //   }
      // Find keyframe interval
      let idx = 0;
      while (idx < input.length - 1 && this.time > input[idx + 1]) idx++;
      // Interpolate
      const t0 = input[idx],
        t1 = input[idx + 1];
      const alpha = (this.time - t0) / (t1 - t0);
      const stride = channel.target.path === "rotation" ? 4 : 3;
      const v0 = output.subarray(idx * stride, (idx + 1) * stride);
      const v1 = output.subarray((idx + 1) * stride, (idx + 2) * stride);
      let value;
      if (sampler.interpolation === "STEP" || t1 === undefined) {
        value = Array.from(v0);
      } else if (channel.target.path === "rotation") {
        // Slerp for quaternions (implement or use a helper)
        value = slerpQuat(Array.from(v0), Array.from(v1), alpha);
      } else {
        const arrV0 = Array.from(v0) as number[];
        const arrV1 = Array.from(v1) as number[];
        value = arrV0.map((v, i) => v * (1 - alpha) + arrV1[i] * alpha);
      }
      // Apply to node
      node[channel.target.path] = value;
    }
    // Helper for quaternion slerp (implement or use a math lib)
    function slerpQuat(a: number[], b: number[], t: number): number[] {
      // ...implement quaternion slerp...
      return a.map((v, i) => v * (1 - t) + b[i] * t); // placeholder: linear
    }
  }
}
