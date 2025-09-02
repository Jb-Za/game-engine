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

struct FrameParams {
    deltaTime: f32,             // 1
    _pad1: f32,                 // 1
    _pad2: f32,                 // 1
    _pad3: f32,                 // 1 (16 bytes total)
};



fn pressureFromDensity(density: f32, targetDensity: f32, pressureMultiplier: f32) -> f32 {
    return (density - targetDensity) * pressureMultiplier;
}

fn nearPressureFromDensity(nearDensity: f32, nearPressureMultiplier: f32) -> f32 {
    return nearPressureMultiplier * nearDensity;
}

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

fn derivativeSpikyPow2(dst: f32, radius: f32) -> f32 {
    if(dst <= radius){
      let value = radius - dst;
      return  -value * (-60 /3.141592653589793); //PI
    }
    return 0.0;
}

fn derivativeSpikyPow3(dst: f32, radius: f32) -> f32 {
    if(dst <= radius){
        let value = radius - dst;
        return -value * value * (135 / 3.141592653589793); //PI
    }
    return 0.0;
}

@compute @workgroup_size(128)
fn main(@builtin(global_invocation_id) global_id: vec3u) {
    let i = global_id.x;
    if (i >= u32(simParams.particleCount)) { return; }
    var particle = particles[i];
    let pos = predictedPositions[i];
    let density = particle.density;
    let nearDensity = particle.nearDensity;

    if (density <= 0.0) {
        return; // Skip particles with zero/negative density
    }

    let pressure = pressureFromDensity(density, simParams.targetDensity, simParams.pressureMultiplier);
    let nearPressure = nearPressureFromDensity(nearDensity, simParams.nearPressureMultiplier);

    var pressureForce = vec2<f32>(0.0, 0.0);
    let originCell = getCell2D(pos, simParams.smoothingRadius);
    let sqrRadius = simParams.smoothingRadius * simParams.smoothingRadius;

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
            var dirToNeighbor = vec2<f32>(0.0, 1.0);
            if (dst > 0.0) {
                dirToNeighbor = offsetToNeighbor / dst;
            }

            let neighbor = particles[neighborIndex];
            let neighborPressure = pressureFromDensity(neighbor.density, simParams.targetDensity, simParams.pressureMultiplier);
            let neighborNearPressure = nearPressureFromDensity(neighbor.nearDensity, simParams.nearPressureMultiplier);

            let sharedPressure = (pressure + neighborPressure) * 0.5;
            let sharedNearPressure = (nearPressure + neighborNearPressure) * 0.5;

            let densityDerivative = derivativeSpikyPow2(dst, simParams.smoothingRadius);
            let nearDensityDerivative = derivativeSpikyPow3(dst, simParams.smoothingRadius);

            let force1 = dirToNeighbor * (-densityDerivative * sharedPressure);
            let force2 = dirToNeighbor * (-nearDensityDerivative * sharedNearPressure);

            pressureForce = pressureForce + force1 + force2;
        }
    }    let safeDensity = max(density, 1e-6);
    let acceleration = pressureForce / safeDensity;
    particle.velocity = particle.velocity + acceleration * frameParams.deltaTime;
    particles[i] = particle;
}