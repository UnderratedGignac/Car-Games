declare module 'n8ao' {
  import * as THREE from 'three';
  import { Pass } from 'postprocessing';

  export interface N8AOConfiguration {
    aoSamples: number;
    aoRadius: number;
    aoTones: number;
    denoiseSamples: number;
    denoiseRadius: number;
    distanceFalloff: number;
    intensity: number;
    denoiseIterations: number;
    renderMode: number;
    color: THREE.Color;
    gammaCorrection: boolean;
    logarithmicDepthBuffer: boolean;
    screenSpaceRadius: boolean;
    halfRes: boolean;
    depthAwareUpsampling: boolean;
    transparencyAware: boolean;
    accumulate: boolean;
    aoBias: number;
    biasOffset: number;
    biasMultiplier: number;
  }

  export class N8AOPostPass extends Pass {
    configuration: N8AOConfiguration;
    width: number;
    height: number;
    constructor(scene: THREE.Scene, camera: THREE.Camera, width?: number, height?: number);
    setSize(width: number, height: number): void;
    dispose(): void;
  }

  export class N8AOPass extends N8AOPostPass {}
}
