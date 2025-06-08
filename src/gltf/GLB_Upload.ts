import { Camera } from "../camera/Camera";
import { AmbientLight } from "../lights/AmbientLight";
import { DirectionalLight } from "../lights/DirectionalLight";
import { ShadowCamera } from "../camera/ShadowCamera";
import { PointLightsCollection } from "../lights/PointLight";
import { GLTFAccessor } from "./GLTFAccessor";
import { GLTFBuffer } from "./GLTFBuffer";
import { GLTFBufferView } from "./GLTFBufferView";
import { GLTFMesh } from "./GLTFMesh";
import { GLTFPrimitive } from "./GLTFPrimitive";
import { GLTFRenderMode, GLTFUtils } from "./GLTFUtils";
import { Geometry } from "../geometry/Geometry";
import { GLTFBuffers } from "../attribute_buffers/GLTFBuffers";
import { Mat4x4 } from "../math/Mat4x4";
import { Vec3 } from "../math/Vec3";
import { GLTFAnimation } from "./GLTFAnimation";
import { UniformBuffer } from "../uniform_buffers/UniformBuffer";

export function uploadGLB(buffer: ArrayBuffer, device: GPUDevice, camera: Camera, shadowCamera: ShadowCamera, ambientLight: AmbientLight, directionalLight: DirectionalLight, pointLights: PointLightsCollection) {
  let header = new Uint32Array(buffer, 0, 5);
  if (header[0] != 0x46546c67) {
    throw Error("Provided file is not a glB file");
  }
  if (header[1] != 2) {
    throw Error("Provided file is glTF 2.0 file");
  }
  if (header[4] != 0x4e4f534a) {
    throw Error("Invalid glB: The first chunk of the glB file is not a JSON chunk!");
  }

  let jsonChunk = JSON.parse(new TextDecoder("utf-8").decode(new Uint8Array(buffer, 20, header[3])));

  let binaryHeader: Uint32Array = new Uint32Array(buffer, 20 + header[3], 2);
  if (binaryHeader[1] != 0x004e4942) {
    throw Error("Invalid glB: The second chunk of the glB file is not a binary chunk!");
  }

  let binaryChunk = new GLTFBuffer(buffer, 28 + header[3], binaryHeader[0]);

  let bufferViews = [];
  for (let i = 0; i < jsonChunk.bufferViews.length; ++i) {
    bufferViews.push(new GLTFBufferView(binaryChunk, jsonChunk.bufferViews[i]));
  }

  for (let i = 0; i < bufferViews.length; ++i) {
    if (bufferViews[i].needsUpload) {
      bufferViews[i].upload(device);
    }
  }

  let accessors = [];
  for (let i = 0; i < jsonChunk.accessors.length; ++i) {
    let accessorInfo = jsonChunk.accessors[i];
    let viewID = accessorInfo["bufferView"];
    accessors.push(new GLTFAccessor(bufferViews[viewID], accessorInfo));
  }

  let materials: GLTFMaterial[] = [];
  if (jsonChunk["materials"] !== undefined) {
    materials = jsonChunk["materials"];
  }

  let animations: GLTFAnimation[] = [];
  if (jsonChunk["animations"] !== undefined) {
    // Parse each animation into a GLTFAnimation object
    for (const anim of jsonChunk["animations"]) {
      const samplers = anim.samplers.map((s: any) => ({
        input: s.input,
        interpolation: s.interpolation,
        output: s.output,
      }));
      const channels = anim.channels.map((c: any) => ({
        sampler: c.sampler,
        target: {
          node: c.target.node,
          path: c.target.path,
        },
      }));
      animations.push({
        name: anim.name,
        samplers,
        channels,
      });
    }
  }

  const scenes = [];
  for (let sceneIndex = 0; sceneIndex < jsonChunk.scenes.length; sceneIndex++) {
    const scene = jsonChunk.scenes[sceneIndex];
    const nodes = scene.nodes;
    const sceneMeshes: GLTFMesh[] = [];

    const flattenedNodes: any[] = [];
    // Flatten the node tree for mesh transforms, but do NOT use for skin/joint hierarchy
    for (let index = 0; index < nodes.length; index++) {
      const flattenedTree = GLTFUtils.flattenTree(jsonChunk.nodes, jsonChunk.nodes[nodes[index]]);
      flattenedNodes.push(...flattenedTree);
    }
    // Create meshes and store transformations
    for (const node of flattenedNodes) {
      if (node.mesh !== undefined) {
        const mesh = jsonChunk.meshes[node.mesh];
        const meshPrimitives = [];
        const _positions = [];
        const _indices = [];
        const _materials = [];
        const _normals = [];
        const _jointIndices = [];
        const _jointWeights = [];
        let baseColor = [1.0, 1.0, 1.0, 1.0];

        for (let i = 0; i < mesh.primitives.length; ++i) {
          let prim = mesh.primitives[i];
          let topology = prim["mode"];
          if (topology === undefined) {
            topology = GLTFRenderMode.TRIANGLES;
          }
          if (topology != GLTFRenderMode.TRIANGLES && topology != GLTFRenderMode.TRIANGLE_STRIP) {
            throw Error(`Unsupported primitive mode ${prim["mode"]}`);
          }

          let indices = null;
          if (jsonChunk["accessors"][prim["indices"]] !== undefined) {
            indices = accessors[prim["indices"]];
          }

          let positions = null;
          let normals = null;
          let jointIndices = null;
          let jointWeights = null;
          for (let attr in prim["attributes"]) {
            let accessor = accessors[prim["attributes"][attr]];
            if (attr == "POSITION") {
              positions = accessor;
            }
            if (attr == "NORMAL") {
              normals = accessor;
            }
            if (attr == "JOINTS_0") {
              jointIndices = accessor;
            }
            if (attr == "WEIGHTS_0") {
              jointWeights = accessor;
            }
          }

          let materialIndex = prim["material"];
          let material: GLTFMaterial = materials[materialIndex];
          baseColor = material.pbrMetallicRoughness.baseColorFactor ?? baseColor;

          meshPrimitives.push(new GLTFPrimitive(device, positions, indices, topology, material));
          _positions.push(positions);
          _indices.push(indices);
          _materials.push(material);
          _normals.push(normals);
          _jointIndices.push(jointIndices);
          _jointWeights.push(jointWeights);
        }

        for (var i = 0; i < bufferViews.length; ++i) {
          if (bufferViews[i].needsUpload) {
            bufferViews[i].upload(device);
          }
        }

        const numVertices = (_positions[0] as GLTFAccessor).view.length / 3;
        const _colors = new Float32Array(numVertices * 4);
        for (let i = 0; i < numVertices; i++) {
          _colors.set(baseColor, i * 4);
        }

        if (node.skin !== undefined) {
          const skin = jsonChunk.skins[node.skin];
          // Use the original nodes array for joints to preserve hierarchy
          // const joints = skin.joints.map((jointIndex: number) => jsonChunk.nodes[jointIndex]);
          const inverseBindMatricesAccessor = accessors[skin.inverseBindMatrices];
          // const inverseBindMatrices = inverseBindMatricesAccessor.getArray();

          function toFloat32Array(arr: any) {
            if (!arr) return new Float32Array();
            if (arr instanceof Float32Array) return arr;
            return new Float32Array(arr);
          }
          function toUint16Array(arr: any) {
            if (!arr) return new Uint16Array();
            if (arr instanceof Uint16Array) return arr;
            return new Uint16Array(arr);
          }

          const geometry = new Geometry(
            toFloat32Array(_positions[0] && _positions[0].getArray()),
            toUint16Array(_indices[0] && _indices[0].getArray()),
            _colors || new Float32Array(),
            undefined,
            toFloat32Array(_normals[0] && _normals[0].getArray()),
            null, // Pass null for material
            toFloat32Array(_jointIndices[0] && _jointIndices[0].getArray()),
            toFloat32Array(_jointWeights[0] && _jointWeights[0].getArray())
          );
          const geometryBuffers = new GLTFBuffers(device, geometry);
          const gltfMesh = new GLTFMesh(mesh["name"], meshPrimitives, device, camera, shadowCamera, ambientLight, directionalLight, pointLights, geometryBuffers);
          sceneMeshes.push(gltfMesh);
        }
      }
    }

    scenes.push({ name: scene.name, meshes: sceneMeshes, nodes: flattenedNodes, animations, accessors, skins: jsonChunk.skins });
  }

  return { scenes, accessors };
}

export interface GLTFScene {
  name: string;
  meshes: GLTFMesh[];
  nodes: any[];
  animations: GLTFAnimation[];
  accessors: GLTFAccessor[];
}

export interface GLTFMaterial {
  name: string;
  doubleSided: boolean;
  pbrMetallicRoughness: {
    baseColorFactor: number[];
    metallicFactor: number;
    roughnessFactor: number;
  };
  extensions?: {
    KHR_materials_specular?: {
      specularColorFactor: number[];
    };
  };
}
