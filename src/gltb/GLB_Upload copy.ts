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

export function uploadGLB(
  buffer: ArrayBuffer,
  device: GPUDevice,
  camera: Camera,
  shadowCamera: ShadowCamera,
  ambientLight: AmbientLight,
  directionalLight: DirectionalLight,
  pointLights: PointLightsCollection
) {
  // glB has a JSON chunk and a binary chunk, potentially followed by
  // other chunks specifying extension specific data, which we ignore
  // since we don't support any extensions.
  // Read the glB header and the JSON chunk header together
  // glB header:
  // - magic: u32 (expect: 0x46546C67)
  // - version: u32 (expect: 2)
  // - length: u32 (size of the entire file, in bytes)
  // JSON chunk header
  // - chunkLength: u32 (size of the chunk, in bytes)
  // - chunkType: u32 (expect: 0x4E4F534A for the JSON chunk)
  let header = new Uint32Array(buffer, 0, 5);
  // Validate glb file contains correct magic value
  if (header[0] != 0x46546c67) {
    throw Error("Provided file is not a glB file");
  }
  if (header[1] != 2) {
    throw Error("Provided file is glTF 2.0 file");
  }
  // Validate that first chunk is JSON
  if (header[4] != 0x4e4f534a) {
    throw Error(
      "Invalid glB: The first chunk of the glB file is not a JSON chunk!"
    );
  }

  // Decode the JSON chunk of the glB file to a JSON object
  let jsonChunk = JSON.parse(
    new TextDecoder("utf-8").decode(new Uint8Array(buffer, 20, header[3]))
  );

  // Read the binary chunk header
  // - chunkLength: u32 (size of the chunk, in bytes)
  // - chunkType: u32 (expect: 0x46546C67 for the binary chunk)
  let binaryHeader: Uint32Array = new Uint32Array(buffer, 20 + header[3], 2);
  if (binaryHeader[1] != 0x004e4942) {
    throw Error(
      "Invalid glB: The second chunk of the glB file is not a binary chunk!"
    );
  }

  // Make a GLTFBuffer that is a view of the entire binary chunk's data,
  // we'll use this to create buffer views within the chunk for memory referenced
  // by objects in the glTF scene
  let binaryChunk = new GLTFBuffer(buffer, 28 + header[3], binaryHeader[0]);

  // Create GLTFBufferView objects for all the buffer views in the glTF file
  let bufferViews = [];
  for (let i = 0; i < jsonChunk.bufferViews.length; ++i) {
    bufferViews.push(new GLTFBufferView(binaryChunk, jsonChunk.bufferViews[i]));
  }

  // at the end of uploadGLB before returning the mesh
  // Upload the buffer views used by mesh
  for (let i = 0; i < bufferViews.length; ++i) {
    if (bufferViews[i].needsUpload) {
      bufferViews[i].upload(device);
    }
  }

  // Create GLTFAccessor objects for the accessors in the glTF file
  // We need to handle possible errors being thrown here if a model is using
  // accessors for types we don't support yet. For example, a model with animation
  // may have a MAT4 accessor, which we currently don't support.
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

  const meshes = [];
  for (let index = 0; index < jsonChunk.meshes.length; index++) {
    // Load the first mesh
    let mesh = jsonChunk.meshes[index];
    let meshPrimitives = [];
    let _positions = [];
    let _indices = [];
    let _materials = [];
    let _normals = [];
    let baseColor = [1.0, 1.0, 1.0, 1.0]; // Default to white if not provided
    // Loop through the mesh's primitives and load them
    for (let i = 0; i < mesh.primitives.length; ++i) {
      let prim = mesh.primitives[i];
      let topology = prim["mode"];
      // Default is triangles if mode specified
      if (topology === undefined) {
        topology = GLTFRenderMode.TRIANGLES;
      }
      if (
        topology != GLTFRenderMode.TRIANGLES &&
        topology != GLTFRenderMode.TRIANGLE_STRIP
      ) {
        throw Error(`Unsupported primitive mode ${prim["mode"]}`);
      }

      // Find the vertex indices accessor if provided
      let indices = null;
      if (jsonChunk["accessors"][prim["indices"]] !== undefined) {
        indices = accessors[prim["indices"]];
      }

      // Loop through all the attributes to find the POSITION attribute.
      // While we only want the position attribute right now, we'll load
      // the others later as well.
      let positions = null;
      let normals = null;
      for (let attr in prim["attributes"]) {
        let accessor = accessors[prim["attributes"][attr]];
        if (attr == "POSITION") {
          positions = accessor;
        }
        if(attr == "NORMAL") {
          normals = accessor;
        }
      }
    
      let materialIndex = prim["material"];
      let material: GLTFMaterial = materials[materialIndex];

      baseColor = material.pbrMetallicRoughness.baseColorFactor;
      
  
      // let diffuseColor = material.diffuseColor || [1.0, 1.0, 1.0, 1.0]; // Default to white if not provided
      // let textureCoords = material.textureCoords || [];
      // let normalMap = material.normalMap || [];

      // Add the primitive to the mesh's list of primitives
      meshPrimitives.push(
        new GLTFPrimitive(device, positions, indices, topology, material)
      );
      _positions.push(positions);
      _indices.push(indices);
      _materials.push(material);
      _normals.push(normals);
    }

    // Upload the buffers as mentioned above before returning the mesh
      // Upload the buffer views used by mesh
    for (var i = 0; i < bufferViews.length; ++i) {
      if (bufferViews[i].needsUpload) {
        bufferViews[i].upload(device);
      }
    }

    // Calculate the number of vertices
    //@ts-ignore
    const numVertices = (_positions[0] as GLTFAccessor).view.length / 3;

    // Create a new Float32Array for colors with 4 components per vertex (r, g, b, a)
    const _colors = new Float32Array(numVertices * 4);

    // Fill the array with the base color values
    for (let i = 0; i < numVertices; i++) {
      _colors.set(baseColor, i * 4);
    }
    
    
    //@ts-ignore
    const geometry = new Geometry(_positions[0], _indices[0], _colors, undefined, _normals[0], _materials[0]); // TODO: consider your life choices

    const geometryBuffers = new GLTFBuffers(device, geometry);
    // Create the GLTFMesh
    mesh = new GLTFMesh(
      mesh["name"],
      meshPrimitives,
      device,
      camera,
      shadowCamera,
      ambientLight,
      directionalLight,
      pointLights,
      geometryBuffers
    );
    meshes.push(mesh);
  }

  return meshes;
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