// Whale.glb Vertex attributes
// Read in VertexInput from attributes
// f32x3    f32x3   f32x2       u8x4       f32x4
struct VertexOutput {
  @builtin(position) Position: vec4f,
  @location(0) normal: vec3f,
  @location(1) joints: vec4f,
  @location(2) weights: vec4f,
}

// Camera uniform: single mat4x4f (projectionView)
@group(0) @binding(0) var<uniform> projectionView: mat4x4f;

struct GeneralUniforms {
  render_mode: u32,
  skin_mode: u32,
}

struct NodeUniforms {
  world_matrix: mat4x4f,
}

@group(1) @binding(0) var<uniform> general_uniforms: GeneralUniforms;
@group(2) @binding(0) var<uniform> node_uniforms: NodeUniforms;
@group(3) @binding(0) var<storage, read> joint_matrices: array<mat4x4f>;
@group(3) @binding(1) var<storage, read> inverse_bind_matrices: array<mat4x4f>;

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  
  // Local space vertex position
  let local_position = vec4f(input.position.x, input.position.y, input.position.z, 1.0);
  
  // Calculate skinned position (when skin_mode == 0)
  let joint0 = joint_matrices[input.joints[0]] * inverse_bind_matrices[input.joints[0]];
  let joint1 = joint_matrices[input.joints[1]] * inverse_bind_matrices[input.joints[1]];
  let joint2 = joint_matrices[input.joints[2]] * inverse_bind_matrices[input.joints[2]];
  let joint3 = joint_matrices[input.joints[3]] * inverse_bind_matrices[input.joints[3]];
  
  let skin_matrix = 
    joint0 * input.weights[0] +
    joint1 * input.weights[1] +
    joint2 * input.weights[2] +
    joint3 * input.weights[3];
  
  // Apply skinning and then node world matrix for skinned mode
  var world_position: vec4f;
  if (general_uniforms.skin_mode == 0) {
    // Skin mode: Apply skin deformation THEN node world matrix
    world_position = node_uniforms.world_matrix * (skin_matrix * local_position);
  } else {
    // Rigid mode: Just apply node world matrix
    world_position = node_uniforms.world_matrix *local_position;
  }
  
  // Apply camera projection view matrix
  output.Position = projectionView * world_position;
  
  // Process other outputs
  output.normal = input.normal; // Note: should transform normals too
  output.joints = vec4f(f32(input.joints[0]), f32(input.joints[1]), 
                        f32(input.joints[2]), f32(input.joints[3]));
  output.weights = input.weights;
  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  switch general_uniforms.render_mode {
    case 1: {
      return input.joints;
    } 
    case 2: {
      return input.weights;
    }
    default: {
      return vec4f(input.normal, 1.0);
    }
  }
}