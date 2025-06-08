import { Mat4x4 } from "../math/Mat4x4";
import { Vec3 } from "../math/Vec3";
import { GLTFMesh } from "./GLTFMesh";

export class GLTFUtils {
  public static parseGltfType(type: string) {
    switch (type) {
      case "SCALAR":
        return GLTFType.SCALAR;
      case "VEC2":
        return GLTFType.VEC2;
      case "VEC3":
        return GLTFType.VEC3;
      case "VEC4":
        return GLTFType.VEC4;
      case "MAT2":
        return GLTFType.MAT2;
      case "MAT3":
        return GLTFType.MAT3;
      case "MAT4":
        return GLTFType.MAT4;
      default:
        throw Error(`Unhandled glTF Type ${type}`);
    }
  }

  public static gltfTypeNumComponents(type: GLTFType) {
    switch (type) {
      case GLTFType.SCALAR:
        return 1;
      case GLTFType.VEC2:
        return 2;
      case GLTFType.VEC3:
        return 3;
      case GLTFType.VEC4:
      case GLTFType.MAT2:
        return 4;
      case GLTFType.MAT3:
        return 9;
      case GLTFType.MAT4:
        return 16;
      default:
        throw Error(`Invalid glTF Type ${type}`);
    }
  }

  // Note: only returns non-normalized type names,
  // so byte/ubyte = sint8/uint8, not snorm8/unorm8, same for ushort
  public static gltfVertexType(
    componentType: GLTFComponentType,
    type: GLTFType
  ) {
    let typeStr = null;
    switch (componentType) {
      case GLTFComponentType.BYTE:
        typeStr = "sint8";
        break;
      case GLTFComponentType.UNSIGNED_BYTE:
        typeStr = "uint8";
        break;
      case GLTFComponentType.SHORT:
        typeStr = "sint16";
        break;
      case GLTFComponentType.UNSIGNED_SHORT:
        typeStr = "uint16";
        break;
      case GLTFComponentType.INT:
        typeStr = "int32";
        break;
      case GLTFComponentType.UNSIGNED_INT:
        typeStr = "uint32";
        break;
      case GLTFComponentType.FLOAT:
        typeStr = "float32";
        break;
      default:
        throw Error(`Unrecognized or unsupported glTF type ${componentType}`);
    }

    switch (this.gltfTypeNumComponents(type)) {
      case 1:
        return typeStr;
      case 2:
        return typeStr + "x2";
      case 3:
        return typeStr + "x3";
      case 4:
        return typeStr + "x4";
      default:
        throw Error(`Invalid number of components for gltfType: ${type}`);
    }
  }

  public static gltfTypeSize(componentType: GLTFComponentType, type: GLTFType) {
    let componentSize = 0;
    switch (componentType) {
      case GLTFComponentType.BYTE:
        componentSize = 1;
        break;
      case GLTFComponentType.UNSIGNED_BYTE:
        componentSize = 1;
        break;
      case GLTFComponentType.SHORT:
        componentSize = 2;
        break;
      case GLTFComponentType.UNSIGNED_SHORT:
        componentSize = 2;
        break;
      case GLTFComponentType.INT:
        componentSize = 4;
        break;
      case GLTFComponentType.UNSIGNED_INT:
        componentSize = 4;
        break;
      case GLTFComponentType.FLOAT:
        componentSize = 4;
        break;
      case GLTFComponentType.DOUBLE:
        componentSize = 8;
        break;
      default:
        throw Error("Unrecognized GLTF Component Type?");
    }
    return GLTFUtils.gltfTypeNumComponents(type) * componentSize;
  }

  // The root node is included in the flattened tree
  public static flattenTree(allNodes: any, node: any, parent_transform?: any): any[] { //TODO: type this
    let flattened = [];
    let tfm = this.readNodeTransform(node);
    if (parent_transform != undefined) {
        tfm = Mat4x4.multiply(parent_transform, tfm);
    }

    // Add the flattened current node
    let n = {
        matrix: tfm,
        mesh: node["mesh"],
        camera: node["camera"],
        skin: node["skin"],
    };
    flattened.push(n);

    // Loop through the node's children and recursively flatten them as well
    if (node["children"]) {
        for (let i = 0; i < node["children"].length; ++i) {
            let childNode = allNodes[node["children"][i]];
            flattened.push(
                ...this.flattenTree(allNodes, childNode, tfm)
            );
        }
    }
    return flattened;
  }

  public static readNodeTransform(node: any) {
    if (node["matrix"]) {
        let m = node["matrix"];
        // Both glTF and gl matrix are column major
        return Mat4x4.fromValues(m[0],
            m[1],
            m[2],
            m[3],
            m[4],
            m[5],
            m[6],
            m[7],
            m[8],
            m[9],
            m[10],
            m[11],
            m[12],
            m[13],
            m[14],
            m[15]);
    } else {
        let scale = [1, 1, 1];
        let rotation = [0, 0, 0, 1];
        let translation = [0, 0, 0];
        if (node["scale"]) {
            scale = node["scale"];
        }
        if (node["rotation"]) {
            rotation = node["rotation"];
        }
        if (node["translation"]) {
            translation = node["translation"];
        }
        let _m: Mat4x4 = new Mat4x4();
        return Mat4x4.fromRotationTranslationScale(_m, rotation, translation, scale);
    }
}

  public static gltfTextureFilterMode(filter: GLTFTextureFilter) {
    switch (filter) {
      case GLTFTextureFilter.NEAREST_MIPMAP_NEAREST:
      case GLTFTextureFilter.NEAREST_MIPMAP_LINEAR:
      case GLTFTextureFilter.NEAREST:
        return "nearest" as GPUFilterMode;
      case GLTFTextureFilter.LINEAR_MIPMAP_NEAREST:
      case GLTFTextureFilter.LINEAR_MIPMAP_LINEAR:
      case GLTFTextureFilter.LINEAR:
        return "linear" as GPUFilterMode;
    }
  }

  public static gltfTextureMipMapMode(filter: GLTFTextureFilter) {
    switch (filter) {
      case GLTFTextureFilter.NEAREST_MIPMAP_NEAREST:
      case GLTFTextureFilter.LINEAR_MIPMAP_NEAREST:
      case GLTFTextureFilter.NEAREST:
        return "nearest" as GPUMipmapFilterMode;
      case GLTFTextureFilter.LINEAR_MIPMAP_LINEAR:
      case GLTFTextureFilter.NEAREST_MIPMAP_LINEAR:
      case GLTFTextureFilter.LINEAR:
        return "linear" as GPUMipmapFilterMode;
    }
  }

  public static gltfAddressMode(mode: GLTFTextureWrap) {
    switch (mode) {
      case GLTFTextureWrap.REPEAT:
        return "repeat" as GPUAddressMode;
      case GLTFTextureWrap.CLAMP_TO_EDGE:
        return "clamp-to-edge" as GPUAddressMode;
      case GLTFTextureWrap.MIRRORED_REPEAT:
        return "mirror-repeat" as GPUAddressMode;
    }
  }
}


export enum GLTFType {
  SCALAR = 0,
  VEC2 = 1,
  VEC3 = 2,
  VEC4 = 3,
  MAT2 = 4,
  MAT3 = 5,
  MAT4 = 6,
}

export enum GLTFComponentType {
  BYTE = 5120,
  UNSIGNED_BYTE = 5121,
  SHORT = 5122,
  UNSIGNED_SHORT = 5123,
  INT = 5124,
  UNSIGNED_INT = 5125,
  FLOAT = 5126,
  DOUBLE = 5130,
}

export enum GLTFRenderMode {
  POINTS = 0,
  LINE = 1,
  LINE_LOOP = 2,
  LINE_STRIP = 3,
  TRIANGLES = 4,
  TRIANGLE_STRIP = 5,
  TRIANGLE_FAN = 6, // Note: fans are not supported in WebGPU, use should be an error or converted into a list/strip
}

export enum GLTFTextureFilter {
  NEAREST = 9728,
  LINEAR = 9729,
  NEAREST_MIPMAP_NEAREST = 9984,
  LINEAR_MIPMAP_NEAREST = 9985,
  NEAREST_MIPMAP_LINEAR = 9986,
  LINEAR_MIPMAP_LINEAR = 9987,
}

export enum GLTFTextureWrap {
  REPEAT = 10497,
  CLAMP_TO_EDGE = 33071,
  MIRRORED_REPEAT = 33648,
}
