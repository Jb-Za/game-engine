struct VertexOutput {
    @builtin(position) Position: vec4f,
    @location(0) normal: vec3f,
    @location(1) texcoord: vec2f,
    @location(2) worldPos: vec3f,
}

struct GeneralUniforms {
    render_mode: u32,
}

struct NodeUniforms { 
    world_matrix: mat4x4f,
}

@group(0) @binding(0) var<uniform> projectionView: mat4x4f;
@group(0) @binding(1) var<uniform> eyePos: vec3f;
@group(1) @binding(0) var<uniform> general_uniforms: GeneralUniforms;
@group(2) @binding(0) var<uniform> node_uniforms: NodeUniforms;
@group(3) @binding(0) var baseColorTexture: texture_2d<f32>;
@group(3) @binding(1) var baseColorSampler: sampler;

@vertex
fn vertexMain(
    @location(0) position: vec3f,
    @location(1) normal: vec3f,
    @location(2) texcoord: vec2f
) -> VertexOutput {
    var output: VertexOutput;
    let worldPos = node_uniforms.world_matrix * vec4f(position, 1.0);
    output.Position = projectionView * worldPos;
    output.normal = (node_uniforms.world_matrix * vec4f(normal, 0.0)).xyz;
    output.texcoord = texcoord;
    output.worldPos = worldPos.xyz;
    return output;
}

struct FragOutput {
    @location(0) color: vec4f,
    @location(1) normal: vec4f,
    @location(2) depth: vec4f,
}

@fragment
fn fragmentMain(input: VertexOutput) -> FragOutput {
    var output: FragOutput;
    
    // Calculate linear depth
    let linearDepth = length(input.worldPos - eyePos) / 100.0; // Normalize by far plane distance
    let clampedDepth = clamp(linearDepth, 0.0, 1.0);
    
    // Normalize and encode normal
    let normalizedNormal = normalize(input.normal);
    
    // Handle different render modes
    switch general_uniforms.render_mode {
        case 2: {
            // Texture mode - sample the texture with provided UV coordinates
            output.color = textureSample(baseColorTexture, baseColorSampler, input.texcoord);
        }
        case 1: {
            // UV debug mode - visualize the UV coordinates
            output.color = vec4f(input.texcoord, 0.0, 1.0);
        }
        default: {
            // Default mode - visualize normals
            output.color = vec4f(normalizedNormal * 0.5 + 0.5, 1.0);
        }
    }
    
    output.normal = vec4f(normalizedNormal * 0.5 + 0.5, 1.0); // Encode normal to 0-1 range
    output.depth = vec4f(clampedDepth, 0.0, 0.0, 1.0); // Linear depth in red channel
    
    return output;
}