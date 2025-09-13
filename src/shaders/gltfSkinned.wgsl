
struct VertexOutput {
  @builtin(position) Position: vec4f,
  @location(0) normal: vec3f,
  @location(1) joints: vec4f,
  @location(2) weights: vec4f,
  @location(3) texcoord: vec2f,
  @location(4) worldPos: vec3f,
}

struct GeneralUniforms {
  render_mode: u32,
  skin_mode: u32,
}

struct NodeUniforms {
  world_matrix: mat4x4f,
}

// All main uniforms in group 0
@group(0) @binding(0) var<uniform> projectionView: mat4x4f;
@group(0) @binding(1) var<uniform> eyePos: vec3f;
@group(1) @binding(0) var<uniform> general_uniforms: GeneralUniforms;
@group(2) @binding(0) var<uniform> node_uniforms: NodeUniforms;
@group(3) @binding(0) var baseColorTexture: texture_2d<f32>;
@group(3) @binding(1) var baseColorSampler: sampler;
@group(3) @binding(2) var<storage, read> joint_matrices: array<mat4x4f>;
@group(3) @binding(3) var<storage, read> inverse_bind_matrices: array<mat4x4f>;

const MAX_JOINTS_PER_VERTEX = 4u;

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
  
  switch general_uniforms.render_mode {
    case 1: {
      output.color = input.joints;
    } 
    case 2: {
      // Texture mode - sample from texture using UV coordinates
      output.color = textureSample(baseColorTexture, baseColorSampler, input.texcoord);
    }
    case 3: {
      output.color = input.weights;
    }
    default: {
      output.color = vec4f(normalizedNormal * 0.5 + 0.5, 1.0);
    }
  }
  
  output.normal = vec4f(normalizedNormal * 0.5 + 0.5, 1.0); // Encode normal to 0-1 range
  output.depth = vec4f(clampedDepth, 0.0, 0.0, 1.0); // Linear depth in red channel
  
  return output;
}