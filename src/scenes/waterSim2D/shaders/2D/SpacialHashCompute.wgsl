@group(0) @binding(0) var<storage, read> particles: array<Particle>;
@group(0) @binding(1) var<storage, read_write> spatialIndices: array<SpatialIndex>;
@group(0) @binding(2) var<uniform> simParams: SimulationParams;

struct SpatialIndex {
    index: u32,
    hash: u32,
    key: u32,
}

struct Particle {
    position: vec2f, // 2
    velocity: vec2f, // 2
    density: f32,    // 1
    nearDensity: f32,// 1
    _padding: vec2f, // 2
    color: vec4f,    // 4
    _padding0: vec4f, // padding for 64 bytes
}

struct SimulationParams {
    gravity: f32,               // 1
    targetDensity: f32,         // 1
    pressureMultiplier: f32,    // 1
    nearPressureMultiplier: f32,// 1
    viscosityStrength: f32,     // 1
    smoothingRadius: f32,       // 1
    particleCount: u32,         // 1
    _pad1: u32,                 // 1 (32 bytes total)
};


fn getCell2D(pos: vec2<f32>, radius: f32) -> vec2<i32> {
    return vec2<i32>(floor(pos / radius));
}

fn hashCell2D(cell: vec2<i32>) -> u32 {
    // Large primes to reduce collisions
    let p1: u32 = 73856093u;
    let p2: u32 = 19349663u;
    let p3: u32 = 83492791u;

    let x: u32 = u32(cell.x);
    let y: u32 = u32(cell.y);

    return ((x * p1) ^ (y * p2)) * p3;
}

fn keyFromHash(hash: u32, particleCount: u32) -> u32 {
    return hash % particleCount;
}

@compute @workgroup_size(128)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    if (index >= u32(simParams.particleCount)) { return; }

    let cell = getCell2D(particles[index].position, simParams.smoothingRadius);
    let hash = hashCell2D(cell);
    let key = keyFromHash(hash, u32(simParams.particleCount));

    spatialIndices[index] = SpatialIndex(index, hash, key);
}