import { GeometryBuffers } from "../attribute_buffers/GeometryBuffers";
import { Geometry } from "../geometry/Geometry";
import { RenderPipeline } from "../render_pipelines/RenderPipeline";
import { GLTFRenderMode } from "./GLTFUtils";

export class GLTFPrimitive {
  positions: any;
  indices: any;
  topology: any;
  renderPipeline: RenderPipeline | null;
  materials: any;
  //geometryBuffers: GeometryBuffers;
  constructor(device: GPUDevice, positions: any, indices: any, topology: any, material: any ) {
    // TODO: ANY????
    this.renderPipeline = null;
    this.positions = positions;
    this.indices = indices;
    this.topology = topology;
    this.materials = material;
    // Set usage for the positions data and flag it as needing upload
    this.positions.view.needsUpload = true;
    this.positions.view.addUsage(GPUBufferUsage.VERTEX);

    if (this.indices) {
      // Set usage for the indices data and flag it as needing upload
      this.indices.view.needsUpload = true;
      this.indices.view.addUsage(GPUBufferUsage.INDEX);
    }


  }

  render(renderPassEncoder: GPURenderPassEncoder, device: GPUDevice, renderPipeline: RenderPipeline) {
    // Apply the accessor's byteOffset here to handle both global and interleaved
    // offsets for the buffer. Setting the offset here allows handling both cases,
    // with the downside that we must repeatedly bind the same buffer at different
    // offsets if we're dealing with interleaved attributes.
    // Since we only handle positions at the moment, this isn't a problem.
    // renderPassEncoder.setVertexBuffer(
    //   0,
    //   this.positions.view.gpuBuffer,
    //   this.positions.byteOffset,
    //   this.positions.byteLength
    // );

    // if (this.indices) {
    //   renderPassEncoder.setIndexBuffer(
    //     this.indices.view.gpuBuffer,
    //     this.indices.vertexType,
    //     this.indices.byteOffset,
    //     this.indices.byteLength
    //   );
    //   //renderPassEncoder.drawIndexed(this.indices.count);
    // } else {
    //  // renderPassEncoder.draw(this.positions.count);
    // }
    //renderPipeline.draw(renderPassEncoder, this.geometryBuffers)
  }
}
