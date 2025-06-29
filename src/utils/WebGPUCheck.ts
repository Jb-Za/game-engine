/**
 * Checks if WebGPU is supported in the current browser
 * Returns a promise that resolves if WebGPU is available, or rejects with an error message
 */
export async function checkWebGPUSupport(): Promise<boolean> {
  // First check if the navigator.gpu object exists
  if (!navigator.gpu) {
    throw new Error(
      "WebGPU is not supported in this browser. Try using Chrome 113+ or Edge 113+."
    );
  }
  
  try {
    // Try to request an adapter to confirm WebGPU works
    const adapter = await navigator.gpu.requestAdapter();
    
    if (!adapter) {
      throw new Error(
        "WebGPU is supported but no adapter was found. Your GPU may not be compatible."
      );
    }
    
    return true;
  } catch (error) {
    console.error("Error checking WebGPU support:", error);
    throw new Error(
      "Failed to initialize WebGPU. Your device might not support WebGPU or it may be disabled."
    );
  }
}
