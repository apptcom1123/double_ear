import { StudioEngine, materials } from './studio-engine.js';
import { arpeggioStyles, getPage } from './experiments.js';
import { carrierStack, clamp } from './audio-utils.js';
import { Equalizer, defaultEQ } from './equalizer.js';
import { Library } from './library.js';
import { Hand } from './hand.js';

export class Studio {
  constructor(onPlay) {
    this.engine = new StudioEngine();
    this.onPlay = onPlay;
    this.state = {
      eq: defaultEQ(),
      config: {...getPage('mixer').config, noise:'brown', arpeggio:'dew', rhythm:'3:4'},
      radioUrl: '',
      layers: [
        {id:'carrier',name:'雙耳載波',group:'CORE',note:'獨立頻率與差頻',enabled:true,level:.45},
        {id:'noise',name:'噪音底床',group:'CORE',note:'棕・綠・白',enabled:false,level:.12},
        {id:'arp',name:'植物琶音',group:'CORE',note:'八種電子音型',enabled:false,level:.12},
        {id:'rhythm',name:'雙耳錯拍',group:'CORE',note:'跟隨主節拍',enabled:false,level:.12},
        ...materials.map(item=>({...item,enabled:false,level:.3})),
        {id:'radio',name:'老式廣播',group:'RADIO',note:'原始廣告錄音',enabled:false,level:.18}
      ]
    };
    this.tracks = [];
    this.hand = new Hand(this);
    this.library = new Library(this);
    this.engine.onRadioStatus = text => { const el=document.querySelector('#radio-status'); if(el) el.textContent=text; };
  }
  get playing() { return this.engine.playing; }
  setVolume(value) {
    this.engine.setVolume(value);
    const input=document.querySelector('#master-volume'),output=document.querySelector('#master-volume-value');
    if(input)input.value=value;if(output)output.textContent=`${Math.round(Number(value)*100)}%`;
  }
  stop() { this.library.stop(); this.engine.stop(); this.onPlay(false); }
  async play() {
    if(this.library.paused){await this.library.toggle();return;}
    await this.engine.start(this.state); if(this.playing)this.onPlay(true);
  }
  update() { this.engine.update(this.state); }
  render(root) {
    this.root=root;
    this.equalizer?.destroy();
    this.state.eq??=defaultEQ();
    this.state.config.extraCarriers??=[];
    this.hand.prepare();
    root.innerHTML = `<section class="studio-heading"><div><span class="eyebrow">06 / SOUND DESK</span><h1>把聲音，疊成你的空間。</h1></div><label class="scene-select">場景<select id="studio-scene"><option value="">自訂混音</option><option value="orbit">深空電台</option><option value="night">午夜街機</option><option value="garden">漂浮花園</option><option value="shaman">薩滿聲景</option></select></label></section>
      <section class="studio-dials" id="studio-dials"></section>
      <section class="sound-desk"><div class="section-head"><h2>聲音素材</h2><p>點一下開關 · 上下拖曳／滾輪調音量 · 方向鍵微調</p></div><div class="sound-grid" id="sound-grid"></div></section>
      <section class="studio-bottom"><details class="panel"><summary>聲音細節 <span>音色・空間・錯拍</span></summary><div id="studio-details" class="controls"></div></details>
      <div class="panel radio-panel"><div class="radio-head"><strong>RADIO / 老式廣播</strong><small id="radio-count">載入素材庫</small></div><input id="radio-search" type="search" placeholder="搜尋廣告名稱…" aria-label="搜尋廣播"><label class="select-control">廣播素材<select id="radio-track"><option>載入中…</option></select></label><p id="radio-status" role="status">選曲後，點亮「老式廣播」卡片即可加入混音。</p></div></section>`;
    const spectrum=document.createElement('section');spectrum.className='panel spectrum-panel';
    root.querySelector('.sound-desk').after(spectrum);
    this.equalizer=new Equalizer(this,spectrum);
    const collection=document.createElement('section');collection.className='collection-section';root.append(collection);
    this.library.mount(collection);
    const dials = [
      ['carrier','基礎頻率','Hz',80,900,.1,[136.1,200,400,432,480,852]],
      ['beat','雙耳差頻','Hz',0,40,.01,[0,2.5,3,4,7.83,14,18,40]],
      ['bpm','主節拍','BPM',40,160,1,[60,80,120,128]]
    ];
    for(const [key,name,unit,min,max,step,stops] of dials) {
      const element=document.createElement('div'); element.className='studio-dial'; element.dataset.parameter=key;
      element.innerHTML=`<label for="dial-${key}">${name}<span><output>${this.state.config[key]}</output> ${unit}</span></label><input id="dial-${key}" type="range" min="${min}" max="${max}" step="${step}" value="${this.state.config[key]}" list="stops-${key}"><datalist id="stops-${key}">${stops.map(v=>`<option value="${v}"></option>`).join('')}</datalist><div class="dial-stops">${stops.map(v=>`<button type="button" data-value="${v}" aria-label="${name} ${v} ${unit}">${v}</button>`).join('')}</div>`;
      const input=element.querySelector('input');
      const apply=value=>{this.state.config[key]=Number(value);input.value=value;element.querySelector('output').textContent=value;if(key==='carrier')this.renderCarriers();this.update();};
      input.addEventListener('input',()=>apply(input.value));
      element.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>apply(button.dataset.value)));
      root.querySelector('#studio-dials').append(element);
    }
    const stack=document.createElement('details');stack.className='panel carrier-stack';stack.id='carrier-stack';
    stack.innerHTML='<summary>多基頻疊加 <span id="carrier-count"></span></summary><div id="carrier-stack-controls"></div>';
    root.querySelector('#studio-dials').after(stack);
    stack.open=this.state.config.extraCarriers.length>0;
    this.renderCarriers();
    // Compact hand cards are mounted after the parameter editors.
    const options = [
      ['waveform','載波波形',[['sine','正弦'],['square','方波']]],
      ['noise','噪音頻譜',[['brown','棕噪音'],['green','綠噪音'],['white','白噪音']]],
      ['arpeggio','琶音風格',Object.entries(arpeggioStyles).filter(([id])=>id!=='off').map(([id,s])=>[id,s.label])],
      ['rhythm','專用錯拍比例',['3:4','3:7','4:7','5:7'].map(v=>[v,v])]
    ];
    options.forEach(([key,label,values])=>{
      const el=document.createElement('label');el.className='select-control';el.dataset.parameter=key;
      el.innerHTML=`${label}<select>${values.map(([id,text])=>`<option value="${id}">${text}</option>`).join('')}</select>`;
      el.querySelector('select').value=this.state.config[key];
      el.querySelector('select').onchange=e=>{this.state.config[key]=e.target.value;this.update();};
      root.querySelector('#studio-details').append(el);
    });
    [['swing','差頻擺幅',0,3,.1],['motionRate','空間移動 Hz',0,7,.05],['motionDepth','空間深度',0,1,.01],['arpeggioRoot','琶音根音 Hz',440,1400,1]].forEach(([key,label,min,max,step])=>{
      const el=document.createElement('label');el.className='control';el.dataset.parameter=key;
      el.innerHTML=`<span class="control-head">${label}<output>${this.state.config[key]}</output></span><input type="range" min="${min}" max="${max}" step="${step}" value="${this.state.config[key]}">`;
      el.querySelector('input').oninput=e=>{this.state.config[key]=Number(e.target.value);el.querySelector('output').textContent=e.target.value;this.update();};
      root.querySelector('#studio-details').append(el);
    });
    root.querySelector('#radio-search').oninput=()=>this.renderTracks();
    root.querySelector('#radio-track').onchange=e=>{this.state.radioUrl=e.target.value;const radio=this.state.layers.find(layer=>layer.id==='radio');if(radio)radio.radioUrl=e.target.value;this.update();};
    root.querySelector('#studio-scene').onchange=e=>this.scene(e.target.value,root);
    this.hand.mount(root);
    this.loadTracks();
  }
  renderCarriers() {
    const host=this.root.querySelector('#carrier-stack-controls');if(!host)return;
    const config=this.state.config;
    this.root.querySelector('#carrier-count').textContent=`${carrierStack(config).length} 個基頻`;
    host.innerHTML='<div class="carrier-presets"></div><div class="carrier-chips"></div><p class="hint">共用差頻、擺盪與空間設定，由「雙耳載波」卡片控制總音量。最多 4 個基頻，相同頻率自動合併；疊加時自動縮減各層增益。</p>';
    const presets=[['單基頻',null],['低頻三層',[100,150,200]],['四層疊加',[100,136.1,150,200]]];
    for(const [name,values] of presets) {
      const button=document.createElement('button');button.type='button';button.textContent=name;
      button.onclick=()=>{if(values){config.carrier=values[0];config.extraCarriers=values.slice(1);}else config.extraCarriers=[];
        const main=this.root.querySelector('#dial-carrier');main.value=config.carrier;main.closest('.studio-dial').querySelector('output').textContent=config.carrier;
        this.renderCarriers();this.update();};
      host.querySelector('.carrier-presets').append(button);
    }
    const chips=host.querySelector('.carrier-chips');
    const main=document.createElement('span');main.className='carrier-chip';main.textContent=`主基頻 ${config.carrier} Hz`;chips.append(main);
    config.extraCarriers.forEach((frequency,index)=>{
      const chip=document.createElement('label');chip.className='carrier-chip';
      chip.innerHTML=`<span>＋</span><input type="number" min="80" max="900" step=".1" list="stops-carrier" aria-label="附加基頻 ${index+1}"><span>Hz</span><button type="button" aria-label="移除附加基頻 ${index+1}">×</button>`;
      const input=chip.querySelector('input');input.value=frequency;
      input.onchange=()=>{const value=Number(input.value);if(!input.value||!Number.isFinite(value)){input.value=frequency;return;}config.extraCarriers[index]=clamp(value,80,900);this.renderCarriers();this.update();};
      chip.querySelector('button').onclick=()=>{config.extraCarriers.splice(index,1);this.renderCarriers();this.update();};chips.append(chip);
    });
    const add=document.createElement('button');add.type='button';add.textContent='＋ 基頻';add.disabled=config.extraCarriers.length>=3;
    add.onclick=()=>{const used=carrierStack(config);config.extraCarriers.push([100,150,200,432,852].find(f=>!used.includes(f)));this.renderCarriers();this.update();};chips.append(add);
  }
  card(root,layer) {
    const card=document.createElement('button');card.type='button';card.className='sound-card';card.dataset.layer=layer.id;
    card.innerHTML=`<span class="sound-group">${layer.group}<i></i></span><strong>${layer.name}</strong><span class="sound-note">${layer.note}</span><span class="sound-value"></span><span class="sound-fill" aria-hidden="true"></span>`;
    const paint=()=>{
      card.classList.toggle('enabled',layer.enabled);card.style.setProperty('--level',`${layer.level*100}%`);
      card.setAttribute('aria-pressed',String(layer.enabled));
      card.setAttribute('aria-label',`${layer.name}，${layer.enabled?'已開啟':'已關閉'}，音量 ${Math.round(layer.level*100)}%。上下拖曳、滾輪或方向鍵調整。`);
      card.querySelector('.sound-value').textContent=`${layer.enabled?'ON':'OFF'} / ${Math.round(layer.level*100)}%`;
    };
    let origin=null,moved=false,suppress=false;
    const volume=v=>{layer.level=clamp(v,0,1);paint();this.update();};
    card.addEventListener('pointerdown',e=>{origin={y:e.clientY,value:layer.level};moved=false;card.setPointerCapture(e.pointerId);});
    card.addEventListener('pointermove',e=>{if(!origin)return;const delta=origin.y-e.clientY;if(Math.abs(delta)>4)moved=true;if(moved)volume(origin.value+delta/180);});
    card.addEventListener('pointerup',()=>{suppress=moved;origin=null;});
    card.addEventListener('pointercancel',()=>{origin=null;suppress=true;});
    card.addEventListener('click',()=>{if(suppress){suppress=false;return;}layer.enabled=!layer.enabled;paint();this.update();});
    card.addEventListener('wheel',e=>{e.preventDefault();volume(layer.level+(e.deltaY<0?.025:-.025));},{passive:false});
    card.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','Home','End'].includes(e.key)){e.preventDefault();volume(e.key==='Home'?0:e.key==='End'?1:layer.level+(e.key==='ArrowUp'?.025:-.025));}});
    paint();root.querySelector('#sound-grid').append(card);
  }
  async loadTracks() {
    try {
      if(!this.tracks.length){const response=await fetch('/assets/radio-index.json');if(!response.ok)throw new Error();this.tracks=await response.json();}
      if(!this.state.radioUrl)this.state.radioUrl=this.tracks[0]?.url||'';
      this.renderTracks();this.update();
    }catch{const status=document.querySelector('#radio-status');if(status)status.textContent='素材庫無法載入，請用 npm start 啟動網頁。';}
  }
  renderTracks() {
    const select=document.querySelector('#radio-track');if(!select)return;
    const query=document.querySelector('#radio-search').value.toLowerCase();
    const filtered=this.tracks.filter(t=>t.name.toLowerCase().includes(query));
    select.replaceChildren();
    for(const track of filtered){const option=new Option(track.name,track.url);select.add(option);}
    select.value=this.state.radioUrl;
    if(!filtered.length)select.add(new Option('沒有符合的素材',''));
    document.querySelector('#radio-count').textContent=`${filtered.length} / ${this.tracks.length} 段`;
  }
  scene(id,root) {
    const settings={orbit:['nebula','engine','radio'],night:['tape','arcade','radio'],garden:['carrier','noise','arp','nebula'],shaman:['frame-drum','seed-rattle','overtone-chant','ritual-bell']}[id];
    if(!settings)return;
    this.state.handIds = [...settings];
    this.state.layers.forEach(layer=>{layer.enabled=settings.includes(layer.id);});
    this.update();this.render(root);
    root.querySelector('#studio-scene').value=id;
  }
}
