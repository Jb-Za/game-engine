@group(0) @binding(0) var<storage, read> spatialIndices: array<SpatialIndex>;
@group(0) @binding(1) var<storage, read_write> spatialOffsets: array<u32>;
@group(0) @binding(2) var<uniform> simParams: SimulationParams;

// https://github.com/SebLague/Fluid-Sim/blob/Episode-01/Assets/Scripts/Compute%20Helpers/GPU%20Sort/Resources/BitonicMergeSort.compute

struct SpatialIndex {
    index: u32,
    hash: u32,
    key: u32,
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


@compute @workgroup_size(128)
fn main(@builtin(global_invocation_id) global_id: vec3u) {
  let i = global_id.x;
  let n = simParams.particleCount;
  if (i >= n) { return; }

  let invalidKey = n;
  let key = spatialIndices[i].key;
  var prevKey: u32;
  if (i == 0u) {
    prevKey = invalidKey;
  } else {
    prevKey = spatialIndices[i - 1u].key;
  }
  if (key != prevKey) {
    spatialOffsets[key] = i;
  }
}