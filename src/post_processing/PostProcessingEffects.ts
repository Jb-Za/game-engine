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
}
