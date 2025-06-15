import { BaseTransformation } from "./BaseTransformation";
import { Scene } from "./Interfaces";
import { GLTFNode } from "./GLTFNode";

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
