export const LIBRARY_KEY='double-ear.library.v1';
export const nextIndex=(index,length,repeat,automatic=true)=>{
  if(!length)return -1;
  if(automatic&&repeat==='one')return index;
  if(index+1<length)return index+1;
  return repeat==='all'?0:-1;
};
export const makeEntry=(state,{name,notes,duration},id=crypto.randomUUID())=>({
  id,name:name.trim()||'未命名聲景',notes:notes.trim(),duration:Math.min(120,Math.max(.1,Number(duration)||5))*60,
  createdAt:new Date().toISOString(),state:structuredClone(state)
});

export class Library {
  constructor(studio) {
    this.studio=studio;this.entries=[];this.currentId=null;this.repeat='all';this.running=false;this.paused=false;this.elapsed=0;
    this.draft={name:'',notes:'',duration:5};
    this.version=0;
    try {const saved=JSON.parse(localStorage.getItem(LIBRARY_KEY)||'[]');if(!Array.isArray(saved)||saved.some(e=>!e.id||!e.state?.config||!Array.isArray(e.state.layers)||!Number.isFinite(e.duration)))throw new Error();this.entries=saved;}
    catch {this.storageError='無法讀取本機收藏；原始資料未覆寫。';}
  }
  mount(root) {
    this.root=root;
    root.innerHTML=`<section class="panel save-panel"><small>LISTENING NOTES</small><h2>留下這次聆聽</h2><form id="save-mix"><label>聲景名稱<input name="name" maxlength="120" placeholder="例如：午夜太空電台"></label><label>感想<textarea name="notes" rows="3" maxlength="4000" placeholder="這個組合的感受、下次想調整的地方…"></textarea></label><div class="save-row"><label>每次播放（分鐘）<input name="duration" type="number" min=".1" max="120" step=".1" required></label><button type="submit" class="primary">儲存目前設定</button></div></form><p class="hint">僅儲存設定與文字於此瀏覽器，不產生音檔。</p><p id="library-message" role="status"></p></section><section class="panel playlist-panel"><div class="panel-head"><div><small>YOUR COLLECTION</small><h2>我的聲景清單</h2></div><button id="export-library" type="button">匯出設定</button></div><div class="collection-transport"><button id="collection-prev" type="button" aria-label="上一首">Ⅰ‹</button><button id="collection-play" type="button">播放清單</button><button id="collection-next" type="button" aria-label="下一首">›Ⅰ</button><label>循環<select id="collection-repeat"><option value="off">關閉</option><option value="one">單曲</option><option value="all">全部</option></select></label></div><div class="collection-progress"><progress id="collection-progress" max="1" value="0"></progress><output id="collection-time">0:00 / 0:00</output></div><ol id="collection-list"></ol></section>`;
    const form=root.querySelector('form');
    for(const key of ['name','notes','duration']){form.elements[key].value=this.draft[key];form.elements[key].oninput=e=>{this.draft[key]=e.target.value;};}
    form.onsubmit=e=>{e.preventDefault();this.save();};
    root.querySelector('#collection-repeat').value=this.repeat;
    root.querySelector('#collection-repeat').onchange=e=>{this.repeat=e.target.value;};
    root.querySelector('#collection-play').onclick=()=>this.toggle();
    root.querySelector('#collection-next').onclick=()=>this.advance(false);
    root.querySelector('#collection-prev').onclick=()=>{const index=this.entries.findIndex(e=>e.id===this.currentId);if(this.entries.length)this.load(this.entries[Math.max(0,index-1)].id,true);};
    root.querySelector('#export-library').onclick=()=>{
      const url=URL.createObjectURL(new Blob([JSON.stringify({version:1,entries:this.entries},null,2)],{type:'application/json'}));
      const a=document.createElement('a');a.href=url;a.download='double-ear-settings.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    };
    this.message(this.storageError||'');this.list();this.paint();
  }
  message(text) {const el=this.root?.querySelector('#library-message');if(el)el.textContent=text;}
  persist(entries) {
    try {if(this.storageError)throw new Error();localStorage.setItem(LIBRARY_KEY,JSON.stringify(entries));this.entries=entries;return true;}
    catch {this.message('未儲存：瀏覽器儲存空間不可用，請先匯出設定備份。');return false;}
  }
  save() {
    const snapshot=structuredClone(this.studio.state);snapshot.masterVolume=this.studio.engine.output.volume;
    const entry=makeEntry(snapshot,this.draft);
    if(this.persist([...this.entries,entry])){this.list();this.message(`已儲存「${entry.name}」與感想。`);}
  }
  list() {
    const list=this.root.querySelector('#collection-list');list.replaceChildren();
    if(!this.entries.length){const empty=document.createElement('li');empty.className='collection-empty';empty.textContent='儲存第一個聲景，就能在這裡重複播放。';list.append(empty);}
    this.entries.forEach((entry,index)=>{
      const row=document.createElement('li');row.dataset.id=entry.id;row.classList.toggle('current',entry.id===this.currentId);
      const play=document.createElement('button');play.type='button';play.className='collection-track';play.setAttribute('aria-label',`播放 ${entry.name}`);
      const number=document.createElement('span');number.textContent=String(index+1).padStart(2,'0');
      const title=document.createElement('strong');title.textContent=entry.name;
      const info=document.createElement('small');info.textContent=`${(entry.duration/60).toFixed(1)} 分 · ${entry.state.layers.filter(l=>l.enabled).length} 層`;
      play.append(number,title,info);play.onclick=()=>this.load(entry.id,true);
      const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='感想／設定';details.append(summary);
      const notes=document.createElement('p');notes.textContent=entry.notes||'尚未填寫感想';details.append(notes);
      const load=document.createElement('button');load.type='button';load.textContent='載入編輯';load.onclick=()=>this.load(entry.id,false);
      const remove=document.createElement('button');remove.type='button';remove.textContent='移除';remove.onclick=()=>{
        const next=this.entries.filter(e=>e.id!==entry.id);if(!this.persist(next))return;
        if(this.currentId===entry.id){this.studio.stop();this.currentId=null;}
        this.list();this.paint();
      };
      details.append(load,remove);row.append(play,details);list.append(row);
    });
    this.paint();
  }
  async load(id,autoplay) {
    const entry=this.entries.find(e=>e.id===id);if(!entry)return;
    this.studio.stop();this.currentId=id;this.elapsed=0;
    const version=this.version;
    this.draft={name:entry.name,notes:entry.notes,duration:entry.duration/60};
    this.studio.state=structuredClone(entry.state);
    this.studio.setVolume(entry.state.masterVolume??.28);
    this.studio.render(this.studio.root);
    if(autoplay){
      try {await this.studio.play();if(version!==this.version||!this.studio.playing)return;this.running=true;this.paused=false;this.lastTick=performance.now();this.timer=setInterval(()=>this.tick(),200);}
      catch(error){this.message(`播放失敗：${error.message}`);}
    }
    this.list();this.paint();
  }
  async toggle() {
    if(this.running) {
      this.tick();this.running=false;this.paused=true;
      clearInterval(this.timer);await this.studio.engine.output.context.suspend();this.studio.onPlay(false);this.paint();return;
    }
    if(this.paused) {
      await this.studio.engine.output.context.resume();this.running=true;this.paused=false;this.lastTick=performance.now();this.timer=setInterval(()=>this.tick(),200);this.studio.onPlay(true);this.paint();return;
    }
    const entry=this.entries.find(e=>e.id===this.currentId)||this.entries[0];if(entry)await this.load(entry.id,true);
  }
  stop() {++this.version;clearInterval(this.timer);this.running=false;this.paused=false;this.elapsed=0;this.paint();}
  tick() {
    if(!this.running)return;
    const now=performance.now();this.elapsed+=(now-this.lastTick)/1000;this.lastTick=now;
    const entry=this.entries.find(e=>e.id===this.currentId);
    if(entry&&this.elapsed>=entry.duration){this.advance(true);return;}this.paint();
  }
  advance(automatic) {
    const index=this.entries.findIndex(e=>e.id===this.currentId),next=nextIndex(index,this.entries.length,this.repeat,automatic);
    if(next<0){this.studio.stop();return;}this.load(this.entries[next].id,true);
  }
  paint() {
    if(!this.root?.isConnected)return;
    const entry=this.entries.find(e=>e.id===this.currentId),duration=entry?.duration||0;
    const format=seconds=>`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
    this.root.querySelector('#collection-play').textContent=this.running?'暫停':this.paused?'繼續':'播放清單';
    this.root.querySelector('#collection-play').disabled=!this.entries.length;
    this.root.querySelector('#collection-prev').disabled=!this.entries.length;
    this.root.querySelector('#collection-next').disabled=!this.entries.length;
    this.root.querySelector('#collection-progress').value=duration?Math.min(1,this.elapsed/duration):0;
    this.root.querySelector('#collection-time').textContent=`${format(this.elapsed)} / ${format(duration)}`;
  }
}
