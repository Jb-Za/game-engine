import { Mat4x4 } from "../math/Mat4x4";
import { Quaternion } from "../math/Quaternion";
import { Vec3 } from "../math/Vec3";

//most of this implementation is based on the gltf-skinning example from the webgpu samples repo
//https://webgpu.github.io/webgpu-samples/.
// I have adapted it to fit my project with an attempt to build upon its features

export class BaseTransformation {
  position: Vec3;
  rotation: number[]; // quaternion [x, y, z, w]
  scale: Vec3;
  constructor(
    position = new Vec3(0, 0, 0),
    rotation = [0, 0, 0, 1],
    scale = new Vec3(1, 1, 1)
  ) {
    this.position = position;
    this.rotation = rotation;
    this.scale = scale;
  }
  getMatrix(): Mat4x4 {
    // Compose transformation: translation * rotation * scale
    return Mat4x4.compose(
      [this.position.x, this.position.y, this.position.z],
      this.rotation,
      [this.scale.x, this.scale.y, this.scale.z]
    );
  }

  setMatrix(m: Mat4x4) {
    this.position = Mat4x4.getTranslation(m);
    this.scale = Mat4x4.getScale(m);
    this.rotation = Mat4x4.getRotationQuaternion(m);
  }
}