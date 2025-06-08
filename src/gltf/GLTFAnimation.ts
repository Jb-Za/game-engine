export interface GLTFAnimationSampler {
    input: number; // Index of accessor with keyframe input values (e.g., time)
    interpolation?: 'LINEAR' | 'STEP' | 'CUBICSPLINE';
    output: number; // Index of accessor with keyframe output values (e.g., translation, rotation)
}

export interface GLTFAnimationChannelTarget {
    node: number; // Index of the node to animate
    path: 'translation' | 'rotation' | 'scale' | 'weights';
}

export interface GLTFAnimationChannel {
    sampler: number; // Index of sampler in animation.samplers
    target: GLTFAnimationChannelTarget;
}

export interface GLTFAnimation {
    name?: string;
    samplers: GLTFAnimationSampler[];
    channels: GLTFAnimationChannel[];
}