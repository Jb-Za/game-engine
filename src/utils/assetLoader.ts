/**
 * Utility to load assets and verify they exist
 */
export async function testGLBAssetAvailable(path: string): Promise<boolean> {
  try {
    const response = await fetch(path, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    console.error(`Error checking asset ${path}:`, error);
    return false;
  }
}

/**
 * Utility to help debug asset paths
 * This function tries multiple path variants to help identify the correct path
 */
export async function debugAssetPaths(basePath: string, fileName: string): Promise<string> {
  const pathVariants = [
    `${basePath}${fileName}`,
    `/${basePath}${fileName}`,
    `/assets/gltf/${fileName}`,
    `assets/gltf/${fileName}`
  ];
  
  let successfulPath = '';
  
  for (const path of pathVariants) {
    try {
      const response = await fetch(path, { method: 'HEAD' });
      if (response.ok) {
        console.log(`Asset available at: ${path}`);
        successfulPath = path;
        break;
      } else {
        console.log(`Asset not found at: ${path} (status: ${response.status})`);
      }
    } catch (error) {
      console.error(`Error checking asset at ${path}:`, error);
    }
  }
  
  return successfulPath;
}
