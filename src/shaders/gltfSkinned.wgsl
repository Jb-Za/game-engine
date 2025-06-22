// Whale.glb Vertex attributes
// Read in VertexInput from attributes
// f32x3    f32x3   f32x2       u8x4       f32x4
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
@group(0) @binding(1) var<uniform> general_uniforms: GeneralUniforms;

@group(1) @binding(0) var<uniform> node_uniforms: NodeUniforms;

@group(2) @binding(0) var<storage, read> joint_matrices: array<mat4x4f>;
@group(2) @binding(1) var<storage, read> inverse_bind_matrices: array<mat4x4f>;

@group(3) @binding(0) var baseColorTexture: texture_2d<f32>;
@group(3) @binding(1) var baseColorSampler: sampler;

const MAX_JOINTS_PER_VERTEX = 4u;

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;

  let local_position = vec4f(input.position.x, input.position.y, input.position.z, 1.0);

  // Generic skinning calculation
  var skin_matrix = mat4x4f();
  for (var i = 0u; i < MAX_JOINTS_PER_VERTEX; i = i + 1u) {
    let joint_idx = input.joints[i];
    let weight = input.weights[i];
    let joint_matrix = joint_matrices[joint_idx] * inverse_bind_matrices[joint_idx];
    skin_matrix = skin_matrix + joint_matrix * weight;
  }

  var world_position: vec4f;
  if (general_uniforms.skin_mode == 0u) {
    world_position = node_uniforms.world_matrix * (skin_matrix * local_position);
  } else {
    world_position = node_uniforms.world_matrix * local_position;
  }

  output.Position = projectionView * world_position;
  output.normal = input.normal;

  // Output joints as vec4f (pad with 0 if fewer than 4)
  var joints_vec = vec4f(0.0, 0.0, 0.0, 0.0);
  for (var i = 0u; i < MAX_JOINTS_PER_VERTEX && i < 4u; i = i + 1u) {
    joints_vec[i] = f32(input.joints[i]);
  }
  output.joints = joints_vec;
  output.weights = input.weights;
  output.texcoord = input.texcoord;

  return output;
}

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