import { Vec3 } from "../math/Vec3";
import { Geometry } from "./Geometry";

interface TerrainParameters {
    seed: number;
    size: number;
    scale: number;
    offset: { x: number, y: number };
    heightMultiplier: number;
    octaves: number;
    persistence: number;
    lacunarity: number;
    position: Vec3;
}

export class GeometryBuilder 
{
    private seededRandom(seed: number): () => number {
        let s = seed;
        return () => {
            s = Math.sin(s) * 10000;
            return s - Math.floor(s);
        };
    }

    private generateNoise(params: TerrainParameters): number[][] {
        const { size, scale, offset, octaves, persistence, lacunarity, seed } = params;
        const random = this.seededRandom(seed);
        
        // Generate random offsets for each octave
        const offsets: { x: number, y: number }[] = [];
        for (let i = 0; i < octaves; i++) {
            const offsetX = (random() - 0.5) * 200000 + offset.x;
            const offsetY = (random() - 0.5) * 200000 + offset.y;
            offsets.push({ x: offsetX, y: offsetY });
        }
        
        const noise: number[][] = Array(size).fill(0).map(() => Array(size).fill(0));
        
        // Generate noise
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                let amplitude = 1;
                let frequency = 1;
                let noiseValue = 0;
                
                for (let i = 0; i < octaves; i++) {
                    // Adding randomly generated offsets is important
                    const sampleX = x / scale * frequency + offsets[i].x;
                    const sampleY = y / scale * frequency + offsets[i].y;
                    const rawNoise = this.perlinNoise(sampleX, sampleY);
                    noiseValue += rawNoise * amplitude;
                    amplitude *= persistence;
                    frequency *= lacunarity;
                }
                noise[x][y] = noiseValue;
            }
        }
        
        // Normalize noise to [0, 1] range
        const flatNoise = noise.flat();
        const max = Math.max(...flatNoise);
        const min = Math.min(...flatNoise);
        
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                noise[x][y] = this.inverseLerp(min, max, noise[x][y]);
            }
        }
        
        return noise;
    }
    
    private inverseLerp(a: number, b: number, value: number): number {
        return (value - a) / (b - a);
    }
    
    private perlinNoise(x: number, y: number): number {
        // Simple Perlin-like noise implementation
        // For production, use a proper Perlin noise library
        const xi = Math.floor(x) & 255;
        const yi = Math.floor(y) & 255;
        const xf = x - Math.floor(x);
        const yf = y - Math.floor(y);
        
        const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
        
        const lerp = (a: number, b: number, t: number) => a + t * (b - a);
        
        const grad = (hash: number, x: number, y: number) => {
            const h = hash & 15;
            const u = h < 8 ? x : y;
            const v = h < 4 ? y : h === 12 || h === 14 ? x : 0;
            return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
        };
        
        const hash = (x: number) => {
            x = ((x >> 16) ^ x) * 0x45d9f3b;
            x = ((x >> 16) ^ x) * 0x45d9f3b;
            x = (x >> 16) ^ x;
            return x & 255;
        };
        
        const aa = hash(xi) + yi;
        const ab = hash(xi) + yi + 1;
        const ba = hash(xi + 1) + yi;
        const bb = hash(xi + 1) + yi + 1;
        
        const u = fade(xf);
        const v = fade(yf);
        
        const x1 = lerp(grad(hash(aa), xf, yf), grad(hash(ba), xf - 1, yf), u);
        const x2 = lerp(grad(hash(ab), xf, yf - 1), grad(hash(bb), xf - 1, yf - 1), u);
        
        return (lerp(x1, x2, v) + 1) / 2; // Normalize to [0, 1]
    }
    
    private generateTerrainHeight(x: number, z: number, noiseMap: number[][], params: TerrainParameters): number {
        const size = params.size;
        const heightMultiplier = params.heightMultiplier;
        
        // Convert world coordinates to noise map coordinates
        const noiseX = Math.floor((x + size / 2) / size * (size - 1));
        const noiseZ = Math.floor((z + size / 2) / size * (size - 1));
        
        // Clamp to valid range
        const clampedX = Math.max(0, Math.min(size - 1, noiseX));
        const clampedZ = Math.max(0, Math.min(size - 1, noiseZ));
        
        return noiseMap[clampedX][clampedZ] * heightMultiplier;
    }

    public createQuadGeometry(): Geometry   
    {
        let vertices = new Float32Array([
            // t1 
            -0.5, -0.5, 0.0, // bottom left
            -0.5, 0.5, 0.0,  // top left
            0.5, -0.5, 0.0,  // bottom right
            0.5, 0.5, 0.0,   // top right
        ]);

        let indices = new Uint16Array([

            0, 1, 2, // t1
            1, 3, 2 // t2 
        ]);

        let colors = new Float32Array([
            1,1,1,1,
            1,1,1,1,
            1,1,1,1,
            1,1,1,1
        ]);

        let texCoords = new Float32Array([
            0,1, // bottom left
            0,0, // top left
            1,1, // bottom right
            1,0  // top right
        ])

        return new Geometry(vertices, indices, colors, texCoords);
    }

    public createCubeGeometry(): Geometry {

        let vertices = new Float32Array([
            // front
            -0.5, -0.5, -0.5, // bottom left
            -0.5, 0.5, -0.5, // top left
            0.5, -0.5, -0.5, // bottom right
            0.5, 0.5, -0.5, // top right
            // back
            -0.5, -0.5, 0.5, // bottom left
            -0.5, 0.5, 0.5, // top left
            0.5, -0.5, 0.5, // bottom right
            0.5, 0.5, 0.5, // top right

            // left
            -0.5, -0.5, -0.5, // bottom left
            -0.5, 0.5, -0.5, // top left
            -0.5, -0.5, 0.5, // bottom right
            -0.5, 0.5, 0.5, // top right

            // right
            0.5, -0.5, -0.5, // bottom left
            0.5, 0.5, -0.5, // top left
            0.5, -0.5, 0.5, // bottom right
            0.5, 0.5, 0.5, // top right

            // top
            -0.5, 0.5, -0.5, // bottom left
            -0.5, 0.5, 0.5, // top left
            0.5, 0.5, -0.5, // bottom right
            0.5, 0.5, 0.5, // top right

            // bottom
            -0.5, -0.5, -0.5, // bottom left
            -0.5, -0.5, 0.5, // top left
            0.5, -0.5, -0.5, // bottom right
            0.5, -0.5, 0.5, // top right
        ]);

        let indices = new Uint16Array([
            // front
            0, 1, 2,
            1, 3, 2,
            // back
            4, 6, 5,
            5, 6, 7,
            // left
            8, 9, 10,
            9, 11, 10,
            // right
            12, 14, 13,
            13, 14, 15,
            // top
            16, 18, 17,
            17, 18, 19,
            // bottom
            20, 21, 22,
            21, 23, 22
        ]);

        let colors = new Float32Array([
            // front
            1, 1, 1, 1,
            1, 1, 1, 1,
            1, 1, 1, 1,
            1, 1, 1, 1,
            // back
            1, 1, 1, 1,
            1, 1, 1, 1,
            1, 1, 1, 1,
            1, 1, 1, 1,
            // left
            1, 1, 1, 1,
            1, 1, 1, 1,
            1, 1, 1, 1,
            1, 1, 1, 1,
            // right
            1, 1, 1, 1,
            1, 1, 1, 1,
            1, 1, 1, 1,
            1, 1, 1, 1,
            // top
            1, 1, 1, 1,
            1, 1, 1, 1,
            1, 1, 1, 1,
            1, 1, 1, 1,
            // bottom
            1, 1, 1, 1,
            1, 1, 1, 1,
            1, 1, 1, 1,
            1, 1, 1, 1
        ]);

        let texCoords = new Float32Array([
            // front
            0, 1,
            0, 0,
            1, 1,
            1, 0,
            // back
            0, 1,
            0, 0,
            1, 1,
            1, 0,
            // left
            0, 1,
            0, 0,
            1, 1,
            1, 0,
            // right
            0, 1,
            0, 0,
            1, 1,
            1, 0,
            // top
            0, 1,
            0, 0,
            1, 1,
            1, 0,
            // bottom
            0, 1,
            0, 0,
            1, 1,
            1, 0
        ]);

        let normals = new Float32Array([
            // front
            0,0,-1,
            0,0,-1,
            0,0,-1,
            0,0,-1,
            // back
            0,0,1,
            0,0,1,
            0,0,1,
            0,0,1,
            // left
            -1,0,0,
            -1,0,0,
            -1,0,0,
            -1,0,0,
            // right
            1,0,0,
            1,0,0,
            1,0,0,
            1,0,0,

            // top
            0,1,0,
            0,1,0,
            0,1,0,
            0,1,0,
            // bottom
            0,-1,0,
            0,-1,0,
            0,-1,0,
            0,-1,0,
        ]);

        return new Geometry(vertices, indices, colors, texCoords, normals);
    }

    public createCircleGeometry(radius: number, segments: number): Geometry {
        const vertices: number[] = [];
        const indices: number[] = [];
        const colors: number[] = [];
        const texCoords: number[] = [];
        const normals: number[] = [];

        vertices.push(0, 0, 0);
        normals.push(0, 0, 1);
        texCoords.push(0.5, 0.5);
        colors.push(1, 1, 1, 1);

        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;

            vertices.push(x, y, 0);
            normals.push(0, 0, 1); // Normal pointing up
            texCoords.push((x / radius + 1) / 2, (y / radius + 1) / 2); // Normalize to [0, 1]
            colors.push(1, 1, 1, 1); // White color

            if (i < segments) {
                indices.push(0, i + 1, i + 2);
            }
        }

        return new Geometry(
            new Float32Array(vertices),
            new Uint16Array(indices),
            new Float32Array(colors),
            new Float32Array(texCoords),
            new Float32Array(normals)
        );
    }

    public createCircleOutlineGeometry(radius: number, segments: number, thickness: number = 0.1, scaleCompensation: number = 1.0): Geometry {
    const vertices: number[] = [];
    const indices: number[] = [];
    const colors: number[] = [];
    const texCoords: number[] = [];
    const normals: number[] = [];

    // Adjust thickness based on scale compensation
    const effectiveThickness = thickness / scaleCompensation;

    // Create two rings: inner and outer
    for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        // Outer ring
        const xOuter = cos * radius;
        const yOuter = sin * radius;
        vertices.push(xOuter, yOuter, 0);
        normals.push(0, 0, 1);
        texCoords.push((xOuter / radius + 1) / 2, (yOuter / radius + 1) / 2);
        colors.push(1, 1, 1, 1);

        // Inner ring - use effective thickness
        const innerRadius = Math.max(0.01, radius - effectiveThickness); // Prevent negative radius
        const xInner = cos * innerRadius;
        const yInner = sin * innerRadius;
        vertices.push(xInner, yInner, 0);
        normals.push(0, 0, 1);
        texCoords.push((xInner / radius + 1) / 2, (yInner / radius + 1) / 2);
        colors.push(1, 1, 1, 1);

        if (i < segments) {
            const idx = i * 2;
            // Quad (two triangles) between inner and outer ring
            indices.push(idx, idx + 1, idx + 2);
            indices.push(idx + 1, idx + 3, idx + 2);
        }
    }

    return new Geometry(
        new Float32Array(vertices),
        new Uint16Array(indices),
        new Float32Array(colors),
        new Float32Array(texCoords),
        new Float32Array(normals)
    );
}

    public createSphereGeometry(radius: number, segments: number): Geometry {
        const vertices: number[] = [];
        const indices: number[] = [];
        const colors: number[] = [];
        const texCoords: number[] = [];
        const normals: number[] = [];
    
        const phiStart = 0;
        const phiLength = Math.PI * 2;
        const thetaStart = 0;
        const thetaLength = Math.PI;
    
        for (let i = 0; i <= segments; i++) {
            const phi = phiStart + i * phiLength / segments;
            for (let j = 0; j <= segments; j++) {
                const theta = thetaStart + j * thetaLength / segments;
    
                const x = -radius * Math.cos(phi) * Math.sin(theta);
                const y = radius * Math.sin(phi) * Math.sin(theta);
                const z = radius * Math.cos(theta);
    
                vertices.push(x, y, z);
    
                const u = (j / segments) * 2;
                const v = (i / segments);
                texCoords.push(u, v);
    
                normals.push(x, y, z);
    
                colors.push(1, 1, 1, 1);
    
                if (i < segments && j < segments) {
                    const index1 = (segments + 1) * i + j;
                    const index2 = (segments + 1) * (i + 1) + j;
                    const index3 = (segments + 1) * (i + 1) + (j + 1);
                    const index4 = (segments + 1) * i + (j + 1);
    
                    indices.push(index1, index2, index3, index1, index3, index4);
                }
            }
        }
    
        return new Geometry(
            new Float32Array(vertices),
            new Uint16Array(indices),
            new Float32Array(colors),
            new Float32Array(texCoords),
            new Float32Array(normals)
        );
    }

    public createCylinderGeometry(radius: number = 0.5, height: number = 1.0, segments: number = 16): Geometry {
        const vertices: number[] = [];
        const indices: number[] = [];
        const colors: number[] = [];
        const texCoords: number[] = [];
        const normals: number[] = [];

        const halfHeight = height / 2;

        // Create vertices for top and bottom circles
        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;

            // Bottom circle
            vertices.push(x, -halfHeight, z);
            normals.push(x / radius, 0, z / radius); // Side normal
            texCoords.push(i / segments, 0);
            colors.push(1, 1, 1, 1);

            // Top circle
            vertices.push(x, halfHeight, z);
            normals.push(x / radius, 0, z / radius); // Side normal
            texCoords.push(i / segments, 1);
            colors.push(1, 1, 1, 1);
        }

        // Create side faces (quads made of triangles)
        for (let i = 0; i < segments; i++) {
            const bottomLeft = i * 2;
            const bottomRight = ((i + 1) % (segments + 1)) * 2;
            const topLeft = bottomLeft + 1;
            const topRight = bottomRight + 1;

            // First triangle
            indices.push(bottomLeft, topLeft, bottomRight);
            // Second triangle
            indices.push(bottomRight, topLeft, topRight);
        }

        // Add center vertices for caps
        const bottomCenterIndex = vertices.length / 3;
        vertices.push(0, -halfHeight, 0);
        normals.push(0, -1, 0);
        texCoords.push(0.5, 0.5);
        colors.push(1, 1, 1, 1);

        const topCenterIndex = bottomCenterIndex + 1;
        vertices.push(0, halfHeight, 0);
        normals.push(0, 1, 0);
        texCoords.push(0.5, 0.5);
        colors.push(1, 1, 1, 1);

        // Create bottom cap triangles
        for (let i = 0; i < segments; i++) {
            const current = i * 2;
            const next = ((i + 1) % (segments + 1)) * 2;
            indices.push(bottomCenterIndex, next, current);
        }

        // Create top cap triangles
        for (let i = 0; i < segments; i++) {
            const current = i * 2 + 1;
            const next = ((i + 1) % (segments + 1)) * 2 + 1;
            indices.push(topCenterIndex, current, next);
        }

        return new Geometry(
            new Float32Array(vertices),
            new Uint16Array(indices),
            new Float32Array(colors),
            new Float32Array(texCoords),
            new Float32Array(normals)
        );
    }

    public createArrowGeometry(shaftRadius: number = 0.05, shaftLength: number = 0.8, headRadius: number = 0.15, headLength: number = 0.2, segments: number = 16): Geometry {
        const vertices: number[] = [];
        const indices: number[] = [];
        const colors: number[] = [];
        const texCoords: number[] = [];
        const normals: number[] = [];

        const totalLength = shaftLength + headLength;
        const shaftEnd = shaftLength - totalLength / 2;
        const headStart = shaftEnd;
        const headEnd = totalLength / 2;

        // Create shaft vertices (cylinder)
        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const x = Math.cos(angle) * shaftRadius;
            const z = Math.sin(angle) * shaftRadius;

            // Shaft bottom
            vertices.push(x, -totalLength / 2, z);
            normals.push(x / shaftRadius, 0, z / shaftRadius);
            texCoords.push(i / segments, 0);
            colors.push(1, 1, 1, 1);

            // Shaft top (where head begins)
            vertices.push(x, shaftEnd, z);
            normals.push(x / shaftRadius, 0, z / shaftRadius);
            texCoords.push(i / segments, 0.8);
            colors.push(1, 1, 1, 1);
        }

        // Create shaft side faces
        for (let i = 0; i < segments; i++) {
            const bottomLeft = i * 2;
            const bottomRight = ((i + 1) % (segments + 1)) * 2;
            const topLeft = bottomLeft + 1;
            const topRight = bottomRight + 1;

            // First triangle
            indices.push(bottomLeft, topLeft, bottomRight);
            // Second triangle
            indices.push(bottomRight, topLeft, topRight);
        }

        // Create arrowhead vertices (cone)
        const headBaseStart = vertices.length / 3;
        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const x = Math.cos(angle) * headRadius;
            const z = Math.sin(angle) * headRadius;

            // Head base (larger circle)
            vertices.push(x, headStart, z);
            // Calculate cone normal (pointing outward from cone surface)
            const sideLength = Math.sqrt(headRadius * headRadius + headLength * headLength);
            const normalY = headRadius / sideLength;
            const normalXZ = headLength / sideLength;
            normals.push((x / headRadius) * normalXZ, normalY, (z / headRadius) * normalXZ);
            texCoords.push(i / segments, 0.8);
            colors.push(1, 1, 1, 1);
        }

        // Arrow tip (point)
        const tipIndex = vertices.length / 3;
        vertices.push(0, headEnd, 0);
        normals.push(0, 1, 0);
        texCoords.push(0.5, 1);
        colors.push(1, 1, 1, 1);

        // Create arrowhead side faces (triangles from base to tip)
        for (let i = 0; i < segments; i++) {
            const current = headBaseStart + i;
            const next = headBaseStart + ((i + 1) % (segments + 1));
            
            // Triangle from base edge to tip
            indices.push(current, tipIndex, next);
        }

        // Add shaft bottom cap center
        const shaftBottomCenter = vertices.length / 3;
        vertices.push(0, -totalLength / 2, 0);
        normals.push(0, -1, 0);
        texCoords.push(0.5, 0);
        colors.push(1, 1, 1, 1);

        // Create shaft bottom cap
        for (let i = 0; i < segments; i++) {
            const current = i * 2;
            const next = ((i + 1) % (segments + 1)) * 2;
            indices.push(shaftBottomCenter, next, current);
        }

        // Add arrowhead base cap center
        const headBaseCenter = vertices.length / 3;
        vertices.push(0, headStart, 0);
        normals.push(0, -1, 0);
        texCoords.push(0.5, 0.8);
        colors.push(1, 1, 1, 1);

        // Create arrowhead base cap
        for (let i = 0; i < segments; i++) {
            const current = headBaseStart + i;
            const next = headBaseStart + ((i + 1) % (segments + 1));
            indices.push(headBaseCenter, current, next);
        }

        return new Geometry(
            new Float32Array(vertices),
            new Uint16Array(indices),
            new Float32Array(colors),
            new Float32Array(texCoords),
            new Float32Array(normals)
        );
    }

    public createGridPlane(resolution: number = 32, size: number = 1): Geometry {
        const vertices: number[] = [];
        const indices: number[] = [];
        const colors: number[] = [];
        const texCoords: number[] = [];
        const normals: number[] = [];

        // Generate vertices for a flat grid
        for (let z = 0; z <= resolution; z++) {
            for (let x = 0; x <= resolution; x++) {
                // Position (normalized to -size/2 to size/2)
                const xPos = (x / resolution - 0.5) * size;
                const zPos = (z / resolution - 0.5) * size;
                const yPos = 0; // Flat plane at y = 0
                
                vertices.push(xPos, yPos, zPos);

                // Color (white)
                colors.push(1, 1, 1, 1);

                // Texture coordinates
                texCoords.push(x / resolution, z / resolution);

                // Normal (pointing up)
                normals.push(0, 1, 0);
            }
        }

        // Generate indices for triangles
        for (let z = 0; z < resolution; z++) {
            for (let x = 0; x < resolution; x++) {
                const topLeft = z * (resolution + 1) + x;
                const topRight = topLeft + 1;
                const bottomLeft = (z + 1) * (resolution + 1) + x;
                const bottomRight = bottomLeft + 1;

                // First triangle (top-left, bottom-left, top-right)
                indices.push(topLeft, bottomLeft, topRight);
                
                // Second triangle (top-right, bottom-left, bottom-right)
                indices.push(topRight, bottomLeft, bottomRight);
            }
        }

        return new Geometry(
            new Float32Array(vertices),
            new Uint16Array(indices),
            new Float32Array(colors),
            new Float32Array(texCoords),
            new Float32Array(normals)
        );
    }

    public createTerrainGeometry(resolution: number = 512, size: number = 1, terrainParams?: Partial<TerrainParameters>): Geometry {
        const vertices: number[] = [];
        const indices: number[] = [];
        const colors: number[] = [];
        const texCoords: number[] = [];
        const normals: number[] = [];

        // Default terrain parameters (can be overridden)
        const defaultParams: TerrainParameters = {
            seed: 128,
            size: resolution,
            scale: 50.0,
            offset: { x: 0, y: 0 },
            heightMultiplier: 30.0,
            octaves: 16,
            persistence: 0.5,
            lacunarity: 1.6,
            position: terrainParams?.position || new Vec3(0, 0, 0)
        };

        const finalParams = { ...defaultParams, ...terrainParams };

        // Generate noise map
        const noiseMap = this.generateNoise(finalParams);

        // Generate vertices
        for (let z = 0; z <= resolution; z++) {
            for (let x = 0; x <= resolution; x++) {
                const position = terrainParams?.position || new Vec3(0, 0, 0);
                // Position (normalized to -size/2 to size/2)
                const xPos = position.x + (x / resolution - 0.5) * size;
                const zPos = position.z + (z / resolution - 0.5) * size;

                // Generate height using noise map
                const yPos = this.generateTerrainHeight(xPos, zPos, noiseMap, finalParams);
                vertices.push(xPos, yPos, zPos);

                // Color (white)
                colors.push(1, 1, 1, 1);

                // Texture coordinates
                texCoords.push(x / resolution, z / resolution);

                // Normal (pointing up - could be improved with proper terrain normals)
                normals.push(0, 1, 0);
            }
        }

        // Generate indices for triangles
        for (let z = 0; z < resolution; z++) {
            for (let x = 0; x < resolution; x++) {
                const topLeft = z * (resolution + 1) + x;
                const topRight = topLeft + 1;
                const bottomLeft = (z + 1) * (resolution + 1) + x;
                const bottomRight = bottomLeft + 1;

                // First triangle (top-left, bottom-left, top-right)
                indices.push(topLeft, bottomLeft, topRight);
                
                // Second triangle (top-right, bottom-left, bottom-right)
                indices.push(topRight, bottomLeft, bottomRight);
            }
        }

        return new Geometry(
            new Float32Array(vertices),
            new Uint16Array(indices),
            new Float32Array(colors),
            new Float32Array(texCoords),
            new Float32Array(normals)
        );
    }

}