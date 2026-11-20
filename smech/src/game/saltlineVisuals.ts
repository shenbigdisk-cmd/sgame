import * as THREE from 'three';

// ---------------------------------------------------------------------------
// 1. Procedural Noise Texture (256x256 tileable noise for FBM & grain)
// ---------------------------------------------------------------------------
let cachedNoiseTex: THREE.DataTexture | null = null;

export function getNoiseTexture(): THREE.DataTexture {
  if (cachedNoiseTex) return cachedNoiseTex;
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  let seed = 2654435769;
  const rand = () => {
    seed ^= seed << 13;
    seed >>>= 0;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    seed >>>= 0;
    return (seed >>> 0) / 4294967296;
  };

  for (let i = 0; i < size * size; i++) {
    data[i * 4] = Math.floor(rand() * 256);
    data[i * 4 + 1] = Math.floor(rand() * 256);
    data[i * 4 + 2] = Math.floor(rand() * 256);
    data[i * 4 + 3] = 255;
  }

  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  cachedNoiseTex = tex;
  return tex;
}

// ---------------------------------------------------------------------------
// 2. Volumetric Storm Cloud Skybox (Adapted from Saltline SALTLINE_SKY)
// ---------------------------------------------------------------------------
const SKY_VERT = `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
  gl_Position = p.xyww;
}
`;

const SKY_NOISE_GLSL = `
uniform sampler2D tNoise;
float n2(vec2 p){
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return texture2D(tNoise, (i + f + 0.5) / 256.0).r;
}
float fbm5(vec2 p){
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 5; i++){
    s += a * n2(p);
    p = mat2(1.6, 1.2, -1.2, 1.6) * p + 17.3;
    a *= 0.5;
  }
  return s / 0.96875;
}
float fbm3(vec2 p){
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 3; i++){
    s += a * n2(p);
    p = mat2(1.6, 1.2, -1.2, 1.6) * p + 17.3;
    a *= 0.5;
  }
  return s / 0.875;
}
`;

const SKY_FRAG = `
precision highp float;
varying vec3 vDir;
uniform float uTime, uEnv, uFlash;
uniform vec3 uFlashDir;
uniform vec3 uSunDir, uZen, uHor, uHorAway, uSunCol;

${SKY_NOISE_GLSL}

float skyToSun(vec3 d){
  return clamp(dot(normalize(d.xz + vec2(1e-5)), normalize(uSunDir.xz)) * 0.5 + 0.5, 0.0, 1.0);
}

vec3 horizonColor(vec3 d){
  float ts = skyToSun(d);
  vec3 c = mix(uHorAway, uHorAway * 1.25 + vec3(0.05, 0.03, 0.02), smoothstep(0.2, 0.75, ts));
  c = mix(c, uHor * vec3(1.9, 1.55, 1.2), pow(ts, 6.0));
  c = mix(c, vec3(1.0, 0.60, 0.24) * 3.4, pow(ts, 34.0));
  return c;
}

void main(){
  vec3 d = normalize(vDir);
  float h = max(d.y, 0.0);
  float mu = dot(d, uSunDir);
  float s = max(mu, 0.0);
  float ts = skyToSun(d);

  // ---- clear sky behind / below the deck ----
  vec3 hc = horizonColor(d);
  vec3 midC = mix(uZen * 0.85, vec3(0.72, 0.50, 0.34), pow(ts, 3.0));
  vec3 clearC = mix(hc, midC, smoothstep(0.0, 0.17, h));
  clearC = mix(clearC, uZen, smoothstep(0.10, 0.55, h));
  
  // Mie aureole around the sun
  clearC += uSunCol * vec3(1.0, 0.86, 0.68) * (pow(s, 8.0) * 0.14 + pow(s, 64.0) * 0.55 + pow(s, 600.0) * 2.2 + pow(s, 6000.0) * 14.0);

  // ---- cloud deck ----
  vec2 cuv = d.xz / (h + 0.10) * vec2(0.62, 0.95);
  vec2 wind = vec2(-0.012, 0.004) * uTime;
  vec2 q = cuv + wind;
  float warp = fbm3(q * 0.45 + 7.1);
  vec2 qq = q + (warp - 0.5) * 1.3;
  float dens = fbm5(qq);
  
  // rippled underside (ridged detail)
  float ridg = 1.0 - abs(2.0 * fbm3(qq * 3.1 + 5.0) - 1.0);
  dens = dens * 0.86 + (ridg - 0.6) * 0.16 * smoothstep(0.03, 0.25, h);
  float big = n2(q * 0.19 + 3.7);
  float body = dens * 0.74 + big * 0.36;
  float cov = smoothstep(0.31, 0.50, body);
  
  // burning gap toward the sun
  float edge = mix(0.030, 0.285, pow(ts, 1.7));
  float rag = (n2(q * 0.9 + 11.0) - 0.5) * 0.16 + (dens - 0.5) * 0.10;
  float deck = smoothstep(edge - 0.035, edge + 0.11, h + rag * (0.35 + ts));
  cov *= deck;
  
  // sun hole
  float hole = smoothstep(0.972, 0.9985, mu + (dens - 0.5) * 0.012);
  cov *= 1.0 - 0.93 * hole;
  
  // thin drifting scud
  float scud = smoothstep(0.55, 0.85, fbm3(q * vec2(0.55, 1.9) + 31.0)) * (1.0 - deck) * smoothstep(0.02, 0.10, h) * 0.55 * (1.0 - 0.8 * hole);

  // self shadowing of the cloud relief
  vec2 sd = normalize(uSunDir.xz);
  float densS = fbm5(qq + sd * 0.22);
  float relief = clamp((dens - densS) * 4.5 + 0.5, 0.0, 1.0);
  float thick = smoothstep(0.40, 0.72, body);
  vec3 cool = mix(vec3(0.155, 0.195, 0.255), vec3(0.030, 0.042, 0.064), thick);
  cool *= 0.55 + 0.9 * relief * relief;
  cool += vec3(0.07, 0.10, 0.15) * pow(1.0 - thick, 3.0);
  
  // warm light raking the cloud underside
  float nearSun = pow(ts, 5.0) * exp(-max(h - edge, 0.0) * 4.5) * 0.9 + pow(s, 7.0) * 0.9;
  vec3 warm = (uHor * vec3(1.30, 0.66, 0.40)) * nearSun * (0.05 + 2.2 * relief * relief * relief) * 1.15;
  
  // burning rim
  float rim = cov * (1.0 - cov) * 4.0;
  warm += uSunCol * rim * pow(ts, 4.0) * (0.5 + 1.6 * pow(s, 6.0)) * (1.0 - 0.85 * hole);
  vec3 cloudC = cool + warm;
  
  // sheet lightning inside storm clouds
  float fl = uFlash * pow(max(dot(d, uFlashDir), 0.0), 5.0);
  cloudC += vec3(0.65, 0.80, 1.0) * fl * (0.5 + 2.5 * dens * dens);
  
  // aerial perspective
  cloudC = mix(cloudC, hc * 0.55 + cloudC * 0.45, exp(-h * 11.0));

  vec3 col = mix(clearC, cloudC, cov * 0.985);
  vec3 scudC = mix(vec3(0.10, 0.11, 0.14), uHor * 1.5, pow(ts, 3.0)) + uSunCol * pow(s, 24.0) * 2.0;
  col = mix(col, scudC, scud);

  // sun disk
  float veil = (1.0 - cov * 0.92) * (1.0 - scud * 0.7);
  float disk = smoothstep(0.999905, 0.999955, mu);
  col += vec3(1.0, 0.80, 0.52) * disk * 110.0 * veil * (1.0 - uEnv);

  // below the horizon
  if (d.y < 0.0) {
    float t = clamp(-d.y * 5.0, 0.0, 1.0);
    vec3 low = mix(uHorAway * 0.42, vec3(0.060, 0.064, 0.070), uEnv);
    low += uHor * 0.55 * pow(ts, 6.0) * exp(d.y * 7.0);
    col = mix(hc + uSunCol * pow(s, 48.0) * 1.5, low, smoothstep(0.0, 1.0, t));
  }
  
  col = mix(col, min(col, vec3(6.0)), uEnv);
  gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
}
`;

export interface SaltlineSkyController {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  update: (dt: number) => void;
  setTheme: (sunDir: THREE.Vector3, sunColor: THREE.Color, skyTop: THREE.Color, skyHorizon: THREE.Color) => void;
  getFlashIntensity: () => number;
  getFlashDirection: () => THREE.Vector3;
}

export function createSaltlineSky(
  sunDir: THREE.Vector3,
  sunColor: THREE.Color,
  skyTop: THREE.Color,
  skyHorizon: THREE.Color
): SaltlineSkyController {
  const noise = getNoiseTexture();
  const uniforms = {
    tNoise: { value: noise },
    uTime: { value: 0 },
    uEnv: { value: 0 },
    uFlash: { value: 0 },
    uFlashDir: { value: new THREE.Vector3(-0.5, 0.5, -0.7).normalize() },
    uSunDir: { value: sunDir.clone().normalize() },
    uZen: { value: skyTop.clone() },
    uHor: { value: skyHorizon.clone() },
    uHorAway: { value: new THREE.Color(skyHorizon.r * 0.6, skyHorizon.g * 0.65, skyHorizon.b * 0.8) },
    uSunCol: { value: sunColor.clone() },
  };

  const mat = new THREE.ShaderMaterial({
    name: 'saltline-sky',
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: true,
    fog: false,
    toneMapped: false,
    uniforms,
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
  });

  const geo = new THREE.BoxGeometry(2, 2, 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'saltline-sky';
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;

  let time = 0;
  let flashTimer = 0;
  let nextFlash = 4 + Math.random() * 8;

  const update = (dt: number) => {
    time += dt;
    uniforms.uTime.value = time;

    flashTimer += dt;
    if (flashTimer > nextFlash) {
      flashTimer = 0;
      nextFlash = 3 + Math.random() * 10;
      uniforms.uFlash.value = 1.0;
      uniforms.uFlashDir.value.set(
        (Math.random() - 0.5) * 2,
        0.3 + Math.random() * 0.7,
        (Math.random() - 0.5) * 2
      ).normalize();
    } else if (uniforms.uFlash.value > 0.01) {
      uniforms.uFlash.value *= Math.max(0, 1 - dt * 9.0);
    } else {
      uniforms.uFlash.value = 0;
    }
  };

  const setTheme = (sDir: THREE.Vector3, sColor: THREE.Color, top: THREE.Color, hor: THREE.Color) => {
    uniforms.uSunDir.value.copy(sDir).normalize();
    uniforms.uSunCol.value.copy(sColor);
    uniforms.uZen.value.copy(top);
    uniforms.uHor.value.copy(hor);
    uniforms.uHorAway.value.set(hor.r * 0.6, hor.g * 0.65, hor.b * 0.8);
  };

  const getFlashIntensity = () => uniforms.uFlash.value;
  const getFlashDirection = () => uniforms.uFlashDir.value;

  return { mesh, material: mat, update, setTheme, getFlashIntensity, getFlashDirection };
}

// ---------------------------------------------------------------------------
// 3. PCSS Soft Shadows & Dynamic Shadow Frustum (Adapted from Saltline Gy & qy)
// ---------------------------------------------------------------------------
let pcssInstalled = false;

export function fitDirectionalLightShadow(
  light: THREE.DirectionalLight,
  sunDir: THREE.Vector3,
  center: THREE.Vector3,
  radius = 48,
  lightDistance = 160
): { width: number; height: number; depth: number } {
  const normSun = sunDir.clone().normalize();
  const targetPos = new THREE.Vector3(center.x, 0, center.z);
  light.target.position.copy(targetPos);
  light.position.copy(targetPos).addScaledVector(normSun, lightDistance);
  light.updateMatrixWorld(true);
  light.target.updateMatrixWorld(true);

  // Compute world-to-light view matrix
  const lightView = new THREE.Matrix4().lookAt(
    light.position,
    targetPos,
    new THREE.Vector3(0, 1, 0)
  );
  lightView.setPosition(light.position);
  lightView.invert();

  // Active receiver volume around player
  const rMin = new THREE.Vector3(center.x - radius, -2, center.z - radius);
  const rMax = new THREE.Vector3(center.x + radius, 28, center.z + radius);
  // Caster margin extending back along sun
  const cMin = new THREE.Vector3(center.x - radius - 12, -2, center.z - radius - 12);
  const cMax = new THREE.Vector3(center.x + radius + 12, 45, center.z + radius + 12);

  const pt = new THREE.Vector3();
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  const projectBox = (bMin: THREE.Vector3, bMax: THREE.Vector3, zOnly: boolean) => {
    for (let i = 0; i < 8; i++) {
      pt.set(
        i & 1 ? bMax.x : bMin.x,
        i & 2 ? bMax.y : bMin.y,
        i & 4 ? bMax.z : bMin.z
      ).applyMatrix4(lightView);

      if (!zOnly) {
        minX = Math.min(minX, pt.x);
        maxX = Math.max(maxX, pt.x);
        minY = Math.min(minY, pt.y);
        maxY = Math.max(maxY, pt.y);
      }
      minZ = Math.min(minZ, -pt.z);
      maxZ = Math.max(maxZ, -pt.z);
    }
  };

  projectBox(rMin, rMax, false);
  projectBox(cMin, cMax, true);

  const cam = light.shadow.camera;
  const pad = 2.0;
  cam.left = minX - pad;
  cam.right = maxX + pad;
  cam.bottom = minY - pad;
  cam.top = maxY + pad;
  cam.near = Math.max(1, minZ - 4);
  cam.far = maxZ + 12;
  cam.updateProjectionMatrix();

  return {
    width: cam.right - cam.left,
    height: cam.top - cam.bottom,
    depth: cam.far - cam.near,
  };
}

export function enablePCSSShadows(
  _frustumWidth = 280,
  _frustumHeight = 280,
  _frustumDepth = 490,
  _taps = 16,
  _searchTaps = 8
) {
  if (pcssInstalled) return;

  const originalChunk = THREE.ShaderChunk.shadowmap_pars_fragment;
  const pcfBlockStart = originalChunk.indexOf('#if defined( SHADOWMAP_TYPE_PCF )');
  const getShadowStart = pcfBlockStart >= 0 ? originalChunk.indexOf('float getShadow( sampler2DShadow', pcfBlockStart) : -1;
  const getShadowEnd = getShadowStart >= 0 ? originalChunk.indexOf('\n\t#elif', getShadowStart) : -1;

  if (getShadowStart >= 0 && getShadowEnd > getShadowStart) {
    const pcssCode = `float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
		float shadow = 1.0;
		shadowCoord.xyz /= shadowCoord.w;
		#ifdef USE_REVERSED_DEPTH_BUFFER
			shadowCoord.z -= shadowBias;
		#else
			shadowCoord.z += shadowBias;
		#endif
		bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
		bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
		if ( frustumTest ) {
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			vec2 radius = shadowRadius * texelSize * 1.6;
			float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
			float accum = 0.0;
			for ( int i = 0; i < 16; i ++ ) {
				accum += texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( i, 16, phi ) * radius, shadowCoord.z ) );
			}
			shadow = accum / 16.0;
		}
		return mix( 1.0, shadow, shadowIntensity );
	}`;

    THREE.ShaderChunk.shadowmap_pars_fragment =
      originalChunk.slice(0, getShadowStart) + pcssCode + originalChunk.slice(getShadowEnd);
    pcssInstalled = true;
  }
}

// ---------------------------------------------------------------------------
// 4. AgX Filmic Tone Mapping + FXAA + Color Grade Pass
// ---------------------------------------------------------------------------
export const AGX_GRADE_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uDamage: { value: 0 },
    uLowHealth: { value: 0 },
    uVignette: { value: 0.38 },
    uSaturation: { value: 1.05 },
    uSharpen: { value: 0.28 },
    uFxaa: { value: 1.0 },
    uFlash: { value: 0 },
    uExposure: { value: 1.25 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 uResolution;
    uniform float uTime, uDamage, uLowHealth, uVignette, uSaturation, uSharpen, uFxaa, uFlash, uExposure;
    varying vec2 vUv;

    const mat3 SL_REC2020_TO_SRGB = mat3(
      vec3(1.6605, -0.1246, -0.0182),
      vec3(-0.5876, 1.1329, -0.1006),
      vec3(-0.0728, -0.0083, 1.1187)
    );
    const mat3 SL_SRGB_TO_REC2020 = mat3(
      vec3(0.6274, 0.0691, 0.0164),
      vec3(0.3293, 0.9195, 0.0880),
      vec3(0.0433, 0.0113, 0.8956)
    );

    vec3 slAgxContrast(vec3 x) {
      vec3 x2 = x * x;
      vec3 x4 = x2 * x2;
      return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
    }

    vec3 slAgx(vec3 color) {
      const mat3 inset = mat3(
        vec3(0.8566, 0.1373, 0.1119),
        vec3(0.0951, 0.7612, 0.0768),
        vec3(0.0483, 0.1014, 0.8113)
      );
      const mat3 outset = mat3(
        vec3(1.1271, -0.1413, -0.1413),
        vec3(-0.1106, 1.1578, -0.1106),
        vec3(-0.0165, -0.0165, 1.2519)
      );
      const float minEv = -12.47393, maxEv = 4.026069;
      color = inset * (SL_SRGB_TO_REC2020 * color);
      color = clamp((log2(max(color, 1e-10)) - minEv) / (maxEv - minEv), 0.0, 1.0);
      color = slAgxContrast(color);

      // Punchy look
      float l = dot(color, vec3(0.2126, 0.7152, 0.0722));
      color = pow(max(color, vec3(0.0)), vec3(1.08));
      color = l + (color - l) * 1.15;
      color = outset * color;
      color = pow(max(color, vec3(0.0)), vec3(2.2));
      return clamp(SL_REC2020_TO_SRGB * color, 0.0, 1.0);
    }

    vec3 toSRGB(vec3 c) {
      return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
    }

    float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

    void main() {
      vec2 texel = 1.0 / uResolution;
      vec4 center = texture2D(tDiffuse, vUv);
      vec3 col = center.rgb * uExposure;

      // FXAA anti-aliasing
      if (uFxaa > 0.5) {
        vec3 rgbNW = texture2D(tDiffuse, vUv + vec2(-1.0, -1.0) * texel).rgb;
        vec3 rgbNE = texture2D(tDiffuse, vUv + vec2(1.0, -1.0) * texel).rgb;
        vec3 rgbSW = texture2D(tDiffuse, vUv + vec2(-1.0, 1.0) * texel).rgb;
        vec3 rgbSE = texture2D(tDiffuse, vUv + vec2(1.0, 1.0) * texel).rgb;
        float lM = luma(col);
        float lNW = luma(rgbNW), lNE = luma(rgbNE), lSW = luma(rgbSW), lSE = luma(rgbSE);
        float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));
        float lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
        float range = lMax - lMin;
        if (range > max(0.0312, lMax * 0.125)) {
          vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), (lNW + lSW) - (lNE + lSE));
          float dirReduce = max((lNW + lNE + lSW + lSE) * 0.03125, 0.0078125);
          float rcp = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
          dir = clamp(dir * rcp, vec2(-8.0), vec2(8.0)) * texel;
          vec3 rgbA = 0.5 * (texture2D(tDiffuse, vUv + dir * (1.0/3.0 - 0.5)).rgb + texture2D(tDiffuse, vUv + dir * (2.0/3.0 - 0.5)).rgb);
          vec3 rgbB = rgbA * 0.5 + 0.25 * (texture2D(tDiffuse, vUv - dir * 0.5).rgb + texture2D(tDiffuse, vUv + dir * 0.5).rgb);
          float lB = luma(rgbB);
          col = (lB < lMin || lB > lMax) ? rgbA : rgbB;
        }
      }

      // Unsharp mask
      if (uSharpen > 0.01) {
        vec3 blur = (
          texture2D(tDiffuse, vUv + vec2(-1.0, 0.0) * texel).rgb +
          texture2D(tDiffuse, vUv + vec2(1.0, 0.0) * texel).rgb +
          texture2D(tDiffuse, vUv + vec2(0.0, -1.0) * texel).rgb +
          texture2D(tDiffuse, vUv + vec2(0.0, 1.0) * texel).rgb
        ) * 0.25;
        col += (col - blur) * uSharpen;
      }

      // AgX Filmic Tone Mapping
      col = slAgx(max(col, vec3(0.0)));

      // Cinematic split tone
      float l = luma(col);
      vec3 shadowTint = vec3(0.85, 1.00, 1.10);
      vec3 highTint = vec3(1.06, 1.00, 0.92);
      col *= mix(shadowTint, highTint, smoothstep(0.05, 0.65, l));

      // S-curve contrast & lifted blacks
      col = mix(col, col * col * (3.0 - 2.0 * col), 0.20);
      col = col * 0.985 + vec3(0.006, 0.008, 0.012);

      // Saturation
      float sat = uSaturation * (1.0 - 0.5 * uLowHealth) * (1.0 - 0.35 * uDamage);
      l = luma(col);
      col = mix(vec3(l), col, sat);

      // Atmospheric lightning storm flash (from Saltline SALTLINE_POST)
      if (uFlash > 0.005) {
        vec3 flashTint = vec3(0.55, 0.72, 1.0) * (0.35 + l * 0.65);
        col = mix(col, col + flashTint * 0.55, clamp(uFlash, 0.0, 1.0));
      }

      // Vignette
      vec2 uvNorm = (vUv - 0.5) * 2.0;
      float r2 = dot(uvNorm, uvNorm);
      float vig = uVignette + uLowHealth * 0.45;
      float vr = smoothstep(0.2, 1.3, r2);
      col *= 1.0 - vig * vr * vr;

      // Damage pulse on screen borders
      if (uDamage > 0.01 || uLowHealth > 0.01) {
        float edge = smoothstep(0.3, 1.1, r2);
        vec3 redFlash = vec3(0.65, 0.04, 0.02) * (0.4 + l);
        float pulse = clamp(uDamage * edge * 0.8 + uLowHealth * edge * 0.3 * (0.8 + 0.2 * sin(uTime * 6.0)), 0.0, 1.0);
        col = mix(col, redFlash, pulse);
      }

      // Subtle organic film dithering to prevent color banding
      float dither = (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
      col += dither * 1.5;

      // Output sRGB display transform (matching Saltline toSRGB)
      col = toSRGB(clamp(col, 0.0, 1.0));

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

// ---------------------------------------------------------------------------
// 5. Procedural Wet Asphalt & PBR Ground Enhancer
// ---------------------------------------------------------------------------
export function enhanceGroundMaterial(material: THREE.Material): void {
  const noise = getNoiseTexture();

  material.onBeforeCompile = (shader) => {
    material.userData.shader = shader;
    shader.uniforms.tNoise = { value: noise };
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uWetness = { value: 0.65 };

    shader.vertexShader = `
      varying vec3 vWorldPos;
      ${shader.vertexShader}
    `.replace(
      '#include <begin_vertex>',
      `
      #include <begin_vertex>
      vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
      `
    );

    shader.fragmentShader = `
      varying vec3 vWorldPos;
      uniform sampler2D tNoise;
      uniform float uTime;
      uniform float uWetness;

      float gNoise(vec2 p) {
        return texture2D(tNoise, p / 256.0).r;
      }
      float gFbm(vec2 p) {
        float a = 0.5, s = 0.0;
        for (int i = 0; i < 3; i++) {
          s += a * gNoise(p);
          p = mat2(1.6, 1.2, -1.2, 1.6) * p;
          a *= 0.5;
        }
        return s / 0.875;
      }

      ${shader.fragmentShader}
    `.replace(
      '#include <map_fragment>',
      `
      #include <map_fragment>
      vec2 gxz = vWorldPos.xz;
      
      // 6m expansion slabs & tar seams
      vec2 sj = gxz / 6.0;
      vec2 sf = (0.5 - abs(fract(sj) - 0.5)) * 6.0;
      float jd = min(sf.x, sf.y);
      float tar = 1.0 - smoothstep(0.02, 0.07, jd);

      // Puddle mask from low-frequency noise
      float puddleNoise = gFbm(gxz * 0.12 + 5.0);
      float puddle = smoothstep(0.48, 0.68, puddleNoise) * uWetness;

      // Aggregate grain
      float grain = gNoise(gxz * 3.5);

      // Asphalt darkening and tar seams
      diffuseColor.rgb *= mix(1.0, 0.65, uWetness * 0.5); // wet ground is darker
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.025, 0.025, 0.03), tar * 0.85); // dark tar sealant

      // Painted industrial demarcation markings with sub-centimetre procedural chipping (Saltline chipN)
      vec2 mGrid = fract(gxz / 12.0) * 12.0;
      float lineX = smoothstep(0.07, 0.0, abs(mGrid.x - 6.0));
      float lineZ = smoothstep(0.07, 0.0, abs(mGrid.y - 6.0));
      float mark = max(lineX, lineZ);
      if (mark > 0.01) {
        float chipN = gNoise(gxz * 19.0) * 0.55 + gNoise(gxz * 64.0) * 0.35 + gNoise(gxz * 170.0) * 0.10;
        float paintKeep = smoothstep(0.42, 0.64, chipN) * (1.0 - tar * 0.9);
        vec3 markColor = vec3(0.88, 0.74, 0.32); // weathered signal amber
        diffuseColor.rgb = mix(diffuseColor.rgb, markColor, mark * paintKeep * 0.75);
      }

      // Oil slicks with diesel rainbow iridescence (Saltline fuel/oil layer)
      float oilN = gFbm(gxz * 0.18 + vec2(17.3, 31.7));
      float oil = smoothstep(0.66, 0.82, oilN) * (1.0 - puddle * 0.6);
      if (oil > 0.02) {
        vec3 irid = vec3(
          0.5 + 0.5 * sin(oilN * 32.0),
          0.5 + 0.5 * sin(oilN * 32.0 + 2.1),
          0.5 + 0.5 * sin(oilN * 32.0 + 4.2)
        );
        diffuseColor.rgb = mix(diffuseColor.rgb * 0.42, diffuseColor.rgb * 0.28 + irid * 0.16, oil * 0.75);
      }
      `
    ).replace(
      '#include <roughnessmap_fragment>',
      `
      #include <roughnessmap_fragment>
      // Roughness modulation: dry aggregate ~0.85 -> soaked ~0.35 -> puddle ~0.045
      float baseR = mix(roughnessFactor, 0.35, uWetness * 0.7);
      roughnessFactor = mix(baseR + (grain - 0.5) * 0.12, 0.045, max(puddle, oil * 0.9));
      roughnessFactor = clamp(roughnessFactor, 0.035, 1.0);
      `
    ).replace(
      '#include <normal_fragment_maps>',
      `
      #include <normal_fragment_maps>
      // Rain ripples on puddles
      if (puddle > 0.05) {
        vec2 ripUV = gxz * 2.2 + vec2(sin(uTime * 2.5 + gxz.y * 3.0), cos(uTime * 2.8 + gxz.x * 3.0)) * 0.15;
        float rip = sin(ripUV.x * 12.0) * cos(ripUV.y * 12.0) * 0.06 * puddle;
        normal = normalize(normal + vec3(rip, 0.0, rip));
      }
      `
    );
  };
}

// ---------------------------------------------------------------------------
// 6. Procedural Paint Damage & Weathering for Obstacles (Saltline paintDmg model)
// ---------------------------------------------------------------------------
export function enhanceObstacleMaterial(
  material: THREE.Material,
  options: { wearAmount?: number; rustAmount?: number } = {}
): void {
  const noise = getNoiseTexture();
  const wearAmount = options.wearAmount ?? 0.55;
  const rustAmount = options.rustAmount ?? 0.65;

  material.onBeforeCompile = (shader) => {
    material.userData.shader = shader;
    shader.uniforms.tNoise = { value: noise };
    shader.uniforms.uWear = { value: wearAmount };
    shader.uniforms.uRust = { value: rustAmount };

    shader.vertexShader = `
      varying vec3 vObstacleWorldPos;
      varying vec3 vObstacleWorldNormal;
      ${shader.vertexShader}
    `.replace(
      '#include <begin_vertex>',
      `
      #include <begin_vertex>
      vObstacleWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
      vObstacleWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
      `
    );

    shader.fragmentShader = `
      varying vec3 vObstacleWorldPos;
      varying vec3 vObstacleWorldNormal;
      uniform sampler2D tNoise;
      uniform float uWear;
      uniform float uRust;

      float oNoise(vec2 p) {
        return texture2D(tNoise, p / 256.0).r;
      }
      float oFbm(vec2 p) {
        float a = 0.5, s = 0.0;
        for (int i = 0; i < 3; i++) {
          s += a * oNoise(p);
          p = mat2(1.6, 1.2, -1.2, 1.6) * p;
          a *= 0.5;
        }
        return s / 0.875;
      }

      ${shader.fragmentShader}
    `.replace(
      '#include <map_fragment>',
      `
      #include <map_fragment>
      vec3 wp = vObstacleWorldPos;
      vec3 wn = normalize(vObstacleWorldNormal);
      vec2 puv = abs(wn.y) > 0.5 ? wp.xz : (abs(wn.x) > 0.5 ? wp.zy : wp.xy);

      // Procedural paint chipping (Saltline chipsF & paintDmg)
      float wearPattern = oFbm(puv * 0.22 + vec2(14.3, 8.7));
      float fineFlakes = oNoise(puv * 4.2) * 0.6 + oNoise(puv * 14.0) * 0.4;
      float chip = smoothstep(0.72 - uWear * 0.16, 0.77, wearPattern * 0.6 + fineFlakes * 0.4);

      // Dark substrate metal exposed under chipped paint
      vec3 bareMetal = vec3(0.08, 0.085, 0.095);
      diffuseColor.rgb = mix(diffuseColor.rgb, bareMetal, chip * 0.94);

      // Rust halo around chipped areas
      float rustZone = smoothstep(0.56 - uRust * 0.14, 0.68, wearPattern * 0.6 + fineFlakes * 0.4) * (1.0 - chip);
      vec3 rustColor = vec3(0.42, 0.18, 0.07);
      diffuseColor.rgb = mix(diffuseColor.rgb, rustColor, rustZone * 0.72);

      // Vertical rust water streaks running down vertical faces (-Y is gravity)
      if (abs(wn.y) < 0.45) {
        float streakNoise = oNoise(vec2(wp.x + wp.z, wp.y * 0.08)) * oNoise(vec2((wp.x + wp.z) * 3.5, wp.y * 0.03));
        float washout = smoothstep(0.52, 0.76, streakNoise) * rustZone;
        diffuseColor.rgb = mix(diffuseColor.rgb, rustColor * 0.75, washout * 0.6);
      }
      `
    ).replace(
      '#include <roughnessmap_fragment>',
      `
      #include <roughnessmap_fragment>
      // Roughness modulation: bare substrate and rust are coarse and matte
      roughnessFactor = mix(roughnessFactor, 0.92, max(chip * 0.85, rustZone * 0.75));
      `
    );
  };
}

// ---------------------------------------------------------------------------
// 7. Brushed Metal & Scratched Armor Normal Map
// ---------------------------------------------------------------------------
let cachedMetalNormal: THREE.DataTexture | null = null;

export function getBrushedMetalNormalTexture(): THREE.DataTexture {
  if (cachedMetalNormal) return cachedMetalNormal;
  const size = 256;
  const data = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      // brushed streaks in X + high-frequency micro scratches
      const streak = Math.sin(y * 1.2) * 0.18 + (Math.random() - 0.5) * 0.28;
      const nx = streak;
      const ny = (Math.random() - 0.5) * 0.12;
      const nz = 1.0;
      const len = Math.hypot(nx, ny, nz);
      data[idx] = Math.floor(((nx / len) * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.floor(((ny / len) * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.floor(((nz / len) * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  cachedMetalNormal = tex;
  return tex;
}

// ---------------------------------------------------------------------------
// 7. Image-Based Lighting: HDR Environment Map from Saltline Sky
// ---------------------------------------------------------------------------
export function generateEnvironmentMap(
  renderer: THREE.WebGLRenderer,
  skyController: SaltlineSkyController
): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const skyMatClone = skyController.material.clone();
  skyMatClone.uniforms.tNoise.value = skyController.material.uniforms.tNoise.value;
  skyMatClone.uniforms.uEnv.value = 1.0; // omit sun disk so directional light handles direct sun

  const envScene = new THREE.Scene();
  const envSky = new THREE.Mesh(skyController.mesh.geometry, skyMatClone);
  envSky.frustumCulled = false;
  envScene.add(envSky);

  const envRenderTarget = pmrem.fromScene(envScene, 0.04, 0.1, 100);
  skyMatClone.dispose();
  pmrem.dispose();

  return envRenderTarget.texture;
}

// ---------------------------------------------------------------------------
// 8. Beveled Geometry Helper (eliminates sharp 90-degree CGI edges)
// ---------------------------------------------------------------------------
export function createBeveledBox(
  w: number,
  h: number,
  d: number,
  radius = 0.012
): THREE.BufferGeometry {
  const bevel = Math.min(radius, Math.min(w, Math.min(h, d)) * 0.25);
  const shape = new THREE.Shape();
  const hw = Math.max(0.001, w / 2 - bevel);
  const hh = Math.max(0.001, h / 2 - bevel);

  shape.moveTo(-hw, -hh - bevel);
  shape.lineTo(hw, -hh - bevel);
  shape.quadraticCurveTo(hw + bevel, -hh - bevel, hw + bevel, -hh);
  shape.lineTo(hw + bevel, hh);
  shape.quadraticCurveTo(hw + bevel, hh + bevel, hw, hh + bevel);
  shape.lineTo(-hw, hh + bevel);
  shape.quadraticCurveTo(-hw - bevel, hh + bevel, -hw - bevel, hh);
  shape.lineTo(-hw - bevel, -hh);
  shape.quadraticCurveTo(-hw - bevel, -hh - bevel, -hw, -hh - bevel);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.001, d - bevel * 2),
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
  });
  geo.center();
  return geo;
}
