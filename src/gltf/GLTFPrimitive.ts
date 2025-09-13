import { convertGPUVertexFormatToWGSLFormat } from "./GLTFUtils.ts";
import { AttributeMapInterface, GLTFRenderMode } from "./Interfaces.ts";

//most of this implementation is based on the gltf-skinning example from the webgpu samples repo
//https://webgpu.github.io/webgpu-samples/.
// I have adapted it to fit my project with an attempt to build upon its features

export class GLTFPrimitive {
  topology: GLTFRenderMode;
  renderPipeline: GPURenderPipeline | undefined;
  shadowRenderPipeline: GPURenderPipeline | undefined;
  private attributeMap: AttributeMapInterface;
  private attributes: string[] = [];
  materialIndex?: number; // Track which material this primitive uses

  // Public getter for attributes
  public get attributeNames(): string[] {
    return this.attributes;
  }

  constructor(topology: GLTFRenderMode, attributeMap: AttributeMapInterface, attributes: string[], materialIndex?: number) {
    this.topology = topology;
    this.renderPipeline = undefined;
    this.shadowRenderPipeline = undefined;
    // Maps attribute names to accessors
    this.attributeMap = attributeMap;
    this.attributes = attributes;
    this.materialIndex = materialIndex;

    for (const key in this.attributeMap) {
      this.attributeMap[key].view.needsUpload = true;
      if (key === "INDICES") {
        this.attributeMap["INDICES"].view.addUsage(GPUBufferUsage.INDEX);
        continue;
      }
      this.attributeMap[key].view.addUsage(GPUBufferUsage.VERTEX);
    }
  }

  buildRenderPipeline(device: GPUDevice, vertexShader: string, fragmentShader: string, colorFormat: GPUTextureFormat, depthFormat: GPUTextureFormat, bgLayouts: GPUBindGroupLayout[], label: string, multipleRenderTargets: boolean = false) {
    // For now, just check if the attributeMap contains a given attribute using map.has(), and add it if it does
    // POSITION, NORMAL, TEXCOORD_0, JOINTS_0, WEIGHTS_0 for order
    // Vertex attribute state and shader stage
    let VertexInputShaderString = `struct VertexInput {\n`;
    const vertexBuffers: GPUVertexBufferLayout[] = this.attributes.map((attr, idx) => {
      const vertexFormat: GPUVertexFormat = this.attributeMap[attr].vertexType as GPUVertexFormat;
      const attrString = attr.toLowerCase().replace(/_0$/, "");
      VertexInputShaderString += `\t@location(${idx}) ${attrString}: ${convertGPUVertexFormatToWGSLFormat(vertexFormat)},\n`;
      return {
        arrayStride: this.attributeMap[attr].byteStride,
        attributes: [
          {
            format: this.attributeMap[attr].vertexType,
            offset: 0, // <-- Always 0 for non-interleaved buffers
            shaderLocation: idx,
          },
        ],
      } as GPUVertexBufferLayout;
    });
    VertexInputShaderString += "}";

    // Add VertexOutput struct definition
    let VertexOutputShaderString = `
struct VertexOutput {
    @builtin(position) Position: vec4f,`;

    if (this.attributes.includes("NORMAL")) {
      VertexOutputShaderString += `
    @location(0) normal: vec3f,`;
    }

    let locationIndex = 1;
    if (this.attributes.includes("JOINTS_0")) {
      VertexOutputShaderString += `
    @location(${locationIndex}) joints: vec4f,`;
      locationIndex++;
    }

    if (this.attributes.includes("WEIGHTS_0")) {
      VertexOutputShaderString += `
    @location(${locationIndex}) weights: vec4f,`;
      locationIndex++;
    }

    if (this.attributes.includes("TEXCOORD_0")) {
      VertexOutputShaderString += `
    @location(${locationIndex}) texcoord: vec2f,`;
      locationIndex++;
    }

    // Add lighting-related outputs
    VertexOutputShaderString += `
    @location(${locationIndex}) fragPos: vec3f,
    @location(${locationIndex + 1}) eye: vec3f,
    @location(${locationIndex + 2}) lightSpaceFragmentPos: vec4f,`;

    VertexOutputShaderString += `
}`;

    let VertexMainShaderString = `
    @vertex 
    fn vertexMain(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;\n`;

    if (this.attributes.includes("JOINTS_0")) {
      VertexMainShaderString += `  let local_position = vec4f(input.position.x, input.position.y, input.position.z, 1.0);
      // Generic skinning calculation
        var skin_matrix = mat4x4f();
        for (var i = 0u; i < MAX_JOINTS_PER_VERTEX; i = i + 1u) {
          let joint_idx = input.joints[i];
          let weight = input.weights[i];
          let joint_matrix = joint_matrices[joint_idx] * inverse_bind_matrices[joint_idx];
          skin_matrix = skin_matrix + joint_matrix * weight;
        }

        var world_position: vec4f;
        if (general_uniforms.skin_mode == 0u) {
          world_position = node_uniforms.world_matrix * (skin_matrix * local_position);
        } else {
          world_position = node_uniforms.world_matrix * local_position;
        }

        // Output joints as vec4f (pad with 0 if fewer than 4)
        var joints_vec = vec4f(0.0, 0.0, 0.0, 0.0);
        for (var i = 0u; i < MAX_JOINTS_PER_VERTEX && i < 4u; i = i + 1u) {
          joints_vec[i] = f32(input.joints[i]);
        }
        output.joints = joints_vec;
        `;
    } else {
      VertexMainShaderString += `  let local_position = vec4f(input.position, 1.0);
         let world_position = node_uniforms.world_matrix * local_position;
      `;
    }
    VertexMainShaderString += `output.Position = projectionView * world_position;
    `;
    if (this.attributes.includes("NORMAL")) {
      if (this.attributes.includes("JOINTS_0")) {
        VertexMainShaderString += `
        // Transform normal for skinned models
        var skinned_normal = vec3f(0.0, 0.0, 0.0);
        for (var i = 0u; i < MAX_JOINTS_PER_VERTEX; i = i + 1u) {
          let joint_idx = input.joints[i];
          let weight = input.weights[i];
          let joint_matrix = joint_matrices[joint_idx] * inverse_bind_matrices[joint_idx];
          skinned_normal = skinned_normal + (joint_matrix * vec4f(input.normal, 0.0)).xyz * weight;
        }
        
        var world_normal: vec3f;
        if (general_uniforms.skin_mode == 0u) {
          world_normal = (node_uniforms.world_matrix * vec4f(skinned_normal, 0.0)).xyz;
        } else {
          world_normal = (node_uniforms.world_matrix * vec4f(input.normal, 0.0)).xyz;
        }
        output.normal = normalize(world_normal);
        `;
      } else {
        VertexMainShaderString += `
        // Transform normal for rigid models
        let world_normal = (node_uniforms.world_matrix * vec4f(input.normal, 0.0)).xyz;
        output.normal = normalize(world_normal);
        `;
      }
    }
    if (this.attributes.includes("WEIGHTS_0")) {
      VertexMainShaderString += `output.weights = input.weights;
      `;
    }
    if (this.attributes.includes("TEXCOORD_0")) {
      VertexMainShaderString += `output.texcoord = input.texcoord;
      `;
    }
    // Add lighting data outputs for lit shaders
    VertexMainShaderString += `
    // Lighting data
    output.fragPos = world_position.xyz;
    output.eye = eyePosition.xyz;
    output.lightSpaceFragmentPos = lightSpaceProjectionView * vec4f(world_position.xyz, 1.0);
    `;

    VertexMainShaderString += `\nreturn output;\n}\n
    `;
    const vertexState: GPUVertexState = {
      // Shader stage info
      module: device.createShaderModule({
        code: VertexInputShaderString + VertexOutputShaderString + VertexMainShaderString + vertexShader,
      }),
      buffers: vertexBuffers,
      entryPoint: "vertexMain",
    };    
    
    const fragmentState: GPUFragmentState = {
      // Shader info
      module: device.createShaderModule({
        code: VertexOutputShaderString + fragmentShader,
      }),
      // Output render target info - conditionally support multiple render targets for post-processing
      targets: multipleRenderTargets ? [
        { format: colorFormat }, // Color output
        { format: "rgba8unorm" }, // Normal output
        { format: "rgba8unorm" }, // Depth output
      ] : [
        { format: colorFormat }, // Single color output
      ],
      entryPoint: "fragmentMain",
    };
    // This loader only supports triangle lists and strips, so by default we set
    // the primitive topology to triangle list, and check if it's instead a triangle strip
    const primitive: GPUPrimitiveState = {
      topology: "triangle-list",
      cullMode: "none", // Disable backface culling for double-sided rendering
    };
    if (this.topology == GLTFRenderMode.TRIANGLE_STRIP) {
      primitive.topology = "triangle-strip";
      primitive.stripIndexFormat = this.attributeMap["INDICES"].vertexType as GPUIndexFormat;
    }

    const layout: GPUPipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: bgLayouts,
      label: `${label}.pipelineLayout`,
    });

    const rpDescript: GPURenderPipelineDescriptor = {
      layout: layout,
      label: `${label}.pipeline`,
      vertex: vertexState,
      fragment: fragmentState,
      primitive: primitive,
      depthStencil: {
        format: depthFormat,
        depthWriteEnabled: true,
        depthCompare: "less",
      },
    };

    this.renderPipeline = device.createRenderPipeline(rpDescript);
  }

  renderShadows(renderPassEncoder: GPURenderPassEncoder, bindGroups: GPUBindGroup[]) {
    // For GLTF primitives, we need a custom shadow rendering approach
    // since we can't use the standard ShadowRenderPipeline that expects GeometryBuffers

    // Create a simple shadow render pipeline if it doesn't exist
    if (!this.shadowRenderPipeline) {
      console.error("[PRIMITIVE SHADOW] Shadow render pipeline not built for primitive with topology:", this.topology);
      throw new Error("Shadow render pipeline not built. Call buildShadowRenderPipeline first.");
    }

    const isSkinned = this.attributes.includes("JOINTS_0");

    renderPassEncoder.setPipeline(this.shadowRenderPipeline);

    // Set bind groups - skinned models need 4 bind groups, rigid models need 3
    const requiredBindGroups = isSkinned ? 4 : 3;
    for (let i = 0; i < Math.min(bindGroups.length, requiredBindGroups); i++) {
      renderPassEncoder.setBindGroup(i, bindGroups[i]);
    }    // Set vertex buffers based on model type
    if (isSkinned) {
      // For skinned models, set position, joints, and weights buffers
      let bufferIndex = 0;

      // Position buffer (always first)
      if (this.attributeMap["POSITION"]) {
        const posAccessor = this.attributeMap["POSITION"];
        const posBufferView = posAccessor.view;
        const posAvailableSize = posBufferView.view.byteLength - posAccessor.byteOffset;
        const posSafeSize = Math.min(posAccessor.byteLength, posAvailableSize);
        renderPassEncoder.setVertexBuffer(bufferIndex++, posBufferView.gpuBuffer!, posAccessor.byteOffset, posSafeSize);
      }

      // Joints buffer
      if (this.attributeMap["JOINTS_0"]) {
        const jointsAccessor = this.attributeMap["JOINTS_0"];
        const jointsBufferView = jointsAccessor.view;
        const jointsAvailableSize = jointsBufferView.view.byteLength - jointsAccessor.byteOffset;
        const jointsSafeSize = Math.min(jointsAccessor.byteLength, jointsAvailableSize);
        renderPassEncoder.setVertexBuffer(bufferIndex++, jointsBufferView.gpuBuffer!, jointsAccessor.byteOffset, jointsSafeSize);
      }

      // Weights buffer
      if (this.attributeMap["WEIGHTS_0"]) {
        const weightsAccessor = this.attributeMap["WEIGHTS_0"];
        const weightsBufferView = weightsAccessor.view;
        const weightsAvailableSize = weightsBufferView.view.byteLength - weightsAccessor.byteOffset;
        const weightsSafeSize = Math.min(weightsAccessor.byteLength, weightsAvailableSize);
        renderPassEncoder.setVertexBuffer(bufferIndex++, weightsBufferView.gpuBuffer!, weightsAccessor.byteOffset, weightsSafeSize);
      }
    } else {
      // For rigid models, only set the position vertex buffer
      if (this.attributeMap["POSITION"]) {
        const posAccessor = this.attributeMap["POSITION"];
        const posBufferView = posAccessor.view;
        const posAvailableSize = posBufferView.view.byteLength - posAccessor.byteOffset;
        const posSafeSize = Math.min(posAccessor.byteLength, posAvailableSize);
        renderPassEncoder.setVertexBuffer(0, posBufferView.gpuBuffer!, posAccessor.byteOffset, posSafeSize);
      }
    }    // Render with or without indices
    if (this.attributeMap["INDICES"]) {
      const indicesAccessor = this.attributeMap["INDICES"];
      const indicesBufferView = indicesAccessor.view;
      const indicesAvailableSize = indicesBufferView.view.byteLength - indicesAccessor.byteOffset;
      const indicesSafeSize = Math.min(indicesAccessor.byteLength, indicesAvailableSize);
      renderPassEncoder.setIndexBuffer(indicesBufferView.gpuBuffer!, indicesAccessor.vertexType as GPUIndexFormat, indicesAccessor.byteOffset, indicesSafeSize);
      renderPassEncoder.drawIndexed(indicesAccessor.count);
    } else {
      renderPassEncoder.draw(this.attributeMap["POSITION"].count);
    }
  }

  buildShadowRenderPipeline(device: GPUDevice, bgLayouts: GPUBindGroupLayout[], label: string) {
    // Create shadow vertex shader that supports skinning for animated models
    const isSkinned = this.attributes.includes("JOINTS_0");

    let shadowVertexShader = `
struct GeneralUniforms {
    render_mode: u32,
    skin_mode: u32,
}

struct NodeUniforms { 
    world_matrix: mat4x4f,
}

struct VSInput {
    @location(0) position: vec3f,`;

    if (isSkinned) {
      shadowVertexShader += `
    @location(1) joints: vec4<u32>,
    @location(2) weights: vec4f,`;
    }

    shadowVertexShader += `
};

struct VSOutput {
    @builtin(position) position: vec4f,
};

@group(0) @binding(0) var<uniform> projectionView: mat4x4f;
@group(1) @binding(0) var<uniform> general_uniforms: GeneralUniforms;
@group(2) @binding(0) var<uniform> node_uniforms: NodeUniforms;`;

    if (isSkinned) {
      shadowVertexShader += `

// For skinned models, we need access to joint matrices
@group(3) @binding(2) var<storage, read> joint_matrices: array<mat4x4f>;
@group(3) @binding(3) var<storage, read> inverse_bind_matrices: array<mat4x4f>;

const MAX_JOINTS_PER_VERTEX = 4u;`;
    }

    shadowVertexShader += `

@vertex
fn shadowVS(input: VSInput) -> VSOutput {
    var output: VSOutput;
    
    let local_position = vec4f(input.position, 1.0);`;

    if (isSkinned) {
      shadowVertexShader += `
    
    // Apply skinning transformation for animated models
    var skin_matrix = mat4x4f();
    for (var i = 0u; i < MAX_JOINTS_PER_VERTEX; i = i + 1u) {
        let joint_idx = input.joints[i];
        let weight = input.weights[i];
        let joint_matrix = joint_matrices[joint_idx] * inverse_bind_matrices[joint_idx];
        skin_matrix = skin_matrix + joint_matrix * weight;
    }
    
    var world_position: vec4f;
    if (general_uniforms.skin_mode == 0u) {
        world_position = node_uniforms.world_matrix * (skin_matrix * local_position);
    } else {
        world_position = node_uniforms.world_matrix * local_position;
    }`;
    } else {
      shadowVertexShader += `
    
    // Simple transformation for rigid models
    let world_position = node_uniforms.world_matrix * local_position;`;
    }

    shadowVertexShader += `
    
    output.position = projectionView * world_position;
    return output;
}
`; // Create vertex buffer layout based on whether the model is skinned
    const vertexBufferLayouts: GPUVertexBufferLayout[] = [];

    if (isSkinned) {
      // For skinned models, we need separate buffers for each attribute
      // Position buffer
      if (this.attributeMap["POSITION"]) {
        vertexBufferLayouts.push({
          arrayStride: this.attributeMap["POSITION"].byteStride,
          attributes: [
            {
              format: this.attributeMap["POSITION"].vertexType as GPUVertexFormat,
              offset: 0,
              shaderLocation: 0,
            },
          ],
        });
      }

      // Joints buffer
      if (this.attributeMap["JOINTS_0"]) {
        vertexBufferLayouts.push({
          arrayStride: this.attributeMap["JOINTS_0"].byteStride,
          attributes: [
            {
              format: this.attributeMap["JOINTS_0"].vertexType as GPUVertexFormat,
              offset: 0,
              shaderLocation: 1,
            },
          ],
        });
      }

      // Weights buffer
      if (this.attributeMap["WEIGHTS_0"]) {
        vertexBufferLayouts.push({
          arrayStride: this.attributeMap["WEIGHTS_0"].byteStride,
          attributes: [
            {
              format: this.attributeMap["WEIGHTS_0"].vertexType as GPUVertexFormat,
              offset: 0,
              shaderLocation: 2,
            },
          ],
        });
      }
    } else {
      // For rigid models, only position buffer is needed
      vertexBufferLayouts.push({
        arrayStride: this.attributeMap["POSITION"].byteStride,
        attributes: [
          {
            format: this.attributeMap["POSITION"].vertexType as GPUVertexFormat,
            offset: 0,
            shaderLocation: 0,
          },
        ],
      });
    }

    const primitive: GPUPrimitiveState = {
      topology: "triangle-list",
      cullMode: "none",
    };
    if (this.topology == GLTFRenderMode.TRIANGLE_STRIP) {
      primitive.topology = "triangle-strip";
      primitive.stripIndexFormat = this.attributeMap["INDICES"]?.vertexType as GPUIndexFormat;
    }

    const vertexState: GPUVertexState = {
      module: device.createShaderModule({
        code: shadowVertexShader,
      }),
      buffers: vertexBufferLayouts,
      entryPoint: "shadowVS",
    };
    const layout: GPUPipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: bgLayouts, // Use all provided bind group layouts
      label: `${label}.shadowPipelineLayout`,
    });

    const rpDescript: GPURenderPipelineDescriptor = {
      layout: layout,
      label: `${label}.shadowPipeline`,
      vertex: vertexState,
      primitive: primitive,
      depthStencil: {
        format: "depth32float",
        depthWriteEnabled: true,
        depthCompare: "less",
      },
      // No fragment shader or color targets for shadow rendering
    };

    this.shadowRenderPipeline = device.createRenderPipeline(rpDescript);
  }

  render(renderPassEncoder: GPURenderPassEncoder, bindGroups: GPUBindGroup[]) {
    if (!this.renderPipeline) throw new Error("Render pipeline not built");
    renderPassEncoder.setPipeline(this.renderPipeline);

    // Set required bind groups
    bindGroups.forEach((bg: GPUBindGroup, idx) => {
      if (Array.isArray(bg)) {
        renderPassEncoder.setBindGroup(idx, bg[this.materialIndex ?? 0]);
      } else {
        renderPassEncoder.setBindGroup(idx, bg);
      }
    });    // Set vertex buffers
    this.attributes.map((attr, idx) => {
      const accessor = this.attributeMap[attr];
      const bufferView = accessor.view;
      
      // Calculate the available size from the offset to the end of the buffer
      const availableSize = bufferView.view.byteLength - accessor.byteOffset;
      
      // Use the minimum of the requested size and available size to prevent buffer overrun
      const safeSize = Math.min(accessor.byteLength, availableSize);
      
      renderPassEncoder.setVertexBuffer(idx, bufferView.gpuBuffer!, accessor.byteOffset, safeSize);    });

    if (this.attributeMap["INDICES"]) {
      const indicesAccessor = this.attributeMap["INDICES"];
      const bufferView = indicesAccessor.view;
      
      // Calculate the available size from the offset to the end of the buffer
      const availableSize = bufferView.view.byteLength - indicesAccessor.byteOffset;
      
      // Use the minimum of the requested size and available size to prevent buffer overrun
      const safeSize = Math.min(indicesAccessor.byteLength, availableSize);
      
      renderPassEncoder.setIndexBuffer(bufferView.gpuBuffer!, indicesAccessor.vertexType as GPUIndexFormat, indicesAccessor.byteOffset, safeSize);
      renderPassEncoder.drawIndexed(indicesAccessor.count);
    } else {
      renderPassEncoder.draw(this.attributeMap["POSITION"].count);
    }
  }
}
