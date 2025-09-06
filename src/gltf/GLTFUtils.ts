import { GlTf, GLTFDataComponentType, GLTFDataStructureType, GLTFRenderMode } from "./Interfaces.ts";
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
import { ShadowCamera } from "../camera/ShadowCamera.ts";
import { AmbientLight } from "../lights/AmbientLight.ts";
import { DirectionalLight } from "../lights/DirectionalLight.ts";
import { PointLightsCollection } from "../lights/PointLight.ts";
import gltfSkinnedWGSL from "../shaders/gltfSkinned.wgsl?raw";
import gltfRigidWGSL from "../shaders/gltfRigid.wgsl?raw";
import gltfRigidLitWGSL from "../shaders/gltfRigidLit.wgsl?raw";
import gltfSkinnedLitWGSL from "../shaders/gltfSkinnedLit.wgsl?raw";

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

// Helper functions for lit materials
const createDiffuseColorBuffer = (device: GPUDevice, color: number[]): GPUBuffer => {
  const buffer = device.createBuffer({
    size: 16, // vec4<f32>
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(buffer, 0, new Float32Array(color));
  return buffer;
};

const createShininessBuffer = (device: GPUDevice, shininess: number): GPUBuffer => {
  const buffer = device.createBuffer({
    size: 4, // f32
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(buffer, 0, new Float32Array([shininess]));
  return buffer;
};

const createDefaultShadowTexture = (device: GPUDevice): GPUTexture => {
  return device.createTexture({
    size: [1, 1],
    format: "depth32float",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
  });
};

const createDefaultShadowSampler = (device: GPUDevice): GPUSampler => {
  return device.createSampler({
    magFilter: "linear",
    minFilter: "linear",
    compare: "less",
  });
};

// Upload a GLB model, parse its JSON and Binary components, and create the requisite GPU resources
// to render them. NOTE: Not extensible to all GLTF contexts at this point in time
export const convertGLBToJSONAndBinary = async (
  buffer: ArrayBuffer, 
  device: GPUDevice, 
  camera: Camera, 
  depthTexture: GPUTexture, 
  presentationFormat: GPUTextureFormat,
  shadowCamera?: ShadowCamera,
  ambientLight?: AmbientLight,
  directionalLight?: DirectionalLight,
  pointLights?: PointLightsCollection,
  useLighting: boolean = false,
  _shadowTexture?: any
): Promise<TempReturn> => {  // Binary GLTF layout: https://cdn.willusher.io/webgpu-0-to-gltf/glb-layout.svg
  
  // Use actual shadow texture if provided, otherwise use default
  const shadowTexture = _shadowTexture ? _shadowTexture.texture : createDefaultShadowTexture(device);
  const shadowSampler = _shadowTexture ? _shadowTexture.sampler : createDefaultShadowSampler(device);
  const bindGroupLayouts = new BindGroupLayouts(device, camera, shadowCamera, ambientLight, directionalLight, pointLights);
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
          mimeType: source?.mimeType,
          name: tex.name ?? "unnamed_texture",
        };
      })
    );

    for (const texture of textures) {
      if (texture.source && texture.source.view !== undefined) {
        const bufferView = texture.source.view;
        const imageBytes = new Uint8Array(bufferView.buffer, bufferView.byteOffset, bufferView.byteLength);
        const blob = new Blob([imageBytes], { type: texture.mimeType });
        const imageBitmap = await createImageBitmap(blob);
          // Determine if this is a color texture or non-color data
        let format: GPUTextureFormat = "rgba8unorm";
        const textureIndex = textures.indexOf(texture);
        
        // Check if this texture is used as a color texture in any material
        const isColorTexture = jsonChunk.materials?.some(material => {
          if (material.pbrMetallicRoughness?.baseColorTexture?.index === textureIndex) {
            return true;
          }
          if (material.extensions?.KHR_materials_pbrSpecularGlossiness?.diffuseTexture?.index === textureIndex) {
            return true;
          }
          if (material.emissiveTexture?.index === textureIndex) {
            return true;
          }
          return false;
        });
        
        // Check if this is a non-color data texture (normal maps, etc.)
        const isNonColorDataTexture = jsonChunk.materials?.some(material => {
          if (material.normalTexture?.index === textureIndex) {
            return true;
          }
          if (material.pbrMetallicRoughness?.metallicRoughnessTexture?.index === textureIndex) {
            return true;
          }
          if (material.occlusionTexture?.index === textureIndex) {
            return true;
          }
          if (material.extensions?.KHR_materials_pbrSpecularGlossiness?.specularGlossinessTexture?.index === textureIndex) {
            return true;
          }
          return false;
        });
        
        // Use sRGB format for color textures, and linear format for non-color data
        if (isColorTexture) {
          format = "rgba8unorm-srgb";
        } else if (isNonColorDataTexture) {
          format = "rgba8unorm";
        }
        
        const gpuTexture = device.createTexture({
          size: [imageBitmap.width, imageBitmap.height],
          format: format,
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
          jsonChunk.bufferViews[jsonChunk.accessors[indicesIdx].bufferView!].usage = (jsonChunk.bufferViews[jsonChunk.accessors[indicesIdx].bufferView!].usage ?? 0) | GPUBufferUsage.INDEX;
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
        // Handle KHR_materials_pbrSpecularGlossiness extension
        let baseColorFactor = [1, 1, 1, 1];
        let baseColorTexture = undefined;
        
        if (material.extensions && material.extensions.KHR_materials_pbrSpecularGlossiness) {
          const ext = material.extensions.KHR_materials_pbrSpecularGlossiness;
          // Use diffuseFactor as baseColorFactor if available
          if (ext.diffuseFactor) {
            baseColorFactor = ext.diffuseFactor;
          }
          // Use diffuseTexture as baseColorTexture if available
          if (ext.diffuseTexture) {
            baseColorTexture = ext.diffuseTexture;
          }
        }
        
        // Standard pbrMetallicRoughness takes precedence if present
        const pbrMetallicRoughness = material.pbrMetallicRoughness ? {
          ...material.pbrMetallicRoughness
        } : {
          baseColorFactor: baseColorFactor,
          metallicFactor: 1.0,
          roughnessFactor: 1.0,
        };
        
        // Override baseColorTexture with extension's diffuseTexture if no baseColorTexture is present
        if (!pbrMetallicRoughness.baseColorTexture && baseColorTexture) {
          pbrMetallicRoughness.baseColorTexture = baseColorTexture;
        }
        
        // Create our own material object with the information we need
        return {
          name: material.name ?? `material_${index}`,
          pbrMetallicRoughness: pbrMetallicRoughness,
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
  // Create two default textures - one for color data (sRGB) and one for non-color data (linear)
  const defaultColorTexture = device.createTexture({
    label: "Default_White_Color_Texture",
    size: [1, 1],
    format: "rgba8unorm-srgb",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
  });
  
  const defaultNonColorTexture = device.createTexture({
    label: "Default_White_NonColor_Texture",
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
  // Write white pixels to both textures
  device.queue.writeTexture({ texture: defaultColorTexture }, new Uint8Array([255, 255, 255, 255]), { bytesPerRow: 4 }, { width: 1, height: 1 });
  device.queue.writeTexture({ texture: defaultNonColorTexture }, new Uint8Array([255, 255, 255, 255]), { bytesPerRow: 4 }, { width: 1, height: 1 });

  // Get base color texture from material or use default
  let baseColorTexture = defaultColorTexture;
  let baseColorSampler = defaultSampler;
  for (const material of materials) {
    // Get base color texture from material or create one from baseColorFactor

    if (material.pbrMetallicRoughness) {
      // If there's a texture, use it
      if (material.pbrMetallicRoughness.baseColorTexture && material.pbrMetallicRoughness.baseColorTexture.index !== undefined) {
        const textureInfo = material.pbrMetallicRoughness.baseColorTexture;
        const texture = textures[textureInfo.index];

        if (texture && texture.texture) {
          baseColorTexture = texture.texture;
          baseColorSampler = texture.gpuSampler || defaultSampler;
        }
      }      //If no texture but has baseColorFactor, create a 1x1 texture with that color
      else if (material.pbrMetallicRoughness.baseColorFactor) {
        const colorFactor = material.pbrMetallicRoughness.baseColorFactor;

        // Create a small texture with the base color - always use sRGB for color data
        const colorTexture = device.createTexture({
          size: [1, 1],
          format: "rgba8unorm-srgb", // Color data uses sRGB format
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
    
    // Create material bind group based on lighting mode
    if (useLighting && ambientLight && directionalLight && pointLights) {      // Create enhanced material bind group for lit rendering
      const bindGroup = device.createBindGroup({
        layout: bindGroupLayouts.litMaterialBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: baseColorTexture.createView(),
          },
          {
            binding: 1,
            resource: baseColorSampler,
          },          {
            binding: 2,
            resource: { buffer: createDiffuseColorBuffer(device, material.pbrMetallicRoughness?.baseColorFactor || [1, 1, 1, 1]) },
          },
          {
            binding: 3,
            resource: { buffer: createShininessBuffer(device, 32.0) }, // Default shininess
          },
          {
            binding: 4,
            resource: shadowTexture.createView(),
          },
          {
            binding: 5,
            resource: shadowSampler,
          },
          // Light bindings (combined to stay within 4 bind group limit)
          {
            binding: 6,
            resource: { buffer: ambientLight.buffer.buffer },
          },
          {
            binding: 7,
            resource: { buffer: directionalLight.buffer.buffer },
          },
          {
            binding: 8,
            resource: { buffer: pointLights.buffer.buffer },
          },
        ],
        label: `LitMaterial_${materialBindGroups.length}_BindGroup`,
      });
      materialBindGroups.push(bindGroup);
    } else {
      // Create standard material bind group
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
  }
  // Add a default material bind group if no materials are defined
  if (materialBindGroups.length === 0) {
    if (useLighting && ambientLight && directionalLight && pointLights) {
      // Create enhanced default material bind group for lit rendering
      const bindGroup = device.createBindGroup({
        layout: bindGroupLayouts.litMaterialBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: defaultColorTexture.createView(),
          },
          {
            binding: 1,
            resource: defaultSampler,
          },          {
            binding: 2,
            resource: { buffer: createDiffuseColorBuffer(device, [1, 1, 1, 1]) },
          },
          {
            binding: 3,
            resource: { buffer: createShininessBuffer(device, 32.0) },
          },
          {
            binding: 4,
            resource: shadowTexture.createView(),
          },
          {
            binding: 5,
            resource: shadowSampler,
          },
        ],
        label: "Default_LitMaterial_BindGroup",
      });
      materialBindGroups.push(bindGroup);
    } else {
      // Create standard default material bind group
      const bindGroup = device.createBindGroup({
        layout: bindGroupLayouts.materialBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: defaultColorTexture.createView(),
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
  }
  GLTFSkin.createSharedBindGroupLayout(device);
  
  // Create enhanced skinned bind groups for lit skinned materials if lighting is enabled
  const skinnedBindGroups: GPUBindGroup[] = [];
  
  for (const skin of jsonChunk.skins ?? []) {
    if (skin.inverseBindMatrices !== undefined && accessors[skin.inverseBindMatrices] !== undefined) {
      const inverseBindMatrixAccessor = accessors[skin.inverseBindMatrices];
      const joints = skin.joints;
      const gltfSkin = new GLTFSkin(device, inverseBindMatrixAccessor, joints, baseColorTexture, baseColorSampler);
      skins.push(gltfSkin);
      
      // Create enhanced bind group for lit skinned materials
      if (useLighting && ambientLight && directionalLight && pointLights) {
        const litSkinnedBindGroup = device.createBindGroup({
          layout: bindGroupLayouts.litSkinnedMaterialBindGroupLayout,
          entries: [
            // Material entries
            {
              binding: 0,
              resource: baseColorTexture.createView(),
            },
            {
              binding: 1,
              resource: baseColorSampler,
            },
            // Skin data entries
            {
              binding: 2,
              resource: {
                buffer: gltfSkin.jointMatricesUniformBuffer,
              },
            },
            {
              binding: 3,
              resource: {
                buffer: gltfSkin.inverseBindMatricesUniformBuffer,
              },
            },
            // Additional material properties for lighting
            {
              binding: 4,
              resource: { buffer: createDiffuseColorBuffer(device, [1, 1, 1, 1]) },
            },            {
              binding: 5,
              resource: { buffer: createShininessBuffer(device, 32.0) },
            },
            {
              binding: 6,
              resource: shadowTexture.createView(),
            },
            {
              binding: 7,
              resource: shadowSampler,
            },
            // Light entries
            {
              binding: 8,
              resource: { buffer: ambientLight.buffer.buffer },
            },
            {
              binding: 9,
              resource: { buffer: directionalLight.buffer.buffer },
            },
            {
              binding: 10,
              resource: { buffer: pointLights.buffer.buffer },
            },
          ],
          label: `LitSkinnedMaterial_${skinnedBindGroups.length}_BindGroup`,
        });
        skinnedBindGroups.push(litSkinnedBindGroup);
      } else {
        // Use the standard skin bind group for non-lit skinned materials
        skinnedBindGroups.push(gltfSkin.skinBindGroup);
      }
    }
  }
  
  const staticLayouts = [bindGroupLayouts.cameraBGCluster, bindGroupLayouts.generalUniformsBGCLuster, bindGroupLayouts.nodeUniformsBindGroupLayout, bindGroupLayouts.materialBindGroupLayout];
  const skinLayouts = [bindGroupLayouts.cameraBGCluster, bindGroupLayouts.generalUniformsBGCLuster, bindGroupLayouts.nodeUniformsBindGroupLayout, bindGroupLayouts.skinnedMaterialBindGroupLayout];
    // Lighting layouts for lit rendering (only 4 bind groups to stay within WebGPU limit)
  const litStaticLayouts = [bindGroupLayouts.cameraBGCluster, bindGroupLayouts.generalUniformsBGCLuster, bindGroupLayouts.nodeUniformsBindGroupLayout, bindGroupLayouts.litMaterialBindGroupLayout];
  const litSkinLayouts = [bindGroupLayouts.cameraBGCluster, bindGroupLayouts.generalUniformsBGCLuster, bindGroupLayouts.nodeUniformsBindGroupLayout, bindGroupLayouts.litSkinnedMaterialBindGroupLayout];  // Apply shader selection per primitive rather than per model
  meshes.forEach((mesh: GLTFMesh) => {
    mesh.primitives.forEach((primitive) => {
      // Check if this specific primitive has joint data
      const hasJoints = primitive.attributeNames.includes('JOINTS_0') && primitive.attributeNames.includes('WEIGHTS_0');
      
      if (hasJoints && jsonChunk.skins) {
        // This primitive needs skinned shader
        if (useLighting && ambientLight && directionalLight && pointLights) {
          // For lit skinned rendering, pass only uniforms for vertex shader since vertex shader is dynamically generated
          const skinnedUniforms = `
struct GeneralUniforms {
  render_mode: u32,
  skin_mode: u32,
}

struct NodeUniforms {
  world_matrix: mat4x4f,
}

@group(0) @binding(0) var<uniform> projectionView: mat4x4f;
@group(0) @binding(1) var<uniform> eyePosition: vec3f;
@group(0) @binding(2) var<uniform> lightSpaceProjectionView: mat4x4f;
@group(1) @binding(0) var<uniform> general_uniforms: GeneralUniforms;
@group(2) @binding(0) var<uniform> node_uniforms: NodeUniforms;
@group(3) @binding(2) var<storage, read> joint_matrices: array<mat4x4f>;
@group(3) @binding(3) var<storage, read> inverse_bind_matrices: array<mat4x4f>;

const MAX_JOINTS_PER_VERTEX = 4u;
`;
          primitive.buildRenderPipeline(device, skinnedUniforms, gltfSkinnedLitWGSL, presentationFormat, depthTexture.format, litSkinLayouts, `PrimitivePipeline_Skinned_Lit_${mesh.name}_${primitive.materialIndex || 0}`);
        } else {
          primitive.buildRenderPipeline(device, gltfSkinnedWGSL, gltfSkinnedWGSL, presentationFormat, depthTexture.format, skinLayouts, `PrimitivePipeline_Skinned_${mesh.name}_${primitive.materialIndex || 0}`);
        }
      } else {
        // This primitive needs rigid shader
        if (useLighting && ambientLight && directionalLight && pointLights) {
          // For lit rendering, provide basic uniforms for vertex shader since vertex shader is dynamically generated
          const rigidUniforms = `
struct GeneralUniforms {
  render_mode: u32,
}

struct NodeUniforms {
  world_matrix: mat4x4f,
}

@group(0) @binding(0) var<uniform> projectionView: mat4x4f;
@group(0) @binding(1) var<uniform> eyePosition: vec3f;
@group(0) @binding(2) var<uniform> lightSpaceProjectionView: mat4x4f;
@group(1) @binding(0) var<uniform> general_uniforms: GeneralUniforms;
@group(2) @binding(0) var<uniform> node_uniforms: NodeUniforms;
`;
          primitive.buildRenderPipeline(device, rigidUniforms, gltfRigidLitWGSL, presentationFormat, depthTexture.format, litStaticLayouts, `PrimitivePipeline_Rigid_Lit_${mesh.name}_${primitive.materialIndex || 0}`);
        } else {
          primitive.buildRenderPipeline(device, gltfRigidWGSL, gltfRigidWGSL, presentationFormat, depthTexture.format, staticLayouts, `PrimitivePipeline_Rigid_${mesh.name}_${primitive.materialIndex || 0}`);
        }
      }    });
  });
  // Build shadow render pipelines for all meshes after regular pipelines are built
  // Shadow pipelines need different bind group layouts for rigid vs skinned models
  const rigidShadowBindGroupLayouts = [
    bindGroupLayouts.cameraBGCluster,        // group 0: camera + projection
    bindGroupLayouts.generalUniformsBGCLuster, // group 1: general uniforms
    bindGroupLayouts.nodeUniformsBindGroupLayout // group 2: node transform
  ];
  
  const skinnedShadowBindGroupLayouts = [
    bindGroupLayouts.cameraBGCluster,        // group 0: camera + projection
    bindGroupLayouts.generalUniformsBGCLuster, // group 1: general uniforms
    bindGroupLayouts.nodeUniformsBindGroupLayout, // group 2: node transform
    bindGroupLayouts.skinnedMaterialBindGroupLayout // group 3: joint matrices for skinned models
  ];
  
  meshes.forEach((mesh: GLTFMesh) => {
    mesh.buildShadowRenderPipelines(device, rigidShadowBindGroupLayouts, skinnedShadowBindGroupLayouts);
  });

  // Create separate bind group arrays for primitives to choose from based on their shader requirements
  const materialBindGroupsForSelection = materialBindGroups;
  const skinnedBindGroupsForSelection = skinnedBindGroups;
  
  // Create a mapping function that primitives can use to get the correct bind group
  const getBindGroupForPrimitive = (primitive: GLTFPrimitive) => {
    const hasJoints = primitive.attributeNames.includes('JOINTS_0') && primitive.attributeNames.includes('WEIGHTS_0');
    
    if (hasJoints && jsonChunk.skins) {
      // Return skinned bind group for skinned primitives
      return skinnedBindGroupsForSelection[primitive.materialIndex ?? 0] || skinnedBindGroupsForSelection[0];
    } else {
      // Return material bind group for non-skinned primitives  
      return materialBindGroupsForSelection[primitive.materialIndex ?? 0] || materialBindGroupsForSelection[0];
    }
  };
  
  // For backward compatibility, still provide a selectedBindGroup (use material bind groups as default)
  const selectedBindGroup = materialBindGroups;

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
  });  for (const currNode of jsonChunk.nodes ?? []) {
    const pos = currNode.translation ? new Vec3(...currNode.translation) : new Vec3(0, 0, 0);
    const scl = currNode.scale ? new Vec3(...currNode.scale) : new Vec3(1, 1, 1);
    const rot = currNode.rotation ?? [0, 0, 0, 1];
    const nodeTransform = new BaseTransformation(pos, rot, scl);

    const nodeToCreate = new GLTFNode(device, nodeUniformsBindGroupLayout, nodeTransform, currNode.name, currNode.skin !== undefined && skins[currNode.skin] !== undefined ? skins[currNode.skin] : undefined);
    const meshToAdd = currNode.mesh !== undefined && meshes[currNode.mesh] !== undefined ? meshes[currNode.mesh] : undefined;
    
    if (meshToAdd) {
      nodeToCreate.drawables.push(meshToAdd);
      console.log(`Added mesh to node ${currNode.name || 'unnamed'}, drawables count: ${nodeToCreate.drawables.length}`);
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

  const calculateGLTFBoundingBox = (gltfData: any): { min: Vec3; max: Vec3 } => {
      let min = new Vec3(Infinity, Infinity, Infinity);
      let max = new Vec3(-Infinity, -Infinity, -Infinity);

      // Iterate through all meshes and their primitives
      if (gltfData.meshes) {
          for (const mesh of gltfData.meshes) {
              for (const primitive of mesh.primitives) {
                  const positionAccessor = gltfData.accessors[primitive.attributes.POSITION];
                  if (positionAccessor && positionAccessor.min && positionAccessor.max) {
                      // Update overall bounding box
                      min.x = Math.min(min.x, positionAccessor.min[0]);
                      min.y = Math.min(min.y, positionAccessor.min[1]);
                      min.z = Math.min(min.z, positionAccessor.min[2]);
                      
                      max.x = Math.max(max.x, positionAccessor.max[0]);
                      max.y = Math.max(max.y, positionAccessor.max[1]);
                      max.z = Math.max(max.z, positionAccessor.max[2]);
                  }
              }
          }
      }

      return { min, max };
  }

  for (const jsonScene of jsonChunk.scenes ?? []) {
    const scene = new GLTFScene(device, nodeUniformsBindGroupLayout, jsonScene);
    const sceneChildren = scene.nodes;
    sceneChildren?.forEach((childIdx) => {
      const child = nodes[childIdx];
      child.setParent(scene.root);
    });
    scenes.push(scene);
  }  return {
    meshes,
    nodes,
    scenes,
    skins,
    animations,
    textures,
    materials,
    bindGroupLayouts,
    selectedBindGroup,
    getBindGroupForPrimitive,
    useLighting,
    lightsBindGroup: bindGroupLayouts.lightsBindGroup,
    boundingBox: calculateGLTFBoundingBox(jsonChunk),
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
  getBindGroupForPrimitive: (primitive: GLTFPrimitive) => GPUBindGroup;
  useLighting: boolean;
  lightsBindGroup?: GPUBindGroup;
  boundingBox?: { min: Vec3; max: Vec3 };
};


// 
// 

// import { Vec3 } from "../math/Vec3.ts";

// 
// type RaytracedTriangle = {
//   v0: Vec3;
//   v1: Vec3;
//   v2: Vec3;
//   materialIndex: number; // or any material info you want to store
// };

// function extractTrianglesFromGLTFMesh(mesh: GLTFMesh): RaytracedTriangle[] {
//   const triangles: RaytracedTriangle[] = [];

//   for (const primitive of mesh.primitives) {
//     // Get position accessor (usually "POSITION")
//     const posAccessor = primitive.attributeMap["POSITION"];
//     if (!posAccessor) continue;

//     const positions = posAccessor.getFloat32Array(); // Flat array [x0, y0, z0, x1, y1, z1, ...]
//     const indicesAccessor = primitive.attributeMap["INDICES"];
//     let indices: Uint32Array | null = null;
//     if (indicesAccessor) {
//       indices = indicesAccessor.getUint32Array(); // Indices into the positions array
//     }

//     // Each triangle is 3 indices
//     const triangleCount = indices ? indices.length / 3 : positions.length / 9;
//     for (let i = 0; i < triangleCount; i++) {
//       let idx0, idx1, idx2;
//       if (indices) {
//         idx0 = indices[i * 3 + 0];
//         idx1 = indices[i * 3 + 1];
//         idx2 = indices[i * 3 + 2];
//       } else {
//         idx0 = i * 3 + 0;
//         idx1 = i * 3 + 1;
//         idx2 = i * 3 + 2;
//       }
//       const v0 = new Vec3(
//         positions[idx0 * 3 + 0],
//         positions[idx0 * 3 + 1],
//         positions[idx0 * 3 + 2]
//       );
//       const v1 = new Vec3(
//         positions[idx1 * 3 + 0],
//         positions[idx1 * 3 + 1],
//         positions[idx1 * 3 + 2]
//       );
//       const v2 = new Vec3(
//         positions[idx2 * 3 + 0],
//         positions[idx2 * 3 + 1],
//         positions[idx2 * 3 + 2]
//       );
//       triangles.push({
//         v0,
//         v1,
//         v2,
//         materialIndex: primitive.materialIndex ?? 0,
//       });
//     }
//   }
//   return triangles;
// }

// // Usage example after loading a GLTF file:
// const { meshes } = await convertGLBToJSONAndBinary(buffer, device, camera, depthTexture, presentationFormat);
// const triangles = extractTrianglesFromGLTFMesh(meshes[0]);
// console.log(triangles);