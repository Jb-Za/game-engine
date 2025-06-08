import { Camera } from "../camera/Camera";
import { AmbientLight } from "../lights/AmbientLight";
import { DirectionalLight } from "../lights/DirectionalLight";
import { ShadowCamera } from "../camera/ShadowCamera";
import { PointLightsCollection } from "../lights/PointLight";
import { Mat3x3 } from "../math/Mat3x3";
import { Mat4x4 } from "../math/Mat4x4";
import { Vec3 } from "../math/Vec3";
import { UniformBuffer } from "../uniform_buffers/UniformBuffer";
import { gLTFRenderPipeline } from "../render_pipelines/gLTFRenderPipeline";
import { ShadowRenderPipeline } from "../render_pipelines/ShadowRenderPipeline";
import { GeometryBuffers } from "../attribute_buffers/GeometryBuffers";
import { GLTFBuffers } from "../attribute_buffers/GLTFBuffers";
import { GLTFAccessor } from "./GLTFAccessor";
import { GLTFPrimitive } from "./GLTFPrimitive";
import { Vec4 } from "../math/Vec4";
import { RenderPipeline } from "../render_pipelines/RenderPipeline";

export class GLTFMesh {
  public primitives: GLTFPrimitive[];
  public vertices: Float32Array = new Float32Array();
  public jointIndices: Uint16Array = new Uint16Array();
  public jointWeights: Float32Array = new Float32Array();

  public scale = new Vec3(1, 1, 1);
  public position = new Vec3(0, 0, 0);
  private shadowPipeline: ShadowRenderPipeline;
  private transformBuffer: UniformBuffer;
  private transform = Mat4x4.identity();
  private normalMatrixBuffer: UniformBuffer;
  public pipeline: RenderPipeline;
  //public pipeline: gLTFRenderPipeline;
  private device: GPUDevice;
  // private jointIndicesBuffer: GPUBuffer;
  // private jointWeightsBuffer: GPUBuffer;
  // private globalBoneTransformBuffer: UniformBuffer;

  constructor(name: string, primitives: any, device: GPUDevice, camera: Camera, shadowCamera: ShadowCamera, ambientLight: AmbientLight, directionalLight: DirectionalLight, pointLights: PointLightsCollection, private buffers: GLTFBuffers) {
    this.device = device;
    this.primitives = primitives;
    this.transformBuffer = new UniformBuffer(device, this.transform, "GLTF Transform");
    this.normalMatrixBuffer = new UniformBuffer(device, 16 * Float32Array.BYTES_PER_ELEMENT, "GLTF Normal Matrix");
    //this.pipeline = new gLTFRenderPipeline(device, camera, shadowCamera, this.transformBuffer, this.normalMatrixBuffer, globalBoneTransformBuffer, ambientLight, directionalLight, pointLights);
    this.pipeline =  new RenderPipeline(device, camera, shadowCamera, this.transformBuffer, this.normalMatrixBuffer, ambientLight, directionalLight, pointLights);
    this.shadowPipeline = new ShadowRenderPipeline(device, shadowCamera, this.transformBuffer);
  }

  public update() {
    const scale = Mat4x4.scale(this.scale.x, this.scale.y, this.scale.z);
    const translate = Mat4x4.translation(this.position.x, this.position.y, this.position.z);
    this.transform = Mat4x4.multiply(translate, scale);
    this.transformBuffer.update(this.transform);

    let normalMatrix = Mat3x3.fromMat4x4(this.transform);
    normalMatrix = Mat3x3.transpose(normalMatrix);
    normalMatrix = Mat3x3.inverse(normalMatrix);
    this.normalMatrixBuffer.update(Mat3x3.to16AlignedMat3x3(normalMatrix));
  }

  draw(renderPassEncoder: GPURenderPassEncoder) {
    // Draw the primitives
    this.pipeline.draw(renderPassEncoder, this.buffers);
  }
}
