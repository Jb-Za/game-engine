import { Material } from "../obj/Parser";

export class Geometry 
{
    constructor(
        public positions: Float32Array,
        public indices: Uint16Array = new Uint16Array(),
        public colors: Float32Array = new Float32Array(),
        public texCoords: Float32Array = new Float32Array(),
        public normals: Float32Array = new Float32Array(),
        public material: Material | null = null,
        public joints: Float32Array = new Float32Array(),
        public weights: Float32Array = new Float32Array(),
    )
    {}
}