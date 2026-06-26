import {
  ACESFilmicToneMapping,
  PerspectiveCamera,
  PCFSoftShadowMap,
  Scene,
  SRGBColorSpace,
  Vector2,
  WebGLRenderer,
} from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { GameConfig } from '../config/gameConfig';

/**
 * Owns the WebGL renderer, the camera, the scene and the post-processing stack.
 * The rest of the game treats this as the "screen" — it renders whatever scene
 * + camera it is told to each frame.
 *
 * Post-processing stack (HDR pipeline):
 *   RenderPass -> SSAO (ambient occlusion) -> Bloom -> FXAA -> OutputPass
 * Tone mapping is ACES Filmic for a filmic, non-cartoonish look.
 */
export class Engine {
  readonly renderer: WebGLRenderer;
  readonly camera: PerspectiveCamera;
  readonly scene: Scene;
  readonly composer: EffectComposer;

  private bloomPass?: UnrealBloomPass;
  private ssaoPass?: SSAOPass;
  private fxaaPass?: ShaderPass;
  private readonly container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;

    this.renderer = new WebGLRenderer({
      antialias: !GameConfig.render.enableFXAA,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, GameConfig.render.pixelRatioCap),
    );
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.scene = new Scene();

    this.camera = new PerspectiveCamera(
      GameConfig.render.fov,
      window.innerWidth / window.innerHeight,
      GameConfig.render.near,
      GameConfig.render.far,
    );

    this.composer = new EffectComposer(this.renderer);
    this.buildPostProcessing();

    window.addEventListener('resize', this.onResize);
  }

  private buildPostProcessing(): void {
    const { width, height } = this.size();
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    if (GameConfig.render.enableSSAO) {
      const ssao = new SSAOPass(this.scene, this.camera, width, height);
      ssao.kernelRadius = 0.6;
      ssao.minDistance = 0.0015;
      ssao.maxDistance = 0.08;
      this.ssaoPass = ssao;
      this.composer.addPass(ssao);
    }

    if (GameConfig.render.enableBloom) {
      const bloom = new UnrealBloomPass(new Vector2(width, height), 0.45, 0.7, 0.85);
      this.bloomPass = bloom;
      this.composer.addPass(bloom);
    }

    if (GameConfig.render.enableFXAA) {
      const fxaa = new ShaderPass(FXAAShader);
      this.fxaaPass = fxaa;
      this.updateFxaaResolution();
      this.composer.addPass(fxaa);
    }

    this.composer.addPass(new OutputPass());
  }

  private size(): { width: number; height: number } {
    return { width: window.innerWidth, height: window.innerHeight };
  }

  private updateFxaaResolution(): void {
    if (!this.fxaaPass) return;
    const pr = this.renderer.getPixelRatio();
    this.fxaaPass.material.uniforms['resolution'].value.set(
      1 / (window.innerWidth * pr),
      1 / (window.innerHeight * pr),
    );
  }

  private onResize = (): void => {
    const { width, height } = this.size();
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);
    this.ssaoPass?.setSize(width, height);
    this.bloomPass?.setSize(width, height);
    this.updateFxaaResolution();
  };

  render(): void {
    this.composer.render();
  }

  dispose(): void {
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }
}
