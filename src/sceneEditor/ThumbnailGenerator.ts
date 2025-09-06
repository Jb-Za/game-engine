// ThumbnailGenerator.ts - Service for generating GLTF thumbnails
import { Camera } from '../camera/Camera';
import { ShadowCamera } from '../camera/ShadowCamera';
import { AmbientLight } from '../lights/AmbientLight';
import { DirectionalLight } from '../lights/DirectionalLight';
import { PointLightsCollection } from '../lights/PointLight';
import { GLTFGameObject } from '../gltf/GLTFGameObject';
import { Vec3 } from '../math/Vec3';
import { Quaternion } from '../math/Quaternion';
import { Color } from '../math/Color';

export class ThumbnailGenerator {
  private static readonly THUMBNAIL_SIZE = 256;
  
  /**
   * Generate a thumbnail for a GLTF object
   */
  static async generateThumbnail(filePath: string): Promise<string> {
    try {
      console.log(`Generating thumbnail for: ${filePath}`);

      // Create offscreen canvas
      const canvas = document.createElement('canvas');
      canvas.width = this.THUMBNAIL_SIZE;
      canvas.height = this.THUMBNAIL_SIZE;

      // Initialize WebGPU with offscreen canvas
      const adapter = await navigator.gpu?.requestAdapter();
      if (!adapter) {
        throw new Error('WebGPU not supported');
      }

      const device = await adapter.requestDevice();
      const context = canvas.getContext('webgpu');
      if (!context) {
        throw new Error('Could not get WebGPU context');
      }

      const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
      context.configure({
        device,
        format: presentationFormat,
        alphaMode: 'premultiplied',
      });

      // Create depth texture
      const depthTexture = device.createTexture({
        size: [canvas.width, canvas.height],
        format: 'depth32float',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });

      // Set up minimal scene
      const camera = new Camera(device, 1.0); // Square aspect ratio
      camera.eye = new Vec3(3, 2, 3);
      camera.target = new Vec3(0, 0, 0);

      const shadowCamera = new ShadowCamera(device);
      shadowCamera.eye = new Vec3(5, 5, 5);
      shadowCamera.target = new Vec3(0, 0, 0);

      const ambientLight = new AmbientLight(device);
      ambientLight.color = new Color(1, 1, 1, 1);
      ambientLight.intensity = 0.6;

      const directionalLight = new DirectionalLight(device);
      directionalLight.color = new Color(1, 1, 1, 1);
      directionalLight.intensity = 0.8;
      directionalLight.direction = new Vec3(-0.5, -1, -0.5);

      const pointLights = new PointLightsCollection(device, 3);
      // Disable point lights for clean preview
      pointLights.lights[0].intensity = 0;
      pointLights.lights[1].intensity = 0;
      pointLights.lights[2].intensity = 0;

      // Load GLTF object
      const gltfObject = new GLTFGameObject(
        device, 
        camera, 
        shadowCamera, 
        ambientLight, 
        directionalLight, 
        pointLights,
        presentationFormat,
        depthTexture,
        new Vec3(1, 1, 1), // scale
        new Vec3(0, 0, 0), // position
        new Quaternion(0,1,0,0), // rotation
        true // use lighting
      );

      await gltfObject.initialize(filePath);

      // Auto-frame the object
      this.autoFrameObject(camera, gltfObject);

      // Update all systems
      camera.update();
      shadowCamera.update();
      ambientLight.update();
      directionalLight.update();
      pointLights.update();
      gltfObject.update(0);

      // Render single frame
      const commandEncoder = device.createCommandEncoder();
      
      const renderPassEncoder = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: context.getCurrentTexture().createView(),
            clearValue: { r: 0.2, g: 0.2, b: 0.3, a: 1.0 }, // Dark blue background
            loadOp: 'clear',
            storeOp: 'store',
          },
        ],
        depthStencilAttachment: {
          view: depthTexture.createView(),
          depthClearValue: 1.0,
          depthLoadOp: 'clear',
          depthStoreOp: 'store',
        },
      });

      // Render the GLTF object
      gltfObject.draw(renderPassEncoder);
      renderPassEncoder.end();

      device.queue.submit([commandEncoder.finish()]);

      // Wait for rendering to complete
      await device.queue.onSubmittedWorkDone();

      // Extract image as data URL
      const dataURL = canvas.toDataURL('image/png');
      
      // Clean up
      depthTexture.destroy();
      device.destroy();

      console.log(`Thumbnail generated successfully for: ${filePath}`);
      return dataURL;

    } catch (error) {
      console.error(`Failed to generate thumbnail for ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Auto-frame the camera to show the object nicely
   */
  private static autoFrameObject(camera: Camera, gltfObject: GLTFGameObject) {
    // Simple heuristic based on object scale and type
    const scale = gltfObject.scale;
    const maxScale = Math.max(scale.x, scale.y, scale.z);
    
    // Position camera based on object size
    const distance = maxScale * 2.5 + 2;
    
    camera.eye = new Vec3(
      distance * 0.7,
      distance * 0.4,
      distance * 0.7
    );
    
    // Look at the object center (slightly above ground)
    camera.target = new Vec3(0, maxScale * 0.2, 0);
  }

  /**
   * Save thumbnail to the thumbnails directory
   * In a real application, this would save to the file system
   */
  static async saveThumbnail(dataURL: string, filePath: string): Promise<void> {
    try {
      // Extract filename without extension
      const fileName = filePath.split('/').pop()?.replace(/\.(glb|gltf)$/i, '') || 'unknown';
      
      // In a browser environment, we can't directly save files
      // This would typically be handled by a backend service
      console.log(`Thumbnail would be saved as: /thumbnails/gltf/${fileName}.png`);
      
      // For demo purposes, we could store in localStorage or IndexedDB
      localStorage.setItem(`thumbnail_${fileName}`, dataURL);
      
    } catch (error) {
      console.error('Failed to save thumbnail:', error);
    }
  }

  /**
   * Load thumbnail from storage
   */
  static async loadThumbnail(assetName: string): Promise<string | null> {
    try {
      // Try to load from localStorage first (for generated thumbnails)
      const cached = localStorage.getItem(`thumbnail_${assetName}`);
      if (cached) {
        return cached;
      }

      // Try to load from public thumbnails directory
      const thumbnailPath = `/thumbnails/gltf/${assetName}.png`;
      const response = await fetch(thumbnailPath);
      
      if (response.ok) {
        const blob = await response.blob();
        return URL.createObjectURL(blob);
      }

      return null;
    } catch (error) {
      console.warn(`Could not load thumbnail for ${assetName}:`, error);
      return null;
    }
  }
}
