#ifdef GL_ES
precision highp float;
precision highp int;
#endif

#define PI 3.14159265359
const float PHI = 1.61803398874989484820459;
const float SEED = 43758.0;

uniform float u_time;
uniform vec2  u_resolution;
uniform sampler2D img;
uniform float u_t;
uniform float u_colorFreq;
uniform float u_dir;
uniform float u_tex;
uniform float u_grid;
uniform float u_clear;
uniform float u_chro;
uniform float u_speed;
uniform float u_bri;

uniform vec3 u_col1;
uniform vec3 u_col2;
uniform vec3 u_col3;
uniform vec3 u_col4;

// ---------------------------------------------------------
// 2D Simplex Noise (Ashima / Ian McEwan style), -1..1
// ---------------------------------------------------------
vec3 mod289(vec3 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}
vec2 mod289(vec2 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}
vec3 permute(vec3 x) {
    return mod289(((x * 34.0) + 1.0) * x);
}
float snoise2D(vec2 v) {
    const vec4 C = vec4(
        0.211324865405187, // (3.0-sqrt(3.0))/6.0
        0.366025403784439, // 0.5*(sqrt(3.0)-1.0)
        -0.577350269189626,// -1.0 + 2.0*C.x
        0.024390243902439 // 1.0/41.0
    );
    // First corner
    vec2 i  = floor(v + dot(v, vec2(C.y, C.y)));
    vec2 x0 = v - i + dot(i, vec2(C.x, C.x));

    // Other corners
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec2 x1 = x0 - i1 + vec2(C.x, C.x);
    vec2 x2 = x0 - 1.0 + vec2(C.z, C.z);

    // Permutations
    i = mod289(i);
    vec3 p = permute(
        permute(vec3(i.y + 0.0, i.y + i1.y, i.y + 1.0))
        + vec3(i.x + 0.0, i.x + i1.x, i.x + 1.0)
    );

    vec3 m = max(
        0.5 - vec3(dot(x0,x0), dot(x1,x1), dot(x2,x2)), 
        0.0
    );
    m = m*m;
    m = m*m;

    vec3 x = 2.0 * fract(p * C.w) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;

    m *= 1.792843 - 0.853734 * (a0*a0 + h*h);

    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.y = a0.y * x1.x + h.y * x1.y;
    g.z = a0.z * x2.x + h.z * x2.y;
    return 130.0 * dot(m, g);
}

// ---------------------------------------------------------
// noise() wraps snoise2D() to [0..1]
// ---------------------------------------------------------
float noise(vec2 st) {
    float n = snoise2D(st);
    return n * 0.5 + 0.5; // shift from -1..1 to 0..1
}

// ---------------------------------------------------------
// random, fbm, colorGradient, computeDisplacement, main
// (same as your code, calling the new noise())
// ---------------------------------------------------------

float rand(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

float fbm(vec2 st) {
    float value = 0.0;
    float amplitude = 0.8;
    vec2 shift = vec2(10.0);
    for(int i = 0; i < 10; i++) {
        value += amplitude * noise(st);
        st = st * 2.0 + shift;
        amplitude *= 0.6;
    }
    return value;
}

vec3 colorGradient(float t) {
    if(t < 0.33) return mix(u_col1, u_col2, t * 3.0);
    else if(t < 0.66) return mix(u_col2, u_col3, (t - 0.33)*3.0);
    else return mix(u_col3, u_col4, (t - 0.66)*3.0);
}

vec2 computeDisplacement(vec2 uv, float time) {
    float noiseScale = 500.0;
    float noiseSpeed = 0.1 * (u_dir * -1.0);
    float displacementStrength = 0.0005;

    float n = fbm(uv * noiseScale + time * noiseSpeed);
    float angle = n * PI * 2.0;

    return vec2(cos(angle), sin(angle)) * displacementStrength;
}

void main() {
    float safeTime       = clamp(u_time,        0.0, 999999.0);
    float safeT          = clamp(u_t,           0.0, 1.0);
    float safeColorFreq  = clamp(u_colorFreq,   0.0, 100.0);
    float safeDir        = clamp(u_dir,        -10.0, 10.0);
    float safeTex        = clamp(u_tex,         1.0, 2.0);
    float safeGrid       = clamp(u_grid,        0.0, 100.0);
    float safeClear      = clamp(u_clear,       0.0, 100.0);
    float safeChro       = clamp(u_chro,        0.0, 1.0);
    float safeSpeed      = clamp(u_speed,      -10.0, 10.0);
    float safeBri        = clamp(u_bri,        -1.0,  1.0);

    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    vec2 displacement = computeDisplacement(uv, safeTime);
    vec2 displacedUV = uv + displacement;

    // Sorting
    vec2 sortedUV = displacedUV;
    float sortValue = rand(displacedUV);
    if (safeT < 0.5) {
        sortedUV.y = mix(displacedUV.y, sortValue, 0.04);
    } else {
        sortedUV.x = mix(displacedUV.x, sortValue, 0.04);
    }

    float grain = fbm(sortedUV * safeClear);
    float distortion = noise(
        vec2(sortedUV.x, sortedUV.x)*5.0 - (safeTime*safeSpeed)*safeDir
    );
    sortedUV.x += distortion * 0.05;

    float blendFactor = noise(vec2(uv.x, uv.y)*safeGrid);

    float finalPattern;
    if (abs(safeTex - 1.0) < 0.5) {
        finalPattern = mix(grain, distortion, 0.5*(blendFactor*safeColorFreq));
    } else {
        finalPattern = mix(grain, distortion, 0.5/(blendFactor*safeColorFreq));
    }

    vec3 baseColor = colorGradient(finalPattern);
    vec3 c = baseColor;

    // Feedback
    vec3 prevColor = texture2D(img, uv).rgb;
    vec3 frameDifference = c - prevColor;
    vec2 motionVector = frameDifference.rg * 0.1;
    vec2 moshUV = mod(uv + motionVector, 1.0);
    vec3 moshColor = texture2D(img, moshUV).rgb;

    float feedbackAmount = 0.9;
    c = mix(c, moshColor, feedbackAmount);
    c = clamp(c, 0.0, 1.0);

    float nweFloat = 0.02;
    float randomOffset = rand(sortedUV)*nweFloat;

    c += texture2D(img, sortedUV - randomOffset).rgb * nweFloat;
    c -= texture2D(img, vec2(sortedUV.x, sortedUV.y)*sortedUV).rgb * nweFloat;
    c = clamp(c, 0.0, 1.0);

    // Chromatic aberration
    float offset = 1.0 / min(u_resolution.x, u_resolution.y);
    vec2 aberrationOffset = vec2(0.002, 0.0);

    float r = texture2D(img, uv - offset + aberrationOffset).r;
    float g = texture2D(img, uv - offset).g;
    float b = texture2D(img, uv - offset - aberrationOffset).b;
    vec3 chro = vec3(r,g,b);

    c = mix(c, chro, safeChro);
    c = clamp(c, 0.0, 1.0);

    c += vec3(safeBri);
    c = clamp(c, 0.0, 1.0);

    gl_FragColor = vec4(c, 1.0);
}
