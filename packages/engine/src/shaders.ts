/**
 * GLSL fragment shaders for GPU-accelerated effects.
 * Each shader receives uTex (input frame), vUv, uTime, uResolution, uMix.
 */

const HEADER = `
  #version 300 es
  precision highp float;
  uniform sampler2D uTex;
  uniform float uTime;
  uniform vec2 uResolution;
  uniform float uMix;
  in vec2 vUv;
  out vec4 outColor;
`;

const HELPERS = `
  vec4 sampleAt(vec2 uv) { return texture(uTex, clamp(uv, 0.0, 1.0)); }
  float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
  vec3 saturate(vec3 c, float f) {
    float l = luma(c);
    return mix(vec3(l), c, f);
  }
  // cheap 9-tap box blur
  vec4 boxBlur(vec2 uv, vec2 px) {
    vec4 acc = vec4(0.0);
    acc += sampleAt(uv + vec2(-1, -1) * px);
    acc += sampleAt(uv + vec2(0, -1) * px);
    acc += sampleAt(uv + vec2(1, -1) * px);
    acc += sampleAt(uv + vec2(-1, 0) * px);
    acc += sampleAt(uv + vec2(0, 0) * px);
    acc += sampleAt(uv + vec2(1, 0) * px);
    acc += sampleAt(uv + vec2(-1, 1) * px);
    acc += sampleAt(uv + vec2(0, 1) * px);
    acc += sampleAt(uv + vec2(1, 1) * px);
    return acc / 9.0;
  }
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
`;

function wrap(body: string): string {
  return `${HEADER}\n${HELPERS}\nvoid main() {\n${body}\n}\n`;
}

export const SHADERS: Record<string, string> = {
  none: wrap('outColor = sampleAt(vUv);'),

  beauty: wrap(`
    vec2 px = 1.0 / uResolution;
    vec4 blurred = boxBlur(vUv, px * 1.5);
    vec4 sharp = sampleAt(vUv);
    // soften skin by mixing with blur, then add a gentle sharpen back
    vec3 soft = mix(sharp.rgb, blurred.rgb, 0.35);
    vec3 high = sharp.rgb - blurred.rgb;
    vec3 result = soft + high * 0.35;
    result = saturate(result, 1.15);
    outColor = vec4(result, sharp.a);
  `),

  cartoon: wrap(`
    vec2 px = 1.0 / uResolution;
    vec4 c = sampleAt(vUv);
    // posterize
    float levels = 6.0;
    vec3 q = floor(c.rgb * levels + 0.5) / levels;
    // sobel edge
    float tl = luma(sampleAt(vUv + vec2(-1,-1)*px));
    float tm = luma(sampleAt(vUv + vec2(0,-1)*px));
    float tr = luma(sampleAt(vUv + vec2(1,-1)*px));
    float ml = luma(sampleAt(vUv + vec2(-1,0)*px));
    float mr = luma(sampleAt(vUv + vec2(1,0)*px));
    float bl = luma(sampleAt(vUv + vec2(-1,1)*px));
    float bm = luma(sampleAt(vUv + vec2(0,1)*px));
    float br = luma(sampleAt(vUv + vec2(1,1)*px));
    float gx = -tl - 2.0*tm - tr + bl + 2.0*bm + br;
    float gy = -tl - 2.0*ml - bl + tr + 2.0*mr + br;
    float edge = clamp(sqrt(gx*gx + gy*gy) * 3.0, 0.0, 1.0);
    vec3 col = q * (1.0 - edge * 0.75);
    col = saturate(col, 1.25);
    outColor = vec4(col, c.a);
  `),

  anime: wrap(`
    vec2 px = 1.0 / uResolution;
    vec4 c = sampleAt(vUv);
    float levels = 4.0;
    vec3 q = floor(c.rgb * levels + 0.5) / levels;
    vec3 boost = pow(q, vec3(0.9));
    boost = saturate(boost * 1.35, 1.6);
    // edge highlight
    float tl = luma(sampleAt(vUv + vec2(-1,-1)*px));
    float tr = luma(sampleAt(vUv + vec2(1,-1)*px));
    float bl = luma(sampleAt(vUv + vec2(-1,1)*px));
    float br = luma(sampleAt(vUv + vec2(1,1)*px));
    float edge = clamp(abs(tl - br) * 4.0, 0.0, 1.0);
    boost *= 1.0 - edge * 0.55;
    outColor = vec4(boost, c.a);
  `),

  cyberpunk: wrap(`
    vec4 c = sampleAt(vUv);
    float l = luma(c.rgb);
    vec3 cyan = vec3(0.0, 1.0, 0.9);
    vec3 magenta = vec3(1.0, 0.05, 0.6);
    vec3 graded = mix(magenta, cyan, clamp(l, 0.0, 1.0));
    graded = mix(c.rgb, graded, 0.55);
    // scanlines
    float scan = 0.85 + 0.15 * sin(vUv.y * uResolution.y * 1.2);
    // subtle flicker glow
    graded *= scan;
    vec2 uv = vUv;
    graded += cyan * (1.0 - step(0.985, hash(floor(uv * uResolution / 2.0) + uTime)));
    outColor = vec4(graded, c.a);
  `),

  fantasy: wrap(`
    vec4 c = sampleAt(vUv);
    vec3 warm = vec3(1.02, 0.94, 1.15);
    vec3 result = c.rgb * warm;
    result = saturate(result, 1.2);
    // fairy twinkle
    vec2 cell = floor(vUv * uResolution / 24.0);
    float tw = step(0.93, hash(cell + floor(uTime * 3.0)));
    result += vec3(1.0, 0.9, 1.0) * tw * 0.12;
    // soft vignette
    float d = distance(vUv, vec2(0.5));
    result *= 1.0 - smoothstep(0.55, 0.95, d) * 0.3;
    outColor = vec4(result, c.a);
  `),

  horror: wrap(`
    vec4 c = sampleAt(vUv);
    vec3 result = saturate(c.rgb, 0.25);
    result *= vec3(0.9, 1.0, 1.02);
    // vignette
    float d = distance(vUv, vec2(0.5));
    result *= 1.0 - smoothstep(0.4, 1.0, d) * 0.55;
    // flicker
    float flick = 0.94 + 0.06 * step(0.985, hash(vec2(floor(uTime * 12.0))));
    result *= flick;
    outColor = vec4(result, c.a);
  `),

  pixel: wrap(`
    float cells = 90.0;
    vec2 uv = floor(vUv * cells) / cells;
    vec4 c = sampleAt(uv);
    c.rgb = saturate(c.rgb, 1.4);
    outColor = vec4(c.rgb, 1.0);
  `),

  glitch: wrap(`
    vec4 c = sampleAt(vUv);
    float t = floor(uTime * 18.0);
    vec2 uv = vUv;
    // vertical slice displacement
    float band = step(0.03, hash(vec2(floor(uv.y * 24.0), t)));
    uv.x += (hash(vec2(t, band)) - 0.5) * 0.03 * band;
    vec4 r = sampleAt(uv + vec2(0.012, 0.0));
    vec4 g = sampleAt(uv);
    vec4 b = sampleAt(uv - vec2(0.012, 0.0));
    float m = 0.5 + 0.5 * band;
    vec3 result = mix(vec3(r.r, g.g, b.b), c.rgb, 0.4 + 0.6 * (1.0 - m));
    result = mix(result, c.rgb, 0.25);
    outColor = vec4(result, c.a);
  `),
};

export function shaderFor(id: string): { id: string; source: string } | null {
  const source = SHADERS[id];
  if (!source) return null;
  return { id, source };
}

export function hasShader(id: string): boolean {
  return id in SHADERS;
}
