import { PostProcessingEffect } from "./PostProcessing";
import { Color } from "../math/Color";
import { Vec2 } from "../math/Vec2";
import grayScaleShader from "../shaders/PostProcessing/Grayscale.wgsl?raw";
import SepiaShader from "../shaders/PostProcessing/Sepia.wgsl?raw";
import InvertShader from "../shaders/PostProcessing/Invert.wgsl?raw";
import BlurShader from "../shaders/PostProcessing/Blur.wgsl?raw";
import ColorTintShader from "../shaders/PostProcessing/ColorTint.wgsl?raw";
import BrightnessShader from "../shaders/PostProcessing/Brightness.wgsl?raw";
import VignetteShader from "../shaders/PostProcessing/Vignette.wgsl?raw";
import DifferenceOfGaussiansShader from "../shaders/PostProcessing/DifferenceOfGaussians.wgsl?raw";
import DoGMaskShader from "../shaders/PostProcessing/DoGMask.wgsl?raw";
import PosterizeShader from "../shaders/PostProcessing/Posterize.wgsl?raw";
import CartoonCompositeShader from "../shaders/PostProcessing/CartoonComposite.wgsl?raw";
import DoGHatchingShader from "../shaders/PostProcessing/DifferenceOfGaussiansHatch.wgsl?raw";
import { Texture2D } from "../texture/Texture2D";

export class PostProcessingEffects {
    public static getGrayscale(): PostProcessingEffect {
        return {
            name: 'grayscale',
            shaderCode: grayScaleShader,
            uniforms: {
                intensity: new Float32Array([1.0])
            }
        };
    }

    public static getSepia(): PostProcessingEffect {
        return {
            name: 'sepia',
            shaderCode: SepiaShader,
            uniforms: {
                intensity: new Float32Array([1.0])
            }
        };
    }

    public static getInvert(): PostProcessingEffect {
        return {
            name: 'invert',
            shaderCode: InvertShader
        };
    }

    public static getBlur(): PostProcessingEffect {
        return {
            name: 'blur',
            shaderCode: BlurShader,
            uniforms: {
                blurRadius: new Float32Array([3.0]),
                texelSize: new Vec2(1.0 / 1280.0, 1.0 / 720.0) // Default for 720p, should be set by scene
            }
        };
    }

    public static getColorTint(): PostProcessingEffect {
        return {
            name: 'colorTint',
            shaderCode: ColorTintShader,
            uniforms: {
                tintColor: new Color(1.0, 0.8, 0.6, 1.0), // Warm tint
                intensity: new Float32Array([0.5])
            }
        };
    }

    public static getBrightness(): PostProcessingEffect {
        return {
            name: 'brightness',
            shaderCode: BrightnessShader,
            uniforms: {
                brightness: new Float32Array([0.0]),
                contrast: new Float32Array([1.0])
            }
        };
    }
    public static getVignette(): PostProcessingEffect {
        return {
            name: 'vignette',
            shaderCode: VignetteShader,
            uniforms: {
                vignetteIntensity: new Float32Array([0.8]),
                vignetteRadius: new Float32Array([0.8])
            }
        };
    }

    public static getDifferenceOfGaussians(sigma: number = 1.0, scale: number = 2.0, radius: number = 3): PostProcessingEffect {
        return {
            name: 'differenceOfGaussians',
            shaderCode: DifferenceOfGaussiansShader,
            uniforms: {
                texelSize: new Vec2(1.0 / 1280.0, 1.0 / 720.0), // Default for 720p, should be set by scene
                sigma: new Float32Array([sigma]),
                scale: new Float32Array([scale]),
                radius: new Float32Array([radius])
            }
        }
    }

    // NPR/Cartoon Effects
    public static getDoGMask(sigma: number = 1.0, scale: number = 2.0, radius: number = 3, threshold: number = 0.03, sharpness: number = 20.0): PostProcessingEffect {
        return {
            name: 'dogMask',
            shaderCode: DoGMaskShader,
            uniforms: {
                texelSize: new Vec2(1.0 / 1280.0, 1.0 / 720.0),
                sigma: new Float32Array([sigma]),
                scale: new Float32Array([scale]),
                radius: new Float32Array([radius]),
                threshold: new Float32Array([threshold]),
                edgeSharpness: new Float32Array([sharpness])
            }
        };
    }

    public static getPosterize(levels: number = 6): PostProcessingEffect {
        return {
            name: 'posterize',
            shaderCode: PosterizeShader,
            uniforms: {
                levels: new Float32Array([levels])
            }
        };
    }    
    
    public static getCartoonComposite(): PostProcessingEffect {
        return {
            name: 'cartoonComposite',
            shaderCode: CartoonCompositeShader,
            uniforms: {
                edgeColor: new Float32Array([0.0, 0.0, 0.0]), // Black outlines
                edgeStrength: new Float32Array([1.0]),
                mixRatio: new Float32Array([0.8]) // 80% posterized, 20% original
            }
        };
    }    public static getDoGHatching(hatchTexture: Texture2D): PostProcessingEffect {
        return {
            name: 'doGHatching',
            shaderCode: DoGHatchingShader,
            uniforms: {
                texelSize: new Vec2(1.0 / 1280.0, 1.0 / 720.0),
                sigma: new Float32Array([1.0]),
                scale: new Float32Array([2.0]),
                radius: new Float32Array([3]),
                threshold: new Float32Array([0.01]),
                edgeSharpness: new Float32Array([20.0])
            },
            textures: {
                hatchTexture: hatchTexture
            }
        };
    }

    // Preset combinations for easy use
    public static getCartoonPreset(): { effects: PostProcessingEffect[], setup: (postProcessing: any, canvasWidth: number, canvasHeight: number) => void } {
        return {
            effects: [
                this.getDoGMask(1.2, 2.0, 4, 0.05, 15.0),
                this.getPosterize(5),
                this.getCartoonComposite()
            ],
            setup: (postProcessing: any, canvasWidth: number, canvasHeight: number) => {
                // Update texel size for DoG mask
                postProcessing.updateUniform('dogMask', 'texelSize', new Vec2(1.0 / canvasWidth, 1.0 / canvasHeight));
                
                // Fine-tune parameters
                postProcessing.updateUniform('dogMask', 'threshold', new Float32Array([0.05]));
                postProcessing.updateUniform('dogMask', 'edgeSharpness', new Float32Array([15.0]));
                postProcessing.updateUniform('posterize', 'levels', new Float32Array([5]));
                postProcessing.updateUniform('cartoonComposite', 'edgeStrength', new Float32Array([1.2]));
                postProcessing.updateUniform('cartoonComposite', 'mixRatio', new Float32Array([0.8]));
            }
        };
    }

    public static getOutlinePreset(): { effects: PostProcessingEffect[], setup: (postProcessing: any, canvasWidth: number, canvasHeight: number) => void } {
        return {
            effects: [
                this.getDoGMask(0.8, 2.5, 3, 0.02, 25.0),
                this.getCartoonComposite()
            ],
            setup: (postProcessing: any, canvasWidth: number, canvasHeight: number) => {
                // Update texel size for DoG mask
                postProcessing.updateUniform('dogMask', 'texelSize', new Vec2(1.0 / canvasWidth, 1.0 / canvasHeight));
                
                // Strong edge detection for outlines only
                postProcessing.updateUniform('dogMask', 'threshold', new Float32Array([0.02]));
                postProcessing.updateUniform('dogMask', 'edgeSharpness', new Float32Array([25.0]));
                postProcessing.updateUniform('cartoonComposite', 'edgeStrength', new Float32Array([1.0]));
                postProcessing.updateUniform('cartoonComposite', 'mixRatio', new Float32Array([0.0])); // Use original image, just add outlines
            }
        };
    }
}
