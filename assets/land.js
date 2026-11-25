/* Champions Retreat: a white relief model of the club's land, drawn with WebGL.
   Elevation: AWS Terrain Tiles (USGS 3DEP). Holes, water, woods, buildings: OpenStreetMap contributors. */
(function () {
  'use strict';
  var D = window.CR_LAND;
  var host = document.getElementById('land');
  var noop = { select: function () {}, ink: function () {}, overview: function () {}, reset: function () {}, ready: false };
  window.CRLand = noop;
  if (!D || !host) return;

  var canvas = host.querySelector('.land__gl');
  var labelsEl = host.querySelector('.land__labels');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var gl = null;
  try { gl = canvas.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: true }); } catch (e) { gl = null; }
  if (!gl) return;
  var derivs = gl.getExtension('OES_standard_derivatives');
  var aniso = gl.getExtension('EXT_texture_filter_anisotropic') || gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');

  var COL = { Island: '#34657f', Bluff: '#3d6b4b', Creek: '#8a4630' };
  var NINES = ['Island', 'Bluff', 'Creek'];
  var W = D.w, H = D.h, WKM = D.wm / 1000, HKM = D.hm / 1000;
  var EXAG = 4.5, BASE = -0.075, LIFT = 0.006;

  /* heights */
  var raw = atob(D.heights), hbuf = new Uint8Array(raw.length);
  for (var i = 0; i < raw.length; i++) hbuf[i] = raw.charCodeAt(i);
  var hv = new Uint16Array(hbuf.buffer);
  var NV = (W + 1) * (H + 1);
  var elev = new Float32Array(NV);
  for (i = 0; i < NV; i++) elev[i] = D.zbase + hv[i] / 10;
  var zmin = D.zmin;
  function yOf(e) { return (e - zmin) * EXAG / 1000 + LIFT; }
  function gx(i) { return (i / W - 0.5) * WKM; }
  function gz(j) { return (j / H - 0.5) * HKM; }
  function elevAt(u, v) { /* u,v in 0..1 */
    var x = Math.max(0, Math.min(W, u * W)), y = Math.max(0, Math.min(H, v * H));
    var i0 = Math.floor(x), j0 = Math.floor(y), i1 = Math.min(W, i0 + 1), j1 = Math.min(H, j0 + 1), fx = x - i0, fy = y - j0;
    var a = elev[j0 * (W + 1) + i0], b = elev[j0 * (W + 1) + i1], c = elev[j1 * (W + 1) + i0], d = elev[j1 * (W + 1) + i1];
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
  }
  function model(u, v) { return [(u - 0.5) * WKM, yOf(elevAt(u, v)), (v - 0.5) * HKM]; }

  /* mesh: surface + skirt walls */
  var pos = [], nrm = [], uv = [], kind = [], ev = [], idx = [];
  var j, k;
  for (j = 0; j <= H; j++) {
    for (i = 0; i <= W; i++) {
      var e = elev[j * (W + 1) + i];
      pos.push(gx(i), yOf(e), gz(j));
      var el = elev[j * (W + 1) + Math.max(0, i - 1)], er = elev[j * (W + 1) + Math.min(W, i + 1)];
      var eu = elev[Math.max(0, j - 1) * (W + 1) + i], ed = elev[Math.min(H, j + 1) * (W + 1) + i];
      var dx = (yOf(er) - yOf(el)) / (2 * WKM / W), dz = (yOf(ed) - yOf(eu)) / (2 * HKM / H);
      var nl = Math.hypot(dx, 1, dz);
      nrm.push(-dx / nl, 1 / nl, -dz / nl);
      uv.push(i / W, j / H); kind.push(0); ev.push(e);
    }
  }
  for (j = 0; j < H; j++) {
    for (i = 0; i < W; i++) {
      var a = j * (W + 1) + i, b = a + 1, c = a + W + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  function wall(list, nx, nz) {
    var start = pos.length / 3;
    for (k = 0; k < list.length; k++) {
      var p = list[k];
      pos.push(p[0], p[1], p[2], p[0], BASE, p[2]);
      nrm.push(nx, 0, nz, nx, 0, nz);
      uv.push(p[3], p[4], p[3], p[4]);
      kind.push(1, 2); ev.push(p[5], p[5]);
    }
    for (k = 0; k < list.length - 1; k++) {
      var t0 = start + k * 2, b0 = t0 + 1, t1 = t0 + 2, b1 = t0 + 3;
      idx.push(t0, b0, t1, t1, b0, b1);
    }
  }
  function edge(fn, n) { var L = []; for (k = 0; k <= n; k++) L.push(fn(k)); return L; }
  function pt(i, j) { var e = elev[j * (W + 1) + i]; return [gx(i), yOf(e), gz(j), i / W, j / H, e]; }
  wall(edge(function (k) { return pt(k, H); }, W), 0, 1);           // south, faces camera
  wall(edge(function (k) { return pt(W - k, 0); }, W), 0, -1);      // north
  wall(edge(function (k) { return pt(0, H - k); }, H), -1, 0);      // west
  wall(edge(function (k) { return pt(W, k); }, H), 1, 0);           // east

  /* shadow plane under the plinth */
  var sp = pos.length / 3, SW = WKM * 0.62, SH = HKM * 0.66;
  [[-SW, -SH], [SW, -SH], [-SW, SH], [SW, SH]].forEach(function (q, n) {
    pos.push(q[0], BASE - 0.001, q[1] + 0.04); nrm.push(0, 1, 0); uv.push(n % 2, n > 1 ? 1 : 0); kind.push(3); ev.push(0);
  });
  var shadowStart = idx.length;
  idx.push(sp, sp + 2, sp + 1, sp + 1, sp + 2, sp + 3);

  function buf(data, T) { var bo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bo); gl.bufferData(gl.ARRAY_BUFFER, new T(data), gl.STATIC_DRAW); return bo; }
  var bPos = buf(pos, Float32Array), bNrm = buf(nrm, Float32Array), bUv = buf(uv, Float32Array), bKind = buf(kind, Float32Array), bEv = buf(ev, Float32Array);
  var bIdx = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bIdx); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);

  /* shaders */
  var VS = [
    'attribute vec3 aPos; attribute vec3 aNrm; attribute vec2 aUv; attribute float aKind; attribute float aEv;',
    'uniform mat4 uMvp; uniform mediump float uRise; uniform float uLift;',
    'varying vec2 vUv; varying vec3 vN; varying float vKind; varying float vEv;',
    'void main(){ vec3 p = aPos;',
    '  if (aKind < 1.5) p.y = uLift + (p.y - uLift) * uRise;',
    '  vUv = aUv; vN = aNrm; vKind = aKind; vEv = aEv;',
    '  gl_Position = uMvp * vec4(p, 1.0); }'
  ].join('\n');
  var FS = [
    derivs ? '#extension GL_OES_standard_derivatives : enable' : '',
    '#ifdef GL_FRAGMENT_PRECISION_HIGH', 'precision highp float;', '#else', 'precision mediump float;', '#endif',
    'uniform sampler2D uA; uniform sampler2D uB; uniform sampler2D uS; uniform float uMix; uniform mediump float uRise; uniform vec3 uL;',
    'varying vec2 vUv; varying vec3 vN; varying float vKind; varying float vEv;',
    'void main(){',
    '  if (vKind > 2.5) { float a = texture2D(uS, vUv).a; gl_FragColor = vec4(0.0, 0.0, 0.0, a * 0.34 * uRise + a * 0.14); return; }',
    '  if (vKind > 0.5) { float d = max(dot(normalize(vN), uL), 0.0); float t = vKind > 1.5 ? 0.0 : 1.0;',
    '    vec3 c = vec3(0.95, 0.945, 0.925) * (0.76 + 0.22 * d) * mix(0.93, 1.0, t); gl_FragColor = vec4(c, 1.0); return; }',
    '  vec3 n = normalize(vec3(vN.x * uRise, vN.y, vN.z * uRise));',
    '  vec3 base = mix(texture2D(uA, vUv).rgb, texture2D(uB, vUv).rgb, uMix);',
    '  float d = max(dot(n, uL), 0.0);',
    '  float sh = 0.58 + 0.5 * d;',
    '  vec3 c = base * sh;',
    derivs ? '  float q = vEv / 2.5; float w = fwidth(q); float ln = 1.0 - smoothstep(0.0, 1.2 * w, abs(fract(q - 0.5) - 0.5)); c *= 1.0 - ln * 0.075 * uRise * step(56.6, vEv);' : '',
    '  gl_FragColor = vec4(c, 1.0); }'
  ].join('\n');
  function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
  var prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (err) { if (window.console) console.warn('Land model unavailable:', err && err.message); return; }
  gl.useProgram(prog);
  function attr(name, b, size) { var loc = gl.getAttribLocation(prog, name); if (loc < 0) return; gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0); }
  attr('aPos', bPos, 3); attr('aNrm', bNrm, 3); attr('aUv', bUv, 2); attr('aKind', bKind, 1); attr('aEv', bEv, 1);
  var U = {}; ['uMvp', 'uRise', 'uLift', 'uA', 'uB', 'uS', 'uMix', 'uL'].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
  var L = [-0.48, 0.8, -0.36], ll = Math.hypot(L[0], L[1], L[2]);
  gl.uniform3f(U.uL, L[0] / ll, L[1] / ll, L[2] / ll);
  gl.uniform1f(U.uLift, LIFT);
  gl.uniform1i(U.uA, 0); gl.uniform1i(U.uB, 1); gl.uniform1i(U.uS, 2);

  /* textures: the painted model */
  var TS = 2048;
  var paint = document.createElement('canvas'); paint.width = TS; paint.height = TS;
  var ctx = paint.getContext('2d');
  var sx = TS / 10000, sy = TS / 10000, mpp = D.wm / TS; /* metres per texel, x */
  function path(p, close) { ctx.moveTo(p[0] * sx, p[1] * sy); for (var n = 2; n < p.length; n += 2) ctx.lineTo(p[n] * sx, p[n + 1] * sy); if (close) ctx.closePath(); }
  function rings(f) { ctx.beginPath(); (f.r || [f.p]).forEach(function (r) { path(r, true); }); }
  function mix(hex, t, toward) {
    var c = parseInt(hex.slice(1), 16), r = c >> 16, g = (c >> 8) & 255, b = c & 255;
    var w = toward || [244, 243, 238];
    return 'rgb(' + Math.round(r + (w[0] - r) * t) + ',' + Math.round(g + (w[1] - g) * t) + ',' + Math.round(b + (w[2] - b) * t) + ')';
  }
  var dots = document.createElement('canvas'); dots.width = dots.height = 9;
  var dc = dots.getContext('2d'); dc.fillStyle = 'rgba(96,112,92,.22)'; dc.beginPath(); dc.arc(2.5, 2.5, 1.15, 0, 6.3); dc.fill(); dc.beginPath(); dc.arc(7, 6.5, 1.0, 0, 6.3); dc.fill();
  var dotPat = ctx.createPattern(dots, 'repeat');
  function riverWidth(r) {
    if (r.n === 'Savannah River') return 95 / mpp;
    if (r.n === 'Little River') return 34 / mpp;
    if (r.w === 'river') return 14 / mpp;
    return 4 / mpp;
  }
  function drawBase() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#f4f3ee'; ctx.fillRect(0, 0, TS, TS);
    D.wood.forEach(function (f) { rings(f); ctx.fillStyle = 'rgba(214,218,206,.55)'; ctx.fill('evenodd'); ctx.fillStyle = dotPat; ctx.fill('evenodd'); });
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    D.road.forEach(function (r) { ctx.beginPath(); path(r.p); ctx.strokeStyle = '#e2e0d8'; ctx.lineWidth = r.w === 'service' ? 3 : 4.5; ctx.stroke(); });
    ctx.fillStyle = '#c3cfd5';
    D.water.forEach(function (f) { rings(f); ctx.fill('evenodd'); });
    D.rivers.forEach(function (r) { ctx.beginPath(); path(r.p); ctx.strokeStyle = '#c3cfd5'; ctx.lineWidth = riverWidth(r); ctx.stroke(); });
    D.building.forEach(function (f) {
      rings(f);
      ctx.save(); ctx.shadowColor = 'rgba(40,40,36,.28)'; ctx.shadowBlur = 2.5; ctx.shadowOffsetX = 1.6; ctx.shadowOffsetY = 1.6;
      ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.restore();
      ctx.strokeStyle = 'rgba(40,40,36,.22)'; ctx.lineWidth = 0.8; ctx.stroke();
    });
  }
  function drawCourse(inked, active, hole, hover) {
    function stateOf(n) { if (!n || !inked[n]) return 'off'; if (active && active !== n) return 'dim'; return 'on'; }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    D.fairway.forEach(function (f) {
      var s = stateOf(f.k); rings(f);
      ctx.fillStyle = s === 'off' ? 'rgba(70,78,66,.13)' : mix(COL[f.k], s === 'on' ? 0.58 : 0.8); ctx.fill('evenodd');
    });
    D.tee.forEach(function (f) { var s = stateOf(f.k); rings(f); ctx.fillStyle = s === 'off' ? 'rgba(60,64,58,.18)' : mix(COL[f.k], s === 'on' ? 0.25 : 0.62); ctx.fill('evenodd'); });
    D.green.forEach(function (f) { var s = stateOf(f.k); rings(f); ctx.fillStyle = s === 'off' ? 'rgba(60,70,58,.32)' : mix(COL[f.k], s === 'on' ? 0.12 : 0.6); ctx.fill('evenodd'); });
    D.bunker.forEach(function (f) { rings(f); ctx.fillStyle = '#fbfaf3'; ctx.fill('evenodd'); ctx.strokeStyle = 'rgba(60,60,50,.28)'; ctx.lineWidth = 0.9; ctx.stroke(); });
    D.holes.forEach(function (h) {
      var s = stateOf(h.n); ctx.beginPath(); path(h.p);
      ctx.strokeStyle = s === 'off' ? 'rgba(34,36,34,.5)' : (s === 'on' ? COL[h.n] : mix(COL[h.n], 0.5));
      ctx.lineWidth = s === 'on' ? 5 : 3.2; ctx.setLineDash(s === 'off' ? [7, 7] : []); ctx.stroke(); ctx.setLineDash([]);
      var gxp = h.p[h.p.length - 2] * sx, gyp = h.p[h.p.length - 1] * sy;
      ctx.beginPath(); ctx.arc(gxp, gyp, s === 'on' ? 7 : 5, 0, 6.3); ctx.fillStyle = s === 'off' ? 'rgba(40,42,40,.4)' : (s === 'on' ? COL[h.n] : mix(COL[h.n], 0.5)); ctx.fill();
    });
    [hover, hole].forEach(function (id, n) {
      if (!id) return;
      var h = D.holes.filter(function (x) { return x.n + ' ' + x.r === id; })[0]; if (!h) return;
      ctx.beginPath(); path(h.p); ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = n ? 10 : 9; ctx.stroke();
      ctx.beginPath(); path(h.p); ctx.strokeStyle = COL[h.n]; ctx.lineWidth = n ? 5 : 4.5; ctx.stroke();
      var a0 = h.p[0] * sx, b0 = h.p[1] * sy, a1 = h.p[h.p.length - 2] * sx, b1 = h.p[h.p.length - 1] * sy;
      ctx.beginPath(); ctx.arc(a0, b0, 5, 0, 6.3); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = COL[h.n]; ctx.stroke();
      ctx.beginPath(); ctx.arc(a1, b1, 7.5, 0, 6.3); ctx.fillStyle = COL[h.n]; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff'; ctx.stroke();
    });
  }
  var baseImg = null;
  function paintState(inked, active, hole, hover) {
    if (!baseImg) { drawBase(); baseImg = ctx.getImageData(0, 0, TS, TS); }
    else ctx.putImageData(baseImg, 0, 0);
    drawCourse(inked, active, hole, hover);
  }
  function makeTex() { var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; }
  function upload(t, src, mip) {
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    if (mip) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT))); }
    else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }
  var texA = makeTex(), texB = makeTex(), texS = makeTex();
  var shadow = document.createElement('canvas'); shadow.width = shadow.height = 256;
  var sc = shadow.getContext('2d'); sc.filter = 'blur(18px)'; sc.fillStyle = '#000'; sc.fillRect(52, 48, 152, 166);
  upload(texS, shadow, false);

  var state = { inked: {}, active: null, hole: null, hover: null, view: null };
  paintState(state.inked, null);
  upload(texA, paint, true); upload(texB, paint, true);

  /* camera */
  var cam = { az: -0.2, el: 0.66, dist: 6, tx: 0, ty: 0.04, tz: 0.08 };
  var home = null, rise = reduce ? 1 : 0, mixT = 0, risen = reduce;
  var fovY = 28 * Math.PI / 180;
  function fitHome() {
    var asp = Math.max(0.5, canvas.clientWidth / Math.max(1, canvas.clientHeight));
    var hf = 2 * Math.atan(Math.tan(fovY / 2) * asp);
    var need = (WKM * 0.7) / Math.tan(hf / 2);
    var needV = (HKM * 0.62) / Math.tan(fovY / 2) * 1.25;
    var dist = Math.max(need, needV * 0.62, 3.2);
    var el = asp < 1.2 ? 0.86 : 0.74;
    return { az: -0.16, el: el, dist: dist, tx: 0, ty: 0.03, tz: asp < 1.2 ? 0.2 : 0.34 };
  }
  var nineView = {};
  NINES.forEach(function (n) {
    var xs = [], zs = [];
    D.holes.forEach(function (h) { if (h.n !== n) return; for (var q = 0; q < h.p.length; q += 2) { xs.push(h.p[q] / 10000); zs.push(h.p[q + 1] / 10000); } });
    var u0 = Math.min.apply(0, xs), u1 = Math.max.apply(0, xs), v0 = Math.min.apply(0, zs), v1 = Math.max.apply(0, zs);
    var cu = (u0 + u1) / 2, cv = (v0 + v1) / 2, c = model(cu, cv);
    var ext = Math.max((u1 - u0) * WKM, (v1 - v0) * HKM * 1.5);
    nineView[n] = { cu: cu, cv: cv, tx: c[0], ty: c[1] * 0.5, tz: c[2] + 0.06, ext: ext };
  });
  var AZ = { Island: 0.3, Bluff: -0.06, Creek: -0.42 };
  function viewFor(n) {
    var v = nineView[n], asp = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    var hf = 2 * Math.atan(Math.tan(fovY / 2) * asp);
    var dist = Math.max((v.ext * 0.62) / Math.tan(hf / 2), (v.ext * 0.5) / Math.tan(fovY / 2), 1.5);
    return { az: AZ[n], el: 0.78, dist: dist, tx: v.tx, ty: v.ty, tz: v.tz };
  }

  /* holes in model space, sampled for picking */
  var HOLES = D.holes.map(function (h) {
    var pts = [], len = 0;
    for (var q = 0; q < h.p.length - 2; q += 2) {
      var u0 = h.p[q] / 10000, v0 = h.p[q + 1] / 10000, u1 = h.p[q + 2] / 10000, v1 = h.p[q + 3] / 10000;
      var segm = Math.hypot((u1 - u0) * WKM, (v1 - v0) * HKM), n = Math.max(1, Math.ceil(segm / 0.03));
      for (var t = 0; t < n; t++) pts.push(model(u0 + (u1 - u0) * t / n, v0 + (v1 - v0) * t / n));
      len += segm;
    }
    pts.push(model(h.p[h.p.length - 2] / 10000, h.p[h.p.length - 1] / 10000));
    return { id: h.n + ' ' + h.r, n: h.n, r: h.r, pts: pts, len: len };
  });
  function holeById(id) { return HOLES.filter(function (h) { return h.id === id; })[0]; }
  function viewHole(h) {
    var tee = h.pts[0], green = h.pts[h.pts.length - 1];
    var dx = tee[0] - green[0], dz = tee[2] - green[2], l = Math.hypot(dx, dz) || 1;
    var cx = tee[0] + (green[0] - tee[0]) * 0.58, cz = tee[2] + (green[2] - tee[2]) * 0.58;
    var cy = (tee[1] + green[1]) / 2;
    var asp = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    return { az: Math.atan2(dx / l, dz / l), el: 0.5, dist: Math.max(1.05, h.len * (asp < 1.2 ? 2.4 : 1.8) + 0.6), tx: cx, ty: cy, tz: cz };
  }

  /* matrices */
  function persp(f, a, n, fa) { var t = 1 / Math.tan(f / 2), r = 1 / (n - fa); return [t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) * r, -1, 0, 0, 2 * fa * n * r, 0]; }
  function look(e, c, up) {
    var z0 = e[0] - c[0], z1 = e[1] - c[1], z2 = e[2] - c[2], l = Math.hypot(z0, z1, z2); z0 /= l; z1 /= l; z2 /= l;
    var x0 = up[1] * z2 - up[2] * z1, x1 = up[2] * z0 - up[0] * z2, x2 = up[0] * z1 - up[1] * z0; l = Math.hypot(x0, x1, x2); x0 /= l; x1 /= l; x2 /= l;
    var y0 = z1 * x2 - z2 * x1, y1 = z2 * x0 - z0 * x2, y2 = z0 * x1 - z1 * x0;
    return [x0, y0, z0, 0, x1, y1, z1, 0, x2, y2, z2, 0, -(x0 * e[0] + x1 * e[1] + x2 * e[2]), -(y0 * e[0] + y1 * e[1] + y2 * e[2]), -(z0 * e[0] + z1 * e[1] + z2 * e[2]), 1];
  }
  function mul(a, b) { var o = new Array(16); for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) { var s = 0; for (var q = 0; q < 4; q++) s += a[q * 4 + r] * b[c * 4 + q]; o[c * 4 + r] = s; } return o; }
  var mvp = null;

  /* labels */
  function riverAnchor(name, t) {
    var best = null;
    D.rivers.forEach(function (r) {
      if (r.n !== name) return;
      var inside = [];
      for (var q = 0; q < r.p.length; q += 2) if (r.p[q] > 400 && r.p[q] < 9600 && r.p[q + 1] > 400 && r.p[q + 1] < 9600) inside.push([r.p[q], r.p[q + 1]]);
      if (!best || inside.length > best.length) best = inside;
    });
    if (!best || !best.length) return null;
    var p = best[Math.floor(best.length * t)];
    return { u: p[0] / 10000, v: p[1] / 10000 };
  }
  var labels = [];
  function addLabel(text, cls, u, v, lift, style) {
    if (u == null) return;
    var s = document.createElement('span'); s.className = cls; s.textContent = text;
    if (style) s.setAttribute('style', style);
    labelsEl.appendChild(s);
    var p = model(u, v); labels.push({ el: s, p: [p[0], p[1] + (lift || 0.03), p[2]], w: 0, h: 0 });
    return labels[labels.length - 1];
  }
  var sav = riverAnchor('Savannah River', 0.32), lit = riverAnchor('Little River', 0.5);
  if (sav) addLabel('Savannah River', 'lb-river', sav.u, sav.v, 0.02);
  if (lit) addLabel('Little River', 'lb-river', lit.u, lit.v, 0.02);
  addLabel('Clubhouse', 'lb-club', D.club[0] / 10000, D.club[1] / 10000, 0.03);
  var nineLabel = {};
  NINES.forEach(function (n) {
    var v = nineView[n];
    nineLabel[n] = addLabel(n, 'lb-nine is-gone', v.cu, v.cv - 0.05, 0.12, '--c:' + COL[n]);
  });
  var holeLabel = (function () {
    var s = document.createElement('span'); s.className = 'lb-hole is-gone'; labelsEl.appendChild(s);
    var l = { el: s, p: [0, 0, 0], w: 0, h: 0 }; labels.push(l); return l;
  })();
  function showHoleLabel(id) {
    var h = id && holeById(id);
    if (!h) { holeLabel.el.classList.add('is-gone'); return; }
    var g = h.pts[h.pts.length - 1];
    holeLabel.p = [g[0], g[1] + 0.035, g[2]];
    holeLabel.el.textContent = h.n + ' ' + h.r;
    holeLabel.el.style.setProperty('--c', COL[h.n]);
    holeLabel.w = 0; holeLabel.el.classList.remove('is-gone'); dirty = true; kick();
  }
  function project(p) {
    var m = mvp, cw = canvas.clientWidth, ch = canvas.clientHeight;
    var x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
    return [(x / w * 0.5 + 0.5) * cw, (1 - (y / w * 0.5 + 0.5)) * ch, w];
  }
  function pickHole(px, py) {
    if (!mvp) return null;
    var best = null, bd = 16;
    HOLES.forEach(function (h) {
      if (!state.inked[h.n]) return;
      var prev = null;
      h.pts.forEach(function (p) {
        var q = project(p); if (q[2] <= 0) { prev = null; return; }
        if (prev) {
          var ax = prev[0], ay = prev[1], bx = q[0], by = q[1], vx = bx - ax, vy = by - ay, L2 = vx * vx + vy * vy || 1;
          var t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / L2)), d = Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
          if (d < bd) { bd = d; best = h; }
        }
        prev = q;
      });
    });
    return best;
  }
  function prio(l) { var c = l.el.className; return c.indexOf('lb-hole') > -1 ? 0 : c.indexOf('lb-club') > -1 ? 1 : c.indexOf('lb-nine') > -1 ? 2 : 3; }
  function placeLabels() {
    var cw = canvas.clientWidth, ch = canvas.clientHeight, taken = [];
    labels.slice().sort(function (a, b) { return prio(a) - prio(b); }).forEach(function (l) {
      var p = l.p, m = mvp;
      var x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
      if (w <= 0) { l.el.style.visibility = 'hidden'; return; }
      if (!l.w) { l.w = l.el.offsetWidth; l.h = l.el.offsetHeight; }
      var px = (x / w * 0.5 + 0.5) * cw - l.w / 2, py = (1 - (y / w * 0.5 + 0.5)) * ch - l.h - 4;
      var off = px < 2 || py < 2 || px + l.w > cw - 2 || py + l.h > ch - 2;
      var gone = l.el.classList.contains('is-gone');
      var hit = !gone && taken.some(function (r) { return px < r[2] + 6 && px + l.w + 6 > r[0] && py < r[3] + 4 && py + l.h + 4 > r[1]; });
      var show = !off && !hit && rise >= 0.6;
      l.el.style.visibility = show ? 'visible' : 'hidden';
      if (show && !gone) taken.push([px, py, px + l.w, py + l.h]);
      l.el.style.transform = 'translate(' + px.toFixed(1) + 'px,' + py.toFixed(1) + 'px)';
    });
  }

  /* render */
  var dpr = 1, raf = 0, dirty = true;
  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(1, Math.round(canvas.clientWidth * dpr)), h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    home = fitHome();
    if (state.hole) state.view = viewHole(holeById(state.hole)); else if (state.active) state.view = viewFor(state.active); else state.view = home;
    if (!tweens.some(function (tw) { return tw.cam; }) && !dragging) Object.assign(cam, state.view);
    labels.forEach(function (l) { l.w = 0; });
    dirty = true; kick();
  }
  function draw() {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    var ce = Math.cos(cam.el), eye = [cam.tx + cam.dist * ce * Math.sin(cam.az), cam.ty + cam.dist * Math.sin(cam.el), cam.tz + cam.dist * ce * Math.cos(cam.az)];
    mvp = mul(persp(fovY, canvas.width / canvas.height, 0.05, 40), look(eye, [cam.tx, cam.ty, cam.tz], [0, 1, 0]));
    gl.uniformMatrix4fv(U.uMvp, false, new Float32Array(mvp));
    gl.uniform1f(U.uRise, 0.04 + 0.96 * rise);
    gl.uniform1f(U.uMix, mixT);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texA);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texB);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, texS);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bIdx);
    /* shadow first, blended, no depth write */
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.disable(gl.DEPTH_TEST);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, shadowStart * 2);
    gl.disable(gl.BLEND); gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
    gl.drawElements(gl.TRIANGLES, shadowStart, gl.UNSIGNED_SHORT, 0);
    gl.disable(gl.CULL_FACE);
    placeLabels();
  }
  var tweens = [];
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function tween(dur, fn, done, ez) { var tw = { t0: performance.now(), dur: dur, fn: fn, done: done, ez: ez || ease }; tweens.push(tw); kick(); return tw; }
  function frame(now) {
    raf = 0;
    var live = false;
    tweens = tweens.filter(function (tw) {
      var t = Math.min(1, (now - tw.t0) / tw.dur); tw.fn(tw.ez(t));
      if (t >= 1) { if (tw.done) tw.done(); return false; } return true;
    });
    if (tweens.length || dragging) live = true;
    if (live || dirty) { draw(); dirty = false; }
    if (live) raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }
  function flyTo(v, dur) {
    var from = Object.assign({}, cam);
    var daz = v.az - from.az;
    if (reduce || !dur) { Object.assign(cam, v); dirty = true; kick(); return; }
    tweens = tweens.filter(function (tw) { return !tw.cam; });
    tween(dur, function (t) {
      cam.az = from.az + daz * t; cam.el = from.el + (v.el - from.el) * t; cam.dist = from.dist + (v.dist - from.dist) * t;
      cam.tx = from.tx + (v.tx - from.tx) * t; cam.ty = from.ty + (v.ty - from.ty) * t; cam.tz = from.tz + (v.tz - from.tz) * t;
    }).cam = true;
  }
  function repaint() {
    paintState(state.inked, state.active, state.hole, state.hover);
    if (reduce) { upload(texA, paint, true); mixT = 0; dirty = true; kick(); return; }
    upload(texB, paint, true);
    mixT = 0;
    tween(700, function (t) { mixT = t; }, function () { var tmp = texA; texA = texB; texB = tmp; mixT = 0; dirty = true; kick(); });
  }

  /* drag to turn */
  var dragging = false, lastX = 0, lastY = 0, pid = null;
  var downX = 0, downY = 0, downT = 0;
  canvas.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragging = true; pid = e.pointerId; lastX = downX = e.clientX; lastY = downY = e.clientY; downT = performance.now();
    try { canvas.setPointerCapture(pid); } catch (er) {}
    tweens = tweens.filter(function (tw) { return !tw.cam; });
    kick();
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!dragging || e.pointerId !== pid) return;
    var dx = e.clientX - lastX, dy = e.clientY - lastY; lastX = e.clientX; lastY = e.clientY;
    var base = state.view || home;
    cam.az = Math.max(base.az - 0.95, Math.min(base.az + 0.95, cam.az - dx * 0.006));
    if (e.pointerType === 'mouse') cam.el = Math.max(0.38, Math.min(1.18, cam.el + dy * 0.004));
    dirty = true;
  });
  function end(e) {
    if (e.pointerId !== pid) return; dragging = false; pid = null;
    if (e.type === 'pointerup' && Math.hypot(e.clientX - downX, e.clientY - downY) < 6 && performance.now() - downT < 500) {
      var r = canvas.getBoundingClientRect(), h = pickHole(e.clientX - r.left, e.clientY - r.top);
      if (h) { api.stopTour(); api.flyHole(h.n, h.r); if (api.onHole) api.onHole(h.n, h.r, 'model'); }
    }
  }
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  var hoverRaf = 0;
  canvas.addEventListener('pointermove', function (e) {
    if (dragging || e.pointerType !== 'mouse' || hoverRaf) return;
    var cx = e.clientX, cy = e.clientY;
    hoverRaf = requestAnimationFrame(function () {
      hoverRaf = 0;
      var r = canvas.getBoundingClientRect(), h = pickHole(cx - r.left, cy - r.top), id = h ? h.id : null;
      canvas.style.cursor = h ? 'pointer' : '';
      if (id !== state.hover) { state.hover = id; showHoleLabel(id || state.hole); paintState(state.inked, state.active, state.hole, state.hover); upload(texA, paint, true); dirty = true; kick(); }
    });
  });
  canvas.addEventListener('pointerleave', function () {
    if (!state.hover) return; state.hover = null; canvas.style.cursor = '';
    showHoleLabel(state.hole); paintState(state.inked, state.active, state.hole, null); upload(texA, paint, true); dirty = true; kick();
  });

  /* public */
  function setLabels() {
    NINES.forEach(function (n) {
      var l = nineLabel[n]; if (!l) return;
      l.el.classList.toggle('is-gone', !state.inked[n]);
      l.el.classList.toggle('is-dim', !!(state.active && state.active !== n && state.inked[n]));
    });
  }
  var tourTimer = 0, touring = null;
  var api = {
    ready: true,
    onHole: null,
    select: function (n) { api.stopTour(); state.inked[n] = true; state.active = n; state.hole = null; state.view = viewFor(n); showHoleLabel(null); setLabels(); repaint(); flyTo(state.view, 1700); },
    overview: function () { api.stopTour(); state.active = null; state.hole = null; state.view = home; showHoleLabel(null); setLabels(); repaint(); flyTo(home, 1500); },
    reset: function () { api.stopTour(); state.inked = {}; state.active = null; state.hole = null; state.view = home; showHoleLabel(null); setLabels(); repaint(); flyTo(home, 1300); },
    flyHole: function (n, r, dur) {
      var h = holeById(n + ' ' + r); if (!h) return;
      state.inked[n] = true; state.active = n; state.hole = h.id; state.view = viewHole(h);
      setLabels(); showHoleLabel(h.id); repaint(); flyTo(state.view, dur || 1900);
    },
    tour: function (n, onStep, onEnd) {
      api.stopTour();
      var r = 1;
      touring = { n: n, onEnd: onEnd };
      (function step() {
        if (!touring) return;
        if (r > 9) { var done = touring.onEnd; touring = null; if (done) done(true); return; }
        api.flyHole(n, r, reduce ? 0 : 2300); if (onStep) onStep(r);
        r++; tourTimer = setTimeout(step, reduce ? 2600 : 3500);
      })();
    },
    stopTour: function () { if (!touring) return; clearTimeout(tourTimer); var done = touring.onEnd; touring = null; if (done) done(false); },
    touring: function () { return !!touring; }
  };
  window.CRLand = api;

  /* rise when the section arrives */
  function riseUp() {
    if (risen) return; risen = true;
    var start = Object.assign({}, home, { el: home.el + 0.28, dist: home.dist * 1.12, az: home.az - 0.22 });
    Object.assign(cam, start);
    tween(2600, function (t) { rise = t; }, null, easeOut);
    flyTo(home, 2600);
  }
  host.classList.add('is-gl');
  size();
  window.addEventListener('resize', function () { size(); });
  if ('ResizeObserver' in window) new ResizeObserver(function () { size(); }).observe(host);
  if (reduce || !('IntersectionObserver' in window)) { rise = 1; risen = true; dirty = true; kick(); }
  else {
    var io = new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) { riseUp(); io.disconnect(); } }); }, { threshold: 0.3 });
    io.observe(host);
  }
  canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); host.classList.remove('is-gl'); window.CRLand = noop; });
})();
