import { GlTf, GLTFDataComponentType, GLTFDataStructureType, GLTFRenderMode, Texture } from "./Interfaces.ts";
import { Vec3 } from "../math/Vec3.ts";
import { GLTFScene } from "./GLTFScene.ts";
import { BaseTransformation } from "./BaseTransformation.ts";
import { GLTFNode } from "./GLTFNode.ts";
import { GLTFPrimitive } from "./GLTFPrimitive.ts";
import { GLTFMesh } from "./GLTFMesh.ts";
import { GLTFSkin } from "./GLTFSkin.ts";
import { GLTFBuffer } from "./GLTFBuffer.ts";
import { GLTFAccessor } from "./GLTFAccessor.ts";
import { GLTFBufferView } from "./GLTFBufferView.ts";
import { BindGroupLayouts } from "./BindGroupLayouts.ts";
import { Camera } from "../camera/Camera.ts";
import gltfSkinnedWGSL from "../shaders/gltfSkinned.wgsl?raw";
import gltfRigidWGSL from "../shaders/gltfRigid.wgsl?raw";

//most of this implementation is based on the gltf-skinning example from the webgpu samples repo
//https://webgpu.github.io/webgpu-samples/.
// I have adapted it to fit my project with an attempt to build upon its features

// Modified from Will Usher code found at this link https://www.willusher.io/graphics/2023/05/16/0-to-gltf-first-mesh

export const alignTo = (val: number, align: number): number => {
  return Math.floor((val + align - 1) / align) * align;
};

export const parseGltfDataStructureType = (type: string) => {
  switch (type) {
    case "SCALAR":
      return GLTFDataStructureType.SCALAR;
    case "VEC2":
      return GLTFDataStructureType.VEC2;
    case "VEC3":
      return GLTFDataStructureType.VEC3;
    case "VEC4":
      return GLTFDataStructureType.VEC4;
    case "MAT2":
      return GLTFDataStructureType.MAT2;
    case "MAT3":
      return GLTFDataStructureType.MAT3;
    case "MAT4":
      return GLTFDataStructureType.MAT4;
    default:
      throw Error(`Unhandled glTF Type ${type}`);
  }
};

export const gltfDataStructureTypeNumComponents = (type: GLTFDataStructureType) => {
  switch (type) {
    case GLTFDataStructureType.SCALAR:
      return 1;
    case GLTFDataStructureType.VEC2:
      return 2;
    case GLTFDataStructureType.VEC3:
      return 3;
    case GLTFDataStructureType.VEC4:
    case GLTFDataStructureType.MAT2:
      return 4;
    case GLTFDataStructureType.MAT3:
      return 9;
    case GLTFDataStructureType.MAT4:
      return 16;
    default:
      throw Error(`Invalid glTF Type ${type}`);
  }
};

// Note: only returns non-normalized type names,
// so byte/ubyte = sint8/uint8, not snorm8/unorm8, same for ushort
export const gltfVertexType = (componentType: GLTFDataComponentType, type: GLTFDataStructureType) => {
  let typeStr = null;
  switch (componentType) {
    case GLTFDataComponentType.BYTE:
      typeStr = "sint8";
      break;
    case GLTFDataComponentType.UNSIGNED_BYTE:
      typeStr = "uint8";
      break;
    case GLTFDataComponentType.SHORT:
      typeStr = "sint16";
      break;
    case GLTFDataComponentType.UNSIGNED_SHORT:
      typeStr = "uint16";
      break;
    case GLTFDataComponentType.INT:
      typeStr = "int32";
      break;
    case GLTFDataComponentType.UNSIGNED_INT:
      typeStr = "uint32";
      break;
    case GLTFDataComponentType.FLOAT:
      typeStr = "float32";
      break;
    default:
      throw Error(`Unrecognized or unsupported glTF type ${componentType}`);
  }

  switch (gltfDataStructureTypeNumComponents(type)) {
    case 1:
      return typeStr;
    case 2:
      return typeStr + "x2";
    case 3:
      return typeStr + "x3";
    case 4:
      return typeStr + "x4";
    // Vertex attributes should never be a matrix type, so we should not hit this
    // unless we're passed an improperly created gltf file
    default:
      throw Error(`Invalid number of components for gltfType: ${type}`);
  }
};

export const gltfElementSize = (componentType: GLTFDataComponentType, type: GLTFDataStructureType) => {
  let componentSize = 0;
  switch (componentType) {
    case GLTFDataComponentType.BYTE:
      componentSize = 1;
      break;
    case GLTFDataComponentType.UNSIGNED_BYTE:
      componentSize = 1;
      break;
    case GLTFDataComponentType.SHORT:
      componentSize = 2;
      break;
    case GLTFDataComponentType.UNSIGNED_SHORT:
      componentSize = 2;
      break;
    case GLTFDataComponentType.INT:
      componentSize = 4;
      break;
    case GLTFDataComponentType.UNSIGNED_INT:
      componentSize = 4;
      break;
    case GLTFDataComponentType.FLOAT:
      componentSize = 4;
      break;
    case GLTFDataComponentType.DOUBLE:
      componentSize = 8;
      break;
    default:
      throw Error("Unrecognized GLTF Component Type?");
  }
  return gltfDataStructureTypeNumComponents(type) * componentSize;
};

// Convert differently depending on if the shader is a vertex or compute shader
export const convertGPUVertexFormatToWGSLFormat = (vertexFormat: GPUVertexFormat) => {
  switch (vertexFormat) {
    case "float32": {
      return "f32";
    }
    case "float32x2": {
      return "vec2f";
    }
    case "float32x3": {
      return "vec3f";
    }
    case "float32x4": {
      return "vec4f";
    }
    case "uint32": {
      return "u32";
    }
    case "uint32x2": {
      return "vec2u";
    }
    case "uint32x3": {
      return "vec3u";
    }
    case "uint32x4": {
      return "vec4u";
    }
    case "uint8x2": {
      return "vec2u";
    }
    case "uint8x4": {
      return "vec4u";
    }
    case "uint16x4": {
      return "vec4u";
    }
    case "uint16x2": {
      return "vec2u";
    }
    default: {
      return "f32";
    }
  }
};

export const validateGLBHeader = (header: DataView) => {
  if (header.getUint32(0, true) != 0x46546c67) {
    throw Error("Provided file is not a glB file");
  }
  if (header.getUint32(4, true) != 2) {
    throw Error("Provided file is glTF 2.0 file");
  }
};

export const validateBinaryHeader = (header: Uint32Array) => {
  if (header[1] != 0x004e4942) {
    throw Error("Invalid glB: The second chunk of the glB file is not a binary chunk!");
  }
};

// Upload a GLB model, parse its JSON and Binary components, and create the requisite GPU resources
// to render them. NOTE: Not extensible to all GLTF contexts at this point in time
export const convertGLBToJSONAndBinary = async (buffer: ArrayBuffer, device: GPUDevice, camera: Camera, depthTexture: GPUTexture, presentationFormat: GPUTextureFormat): Promise<TempReturn> => {
  // Binary GLTF layout: https://cdn.willusher.io/webgpu-0-to-gltf/glb-layout.svg
  const bindGroupLayouts = new BindGroupLayouts(device, camera);
  const jsonHeader = new DataView(buffer, 0, 20);
  validateGLBHeader(jsonHeader);

  // Length of the jsonChunk found at jsonHeader[12 - 15]
  const jsonChunkLength = jsonHeader.getUint32(12, true);

  // Parse the JSON chunk of the glB file to a JSON object
  const jsonChunk: GlTf = JSON.parse(new TextDecoder("utf-8").decode(new Uint8Array(buffer, 20, jsonChunkLength)));

  // Binary data located after jsonChunk
  const binaryHeader = new Uint32Array(buffer, 20 + jsonChunkLength, 2);
  validateBinaryHeader(binaryHeader);

  const binaryChunk = new GLTFBuffer(buffer, 28 + jsonChunkLength, binaryHeader[0]);

  //Const populate missing properties of jsonChunk
  for (const accessor of jsonChunk.accessors ?? []) {
    accessor.byteOffset = accessor.byteOffset ?? 0;
    accessor.normalized = accessor.normalized ?? false;
  }

  for (const bufferView of jsonChunk.bufferViews ?? []) {
    bufferView.byteOffset = bufferView.byteOffset ?? 0;
  }

  if (jsonChunk.samplers) {
    for (const sampler of jsonChunk.samplers) {
      sampler.wrapS = sampler.wrapS ?? 10497; //GL.REPEAT
      sampler.wrapT = sampler.wrapT ?? 10947; //GL.REPEAT
    }
  }

  const textures: any[] = [];
  if (jsonChunk.textures) {
    textures.push(
      ...jsonChunk.textures.map((tex) => {
        const source = tex.source !== undefined ? jsonChunk.images?.[tex.source] : undefined;
        return {
          sampler: tex.sampler !== undefined ? jsonChunk.samplers?.[tex.sampler] : undefined,
          source: source?.bufferView !== undefined ? new GLTFBufferView(binaryChunk, jsonChunk.bufferViews![source.bufferView]) : undefined,
          name: tex.name ?? "unnamed_texture",
        };
      })
    );

    for (const texture of textures) {
      if (texture.source.view !== undefined) {
        // 1. Extract bytes from bufferView
        const bufferView = texture.source.view; // This should be your GLTFBufferView instance
        const imageBytes = new Uint8Array(bufferView.buffer, bufferView.byteOffset, bufferView.byteLength);

        // 2. Create a Blob and ImageBitmap
        const blob = new Blob([imageBytes], { type: texture.mimeType });
        const imageBitmap = await createImageBitmap(blob); // 3. Upload to GPU
        const gpuTexture = device.createTexture({
          size: [imageBitmap.width, imageBitmap.height],
          format: "rgba8unorm",
          usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
        });
        device.queue.copyExternalImageToTexture({ source: imageBitmap }, { texture: gpuTexture }, [imageBitmap.width, imageBitmap.height]);
        texture.texture = gpuTexture;

        let sampler = texture.sampler;

        // Create sampler with default or provided parameters
        const samplerDescriptor: GPUSamplerDescriptor = {
          addressModeU: sampler.wrapS === 10497 ? "repeat" : "clamp-to-edge",
          addressModeV: sampler.wrapT === 10497 ? "repeat" : "clamp-to-edge",
          magFilter: sampler.magFilter === 9728 ? "nearest" : "linear",
          minFilter: sampler.minFilter === 9728 ? "nearest" : "linear",
          mipmapFilter: "linear",
        };
        sampler.gpuSampler = device.createSampler(samplerDescriptor);
        texture.gpuSampler = sampler.gpuSampler;
      }
    }
  }

  //Mark each accessor with its intended usage within the vertexShader.
  //Often necessary due to infrequencey with which the BufferView target field is populated.
  for (const mesh of jsonChunk.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      if ("indices" in primitive && jsonChunk.accessors && jsonChunk.bufferViews) {
        const indicesIdx = primitive.indices;
        if (indicesIdx !== undefined && jsonChunk.accessors[indicesIdx] && jsonChunk.accessors[indicesIdx].bufferView !== undefined) {
          jsonChunk.accessors[indicesIdx].bufferViewUsage = (jsonChunk.accessors[indicesIdx].bufferViewUsage ?? 0) | GPUBufferUsage.INDEX;
          jsonChunk.bufferViews[jsonChunk.accessors[indicesIdx].bufferView].usage = (jsonChunk.bufferViews[jsonChunk.accessors[indicesIdx].bufferView].usage ?? 0) | GPUBufferUsage.INDEX;
        }
      }
      if (jsonChunk.accessors && jsonChunk.bufferViews) {
        for (const attribute of Object.values(primitive.attributes ?? {})) {
          const accessor = jsonChunk.accessors[attribute];
          if (accessor && accessor.bufferView !== undefined) {
            jsonChunk.accessors[attribute].bufferViewUsage = (jsonChunk.accessors[attribute].bufferViewUsage ?? 0) | GPUBufferUsage.VERTEX;
            jsonChunk.bufferViews[accessor.bufferView].usage = (jsonChunk.bufferViews[accessor.bufferView].usage ?? 0) | GPUBufferUsage.VERTEX;
          }
        }
      }
    }
  }

  // Create GLTFBufferView objects for all the buffer views in the glTF file
  const bufferViews: GLTFBufferView[] = [];
  for (let i = 0; i < (jsonChunk.bufferViews?.length ?? 0); ++i) {
    bufferViews.push(new GLTFBufferView(binaryChunk, jsonChunk.bufferViews![i]));
  }

  const accessors: GLTFAccessor[] = [];
  for (let i = 0; i < (jsonChunk.accessors?.length ?? 0); ++i) {
    const accessorInfo = jsonChunk.accessors![i];
    const viewID = accessorInfo["bufferView"];
    if (viewID === undefined) {
      throw new Error(`Accessor at index ${i} does not have a bufferView defined.`);
    }
    accessors.push(new GLTFAccessor(bufferViews[viewID], accessorInfo));
  }
  // Load the first mesh
  const meshes: GLTFMesh[] = [];
  for (let i = 0; i < (jsonChunk.meshes?.length ?? 0); i++) {
    const mesh = jsonChunk.meshes![i];
    const meshPrimitives: GLTFPrimitive[] = [];
    for (let j = 0; j < (mesh.primitives?.length ?? 0); ++j) {
      const prim = mesh.primitives[j];
      let topology = prim["mode"];
      // Default is triangles if mode specified
      if (topology === undefined) {
        topology = GLTFRenderMode.TRIANGLES;
      }
      if (topology != GLTFRenderMode.TRIANGLES && topology != GLTFRenderMode.TRIANGLE_STRIP) {
        throw Error(`Unsupported primitive mode ${prim["mode"]}`);
      }
      const primitiveAttributeMap: Record<string, GLTFAccessor> = {};
      const attributes = [];
      if (prim["indices"] !== undefined && jsonChunk.accessors && accessors[prim["indices"]] !== undefined) {
        const indices = accessors[prim["indices"]];
        primitiveAttributeMap["INDICES"] = indices;
      }

      // Loop through all the attributes and store within our attributeMap
      for (const attr in prim["attributes"] ?? {}) {
        const accessorIdx = prim["attributes"][attr];
        if (accessors[accessorIdx] !== undefined) {
          const accessor = accessors[accessorIdx];
          primitiveAttributeMap[attr] = accessor;
          if (accessor.structureType > 3) {
            throw Error("Vertex attribute accessor accessed an unsupported data type for vertex attribute");
          }
          attributes.push(attr);
        }
      }

      // Get material index if it exists
      const materialIndex = prim.material !== undefined ? prim.material : undefined;

      meshPrimitives.push(new GLTFPrimitive(topology, primitiveAttributeMap, attributes, materialIndex));
    }
    meshes.push(new GLTFMesh(mesh.name ?? "unnamed_mesh", meshPrimitives));
  }

  const skins: GLTFSkin[] = [];
  for (const skin of jsonChunk.skins ?? []) {
    if (skin.inverseBindMatrices !== undefined && accessors[skin.inverseBindMatrices] !== undefined) {
      const inverseBindMatrixAccessor = accessors[skin.inverseBindMatrices];
      inverseBindMatrixAccessor.view.addUsage(GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
      inverseBindMatrixAccessor.view.needsUpload = true;
    }
  }

  // Upload the buffer views used by mesh
  for (let i = 0; i < bufferViews.length; ++i) {
    if (bufferViews[i].needsUpload) {
      bufferViews[i].upload(device);
    }
  }

  // Parse materials
  const materials: any[] = [];
  if (jsonChunk.materials) {
    materials.push(
      ...jsonChunk.materials.map((material, index) => {
        // Create our own material object with the information we need
        return {
          name: material.name ?? `material_${index}`,
          pbrMetallicRoughness: material.pbrMetallicRoughness ?? {
            baseColorFactor: [1, 1, 1, 1],
            metallicFactor: 1.0,
            roughnessFactor: 1.0,
          },
          normalTexture: material.normalTexture,
          occlusionTexture: material.occlusionTexture,
          emissiveTexture: material.emissiveTexture,
          emissiveFactor: material.emissiveFactor ?? [0, 0, 0],
          alphaMode: material.alphaMode ?? "OPAQUE",
          alphaCutoff: material.alphaCutoff ?? 0.5,
          doubleSided: material.doubleSided ?? false,
        };
      })
    );
  }
  const materialBindGroups = [];

  const defaultTexture = device.createTexture({
    label: "Default_White_Texture",
    size: [1, 1],
    format: "rgba8unorm",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
  });

  const defaultSampler = device.createSampler({
    magFilter: "linear",
    minFilter: "linear",
    mipmapFilter: "linear",
    addressModeU: "repeat",
    addressModeV: "repeat",
  });
  device.queue.writeTexture({ texture: defaultTexture }, new Uint8Array([255, 255, 255, 255]), { bytesPerRow: 4 }, { width: 1, height: 1 });

  // Get base color texture from material or use default
  let baseColorTexture = defaultTexture;
  let baseColorSampler = defaultSampler;
  for (const material of materials) {
    // Get base color texture from material or create one from baseColorFactor
    let baseColorTexture = defaultTexture;
    let baseColorSampler = defaultSampler;

    if (material.pbrMetallicRoughness) {
      // If there's a texture, use it
      if (material.pbrMetallicRoughness.baseColorTexture && material.pbrMetallicRoughness.baseColorTexture.index !== undefined) {
        const textureInfo = material.pbrMetallicRoughness.baseColorTexture;
        const texture = textures[textureInfo.index];

        if (texture && texture.texture) {
          baseColorTexture = texture.texture;
          baseColorSampler = texture.gpuSampler || defaultSampler;
        }
      }
      // If no texture but has baseColorFactor, create a 1x1 texture with that color
      else if (material.pbrMetallicRoughness.baseColorFactor) {
        const colorFactor = material.pbrMetallicRoughness.baseColorFactor;

        // Create a small texture with the base color
        const colorTexture = device.createTexture({
          size: [1, 1],
          format: "rgba8unorm",
          usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
        });

        // Convert color factor (typically in 0.0-1.0 range) to RGBA bytes (0-255)
        const r = Math.round(colorFactor[0] * 255);
        const g = Math.round(colorFactor[1] * 255);
        const b = Math.round(colorFactor[2] * 255);
        const a = Math.round(colorFactor[3] * 255);

        device.queue.writeTexture({ texture: colorTexture }, new Uint8Array([r, g, b, a]), { bytesPerRow: 4 }, { width: 1, height: 1 });

        baseColorTexture = colorTexture;
      }
    }

    // For rigid models - create standard material bind group
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayouts.materialBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: baseColorTexture.createView(),
        },
        {
          binding: 1,
          resource: baseColorSampler,
        },
      ],
      label: `Material_${materialBindGroups.length}_BindGroup`,
    });

    materialBindGroups.push(bindGroup);
  }

  // Add a default material bind group if no materials are defined
  if (materialBindGroups.length === 0) {
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayouts.materialBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: defaultTexture.createView(),
        },
        {
          binding: 1,
          resource: defaultSampler,
        },
      ],
      label: "Default_Material_BindGroup",
    });

    materialBindGroups.push(bindGroup);
  }

  GLTFSkin.createSharedBindGroupLayout(device);
  for (const skin of jsonChunk.skins ?? []) {
    if (skin.inverseBindMatrices !== undefined && accessors[skin.inverseBindMatrices] !== undefined) {
      const inverseBindMatrixAccessor = accessors[skin.inverseBindMatrices];
      const joints = skin.joints;
      skins.push(new GLTFSkin(device, inverseBindMatrixAccessor, joints, baseColorTexture, baseColorSampler));
    }
  }

  const staticLayouts = [bindGroupLayouts.cameraBGCluster, bindGroupLayouts.generalUniformsBGCLuster, bindGroupLayouts.nodeUniformsBindGroupLayout, bindGroupLayouts.materialBindGroupLayout];
  const skinLayouts = [bindGroupLayouts.cameraBGCluster, bindGroupLayouts.generalUniformsBGCLuster, bindGroupLayouts.nodeUniformsBindGroupLayout, bindGroupLayouts.skinnedMaterialBindGroupLayout];
  if (jsonChunk.skins) {
    meshes.forEach((mesh: GLTFMesh) => {
      mesh.buildRenderPipeline(device, gltfSkinnedWGSL, gltfSkinnedWGSL, presentationFormat, depthTexture.format, skinLayouts);
    });
  } else {
    meshes.forEach((mesh: GLTFMesh) => {
      mesh.buildRenderPipeline(device, gltfRigidWGSL, gltfRigidWGSL, presentationFormat, depthTexture.format, staticLayouts);
    });
  }

  const selectedBindGroup = jsonChunk.skins ? skins.map((skin) => skin.skinBindGroup) : materialBindGroups;

  const nodes: GLTFNode[] = [];

  // Access each node. If node references a mesh, add mesh to that node
  const nodeUniformsBindGroupLayout = device.createBindGroupLayout({
    label: "NodeUniforms.bindGroupLayout",
    entries: [
      {
        binding: 0,
        buffer: {
          type: "uniform",
        },
        visibility: GPUShaderStage.VERTEX,
      },
    ],
  });
  for (const currNode of jsonChunk.nodes ?? []) {
    const pos = currNode.translation ? new Vec3(...currNode.translation) : new Vec3(0, 0, 0);
    const scl = currNode.scale ? new Vec3(...currNode.scale) : new Vec3(1, 1, 1);
    const rot = currNode.rotation ?? [0, 0, 0, 1];
    const nodeTransform = new BaseTransformation(pos, rot, scl);

    const nodeToCreate = new GLTFNode(device, nodeUniformsBindGroupLayout, nodeTransform, currNode.name, currNode.skin !== undefined && skins[currNode.skin] !== undefined ? skins[currNode.skin] : undefined);
    const meshToAdd = currNode.mesh !== undefined && meshes[currNode.mesh] !== undefined ? meshes[currNode.mesh] : undefined;
    if (meshToAdd) {
      nodeToCreate.drawables.push(meshToAdd);
    }
    nodes.push(nodeToCreate);
  }

  // Assign each node its children
  nodes.forEach((node, idx) => {
    const children = jsonChunk.nodes?.[idx]?.children;
    if (children) {
      children.forEach((childIdx) => {
        const child = nodes[childIdx];
        child.setParent(node);
      });
    }
  });
  // Process animations - resolve accessor indices to actual data arrays
  const animations = (jsonChunk.animations ?? []).map((anim) => {
    const processedAnim = { ...anim };

    // Process each sampler to resolve input/output accessor indices to actual data
    processedAnim.samplers = anim.samplers.map((sampler) => {
      const processedSampler = { ...sampler };

      // Resolve input accessor (typically time keyframes)
      if (sampler.input !== undefined && accessors[sampler.input]) {
        //@ts-ignore //TODO: Fix this type issue
        processedSampler.input = accessors[sampler.input].getFloat32Array();
      }

      // Resolve output accessor (translation, rotation, scale values)
      if (sampler.output !== undefined && accessors[sampler.output]) {
        //@ts-ignore //TODO: Fix this type issue
        processedSampler.output = accessors[sampler.output].getFloat32Array();
      }

      return processedSampler;
    });

    return processedAnim;
  });

  const scenes: GLTFScene[] = [];

  for (const jsonScene of jsonChunk.scenes ?? []) {
    const scene = new GLTFScene(device, nodeUniformsBindGroupLayout, jsonScene);
    const sceneChildren = scene.nodes;
    sceneChildren?.forEach((childIdx) => {
      const child = nodes[childIdx];
      child.setParent(scene.root);
    });
    scenes.push(scene);
  }
  return {
    meshes,
    nodes,
    scenes,
    skins,
    animations,
    textures,
    materials,
    bindGroupLayouts,
    selectedBindGroup
  };
};

export type TempReturn = {
  meshes: GLTFMesh[];
  nodes: GLTFNode[];
  scenes: GLTFScene[];
  skins: GLTFSkin[];
  animations: any[]; //TODO: Define a proper type for animations,
  textures: any[]; //TODO: Define a proper type for textures
  materials: any[]; //TODO: Define a proper type for materials,
  bindGroupLayouts: BindGroupLayouts;
  selectedBindGroup: any[]; //TODO: Define a proper type for selectedBindGroup
};
