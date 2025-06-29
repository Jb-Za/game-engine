//import { Device } from "webgpu";
import { Camera } from "../camera/Camera";
import { GeometryBuffersCollection } from "../attribute_buffers/GeometryBuffersCollection";
import { AmbientLight } from "../lights/AmbientLight";
import { DirectionalLight } from "../lights/DirectionalLight";
import { PointLightsCollection } from "../lights/PointLight";
import { ShadowCamera } from "../camera/ShadowCamera";
import { Mat4x4 } from "../math/Mat4x4";
// import { Vec3 } from "../math/Vec3";
// import { Texture2D } from "../texture/Texture2D";
// import { VertexBuffers } from "../attribute_buffers/VertexBuffers";
// import { VertexBuffersCollection } from "../attribute_buffers/VertexBuffersCollection";
import { UniformBuffer } from "../uniform_buffers/UniformBuffer";
import { ShadowRenderPipeline } from "../render_pipelines/ShadowRenderPipeline";
import { RenderPipeline } from "../render_pipelines/RenderPipeline";
import { Material } from "./Parser";
import { Vec3 } from "../math/Vec3";
import { Mat3x3 } from "../math/Mat3x3";

export class MeshObject {
  public pipeline: RenderPipeline;
  private shadowPipeline: ShadowRenderPipeline;
  private transformBuffer: UniformBuffer;
  private transform = Mat4x4.identity();
  private normalMatrixBuffer: UniformBuffer;

  public scale = new Vec3(1, 1, 1);
  public position = new Vec3(0, 0, 0);
  public rotation = new Vec3(0, -90, 0);
  //private material: Material;

  constructor(
    device: GPUDevice,
    camera: Camera,
    shadowCamera: ShadowCamera,
    ambientLight: AmbientLight,
    directionalLight: DirectionalLight,
    pointLights: PointLightsCollection,
  ) {
    this.transformBuffer = new UniformBuffer(
      device,
      this.transform,
      "Obj Transform"
    );
    this.normalMatrixBuffer = new UniformBuffer(
      device,
      16 * Float32Array.BYTES_PER_ELEMENT,
      "OBJ Normal Matrix"
    );
    this.pipeline = new RenderPipeline(
      device,
      camera,
      shadowCamera,
      this.transformBuffer,
      this.normalMatrixBuffer,
      ambientLight,
      directionalLight,
      pointLights
    );
    this.shadowPipeline = new ShadowRenderPipeline(
      device,
      shadowCamera,
      this.transformBuffer
    );
  }

  public setMaterial(material: Material) {
    //this.material = material;
    this.pipeline.diffuseColor = material.diffuse;
    this.pipeline.shininess = material.shininess;
  }

  public update() {
    const scale = Mat4x4.scale(this.scale.x, this.scale.y, this.scale.z);
    const translate = Mat4x4.translation(
      this.position.x,
      this.position.y,
      this.position.z
    );
    const rotateX = Mat4x4.rotationX(this.rotation.x);
    const rotateY = Mat4x4.rotationY(this.rotation.y);
    const rotateZ = Mat4x4.rotationZ(this.rotation.z);

    // Combine transformations: translate * rotateZ * rotateY * rotateX * scale
    this.transform = Mat4x4.multiply(
      translate,
      Mat4x4.multiply(
        rotateZ,
        Mat4x4.multiply(rotateY, Mat4x4.multiply(rotateX, scale))
      )
    );
    this.transformBuffer.update(this.transform);

    let normalMatrix = Mat3x3.fromMat4x4(this.transform);
    normalMatrix = Mat3x3.transpose(normalMatrix);
    normalMatrix = Mat3x3.inverse(normalMatrix);
    this.normalMatrixBuffer.update(Mat3x3.to16AlignedMat3x3(normalMatrix));
  }

  draw(renderPassEncoder: GPURenderPassEncoder) {
    this.pipeline.draw(
      renderPassEncoder,
      GeometryBuffersCollection.vertexBuffers
    );
  }

  public drawShadows(renderPassEncoder: GPURenderPassEncoder) {
    this.shadowPipeline.draw(
      renderPassEncoder,
      GeometryBuffersCollection.vertexBuffers
    );
  }
}
