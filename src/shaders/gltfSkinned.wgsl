
struct VertexOutput {
  @builtin(position) Position: vec4f,
  @location(0) normal: vec3f,
  @location(1) joints: vec4f,
  @location(2) weights: vec4f,
  @location(3) texcoord: vec2f,
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
@group(1) @binding(0) var<uniform> general_uniforms: GeneralUniforms;
@group(2) @binding(0) var<uniform> node_uniforms: NodeUniforms;
@group(3) @binding(0) var baseColorTexture: texture_2d<f32>;
@group(3) @binding(1) var baseColorSampler: sampler;
@group(3) @binding(2) var<storage, read> joint_matrices: array<mat4x4f>;
@group(3) @binding(3) var<storage, read> inverse_bind_matrices: array<mat4x4f>;

const MAX_JOINTS_PER_VERTEX = 4u;

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  switch general_uniforms.render_mode {
    case 1: {
      return input.joints;
    } 
    case 2: {
      // Texture mode - sample from texture using UV coordinates
      return textureSample(baseColorTexture, baseColorSampler, input.texcoord);
    }
    case 3: {
      return input.weights;
    }
    default: {
      return vec4f(input.normal * 0.5 + 0.5, 1.0);
    }
  }
}