import { AudioEngine } from './audio-engine.js';
import { seededRandom } from './audio-utils.js';

export function dopplerRatios(speedKmh) {
  const metresPerSecond = Math.max(10, Math.min(140, Number(speedKmh))) / 3.6;
  return { approach: 343 / (343 - metresPerSecond), recede: 343 / (343 + metresPerSecond) };
}
export function trafficOffsets(count, period, random = Math.random) {
  return Array.from({ length: Math.max(1, Math.min(12, Math.round(count))) }, () => random() * period * .82).sort((a,b) => a-b);
}

export const materials = [
  { id: 'nebula', name: '星雲和弦', group: 'SPACE', note: '緩慢漂浮的寬幅和弦', type: 'pad', wave: 'sine', notes: [0,7,14,19], root: 110 },
  { id: 'engine', name: '深空引擎', group: 'SPACE', note: '低頻持續音與緩慢脈動', type: 'pad', wave: 'triangle', notes: [0,7,12], root: 55 },
  { id: 'radar', name: '軌道雷達', group: 'SPACE', note: '左右回音的探測訊號', type: 'sequence', wave: 'sine', notes: [12,19,24,7], root: 440, division: .5 },
  { id: 'comet-choir', name: '彗星合唱', group: 'SPACE', note: '高速掠過的泛音尾跡', type: 'sequence', wave: 'triangle', notes: [24,19,31,14], root: 220, division: .5, sweep: true },
  { id: 'void-pulse', name: '虛空脈衝', group: 'SPACE', note: '低頻真空節拍與寬幅漂移', type: 'pad', wave: 'sine', notes: [0,5,12,17], root: 42 },
  { id: 'tape', name: '磁帶暖墊', group: 'RETRO', note: '微幅走音的類比合成器', type: 'pad', wave: 'sawtooth', notes: [0,4,7,12], root: 130.81 },
  { id: 'arcade', name: '像素街機', group: 'RETRO', note: '隨節拍跳動的方波序列', type: 'sequence', wave: 'square', notes: [0,12,7,19,4,16,7,12], root: 220, division: 2 },
  { id: 'laser', name: '復古雷射', group: 'RETRO', note: '下滑音高與延遲尾音', type: 'sequence', wave: 'sawtooth', notes: [12,7,19,0], root: 440, division: .5, sweep: true },
  { id: 'crt-rain', name: 'CRT 雨幕', group: 'RETRO', note: '映像管高鳴與像素雨點', type: 'sequence', wave: 'square', notes: [24,31,19,28,16], root: 196, division: 2 },
  { id: 'cassette-keys', name: '卡帶鍵群', group: 'RETRO', note: '溫暖失準的老鍵盤和弦', type: 'pad', wave: 'triangle', notes: [0,3,7,10], root: 146.83 },
  { id: 'frame-drum', name: '薩滿框鼓', group: 'SHAMAN', note: '深沉皮鼓與四拍呼吸', type: 'shaman-drum', tempo: true },
  { id: 'seed-rattle', name: '種籽沙鈴', group: 'SHAMAN', note: '細碎顆粒環繞移動', type: 'shaman-rattle', tempo: true },
  { id: 'overtone-chant', name: '泛音吟唱', group: 'SHAMAN', note: '低沉持續音與泛音漂移', type: 'shaman-drone' },
  { id: 'ritual-bell', name: '儀式金屬鈴', group: 'SHAMAN', note: '非整數泛音與長尾回聲', type: 'shaman-bell', tempo: true },
  { id: 'cyber-dystopia', name: '反烏托邦低鳴', group: 'CYBER', note: '五種工業失真與機械低鳴', tags: '賽博龐克 霓虹 機械 industrial distortion', type: 'texture-cyber', variants: [['neon','霓虹變壓器'],['factory','重工機床'],['siren','封鎖警報'],['drone','城底低鳴'],['storm','資料風暴']] },
  { id: 'glitch-grains', name: '破碎微粒', group: 'GLITCH', note: '五種凍結與數位碎片', tags: '故障 顆粒 grains freeze crystal', type: 'texture-glitch', tempo: true, variants: [['freeze','冰結'],['crystal','水晶碎裂'],['buffer','緩衝錯誤'],['reverse','倒放切片'],['stutter','資料結巴']] },
  { id: 'vhs-lofi', name: 'VHS 暖霧', group: 'LO-FI', note: '五種錄音帶懷舊質感', tags: '復古 懷舊 蒸汽波 wow flutter tape', type: 'texture-lofi', variants: [['vapor','蒸汽波'],['hiphop','Lo-Fi Hip-Hop'],['homevideo','家庭錄影'],['worn','磨損卡帶'],['dream','夢境 VHS']] },
  { id: 'geological', name: '地層共振', group: 'EARTH', note: '五種岩層、礦物與洞穴聲景', tags: '地質 礦物 岩石 洞穴 resonance cave', type: 'texture-geology', variants: [['quake','地震低鳴'],['granite','花崗摩擦'],['cave','洞穴回聲'],['crystal','晶洞共振'],['magma','岩漿流動']] },
  { id: 'subatomic', name: '次原子振盪', group: 'MICRO', note: '五種微觀高速動態', tags: '微觀 量子 原子 昆蟲 high frequency', type: 'texture-micro', tempo: true, variants: [['quantum','量子跳躍'],['collision','原子碰撞'],['wings','微型翼振'],['cell','細胞脈衝'],['spark','奈米火花']] },
  { id: 'frog-choir', name: '蛙鳴群落', group: 'NATURE', note: '六種可切換的合成蛙鳴', tags: '蛙鳴 青蛙 池塘 frog', type: 'texture-frog', variants: [['bull','牛蛙'],['tree','樹蛙'],['rain','雨蛙'],['marsh','澤蛙'],['reed','葦澤蛙'],['glass','玻璃蛙']] },
  { id: 'mushroom-signals', name: '蘑菇訊號', group: 'BIO', note: '五種菌絲電訊號序列', tags: '蘑菇 菌絲 電磁 植物 mushroom', type: 'texture-mushroom', tempo: true, variants: [['mycelium','菌絲脈衝'],['spore','孢子雨'],['morel','羊肚菌碼'],['oyster','平菇波'],['glow','夜光菇']] },
  { id: 'bianzhong', name: '五組編鐘', group: 'BELL', note: '五套固定音程與青銅泛音', tags: '編鐘 鐘磬 青銅 chinese bell', type: 'texture-bells', tempo: true, variants: [['gong','宮調'],['shang','商調'],['jue','角調'],['zhi','徵調'],['yu','羽調']] },
  { id: 'traffic-stage', name: '交通舞台', group: 'TRAFFIC', note: '隨機車流、行人與緊急車輛的都卜勒循環', tags: '交通 汽車 機車 行人 救護車 警車 traffic car motorcycle pedestrian ambulance police doppler', type: 'texture-traffic', variants: [['mixed','混合街道'],['car','汽車'],['motorcycle','機車'],['pedestrian','行人'],['ambulance','救護車'],['police','警車']] },
  { id:'runway-glass',name:'Runway Glass',group:'FASHION',note:'透明伸展台和弦',tags:'時尚 秀場 runway fashion',type:'pad',wave:'sine',notes:[0,7,11,19],root:164.81 },
  { id:'chrome-pulse',name:'Chrome Pulse',group:'FASHION',note:'金屬感節拍脈衝',tags:'時尚 金屬 chrome',type:'sequence',wave:'square',notes:[0,12,7,19,14],root:220,division:2,tempo:true },
  { id:'silk-motion',name:'Silk Motion',group:'FASHION',note:'絲質柔滑漂移',tags:'時尚 絲質 ambient',type:'pad',wave:'triangle',notes:[0,4,9,16],root:146.83 },
  { id:'editorial-flash',name:'Editorial Flash',group:'FASHION',note:'攝影棚閃光短音',tags:'時尚 攝影 閃光',type:'sequence',wave:'sawtooth',notes:[24,12,19,31,7],root:246.94,division:4,tempo:true },
  { id:'couture-air',name:'Couture Air',group:'FASHION',note:'高級訂製空氣墊底',tags:'時尚 couture pad',type:'pad',wave:'sine',notes:[0,5,12,21],root:130.81 },
  { id:'midnight-lounge',name:'Midnight Lounge',group:'BAR',note:'午夜爵士酒吧暖墊',tags:'酒吧 爵士 lounge',type:'pad',wave:'triangle',notes:[0,3,7,10],root:110 },
  { id:'cocktail-chime',name:'Cocktail Chime',group:'BAR',note:'杯緣清脆碰響',tags:'酒吧 雞尾酒 杯子',type:'sequence',wave:'sine',notes:[12,19,24,31,16],root:261.63,division:1,tempo:true },
  { id:'vinyl-booth',name:'Vinyl Booth',group:'BAR',note:'唱片 DJ 台低頻霧',tags:'酒吧 黑膠 DJ',type:'pad',wave:'sawtooth',notes:[0,7,10,15],root:82.41 },
  { id:'neon-bourbon',name:'Neon Bourbon',group:'BAR',note:'霓虹威士忌節奏',tags:'酒吧 霓虹 bourbon',type:'sequence',wave:'triangle',notes:[0,5,8,12,17],root:174.61,division:2,tempo:true },
  { id:'rooftop-haze',name:'Rooftop Haze',group:'BAR',note:'屋頂酒吧夜霧',tags:'酒吧 屋頂 夜景',type:'pad',wave:'sine',notes:[0,2,7,14],root:123.47 },
  { id:'acid-tunnel',name:'Acid Tunnel',group:'CLUB',note:'酸性共振地下通道',tags:'夜店 acid club',type:'sequence',wave:'sawtooth',notes:[0,12,3,15,7,19],root:110,division:4,tempo:true },
  { id:'laser-strobe',name:'Laser Strobe',group:'CLUB',note:'雷射與頻閃短音',tags:'夜店 雷射 strobe',type:'sequence',wave:'square',notes:[24,31,19,36,12],root:220,division:4,tempo:true },
  { id:'warehouse-bass',name:'Warehouse Bass',group:'CLUB',note:'倉庫派對低頻牆',tags:'夜店 倉庫 bass',type:'pad',wave:'sawtooth',notes:[0,7,12],root:41.2 },
  { id:'techno-relay',name:'Techno Relay',group:'CLUB',note:'工業科技接力節拍',tags:'夜店 techno industrial',type:'sequence',wave:'square',notes:[0,7,5,12,3,10],root:146.83,division:4,tempo:true },
  { id:'trance-gate',name:'Trance Gate',group:'CLUB',note:'門控迷幻和弦',tags:'夜店 trance gate',type:'sequence',wave:'sawtooth',notes:[0,7,12,16,19,24],root:130.81,division:2,tempo:true },
  { id:'disco-mirror',name:'Disco Mirror',group:'DANCE',note:'鏡球迪斯可反射',tags:'舞池 disco mirror',type:'sequence',wave:'sine',notes:[12,19,16,24,21],root:196,division:2,tempo:true },
  { id:'house-lift',name:'House Lift',group:'DANCE',note:'浩室上升和弦',tags:'舞池 house piano',type:'pad',wave:'triangle',notes:[0,4,7,11,14],root:130.81 },
  { id:'festival-drop',name:'Festival Drop',group:'DANCE',note:'大型舞台落拍提示',tags:'舞池 festival edm drop',type:'sequence',wave:'sawtooth',notes:[24,12,7,0,19,5],root:110,division:1,tempo:true,sweep:true },
  { id:'ballroom-glow',name:'Ballroom Glow',group:'DANCE',note:'舞廳柔亮弦光',tags:'舞池 ballroom glow',type:'pad',wave:'sine',notes:[0,5,9,12,17],root:146.83 },
  { id:'funk-floor',name:'Funk Floor',group:'DANCE',note:'切分放克舞步',tags:'舞池 funk groove',type:'sequence',wave:'square',notes:[0,7,10,5,12,3,15],root:164.81,division:4,tempo:true }
];

export class StudioEngine {
  constructor() {
    this.output = new AudioEngine();
    this.channels = new Map();
    this.radioCache = new Map();
    this.playing = false;
    this.version = 0;
    this.eqFilters = [];
  }
  prepareEQ() {
    if (this.analyser) return;
    const ctx = this.output.context;
    this.eqInput = ctx.createGain();
    let tail = this.eqInput;
    for (let i = 0; i < 5; i++) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'peaking'; filter.Q.value = 1;
      tail.connect(filter); tail = filter; this.eqFilters.push(filter);
    }
    tail.connect(this.output.master);
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 8192; this.analyser.smoothingTimeConstant = .8;
    this.output.compressor.disconnect();
    this.output.compressor.connect(this.analyser).connect(this.output.destination || ctx.destination);
  }
  setEQ(eq) {
    if (!this.eqFilters.length || !eq) return;
    eq.bands.forEach((band, i) => {
      const filter = this.eqFilters[i]; if (!filter) return;
      const now = this.output.context.currentTime;
      filter.frequency.setTargetAtTime(band.frequency, now, .035);
      filter.gain.setTargetAtTime(eq.enabled ? band.gain : 0, now, .035);
      filter.Q.setTargetAtTime(band.q, now, .035);
    });
  }
  setLayerEQ(id, eq) {
    const channel = this.channels.get(id);
    if (!channel?.filters || !eq) return;
    eq.bands.forEach((band, i) => {
      const filter = channel.filters[i]; if (!filter) return;
      const now = this.output.context.currentTime;
      filter.frequency.setTargetAtTime(band.frequency, now, .035);
      filter.gain.setTargetAtTime(eq.enabled ? band.gain : 0, now, .035);
      filter.Q.setTargetAtTime(band.q, now, .035);
    });
  }
  setVolume(value) { this.output.setVolume(value); }
  async start(state) {
    const version = ++this.version;
    await this.output.ensureContext();
    if (version !== this.version) return;
    this.prepareEQ();
    this.playing = this.output.playing = true;
    this.output.setVolume(this.output.volume);
    this.update(state);
  }
  dispose(channel) {
    if (!channel) return;
    channel.voice.playing = false;
    channel.voice.timers.forEach(clearInterval);
    const now = this.output.context.currentTime;
    channel.bus.gain.cancelScheduledValues(now);
    channel.bus.gain.setTargetAtTime(0, now, .035);
    setTimeout(() => {
      for (const node of channel.voice.nodes) {
        try { node.stop?.(); } catch {}
        node.disconnect();
      }
      channel.bus.disconnect();
    }, 200);
  }
  stop() {
    ++this.version;
    this.playing = this.output.playing = false;
    this.channels.forEach(channel => this.dispose(channel));
    this.channels.clear();
  }
  async update(state) {
    if (!this.playing) return;
    this.setEQ(state.eq);
    for (const [id, channel] of this.channels) {
      if (!state.layers.some(layer => layer.id === id)) { this.dispose(channel); this.channels.delete(id); }
    }
    for (const layer of state.layers) {
      const config = { ...state.config, ...layer.config };
      const relevant = layer.id === 'carrier' ? [config.carrier,config.extraCarriers,config.beat,config.swing,config.waveform,config.motionRate,config.motionDepth]
        : layer.id === 'noise' ? [config.noise]
        : layer.id === 'arp' ? [config.arpeggio, config.arpeggioRoot]
        : layer.id === 'rhythm' ? [config.bpm,config.rhythm]
        : layer.id === 'radio' ? [layer.radioUrl ?? state.radioUrl]
        : [materials.find(item=>item.id===layer.id)?.tempo || materials.find(item=>item.id===layer.id)?.type === 'sequence' ? config.bpm : 0,
          config.materialVariant, config.materialIntensity, config.materialMotion, config.trafficSpeed, config.trafficPeriod, config.trafficCount];
      const signature = JSON.stringify(relevant);
      const existing = this.channels.get(layer.id);
      if (!layer.enabled) {
        if (existing) this.dispose(existing);
        this.channels.delete(layer.id);
        continue;
      }
      if (existing?.signature === signature) {
        existing.bus.gain.setTargetAtTime(layer.level, this.output.context.currentTime, .04);
        this.setLayerEQ(layer.id, layer.eq);
        continue;
      }
      this.dispose(existing);
      const context = this.output.context;
      const bus = context.createGain();
      bus.gain.value = 0;
      bus.connect(this.eqInput);
      const voice = new AudioEngine();
      voice.context = context;
      voice.playing = true;
      const input = context.createGain(), filters = [];
      let tail = input;
      for (let i = 0; i < 5; i++) {
        const filter = context.createBiquadFilter(); filter.type = 'peaking'; filter.gain.value = 0;
        tail.connect(filter); tail = filter; filters.push(filter);
      }
      const analyser = context.createAnalyser(); analyser.fftSize = 8192;
      tail.connect(analyser).connect(bus); voice.track(input, ...filters, analyser);
      const channel = { bus, voice, signature, filters, analyser, input };
      this.channels.set(layer.id, channel);
      this.setLayerEQ(layer.id, layer.eq);
      voice.materialConfig = config;
      const full = { ...config, binauralLevel: 1, noiseLevel: 1, arpeggioLevel: 1, rhythmLevel: 1 };
      if (layer.id === 'carrier') voice.createBinaural(full, input);
      else if (layer.id === 'noise') voice.createNoise(full, input, seededRandom(config.seed || 783));
      else if (layer.id === 'arp') voice.createArpeggio(full, input, seededRandom(config.seed || 783));
      else if (layer.id === 'rhythm') voice.createRhythm(full, input);
      else if (layer.id === 'radio') this.loadRadio(layer.radioUrl ?? state.radioUrl, channel, layer.id);
      else this.synth(materials.find(item=>item.id===layer.id), voice, input, config.bpm);
      bus.gain.setTargetAtTime(layer.level, context.currentTime, .12);
    }
  }
  async loadRadio(url, channel, id) {
    if (!url) return;
    this.onRadioStatus?.('正在載入廣播…');
    try {
      let pending = this.radioCache.get(url);
      if (!pending) {
        pending = fetch(url).then(response => {
          if (!response.ok) throw new Error('廣播檔案讀取失敗');
          return response.arrayBuffer();
        }).then(buffer => this.output.context.decodeAudioData(buffer));
        this.radioCache.set(url, pending);
        if (this.radioCache.size > 4) this.radioCache.delete(this.radioCache.keys().next().value);
      }
      const buffer = await pending;
      if (!this.playing || this.channels.get(id) !== channel) return;
      const source = this.output.context.createBufferSource();
      const filter = this.output.context.createBiquadFilter();
      filter.type = 'bandpass'; filter.frequency.value = 1300; filter.Q.value = .45;
      source.buffer = buffer; source.loop = true;
      source.connect(filter).connect(channel.input);
      channel.voice.track(source, filter);
      source.start();
      this.onRadioStatus?.('廣播播放中 · 循環');
    } catch (error) {
      this.radioCache.delete(url);
      if (this.channels.get(id) === channel) this.onRadioStatus?.(error.message);
    }
  }
  shamanSynth(material, voice, bus, bpm) {
    const ctx = voice.context;
    const random = seededRandom(2027 + material.id.length);
    if (material.type === 'shaman-drone') {
      const filter = ctx.createBiquadFilter();
      const lfo = ctx.createOscillator();
      const sweep = ctx.createGain();
      filter.type = 'lowpass'; filter.frequency.value = 720; filter.Q.value = 5;
      lfo.frequency.value = .075; sweep.gain.value = 360;
      lfo.connect(sweep).connect(filter.frequency); filter.connect(bus);
      [1, 2, 3, 4.5].forEach((ratio, index) => {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        const pan = ctx.createStereoPanner();
        oscillator.type = index === 0 ? 'sawtooth' : 'sine';
        oscillator.frequency.value = 65.41 * ratio;
        gain.gain.value = [.055, .028, .018, .012][index];
        pan.pan.value = [-.15, .2, -.35, .4][index];
        oscillator.connect(gain).connect(pan).connect(filter);
        oscillator.start(); voice.track(oscillator, gain, pan);
      });
      lfo.start(); voice.track(filter, lfo, sweep);
      return;
    }

    const delay = ctx.createDelay(2);
    const feedback = ctx.createGain();
    const wet = ctx.createGain();
    delay.delayTime.value = material.type === 'shaman-bell' ? .46 : .23;
    feedback.gain.value = material.type === 'shaman-bell' ? .42 : .2;
    wet.gain.value = .28;
    bus.connect(delay); delay.connect(feedback).connect(delay); delay.connect(wet).connect(bus);
    voice.track(delay, feedback, wet);
    const rattleBuffer = material.type === 'shaman-rattle' ? (() => {
      const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * .16), ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * .045));
      return buffer;
    })() : null;
    let next = ctx.currentTime + .06;
    let step = 0;
    const schedule = () => {
      while (voice.playing && next < ctx.currentTime + .18) {
        if (material.type === 'shaman-drum') {
          const oscillator = ctx.createOscillator();
          const gain = ctx.createGain();
          const filter = ctx.createBiquadFilter();
          const accent = [1, .55, .78, .5][step % 4];
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(155, next);
          oscillator.frequency.exponentialRampToValueAtTime(46, next + .19);
          filter.type = 'lowpass'; filter.frequency.value = 520;
          gain.gain.setValueAtTime(.0001, next);
          gain.gain.exponentialRampToValueAtTime(.25 * accent, next + .006);
          gain.gain.exponentialRampToValueAtTime(.0001, next + .42);
          oscillator.connect(gain).connect(filter).connect(bus);
          oscillator.start(next); oscillator.stop(next + .44);
          oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); filter.disconnect(); };
          next += 60 / bpm;
        } else if (material.type === 'shaman-rattle') {
          const source = ctx.createBufferSource();
          const filter = ctx.createBiquadFilter();
          const gain = ctx.createGain();
          const pan = ctx.createStereoPanner();
          source.buffer = rattleBuffer;
          filter.type = 'bandpass'; filter.frequency.value = 2400 + random() * 1800; filter.Q.value = .7;
          gain.gain.value = (step % 4 === 0 ? .15 : .085) * (.75 + random() * .25);
          pan.pan.value = Math.sin(step * .8) * .72;
          source.connect(filter).connect(gain).connect(pan).connect(bus);
          source.start(next); source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); pan.disconnect(); };
          next += 60 / bpm / 2;
        } else {
          const root = [293.66, 329.63, 392][step % 3];
          [1, 2.71, 5.43].forEach((ratio, index) => {
            const oscillator = ctx.createOscillator();
            const gain = ctx.createGain();
            const pan = ctx.createStereoPanner();
            oscillator.type = 'sine'; oscillator.frequency.value = root * ratio;
            pan.pan.value = index === 1 ? -.25 : .25;
            gain.gain.setValueAtTime(.0001, next);
            gain.gain.exponentialRampToValueAtTime([.11, .045, .018][index], next + .009);
            gain.gain.exponentialRampToValueAtTime(.0001, next + 1.8);
            oscillator.connect(gain).connect(pan).connect(bus);
            oscillator.start(next); oscillator.stop(next + 1.82);
            oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); pan.disconnect(); };
          });
          next += 60 / bpm * 4;
        }
        step += 1;
      }
    };
    schedule(); voice.timers.push(setInterval(schedule, 60));
  }
  synth(material, voice, bus, bpm) {
    if (!material) return;
    if (material.type.startsWith('shaman-')) {
      this.shamanSynth(material, voice, bus, bpm);
      return;
    }
    if (material.type.startsWith('texture-')) {
      this.textureSynth(material, voice, bus, bpm);
      return;
    }
    const ctx = voice.context;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = material.id === 'tape' ? 1100 : 3800;
    const delay = ctx.createDelay(2), feedback = ctx.createGain(), wet = ctx.createGain();
    delay.delayTime.value = .375; feedback.gain.value = .32; wet.gain.value = .3;
    filter.connect(bus); filter.connect(delay); delay.connect(feedback).connect(delay); delay.connect(wet).connect(bus);
    voice.track(filter, delay, feedback, wet);
    if (material.type === 'pad') {
      material.notes.forEach((note,i) => {
        const osc = ctx.createOscillator(), gain = ctx.createGain(), pan = ctx.createStereoPanner();
        osc.type = material.wave; osc.frequency.value = material.root * 2**(note/12);
        gain.gain.value = .045; pan.pan.value = i % 2 ? .65 : -.65;
        const lfo = ctx.createOscillator(), depth = ctx.createGain();
        lfo.frequency.value = .08 + i*.027; depth.gain.value = material.id === 'tape' ? 9 : 4;
        lfo.connect(depth).connect(osc.detune);
        osc.connect(gain).connect(pan).connect(filter);
        voice.track(osc,gain,pan,lfo,depth); osc.start(); lfo.start();
      });
    } else {
      let next = ctx.currentTime + .05, index = 0;
      const schedule = () => {
        while (voice.playing && next < ctx.currentTime + .15) {
          const frequency = material.root * 2**(material.notes[index++ % material.notes.length]/12);
          if (material.sweep) {
            const osc = ctx.createOscillator(), gain = ctx.createGain();
            osc.type = material.wave;
            osc.frequency.setValueAtTime(frequency, next);
            osc.frequency.exponentialRampToValueAtTime(80, next+.3);
            gain.gain.setValueAtTime(.0001,next);
            gain.gain.exponentialRampToValueAtTime(.09,next+.008);
            gain.gain.exponentialRampToValueAtTime(.0001,next+.32);
            osc.connect(gain).connect(filter); osc.start(next); osc.stop(next+.34);
            osc.onended = () => { osc.disconnect(); gain.disconnect(); };
          } else voice.createToneEvent({frequency,time:next,duration:.18,level:.1,pan:index%2 ? -.65 : .65,type:material.wave},filter);
          next += 60/bpm/material.division;
        }
      };
      schedule(); voice.timers.push(setInterval(schedule,50));
    }
  }

  textureSynth(material, voice, bus, bpm) {
    const ctx = voice.context;
    const config = voice.materialConfig || {};
    const intensity = Math.max(.05, Math.min(1, config.materialIntensity ?? .5));
    const motion = Math.max(0, Math.min(1, config.materialMotion ?? .45));
    const variant = config.materialVariant || material.variants?.[0]?.[0] || '';
    const random = seededRandom(811 + material.id.length * 37);
    const delay = ctx.createDelay(2), feedback = ctx.createGain(), wet = ctx.createGain();
    delay.delayTime.value = material.type === 'texture-geology' ? .62 : .19 + motion * .23;
    feedback.gain.value = material.type === 'texture-geology' ? .54 : .18 + motion * .2;
    wet.gain.value = .18 + motion * .18;
    bus.connect(delay); delay.connect(feedback).connect(delay); delay.connect(wet).connect(bus);
    voice.track(delay, feedback, wet);
    const curve = amount => {
      const values = new Float32Array(1024);
      for (let i = 0; i < values.length; i++) { const x = i * 2 / (values.length - 1) - 1; values[i] = Math.tanh(x * amount); }
      return values;
    };
    const persistentTone = (frequency, type, level, destination = bus, detune = 0) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = type; osc.frequency.value = frequency; osc.detune.value = detune; gain.gain.value = level;
      osc.connect(gain).connect(destination); osc.start(); voice.track(osc, gain); return osc;
    };
    if (material.type === 'texture-traffic') {
      const period = Math.max(5, Math.min(30, config.trafficPeriod ?? 10));
      const count = Math.max(1, Math.min(12, Math.round(config.trafficCount ?? 5)));
      const speed = Math.max(10, Math.min(140, config.trafficSpeed ?? 50));
      const kinds = ['car','motorcycle','pedestrian','ambulance','police'];
      const removeTracked = nodes => { for (const node of nodes) { const index = voice.nodes.indexOf(node); if (index >= 0) voice.nodes.splice(index, 1); try { node.disconnect(); } catch {} } };
      const schedulePass = (kind, start, direction) => {
        const duration = kind === 'pedestrian' ? Math.max(3, Math.min(8, 10 - speed / 25)) : Math.max(1.35, Math.min(7, 190 / speed));
        const vehicleGain = ctx.createGain(), pan = ctx.createStereoPanner(), filter = ctx.createBiquadFilter();
        const peak = (.055 + intensity * .075) * (kind === 'motorcycle' ? .8 : 1);
        vehicleGain.gain.setValueAtTime(.0001, start); vehicleGain.gain.exponentialRampToValueAtTime(peak, start + duration * .47); vehicleGain.gain.exponentialRampToValueAtTime(.0001, start + duration);
        pan.pan.setValueAtTime(direction, start); pan.pan.linearRampToValueAtTime(-direction, start + duration);
        filter.type = 'lowpass'; filter.frequency.value = kind === 'pedestrian' ? 900 : 650 + intensity * 1900;
        vehicleGain.connect(filter).connect(pan).connect(bus);
        const common = [vehicleGain, filter, pan]; voice.track(...common);
        const finish = () => removeTracked(common);
        if (kind === 'pedestrian') {
          const steps = Math.max(6, Math.round(duration * 2.1));
          for (let i = 0; i < steps; i++) {
            const time = start + i * duration / steps, osc = ctx.createOscillator(), gain = ctx.createGain();
            osc.type = 'sine'; osc.frequency.setValueAtTime(105 + random() * 45, time); osc.frequency.exponentialRampToValueAtTime(48, time + .09);
            gain.gain.setValueAtTime(.0001,time);gain.gain.exponentialRampToValueAtTime(.065,time+.008);gain.gain.exponentialRampToValueAtTime(.0001,time+.12);osc.connect(gain).connect(vehicleGain);osc.start(time);osc.stop(time+.13);voice.track(osc,gain);osc.onended=()=>removeTracked([osc,gain]);
          }
          voice.timers.push(setTimeout(finish, Math.max(0,(start + duration - ctx.currentTime) * 1000 + 100)));
          return;
        }
        const bases = { car:72, motorcycle:118, ambulance:84, police:96 }, base = bases[kind] || 72;
        const { approach, recede } = dopplerRatios(speed);
        const oscillators = [];
        [1,2.03].forEach((ratio,index) => {
          const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type=index?'square':'sawtooth';osc.frequency.setValueAtTime(base*ratio*approach,start);osc.frequency.exponentialRampToValueAtTime(base*ratio,start+duration*.5);osc.frequency.exponentialRampToValueAtTime(base*ratio*recede,start+duration);gain.gain.value=index?.025:.065;osc.connect(gain).connect(vehicleGain);osc.start(start);osc.stop(start+duration+.03);voice.track(osc,gain);oscillators.push(osc,gain);
        });
        if (kind === 'ambulance' || kind === 'police') {
          const siren=ctx.createOscillator(),sirenGain=ctx.createGain(),low=kind==='ambulance'?620:740,high=kind==='ambulance'?880:980,rate=kind==='ambulance'?.42:.24;
          siren.type='sine';sirenGain.gain.value=.055+intensity*.035;
          for(let time=start,toggle=false;time<start+duration;time+=rate,toggle=!toggle){siren.frequency.setValueAtTime((toggle?high:low)*approach,time);siren.frequency.linearRampToValueAtTime((toggle?low:high)*(time<start+duration*.5?approach:recede),Math.min(start+duration,time+rate));}
          siren.connect(sirenGain).connect(vehicleGain);siren.start(start);siren.stop(start+duration+.03);voice.track(siren,sirenGain);oscillators.push(siren,sirenGain);
        }
        oscillators[0].onended = () => removeTracked([...common,...oscillators]);
      };
      let cycleStart = ctx.currentTime + .08;
      const scheduleCycle = () => {
        cycleStart = Math.max(cycleStart, ctx.currentTime + .05);
        const offsets = trafficOffsets(count, period, random);
        offsets.forEach(offset => { const kind = variant === 'mixed' ? kinds[Math.floor(random()*kinds.length)] : variant; schedulePass(kind, cycleStart + offset, random()>.5 ? -1 : 1); });
        cycleStart += period;
      };
      scheduleCycle();
      voice.timers.push(setInterval(() => { if (voice.playing) scheduleCycle(); }, period * 1000));
      return;
    }
    if (material.type === 'texture-cyber') {
      const profiles = { neon:[43.65,420,'sawtooth'], factory:[35,260,'square'], siren:[58,720,'sawtooth'], drone:[29,180,'triangle'], storm:[73,1200,'square'] };
      const [root,cutoff,wave] = profiles[variant] || profiles.neon;
      const shaper = ctx.createWaveShaper(), filter = ctx.createBiquadFilter(), lfo = ctx.createOscillator(), sweep = ctx.createGain();
      shaper.curve = curve(3 + intensity * 20); shaper.oversample = '4x'; filter.type = 'lowpass'; filter.frequency.value = cutoff + intensity * 900; filter.Q.value = variant === 'siren' ? 14 : 8;
      lfo.frequency.value = .12 + motion * 1.2; sweep.gain.value = 180 + motion * 520; lfo.connect(sweep).connect(filter.frequency);
      shaper.connect(filter).connect(bus); persistentTone(root,wave,.1,shaper,-8); persistentTone(root*1.26,'square',.055,shaper,7); lfo.start(); voice.track(shaper,filter,lfo,sweep); return;
    }
    if (material.type === 'texture-lofi') {
      const profiles = { vapor:[110,1550,.12], hiphop:[98,1100,.2], homevideo:[130.81,1900,.32], worn:[82.41,720,.48], dream:[146.83,2300,.08] };
      const [root,cutoff,wowRate] = profiles[variant] || profiles.vapor;
      const filter = ctx.createBiquadFilter(), shaper = ctx.createWaveShaper(); filter.type='lowpass'; filter.frequency.value=cutoff+intensity*500; shaper.curve=curve(1.5+intensity*3);
      shaper.connect(filter).connect(bus); voice.track(filter,shaper);
      [1,1.5,2].forEach((ratio,i)=>{ const osc=persistentTone(root*ratio,i===1?'triangle':'sawtooth',.035,shaper); const wow=ctx.createOscillator(),depth=ctx.createGain(); wow.frequency.value=wowRate+i*.07+motion*.18; depth.gain.value=5+motion*18; wow.connect(depth).connect(osc.detune); wow.start(); voice.track(wow,depth); }); return;
    }
    if (material.type === 'texture-geology') {
      const profiles = { quake:[28,160,9], granite:[43,360,5], cave:[35,240,13], crystal:[61,680,18], magma:[24,120,4] };
      const [root,cutoff,q] = profiles[variant] || profiles.quake;
      const filter=ctx.createBiquadFilter(); filter.type='lowpass'; filter.frequency.value=cutoff+intensity*160; filter.Q.value=q; filter.connect(bus); voice.track(filter);
      persistentTone(root,'sine',.13,filter); persistentTone(root*1.47,'triangle',.055,filter);
      const buffer=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),data=buffer.getChannelData(0); let brown=0;
      for(let i=0;i<data.length;i++){brown=(brown+(random()*2-1)*.025)/1.025;data[i]=brown*2.6;}
      const source=ctx.createBufferSource(), gain=ctx.createGain();source.buffer=buffer;source.loop=true;gain.gain.value=.07+intensity*.07;source.connect(gain).connect(filter);source.start();voice.track(source,gain);return;
    }
    const profiles = {
      bull:[95,1.7,.72], tree:[720,2.7,.24], rain:[430,3.5,.19], marsh:[260,2.2,.34], reed:[510,1.45,.16], glass:[980,2.15,.12]
    };
    const bellSets = { gong:[261.63,329.63,392,523.25], shang:[293.66,369.99,440,587.33], jue:[329.63,415.3,493.88,659.25], zhi:[349.23,440,523.25,698.46], yu:[392,493.88,587.33,783.99] };
    const mushroomSets = { mycelium:[0,7,12,19,24], spore:[24,19,31,14,26], morel:[0,3,10,6,17], oyster:[0,12,5,17,9], glow:[12,24,19,31,36] };
    let next=ctx.currentTime+.05, step=0;
    const burst=(frequency,time,duration,level,type='sine',endFrequency=frequency,pan=0)=>{
      const osc=ctx.createOscillator(),gain=ctx.createGain(),panner=ctx.createStereoPanner(); osc.type=type;osc.frequency.setValueAtTime(frequency,time);
      if(endFrequency!==frequency)osc.frequency.exponentialRampToValueAtTime(Math.max(20,endFrequency),time+duration*.78);
      gain.gain.setValueAtTime(.0001,time);gain.gain.exponentialRampToValueAtTime(level,time+.006);gain.gain.exponentialRampToValueAtTime(.0001,time+duration);panner.pan.value=pan;
      osc.connect(gain).connect(panner).connect(bus);osc.start(time);osc.stop(time+duration+.02);osc.onended=()=>{osc.disconnect();gain.disconnect();panner.disconnect();};
    };
    const schedule=()=>{while(voice.playing&&next<ctx.currentTime+.18){
      if(material.type==='texture-glitch'){
        const settings={freeze:[.12,900,.7],crystal:[.025,3200,1.8],buffer:[.055,1200,.55],reverse:[.09,1800,.35],stutter:[.018,650,1.2]}[variant]||[.06,1400,1];
        const duration=.012+random()*(settings[0]+motion*.06), frequency=settings[1]+random()*4200;
        burst(frequency,next,duration,.025+intensity*.065,random()>.5?'square':'sawtooth',frequency*(random()>.5?settings[2]:1/settings[2]),random()*1.8-.9); next+=.025+random()*(.24-motion*.16);
      } else if(material.type==='texture-micro'){
        const ranges={quantum:[2800,7600],collision:[900,4200],wings:[4200,3100],cell:[650,1800],spark:[7200,5200]}[variant]||[2800,7600];
        const frequency=ranges[0]+random()*ranges[1];burst(frequency,next,.018+random()*.06,.018+intensity*.04,'sine',frequency*(.8+random()*.5),Math.sin(step++*1.7)*.9);next+=60/bpm/(3+motion*8);
      } else if(material.type==='texture-frog'){
        const [root,rate,duration]=profiles[variant]||profiles.bull;burst(root*(.92+random()*.12),next,duration,.06+intensity*.09,'sine',root*rate,Math.sin(step++*.9)*motion*.75);burst(root*1.04,next+.04,duration*.72,.025+intensity*.035,'square',root*rate*.82);next+=.65+(1-motion)*1.5+random()*.6;
      } else if(material.type==='texture-mushroom'){
        const notes=mushroomSets[variant]||mushroomSets.mycelium, frequency=220*2**(notes[step++%notes.length]/12);burst(frequency,next,.055+motion*.15,.035+intensity*.06,'square',frequency,Math.sin(step*.8)*.7);next+=60/bpm/(2+motion*4);
      } else if(material.type==='texture-bells'){
        const notes=bellSets[variant]||bellSets.gong, root=notes[step++%notes.length];[1,2.73,5.41].forEach((ratio,i)=>burst(root*ratio,next,.9+i*.22,[.08,.035,.018][i]*(.5+intensity),'sine',root*ratio,i===1?-.28:.22));next+=60/bpm*(1.2-motion*.55);
      }
    }};
    schedule();voice.timers.push(setInterval(schedule,45));
  }
}
