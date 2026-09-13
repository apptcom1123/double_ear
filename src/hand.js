import { CARD_KEY, MAX_HAND, readCollection, saveCollection, snapshotCard, drawPool } from './cards-store.js';
import { defaultEQ, Equalizer } from './equalizer.js';
import { cardGesture } from './card-gesture.js';

export class Hand {
  constructor(studio) { this.studio = studio; this.catalogue = structuredClone(studio.state.layers); this.pool = []; this.name = ''; this.search = ''; this.group = 'ALL'; }
  prepare() {
    const state = this.studio.state;
    for (const template of this.catalogue) if (!state.layers.some(layer => layer.id === template.id)) state.layers.push(structuredClone(template));
    state.handIds ??= state.layers.filter(layer => layer.enabled).slice(0, MAX_HAND).map(layer => layer.id);
    state.handIds = [...new Set(state.handIds)].filter(id => state.layers.some(layer => layer.id === id)).slice(0, MAX_HAND);
    for (const layer of state.layers) {
      layer.config ??= structuredClone(state.config); layer.eq ??= defaultEQ();
      layer.config.materialIntensity ??= .5; layer.config.materialMotion ??= .45;
      layer.config.trafficSpeed ??= 50; layer.config.trafficPeriod ??= 10; layer.config.trafficCount ??= 5;
      const template = this.catalogue.find(item => item.id === layer.id);
      layer.config.materialVariant ??= template?.variants?.[0]?.[0] || '';
      if (!state.handIds.includes(layer.id)) layer.enabled = false;
    }
    if (!state.handIds.includes(this.selected)) this.selected = state.handIds[0];
    const selected = state.layers.find(layer => layer.id === this.selected);
    if (selected) state.config = selected.config;
    this.pool = this.pool.filter(item => !state.handIds.includes(item.id));
    if (!this.pool.length) this.refresh();
  }
  refresh() { this.pool = drawPool(this.catalogue, this.studio.state.handIds); }
  message(text) { const el = this.studio.root.querySelector('#hand-message'); if (el) el.textContent = text; }
  add(id) {
    const state = this.studio.state;
    if (state.handIds.includes(id)) return;
    if (state.handIds.length >= MAX_HAND) { this.message('手牌已滿六張，請先移除一張。'); return; }
    const layer = state.layers.find(item => item.id === id); if (!layer) return;
    state.handIds.push(id); layer.enabled = true; this.selected = id; this.pool = this.pool.filter(item => item.id !== id);
    this.studio.update(); this.studio.render(this.studio.root);
  }
  remove(id) {
    const state = this.studio.state; state.handIds = state.handIds.filter(item => item !== id);
    const layer = state.layers.find(item => item.id === id); if (layer) layer.enabled = false;
    this.studio.update(); this.studio.render(this.studio.root);
  }
  mount(root) {
    const desk = root.querySelector('.sound-desk');
    desk.innerHTML = `<div class="section-head"><h2>手牌 <small>${this.studio.state.handIds.length} / 6</small></h2><p>選牌調整 · 上下拖音量 · 下甩移除</p></div><div id="hand-zone" class="hand-zone" aria-label="六張手牌區"></div><section class="card-discovery"><div class="pool-head"><strong>隨機刷新</strong><button id="refresh-pool" type="button">換四張</button></div><div id="draw-pool" class="draw-pool"></div><div class="effect-search-head"><strong>搜尋全部效果</strong><select id="effect-group" aria-label="效果分類"></select></div><input id="effect-search" type="search" placeholder="搜尋名稱、種類或質感…" aria-label="搜尋聲音效果"><div id="effect-results" class="effect-results"></div></section><p id="hand-message" role="status"></p>`;
    const layout = document.createElement('div'); layout.className = 'card-workspace'; root.querySelector('.studio-heading').after(layout);
    const sidebar = document.createElement('aside'); sidebar.className = 'hand-sidebar'; layout.append(sidebar); sidebar.append(desk);
    const editor = document.createElement('section'); editor.className = 'card-editor'; layout.append(editor);
    const selected = this.studio.state.layers.find(layer => layer.id === this.selected);
    const heading = document.createElement('div'); heading.className = 'editor-heading'; heading.innerHTML = '<small>SELECTED CARD</small><h2></h2>'; heading.querySelector('h2').textContent = selected ? selected.name : '從卡池加入聲音'; editor.append(heading);
    for (const selector of ['.studio-dials', '#carrier-stack', '.spectrum-panel', '.studio-bottom']) editor.append(root.querySelector(selector));
    editor.classList.toggle('editor-empty', !selected);
    if (selected) {
      const keys = selected.id === 'carrier' ? ['carrier','beat','waveform','swing','motionRate','motionDepth']
        : selected.id === 'noise' ? ['noise'] : selected.id === 'arp' ? ['arpeggio','arpeggioRoot']
        : selected.id === 'rhythm' ? ['bpm','rhythm'] : selected.tempo || selected.type === 'sequence' ? ['bpm'] : [];
      editor.querySelectorAll('[data-parameter]').forEach(control => { control.hidden = !keys.includes(control.dataset.parameter); });
      editor.querySelector('#carrier-stack').hidden = selected.id !== 'carrier';
      editor.querySelector('.studio-dials').hidden = !keys.some(key => ['carrier','beat','bpm'].includes(key));
      editor.querySelector('.radio-panel').hidden = selected.id !== 'radio';
      editor.querySelector('.studio-bottom details').hidden = !keys.some(key => !['carrier','beat','bpm'].includes(key));
      this.studio.equalizer.destroy(); const engine = this.studio.engine, id = selected.id;
      const facade = { state: { eq: selected.eq }, engine: {
        get playing() { return engine.playing; }, get output() { return engine.output; },
        get analyser() { return engine.channels.get(id)?.analyser; }, get eqFilters() { return engine.channels.get(id)?.filters || []; },
        setEQ: eq => engine.setLayerEQ(id, eq)
      }};
      this.studio.equalizer = new Equalizer(facade, editor.querySelector('.spectrum-panel'));
      editor.querySelector('.spectrum-panel small').textContent = 'CARD SPECTRUM / EQ';
      const material = this.catalogue.find(item => item.id === selected.id);
      if (material?.type?.startsWith('texture-')) {
        const controls = document.createElement('section'); controls.className = 'panel material-controls';
        controls.innerHTML = `<div class="panel-head"><div><small>SOUND CHARACTER</small><h2>聲音質感</h2></div><button type="button" id="randomize-material">隨機</button></div><div class="material-control-grid"></div>`;
        const grid = controls.querySelector('.material-control-grid');
        if (material.variants) {
          const label = document.createElement('label'); label.className = 'select-control'; label.innerHTML = `<span>聲音變體</span><select>${material.variants.map(([id,name]) => `<option value="${id}">${name}</option>`).join('')}</select>`;
          label.querySelector('select').value = selected.config.materialVariant; label.querySelector('select').onchange = e => { selected.config.materialVariant = e.target.value; this.studio.update(); }; grid.append(label);
        }
        for (const [key,name] of [['materialIntensity','強度'],['materialMotion','動態']]) {
          const label = document.createElement('label'); label.className = 'control'; label.innerHTML = `<span class="control-head">${name}<output>${Math.round(selected.config[key] * 100)}%</output></span><input type="range" min="0" max="1" step=".01" value="${selected.config[key]}">`;
          const input = label.querySelector('input');
          input.oninput = e => { selected.config[key] = Number(e.target.value); label.querySelector('output').textContent = `${Math.round(selected.config[key] * 100)}%`; clearTimeout(this.materialUpdate); this.materialUpdate = setTimeout(() => this.studio.update(), 70); };
          input.onchange = () => { clearTimeout(this.materialUpdate); this.studio.update(); }; grid.append(label);
        }
        if (material.type === 'texture-traffic') {
          for (const [key,name,min,max,step,unit] of [['trafficSpeed','速度',10,140,1,' km/h'],['trafficPeriod','週期',5,30,1,' 秒'],['trafficCount','數量',1,12,1,' 個']]) {
            const label = document.createElement('label'); label.className = 'control traffic-control'; label.innerHTML = `<span class="control-head">${name}<output>${selected.config[key]}${unit}</output></span><input type="range" min="${min}" max="${max}" step="${step}" value="${selected.config[key]}">`;
            const input = label.querySelector('input'); input.oninput = e => { selected.config[key] = Number(e.target.value); label.querySelector('output').textContent = `${selected.config[key]}${unit}`; clearTimeout(this.materialUpdate); this.materialUpdate = setTimeout(() => this.studio.update(), 90); }; input.onchange = () => { clearTimeout(this.materialUpdate); this.studio.update(); }; grid.append(label);
          }
        }
        controls.querySelector('#randomize-material').onclick = () => { selected.config.materialIntensity = .2 + Math.random() * .8; selected.config.materialMotion = Math.random(); if (material.variants) selected.config.materialVariant = material.variants[Math.floor(Math.random() * material.variants.length)][0]; if (material.type === 'texture-traffic') { selected.config.trafficSpeed = 25 + Math.round(Math.random() * 85); selected.config.trafficCount = 2 + Math.floor(Math.random() * 7); } this.studio.update(); this.studio.render(root); };
        editor.querySelector('.spectrum-panel').before(controls);
      }
    }
    const zone = root.querySelector('#hand-zone');
    for (const id of this.studio.state.handIds) {
      const layer = this.studio.state.layers.find(item => item.id === id);
      const row = document.createElement('div'); row.className = 'hand-row'; row.dataset.layer = id;
      const card = document.createElement('button'); card.type = 'button'; card.className = 'strip-card'; card.innerHTML = '<small></small><strong></strong><output></output>';
      card.querySelector('small').textContent = layer.group; card.querySelector('strong').textContent = layer.name;
      const paint = () => { card.querySelector('output').textContent = `${Math.round(layer.level * 100)}%`; card.style.setProperty('--level', `${layer.level * 100}%`); card.classList.toggle('selected', this.selected === id); card.classList.toggle('enabled', layer.enabled); card.setAttribute('aria-label', `${layer.name} ${Math.round(layer.level * 100)}%，選取調整`); };
      const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'card-switch'; toggle.textContent = layer.enabled ? 'ON' : 'OFF'; toggle.setAttribute('aria-label', `開關 ${layer.name}`); toggle.setAttribute('aria-pressed', layer.enabled);
      toggle.onclick = () => { layer.enabled = !layer.enabled; toggle.textContent = layer.enabled ? 'ON' : 'OFF'; toggle.setAttribute('aria-pressed', layer.enabled); paint(); this.studio.update(); };
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'card-switch'; remove.textContent = '×'; remove.setAttribute('aria-label', `移除 ${layer.name}`); remove.onclick = () => this.remove(id);
      cardGesture(card, { value: () => layer.level, volume: value => { layer.level = value; paint(); this.studio.update(); }, select: () => { this.selected = id; this.studio.render(root); }, remove: () => this.remove(id) });
      paint(); row.append(card, toggle, remove); zone.append(row);
    }
    if (!this.studio.state.handIds.length) zone.textContent = '把候選卡拖到這裡，或點擊加入';
    zone.ondragover = e => { e.preventDefault(); zone.classList.add('drop-active'); }; zone.ondragleave = () => zone.classList.remove('drop-active');
    zone.ondrop = e => { e.preventDefault(); zone.classList.remove('drop-active'); this.add(e.dataTransfer.getData('text/plain')); };
    const makeCandidate = (item, target) => {
      const card = document.createElement('button'); card.type = 'button'; card.className = 'pool-card'; card.draggable = true; card.dataset.material = item.id;
      const group = document.createElement('small'); group.textContent = item.group; const name = document.createElement('strong'); name.textContent = item.name; card.append(group, name);
      card.onclick = () => this.add(item.id); card.ondragstart = e => e.dataTransfer.setData('text/plain', item.id);
      let touch;
      card.onpointerdown = e => { if (e.pointerType !== 'mouse') { touch = true; card.setPointerCapture(e.pointerId); } };
      card.onpointerup = e => { if (!touch) return; const r = zone.getBoundingClientRect(); if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) this.add(item.id); touch = false; };
      card.onpointercancel = () => { touch = false; }; target.append(card);
    };
    root.querySelector('#refresh-pool').onclick = () => { this.refresh(); this.studio.render(root); };
    for (const item of this.pool) makeCandidate(item, root.querySelector('#draw-pool'));
    const groupSelect = root.querySelector('#effect-group');
    const groups = ['ALL', ...new Set(this.catalogue.map(item => item.group))];
    groupSelect.innerHTML = groups.map(group => `<option value="${group}">${group === 'ALL' ? '全部種類' : group}</option>`).join(''); groupSelect.value = this.group;
    const showResults = () => {
      this.search = root.querySelector('#effect-search').value; this.group = groupSelect.value;
      const query = this.search.trim().toLocaleLowerCase(); const held = this.studio.state.handIds;
      const matches = this.catalogue.filter(item => !held.includes(item.id) && (this.group === 'ALL' || item.group === this.group) && (!query || `${item.name} ${item.group} ${item.note || ''} ${item.tags || ''}`.toLocaleLowerCase().includes(query)));
      const results = root.querySelector('#effect-results'); results.replaceChildren(); matches.slice(0, 12).forEach(item => makeCandidate(item, results));
      if (!matches.length) results.textContent = '找不到符合的效果';
      else if (matches.length > 12) { const more = document.createElement('small'); more.className = 'search-more'; more.textContent = `另有 ${matches.length - 12} 個，輸入關鍵字縮小範圍`; results.append(more); }
    };
    root.querySelector('#effect-search').value = this.search; root.querySelector('#effect-search').oninput = showResults; groupSelect.onchange = showResults; showResults();
    const saved = document.createElement('section'); saved.className = 'panel base-cards';
    saved.innerHTML = `<h2>經典調配</h2><form id="save-base"><input name="baseName" maxlength="80" placeholder="替這副基底命名" aria-label="基底聲卡名稱" required><button type="submit">保存基底聲卡</button></form><div id="base-list"></div><a href="#/perform">前往 07 演奏 →</a>`; sidebar.append(saved);
    saved.querySelector('input').value = this.name; saved.querySelector('input').oninput = e => { this.name = e.target.value; };
    try { for (const card of readCollection(CARD_KEY)) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'saved-card'; button.textContent = `${card.name} · ${card.state.layers.length} 層`; button.onclick = () => { this.studio.stop(); this.studio.state = structuredClone(card.state); this.name = card.name; this.studio.render(root); }; saved.querySelector('#base-list').append(button);
    }} catch (error) { this.message(error.message); }
    saved.querySelector('form').onsubmit = e => {
      e.preventDefault(); if (!this.studio.state.handIds.length) { this.message('先加入至少一張聲卡。'); return; }
      try { const cards = readCollection(CARD_KEY); cards.push(snapshotCard(this.name, this.studio.state)); saveCollection(CARD_KEY, cards); this.studio.render(root); this.message('基底已保存，可在 07 的聲卡槽使用。'); } catch { this.message('儲存失敗，請確認瀏覽器儲存空間。'); }
    };
    const legacy = document.createElement('details'); legacy.className = 'legacy-library'; legacy.innerHTML = '<summary>既有收藏與感想</summary>'; const old = root.querySelector('.collection-section'); old.before(legacy); legacy.append(old);
  }
}
