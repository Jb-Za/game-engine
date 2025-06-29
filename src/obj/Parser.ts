import { Geometry } from "../geometry/Geometry";
import { Color } from "../math/Color";

type ObjFile = string;
type FilePath = string;

export interface Material {
  name: string;
  ambient: Color;
  diffuse: Color;
  specular: Color;
  shininess: number;
}

export default class ObjLoader {
  constructor() {}

  static async load(filePath: FilePath): Promise<ObjFile> {
    const resp = await fetch(filePath);
    if (!resp.ok) {
      throw new Error(
        `ObjLoader could not find file at ${filePath}. Please check your path.`
      );
    }
    const file = await resp.text();

    if (file.length === 0) {
      throw new Error(`${filePath} File is empty.`);
    }

    return file;
  }

  static async loadMtl(filePath: FilePath): Promise<string> {
    const resp = await fetch(filePath);
    if (!resp.ok) {
      throw new Error(`ObjLoader could not find MTL file at ${filePath}. Please check your path.`);
    }
    const file = await resp.text();

    if (file.length === 0) {
      throw new Error(`${filePath} MTL file is empty.`);
    }

    return file;
  }

  static async parse(objContent: string, mtlContent: string): Promise<Geometry> {
    const positions: number[] = [];
    const normals: number[] = [];
    const texCoords: number[] = [];
    const indices: number[] = [];
    const materials = this.parseMtl(mtlContent);

    const positionMap: number[] = [];
    const normalMap: number[] = [];
    const texCoordMap: number[] = [];
    const colorMap: number[] = [];
    const vertexMap: Map<string, number> = new Map();
    let vertexCount = 0;

    const lines = objContent.split("\n");
    let currentMaterial: Material | null = null;

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const prefix = parts[0];

      if (prefix === "v") {
        positions.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
      } else if (prefix === "vn") {
        normals.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
      } else if (prefix === "vt") {
        texCoords.push(parseFloat(parts[1]), parseFloat(parts[2]));
      } else if (prefix === "f") {
        const faceVertices = parts.slice(1);
        const faceIndices: number[] = [];

        for (const vertex of faceVertices) {
          if (!vertexMap.has(vertex)) {
            const [v, vt, vn] = vertex.split("/").map((s) => parseInt(s, 10) - 1);

            positionMap.push(...positions.slice(v * 3, v * 3 + 3));
            if (vt !== undefined) texCoordMap.push(...texCoords.slice(vt * 2, vt * 2 + 2));
            if (vn !== undefined) normalMap.push(...normals.slice(vn * 3, vn * 3 + 3));

            if (currentMaterial) {
              colorMap.push(currentMaterial.diffuse.r, currentMaterial.diffuse.g, currentMaterial.diffuse.b, currentMaterial.diffuse.a);
            }

            vertexMap.set(vertex, vertexCount++);
          }
          faceIndices.push(vertexMap.get(vertex)!);
        }

        for (let i = 1; i < faceIndices.length - 1; i++) {
          indices.push(faceIndices[0], faceIndices[i], faceIndices[i + 1]);
        }
      } else if (prefix === "usemtl") {
        currentMaterial = materials.get(parts[1]) || null;
      }
    }

    return new Geometry(
      new Float32Array(positionMap),
      new Uint16Array(indices),
      new Float32Array(colorMap),
      new Float32Array(texCoordMap),
      new Float32Array(normalMap),
      currentMaterial
    );
  }

  static parseMtl(mtlContent: string): Map<string, Material> {
    const materials = new Map<string, Material>();
    const lines = mtlContent.split("\n");
    let currentMaterial: Material | null = null;

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const prefix = parts[0];

      if (prefix === "newmtl") {
        currentMaterial = {
          name: parts[1],
          ambient: new Color(0, 0, 0, 1),
          diffuse: new Color(0, 0, 0, 1),
          specular: new Color(0, 0, 0, 1),
          shininess: 0,
        };
        materials.set(currentMaterial.name, currentMaterial);
      } else if (currentMaterial) {
        if (prefix === "Ka") {
          currentMaterial.ambient = new Color(
            parseFloat(parts[1]),
            parseFloat(parts[2]),
            parseFloat(parts[3]),
            1
          );
        } else if (prefix === "Kd") {
          currentMaterial.diffuse = new Color(
            parseFloat(parts[1]),
            parseFloat(parts[2]),
            parseFloat(parts[3]),
            1
          );
        } else if (prefix === "Ks") {
          currentMaterial.specular = new Color(
            parseFloat(parts[1]),
            parseFloat(parts[2]),
            parseFloat(parts[3]),
            1
          );
        } else if (prefix === "Ns") {
          currentMaterial.shininess = parseFloat(parts[1]);
        }
      }
    }

    return materials;
  }
}