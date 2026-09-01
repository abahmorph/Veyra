/**
 * Minimal WebGL2 fullscreen-quad renderer used by the effects engine.
 * We upload the 2D composite canvas as a texture and run a fragment shader
 * over it, drawing the result onto the display canvas. Using WebGL2 (rather
 * than CPU per-pixel work) keeps effects GPU-accelerated where available.
 */
export class ShaderRenderer {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private texture: WebGLTexture | null = null;
  private canvas: HTMLCanvasElement;
  private width = 0;
  private height = 0;
  private lastEffect = '';

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      powerPreference: 'high-performance',
    });
    if (!gl) {
      throw new Error('WebGL2 is not available on this device. GPU acceleration is disabled.');
    }
    this.gl = gl;
    this.initQuad();
  }

  static isSupported(): boolean {
    try {
      const c = document.createElement('canvas');
      return !!c.getContext('webgl2');
    } catch {
      return false;
    }
  }

  static describe(): { backend: 'webgl2' | 'software'; renderer: string; vendor: string } {
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') as WebGL2RenderingContext | null;
      if (gl) {
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        return {
          backend: 'webgl2',
          renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string : gl.getParameter(gl.RENDERER) as string,
          vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) as string : '',
        };
      }
    } catch {
      /* ignore */
    }
    return { backend: 'software', renderer: 'unknown', vendor: 'unknown' };
  }

  private initQuad(): void {
    const gl = this.gl;
    const vs = `
      #version 300 es
      layout(location = 0) in vec2 aPos;
      out vec2 vUv;
      void main() {
        vUv = aPos * 0.5 + 0.5;
        gl_Position = vec4(aPos, 0.0, 1.0);
      }
    `;
    this.program = this.createProgram(vs, this.getFragment());
    gl.useProgram(this.program);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  setFragment(shaderId: string, shaderSource: string): void {
    if (shaderId === this.lastEffect) return;
    const gl = this.gl;
    const program = this.createProgram(this.getVertex(), shaderSource);
    if (this.program) gl.deleteProgram(this.program);
    this.program = program;
    this.lastEffect = shaderId;
  }

  private getVertex(): string {
    return `
      #version 300 es
      layout(location = 0) in vec2 aPos;
      out vec2 vUv;
      void main() {
        vUv = aPos * 0.5 + 0.5;
        gl_Position = vec4(aPos, 0.0, 1.0);
      }
    `;
  }

  private getFragment(): string {
    return `
      #version 300 es
      precision highp float;
      uniform sampler2D uTex;
      in vec2 vUv;
      out vec4 outColor;
      void main() { outColor = texture(uTex, vUv); }
    `;
  }

  private createProgram(vsSrc: string, fsSrc: string): WebGLProgram {
    const gl = this.gl;
    const compile = (type: number, src: string): WebGLShader => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        throw new Error(`Shader compile error: ${gl.getShaderInfoLog(sh)}`);
      }
      return sh;
    };
    const vs = compile(gl.VERTEX_SHADER, vsSrc);
    const fs = compile(gl.FRAGMENT_SHADER, fsSrc);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(`Program link error: ${gl.getProgramInfoLog(prog)}`);
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return prog;
  }

  /**
   * Upload the 2D source canvas as a texture, render the effect shader,
   * and draw the GL canvas onto the destination 2D canvas.
   */
  render(source: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement, uniforms?: Record<string, number>): void {
    const gl = this.gl;
    const srcW = source instanceof HTMLVideoElement ? source.videoWidth : (source as HTMLCanvasElement).width;
    const srcH = source instanceof HTMLVideoElement ? source.videoHeight : (source as HTMLCanvasElement).height;
    if (srcW !== this.width || srcH !== this.height) {
      this.width = srcW;
      this.height = srcH;
      this.canvas.width = srcW;
      this.canvas.height = srcH;
      gl.viewport(0, 0, srcW, srcH);
    }
    if (!this.program) return;

    gl.useProgram(this.program);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(gl.getUniformLocation(this.program, 'uTex'), 0);

    if (uniforms) {
      const uTime = gl.getUniformLocation(this.program, 'uTime');
      const uRes = gl.getUniformLocation(this.program, 'uResolution');
      const uMix = gl.getUniformLocation(this.program, 'uMix');
      if (uTime) gl.uniform1f(uTime, uniforms.uTime ?? 0);
      if (uRes) gl.uniform2f(uRes, this.width, this.height);
      if (uMix) gl.uniform1f(uMix, uniforms.uMix ?? 1);
    }

    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
