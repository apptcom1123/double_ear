import { clamp } from './audio-utils.js';

export const defaultEQ = () => ({ enabled: true, bands: [80,250,1000,4000,12000].map(frequency=>({frequency,gain:0,q:1})) });
export const frequencyX = frequency => Math.log(frequency / 20) / Math.log(1000);
export const xFrequency = x => 20 * 1000 ** clamp(x,0,1);

export class Equalizer {
  constructor(studio, root) {
    this.studio=studio; this.root=root; this.selected=0;
    root.innerHTML=`<div class="panel-head"><div><small>LIVE SPECTRUM / MASTER EQ</small><h2>聽見，也看見</h2></div><div class="eq-actions"><label><input id="eq-enabled" type="checkbox"> EQ</label><button id="eq-flat" type="button">歸零</button></div></div><div class="eq-plot"><canvas aria-label="即時輸出頻譜與 EQ 曲線"></canvas><div class="eq-points"></div></div><div class="eq-edit"><label>頻段<select id="eq-band">${[1,2,3,4,5].map(n=>`<option value="${n-1}">${n}</option>`).join('')}</select></label><label>Hz<input id="eq-frequency" type="number" min="20" max="20000" step="1"></label><label>dB<input id="eq-gain" type="number" min="-12" max="12" step=".5"></label><label>Q<input id="eq-q" type="number" min=".2" max="10" step=".1"></label><output id="eq-status"></output></div><p class="hint">拖曳圓點調整頻率／增益，滾輪調 Q。灰色為輸出頻譜（−100～0 dBFS），橘線為 EQ 響應（±12 dB）。</p>`;
    this.canvas=root.querySelector('canvas');
    this.ctx=this.canvas.getContext('2d');
    this.previewContext=new OfflineAudioContext(1,1,48000);
    this.previewFilters=Array.from({length:5},()=>{const filter=this.previewContext.createBiquadFilter();filter.type='peaking';return filter;});
    this.points=[];
    studio.state.eq.bands.forEach((band,i)=>{
      const point=document.createElement('button');point.type='button';point.className='eq-point';point.textContent=i+1;
      point.setAttribute('aria-label',`EQ 頻段 ${i+1}，方向鍵調頻率和增益`);
      let dragging=false;
      point.onpointerdown=e=>{dragging=true;this.selected=i;point.setPointerCapture(e.pointerId);this.sync();};
      point.onpointermove=e=>{
        if(!dragging)return;
        const r=this.canvas.getBoundingClientRect();
        band.frequency=Math.round(xFrequency((e.clientX-r.left-32)/(r.width-64)));
        band.gain=Math.round(clamp(12-24*(e.clientY-r.top-16)/(r.height-40),-12,12)*10)/10;
        this.change();
      };
      point.onpointerup=point.onpointercancel=()=>{dragging=false;};
      point.onclick=()=>{this.selected=i;this.sync();};
      point.addEventListener('wheel',e=>{e.preventDefault();band.q=Math.round(clamp(band.q+(e.deltaY<0?.1:-.1),.2,10)*10)/10;this.selected=i;this.change();},{passive:false});
      point.onkeydown=e=>{if(!e.key.startsWith('Arrow'))return;e.preventDefault();this.selected=i;if(e.key==='ArrowUp')band.gain=clamp(band.gain+.5,-12,12);if(e.key==='ArrowDown')band.gain=clamp(band.gain-.5,-12,12);if(e.key==='ArrowLeft')band.frequency=Math.round(clamp(band.frequency/1.05,20,20000));if(e.key==='ArrowRight')band.frequency=Math.round(clamp(band.frequency*1.05,20,20000));this.change();};
      root.querySelector('.eq-points').append(point);this.points.push(point);
    });
    root.querySelector('#eq-enabled').onchange=e=>{studio.state.eq.enabled=e.target.checked;this.change();};
    root.querySelector('#eq-flat').onclick=()=>{studio.state.eq.bands.forEach((b,i)=>Object.assign(b,defaultEQ().bands[i]));this.change();};
    root.querySelector('#eq-band').onchange=e=>{this.selected=Number(e.target.value);this.sync();};
    for(const [id,key,min,max] of [['frequency','frequency',20,20000],['gain','gain',-12,12],['q','q',.2,10]]) {
      root.querySelector(`#eq-${id}`).onchange=e=>{if(e.target.value===''||!Number.isFinite(Number(e.target.value))){this.sync();return;}studio.state.eq.bands[this.selected][key]=clamp(Number(e.target.value),min,max);this.change();};
    }
    this.sync();this.draw();
  }
  change() { this.studio.engine.setEQ(this.studio.state.eq);this.sync(); }
  sync() {
    const band=this.studio.state.eq.bands[this.selected];
    this.root.querySelector('#eq-enabled').checked=this.studio.state.eq.enabled;
    this.root.querySelector('#eq-band').value=this.selected;
    for(const key of ['frequency','gain','q'])this.root.querySelector(`#eq-${key}`).value=band[key];
    this.studio.state.eq.bands.forEach((b,i)=>{const f=this.previewFilters[i];f.frequency.value=b.frequency;f.gain.value=this.studio.state.eq.enabled?b.gain:0;f.Q.value=b.q;});
  }
  destroy() { cancelAnimationFrame(this.frame); }
  draw() {
    if(!this.root.isConnected)return;
    const c=this.ctx,w=this.canvas.clientWidth,h=220,dpr=devicePixelRatio||1;
    if(this.canvas.width!==Math.round(w*dpr)||this.canvas.height!==h*dpr){this.canvas.width=Math.round(w*dpr);this.canvas.height=h*dpr;}
    c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);
    const left=32,top=16,width=w-64,height=h-40;
    const x=f=>left+frequencyX(f)*width,y=g=>top+(12-g)/24*height;
    c.font='12px system-ui';c.fillStyle='#13231f';c.strokeStyle='#13231f22';c.lineWidth=1;
    for(const f of [20,100,1000,10000,20000]) {c.beginPath();c.moveTo(x(f),top);c.lineTo(x(f),top+height);c.stroke();c.fillText(f>=1000?`${f/1000}k`:f,clamp(x(f)-10,0,w-32),h-4);}
    for(const gain of [-12,0,12]){c.beginPath();c.moveTo(left,y(gain));c.lineTo(w-left,y(gain));c.stroke();c.fillText(gain>0?`+${gain}`:gain,2,y(gain)+4);}
    const engine=this.studio.engine,analyser=engine.analyser;
    if(analyser&&engine.playing&&engine.output.context.state==='running') {
      this.data??=new Float32Array(analyser.frequencyBinCount);analyser.getFloatFrequencyData(this.data);
      c.beginPath();c.moveTo(left,top+height);
      for(let i=0;i<=width;i+=2){const frequency=xFrequency(i/width),bin=Math.min(this.data.length-1,Math.round(frequency*analyser.fftSize/engine.output.context.sampleRate));c.lineTo(left+i,top+height*(1-clamp((this.data[bin]+100)/100,0,1)));}
      c.lineTo(left+width,top+height);c.closePath();c.fillStyle='#13231f30';c.fill();
    }
    // Preview uses the same biquad response as the live signal chain.
    const frequencies=Float32Array.from({length:256},(_,i)=>xFrequency(i/255));
    const gains=new Float32Array(256),magnitude=new Float32Array(256),phase=new Float32Array(256);
    for(const filter of engine.playing?engine.eqFilters:this.previewFilters){filter.getFrequencyResponse(frequencies,magnitude,phase);for(let i=0;i<256;i++)gains[i]+=20*Math.log10(Math.max(1e-8,magnitude[i]));}
    c.strokeStyle='#ef6a47';c.lineWidth=2;c.beginPath();for(let i=0;i<256;i++){const px=left+i/255*width,py=y(clamp(gains[i],-12,12));if(i===0)c.moveTo(px,py);else c.lineTo(px,py);}c.stroke();
    this.studio.state.eq.bands.forEach((band,i)=>{const point=this.points[i];point.style.left=`${x(band.frequency)}px`;point.style.top=`${y(band.gain)}px`;point.classList.toggle('selected',i===this.selected);point.title=`${band.frequency} Hz / ${band.gain} dB / Q ${band.q}`;});
    this.root.querySelector('#eq-status').textContent=engine.playing&&engine.output.context.state==='running'?'LIVE':'待播放';
    this.frame=requestAnimationFrame(()=>this.draw());
  }
}
