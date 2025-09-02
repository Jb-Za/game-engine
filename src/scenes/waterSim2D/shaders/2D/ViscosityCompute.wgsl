@group(0) @binding(0) var<storage, read> predictedPositions: array<vec2<f32>>;
@group(0) @binding(1) var<storage, read> spatialIndices: array<SpatialIndex>;
@group(0) @binding(2) var<storage, read> spatialOffsets: array<u32>;
@group(0) @binding(3) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(4) var<uniform> simParams: SimulationParams;
@group(0) @binding(5) var<uniform> frameParams: FrameParams;

// https://github.com/SebLague/Fluid-Sim/blob/Episode-01/
struct SpatialIndex {
    index: u32,
    hash: u32,
    key: u32,
}

struct Particle {
    position: vec2f,
    velocity: vec2f,
    density: f32,
    nearDensity: f32,
    _padding: vec2f,
    color: vec4f,
    _padding0: vec4f,
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

struct FrameParams {
    deltaTime: f32,             // 1
    _pad1: f32,                 // 1
    _pad2: f32,                 // 1
    _pad3: f32,                 // 1 (16 bytes total)
};

fn getCell2D(pos: vec2<f32>, radius: f32) -> vec2<i32> {
    return vec2<i32>(floor(pos / radius));
}

fn hashCell2D(cell: vec2<i32>) -> u32 {
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

fn smoothingKernelPoly6(dst: f32, radius: f32) -> f32 {
    if(dst < radius){
      let value = radius * radius - dst * dst;
      return value * value * value * (315.0 / (64.0 * 3.141592653589793));
    }
    return 0.0;
}

@compute @workgroup_size(128)
fn main(@builtin(global_invocation_id) global_id: vec3u) {
    let i = global_id.x;
    if (i >= u32(simParams.particleCount)) { return; }
    var particle = particles[i];
    let pos = predictedPositions[i];
    let velocity = particle.velocity;
    
    var viscosityForce = vec2<f32>(0.0, 0.0);
    let originCell = getCell2D(pos, simParams.smoothingRadius);
    let sqrRadius = simParams.smoothingRadius * simParams.smoothingRadius;

    // 9 neighboring cells (including current cell)
    let cellOffsets = array<vec2<i32>, 9>(
        vec2<i32>(-1,  1), vec2<i32>(0,  1), vec2<i32>(1,  1),
        vec2<i32>(-1,  0), vec2<i32>(0,  0), vec2<i32>(1,  0),
        vec2<i32>(-1, -1), vec2<i32>(0, -1), vec2<i32>(1, -1)
    );    for (var j = 0; j < 9; j++) {
        let cell = originCell + cellOffsets[j];
        let hash = hashCell2D(cell);
        let key = keyFromHash(hash, u32(simParams.particleCount));
        var currIndex = spatialOffsets[key];

        loop {
            if (currIndex >= u32(simParams.particleCount)) { break; }

            let indexData = spatialIndices[currIndex];
            currIndex++;

            if (indexData.key != key) { break; }
            if (indexData.hash != hash) { continue; }

            let neighborIndex = indexData.index;
            if (neighborIndex == i) { continue; }

            let neighborPos = predictedPositions[neighborIndex];
            let offsetToNeighbor = neighborPos - pos;
            let sqrDstToNeighbor = dot(offsetToNeighbor, offsetToNeighbor);

            if (sqrDstToNeighbor > sqrRadius) { continue; }

            let dst = sqrt(sqrDstToNeighbor);
            let neighbor = particles[neighborIndex];
            let velocityDiff = neighbor.velocity - velocity;
            let viscosityKernel = smoothingKernelPoly6(dst, simParams.smoothingRadius);
            
            viscosityForce = viscosityForce + velocityDiff * viscosityKernel;
        }
    }    // Apply viscosity force to velocity
    particle.velocity = particle.velocity + viscosityForce * simParams.viscosityStrength * frameParams.deltaTime;
    particles[i] = particle;
}