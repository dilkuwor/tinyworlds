/**
 * glass-gl.js - Realistic renderer for Rain on the Glass (WebGL 2)
 *
 * The RainWorld simulation stays the same; this draws it on the GPU:
 *  - every drop is a real little lens: it shows the city behind it magnified
 *    and upside down, with a specular highlight and a dark refracted rim
 *  - the fogged glass is a smooth Gaussian blur of the view, tinted milky
 *  - drops cast faint shadows on the mist below them
 *  - lightning lights up the whole pane
 * The sill, mug and plant are still drawn on a 2D overlay canvas in front.
 */

const GLASS_VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const GLASS_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;

uniform sampler2D uScene;   // the view outside, half resolution
uniform sampler2D uBlur;    // the view outside, heavily downsampled
uniform sampler2D uFog;     // fog coverage in alpha
uniform sampler2D uWater;   // drops: rg = normal, b = thickness, a = coverage
uniform vec2 uBlurTexel;
uniform vec2 uAspect;       // (w/h, 1) so lens offsets stay round
uniform vec3 uFogColor;
uniform float uFogTint;
uniform float uFlash;

vec3 softView(vec2 uv) {
  vec3 c = vec3(0.0);
  float sum = 0.0;
  for (int x = -2; x <= 2; x++) {
    for (int y = -2; y <= 2; y++) {
      float w = exp(-float(x * x + y * y) / 3.0);
      c += texture(uBlur, uv + vec2(float(x), float(y)) * uBlurTexel * 1.3).rgb * w;
      sum += w;
    }
  }
  return c / sum;
}

void main() {
  vec2 uv = vUv;
  vec4 water = texture(uWater, uv);
  float cover = smoothstep(0.2, 0.65, water.a);
  vec2 n = (water.rg - 0.5) * 2.0;
  n.y = -n.y;                       // the map is drawn y-down, the shader is y-up
  float thick = water.b;

  // Glass between the drops: clear where wiped, misty and blurred where fogged
  float fog = texture(uFog, uv).a;
  vec3 clear = texture(uScene, uv).rgb;
  vec3 soft = softView(uv);
  vec3 misty = mix(soft, uFogColor, uFogTint);
  vec3 glass = mix(clear, misty, fog);

  // A faint shadow on the mist just below each drop
  float above = texture(uWater, uv + vec2(0.0, 0.006)).a;
  glass *= 1.0 - smoothstep(0.25, 0.7, above) * 0.16 * (1.0 - cover);

  // Inside a drop: a wide-angle, upside-down miniature of the whole view
  // (each drop shows the bright street below turned on its head)
  vec2 localUv = uv - n * vec2(0.12 / uAspect.x, 0.12) * (0.55 + thick * 0.45);
  vec2 wideUv = vec2(0.5) - n * vec2(0.42, 0.42) + vec2(0.0, -0.08);
  vec2 lensUv = clamp(mix(localUv, wideUv, 0.55), vec2(0.002), vec2(0.998));
  vec3 lens = texture(uScene, lensUv).rgb;
  lens = mix(lens, softView(lensUv), 0.2) * 1.5;     // a lens gathers light

  // Light on the water surface
  vec3 N = normalize(vec3(n * 1.3, max(0.12, thick)));
  vec3 L = normalize(vec3(-0.35, 0.65, 0.68));
  float spec = pow(max(dot(reflect(-L, N), vec3(0.0, 0.0, 1.0)), 0.0), 36.0);
  float rim = smoothstep(0.6, 1.0, length(n));
  float caustic = smoothstep(0.35, 0.85, -n.y) * (1.0 - rim) * 0.35; // light focused at the bottom
  vec3 drop = lens * (1.0 - rim * 0.35) + spec * 0.9 + caustic * (uFogColor + 0.25) + uFogColor * 0.05;

  vec3 col = mix(glass, drop, cover);
  col += uFlash * vec3(0.82, 0.88, 1.0) * 0.4;
  outColor = vec4(col, 1.0);
}`;

class RainGlassGL {
  /** Returns null when WebGL 2 is unavailable, so callers can fall back. */
  static create(glCanvas, world) {
    const gl = glCanvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false });
    if (!gl) return null;
    try {
      return new RainGlassGL(glCanvas, gl, world);
    } catch (e) {
      console.warn('Realistic rain unavailable, using the classic renderer:', e);
      return null;
    }
  }

  constructor(glCanvas, gl, world) {
    this.canvas = glCanvas;
    this.gl = gl;
    this.world = world;

    const mk = () => { const c = document.createElement('canvas'); return [c, c.getContext('2d')]; };
    [this.scene, this.sceneCtx] = mk();
    [this.blur, this.blurCtx] = mk();
    [this.water, this.waterCtx] = mk();

    this.program = this.buildProgram(GLASS_VERT, GLASS_FRAG);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    const loc = gl.getAttribLocation(this.program, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    this.tex = {};
    ['uScene', 'uBlur', 'uFog', 'uWater'].forEach((name, i) => {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.tex[name] = { t, unit: i };
    });
    this.u = {};
    ['uScene', 'uBlur', 'uFog', 'uWater', 'uBlurTexel', 'uAspect', 'uFogColor', 'uFogTint', 'uFlash'].forEach(n => {
      this.u[n] = gl.getUniformLocation(this.program, n);
    });
  }

  buildProgram(vs, fs) {
    const gl = this.gl;
    const compile = (type, src) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
      return sh;
    };
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }

  resize(w, h, dpr) {
    this.w = w; this.h = h;
    // Render the glass at up to 1.5x for crisp drops without overloading phones
    const q = Math.min(dpr, 1.5);
    this.canvas.width = Math.round(w * q);
    this.canvas.height = Math.round(h * q);
    this.sceneScale = 0.5;
    this.scene.width = Math.max(2, Math.round(w * this.sceneScale));
    this.scene.height = Math.max(2, Math.round(h * this.sceneScale));
    this.blurScale = 0.1;
    this.blur.width = Math.max(2, Math.round(w * this.blurScale));
    this.blur.height = Math.max(2, Math.round(h * this.blurScale));
    this.waterScale = w * h > 1.2e6 ? 0.6 : 0.8;
    this.water.width = Math.max(2, Math.round(w * this.waterScale));
    this.water.height = Math.max(2, Math.round(h * this.waterScale));
  }

  upload(name, source) {
    const gl = this.gl, T = this.tex[name];
    gl.activeTexture(gl.TEXTURE0 + T.unit);
    gl.bindTexture(gl.TEXTURE_2D, T.t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.uniform1i(this.u[name], T.unit);
  }

  render() {
    const gl = this.gl, W = this.world;
    const M = RAIN_MOODS[W.mood];

    // Prepare the layers on small 2D canvases, then hand them to the GPU
    W.drawSceneLayer(this.sceneCtx, this.sceneScale, false);
    W.drawSceneLayer(this.blurCtx, this.blurScale, true);
    W.drawWaterMap(this.waterCtx, this.waterScale);

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    this.upload('uScene', this.scene);
    this.upload('uBlur', this.blur);
    this.upload('uFog', W.fogMask);
    this.upload('uWater', this.water);

    const fc = M.fog.split(',').map(v => parseFloat(v) / 255);
    gl.uniform2f(this.u.uBlurTexel, 1 / this.blur.width, 1 / this.blur.height);
    gl.uniform2f(this.u.uAspect, this.w / this.h, 1);
    gl.uniform3f(this.u.uFogColor, fc[0], fc[1], fc[2]);
    gl.uniform1f(this.u.uFogTint, Math.min(0.6, M.fogTint * 1.25));
    gl.uniform1f(this.u.uFlash, W.flashNow || 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}

window.RainGlassGL = RainGlassGL;
