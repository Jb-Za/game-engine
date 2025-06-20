import { GlTf, GLTFDataComponentType, GLTFDataStructureType, GLTFRenderMode } from './Interfaces.ts';
import { Vec3 } from "../math/Vec3.ts";
import { GLTFScene } from './GLTFScene.ts';
import { BaseTransformation } from './BaseTransformation.ts';
import { GLTFNode } from './GLTFNode.ts';
import { GLTFPrimitive } from './GLTFPrimitive.ts';
import { GLTFMesh } from './GLTFMesh.ts';
import { GLTFSkin } from './GLTFSkin.ts';
import { GLTFBuffer } from './GLTFBuffer.ts';
import { GLTFAccessor } from './GLTFAccessor.ts';
import { GLTFBufferView } from './GLTFBufferView.ts';

//NOTE: GLTF code is not generally extensible to all gltf models
// Modified from Will Usher code found at this link https://www.willusher.io/graphics/2023/05/16/0-to-gltf-first-mesh

export const alignTo = (val: number, align: number): number => {
  return Math.floor((val + align - 1) / align) * align;
};

export const parseGltfDataStructureType = (type: string) => {
  switch (type) {
    case 'SCALAR':
      return GLTFDataStructureType.SCALAR;
    case 'VEC2':
      return GLTFDataStructureType.VEC2;
    case 'VEC3':
      return GLTFDataStructureType.VEC3;
    case 'VEC4':
      return GLTFDataStructureType.VEC4;
    case 'MAT2':
      return GLTFDataStructureType.MAT2;
    case 'MAT3':
      return GLTFDataStructureType.MAT3;
    case 'MAT4':
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
export const gltfVertexType = (
  componentType: GLTFDataComponentType,
  type: GLTFDataStructureType
) => {
  let typeStr = null;
  switch (componentType) {
    case GLTFDataComponentType.BYTE:
      typeStr = 'sint8';
      break;
    case GLTFDataComponentType.UNSIGNED_BYTE:
      typeStr = 'uint8';
      break;
    case GLTFDataComponentType.SHORT:
      typeStr = 'sint16';
      break;
    case GLTFDataComponentType.UNSIGNED_SHORT:
      typeStr = 'uint16';
      break;
    case GLTFDataComponentType.INT:
      typeStr = 'int32';
      break;
    case GLTFDataComponentType.UNSIGNED_INT:
      typeStr = 'uint32';
      break;
    case GLTFDataComponentType.FLOAT:
      typeStr = 'float32';
      break;
    default:
      throw Error(`Unrecognized or unsupported glTF type ${componentType}`);
  }

  switch (gltfDataStructureTypeNumComponents(type)) {
    case 1:
      return typeStr;
    case 2:
      return typeStr + 'x2';
    case 3:
      return typeStr + 'x3';
    case 4:
      return typeStr + 'x4';
    // Vertex attributes should never be a matrix type, so we should not hit this
    // unless we're passed an improperly created gltf file
    default:
      throw Error(`Invalid number of components for gltfType: ${type}`);
  }
};

export const gltfElementSize = (
  componentType: GLTFDataComponentType,
  type: GLTFDataStructureType
) => {
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
      throw Error('Unrecognized GLTF Component Type?');
  }
  return gltfDataStructureTypeNumComponents(type) * componentSize;
};

// Convert differently depending on if the shader is a vertex or compute shader
export const convertGPUVertexFormatToWGSLFormat = (vertexFormat: GPUVertexFormat) => {
  switch (vertexFormat) {
    case 'float32': {
      return 'f32';
    }
    case 'float32x2': {
      return 'vec2f';
    }
    case 'float32x3': {
      return 'vec3f';
    }
    case 'float32x4': {
      return 'vec4f';
    }
    case 'uint32': {
      return 'u32';
    }
    case 'uint32x2': {
      return 'vec2u';
    }
    case 'uint32x3': {
      return 'vec3u';
    }
    case 'uint32x4': {
      return 'vec4u';
    }
    case 'uint8x2': {
      return 'vec2u';
    }
    case 'uint8x4': {
      return 'vec4u';
    }
    case 'uint16x4': {
      return 'vec4u';
    }
    case 'uint16x2': {
      return 'vec2u';
    }
    default: {
      return 'f32';
    }
  }
};

export const validateGLBHeader = (header: DataView) => {
  if (header.getUint32(0, true) != 0x46546c67) {
    throw Error('Provided file is not a glB file');
  }
  if (header.getUint32(4, true) != 2) {
    throw Error('Provided file is glTF 2.0 file');
  }
};

export const validateBinaryHeader = (header: Uint32Array) => {
  if (header[1] != 0x004e4942) {
    throw Error(
      'Invalid glB: The second chunk of the glB file is not a binary chunk!'
    );
  }
};

export type TempReturn = {
  meshes: GLTFMesh[];
  nodes: GLTFNode[];
  scenes: GLTFScene[];
  skins: GLTFSkin[];
  animations: any[]; //TODO: Define a proper type for animations
};

// Upload a GLB model, parse its JSON and Binary components, and create the requisite GPU resources
// to render them. NOTE: Not extensible to all GLTF contexts at this point in time
export const convertGLBToJSONAndBinary = async (
  buffer: ArrayBuffer,
  device: GPUDevice
): Promise<TempReturn> => {
  // Binary GLTF layout: https://cdn.willusher.io/webgpu-0-to-gltf/glb-layout.svg
  const jsonHeader = new DataView(buffer, 0, 20);
  validateGLBHeader(jsonHeader);

  // Length of the jsonChunk found at jsonHeader[12 - 15]
  const jsonChunkLength = jsonHeader.getUint32(12, true);

  // Parse the JSON chunk of the glB file to a JSON object
  const jsonChunk: GlTf = JSON.parse(
    new TextDecoder('utf-8').decode(new Uint8Array(buffer, 20, jsonChunkLength))
  );

  // Binary data located after jsonChunk
  const binaryHeader = new Uint32Array(buffer, 20 + jsonChunkLength, 2);
  validateBinaryHeader(binaryHeader);

  const binaryChunk = new GLTFBuffer(
    buffer,
    28 + jsonChunkLength,
    binaryHeader[0]
  );

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

  //Mark each accessor with its intended usage within the vertexShader.
  //Often necessary due to infrequencey with which the BufferView target field is populated.
  for (const mesh of jsonChunk.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      if ('indices' in primitive && jsonChunk.accessors && jsonChunk.bufferViews) {
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
    const viewID = accessorInfo['bufferView'];
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
      let topology = prim['mode'];
      // Default is triangles if mode specified
      if (topology === undefined) {
        topology = GLTFRenderMode.TRIANGLES;
      }
      if (
        topology != GLTFRenderMode.TRIANGLES &&
        topology != GLTFRenderMode.TRIANGLE_STRIP
      ) {
        throw Error(`Unsupported primitive mode ${prim['mode']}`);
      }

      const primitiveAttributeMap: Record<string, GLTFAccessor> = {};
      const attributes = [];
      if (prim['indices'] !== undefined && jsonChunk.accessors && accessors[prim['indices']] !== undefined) {
        const indices = accessors[prim['indices']];
        primitiveAttributeMap['INDICES'] = indices;
      }

      // Loop through all the attributes and store within our attributeMap
      for (const attr in prim['attributes'] ?? {}) {
        const accessorIdx = prim['attributes'][attr];
        if (accessors[accessorIdx] !== undefined) {
          const accessor = accessors[accessorIdx];
          primitiveAttributeMap[attr] = accessor;
          if (accessor.structureType > 3) {
            throw Error(
              'Vertex attribute accessor accessed an unsupported data type for vertex attribute'
            );
          }
          attributes.push(attr);
        }
      }
      meshPrimitives.push(
        new GLTFPrimitive(topology, primitiveAttributeMap, attributes)
      );
    }
    meshes.push(new GLTFMesh(mesh.name ?? "unnamed_mesh", meshPrimitives));
  }

  const skins: GLTFSkin[] = [];
  for (const skin of jsonChunk.skins ?? []) {
    if (skin.inverseBindMatrices !== undefined && accessors[skin.inverseBindMatrices] !== undefined) {
      const inverseBindMatrixAccessor = accessors[skin.inverseBindMatrices];
      inverseBindMatrixAccessor.view.addUsage(
        GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      );
      inverseBindMatrixAccessor.view.needsUpload = true;
    }
  }

  // Upload the buffer views used by mesh
  for (let i = 0; i < bufferViews.length; ++i) {
    if (bufferViews[i].needsUpload) {
      bufferViews[i].upload(device);
    }
  }

  GLTFSkin.createSharedBindGroupLayout(device);
  for (const skin of jsonChunk.skins ?? []) {
    if (skin.inverseBindMatrices !== undefined && accessors[skin.inverseBindMatrices] !== undefined) {
      const inverseBindMatrixAccessor = accessors[skin.inverseBindMatrices];
      const joints = skin.joints;
      skins.push(new GLTFSkin(device, inverseBindMatrixAccessor, joints));
    }
  }

  const nodes: GLTFNode[] = [];

  // Access each node. If node references a mesh, add mesh to that node
  const nodeUniformsBindGroupLayout = device.createBindGroupLayout({
    label: 'NodeUniforms.bindGroupLayout',
    entries: [
      {
        binding: 0,
        buffer: {
          type: 'uniform',
        },
        visibility: GPUShaderStage.VERTEX,
      },
    ],
  });
  for (const currNode of jsonChunk.nodes ?? []) {
    const pos = currNode.translation ? new Vec3(...currNode.translation) : new Vec3(0,0,0);
    const scl = currNode.scale ? new Vec3(...currNode.scale) : new Vec3(1,1,1);
    const rot = currNode.rotation ?? [0,0,0,1];
    const nodeTransform = new BaseTransformation(pos, rot, scl);

    const nodeToCreate = new GLTFNode(
      device,
      nodeUniformsBindGroupLayout,
      nodeTransform,
      currNode.name,
      currNode.skin !== undefined && skins[currNode.skin] !== undefined ? skins[currNode.skin] : undefined
    );
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

  const animations = jsonChunk.animations ?? [];

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
    animations
  };
};
