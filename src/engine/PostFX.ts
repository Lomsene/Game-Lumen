/**
 * WebGL2 lighting & post-processing for AETHER: ECLIPSE.
 *
 * The 2D renderer draws the scene into a transparent offscreen canvas. Each frame this
 * class uploads it as a texture and composites:
 *   - a procedural nebula + twin parallax star layers behind the scene
 *   - a dynamic light map (hundreds of instanced point lights, rendered at reduced resolution)
 *     that brightens the dark arena around every light source
 *   - a two-level bloom (bright-pass at 1/4 and 1/8 resolution)
 *   - vignette, low-light danger pulse, hit aberration, screen flashes and ACES tonemapping
 * All heavy work runs on the GPU at low resolution, which is far cheaper on phones than
 * Canvas2D glows/gradients.
 */

export interface FxFrameParams {
  camX: number;
  camY: number;
  time: number;
  /** Base brightness of unlit areas (0..1). */
  ambient: number;
  /** Low-light danger pulse (0..1). */
  danger: number;
  /** Chromatic aberration strength after taking a hit (0..1). */
  hit: number;
  flash: number;
  flashColor: [number, number, number];
}

export interface FxProfile {
  /** Light map resolution relative to the canvas. */
  lightScale: number;
  /** Second, wider bloom level. */
  wideBloom: boolean;
  bloomStrength: number;
}

/** Packed light list in CSS pixel screen space: x, y, radius, r, g, b, intensity. */
export class LightBuffer {
  public static readonly STRIDE = 7;
  public readonly capacity: number;
  public data: Float32Array;
  public count: number = 0;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.data = new Float32Array(capacity * LightBuffer.STRIDE);
  }

  public clear() {
    this.count = 0;
  }

  public push(x: number, y: number, radius: number, rgb: readonly number[], intensity: number) {
    if (this.count >= this.capacity || intensity <= 0.003 || radius < 2) return;
    const o = this.count * LightBuffer.STRIDE;
    const d = this.data;
    d[o] = x;
    d[o + 1] = y;
    d[o + 2] = radius;
    d[o + 3] = rgb[0];
    d[o + 4] = rgb[1];
    d[o + 5] = rgb[2];
    d[o + 6] = intensity;
    this.count++;
  }
}

const rgbCache = new Map<string, [number, number, number]>();

/** Parses '#rgb', '#rrggbb' or 'rgb(a)(...)' into 0..1 floats (cached). */
export function parseColor(color: string): [number, number, number] {
  let c = rgbCache.get(color);
  if (c) return c;
  c = [1, 1, 1];
  if (color[0] === '#') {
    let hex = color.slice(1);
    if (hex.length === 3) hex = hex.split('').map((h) => h + h).join('');
    const n = parseInt(hex.slice(0, 6), 16);
    if (!Number.isNaN(n)) c = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  } else {
    const m = color.match(/[\d.]+/g);
    if (m && m.length >= 3) c = [Number(m[0]) / 255, Number(m[1]) / 255, Number(m[2]) / 255];
  }
  rgbCache.set(color, c);
  return c;
}

// ---------------------------------------------------------------------------
// Shaders
// ---------------------------------------------------------------------------

const FULLSCREEN_VS = `#version 300 es
layout(location = 0) in vec2 aPos;
uniform float uFlipY;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  if (uFlipY > 0.5) vUv.y = 1.0 - vUv.y;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const LIGHT_VS = `#version 300 es
layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec3 aPosRad;
layout(location = 2) in vec4 aColor;
uniform vec2 uView;
out vec2 vLocal;
out vec4 vColor;
void main() {
  vec2 p = aPosRad.xy + aCorner * aPosRad.z;
  // Image space: row 0 = top of the screen (same convention as the uploaded scene canvas)
  gl_Position = vec4(p / uView * 2.0 - 1.0, 0.0, 1.0);
  vLocal = aCorner;
  vColor = aColor;
}`;

const LIGHT_FS = `#version 300 es
precision mediump float;
in vec2 vLocal;
in vec4 vColor;
out vec4 outColor;
void main() {
  float d2 = dot(vLocal, vLocal);
  if (d2 >= 1.0) discard;
  float f = 1.0 - d2;
  // Soft wide falloff plus a hot core
  float a = f * f + exp(-d2 * 18.0) * 0.6;
  outColor = vec4(vColor.rgb * vColor.a * a, 1.0);
}`;

const BRIGHT_FS = `#version 300 es
precision mediump float;
in vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uTexel;
uniform float uThreshold;
out vec4 outColor;
void main() {
  // 4-tap box downsample, then soft-knee threshold on luminance
  vec3 c = texture(uTex, vUv + uTexel * vec2(-0.5, -0.5)).rgb
         + texture(uTex, vUv + uTexel * vec2( 0.5, -0.5)).rgb
         + texture(uTex, vUv + uTexel * vec2(-0.5,  0.5)).rgb
         + texture(uTex, vUv + uTexel * vec2( 0.5,  0.5)).rgb;
  c *= 0.25;
  float l = max(c.r, max(c.g, c.b));
  float k = smoothstep(uThreshold, uThreshold + 0.35, l);
  outColor = vec4(c * k, 1.0);
}`;

const COPY_FS = `#version 300 es
precision mediump float;
in vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uTexel;
out vec4 outColor;
void main() {
  vec3 c = texture(uTex, vUv + uTexel * vec2(-0.5, -0.5)).rgb
         + texture(uTex, vUv + uTexel * vec2( 0.5, -0.5)).rgb
         + texture(uTex, vUv + uTexel * vec2(-0.5,  0.5)).rgb
         + texture(uTex, vUv + uTexel * vec2( 0.5,  0.5)).rgb;
  outColor = vec4(c * 0.25, 1.0);
}`;

const BLUR_FS = `#version 300 es
precision mediump float;
in vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uDir;
out vec4 outColor;
void main() {
  // 9-tap gaussian using 5 linear-filtered fetches
  vec3 c = texture(uTex, vUv).rgb * 0.2270270270;
  c += texture(uTex, vUv + uDir * 1.3846153846).rgb * 0.3162162162;
  c += texture(uTex, vUv - uDir * 1.3846153846).rgb * 0.3162162162;
  c += texture(uTex, vUv + uDir * 3.2307692308).rgb * 0.0702702703;
  c += texture(uTex, vUv - uDir * 3.2307692308).rgb * 0.0702702703;
  outColor = vec4(c, 1.0);
}`;

const NEBULA_FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 6; i++) { v += a * noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
void main() {
  vec2 p = vUv * 5.0;
  // Domain warping gives the wispy, flowing nebula look
  vec2 q = vec2(fbm(p), fbm(p + 5.2));
  float n = fbm(p + 3.0 * q);
  float m = fbm(p * 0.6 + q * 2.0 + 9.0);
  vec3 deep = vec3(0.012, 0.016, 0.045);
  vec3 violet = vec3(0.20, 0.05, 0.34);
  vec3 cyan = vec3(0.02, 0.20, 0.32);
  vec3 rose = vec3(0.30, 0.03, 0.14);
  vec3 col = deep;
  col = mix(col, violet, smoothstep(0.35, 0.85, n) * 0.85);
  col = mix(col, cyan, smoothstep(0.45, 0.9, m) * 0.7);
  col = mix(col, rose, smoothstep(0.62, 0.95, n * m * 1.6) * 0.6);
  // Dark dust lanes
  col *= 0.55 + 0.6 * smoothstep(0.2, 0.75, fbm(p * 1.7 + q * 3.0));
  outColor = vec4(col, 1.0);
}`;

const COMPOSITE_FS = `#version 300 es
precision mediump float;
in vec2 vUv;
uniform sampler2D uScene;
uniform sampler2D uLight;
uniform sampler2D uBloom1;
uniform sampler2D uBloom2;
uniform sampler2D uNebula;
uniform sampler2D uStars;
uniform vec2 uView;
uniform vec2 uCam;
uniform float uTime;
uniform float uAmbient;
uniform float uDanger;
uniform float uHit;
uniform float uFlash;
uniform vec3 uFlashColor;
uniform float uBloomStrength;
uniform float uWideBloom;
out vec4 outColor;

vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

void main() {
  vec2 uv = vUv;
  vec2 px = uv * uView;

  vec4 scene;
  if (uHit > 0.01) {
    vec2 off = (uv - 0.5) * uHit * 0.014;
    scene = texture(uScene, uv);
    scene.r = texture(uScene, uv + off).r;
    scene.b = texture(uScene, uv - off).b;
  } else {
    scene = texture(uScene, uv);
  }

  // Parallax background (world-anchored, slowly drifting)
  vec2 nebUv = (uCam * 0.12 + px) / 1600.0 + vec2(uTime * 0.0015, 0.0);
  vec3 bg = texture(uNebula, nebUv).rgb;
  vec3 s1 = texture(uStars, (uCam * 0.35 + px) / 1024.0).rgb;
  vec3 s2 = texture(uStars, (uCam * 0.18 + px) / 640.0 + 0.37).rgb;
  float tw = 0.65 + 0.35 * sin(uTime * 2.3 + px.x * 0.05 + px.y * 0.031);
  bg += s1 * tw + s2 * 0.45;

  // Scene is premultiplied: transparent areas reveal the background
  vec3 base = bg * (1.0 - scene.a) + scene.rgb;

  // Soft-saturate stacked lights so crowded fights glow instead of blowing out to white
  vec3 L = texture(uLight, uv).rgb;
  L = L / (1.0 + L * 0.85);
  vec3 col = base * (uAmbient + L * 1.5) + L * 0.06;

  vec3 bloom = texture(uBloom1, uv).rgb * 0.6;
  if (uWideBloom > 0.5) bloom += texture(uBloom2, uv).rgb * 0.8;
  bloom = bloom / (1.0 + bloom * 0.5);
  col += bloom * uBloomStrength;

  // Vignette + low-light danger pulse at the screen edges
  vec2 vd = (uv - 0.5) * vec2(uView.x / uView.y, 1.0);
  float edge = smoothstep(0.35, 1.05, length(vd));
  col *= 1.0 - edge * 0.5;
  col += vec3(0.85, 0.06, 0.22) * uDanger * edge * 1.4;

  col += uFlashColor * uFlash;
  col = aces(col * 1.12);
  outColor = vec4(col, 1.0);
}`;

// ---------------------------------------------------------------------------

interface Target {
  fb: WebGLFramebuffer;
  tex: WebGLTexture;
  w: number;
  h: number;
}

export class PostFX {
  public readonly canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;

  private quadVao: WebGLVertexArrayObject;
  private lightVao: WebGLVertexArrayObject;
  private lightInstanceBuf: WebGLBuffer;

  private progLight: WebGLProgram;
  private progBright: WebGLProgram;
  private progCopy: WebGLProgram;
  private progBlur: WebGLProgram;
  private progComposite: WebGLProgram;
  private uniforms = new Map<WebGLProgram, Map<string, WebGLUniformLocation | null>>();

  private sceneTex: WebGLTexture;
  private nebulaTex: WebGLTexture;
  private starsTex: WebGLTexture;
  private lightRT: Target | null = null;
  private bloomA: Target | null = null;
  private bloomB: Target | null = null;
  private wideA: Target | null = null;
  private wideB: Target | null = null;

  private width = 1;
  private height = 1;
  private viewW = 1;
  private viewH = 1;
  public profile: FxProfile = { lightScale: 0.5, wideBloom: true, bloomStrength: 1 };
  public lost = false;

  /** Returns null when WebGL2 is unavailable (renderer then falls back to plain Canvas2D). */
  public static create(canvas: HTMLCanvasElement): PostFX | null {
    try {
      const gl = canvas.getContext('webgl2', {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        powerPreference: 'high-performance'
      });
      if (!gl) return null;
      return new PostFX(canvas, gl);
    } catch (e) {
      console.warn('PostFX unavailable, using Canvas2D fallback', e);
      return null;
    }
  }

  private constructor(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext) {
    this.canvas = canvas;
    this.gl = gl;

    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.lost = true;
    });

    this.progLight = this.program(LIGHT_VS, LIGHT_FS);
    this.progBright = this.program(FULLSCREEN_VS, BRIGHT_FS);
    this.progCopy = this.program(FULLSCREEN_VS, COPY_FS);
    this.progBlur = this.program(FULLSCREEN_VS, BLUR_FS);
    this.progComposite = this.program(FULLSCREEN_VS, COMPOSITE_FS);

    // Fullscreen triangle-strip quad
    this.quadVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.quadVao);
    const quad = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    // Instanced light quads
    this.lightVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.lightVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.lightInstanceBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lightInstanceBuf);
    const stride = LightBuffer.STRIDE * 4;
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, stride, 12);
    gl.vertexAttribDivisor(2, 1);
    gl.bindVertexArray(null);

    this.sceneTex = this.texture(gl.LINEAR, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);

    this.nebulaTex = this.generateNebula();
    this.starsTex = this.generateStars();
  }

  // ----- setup helpers -----

  private program(vsSrc: string, fsSrc: string): WebGLProgram {
    const gl = this.gl;
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader error');
      return s;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vsSrc));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fsSrc));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link error');
    this.uniforms.set(p, new Map());
    return p;
  }

  private u(p: WebGLProgram, name: string): WebGLUniformLocation | null {
    const m = this.uniforms.get(p)!;
    if (!m.has(name)) m.set(name, this.gl.getUniformLocation(p, name));
    return m.get(name)!;
  }

  private texture(filter: number, wrap: number): WebGLTexture {
    const gl = this.gl;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    return t;
  }

  private target(w: number, h: number, old: Target | null): Target {
    const gl = this.gl;
    w = Math.max(1, Math.round(w));
    h = Math.max(1, Math.round(h));
    if (old && old.w === w && old.h === h) return old;
    if (old) {
      gl.deleteFramebuffer(old.fb);
      gl.deleteTexture(old.tex);
    }
    const tex = this.texture(gl.LINEAR, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const fb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fb, tex, w, h };
  }

  /** Renders the procedural nebula once into a mirrored-repeat texture. */
  private generateNebula(): WebGLTexture {
    const gl = this.gl;
    const size = 1024;
    const prog = this.program(FULLSCREEN_VS, NEBULA_FS);
    const rt = this.target(size, size, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, rt.fb);
    gl.viewport(0, 0, size, size);
    gl.useProgram(prog);
    gl.uniform1f(this.u(prog, 'uFlipY'), 0);
    gl.bindVertexArray(this.quadVao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(rt.fb);
    gl.bindTexture(gl.TEXTURE_2D, rt.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
    return rt.tex;
  }

  /** Random star field with soft halos, tileable (stars wrap around the edges). */
  private generateStars(): WebGLTexture {
    const gl = this.gl;
    const size = 1024;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const g = c.getContext('2d')!;
    g.fillStyle = '#000';
    g.fillRect(0, 0, size, size);
    const palette = ['#ffffff', '#bae6fd', '#c7d2fe', '#fbcfe8', '#fde68a'];
    for (let i = 0; i < 420; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const big = Math.random() < 0.08;
      const r = big ? 1.4 + Math.random() * 1.2 : 0.5 + Math.random() * 0.8;
      const color = palette[Math.floor(Math.random() * palette.length)];
      for (const ox of [-size, 0, size]) {
        for (const oy of [-size, 0, size]) {
          const px = x + ox;
          const py = y + oy;
          if (px < -12 || px > size + 12 || py < -12 || py > size + 12) continue;
          if (big) {
            const halo = g.createRadialGradient(px, py, 0, px, py, r * 6);
            halo.addColorStop(0, color);
            halo.addColorStop(1, 'rgba(0,0,0,0)');
            g.globalAlpha = 0.35;
            g.fillStyle = halo;
            g.fillRect(px - r * 6, py - r * 6, r * 12, r * 12);
          }
          g.globalAlpha = 0.35 + Math.random() * 0.65;
          g.fillStyle = color;
          g.beginPath();
          g.arc(px, py, r, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    const t = this.texture(gl.LINEAR, gl.REPEAT);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    return t;
  }

  // ----- per-frame -----

  public resize(pixelW: number, pixelH: number, viewW: number, viewH: number) {
    this.width = Math.max(1, pixelW);
    this.height = Math.max(1, pixelH);
    this.viewW = viewW;
    this.viewH = viewH;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.canvas.style.width = `${viewW}px`;
    this.canvas.style.height = `${viewH}px`;
    this.allocTargets();
  }

  public setProfile(p: FxProfile) {
    this.profile = p;
    this.allocTargets();
  }

  private allocTargets() {
    const w = this.width;
    const h = this.height;
    const ls = this.profile.lightScale;
    this.lightRT = this.target(w * ls, h * ls, this.lightRT);
    this.bloomA = this.target(w / 4, h / 4, this.bloomA);
    this.bloomB = this.target(w / 4, h / 4, this.bloomB);
    this.wideA = this.target(w / 8, h / 8, this.wideA);
    this.wideB = this.target(w / 8, h / 8, this.wideB);
  }

  private drawQuad() {
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
  }

  private blur(src: Target, tmp: Target) {
    const gl = this.gl;
    const p = this.progBlur;
    gl.useProgram(p);
    gl.uniform1f(this.u(p, 'uFlipY'), 0);
    gl.uniform1i(this.u(p, 'uTex'), 0);
    gl.activeTexture(gl.TEXTURE0);

    gl.bindFramebuffer(gl.FRAMEBUFFER, tmp.fb);
    gl.viewport(0, 0, tmp.w, tmp.h);
    gl.bindTexture(gl.TEXTURE_2D, src.tex);
    gl.uniform2f(this.u(p, 'uDir'), 1 / src.w, 0);
    this.drawQuad();

    gl.bindFramebuffer(gl.FRAMEBUFFER, src.fb);
    gl.viewport(0, 0, src.w, src.h);
    gl.bindTexture(gl.TEXTURE_2D, tmp.tex);
    gl.uniform2f(this.u(p, 'uDir'), 0, 1 / src.h);
    this.drawQuad();
  }

  public render(scene: HTMLCanvasElement, lights: LightBuffer, f: FxFrameParams) {
    if (this.lost || !this.lightRT || !this.bloomA || !this.bloomB || !this.wideA || !this.wideB) return;
    const gl = this.gl;
    gl.disable(gl.DEPTH_TEST);
    gl.bindVertexArray(this.quadVao);

    // 1. Upload the 2D scene (GPU-to-GPU copy for accelerated canvases)
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sceneTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, scene);

    // 2. Light map: additive instanced quads
    const lr = this.lightRT;
    gl.bindFramebuffer(gl.FRAMEBUFFER, lr.fb);
    gl.viewport(0, 0, lr.w, lr.h);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (lights.count > 0) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.useProgram(this.progLight);
      gl.uniform2f(this.u(this.progLight, 'uView'), this.viewW, this.viewH);
      gl.bindVertexArray(this.lightVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.lightInstanceBuf);
      gl.bufferData(gl.ARRAY_BUFFER, lights.data.subarray(0, lights.count * LightBuffer.STRIDE), gl.STREAM_DRAW);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, lights.count);
      gl.disable(gl.BLEND);
      gl.bindVertexArray(this.quadVao);
    }

    // 3. Bloom: bright pass at 1/4, blur; optional wide level at 1/8
    const bA = this.bloomA;
    gl.useProgram(this.progBright);
    gl.uniform1f(this.u(this.progBright, 'uFlipY'), 0);
    gl.uniform1i(this.u(this.progBright, 'uTex'), 0);
    gl.uniform2f(this.u(this.progBright, 'uTexel'), 1 / this.width, 1 / this.height);
    gl.uniform1f(this.u(this.progBright, 'uThreshold'), 0.62);
    gl.bindFramebuffer(gl.FRAMEBUFFER, bA.fb);
    gl.viewport(0, 0, bA.w, bA.h);
    gl.bindTexture(gl.TEXTURE_2D, this.sceneTex);
    this.drawQuad();
    this.blur(bA, this.bloomB);

    if (this.profile.wideBloom) {
      const wA = this.wideA;
      gl.useProgram(this.progCopy);
      gl.uniform1f(this.u(this.progCopy, 'uFlipY'), 0);
      gl.uniform1i(this.u(this.progCopy, 'uTex'), 0);
      gl.uniform2f(this.u(this.progCopy, 'uTexel'), 1 / bA.w, 1 / bA.h);
      gl.bindFramebuffer(gl.FRAMEBUFFER, wA.fb);
      gl.viewport(0, 0, wA.w, wA.h);
      gl.bindTexture(gl.TEXTURE_2D, bA.tex);
      this.drawQuad();
      this.blur(wA, this.wideB);
      this.blur(wA, this.wideB);
    }

    // 4. Composite to screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.width, this.height);
    const p = this.progComposite;
    gl.useProgram(p);
    gl.uniform1f(this.u(p, 'uFlipY'), 1);
    const bind = (unit: number, tex: WebGLTexture, name: string) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(this.u(p, name), unit);
    };
    bind(0, this.sceneTex, 'uScene');
    bind(1, lr.tex, 'uLight');
    bind(2, bA.tex, 'uBloom1');
    bind(3, this.wideA.tex, 'uBloom2');
    bind(4, this.nebulaTex, 'uNebula');
    bind(5, this.starsTex, 'uStars');
    gl.uniform2f(this.u(p, 'uView'), this.viewW, this.viewH);
    gl.uniform2f(this.u(p, 'uCam'), f.camX, f.camY);
    gl.uniform1f(this.u(p, 'uTime'), f.time);
    gl.uniform1f(this.u(p, 'uAmbient'), f.ambient);
    gl.uniform1f(this.u(p, 'uDanger'), f.danger);
    gl.uniform1f(this.u(p, 'uHit'), f.hit);
    gl.uniform1f(this.u(p, 'uFlash'), f.flash);
    gl.uniform3f(this.u(p, 'uFlashColor'), f.flashColor[0], f.flashColor[1], f.flashColor[2]);
    gl.uniform1f(this.u(p, 'uBloomStrength'), this.profile.bloomStrength);
    gl.uniform1f(this.u(p, 'uWideBloom'), this.profile.wideBloom ? 1 : 0);
    this.drawQuad();
    gl.activeTexture(gl.TEXTURE0);
  }
}
