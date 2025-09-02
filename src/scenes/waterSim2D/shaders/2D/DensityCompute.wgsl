@group(0) @binding(0) var<storage, read> predictedPositions: array<vec2<f32>>;
@group(0) @binding(1) var<storage, read> spatialIndices: array<SpatialIndex>;
@group(0) @binding(2) var<storage, read> spatialOffsets: array<u32>;
@group(0) @binding(3) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(4) var<uniform> simParams: SimulationParams;

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

fn spikyKernelPow2(dst: f32, radius: f32) -> f32 {
    if(dst < radius){
        let value = radius - dst;
        return value * value * ( 30 / 3.141592653589793); //PI
    }
    return 0.0;
}

fn spikyKernelPow3(dst: f32, radius: f32) -> f32 {
   if(dst < radius){
    let value = radius - dst;
    return value * value * value * (-45 / 3.141592653589793); //PI
}
   return 0.0;
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

@compute @workgroup_size(128)
fn main(@builtin(global_invocation_id) global_id: vec3u) {
    let index = global_id.x;
    if (index >= simParams.particleCount) { return; }
    let pos = predictedPositions[index];
    var density = 0.0;
    var nearDensity = 0.0;

    // 9 neighboring cells (including current)
    let cellOffsets = array<vec2<i32>, 9>(
        vec2<i32>(-1,  1), vec2<i32>(0,  1), vec2<i32>(1,  1),
        vec2<i32>(-1,  0), vec2<i32>(0,  0), vec2<i32>(1,  0),
        vec2<i32>(-1, -1), vec2<i32>(0, -1), vec2<i32>(1, -1)
    );
    let originCell = getCell2D(pos, simParams.smoothingRadius);
    let sqrRadius = simParams.smoothingRadius * simParams.smoothingRadius;
    
    for (var i = 0; i < 9; i++) {
        let cell = originCell + cellOffsets[i];
        let hash = hashCell2D(cell);
        let key = keyFromHash(hash, u32(simParams.particleCount));
        var currIndex = spatialOffsets[key];
        
        loop {
            if (currIndex >= simParams.particleCount) { break; }

            let indexData = spatialIndices[currIndex];
            currIndex++;
            
            if (indexData.key != key) { break; }
            if (indexData.hash != hash) { continue; }
            
            let neighborPos = predictedPositions[indexData.index];
            let offsetToNeighbor = neighborPos - pos;
            let sqrDstToNeighbor = dot(offsetToNeighbor, offsetToNeighbor);
            
            if (sqrDstToNeighbor > sqrRadius) { continue; }
            
            if (sqrDstToNeighbor > sqrRadius) { continue; }
            let dst = sqrt(sqrDstToNeighbor);
            if (dst >= simParams.smoothingRadius) { continue; }
            density += spikyKernelPow2(dst, simParams.smoothingRadius);
            nearDensity += spikyKernelPow3(dst, simParams.smoothingRadius);
        }
    }

    
    particles[index].density = density;
    particles[index].nearDensity = nearDensity;
}