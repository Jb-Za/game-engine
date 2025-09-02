@group(0) @binding(0) var<storage, read_write> spatialIndices: array<SpatialIndex>;
@group(0) @binding(2) var<uniform> sortStage: SortStage;
// https://github.com/SebLague/Fluid-Sim/blob/Episode-01/Assets/Scripts/Compute%20Helpers/GPU%20Sort/Resources/BitonicMergeSort.compute

struct SpatialIndex {
    index: u32,
    hash: u32,
    key: u32,
};

struct SortStage { k: u32, j: u32, count: u32, _pad: u32 };


@compute @workgroup_size(128)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  let n = sortStage.count;
  if (i >= n) { return; }

  let ixj = i ^ sortStage.j;
  if (ixj > i && ixj < n) {
    let ascending = ((i & sortStage.k) == 0u);
    let a = spatialIndices[i];
    let b = spatialIndices[ixj];
    
    // Handle padding entries (they should have max key values)
    let swap = (ascending && (a.key > b.key)) || (!ascending && (a.key < b.key));
    if (swap) {
      spatialIndices[i] = b;
      spatialIndices[ixj] = a;
    }
  }
}