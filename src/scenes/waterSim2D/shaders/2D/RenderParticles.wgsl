struct Particle {
    position : vec2f,
    velocity : vec2f,
    density : f32,
    nearDensity : f32,
    _padding : vec2f,
    color : vec4f,
    _padding0 : vec4f,
};

@group(0) @binding(0) var<storage, read> particles : array<Particle>;
@group(0) @binding(1) var<uniform> camera : CameraUniform;

struct CameraUniform {
    viewProjectionMatrix: mat4x4<f32>,
};

struct VertexOutput {
    @builtin(position) position : vec4f,
    @location(0) color : vec4f,
};

@vertex
fn vs_main(
@location(0) localPos : vec2f,      //Circle vertex position
@builtin(instance_index) instanceIndex : u32
) -> VertexOutput {
    let particle = particles[instanceIndex];

        //Transform local circle position to world space
    let worldPos = localPos * 0.14 + particle.position;  //0.1 = particle radius

    var output : VertexOutput;
    output.position = camera.viewProjectionMatrix * vec4f(worldPos, 0.0, 1.0);
    output.color = particle.color;
    return output;
}

@fragment
fn fs_main(@location(0) color : vec4f) -> @location(0) vec4f {
    return color;
}
