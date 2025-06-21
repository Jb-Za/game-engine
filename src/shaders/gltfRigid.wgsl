// Vertex attributes: position, normal, texcoord

struct VertexOutput {
    @builtin(position) Position: vec4f,
    @location(0) normal: vec3f,
    @location(1) texcoord: vec2f,
}

// Camera uniform: single mat4x4f (projectionView)
@group(0) @binding(0) var<uniform> projectionView: mat4x4f;

struct GeneralUniforms {
    render_mode: u32,
}

struct NodeUniforms {
    world_matrix: mat4x4f,
}

@group(1) @binding(0) var<uniform> general_uniforms: GeneralUniforms;
@group(2) @binding(0) var<uniform> node_uniforms: NodeUniforms;
//@group(3) @binding(0) var diffuseTexture: texture_2d<f32>;
//@group(3) @binding(1) var diffuseSampler: sampler;

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    let local_position = vec4f(input.position, 1.0);
    let world_position = node_uniforms.world_matrix * local_position;
    output.Position = projectionView * world_position;
    output.normal = input.normal;
    output.texcoord = input.texcoord;
    return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
    // Simple normal visualization or use texcoord for debug
    switch general_uniforms.render_mode {
        //case 2: {
            //return textureSample(diffuseTexture, diffuseSampler, input.texcoord);
        //}
        case 1: {
            return vec4f(input.texcoord, 0.0, 1.0);
        }
        default: {
            return vec4f(input.normal, 1.0);
        }
    }
    
}