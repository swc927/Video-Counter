// Counter Animator by SWC
// Core state
const el = (id) => document.getElementById(id);

const state = {
  label: el("labelInput").value,
  start: Number(el("startValue").value),
  end: Number(el("endValue").value),
  duration: Number(el("durationSec").value),
  fps: Number(el("fps").value),
  easing: el("easing").value,
  formatting: el("formatting").value,
  fontFamily: el("fontFamily").value,
  fontSize: Number(el("fontSize").value),
  fontWeight: el("fontWeight").value,
  textColor: el("textColor").value,
  glowColor: el("glowColor").value,
  glowBlur: Number(el("glowBlur").value),
  glowAlpha: Number(el("glowAlpha").value),
  bgMode: el("bgMode").value,
  bgA: el("bgColorA").value,
  bgB: el("bgColorB").value,
  chroma: el("chromaColor").value,
  width: Number(el("canvasW").value),
  height: Number(el("canvasH").value),
};

// Canvas setup
const canvas = el("stage");
const ctx = canvas.getContext("2d");

function resizeCanvas() {
  state.width = Number(el("canvasW").value);
  state.height = Number(el("canvasH").value);
  canvas.width = state.width;
  canvas.height = state.height;
  drawFrame(0);
}
el("resizeCanvas").addEventListener("click", resizeCanvas);

// Listen inputs
document.querySelectorAll("input, select").forEach((input) => {
  input.addEventListener("input", () => {
    state.label = el("labelInput").value;
    state.start = Number(el("startValue").value);
    state.end = Number(el("endValue").value);
    state.duration = Math.max(1, Number(el("durationSec").value));
    state.fps = Math.min(60, Math.max(1, Number(el("fps").value)));
    state.easing = el("easing").value;
    state.formatting = el("formatting").value;
    state.fontFamily = el("fontFamily").value;
    state.fontSize = Number(el("fontSize").value);
    state.fontWeight = el("fontWeight").value;
    state.textColor = el("textColor").value;
    state.glowColor = el("glowColor").value;
    state.glowBlur = Number(el("glowBlur").value);
    state.glowAlpha = Number(el("glowAlpha").value);
    state.bgMode = el("bgMode").value;
    state.bgA = el("bgColorA").value;
    state.bgB = el("bgColorB").value;
    state.chroma = el("chromaColor").value;
    drawFrame(0);
  });
});

// Easing functions
const Easing = {
  linear: (t) => t,
  easeIn: (t) => t * t,
  easeOut: (t) => 1 - Math.pow(1 - t, 2),
  easeInOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
};

// Number formatting
function formatNumber(n) {
  if (state.formatting === "commas") {
    return n.toLocaleString();
  }
  if (state.formatting === "compact") {
    const abs = Math.abs(n);
    if (abs >= 1e9) return (n / 1e9).toFixed(2).replace(/\.00$/, "") + "B";
    if (abs >= 1e6) return (n / 1e6).toFixed(2).replace(/\.00$/, "") + "M";
    if (abs >= 1e3) return (n / 1e3).toFixed(2).replace(/\.00$/, "") + "K";
  }
  return String(n);
}

// Background painter
function paintBackground() {
  if (state.bgMode === "transparent") {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }
  if (state.bgMode === "solid") {
    ctx.fillStyle = state.bgA;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }
  if (state.bgMode === "chroma") {
    ctx.fillStyle = state.chroma;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }
  // gradient
  const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  g.addColorStop(0, state.bgA);
  g.addColorStop(1, state.bgB);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// Glow text
function drawGlowingText(text, x, y) {
  // shadow glow pass
  if (state.glowBlur > 0 && state.glowAlpha > 0) {
    ctx.save();
    ctx.shadowColor = hexWithAlpha(state.glowColor, state.glowAlpha);
    ctx.shadowBlur = state.glowBlur;
    ctx.fillStyle = state.textColor;
    ctx.fillText(text, x, y);
    ctx.restore();
  }
  // inner text
  ctx.fillStyle = state.textColor;
  ctx.fillText(text, x, y);
}

function hexWithAlpha(hex, alpha) {
  // convert #rrggbb to rgba
  const c = hex.replace("#", "");
  const bigint = parseInt(c, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// One frame draw
function drawFrame(progress) {
  paintBackground();

  const t = Math.min(Math.max(progress, 0), 1);
  const eased = Easing[state.easing](t);
  const current = Math.round(state.start + (state.end - state.start) * eased);

  // compose text
  const counterText = formatNumber(current);
  const labelText = state.label;

  // font setup
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // label
  ctx.font = `bold ${Math.round(state.fontSize * 0.33)}px ${state.fontFamily}`;
  drawGlowingText(labelText, canvas.width / 2, canvas.height * 0.38);

  // value
  ctx.font = `${state.fontWeight} ${state.fontSize}px ${state.fontFamily}`;
  drawGlowingText(counterText, canvas.width / 2, canvas.height * 0.6);
}

// Preview loop
let rafId = null;
let previewStart = 0;
function startPreview() {
  cancelAnimationFrame(rafId);
  previewStart = performance.now();
  const loop = (now) => {
    const elapsed = (now - previewStart) / 1000;
    const t = Math.min(elapsed / state.duration, 1);
    drawFrame(t);
    if (t < 1) {
      rafId = requestAnimationFrame(loop);
    }
  };
  rafId = requestAnimationFrame(loop);
}
function stopPreview() {
  cancelAnimationFrame(rafId);
}
el("previewBtn").addEventListener("click", startPreview);
el("stopBtn").addEventListener("click", stopPreview);

// Recording using MediaRecorder from canvas stream
let lastBlob = null;

async function recordVideo() {
  // ensure deterministic frame stepping
  const stream = canvas.captureStream(state.fps);
  const mimeOptions = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  const mimeType =
    mimeOptions.find((m) => MediaRecorder.isTypeSupported(m)) || "";
  const rec = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 6_000_000,
  });

  const chunks = [];
  rec.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  const finished = new Promise((resolve) => (rec.onstop = resolve));

  rec.start();

  // drive frames manually at fixed fps for exact duration
  const totalFrames = Math.ceil(state.duration * state.fps);
  for (let i = 0; i <= totalFrames; i++) {
    const t = i / totalFrames;
    drawFrame(t);
    await waitMs(1000 / state.fps);
  }

  rec.stop();
  await finished;

  lastBlob = new Blob(chunks, { type: mimeType || "video/webm" });
  const url = URL.createObjectURL(lastBlob);
  const a = el("videoLink");
  a.href = url;
  a.textContent = "Download video";
  a.download = suggestFilename();
}

function suggestFilename() {
  const labelSafe = state.label
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "");
  return `${labelSafe}_${state.start}_to_${state.end}_${state.duration}s_${state.fps}fps.webm`;
}

function waitMs(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

el("recordBtn").addEventListener("click", () => {
  recordVideo().catch((err) => {
    console.error(err);
    alert("Recording failed. Please try a different browser or reduce FPS.");
  });
});
el("downloadBtn").addEventListener("click", () => {
  if (!lastBlob) {
    alert("No video recorded yet.");
    return;
  }
  const a = el("videoLink");
  a.click();
});

// initial draw
resizeCanvas();
drawFrame(0);
