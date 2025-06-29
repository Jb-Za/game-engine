import { BaseTransformation } from "./BaseTransformation";
import { Scene } from "./Interfaces";
import { GLTFNode } from "./GLTFNode";

//most of this implementation is based on the gltf-skinning example from the webgpu samples repo
//https://webgpu.github.io/webgpu-samples/.
// I have adapted it to fit my project with an attempt to build upon its features

export class GLTFScene {
  nodes?: number[];
  root: GLTFNode;
  name?: string;

  constructor(
    device: GPUDevice,
    nodeTransformBGL: GPUBindGroupLayout,
    baseScene: Scene
  ) {
    this.nodes = baseScene.nodes;
    this.name = baseScene.name;
    this.root = new GLTFNode(
      device,
      nodeTransformBGL,
      new BaseTransformation(),
      baseScene.name
    );
  }
}
