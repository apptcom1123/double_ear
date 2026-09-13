import { AudioEngine } from "./audio-engine.js";
import { arpeggioStyles, getPage, pages } from "./experiments.js";
import { formatValue } from "./audio-utils.js";
import { Studio } from './studio.js';
import { Performance } from './performance.js';

const app = document.querySelector("#app");
const nav = document.querySelector("#main-nav");
const toggle = document.querySelector("#audio-toggle");
const stopButton = document.querySelector("#stop-audio");
const masterVolume = document.querySelector("#master-volume");
const masterValue = document.querySelector("#master-volume-value");
const nowPlaying = document.querySelector("#now-playing");
const engine = new AudioEngine();
let activePage = null;
let config = null;
let restartTimer = null;
const studio = new Studio((playing) => setPlayingUi(playing));
const performanceDesk = new Performance((playing) => setPlayingUi(playing));

const controlDefinitions = {
  carrier: { label: "基礎頻率", type: "range", min: 80, max: 900, step: .1, unit: " Hz" },
  beat: { label: "左右差頻", type: "range", min: 0, max: 40, step: .01, unit: " Hz" },
  swing: { label: "差頻擺幅", type: "range", min: 0, max: 3, step: .1, unit: " Hz" },
  binauralLevel: { label: "載波音量", type: "range", min: 0, max: 1, step: .01, percent: true },
  noiseLevel: { label: "噪音音量", type: "range", min: 0, max: .45, step: .01, percent: true },
  arpeggioRoot: { label: "琶音根音", type: "range", min: 440, max: 1400, step: 1, unit: " Hz" },
  arpeggioLevel: { label: "琶音音量", type: "range", min: 0, max: .5, step: .01, percent: true },
  motionRate: { label: "移動速度", type: "range", min: 0, max: 7, step: .05, unit: " Hz" },
  motionDepth: { label: "移動深度", type: "range", min: 0, max: 1, step: .01, percent: true },
  bpm: { label: "節奏速度", type: "range", min: 40, max: 160, step: 1, unit: " BPM" },
  rhythmLevel: { label: "提示音量", type: "range", min: 0, max: .4, step: .01, percent: true },
  waveform: { label: "載波波形", type: "select", options: [["sine", "正弦｜柔和"], ["square", "方波｜明亮"]] },
  noise: { label: "噪音種類", type: "select", options: [["off", "關閉"], ["brown", "棕噪音"], ["green", "綠噪音"], ["white", "白噪音"]] },
  rhythm: { label: "錯拍比例", type: "select", options: [["off", "關閉"], ["3:4", "3 : 4"], ["3:7", "3 : 7"], ["4:7", "4 : 7"], ["5:7", "5 : 7"]] },
  arpeggio: { label: "琶音風格", type: "select", options: Object.entries(arpeggioStyles).map(([id, style]) => [id, style.label]) }
};

function currentId() {
  const id = location.hash.replace(/^#\/?/, "");
  return pages.some((page) => page.id === id) ? id : "";
}

function renderNav() {
  nav.innerHTML = `<a href="#/" class="${currentId() ? "" : "active"}">總覽</a>${pages.map((page) => `<a href="#/${page.id}" class="${currentId() === page.id ? "active" : ""}">${page.step} ${page.short}</a>`).join("")}`;
}

function renderHome() {
  activePage = null;
  app.innerHTML = `
    <section class="hero">
      <div class="hero-copy">
        <div class="eyebrow">Interactive listening studies</div>
        <h1>從一個乾淨的差頻，逐步長成完整聲景。</h1>
        <p>從聲音實驗到六張手牌混音，再把保存的基底帶上四槽演奏台。</p>
      </div>
      <aside class="listen-note">
        <span class="number">01 → 07</span>
        <p>第一次使用請從低音量開始。高頻提示音與快速空間移動都應短時間試聽。</p>
      </aside>
    </section>
    <div class="section-head"><h2>實驗路徑</h2><p>由淺入深排列；每張卡片連到獨立聲音設定頁。</p></div>
    <section class="card-grid">${pages.map((page) => `
      <article class="experiment-card">
        <div class="step"><span>STEP ${page.step}</span><span>${page.short}</span></div>
        <h3>${page.title}</h3><p>${page.summary}</p>
        <a href="#/${page.id}">開啟實驗 →</a>
      </article>`).join("")}</section>`;
}

function displayValue(definition, value) {
  return definition.percent ? `${Math.round(value * 100)}%` : formatValue(value, definition.unit || "");
}

function createControl(key) {
  const definition = controlDefinitions[key];
  if (definition.type === "select") {
    const label = document.createElement("label");
    label.className = "select-control";
    label.innerHTML = `<span>${definition.label}</span><select data-key="${key}">${definition.options.map(([value, text]) => `<option value="${value}" ${config[key] === value ? "selected" : ""}>${text}</option>`).join("")}</select>`;
    return label;
  }
  const template = document.querySelector("#control-template").content.cloneNode(true);
  const label = template.querySelector("label");
  const input = template.querySelector("input");
  template.querySelector("b").textContent = definition.label;
  template.querySelector("output").textContent = displayValue(definition, config[key]);
  Object.assign(input, { min: definition.min, max: definition.max, step: definition.step, value: config[key] });
  input.dataset.key = key;
  return label;
}

function renderExperiment(page) {
  activePage = page;
  config = structuredClone(page.config);
  if (page.id === 'mixer') { studio.render(app); return; }
  if (page.id === 'perform') { performanceDesk.render(app); return; }
  app.innerHTML = `
    <section class="hero">
      <div class="hero-copy"><div class="eyebrow">Experiment ${page.step}</div><h1>${page.title}</h1><p>${page.description}</p></div>
      <aside class="listen-note"><span class="number">${page.step}</span><p>${page.summary}</p></aside>
    </section>
    <section class="workspace">
      <div class="panel">
        <div class="panel-head"><div><div class="kicker">Sound controls</div><h2>即時參數</h2></div><span class="tag">耳機模式</span></div>
        <div id="controls" class="controls"></div>
        <div class="action-row"><button id="page-play" class="primary" type="button">播放這個組合</button><button id="reset-page" type="button">還原</button></div>
        <div class="meter"><span id="activity-meter"></span></div>
        <p class="hint">拖動參數後，播放中的聲音會以短淡出／淡入安全重建。總音量不會重設。</p>
      </div>
      <aside class="panel">
        <div class="panel-head"><div><div class="kicker">Starting points</div><h2>預設組合</h2></div></div>
        <div id="presets" class="preset-list">${page.presets.map(([name, detail, ,], index) => `<button class="preset" data-preset="${index}" type="button"><strong>${name}</strong><span>${detail}</span><b>＋</b></button>`).join("")}</div>
      </aside>
    </section>`;
  const controls = document.querySelector("#controls");
  page.controls.forEach((key) => controls.append(createControl(key)));
  bindExperimentEvents();
}

function setPlayingUi(playing) {
  document.body.classList.toggle("playing", playing);
  toggle.textContent = playing ? "重新播放" : "開始播放";
  stopButton.disabled = !playing;
  if (activePage?.id === 'mixer' && studio.library.paused) stopButton.disabled = false;
  const pagePlay = document.querySelector("#page-play");
  if (pagePlay) pagePlay.textContent = playing ? "套用並重新播放" : "播放這個組合";
  nowPlaying.textContent = playing && activePage ? `${activePage.step} · ${activePage.title}` : "尚未播放";
  const meter = document.querySelector("#activity-meter");
  if (meter) meter.style.width = playing ? `${Math.min(100, 18 + config.binauralLevel * 48 + config.noiseLevel * 50)}%` : "0";
}

async function play() {
  if (!activePage) {
    location.hash = "/binaural";
    return;
  }
  try {
    if (activePage.id === 'mixer') { studio.setVolume(masterVolume.value); await studio.play(); return; }
    if (activePage.id === 'perform') { performanceDesk.setVolume(masterVolume.value); await performanceDesk.play(); return; }
    engine.setVolume(masterVolume.value);
    await engine.start(config);
    setPlayingUi(true);
  } catch (error) {
    nowPlaying.textContent = error.message;
  }
}

function stop() {
  clearTimeout(restartTimer);
  studio.stop();
  performanceDesk.stop();
  engine.stop();
  setPlayingUi(false);
}

function scheduleRestart() {
  if (!engine.playing) return;
  clearTimeout(restartTimer);
  restartTimer = setTimeout(play, 180);
}

function updateControlsFromConfig() {
  document.querySelectorAll("[data-key]").forEach((input) => {
    input.value = config[input.dataset.key];
    const output = input.closest(".control")?.querySelector("output");
    if (output) output.textContent = displayValue(controlDefinitions[input.dataset.key], config[input.dataset.key]);
  });
}

function bindExperimentEvents() {
  document.querySelector("#controls").addEventListener("input", (event) => {
    const input = event.target.closest("[data-key]");
    if (!input) return;
    const key = input.dataset.key;
    config[key] = input.type === "range" ? Number(input.value) : input.value;
    const output = input.closest(".control")?.querySelector("output");
    if (output) output.textContent = displayValue(controlDefinitions[key], config[key]);
    document.querySelectorAll(".preset").forEach((item) => item.classList.remove("active"));
    scheduleRestart();
  });
  document.querySelector("#page-play").addEventListener("click", play);
  document.querySelector("#reset-page").addEventListener("click", () => {
    config = structuredClone(activePage.config);
    updateControlsFromConfig();
    scheduleRestart();
  });
  document.querySelector("#presets").addEventListener("click", (event) => {
    const button = event.target.closest("[data-preset]");
    if (!button) return;
    const preset = activePage.presets[Number(button.dataset.preset)][2];
    Object.assign(config, preset);
    document.querySelectorAll(".preset").forEach((item) => item.classList.toggle("active", item === button));
    updateControlsFromConfig();
    scheduleRestart();
  });
}

function render() {
  performanceDesk.unmount();
  studio.equalizer?.destroy();
  clearTimeout(restartTimer);
  if (engine.playing || studio.playing) stop();
  renderNav();
  const id = currentId();
  if (!id) renderHome(); else renderExperiment(getPage(id));
  app.focus({ preventScroll: true });
}

toggle.addEventListener("click", play);
stopButton.addEventListener("click", stop);
masterVolume.addEventListener("input", () => {
  engine.setVolume(masterVolume.value);
  studio.setVolume(masterVolume.value);
  performanceDesk.setVolume(masterVolume.value);
  masterValue.textContent = `${Math.round(Number(masterVolume.value) * 100)}%`;
});
window.addEventListener("hashchange", render);
window.addEventListener("beforeunload", () => { engine.stop(true); studio.stop(); performanceDesk.unmount(); });
render();
