// Vertex attributes: position, normal, texcoord

struct VertexOutput {
    @builtin(position) Position: vec4f,
    @location(0) normal: vec3f,
    @location(1) texcoord: vec2f,
}

struct GeneralUniforms {
    render_mode: u32,
}

struct NodeUniforms { 
    world_matrix: mat4x4f,
}

@group(0) @binding(0) var<uniform> projectionView: mat4x4f;
@group(1) @binding(0) var<uniform> general_uniforms: GeneralUniforms;
@group(2) @binding(0) var<uniform> node_uniforms: NodeUniforms;
@group(3) @binding(0) var baseColorTexture: texture_2d<f32>;
@group(3) @binding(1) var baseColorSampler: sampler;

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
    // Handle different render modes
    switch general_uniforms.render_mode {
        case 2: {
            // Texture mode - sample the texture with provided UV coordinates
            return textureSample(baseColorTexture, baseColorSampler, input.texcoord);
        }
        case 1: {
            // UV debug mode - visualize the UV coordinates
            return vec4f(input.texcoord, 0.0, 1.0);
        }
        default: {
            // Default mode - visualize normals
            return vec4f(input.normal * 0.5 + 0.5, 1.0);
        }
    }
}