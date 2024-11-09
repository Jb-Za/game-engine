import { Geometry } from "./Geometry";

export class GeometryBuilder 
{
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

}