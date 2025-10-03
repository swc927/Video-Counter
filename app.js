
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const stage = $("#videoStage");
const video = $("#video");
const overlay = $("#overlay");
const videoInput = $("#videoInput");
const renderCanvas = $("#renderCanvas");

const addCounterBtn = $("#addCounter");
const newLabel = $("#newLabel");
const newStyle = $("#newStyle");
const newSize = $("#newSize");

const kfCounter = $("#kfCounter");
const kfTime = $("#kfTime");
const kfValue = $("#kfValue");
const useNowBtn = $("#useNow");
const addKeyframeBtn = $("#addKeyframe");
const keyframeList = $("#keyframeList");

const playPause = $("#playPause");
const currentTimeEl = $("#currentTime");
const durationEl = $("#duration");
const jumpBack = $("#jumpBack");
const jumpFwd = $("#jumpFwd");
const snapKeyframes = $("#snapKeyframes");

const saveConfig = $("#saveConfig");
const loadConfig = $("#loadConfig");
const toggleGrid = $("#toggleGrid");

const deleteSelectedBtn = $("#deleteSelected");
const clearAllBtn = $("#clearAll");

const exportVideoBtn = $("#exportVideo");
const stopExportBtn = $("#stopExport");

let counters = [];
let idSeed = 1;
let selectedCounterId = null;

// MediaRecorder state
let recorder = null;
let recordedChunks = [];
let exporting = false;
let rafId = null;

function selectCounter(id) {
  selectedCounterId = id;
  counters.forEach((c) => c.el.classList.toggle("selected", c.id === id));
}

function deleteCounterById(id) {
  const idx = counters.findIndex((c) => c.id === id);
  if (idx === -1) return;
  const c = counters[idx];
  try { c.el.remove(); } catch (e) {}
  counters.splice(idx, 1);
  updateKfCounterOptions();
  refreshKeyframeList();
  if (selectedCounterId === id) selectedCounterId = null;
}

function clearAllCounters() {
  counters.forEach((c) => { try { c.el.remove(); } catch (e) {} });
  counters = [];
  selectedCounterId = null;
  updateKfCounterOptions();
  refreshKeyframeList();
}

document.addEventListener("keydown", (e) => {
  if (!selectedCounterId) return;
  if (e.key === "Delete" || e.key === "Backspace") {
    e.preventDefault();
    deleteCounterById(selectedCounterId);
  }
});

function fmtTime(t) {
  t = Math.max(0, t | 0);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return h > 0
    ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
function parseTime(s) {
  if (!s) return null;
  const parts = s.split(":").map((x) => x.trim());
  if (parts.some((p) => p === "" || isNaN(p))) return null;
  let h = 0, m = 0, sec = 0;
  if (parts.length === 3) [h,m,sec] = parts.map(Number);
  else if (parts.length === 2) [m,sec] = parts.map(Number);
  else if (parts.length === 1) sec = Number(parts[0]);
  else return null;
  return h*3600 + m*60 + sec;
}
function clamp01(x){ return Math.max(0, Math.min(1, x)); }
function addOption(select, value, text){ const opt=document.createElement("option"); opt.value=value; opt.textContent=text; select.appendChild(opt); }

function refreshKeyframeList() {
  keyframeList.innerHTML = "";
  counters.forEach((c) => {
    if (!c.keyframes || c.keyframes.length === 0) return;
    c.keyframes.sort((a, b) => a.t - b.t);
    c.keyframes.forEach((kf) => {
      const item = document.createElement("div");
      item.className = "kf-item";
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = c.label;
      const time = document.createElement("span");
      time.textContent = fmtTime(kf.t);
      const val = document.createElement("span");
      val.textContent = kf.v;
      const del = document.createElement("button");
      del.textContent = "Remove";
      del.addEventListener("click", () => {
        const i = c.keyframes.indexOf(kf);
        if (i >= 0) {
          c.keyframes.splice(i, 1);
          refreshKeyframeList();
        }
      });
      item.appendChild(badge); item.appendChild(time); item.appendChild(val); item.appendChild(del);
      keyframeList.appendChild(item);
    });
  });
}
function updateKfCounterOptions() {
  kfCounter.innerHTML = "";
  counters.forEach((c) => addOption(kfCounter, c.id, `${c.label} #${c.id}`));
}

// Keep overlay height equal to actual video element box height
function syncOverlaySize(){
  // Because overlay is absolutely positioned with inset 0 in the stage,
  // and the stage height follows the video element height, CSS already matches them.
  // This function exists to trigger any future layout dependent logic if needed.
}

video.addEventListener("loadedmetadata", () => {
  durationEl.textContent = fmtTime(video.duration | 0);
  syncOverlaySize();
});
video.addEventListener("timeupdate", () => {
  currentTimeEl.textContent = fmtTime(video.currentTime | 0);
});

// File input
videoInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  video.src = url;
  const play = video.play();
  if (play && play.catch) play.catch(()=>{});
});

playPause.addEventListener("click", () => { if (video.paused) video.play(); else video.pause(); });
jumpBack.addEventListener("click", () => { video.currentTime = Math.max(0, video.currentTime - 1); });
jumpFwd.addEventListener("click", () => {
  video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 1);
});
snapKeyframes.addEventListener("click", () => {
  const t = video.currentTime || 0;
  let next = Infinity;
  counters.forEach((c) => c.keyframes && c.keyframes.forEach((k) => { if (k.t > t && k.t < next) next = k.t; }));
  if (next < Infinity) video.currentTime = next;
});
toggleGrid.addEventListener("click", () => { overlay.classList.toggle("show-grid"); });

// Add counter with resize handle
addCounterBtn.addEventListener("click", () => {
  const label = (newLabel.value || "Counter").trim();
  const style = newStyle.value;
  const size = Number(newSize.value) || 64;
  const id = idSeed++;

  const el = document.createElement("div");
  el.className = `counter ${style}`;
  el.dataset.id = id;
  el.style.left = "50%";
  el.style.top = "50%";
  el.innerHTML = `
    <div class="label" style="font-size:${Math.round(size * 0.45)}px">${label}</div>
    <div class="value" style="font-size:${size}px">0</div>
    <div class="close" title="Remove">×</div>
    <div class="resize" title="Resize"></div>
  `;
  overlay.appendChild(el);

  const c = { id, label, style, size, x:50, y:50, el, keyframes:[], display:0 };
  counters.push(c);
  updateKfCounterOptions();

  let shift = false;
  function onDown(ev) {
    if (ev.target.classList.contains("resize")) return; // resize has own handler
    ev.preventDefault();
    const start = ev.touches ? ev.touches[0] : ev;
    shift = ev.shiftKey;
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onMove, { passive:false });
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchend", onUp);
  }
  function onMove(ev) {
    ev.preventDefault();
    const rect = overlay.getBoundingClientRect();
    const e = ev.touches ? ev.touches[0] : ev;
    let nx = ((e.clientX - rect.left) / rect.width) * 100;
    let ny = ((e.clientY - rect.top) / rect.height) * 100;
    if (shift || overlay.classList.contains("show-grid")) {
      const grid = 2.5;
      nx = Math.round(nx / grid) * grid;
      ny = Math.round(ny / grid) * grid;
    }
    nx = Math.max(0, Math.min(100, nx));
    ny = Math.max(0, Math.min(100, ny));
    c.x = nx; c.y = ny;
    el.style.left = `${c.x}%`;
    el.style.top = `${c.y}%`;
  }
  function onUp() {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("touchmove", onMove);
    window.removeEventListener("mouseup", onUp);
    window.removeEventListener("touchend", onUp);
  }
  el.addEventListener("mousedown", onDown);
  el.addEventListener("touchstart", onDown, { passive:false });

  // Selection and delete button
  el.addEventListener("click", (ev) => {
    if (ev.target.classList.contains("close")) return;
    selectCounter(id);
  });
  el.querySelector(".close").addEventListener("click", (ev) => {
    ev.stopPropagation();
    deleteCounterById(id);
  });

  // Resize logic
  const handle = el.querySelector(".resize");
  let resizing = false;
  let startSize = size;
  let startX = 0, startY = 0;
  handle.addEventListener("mousedown", (ev) => {
    ev.preventDefault();
    resizing = true;
    const p = ev.touches ? ev.touches[0] : ev;
    startX = p.clientX; startY = p.clientY;
    startSize = c.size;
    window.addEventListener("mousemove", onResizeMove);
    window.addEventListener("mouseup", onResizeUp);
  });
  function onResizeMove(ev){
    if (!resizing) return;
    const p = ev.touches ? ev.touches[0] : ev;
    const delta = Math.max(p.clientX - startX, p.clientY - startY);
    let next = Math.min(200, Math.max(16, Math.round(startSize + delta * 0.6)));
    // optional snap when grid visible
    if (overlay.classList.contains("show-grid")) next = Math.round(next / 2) * 2;
    c.size = next;
    el.querySelector(".label").style.fontSize = Math.round(c.size * 0.45) + "px";
    el.querySelector(".value").style.fontSize = c.size + "px";
  }
  function onResizeUp(){
    resizing = false;
    window.removeEventListener("mousemove", onResizeMove);
    window.removeEventListener("mouseup", onResizeUp);
  }
});

useNowBtn.addEventListener("click", () => { kfTime.value = fmtTime(video.currentTime | 0); });

addKeyframeBtn.addEventListener("click", () => {
  const id = Number(kfCounter.value);
  const c = counters.find((x) => x.id === id);
  if (!c) { alert("Pick a counter first"); return; }

  const t = parseTime(kfTime.value);
  if (t == null) { alert("Enter a valid time like 0:10 or 1:02:03"); return; }
  const v = Number(kfValue.value);
  if (!Number.isFinite(v)) { alert("Enter a valid integer value"); return; }

  c.keyframes.push({ t, v: Math.round(v) });
  c.keyframes.sort((a, b) => a.t - b.t);
  refreshKeyframeList();
});

function getCounterValueAt(c, t) {
  const kfs = c.keyframes;
  if (!kfs || kfs.length === 0) return null;
  kfs.sort((a, b) => a.t - b.t);
  if (t < kfs[0].t) return null;
  if (t >= kfs[kfs.length - 1].t) return kfs[kfs.length - 1].v;

  let i0 = 0, i1 = 0;
  for (let i = 0; i < kfs.length - 1; i++) {
    if (t >= kfs[i].t && t < kfs[i + 1].t) { i0 = i; i1 = i + 1; break; }
  }
  const k0 = kfs[i0], k1 = kfs[i1];
  const denom = Math.max(0.000001, k1.t - k0.t);
  const p = clamp01((t - k0.t) / denom);
  const v = k0.v + (k1.v - k0.v) * p;
  return k1.v >= k0.v ? Math.floor(Math.min(k1.v, v)) : Math.ceil(Math.max(k1.v, v));
}


function updateCounters() {
  const t = video.currentTime || 0;
  counters.forEach((c) => {
    const el = c.el;
    const valEl = el.querySelector(".value");
    const v = getCounterValueAt(c, t);

    if (v == null) {
      // preview before first keyframe: show first keyframe value or 0, slightly transparent
      const kfs = c.keyframes || [];
      const previewVal = kfs.length ? kfs.slice().sort((a,b)=>a.t-b.t)[0].v : 0;
      valEl.textContent = String(previewVal);
      el.style.opacity = 0.6;
      return;
    }

    el.style.opacity = 1.0;
    if (c.display !== v) {
      c.display = v;
      valEl.textContent = String(v);
      el.classList.remove("tick"); void el.offsetWidth; el.classList.add("tick");
    }
  });
  requestAnimationFrame(updateCounters);
}
requestAnimationFrame(updateCounters);


// Export config and import config
saveConfig.addEventListener("click", () => {
  const data = counters.map((c) => ({
    id: c.id, label: c.label, style: c.style, size: c.size, x: c.x, y: c.y, keyframes: c.keyframes,
  }));
  const json = JSON.stringify({ version: 2, counters: data }, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "glow-tally-config.json"; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
loadConfig.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const obj = JSON.parse(reader.result);
      if (!obj || !Array.isArray(obj.counters)) throw new Error("Bad file");
      clearAllCounters();
      let maxId = 0;
      obj.counters.forEach((c0) => { if (c0.id && c0.id > maxId) maxId = c0.id; });
      idSeed = Math.max(idSeed, maxId + 1);
      obj.counters.forEach((c0) => {
        const id = c0.id || idSeed++;
        const el = document.createElement("div");
        el.className = `counter ${c0.style || "glow-azure"}`;
        el.dataset.id = id;
        el.style.left = `${c0.x ?? 50}%`;
        el.style.top = `${c0.y ?? 50}%`;
        const size = c0.size || 64;
        el.innerHTML = `
          <div class="label" style="font-size:${Math.round(size * 0.45)}px">${c0.label || "Counter"}</div>
          <div class="value" style="font-size:${size}px">0</div>
          <div class="close" title="Remove">×</div>
          <div class="resize" title="Resize"></div>
        `;
        overlay.appendChild(el);
        const c = {
          id, label: c0.label || "Counter", style: c0.style || "glow-azure",
          size, x: c0.x ?? 50, y: c0.y ?? 50, el, keyframes: Array.isArray(c0.keyframes) ? c0.keyframes : [], display: 0,
        };
        counters.push(c);

        // drag
        let shift = false;
        function onDown(ev) {
          if (ev.target.classList.contains("resize")) return;
          ev.preventDefault();
          shift = ev.shiftKey;
          window.addEventListener("mousemove", onMove);
          window.addEventListener("touchmove", onMove, { passive:false });
          window.addEventListener("mouseup", onUp);
          window.addEventListener("touchend", onUp);
        }
        function onMove(ev) {
          ev.preventDefault();
          const rect = overlay.getBoundingClientRect();
          const e = ev.touches ? ev.touches[0] : ev;
          let nx = ((e.clientX - rect.left) / rect.width) * 100;
          let ny = ((e.clientY - rect.top) / rect.height) * 100;
          if (shift || overlay.classList.contains("show-grid")) {
            const grid = 2.5;
            nx = Math.round(nx / grid) * grid;
            ny = Math.round(ny / grid) * grid;
          }
          nx = Math.max(0, Math.min(100, nx));
          ny = Math.max(0, Math.min(100, ny));
          c.x = nx; c.y = ny;
          el.style.left = `${c.x}%`;
          el.style.top = `${c.y}%`;
        }
        function onUp() {
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("touchmove", onMove);
          window.removeEventListener("mouseup", onUp);
          window.removeEventListener("touchend", onUp);
        }
        el.addEventListener("mousedown", onDown);
        el.addEventListener("touchstart", onDown, { passive:false });

        el.addEventListener("click", (ev) => { if (!ev.target.classList.contains("close")) selectCounter(id); });
        el.querySelector(".close").addEventListener("click", (ev) => { ev.stopPropagation(); deleteCounterById(id); });

        // resize
        const handle = el.querySelector(".resize");
        let resizing = false;
        let startSize = size;
        let startX = 0, startY = 0;
        handle.addEventListener("mousedown", (ev) => {
          ev.preventDefault();
          resizing = true;
          const p = ev.touches ? ev.touches[0] : ev;
          startX = p.clientX; startY = p.clientY;
          startSize = c.size;
          window.addEventListener("mousemove", onResizeMove);
          window.addEventListener("mouseup", onResizeUp);
        });
        function onResizeMove(ev){
          if (!resizing) return;
          const p = ev.touches ? ev.touches[0] : ev;
          const delta = Math.max(p.clientX - startX, p.clientY - startY);
          let next = Math.min(200, Math.max(16, Math.round(startSize + delta * 0.6)));
          if (overlay.classList.contains("show-grid")) next = Math.round(next / 2) * 2;
          c.size = next;
          el.querySelector(".label").style.fontSize = Math.round(c.size * 0.45) + "px";
          el.querySelector(".value").style.fontSize = c.size + "px";
        }
        function onResizeUp(){
          resizing = false;
          window.removeEventListener("mousemove", onResizeMove);
          window.removeEventListener("mouseup", onResizeUp);
        }
      });
      updateKfCounterOptions(); refreshKeyframeList();
    } catch (err) { alert("Could not read config"); }
  };
  reader.readAsText(file);
});

// Delete controls
deleteSelectedBtn.addEventListener("click", () => {
  if (!selectedCounterId) { alert("Select a counter first"); return; }
  deleteCounterById(selectedCounterId);
});
clearAllBtn.addEventListener("click", () => {
  if (confirm("Remove all counters?")) clearAllCounters();
});

// Drawing counters onto canvas
function drawCanvasFrame(ctx, w, h, t) {
  try { ctx.drawImage(video, 0, 0, w, h); } catch (e) {}

  counters.forEach((c) => {
    const v = getCounterValueAt(c, t);
    if (v == null) return;

    const x = (c.x / 100) * w;
    const y = (c.y / 100) * h;

    // style mapping
    let gradTop = "#ffffff", gradBottom = "#ffffff", glow = "rgba(255,255,255,0.5)";
    if (c.style.includes("glow-azure")) { gradTop="#e6f7ff"; gradBottom="#8ad4ff"; glow="rgba(138,212,255,0.5)"; }
    else if (c.style.includes("glow-rose")) { gradTop="#ffe7f2"; gradBottom="#ff9bc6"; glow="rgba(255,155,198,0.5)"; }
    else if (c.style.includes("glow-lime")) { gradTop="#f0ffd8"; gradBottom="#aeff7f"; glow="rgba(174,255,127,0.5)"; }
    else if (c.style.includes("glow-violet")) { gradTop="#efe6ff"; gradBottom="#b892ff"; glow="rgba(184,146,255,0.5)"; }
    else if (c.style.includes("glow-amber")) { gradTop="#fff4d6"; gradBottom="#ffe084"; glow="rgba(255,224,132,0.5)"; }

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // label
    ctx.font = `600 ${Math.round(c.size * 0.45)}px Inter, Arial, sans-serif`;
    ctx.shadowColor = glow;
    ctx.shadowBlur = Math.max(8, c.size * 0.2);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText(c.label, x, y - c.size * 0.8);

    // value with gradient
    const grad = ctx.createLinearGradient(0, y - c.size * 0.6, 0, y + c.size * 0.6);
    grad.addColorStop(0, gradTop); grad.addColorStop(1, gradBottom);
    ctx.font = `800 ${c.size}px Inter, Arial, sans-serif`;
    ctx.fillStyle = grad;
    ctx.fillText(String(v), x, y);
    ctx.restore();
  });
}

// HiDPI safe canvas setup
function setupHiDPICanvas(canvas, w, h){
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

// Export video with overlays including audio
function startExport() {
  if (!video.src) { alert("Upload a video first"); return; }
  const w = video.videoWidth || 1280;
  const h = video.videoHeight || 720;

  const ctx = setupHiDPICanvas(renderCanvas, w, h);
  renderCanvas.style.display = "block";

  const canvasStream = renderCanvas.captureStream(30);

  // merge audio from the media element
  try {
    const vs = video.captureStream ? video.captureStream() : null;
    if (vs) {
      const audioTracks = vs.getAudioTracks();
      if (audioTracks && audioTracks.length) {
        audioTracks.forEach(tr => canvasStream.addTrack(tr));
      }
    }
  } catch (e) {
    console.warn("Audio capture not available", e);
  }

  recordedChunks = [];
  const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9"
             : MediaRecorder.isTypeSupported("video/webm;codecs=vp8") ? "video/webm;codecs=vp8"
             : "video/webm";
  recorder = new MediaRecorder(canvasStream, { mimeType: mime });
  recorder.ondataavailable = (e) => { if (e.data && e.data.size) recordedChunks.push(e.data); };
  recorder.onstop = () => {
    const blob = new Blob(recordedChunks, { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "glow-tally-export.webm"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    renderCanvas.style.display = "none";
    exporting = false;
    exportVideoBtn.disabled = false;
    stopExportBtn.disabled = true;
  };

  exporting = true;
  exportVideoBtn.disabled = true;
  stopExportBtn.disabled = false;

  // Reset and play from the start for clean export
  try { video.currentTime = 0; } catch(e){}
  const playPromise = video.play();
  if (playPromise && playPromise.catch) playPromise.catch(()=>{});

  recorder.start();

  function loop() {
    if (!exporting) return;
    drawCanvasFrame(ctx, w, h, video.currentTime || 0);
    rafId = requestAnimationFrame(loop);
  }
  loop();

  const onEnded = () => {
    stopExport();
    video.removeEventListener("ended", onEnded);
  };
  video.addEventListener("ended", onEnded);
}

function stopExport() {
  if (!exporting) return;
  exporting = false;
  try { if (rafId) cancelAnimationFrame(rafId); } catch(e){}
  try { recorder && recorder.state !== "inactive" && recorder.stop(); } catch(e){}
}

exportVideoBtn.addEventListener("click", startExport);
stopExportBtn.addEventListener("click", stopExport);

document.addEventListener("DOMContentLoaded", () => {
  durationEl.textContent = "00:00";
  currentTimeEl.textContent = "00:00";
});
