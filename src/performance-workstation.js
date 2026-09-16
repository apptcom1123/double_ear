import { Performance as BasePerformance } from './performance.js';
import { cardGesture } from './card-gesture.js';
import { TAKE_KEY, readCollection, saveCollection } from './cards-store.js';
import { NOTE_NAMES, SCALES, PROGRESSIONS, DRUMS, KITS, DRUM_FX, INSTRUMENTS, FX, isScaleNote, scaleChord, degreeMidi } from './music-tools.js';

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number(value)));
export const COMPUTER_KEY_OFFSETS = Object.freeze({ s:0, e:1, d:2, r:3, f:4, g:5, y:6, h:7, u:8, j:9, i:10, k:11, l:12 });

export class Performance extends BasePerformance {
  constructor(onPlay) {
    super(onPlay);
    Object.assign(this, {
      keyboardStart: 3, keyWidth: 44, rootNote: 0, scale: 'chromatic', chordMode: 'off', progression: 'pop',
      arp: { enabled: false, rate: 8, direction: 'up' }, pitch: 0, modulation: 0, sustain: false,
      instrument: 'electric70', drumKit: '808', drumFX: 'clean', drumBank: 0, drumVelocity: .75, fx: 'clean', fxAmount: .55,
      cc: [{ number: 1, value: 0 }, { number: 74, value: .5 }, { number: 91, value: .25 }],
      xy: { x: .5, y: .35, ccX: 74, ccY: 91 }, triggers: new Map(), arpSources: new Map()
    });
    this.keyMap = COMPUTER_KEY_OFFSETS;
  }
  snapshotControls() {
    return structuredClone({ keyboardStart:this.keyboardStart,keyWidth:this.keyWidth,rootNote:this.rootNote,scale:this.scale,chordMode:this.chordMode,progression:this.progression,arp:this.arp,pitch:this.pitch,modulation:this.modulation,sustain:this.sustain,instrument:this.instrument,drumKit:this.drumKit,drumFX:this.drumFX,drumBank:this.drumBank,drumVelocity:this.drumVelocity,fx:this.fx,fxAmount:this.fxAmount,cc:this.cc,xy:this.xy });
  }
  restoreControls(value = {}) {
    for (const key of Object.keys(this.snapshotControls())) if (value[key] !== undefined) this[key] = structuredClone(value[key]);
    this.octave = this.keyboardStart;
  }
  async ready() {
    await this.host.ensureContext(); this.host.playing = true; this.host.setVolume(this.host.volume); this.prepareGraph();
    for (const engine of this.engines) {
      engine.output.context = this.host.context; engine.output.destination = this.instrumentBus;
      await engine.output.ensureContext(); engine.prepareEQ();
    }
  }
  prepareGraph() {
    if (this.instrumentBus) return;
    const ctx=this.host.context;
    this.instrumentBus=ctx.createGain(); this.fxDrive=ctx.createWaveShaper(); this.fxFilter=ctx.createBiquadFilter(); this.fxDry=ctx.createGain(); this.fxDelay=ctx.createDelay(2); this.fxFeedback=ctx.createGain(); this.fxWet=ctx.createGain();
    this.instrumentBus.connect(this.fxDrive).connect(this.fxFilter); this.fxFilter.connect(this.fxDry).connect(this.host.master); this.fxFilter.connect(this.fxDelay).connect(this.fxWet).connect(this.host.master); this.fxDelay.connect(this.fxFeedback).connect(this.fxDelay);
    this.setFX(this.fx, false);
  }
  distortionCurve(amount) {
    const curve=new Float32Array(1024);
    for(let i=0;i<curve.length;i++){const x=i*2/(curve.length-1)-1;curve[i]=Math.tanh(x*amount);}
    return curve;
  }
  setFX(name, record = true) {
    this.fx = FX[name] ? name : 'clean';
    if (!this.fxFilter) { if(record)this.capture({type:'fx',name:this.fx,amount:this.fxAmount}); return; }
    const presets={clean:[1,18000,0,.01,.08],distortion:[3+this.fxAmount*20,5200,.05,.08,.16],vintage:[1.8,1200,.08,.14,.18],ambient:[1,8500,.52,.58,.48],crystal:[1.2,12000,.32,.19,.62],cavern:[1.1,3400,.68,.72,.58]};
    const [drive,cutoff,wet,delay,feedback]=presets[this.fx],now=this.host.context.currentTime,effect=clamp(this.fxAmount);
    this.fxDrive.curve=this.distortionCurve(1+(drive-1)*effect);this.fxDrive.oversample='4x';this.fxFilter.type='lowpass';this.fxFilter.frequency.setTargetAtTime(18000+(cutoff-18000)*effect,now,.03);this.fxDry.gain.setTargetAtTime(1-wet*effect*.45,now,.03);this.fxWet.gain.setTargetAtTime(wet*effect*1.35,now,.03);this.fxDelay.delayTime.setTargetAtTime(delay,now,.03);this.fxFeedback.gain.setTargetAtTime(feedback*(.35+effect*.65),now,.03);
    if(record)this.capture({type:'fx',name:this.fx,amount:this.fxAmount});
  }
  noteOn(midi, record = true) {
    if(!this.active||this.notes.has(midi)||(this.replaying&&record))return;
    const ctx=this.host.context,preset=INSTRUMENTS[this.instrument]||INSTRUMENTS.electric70,gain=ctx.createGain(),pan=ctx.createStereoPanner(),lfo=ctx.createOscillator(),vibrato=ctx.createGain(),frequency=440*2**((midi-69)/12),oscs=[];
    gain.gain.setValueAtTime(.0001,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.052,ctx.currentTime+preset.attack);lfo.frequency.value=5.2;vibrato.gain.value=this.modulation*45;
    preset.harmonics.forEach((ratio,index)=>{const osc=ctx.createOscillator(),partial=ctx.createGain();osc.type=preset.wave;osc.frequency.value=frequency*ratio;osc.detune.value=this.pitch*200;partial.gain.value=preset.gains[index];lfo.connect(vibrato).connect(osc.detune);osc.connect(partial).connect(gain);osc.start();oscs.push({osc,partial});});
    gain.connect(pan).connect(this.instrumentBus);lfo.start();this.notes.set(midi,{osc:oscs[0].osc,oscs,gain,pan,lfo,vibrato,release:preset.release,released:false,slide:0,expression:0});if(record)this.capture({type:'noteOn',midi,instrument:this.instrument});this.paintKeys();
  }
  noteOff(midi,record=true,force=false) {
    const note=this.notes.get(midi);if(!note)return;if(record)this.capture({type:'noteOff',midi});if(this.sustain&&!force){note.released=true;return;}
    const now=this.host.context.currentTime,release=note.release||.35;note.gain.gain.cancelScheduledValues(now);note.gain.gain.setTargetAtTime(0,now,release/4);note.oscs.forEach(({osc})=>osc.stop(now+release));note.lfo.stop(now+release);note.oscs[0].osc.onended=()=>{note.oscs.forEach(({osc,partial})=>{osc.disconnect();partial.disconnect();});[note.gain,note.pan,note.lfo,note.vibrato].forEach(node=>node.disconnect());};this.notes.delete(midi);this.paintKeys();
  }
  releaseNotes(record=true){[...this.notes.keys()].forEach(midi=>this.noteOff(midi,record,true));}
  setExpression(midis,slide,vibrato,record=true) {
    midis.forEach(midi=>{const note=this.notes.get(midi);if(!note)return;note.slide=slide;note.expression=vibrato;const now=this.host.context.currentTime;note.oscs.forEach(({osc})=>osc.detune.setTargetAtTime(this.pitch*200+slide*240,now,.015));note.vibrato.gain.setTargetAtTime(this.modulation*45+Math.abs(vibrato)*70,now,.02);note.pan.pan.setTargetAtTime(vibrato*.65,now,.02);});
    if(record)this.capture({type:'expression',midis,slide,vibrato});
  }
  setExpressive(name,value,record=true) {
    if(name==='pitch'){this.pitch=clamp(value,-1,1);const now=this.host.context?.currentTime||0;this.notes.forEach(note=>note.oscs.forEach(({osc})=>osc.detune.setTargetAtTime(this.pitch*200+note.slide*240,now,.015)));}
    if(name==='modulation'){this.modulation=clamp(value);const now=this.host.context?.currentTime||0;this.notes.forEach(note=>note.vibrato.gain.setTargetAtTime(this.modulation*45+Math.abs(note.expression)*70,now,.02));}
    if(name==='sustain'){this.sustain=!!value;if(!this.sustain)[...this.notes].filter(([,note])=>note.released).forEach(([midi])=>this.noteOff(midi,false,true));}
    if(record)this.capture({type:'expressive',name,value:this[name]});this.paintExpression();
  }
  triggerOn(source,midi) {
    if(!isScaleNote(midi,this.rootNote,this.scale))return;
    const tones=this.chordMode==='off'?[midi]:scaleChord(midi,this.rootNote,this.scale,this.chordMode==='seventh'?4:3);this.triggers.set(source,tones);
    if(this.arp.enabled){this.arpSources.set(source,tones);this.startArp();}else tones.forEach(note=>this.noteOn(note));
  }
  triggerOff(source) {
    const tones=this.triggers.get(source)||[];this.triggers.delete(source);
    if(this.arpSources.has(source)){this.arpSources.delete(source);if(!this.arpSources.size)this.stopArp();}else tones.forEach(note=>this.noteOff(note));
  }
  arpInterval(){return 500*(4/Number(this.arp.rate));}
  startArp() {
    if(this.arpTimer)return;
    const fire=()=>{const notes=[...new Set([...this.arpSources.values()].flat())].sort((a,b)=>a-b);if(!notes.length)return;let index=this.arpStep++%notes.length;if(this.arp.direction==='down')index=notes.length-1-index;if(this.arp.direction==='random')index=Math.floor(Math.random()*notes.length);if(this.arpNote!==undefined)this.noteOff(this.arpNote,true,true);this.arpNote=notes[index];this.noteOn(this.arpNote);clearTimeout(this.arpGate);this.arpGate=setTimeout(()=>{if(this.arpNote!==undefined)this.noteOff(this.arpNote,true,true);this.arpNote=undefined;},this.arpInterval()*.72);};
    this.arpStep=0;fire();this.arpTimer=setInterval(fire,this.arpInterval());
  }
  stopArp(){clearInterval(this.arpTimer);clearTimeout(this.arpGate);this.arpTimer=undefined;if(this.arpNote!==undefined)this.noteOff(this.arpNote,true,true);this.arpNote=undefined;}
  restartArp(){if(this.arpTimer){this.stopArp();if(this.arpSources.size)this.startArp();}}
  playDegree(degree){const scale=this.scale==='chromatic'?'major':this.scale,midi=degreeMidi(this.keyboardStart,this.rootNote,scale,degree),tones=scaleChord(midi,this.rootNote,scale,this.chordMode==='seventh'?4:3);tones.forEach(note=>this.noteOn(note));setTimeout(()=>tones.forEach(note=>this.noteOff(note)),650);}
  async drumHit(pad,velocity=this.drumVelocity,record=true) {
    if(!this.active){await this.play();if(!this.active)return;}
    const ctx=this.host.context,index=Number(pad),kit=this.drumKit,mode=this.drumFX,now=ctx.currentTime,time=now+(mode==='reverse'?.2:0),tonal=[0,5,6,8,12,13,14,15].includes(index),input=ctx.createGain(),destination=mode==='sidechain'?this.host.master:this.instrumentBus;
    let level=clamp(velocity)*.18*(kit==='edm'?1.2:kit==='industrial'?1.1:1);if(mode==='transient')level*=1.5;
    const effectNodes=[input];
    if(mode==='newyork'){const shaper=ctx.createWaveShaper(),parallel=ctx.createGain(),curve=new Float32Array(512);for(let i=0;i<curve.length;i++){const x=i*2/(curve.length-1)-1;curve[i]=Math.tanh(x*18);}shaper.curve=curve;parallel.gain.value=.32;input.connect(destination);input.connect(shaper).connect(parallel).connect(destination);effectNodes.push(shaper,parallel);}
    else if(mode==='bitcrusher'){const crusher=ctx.createWaveShaper(),curve=new Float32Array(512),steps=kit==='soviet'?8:16;for(let i=0;i<curve.length;i++){const x=i*2/(curve.length-1)-1;curve[i]=Math.round(x*steps)/steps;}crusher.curve=curve;input.connect(crusher).connect(destination);effectNodes.push(crusher);}
    else input.connect(destination);
    if(mode==='sidechain'){this.instrumentBus.gain.cancelScheduledValues(now);this.instrumentBus.gain.setValueAtTime(this.instrumentBus.gain.value,now);this.instrumentBus.gain.linearRampToValueAtTime(.12,now+.012);this.instrumentBus.gain.exponentialRampToValueAtTime(1,now+.42);}
    if(mode==='reverse'){const length=Math.ceil(ctx.sampleRate*.2),buffer=ctx.createBuffer(1,length,ctx.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*(i/length);const source=ctx.createBufferSource(),gain=ctx.createGain(),filter=ctx.createBiquadFilter();source.buffer=buffer;filter.type='bandpass';filter.frequency.value=1900;gain.gain.setValueAtTime(.0001,now);gain.gain.linearRampToValueAtTime(level*.8,time);source.connect(filter).connect(gain).connect(destination);source.start(now);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};}
    const decayScale=mode==='transient'?.48:1;
    if(tonal){const osc=ctx.createOscillator(),gain=ctx.createGain(),base=[52,180,130,520,340,220,760,410][[0,5,6,8,12,13,14,15].indexOf(index)],types={808:'sine',lofi:'triangle',pop:'sine',soviet:'square',edm:'sine',industrial:'sawtooth'};osc.type=types[kit]||'sine';osc.frequency.setValueAtTime(base*(kit==='pop'?1.15:kit==='soviet'?.82:1),time);osc.frequency.exponentialRampToValueAtTime(Math.max(32,base*.55),time+.16*decayScale);gain.gain.setValueAtTime(level,time);gain.gain.exponentialRampToValueAtTime(.0001,time+(.12+(index===0?.35:.08))*decayScale);osc.connect(gain).connect(input);osc.start(time);osc.stop(time+.55);osc.onended=()=>{osc.disconnect();gain.disconnect();effectNodes.forEach(node=>node.disconnect());};}
    else{const length=Math.ceil(ctx.sampleRate*(index===3||index===10?.65:.18)*decayScale),buffer=ctx.createBuffer(1,length,ctx.sampleRate),data=buffer.getChannelData(0),rough=kit==='soviet'||kit==='industrial';for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*Math.exp(-i/(length*(kit==='lofi'?.22:rough?.2:.12)));const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();source.buffer=buffer;filter.type=index===1||index===4?'bandpass':'highpass';filter.frequency.value=kit==='lofi'?1400:kit==='soviet'?900:3500+index*170;gain.gain.value=level;source.connect(filter).connect(gain).connect(input);source.start(time);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();effectNodes.forEach(node=>node.disconnect());};}
    if(record)this.capture({type:'drum',pad:index,kit,drumFX:mode,velocity:clamp(velocity)});this.flashPad(index);
  }
  applyCC(number,value,record=true) {
    number=clamp(number,0,127);value=clamp(value);if(number===1)this.setExpressive('modulation',value,false);
    if(this.fxFilter){const now=this.host.context.currentTime;if(number===74)this.fxFilter.frequency.setTargetAtTime(180*120**value,now,.025);if(number===71)this.fxFilter.Q.setTargetAtTime(.2+value*16,now,.025);if(number===91)this.fxWet.gain.setTargetAtTime(value*.8,now,.025);if(number===12){this.fxAmount=value;this.setFX(this.fx,false);}}
    if(record)this.capture({type:'cc',number,value});
  }
  async record(){await super.record();if(this.recording)this.capture({type:'workstation',state:this.snapshotControls()});}
  applyEvent(event) {
    super.applyEvent(event);
    if(event.type==='workstation'){this.restoreControls(event.state);this.setFX(this.fx,false);this.paintAll();}
    if(event.type==='expression')this.setExpression(event.midis,event.slide,event.vibrato,false);
    if(event.type==='expressive')this.setExpressive(event.name,event.value,false);
    if(event.type==='drum'){this.drumKit=event.kit;this.drumFX=event.drumFX||'clean';this.drumHit(event.pad,event.velocity,false);}
    if(event.type==='cc')this.applyCC(event.number,event.value,false);
    if(event.type==='fx'){this.fxAmount=event.amount;this.setFX(event.name,false);this.paintFX();}
    if(event.type==='theory'){this[event.name]=structuredClone(event.value);}
    if(event.type==='octave'){this.keyboardStart=event.value;this.octave=event.value;this.renderKeyboard();}
  }
  stop(){this.stopArp();this.triggers.clear();this.arpSources.clear();super.stop();}

  render(root) {
    this.root=root;this.setVolume(document.querySelector('#master-volume')?.value??this.host.volume,false);
    root.innerHTML=`<div class="studio-heading performance-heading"><div><small>07 / PERFORMANCE</small><h1>聲卡演奏工作台</h1></div><a href="#/mixer">回到 06</a></div><div id="performance-slots" class="performance-slots compact-slots"></div>
    <section class="panel keyboard-panel"><div class="keyboard-title"><strong>琴鍵與表情控制</strong><div class="keyboard-title-controls"><label>Instrument <select id="instrument-select">${Object.entries(INSTRUMENTS).map(([id,item])=>`<option value="${id}">${item.name}</option>`).join('')}</select></label><label>Built-in FX <select id="fx-select">${Object.entries(FX).map(([id,name])=>`<option value="${id}">${name}</option>`).join('')}</select></label><label>FX Mix <span><input id="fx-amount" type="range" min="0" max="1" step=".01" value="${this.fxAmount}"><output id="fx-value"></output></span></label><label>縮放 <input id="key-zoom" type="range" min="30" max="72" value="${this.keyWidth}"></label></div></div><div id="keyboard-overview" class="keyboard-overview"></div><div class="instrument-layout"><div class="expression-controls"><label>Pitch<input id="pitch-wheel" class="vertical-range" type="range" min="-1" max="1" step=".01" value="${this.pitch}"></label><label>Mod<input id="mod-wheel" class="vertical-range" type="range" min="0" max="1" step=".01" value="${this.modulation}"></label><button id="sustain" type="button">SUS</button></div><div id="keyboard-scroll" class="keyboard-scroll"><div id="mini-keyboard" class="mini-keyboard" aria-label="可縮放 MIDI 琴鍵"></div></div></div><p class="hint">琴鍵內上下滑為 Slide，左右滑為 Vibrato／聲像；可多指演奏。</p></section>
    <section class="performance-tools"><div class="panel theory-panel"><div class="tool-title"><strong>調式・和弦・琶音</strong></div><div class="theory-selects"><label>根音<select id="scale-root">${NOTE_NAMES.map((name,i)=>`<option value="${i}">${name}</option>`).join('')}</select></label><label>調式<select id="scale-mode">${Object.entries(SCALES).map(([id,item])=>`<option value="${id}">${item.name}</option>`).join('')}</select></label><label>和弦<select id="chord-mode"><option value="off">單音</option><option value="triad">三和弦</option><option value="seventh">七和弦</option></select></label></div><div class="progression-row"><select id="progression">${Object.entries(PROGRESSIONS).map(([id,item])=>`<option value="${id}">${item.name}</option>`).join('')}</select><div id="progression-chords"></div></div><div class="arp-row"><label><input id="arp-enabled" type="checkbox"> ARP</label><label>速度<select id="arp-rate"><option value="4">1/4</option><option value="8">1/8</option><option value="16">1/16</option></select></label><label>方向<select id="arp-direction"><option value="up">上行</option><option value="down">下行</option><option value="random">隨機</option></select></label></div></div>
    <div class="panel drum-panel"><div class="tool-title"><strong>2 × 4 打擊墊</strong><select id="drum-kit">${Object.entries(KITS).map(([id,name])=>`<option value="${id}">${name}</option>`).join('')}</select></div><div class="drum-toolbar"><span id="drum-banks"></span><label>Drum Processing <select id="drum-fx">${Object.entries(DRUM_FX).map(([id,name])=>`<option value="${id}">${name}</option>`).join('')}</select></label><label>力度 <input id="drum-velocity" type="range" min=".2" max="1" step=".05" value="${this.drumVelocity}"></label></div><div id="drum-pads" class="drum-pads"></div></div></section>
    <section class="panel matrix-panel performance-matrix"><div class="tool-title"><strong>控制矩陣</strong><small>自訂 CC + XY Automation</small></div><div id="cc-controls" class="cc-controls"></div><div class="xy-wrap"><div id="xy-pad" class="xy-pad" aria-label="XY 觸控板"><i></i></div><label>X CC <input id="xy-cc-x" type="number" min="0" max="127" value="${this.xy.ccX}"></label><label>Y CC <input id="xy-cc-y" type="number" min="0" max="127" value="${this.xy.ccY}"></label></div></section>
    <section class="panel recorder"><div class="record-controls"><button id="record-start" class="primary">開始錄製</button><button id="record-stop">停止</button><output id="record-clock">0.0 / 90 秒</output></div><progress id="record-progress" value="0" max="90000"></progress><form id="save-take"><input name="takeName" placeholder="演奏名稱" maxlength="100" required><button type="submit">儲存演奏</button></form><p id="performance-message" role="status"></p></section><section class="panel take-panel"><div class="pool-head"><h2>演奏收藏</h2><label><input id="take-loop" type="checkbox"> 循環重播</label></div><div id="take-list"></div></section><section class="panel keyboard-help"><strong>電腦鍵盤快捷鍵</strong><p><kbd>S D F G H J K L</kbd> 白鍵 C D E F G A B C　<kbd>E R Y U I</kbd> 黑鍵 C♯ D♯ F♯ G♯ A♯　<kbd>↑ ↓</kbd> Mod　<kbd>← →</kbd> Pitch　<kbd>1–8</kbd> 鼓墊　<kbd>Q</kbd> 錄音／停止　<kbd>A</kbd> 儲存　<kbd>Space</kbd> 播放／停止</p></section><dialog id="slot-picker"><div class="pool-head"><h2>選擇基底聲卡</h2><button id="close-picker">×</button></div><div class="slot-choices"></div></dialog>`;
    this.renderSlots();this.bindKeyboard();this.bindTheory();this.bindDrums();this.bindFX();this.bindMatrix();this.bindRecorder();this.bindComputerKeys();this.paintAll();
  }
  renderSlots() {
    const host=this.root.querySelector('#performance-slots');host.replaceChildren();
    for(let index=0;index<4;index++){
      const wrapper=document.createElement('div');wrapper.className='slot-wrapper';
      const button=document.createElement('button');button.type='button';button.className='performance-slot';button.dataset.slot=index;button.innerHTML=`<small>0${index+1}</small><strong></strong><output></output>`;
      cardGesture(button,{value:()=>this.slots[index].level,volume:value=>this.changeSlot(index,{level:value}),select:()=>{if(!this.slots[index].card)this.choose(index);else this.changeSlot(index,{enabled:!this.slots[index].enabled});},replace:()=>this.choose(index)});
      const replace=document.createElement('button');replace.type='button';replace.className='slot-replace';replace.textContent='更換';replace.onclick=()=>this.choose(index);wrapper.append(button,replace);host.append(wrapper);
    }
  }
  bindKeyboard() {
    const overview=this.root.querySelector('#keyboard-overview');
    for(let octave=2;octave<=7;octave++){const button=document.createElement('button');button.type='button';button.dataset.octave=octave;button.innerHTML=`<span></span><small>C${octave}</small>`;button.onclick=()=>{this.releaseNotes();this.keyboardStart=octave;this.octave=octave;this.capture({type:'octave',value:octave});this.renderKeyboard();};overview.append(button);}
    this.root.querySelector('#key-zoom').oninput=e=>{this.keyWidth=Number(e.target.value);this.renderKeyboard();};
    this.root.querySelector('#instrument-select').value=this.instrument;this.root.querySelector('#instrument-select').onchange=e=>{this.releaseNotes();this.instrument=e.target.value;this.capture({type:'theory',name:'instrument',value:this.instrument});};
    this.root.querySelector('#pitch-wheel').oninput=e=>this.setExpressive('pitch',e.target.value);this.root.querySelector('#pitch-wheel').onchange=()=>this.setExpressive('pitch',0);
    this.root.querySelector('#mod-wheel').oninput=e=>this.setExpressive('modulation',e.target.value);
    this.root.querySelector('#sustain').onclick=()=>this.setExpressive('sustain',!this.sustain);this.renderKeyboard();
  }
  renderKeyboard() {
    const host=this.root?.querySelector('#mini-keyboard');if(!host)return;this.releaseNotes();host.replaceChildren();host.style.setProperty('--key-width',`${this.keyWidth}px`);
    const start=(this.keyboardStart+1)*12;let white=0;
    for(let semitone=0;semitone<=24;semitone++){
      const midi=start+semitone,black=[1,3,6,8,10].includes(semitone%12),button=document.createElement('button'),computerKey=Object.entries(this.keyMap).find(([,offset])=>offset===semitone)?.[0];button.type='button';button.dataset.midi=midi;button.className=`piano-key ${black?'black':'white'}`;button.innerHTML=`<span>${NOTE_NAMES[midi%12]}</span>${computerKey?`<kbd>${computerKey.toUpperCase()}</kbd>`:''}`;button.setAttribute('aria-label',`${NOTE_NAMES[midi%12]}${Math.floor(midi/12)-1}${computerKey?`，電腦鍵 ${computerKey.toUpperCase()}`:''}`);button.hidden=!isScaleNote(midi,this.rootNote,this.scale);
      if(black)button.style.left=`calc(${white} * var(--key-width) - var(--key-width) * .32)`;else{button.style.left=`calc(${white} * var(--key-width))`;white++;}
      let source,startX,startY,tones=[];
      button.onpointerdown=async e=>{e.preventDefault();button.setPointerCapture(e.pointerId);source=`pointer-${e.pointerId}`;startX=e.clientX;startY=e.clientY;if(!this.active)await this.play();this.triggerOn(source,midi);tones=this.triggers.get(source)||[];};
      button.onpointermove=e=>{if(!source)return;const rect=button.getBoundingClientRect(),slide=clamp((startY-e.clientY)/Math.max(30,rect.height),-1,1),vibrato=clamp((e.clientX-startX)/Math.max(24,rect.width),-1,1);this.setExpression(tones,slide,vibrato);};
      const up=()=>{if(source)this.triggerOff(source);source=undefined;tones=[];};button.onpointerup=up;button.onpointercancel=up;button.onlostpointercapture=up;host.append(button);
    }
    host.style.width=`calc(${white} * var(--key-width))`;this.paintKeys();
  }
  bindTheory() {
    const root=this.root;root.querySelector('#scale-root').value=this.rootNote;root.querySelector('#scale-mode').value=this.scale;root.querySelector('#chord-mode').value=this.chordMode;root.querySelector('#progression').value=this.progression;
    const rerender=()=>{this.releaseNotes();this.renderKeyboard();this.renderProgression();};
    root.querySelector('#scale-root').onchange=e=>{this.rootNote=Number(e.target.value);this.capture({type:'theory',name:'rootNote',value:this.rootNote});rerender();};
    root.querySelector('#scale-mode').onchange=e=>{this.scale=e.target.value;this.capture({type:'theory',name:'scale',value:this.scale});rerender();};
    root.querySelector('#chord-mode').onchange=e=>{this.chordMode=e.target.value;this.capture({type:'theory',name:'chordMode',value:this.chordMode});};
    root.querySelector('#progression').onchange=e=>{this.progression=e.target.value;this.renderProgression();};
    root.querySelector('#arp-enabled').checked=this.arp.enabled;root.querySelector('#arp-rate').value=this.arp.rate;root.querySelector('#arp-direction').value=this.arp.direction;
    root.querySelector('#arp-enabled').onchange=e=>{this.arp.enabled=e.target.checked;if(!this.arp.enabled)this.stopArp();this.capture({type:'theory',name:'arp',value:this.arp});};
    root.querySelector('#arp-rate').onchange=e=>{this.arp.rate=Number(e.target.value);this.restartArp();this.capture({type:'theory',name:'arp',value:this.arp});};
    root.querySelector('#arp-direction').onchange=e=>{this.arp.direction=e.target.value;this.capture({type:'theory',name:'arp',value:this.arp});};this.renderProgression();
  }
  renderProgression() {
    const host=this.root.querySelector('#progression-chords');host.replaceChildren();
    (PROGRESSIONS[this.progression]||PROGRESSIONS.pop).degrees.forEach((degree,index)=>{const button=document.createElement('button');button.type='button';button.textContent=['I','II','III','IV','V','VI','VII'][degree];button.setAttribute('aria-label',`進行第 ${index+1} 個和弦`);button.onclick=async()=>{if(!this.active)await this.play();this.playDegree(degree);};host.append(button);});
  }
  bindDrums() {
    const root=this.root;root.querySelector('#drum-kit').value=this.drumKit;root.querySelector('#drum-kit').onchange=e=>{this.drumKit=e.target.value;this.renderDrums();};root.querySelector('#drum-fx').value=this.drumFX;root.querySelector('#drum-fx').onchange=e=>{this.drumFX=e.target.value;};root.querySelector('#drum-velocity').oninput=e=>{this.drumVelocity=Number(e.target.value);};
    const banks=root.querySelector('#drum-banks');for(let i=0;i<2;i++){const button=document.createElement('button');button.type='button';button.textContent=`BANK ${i+1}`;button.onclick=()=>{this.drumBank=i;this.renderDrums();};banks.append(button);}this.renderDrums();
  }
  renderDrums() {
    const host=this.root.querySelector('#drum-pads');if(!host)return;host.replaceChildren();
    for(let i=0;i<8;i++){const index=this.drumBank*8+i,button=document.createElement('button');button.type='button';button.dataset.pad=index;button.innerHTML=`<small>${String(index+1).padStart(2,'0')}</small><strong>${DRUMS[index]}</strong>`;button.onpointerdown=e=>{const rect=button.getBoundingClientRect(),velocity=clamp(1-(e.clientY-rect.top)/rect.height*.7,.25,1);this.drumHit(index,velocity);};host.append(button);}
    this.root.querySelectorAll('#drum-banks button').forEach((button,i)=>button.classList.toggle('active',i===this.drumBank));this.root.querySelector('#drum-kit').value=this.drumKit;
    this.root.querySelector('#drum-fx').value=this.drumFX;
  }
  bindFX() {
    const root=this.root;root.querySelector('#fx-select').value=this.fx;root.querySelector('#fx-select').onchange=async e=>{if(!this.active)await this.play();this.setFX(e.target.value);this.paintFX();};root.querySelector('#fx-amount').oninput=e=>{this.fxAmount=Number(e.target.value);if(this.fxFilter)this.setFX(this.fx);this.paintFX();};this.paintFX();
  }
  bindMatrix() {
    const host=this.root.querySelector('#cc-controls');
    this.cc.forEach(control=>{const row=document.createElement('label');row.className='cc-control';row.innerHTML=`<span>CC <input type="number" min="0" max="127" value="${control.number}" aria-label="控制器 CC 編號"></span><input type="range" min="0" max="1" step=".01" value="${control.value}"><output>${Math.round(control.value*127)}</output>`;const inputs=row.querySelectorAll('input');inputs[0].onchange=e=>{control.number=clamp(e.target.value,0,127);};inputs[1].oninput=e=>{control.value=Number(e.target.value);row.querySelector('output').textContent=Math.round(control.value*127);this.applyCC(control.number,control.value);};host.append(row);});
    for(const [axis,id] of [['ccX','#xy-cc-x'],['ccY','#xy-cc-y']])this.root.querySelector(id).onchange=e=>{this.xy[axis]=clamp(e.target.value,0,127);};
    const pad=this.root.querySelector('#xy-pad');let moving=false,last=0;const move=e=>{if(!moving)return;const rect=pad.getBoundingClientRect();this.xy.x=clamp((e.clientX-rect.left)/rect.width);this.xy.y=clamp(1-(e.clientY-rect.top)/rect.height);this.paintXY();const now=performance.now();if(now-last>24){this.applyCC(this.xy.ccX,this.xy.x);this.applyCC(this.xy.ccY,this.xy.y);last=now;}};pad.onpointerdown=e=>{moving=true;pad.setPointerCapture(e.pointerId);move(e);};pad.onpointermove=move;pad.onpointerup=pad.onpointercancel=()=>{moving=false;};this.paintXY();
  }
  bindRecorder() {
    const root=this.root;root.querySelector('#record-start').onclick=()=>this.record();root.querySelector('#record-stop').onclick=()=>this.stop();root.querySelector('#close-picker').onclick=()=>root.querySelector('dialog').close();root.querySelector('#take-loop').checked=this.loop;root.querySelector('#take-loop').onchange=e=>{this.loop=e.target.checked;};
    root.querySelector('#save-take').onsubmit=e=>{e.preventDefault();if(this.recording)this.stop();if(!this.draft){this.message('先錄製一段演奏。');return;}try{const takes=readCollection(TAKE_KEY),saved={...structuredClone(this.draft),id:crypto.randomUUID(),name:e.target.elements.takeName.value.trim()};takes.push(saved);saveCollection(TAKE_KEY,takes);this.message('已儲存 JSON 操作時間軸。');this.paintTakes();}catch{this.message('儲存失敗，請確認瀏覽器空間。');}};
  }
  bindComputerKeys() {
    this.heldKeys=new Map();this.keyDown=async e=>{
      if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.target.isContentEditable||this.root.querySelector('dialog').open||e.repeat)return;
      const key=e.key.toLowerCase();
      if(/^[1-8]$/.test(key)){e.preventDefault();await this.drumHit(this.drumBank*8+Number(key)-1);return;}
      if(key==='q'){e.preventDefault();if(this.recording)this.stop();else await this.record();return;}
      if(key==='a'){e.preventDefault();this.quickSave();return;}
      if(e.code==='Space'){e.preventDefault();if(this.active)this.stop();else await this.play();return;}
      if(e.key.startsWith('Arrow')){e.preventDefault();if(e.key==='ArrowUp')this.setExpressive('modulation',clamp(this.modulation+.05));if(e.key==='ArrowDown')this.setExpressive('modulation',clamp(this.modulation-.05));if(e.key==='ArrowLeft')this.setExpressive('pitch',clamp(this.pitch-.05,-1,1));if(e.key==='ArrowRight')this.setExpressive('pitch',clamp(this.pitch+.05,-1,1));return;}
      const offset=this.keyMap[key];if(offset===undefined)return;e.preventDefault();const midi=(this.keyboardStart+1)*12+offset;if(!isScaleNote(midi,this.rootNote,this.scale))return;const source=`key-${e.code}`;this.heldKeys.set(e.code,source);if(!this.active)await this.play();if(this.heldKeys.has(e.code))this.triggerOn(source,midi);
    };this.keyUp=e=>{const source=this.heldKeys.get(e.code);if(source)this.triggerOff(source);this.heldKeys.delete(e.code);};this.blur=()=>{this.stopArp();this.releaseNotes();this.heldKeys.clear();};window.addEventListener('keydown',this.keyDown);window.addEventListener('keyup',this.keyUp);window.addEventListener('blur',this.blur);
  }
  quickSave(){const form=this.root?.querySelector('#save-take');if(!form||!this.draft){this.message('先用 Q 或錄製按鈕錄下一段演奏。');return;}const input=form.elements.takeName;if(!input.value)input.value=`快捷演奏 ${new Date().toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'})}`;form.requestSubmit();}
  paintSlots(){this.root?.querySelectorAll('.performance-slot').forEach((button,i)=>{const slot=this.slots[i];button.querySelector('strong').textContent=slot.card?.name||'＋ 聲卡';button.querySelector('output').textContent=`${slot.enabled?'ON':'OFF'} ${Math.round(slot.level*100)}%`;button.classList.toggle('enabled',slot.enabled);button.style.setProperty('--level',`${slot.level*100}%`);button.setAttribute('aria-pressed',slot.enabled);});}
  paintKeys(){this.root?.querySelectorAll('.piano-key').forEach(key=>key.classList.toggle('pressed',this.notes.has(Number(key.dataset.midi))));this.root?.querySelectorAll('.keyboard-overview button').forEach(button=>button.classList.toggle('active',Number(button.dataset.octave)===this.keyboardStart));}
  paintExpression(){const button=this.root?.querySelector('#sustain');if(button){button.classList.toggle('active',this.sustain);button.setAttribute('aria-pressed',this.sustain);}const pitch=this.root?.querySelector('#pitch-wheel'),mod=this.root?.querySelector('#mod-wheel');if(pitch)pitch.value=this.pitch;if(mod)mod.value=this.modulation;}
  paintFX(){const output=this.root?.querySelector('#fx-value');if(output)output.textContent=`${Math.round(this.fxAmount*100)}%`;const select=this.root?.querySelector('#fx-select');if(select)select.value=this.fx;}
  paintXY(){const point=this.root?.querySelector('#xy-pad i');if(point){point.style.left=`${this.xy.x*100}%`;point.style.top=`${(1-this.xy.y)*100}%`;}}
  flashPad(index){const pad=this.root?.querySelector(`[data-pad="${index}"]`);if(!pad)return;pad.classList.add('hit');setTimeout(()=>pad.classList.remove('hit'),100);}
  paintAll(){this.paintSlots();this.renderKeyboard();this.renderDrums();const instrument=this.root?.querySelector('#instrument-select');if(instrument)instrument.value=this.instrument;this.paintExpression();this.paintFX();this.paintXY();this.paintTakes();this.paint();}
}
