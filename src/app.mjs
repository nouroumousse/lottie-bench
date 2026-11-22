'use strict';
import {
  S, clone, fmt, cap, K, getValue, addKey, writeRow, toggleAnim,
  removeKey, shiftPos, normalizeAnimation, exportAnimation, easingHandles, validateAnimation,
} from './lottie-core.mjs';
import { SnapshotHistory } from './history.mjs';
import { timelineScale, frameToTimelineX, clientXToFrame } from './timeline.mjs';
import { findLayerFromTarget } from './hit-testing.mjs';
const normalize = normalizeAnimation;
function readRow(row, frame) {
  const value = getValue(row.prop, frame - row.off);
  if (row.kind === 'num') return Array.isArray(value) ? value[0] : value;
  return Array.isArray(value) ? value : [value];
}


/* ---------- model helpers ---------- */
const PALETTE=[[0.24,0.86,0.69,1],[1,0.76,0.28,1],[0.4,0.6,1,1],[1,0.42,0.42,1],[0.78,0.5,1,1]];
function newComp(w,h,fr,op,nm){ return {v:'5.7.5',fr,ip:0,op,w,h,nm,ddd:0,assets:[],layers:[],markers:[],metadata:{backgroundColor:{r:255,g:255,b:255}}}; }
function baseKs(w,h){ return {o:S(100),r:S(0),p:S([w/2,h/2,0]),a:S([0,0,0]),s:S([100,100,100])}; }
const nextInd=ls=>ls.reduce((m,l)=>Math.max(m,l.ind||0),0)+1;
function grTr(){ return {ty:'tr',p:S([0,0]),a:S([0,0]),s:S([100,100]),r:S(0),o:S(100),sk:S(0),sa:S(0),nm:'Transform'}; }
function geom(kind,sz){
  if(kind==='rect') return {ty:'rc',d:1,s:S([sz,sz]),p:S([0,0]),r:S(0),nm:'Rectangle'};
  if(kind==='ellipse') return {ty:'el',d:1,s:S([sz,sz]),p:S([0,0]),nm:'Ellipse'};
  if(kind==='star') return {ty:'sr',d:1,sy:1,pt:S(5),p:S([0,0]),r:S(0),or:S(sz/2),os:S(0),ir:S(sz/4),is:S(0),nm:'Star'};
  return {ty:'sr',d:1,sy:2,pt:S(6),p:S([0,0]),r:S(0),or:S(sz/2),os:S(0),nm:'Polygon'};
}
const fillItem=c=>({ty:'fl',c:S(c.slice()),o:S(100),r:1,bm:0,nm:'Fill'});
const strokeItem=(c,w)=>({ty:'st',c:S(c.slice()),o:S(100),w:S(w),lc:2,lj:2,bm:0,nm:'Stroke'});
function mkGroup(kind,sz,color){ return {ty:'gr',nm:cap(kind==='rect'?'rectangle':kind),it:[geom(kind,sz),fillItem(color),grTr()],np:3,cix:2,bm:0,ix:1}; }
function makeItem(kind,color){
  if(kind==='rc'||kind==='rect') return geom('rect',100);
  if(kind==='el'||kind==='ellipse') return geom('ellipse',100);
  if(kind==='sr'||kind==='star') return geom('star',100);
  if(kind==='pg'||kind==='polygon') return geom('polygon',100);
  if(kind==='fl') return fillItem(color||PALETTE[0]);
  if(kind==='st') return strokeItem(color||PALETTE[1],8);
  if(kind==='tm') return {ty:'tm',s:S(0),e:S(100),o:S(0),m:1,nm:'Trim Paths'};
  if(kind==='rd') return {ty:'rd',r:S(12),nm:'Round Corners'};
  if(kind==='rp') return {ty:'rp',c:S(3),o:S(0),m:1,tr:{ty:'tr',p:S([30,0]),a:S([0,0]),s:S([100,100]),r:S(0),so:S(100),eo:S(100)},nm:'Repeater'};
  return mkGroup('rect',100,color||PALETTE[0]);
}
const PAINT=['fl','st','gf','gs'];
function applyAdd(arr,kind,top){
  const col=PALETTE[arr.length%PALETTE.length];
  let it,idx;
  if(top){ it=mkGroup(kind,200,col); arr.unshift(it); return; }
  it=makeItem(kind,col);
  if(['rc','el','sr','sh','gr'].includes(it.ty)) idx=0;
  else if(['tm','rd','rp'].includes(it.ty)){ idx=arr.findIndex(x=>PAINT.includes(x.ty)||x.ty==='tr'); }
  else idx=arr.findIndex(x=>x.ty==='tr');
  if(idx<0) idx=arr.length;
  arr.splice(idx,0,it);
}
function addLayer(comp,layers,kind,at){
  const W=comp.w,H=comp.h,ind=nextInd(layers),col=PALETTE[layers.length%PALETTE.length];
  const base={ddd:0,ind,sr:1,ks:baseKs(W,H),ao:0,ip:comp.ip,op:comp.op,st:0,bm:0};
  let L;
  if(kind==='solid'){ L={...base,ty:1,nm:'Solid',sw:W,sh:H,sc:'#ffffff'}; L.ks.a=S([W/2,H/2,0]); }
  else if(kind==='null'){ L={...base,ty:3,nm:'Null'}; }
  else { L={...base,ty:4,nm:cap(kind==='rect'?'rectangle':kind),shapes:[mkGroup(kind,Math.min(W,H)/3,col)]}; }
  layers.unshift(L); return L;
}
function tplBounce(){
  const c=newComp(512,512,60,120,'Bouncing ball');
  const fl=addLayer(c,c.layers,'rect'); fl.nm='Floor'; fl.ks.p=S([256,448,0]);
  fl.shapes[0].it[0].s=S([380,8]); fl.shapes[0].it[0].r=S(4); fl.shapes[0].it[1].c=S([0.55,0.6,0.65,1]);
  const b=addLayer(c,c.layers,'ellipse'); b.nm='Ball'; b.shapes[0].it[0].s=S([90,90]);
  b.ks.p=K([[0,[256,100,0],'in'],[30,[256,394,0],'out'],[60,[256,100,0],'in'],[90,[256,394,0],'out'],[120,[256,100,0],'in']]);
  b.ks.s=K([[0,[100,100,100],'io'],[27,[100,100,100],'io'],[30,[128,72,100],'io'],[35,[100,100,100],'io'],[87,[100,100,100],'io'],[90,[128,72,100],'io'],[95,[100,100,100],'io'],[120,[100,100,100],'io']]);
  return c;
}
function tplPulse(){
  const c=newComp(512,512,60,90,'Pulse');
  const b=addLayer(c,c.layers,'ellipse'); b.nm='Pulse'; b.shapes[0].it[0].s=S([160,160]);
  b.ks.s=K([[0,[100,100,100],'io'],[45,[150,150,100],'io'],[90,[100,100,100],'io']]);
  b.ks.o=K([[0,100,'io'],[45,45,'io'],[90,100,'io']]);
  return c;
}
function tplSpinner(){
  const c=newComp(512,512,60,120,'Loader ring');
  const L=addLayer(c,c.layers,'ellipse'); L.nm='Ring';
  const g=L.shapes[0]; g.it[0].s=S([200,200]);
  g.it=[g.it[0],{ty:'tm',s:K([[0,0,'io'],[60,15,'io'],[120,0,'io']]),e:K([[0,35,'io'],[60,100,'io'],[120,35,'io']]),o:S(0),m:1,nm:'Trim Paths'},strokeItem(PALETTE[0],18),grTr()];
  L.ks.r=K([[0,0,'lin'],[120,360,'lin']]);
  return c;
}
const TEMPLATES={blank:()=>newComp(512,512,60,120,'Blank'),bounce:tplBounce,pulse:tplPulse,spinner:tplSpinner};

/* ---------- row model (what the inspector and timeline show) ---------- */
const ITEMNAME={gr:'Group',rc:'Rectangle',el:'Ellipse',sr:'Star / polygon',sh:'Path',fl:'Fill',st:'Stroke',gf:'Gradient fill',gs:'Gradient stroke',tr:'Transform',tm:'Trim paths',rd:'Round corners',rp:'Repeater',mm:'Merge paths'};
const TYPEBADGE={0:'P',1:'S',2:'I',3:'N',4:'◆',5:'T'};
function rgbHex(c){ return '#'+[0,1,2].map(i=>Math.max(0,Math.min(255,Math.round((c[i]||0)*255))).toString(16).padStart(2,'0')).join(''); }
function hexRgb(h){ const n=parseInt(h.slice(1),16); return [(n>>16&255)/255,(n>>8&255)/255,(n&255)/255]; }
function buildRows(L,layers){
  const rows=[],off=L.st||0;
  const head=(label,o={})=>rows.push({type:'head',label,depth:0,...o});
  const P=(label,prop,kind,key,o={})=>{ if(prop&&typeof prop==='object'&&'k' in prop) rows.push({type:'prop',label,prop,kind,off,key,...o}); };
  const F=(label,input,get,set,key,o={})=>rows.push({type:'field',label,input,get,set,key,...o});
  head('Layer',{key:'h.layer',pono:true});
  F('Name','text',()=>L.nm||'',v=>{L.nm=v;},'nm');
  F('Parent','select',()=>L.parent==null?'':String(L.parent),v=>{ if(v==='') delete L.parent; else L.parent=+v; },'parent',{options:[['','None'],...layers.filter(x=>x.ind!==L.ind).map(x=>[String(x.ind),x.nm||('Layer '+x.ind)])]});
  F('In','number',()=>L.ip,v=>{L.ip=v;},'ip');
  F('Out','number',()=>L.op,v=>{L.op=v;},'op');
  F('Start','number',()=>L.st||0,v=>{L.st=v;},'st');
  if(L.ty===1){
    F('Color','color',()=>L.sc||'#ffffff',v=>{L.sc=v;},'sc');
    F('Width','number',()=>L.sw,v=>{L.sw=v;},'sw');
    F('Height','number',()=>L.sh,v=>{L.sh=v;},'sh');
  }
  head('Transform',{key:'h.t'});
  const ks=L.ks||{};
  P('Anchor',ks.a,'vec','ks.a');
  if(ks.p&&ks.p.s){ P('Position X',ks.p.x,'num','ks.p.x'); P('Position Y',ks.p.y,'num','ks.p.y'); }
  else P('Position',ks.p,'vec','ks.p');
  P('Scale',ks.s,'vec','ks.s',{link:true,unit:'%'});
  P('Rotation',ks.r!==undefined?ks.r:ks.rz,'num',ks.r!==undefined?'ks.r':'ks.rz',{unit:'°'});
  P('Opacity',ks.o,'num','ks.o',{min:0,max:100,unit:'%'});
  if(L.ty===0&&L.refId) rows.push({type:'head',label:'Precomp: '+L.refId,depth:0,key:'h.pre',pono:true,open:L.refId});
  if(L.ty===4&&Array.isArray(L.shapes)){
    rows.push({type:'head',label:'Contents',depth:0,key:'h.c',add:{arr:L.shapes,top:true,options:[['rect','Rectangle group'],['ellipse','Ellipse group'],['star','Star group'],['polygon','Polygon group']]}});
    walkItems(L.shapes,'shapes',1);
  }
  function walkItems(arr,path,depth){
    if(!Array.isArray(arr)) return;
    arr.forEach((it,idx)=>{
      if(!it||typeof it!=='object') { rows.push({type:'note',text:'Invalid shape item at '+path+'.'+idx}); return; }
      const p=path+'.'+idx,label=it.nm||ITEMNAME[it.ty]||it.ty;
      const base={depth,key:'h.'+p,item:it,arr,idx};
      if(it.ty==='gr'){
        if(!Array.isArray(it.it)) it.it=[];
        head(label,{...base,add:{arr:it.it,top:false,options:[['rc','Rectangle'],['el','Ellipse'],['sr','Star'],['pg','Polygon'],['fl','Fill'],['st','Stroke'],['tm','Trim paths'],['rd','Round corners'],['rp','Repeater'],['gr','Group']]}});
        walkItems(it.it,p+'.it',depth+1);
        return;
      }
      head(label,base);
      const q=(lbl,k,kind,o={})=>P(lbl,it[k],kind,p+'.'+k,o);
      switch(it.ty){
        case 'rc': q('Position','p','vec'); q('Size','s','vec',{link:true}); q('Roundness','r','num',{min:0}); break;
        case 'el': q('Position','p','vec'); q('Size','s','vec',{link:true}); break;
        case 'sr':
          F('Shape','select',()=>String(it.sy||1),v=>{it.sy=+v;},p+'.sy',{options:[['1','Star'],['2','Polygon']],rebuild:true});
          q('Position','p','vec'); q('Points','pt','num',{min:3}); q('Rotation','r','num',{unit:'°'});
          q('Outer radius','or','num',{min:0}); q('Outer round','os','num');
          if(it.sy===1){ q('Inner radius','ir','num',{min:0}); q('Inner round','is','num'); }
          break;
        case 'fl': q('Color','c','color'); q('Opacity','o','num',{min:0,max:100,unit:'%'});
          F('Fill rule','select',()=>String(it.r||1),v=>{it.r=+v;},p+'.rule',{options:[['1','Non-zero'],['2','Even-odd']]}); break;
        case 'st': q('Color','c','color'); q('Opacity','o','num',{min:0,max:100,unit:'%'}); q('Width','w','num',{min:0});
          F('Cap','select',()=>String(it.lc||2),v=>{it.lc=+v;},p+'.lc',{options:[['1','Butt'],['2','Round'],['3','Square']]});
          F('Join','select',()=>String(it.lj||2),v=>{it.lj=+v;},p+'.lj',{options:[['1','Miter'],['2','Round'],['3','Bevel']]}); break;
        case 'tr': q('Anchor','a','vec'); q('Position','p','vec'); q('Scale','s','vec',{link:true,unit:'%'}); q('Rotation','r','num',{unit:'°'}); q('Opacity','o','num',{min:0,max:100,unit:'%'}); q('Skew','sk','num'); q('Skew axis','sa','num'); break;
        case 'tm': q('Start','s','num',{unit:'%'}); q('End','e','num',{unit:'%'}); q('Offset','o','num',{unit:'°'}); break;
        case 'rd': q('Radius','r','num',{min:0}); break;
        case 'rp': q('Copies','c','num',{min:0}); q('Offset','o','num');
          if(it.tr){ P('Position',it.tr.p,'vec',p+'.tr.p'); P('Scale',it.tr.s,'vec',p+'.tr.s',{link:true,unit:'%'}); P('Rotation',it.tr.r,'num',p+'.tr.r',{unit:'°'}); P('Start opacity',it.tr.so,'num',p+'.tr.so',{min:0,max:100}); P('End opacity',it.tr.eo,'num',p+'.tr.eo',{min:0,max:100}); }
          break;
        case 'sh': rows.push({type:'note',text:'Path vertices are edited in the JSON tab.'}); break;
        case 'gf': case 'gs': rows.push({type:'note',text:'Gradient stops are edited in the JSON tab.'}); break;
      }
    });
  }
  return rows;
}

/* ---------- state ---------- */
const $=s=>document.querySelector(s);
const NS='http://www.w3.org/2000/svg';
const st={comp:null,ctx:null,sel:null,itemSel:null,kf:null,t:0,playing:false,loop:true,speed:1,tool:'select',zoom:1,tlzoom:1,expanded:{},locked:{},link:{},tab:'props',center:true,transp:false,ppf:4,pen:[],minify:false};
const C=()=>st.comp;
function curLayers(){
  if(st.ctx){ const a=st.comp.assets.find(x=>x.id===st.ctx); if(a&&Array.isArray(a.layers)) return a.layers; st.ctx=null; }
  return st.comp.layers;
}
const findL=ind=>curLayers().find(l=>l.ind===ind);
let anim=null,curHolder=null,loadId=0,PS=[];
const history = new SnapshotHistory(150);
let lastKey=null,lastT=0,gesture=null;
let previewTimer=0;
function schedulePreview(delay=120){
  if(gesture) return;
  clearTimeout(previewTimer);
  previewTimer=setTimeout(()=>{ previewTimer=0; reloadStage(); },Math.max(0,delay));
}

function h(tag,a,...c){
  const e=document.createElement(tag);
  if(a) for(const k in a){
    const v=a[k];
    if(v==null||v===false) continue;
    if(k==='class') e.className=v;
    else if(k==='style') e.style.cssText=v;
    else if(k.startsWith('on')) e.addEventListener(k.slice(2),v);
    else if(v===true) e.setAttribute(k,'');
    else e.setAttribute(k,v);
  }
  for(const x of c.flat()){ if(x==null||x===false) continue; e.append(x.nodeType?x:document.createTextNode(x)); }
  return e;
}
const ICONS={
  play:'<path d="M7 5v14l12-7z" fill="currentColor"/>',pause:'<path d="M7 5h3v14H7zM14 5h3v14h-3z" fill="currentColor"/>',
  first:'<path d="M6 5v14M19 5v14L9 12z"/>',last:'<path d="M18 5v14M5 5v14l10-7z"/>',
  loop:'<path d="M17 2l3 3-3 3M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 0 1-4 4H4"/>',
  undo:'<path d="M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3"/>',redo:'<path d="M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3"/>',
  trash:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',copy:'<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>',
  up:'<path d="M6 15l6-6 6 6"/>',down:'<path d="M6 9l6 6 6-6"/>',eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff:'<path d="M3 3l18 18M10.6 5.1A9.7 9.7 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3 3.7M6.5 6.6C3.9 8.3 2 12 2 12s4 7 10 7c1.5 0 2.9-.4 4.1-1"/>',
  lock:'<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',unlock:'<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7-2.6"/>',
  stopwatch:'<circle cx="12" cy="13.5" r="7"/><path d="M12 13.5V9.5M9.5 3h5M12 3v3"/>',diamond:'<path d="M12 4l7 8-7 8-7-8z"/>',
  pen:'<path d="M12 19l7-7-3-3-7 7zM9 16l-4 4M16 9l3-3"/>',cursor:'<path d="M5 3l14 8-6 2-2 6z"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',minus:'<path d="M5 12h14"/>',chevR:'<path d="M9 6l6 6-6 6"/>',chevD:'<path d="M6 9l6 6 6-6"/>',x:'<path d="M6 6l12 12M18 6L6 18"/>',link:'<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'
};
function icon(n){ const s=document.createElement('span'); s.style.display='contents'; s.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true">'+ICONS[n]+'</svg>'; return s; }
function toast(msg,err){ const t=$('#toast'); t.textContent=msg; t.className='toast'+(err?' err':''); t.style.display='block'; clearTimeout(toast.k); toast.k=setTimeout(()=>{t.style.display='none'},err?4500:2200); }

/* ---------- mutation + render scheduling ---------- */
const pending=new Set(); let rafQ=0;
function queue(...names){ names.forEach(n=>pending.add(n)); if(!rafQ) rafQ=requestAnimationFrame(flush); }
function flush(){
  rafQ=0; const p=new Set(pending); pending.clear();
  try{
    if(p.has('layers')) renderLayers();
    if(p.has('panel')) renderPanel();
    if(p.has('comp')) renderCompPane();
    if(p.has('tl')) renderTimeline();
    if(p.has('stage')) {layoutStage(); schedulePreview();}
    if(p.has('layout')) layoutStage();
    if(p.has('json')) renderJson();
    if(p.has('save')) saveLocal();
    if(p.has('sync')||p.has('panel')) {PS.forEach(f=>f());}
    updTransport();
  }catch(e){ console.error(e); toast('Render error: '+e.message,true); }
}
function mutate(fn,key,flags){
  if(st.playing) pause();
  const now=performance.now();
  if(!(key&&key===lastKey&&(now-lastT<800||gesture===key))) history.record(snap());
  lastKey=key||null; lastT=now;
  fn();
  queue('stage','tl','json','save','sync','layers');
  if(flags) for(const k in flags) if(flags[k]) queue(k);
}
const structural=fn=>{ st.kf=null; mutate(fn,null,{panel:true,comp:false}); };
const snap=()=>JSON.stringify({c:st.comp,x:st.ctx});
function restore(s){
  const o=JSON.parse(s); st.comp=o.c; st.ctx=o.x; st.kf=null;
  if(st.sel!=null&&!findL(st.sel)) st.sel=null;
  st.t=Math.max(st.comp.ip,Math.min(st.comp.op-0.001,st.t));
  const bg=st.comp.metadata&&st.comp.metadata.backgroundColor;
  if(bg) setBg(bg); else $('#canvas').style.removeProperty('--cbg');
  queue('layers','panel','comp','tl','stage','json','save');
}
function undo(){ if(st.playing) pause(); const snapshot=history.undo(snap()); if(snapshot) restore(snapshot); }
function redo(){ if(st.playing) pause(); const snapshot=history.redo(snap()); if(snapshot) restore(snapshot); }
function beginGesture(key){ gesture=key; lastKey=null; clearTimeout(previewTimer); previewTimer=0; }
function endGesture(){ gesture=null; lastKey=null; schedulePreview(0); }
function drag(e,move,up){
  const mv=ev=>move(ev);
  const u=ev=>{ removeEventListener('pointermove',mv); removeEventListener('pointerup',u); removeEventListener('pointercancel',u); if(up) up(ev); };
  addEventListener('pointermove',mv); addEventListener('pointerup',u); addEventListener('pointercancel',u);
}

/* ---------- load / save ---------- */
function loadComp(obj,opts={}){
  const c=normalize(obj);
  if(st.playing) pause();
  if(st.comp&&!opts.initial) history.record(snap());
  if(opts.initial) history.clear();
  st.comp=c; st.ctx=null; st.sel=null; st.kf=null; st.t=c.ip; st.expanded={}; st.locked={};
  const top=c.layers[0]; if(top&&!opts.initial){ st.sel=top.ind; st.expanded[top.ind]=true; }
  const bg=c.metadata&&c.metadata.backgroundColor;
  if(bg) setBg(bg); else $('#canvas').style.removeProperty('--cbg');
  const report=validateAnimation(c);
  if(report.warnings.length) toast(report.warnings[0],true);
  queue('layers','panel','comp','tl','stage','json','save');
}
function setBg(bg){ $('#canvas').style.setProperty('--cbg','rgb('+bg.r+','+bg.g+','+bg.b+')'); }
let saveT=0;
function saveLocal(){ clearTimeout(saveT); saveT=setTimeout(()=>{ try{ localStorage.setItem('lottie-bench:v1',JSON.stringify(st.comp)); }catch(e){} },400); }
function exportData(){ return exportAnimation(st.comp); }

/* ---------- layers panel ---------- */
function selectLayer(ind,keepKf,itemRef=null){
  st.sel=ind; st.itemSel=itemRef; if(!keepKf) st.kf=null;
  if(ind!=null) st.expanded[ind]=true;
  queue('layers','panel','tl','sync'); positionOverlay();
}
function renderLayers(){
  const box=$('#layerlist'); box.textContent='';
  const crumb=$('#crumb');
  if(st.ctx){ crumb.hidden=false; crumb.textContent=''; crumb.append(h('button',{class:'btn',onclick:()=>{ st.ctx=null; st.sel=null; st.kf=null; queue('layers','panel','tl','stage'); }},'← Root'),h('span',{},'Editing precomp '+st.ctx)); }
  else crumb.hidden=true;
  const ls=curLayers();
  if(!ls.length) box.append(h('div',{class:'empty'},'No layers yet. Use + Add above.'));
  ls.forEach(L=>{
    const row=h('div',{class:'lrow'+(st.sel===L.ind?' sel':''),role:'button','aria-selected':st.sel===L.ind?'true':'false',tabindex:'0',onclick:e=>{ if(e.target.closest('button')) return; selectLayer(L.ind); },onkeydown:e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); selectLayer(L.ind); } },ondblclick:()=>rename(L,row)},
      h('button',{class:'ib sm',title:'Show / hide',onclick:e=>{e.stopPropagation(); mutate(()=>{ L.hd=!L.hd; },null);}},icon(L.hd?'eyeoff':'eye')),
      h('button',{class:'ib sm',title:'Lock (ignored by canvas clicks)',onclick:e=>{e.stopPropagation(); st.locked[L.ind]=!st.locked[L.ind]; queue('layers');}},icon(st.locked[L.ind]?'lock':'unlock')),
      h('span',{class:'badge'},TYPEBADGE[L.ty]||'?'),
      h('span',{class:'nm',title:L.nm||''},L.nm||('Layer '+L.ind)));
    box.append(row);
  });
  const tools=$('#layerTools'); tools.textContent='';
  const has=st.sel!=null&&findL(st.sel);
  const b=(ic,title,fn)=>{ const x=h('button',{class:'ib',title,disabled:!has,onclick:fn},icon(ic)); tools.append(x); };
  b('up','Move layer up',()=>moveLayer(-1)); b('down','Move layer down',()=>moveLayer(1));
  b('copy','Duplicate (Ctrl+D)',dupLayer); b('trash','Delete layer',delLayer);
}
function rename(L,row){
  const nm=row.querySelector('.nm'); const inp=h('input',{type:'text',class:'rn',value:L.nm||''});
  inp.value=L.nm||''; nm.replaceWith(inp); inp.focus(); inp.select();
  const done=ok=>{ if(done.d) return; done.d=true; if(ok&&inp.value!==L.nm) mutate(()=>{L.nm=inp.value||'Layer';},null,{panel:true}); else queue('layers'); };
  inp.onblur=()=>done(true); inp.onkeydown=e=>{ if(e.key==='Enter') done(true); if(e.key==='Escape') done(false); e.stopPropagation(); };
  inp.onclick=e=>e.stopPropagation(); inp.ondblclick=e=>e.stopPropagation();
}
function moveLayer(d){
  const ls=curLayers(),i=ls.findIndex(l=>l.ind===st.sel),j=i+d; if(i<0||j<0||j>=ls.length) return;
  structural(()=>{ const [x]=ls.splice(i,1); ls.splice(j,0,x); });
}
function dupLayer(){
  const ls=curLayers(),i=ls.findIndex(l=>l.ind===st.sel); if(i<0) return;
  structural(()=>{ const c=clone(ls[i]); c.ind=nextInd(ls); c.nm=(c.nm||'Layer')+' copy'; ls.splice(i,0,c); st.sel=c.ind; st.expanded[c.ind]=true; });
}
function delLayer(){
  const ls=curLayers(),i=ls.findIndex(l=>l.ind===st.sel); if(i<0) return;
  structural(()=>{ const [x]=ls.splice(i,1); ls.forEach(l=>{ if(l.parent===x.ind) delete l.parent; }); st.sel=ls[Math.min(i,ls.length-1)]?ls[Math.min(i,ls.length-1)].ind:null; });
}

/* ---------- inspector ---------- */
function numInput(extra){ return h('input',{type:'number',step:'any',...extra}); }
function setIn(inp,v){ if(document.activeElement!==inp) inp.value=String(fmt(v)); }
function renderPanel(){
  const box=$('#paneProps'); box.textContent=''; PS=[];
  const L=st.sel!=null?findL(st.sel):null;
  if(!L){ box.append(h('div',{class:'empty'},'Select a layer to edit it, or add one from the Layers panel.')); return; }
  const rows=buildRows(L,curLayers());
  if(st.kf&&st.kf.ind===L.ind){
    const r=rows.find(x=>x.type==='prop'&&x.key===st.kf.key);
    if(r&&r.prop.a&&r.prop.k.includes(st.kf.kf)) box.append(easingEl(st.kf.kf,r));
    else st.kf=null;
  }
  rows.forEach(r=>{
    if(r.type==='head') box.append(headRow(r,L));
    else if(r.type==='prop') box.append(propRow(r,L));
    else if(r.type==='field') box.append(fieldRow(r,L));
    else if(r.type==='note') box.append(h('div',{class:'note'},r.text));
  });
  PS.forEach(f=>f());
}
function headRow(r,L){
  const active=st.itemSel&&st.itemSel.ind===L.ind&&st.itemSel.key===r.key;
  const el=h('div',{class:'ph d'+Math.min(r.depth||0,4)+(active?' active-item':'')},h('span',{class:'t'},r.label));
  if(r.add){
    const sel=h('select',{class:'mini',title:'Add to '+r.label,onchange:()=>{ const v=sel.value; sel.value=''; if(v) structural(()=>applyAdd(r.add.arr,v,r.add.top)); }},h('option',{value:''},'+ Add'),r.add.options.map(([v,l])=>h('option',{value:v},l)));
    el.append(sel);
  }
  if(r.open) el.append(h('button',{class:'btn',onclick:()=>{ st.ctx=r.open; st.sel=null; st.kf=null; queue('layers','panel','tl'); }},'Open'));
  if(r.item&&r.item.ty!=='tr'){
    const a=r.arr,i=r.idx;
    el.append(
      h('button',{class:'ib sm',title:'Move up',disabled:i===0,onclick:()=>structural(()=>{ [a[i-1],a[i]]=[a[i],a[i-1]]; })},icon('up')),
      h('button',{class:'ib sm',title:'Move down',disabled:i>=a.length-1||a[i+1].ty==='tr',onclick:()=>structural(()=>{ [a[i+1],a[i]]=[a[i],a[i+1]]; })},icon('down')),
      h('button',{class:'ib sm',title:'Remove',onclick:()=>structural(()=>{ a.splice(i,1); })},icon('x')));
  }
  return el;
}
function fieldRow(f,L){
  const key='f:'+L.ind+':'+f.key; let inp;
  const flags={panel:!!f.rebuild};
  if(f.input==='select'){
    inp=h('select',{},f.options.map(([v,l])=>h('option',{value:v},l)));
    inp.onchange=()=>mutate(()=>f.set(inp.value),key,flags);
  }else if(f.input==='color'){
    inp=h('input',{type:'color'}); inp.oninput=()=>mutate(()=>f.set(inp.value),key,flags);
  }else if(f.input==='number'){
    inp=numInput(); inp.oninput=()=>{ const v=inp.valueAsNumber; if(Number.isFinite(v)) mutate(()=>f.set(v),key,flags); };
  }else{
    inp=h('input',{type:'text'}); inp.oninput=()=>mutate(()=>f.set(inp.value),key,flags);
  }
  PS.push(()=>{ if(document.activeElement!==inp) inp.value=f.get(); });
  inp.value=f.get();
  return h('div',{class:'frow'},h('label',{},f.label),h('div',{class:'vals'},inp));
}
function propRow(r,L){
  const key='p:'+L.ind+':'+r.key;
  const stw=h('button',{class:'ib stw',title:'Animate (stopwatch): adds a keyframe at the playhead',onclick:()=>mutate(()=>toggleAnim(r,st.t),null,{tl:true})},icon('stopwatch'));
  const dia=h('button',{class:'ib dia',title:'Add / remove keyframe at playhead',onclick:()=>mutate(()=>{
    const p=r.prop; if(!p.a){ toggleAnim(r,st.t); return; }
    const lt=st.t-r.off,i=p.k.findIndex(k=>Math.abs(k.t-lt)<0.5);
    if(i>=0){ if(st.kf&&st.kf.kf===p.k[i]) st.kf=null; removeKey(r,i); }
    else addKey(p,Math.round(lt),r.kind==='num'?readRow(r,st.t):readRow(r,st.t).slice());
    queue('panel');
  })},icon('diamond'));
  let inputs=[];
  const wrap=h('div',{class:'vals'});
  if(r.kind==='num'){
    const inp=numInput(); inputs=[inp];
    inp.oninput=()=>{ let v=inp.valueAsNumber; if(!Number.isFinite(v)) return; if(r.min!=null) v=Math.max(r.min,v); if(r.max!=null) v=Math.min(r.max,v); mutate(()=>writeRow(r,st.t,v),key); };
    wrap.append(inp);
  }else if(r.kind==='vec'){
    const lk=r.link?(st.link[L.ind+r.key]!==false):false;
    for(let i=0;i<2;i++){
      const inp=numInput(); inputs.push(inp);
      inp.oninput=()=>{
        const nv=inp.valueAsNumber; if(isNaN(nv)) return;
        const cur=readRow(r,st.t).slice(), old=cur[i];
        cur[i]=nv;
        if(r.link&&st.link[L.ind+r.key]!==false){ const j=1-i; cur[j]=old?cur[j]*nv/old:nv; }
        mutate(()=>writeRow(r,st.t,cur),key);
        PS.forEach(f=>f());
      };
      wrap.append(inp);
    }
    if(r.link){
      const lb=h('button',{class:'ib sm'+(lk?' on':''),title:'Link both values',onclick:()=>{ st.link[L.ind+r.key]=st.link[L.ind+r.key]===false; lb.classList.toggle('on',st.link[L.ind+r.key]!==false); }},icon('link'));
      wrap.append(lb);
    }
  }else{
    const inp=h('input',{type:'color'}); inputs=[inp];
    inp.oninput=()=>{ const cur=readRow(r,st.t).slice(),c=hexRgb(inp.value); cur[0]=c[0]; cur[1]=c[1]; cur[2]=c[2]; mutate(()=>writeRow(r,st.t,cur),key); };
    wrap.append(inp);
  }
  const lab=h('label',{title:r.label+(r.unit?' ('+r.unit+')':''),class:r.kind==='num'?'scrub':''},r.label);
  if(r.kind==='num') lab.addEventListener('pointerdown',e=>{
    e.preventDefault(); const x0=e.clientX,v0=readRow(r,st.t); beginGesture(key);
    drag(e,ev=>{ let v=v0+(ev.clientX-x0)*(ev.shiftKey?0.1:1)*(r.unit==='%'||r.unit==='°'?1:0.5); v=Math.round(v*100)/100; if(r.min!=null) v=Math.max(r.min,v); if(r.max!=null) v=Math.min(r.max,v); mutate(()=>writeRow(r,st.t,v),key); },endGesture);
  });
  PS.push(()=>{
    const v=readRow(r,st.t);
    if(r.kind==='num') setIn(inputs[0],v);
    else if(r.kind==='vec'){ setIn(inputs[0],v[0]); setIn(inputs[1],v[1]); }
    else if(document.activeElement!==inputs[0]) inputs[0].value=rgbHex(v);
    stw.classList.toggle('on',!!r.prop.a);
    const has=!!r.prop.a&&r.prop.k.some(k=>Math.abs(k.t-(st.t-r.off))<0.5);
    dia.classList.toggle('on',has); dia.classList.toggle('dim',!r.prop.a);
  });
  return h('div',{class:'prow'},stw,lab,wrap,dia);
}
function easingEl(kf,row){
  const box=h('div',{class:'ease'});
  const L=st.sel;
  const dimensions=(row.kind==='vec'||row.kind==='color')&&Array.isArray(kf.s)?Math.max(1,kf.s.length):1;
  const dimensionNames=row.kind==='color'?['Red','Green','Blue','Alpha']:['X','Y','Z','W'];
  let activeDimension=0;
  const gh=()=>easingHandles(kf,activeDimension);
  const replaceComponent=(existing,index,value,count,fallback)=>{
    const values=Array.isArray(existing)?existing.slice():Array(count).fill(Number.isFinite(existing)?existing:fallback);
    while(values.length<count) values.push(Number.isFinite(values[values.length-1])?values[values.length-1]:fallback);
    values[index]=value;
    return values;
  };
  const sh=a=>{
    const count=dimensions;
    kf.o={...(kf.o||{}),x:replaceComponent(kf.o?.x,activeDimension,a[0],count,0),y:replaceComponent(kf.o?.y,activeDimension,a[1],count,0)};
    kf.i={...(kf.i||{}),x:replaceComponent(kf.i?.x,activeDimension,a[2],count,1),y:replaceComponent(kf.i?.y,activeDimension,a[3],count,1)};
    delete kf.h;
  };
  const tin=numInput({title:'Frame of this keyframe'}); tin.value=String(kf.t+row.off);
  tin.oninput=()=>{ const v=tin.valueAsNumber; if(!Number.isFinite(v)) return; mutate(()=>{ kf.t=v-row.off; row.prop.k.sort((a,b)=>a.t-b.t); },'kt'+L,{panel:false}); };
  const del=h('button',{class:'btn',onclick:()=>{ const i=row.prop.k.indexOf(kf); structural(()=>removeKey(row,i)); }},'Delete keyframe');
  box.append(h('div',{class:'row',style:'align-items:center'},h('b',{},'Keyframe'),h('span',{class:'note',style:'margin:0'},'frame'),h('div',{style:'width:70px'},tin),del));
  const cv=h('div',{class:'curve'});
  cv.innerHTML='<svg viewBox="0 0 200 200"><rect class="cbox" x="20" y="20" width="160" height="160"/><path class="cdiag" d="M20 180L180 20"/><line class="h1"/><line class="h2"/><path class="cc" fill="none"/><circle class="p1" r="7"/><circle class="p2" r="7"/></svg>';
  const svg=cv.firstChild,q=c=>svg.querySelector(c);
  const nums=[0,1,2,3].map(()=>numInput({step:'0.01'}));
  const X=x=>20+160*x,Y=y=>180-160*y;
  const draw=()=>{
    const a=gh();
    q('.h1').setAttribute('x1',X(0)); q('.h1').setAttribute('y1',Y(0)); q('.h1').setAttribute('x2',X(a[0])); q('.h1').setAttribute('y2',Y(a[1]));
    q('.h2').setAttribute('x1',X(1)); q('.h2').setAttribute('y1',Y(1)); q('.h2').setAttribute('x2',X(a[2])); q('.h2').setAttribute('y2',Y(a[3]));
    q('.cc').setAttribute('d','M'+X(0)+' '+Y(0)+' C'+X(a[0])+' '+Y(a[1])+' '+X(a[2])+' '+Y(a[3])+' '+X(1)+' '+Y(1));
    q('.p1').setAttribute('cx',X(a[0])); q('.p1').setAttribute('cy',Y(a[1])); q('.p2').setAttribute('cx',X(a[2])); q('.p2').setAttribute('cy',Y(a[3]));
    nums.forEach((n,i)=>{ if(document.activeElement!==n) n.value=String(Math.round(a[i]*1000)/1000); });
    hold.checked=!!kf.h; cv.style.opacity=kf.h?.35:1;
  };
  const hold=h('input',{type:'checkbox',id:'holdkf'});
  hold.onchange=()=>{ mutate(()=>{ if(hold.checked) kf.h=1; else delete kf.h; },'hold'); draw(); };
  const set=a=>{ mutate(()=>sh(a),'ease'+L); draw(); };
  [['p1',0],['p2',2]].forEach(([c,o])=>{
    q('.'+c).addEventListener('pointerdown',e=>{
      e.preventDefault(); beginGesture('ease'+L);
      drag(e,ev=>{ const r=svg.getBoundingClientRect(); const px=(ev.clientX-r.left)*200/r.width,py=(ev.clientY-r.top)*200/r.height;
        const a=gh(); a[o]=Math.max(0,Math.min(1,(px-20)/160)); a[o+1]=Math.max(-0.5,Math.min(1.5,(180-py)/160)); set(a); },endGesture);
    });
  });
  nums.forEach((n,i)=>{ n.oninput=()=>{ const v=n.valueAsNumber; if(!Number.isFinite(v)) return; const a=gh(); a[i]=(i%2===0)?Math.max(0,Math.min(1,v)):v; set(a); }; });
  const presets=[['Linear',[0,0,1,1]],['Ease in',[.42,0,1,1]],['Ease out',[0,0,.58,1]],['Ease in-out',[.42,0,.58,1]],['Back',[.34,1.56,.64,1]],['Anticipate',[.36,-0.4,.64,1]]];
  box.append(h('div',{class:'row'},presets.map(([n,a])=>h('button',{class:'btn',onclick:()=>{ mutate(()=>sh(a),null); draw(); }},n))));
  const controls=h('div',{style:'flex:1;min-width:120px'});
  if(dimensions>1){
    const component=h('select',{title:'Choose which vector or color channel to edit'},Array.from({length:dimensions},(_,index)=>h('option',{value:index},dimensionNames[index]||('Channel '+(index+1)))));
    component.onchange=()=>{ activeDimension=Number(component.value)||0; draw(); };
    controls.append(h('div',{class:'frow',style:'grid-template-columns:74px minmax(0,1fr);margin-bottom:6px'},h('label',{},'Component'),component));
  }
  controls.append(h('div',{class:'note',style:'margin-top:0'},'Easing from this keyframe to the next. Drag the two handles, or type values. Other vector channels keep their own curves.'),h('div',{class:'grid4'},nums),h('label',{class:'note'},hold,' Hold (jump, no tween)'));
  box.append(h('div',{style:'display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap'},cv,controls));
  draw();
  return box;
}

/* ---------- composition pane ---------- */
function renderCompPane(){
  const box=$('#paneComp'); box.textContent=''; const c=st.comp;
  const f=(label,el)=>box.append(h('div',{class:'frow'},h('label',{},label),h('div',{class:'vals'},el)));
  const num=(get,set,flags)=>{ const i=numInput(); i.value=String(get()); i.onchange=()=>{ const v=i.valueAsNumber; if(!Number.isFinite(v)) return; mutate(()=>set(v),null,flags); i.value=String(get()); }; return i; };
  const nm=h('input',{type:'text'}); nm.value=c.nm||''; nm.oninput=()=>mutate(()=>{c.nm=nm.value;},'compnm');
  box.append(h('div',{class:'ph'},h('span',{class:'t'},'Composition')));
  f('Name',nm);
  f('Width',num(()=>c.w,v=>setSize(Math.max(1,Math.round(v)),c.h),{comp:true,stage:true}));
  f('Height',num(()=>c.h,v=>setSize(c.w,Math.max(1,Math.round(v))),{comp:true,stage:true}));
  const cen=h('input',{type:'checkbox'}); cen.checked=st.center; cen.onchange=()=>{ st.center=cen.checked; };
  box.append(h('label',{class:'note'},cen,' Keep layers centered when the size changes (shifts top-level layer positions by half the difference)'));
  f('Frame rate',num(()=>c.fr,v=>{ c.fr=Math.max(1,v); },{comp:true}));
  f('In frame',num(()=>c.ip,v=>{ c.ip=Math.min(v,c.op-1); },{comp:true,tl:true}));
  f('Out frame',num(()=>c.op,v=>{ c.op=Math.max(v,c.ip+1); },{comp:true,tl:true}));
  box.append(h('div',{class:'note'},'Duration '+fmt((c.op-c.ip)/c.fr)+' s at '+c.fr+' fps'));
  const bg=c.metadata&&c.metadata.backgroundColor||{r:255,g:255,b:255};
  const bi=h('input',{type:'color'}); bi.value=rgbHex([bg.r/255,bg.g/255,bg.b/255]);
  bi.oninput=()=>{ const v=hexRgb(bi.value); mutate(()=>{ c.metadata=c.metadata||{}; c.metadata.backgroundColor={r:Math.round(v[0]*255),g:Math.round(v[1]*255),b:Math.round(v[2]*255)}; setBg(c.metadata.backgroundColor); },'bg'); };
  f('Background',bi);
  box.append(h('div',{class:'note'},'Background is stored as metadata and shown in the preview. Players ignore it; add a Solid layer to bake a background into the animation.'));
  if(c.assets.some(a=>a.layers)){
    box.append(h('div',{class:'ph'},h('span',{class:'t'},'Precomps')));
    c.assets.filter(a=>a.layers).forEach(a=>box.append(h('div',{class:'frow',style:'grid-template-columns:1fr auto'},h('span',{},a.nm||a.id),h('button',{class:'btn',onclick:()=>{ st.ctx=a.id; st.sel=null; st.kf=null; queue('layers','panel','tl'); }},'Edit'))));
  }
}
function setSize(w,hh){
  const c=st.comp,dx=(w-c.w)/2,dy=(hh-c.h)/2;
  if(st.center&&(dx||dy)) c.layers.forEach(L=>{ if(L.parent==null) shiftPos(L,dx,dy); });
  c.w=w; c.h=hh;
}

/* ---------- stage ---------- */
function layoutStage(){
  const c=st.comp,area=$('#stagearea'),cv=$('#canvas');
  const aw=Math.max(80,area.clientWidth-32),ah=Math.max(80,area.clientHeight-32);
  const base=Math.min(aw/c.w,ah/c.h); st.scale=base*st.zoom;
  cv.style.width=Math.round(c.w*st.scale)+'px'; cv.style.height=Math.round(c.h*st.scale)+'px';
  cv.classList.toggle('solid',!st.transp);
  cv.style.backgroundColor=st.transp?'transparent':'var(--cbg,#fff)';
  positionOverlay();
}
function reloadStage(){
  const id=++loadId,cv=$('#canvas');
  let data;
  try{ data=exportData(); }
  catch(error){ toast('Cannot prepare preview: '+error.message,true); return; }
  if(typeof lottie==='undefined'){ toast('Could not load the Lottie player from the CDN.',true); return; }

  const holder=h('div',{class:'lot',style:'visibility:hidden'});
  cv.insertBefore(holder,cv.firstChild);
  let player=null,settled=false,watchdog=0;
  const cleanup=()=>{
    clearTimeout(watchdog);
    if(player){
      try{ player.removeEventListener('DOMLoaded',finish); }catch(error){}
      try{ player.removeEventListener('data_failed',onFailure); }catch(error){}
      try{ player.destroy(); }catch(error){}
    }
    holder.remove();
  };
  const fail=error=>{
    if(settled) return;
    settled=true;
    cleanup();
    if(id===loadId) toast('Cannot render this animation: '+(error?.message||'invalid Lottie data'),true);
  };
  const finish=()=>{
    if(settled) return;
    clearTimeout(watchdog);
    if(id!==loadId){ settled=true; cleanup(); return; }
    try{ player.goToAndStop(Math.max(0,Math.min(st.t,st.comp.op-0.001)-st.comp.ip),true); }
    catch(error){ fail(error); return; }
    settled=true;
    const old=anim,oldHolder=curHolder;
    anim=player; curHolder=holder; holder.style.visibility='visible';
    if(old){ try{old.destroy();}catch(error){} }
    if(oldHolder) oldHolder.remove();
    positionOverlay();
  };
  const onFailure=()=>fail(new Error('The Lottie player rejected the animation data.'));
  try{
    player=lottie.loadAnimation({container:holder,renderer:'svg',loop:false,autoplay:false,animationData:data});
    player.addEventListener('DOMLoaded',finish);
    player.addEventListener('data_failed',onFailure);
    watchdog=setTimeout(()=>fail(new Error('Preview loading timed out after 10 seconds.')),10000);
  }catch(error){ fail(error); }
}
function insertLayerKeyframes(){
  const L=st.sel!=null?findL(st.sel):null;
  if(!L) return toast('Select a layer first',true);
  const rows=buildRows(L,curLayers()).filter(row=>row.type==='prop'&&row.prop&&row.prop.a);
  if(!rows.length) return toast('This layer has no animated properties yet',true);
  mutate(()=>{
    rows.forEach(row=>writeRow(row,st.t,readRow(row,st.t)));
  },null,{panel:true});
  toast('Keyframes inserted at '+((st.t-st.comp.ip)/st.comp.fr).toFixed(2)+' s');
}
function setT(t){
  const c=st.comp; t=Math.max(c.ip,Math.min(c.op-0.001,Number(t)||c.ip)); st.t=t;
  if(anim){ try{ anim.goToAndStop(Math.min(t,c.op-0.001)-c.ip,true); }catch(e){} }
  updatePlayhead(); PS.forEach(f=>f()); updTransport(); positionOverlay();
}
function positionOverlay(){
  const box=$('#selbox'); box.style.display='none';
  if(st.ctx||st.sel==null||!anim||!anim.renderer||st.tool==='pen') return;
  const idx=st.comp.layers.findIndex(l=>l.ind===st.sel); if(idx<0) return;
  const el=anim.renderer.elements&&anim.renderer.elements[idx];
  const g=el&&(typeof el.getBaseElement==='function'?el.getBaseElement():(el.layerElement||el.baseElement));
  if(!g||!g.getBoundingClientRect) return;
  const r=g.getBoundingClientRect(),cr=$('#canvas').getBoundingClientRect();
  if(r.width<1||r.height<1) return;
  Object.assign(box.style,{display:'block',left:(r.left-cr.left)+'px',top:(r.top-cr.top)+'px',width:r.width+'px',height:r.height+'px'});
}
function hitLayer(target){
  const renderer=anim&&anim.renderer;
  const elements=renderer&&renderer.elements;
  if(!elements) return null;
  return findLayerFromTarget(target,elements,curLayers(),st.locked);
}
function posRows(L){ return buildRows(L,curLayers()).filter(r=>r.type==='prop'&&(r.key==='ks.p'||r.key==='ks.p.x'||r.key==='ks.p.y')); }
$('#canvas').addEventListener('pointerdown',e=>{
  const cv=$('#canvas'),r=cv.getBoundingClientRect();
  if(st.tool==='pen'){ e.preventDefault(); penClick((e.clientX-r.left)/st.scale,(e.clientY-r.top)/st.scale,e); return; }
  const target=e.target instanceof Element?e.target:e.target?.parentElement;
  const L=hitLayer(target);
  if(!L){
    if(target===cv||target?.closest?.('.lot')){
      st.sel=null; st.itemSel=null; st.kf=null;
      queue('layers','panel','tl'); positionOverlay();
    }
    return;
  }
  e.preventDefault();
  if(st.sel!==L.ind) selectLayer(L.ind);
  const pr=posRows(L); if(!pr.length) return;
  const x0=e.clientX,y0=e.clientY,start=pr.map(q=>readRow(q,st.t)); const key='mv'+L.ind; beginGesture(key); let moved=false;
  drag(e,ev=>{
    const dx=(ev.clientX-x0)/st.scale,dy=(ev.clientY-y0)/st.scale; if(!moved&&Math.abs(dx)+Math.abs(dy)<0.5) return; moved=true;
    mutate(()=>{
      pr.forEach((q,i)=>{
        if(q.kind==='vec'){ const v=start[i].slice(); v[0]+=dx; v[1]+=dy; writeRow(q,st.t,v); }
        else writeRow(q,st.t,start[i]+(q.key==='ks.p.x'?dx:dy));
      });
    },key);
  },endGesture);
});
/* pen tool */
function penDraw(){
  const sv=$('#penlayer'); sv.setAttribute('viewBox','0 0 '+st.comp.w+' '+st.comp.h); sv.textContent='';
  const p=st.pen; if(!p.length) return;
  const sw=2/st.scale;
  const pl=document.createElementNS(NS,'polyline'); pl.setAttribute('points',p.map(q=>q.join(',')).join(' ')); pl.setAttribute('fill','none'); pl.setAttribute('stroke','var(--accent)'); pl.setAttribute('stroke-width',sw); sv.append(pl);
  p.forEach((q,i)=>{ const c=document.createElementNS(NS,'circle'); c.setAttribute('cx',q[0]); c.setAttribute('cy',q[1]); c.setAttribute('r',(i===0?6:4)/st.scale); c.setAttribute('fill',i===0?'var(--key)':'var(--accent)'); sv.append(c); });
}
function penClick(x,y,e){
  const p=st.pen;
  if(p.length>=3&&Math.hypot(p[0][0]-x,p[0][1]-y)*st.scale<10){ penFinish(true); return; }
  if(e.detail>=2&&p.length>=2){ penFinish(false); return; }
  p.push([Math.round(x*10)/10,Math.round(y*10)/10]); penDraw();
}
function penFinish(closed){
  const p=st.pen; if(p.length<2){ st.pen=[]; penDraw(); return; }
  const cx=p.reduce((a,q)=>a+q[0],0)/p.length,cy=p.reduce((a,q)=>a+q[1],0)/p.length;
  structural(()=>{
    const ls=curLayers(),c=st.comp,col=PALETTE[ls.length%PALETTE.length];
    const L=addLayer(c,ls,'null'); L.ty=4; L.nm='Path'; L.ks.p=S([Math.round(cx*10)/10,Math.round(cy*10)/10,0]);
    const z=p.map(()=>[0,0]);
    L.shapes=[{ty:'gr',nm:'Path group',it:[{ty:'sh',d:1,nm:'Path',ks:{a:0,k:{c:closed,v:p.map(q=>[Math.round((q[0]-cx)*10)/10,Math.round((q[1]-cy)*10)/10]),i:z,o:z.map(a=>a.slice())}}},closed?fillItem(col):strokeItem(col,10),grTr()],np:3,cix:2,bm:0,ix:1}];
    st.sel=L.ind; st.expanded[L.ind]=true;
  });
  st.pen=[]; penDraw(); setTool('select');
}
function setTool(t){
  st.tool=t; $('#toolSel').classList.toggle('on',t==='select'); $('#toolPen').classList.toggle('on',t==='pen');
  $('#canvas').style.cursor=t==='pen'?'crosshair':'default'; if(t!=='pen'){ st.pen=[]; penDraw(); } positionOverlay();
}

/* ---------- transport ---------- */
let raf=0,lastNow=0;
function play(){
  if(st.playing) return; const c=st.comp;
  if(st.t>=c.op-1) st.t=c.ip;
  st.playing=true; lastNow=performance.now(); raf=requestAnimationFrame(tick); updTransport();
}
function pause(){ if(!st.playing) return; st.playing=false; cancelAnimationFrame(raf); st.t=Math.round(st.t); setT(st.t); updTransport(); }
function tick(now){
  if(!st.playing) return;
  const c=st.comp,dt=(now-lastNow)/1000; lastNow=now;
  let t=st.t+dt*c.fr*st.speed;
  if(t>=c.op){ if(st.loop) t=c.ip+((t-c.op)%Math.max(1,c.op-c.ip)); else { st.playing=false; setT(c.op-1); updTransport(); return; } }
  setT(t); raf=requestAnimationFrame(tick);
}
function updTransport(){
  const c=st.comp; if(!c) return;
  const title=$('#docTitle'),meta=$('#docMeta');
  if(title) title.textContent=c.nm||'Untitled animation';
  if(meta) meta.textContent=c.w+' × '+c.h;
  const play=$('#tPlay');
  play.textContent=''; play.append(icon(st.playing?'pause':'play'));
  play.setAttribute('aria-label',st.playing?'Pause playback':'Play animation');
  $('#tLoop').classList.toggle('on',st.loop);
  const fr=$('#tFrame');
  if(document.activeElement!==fr) fr.value=((st.t-c.ip)/c.fr).toFixed(2);
  $('#timeDuration').textContent=((c.op-c.ip)/c.fr).toFixed(2)+' s';
  $('#timefld').textContent=((st.t-c.ip)/c.fr).toFixed(2)+'s / '+((c.op-c.ip)/c.fr).toFixed(2)+'s · '+(c.op-c.ip)+'f';
  $('#btnUndo').disabled=!history.canUndo; $('#btnRedo').disabled=!history.canRedo;
}

/* ---------- timeline ---------- */
function timelineLabelWidth(){
  const left=$('#timeline-left');
  if(left){
    const width=left.getBoundingClientRect().width;
    if(Number.isFinite(width)&&width>0) return width;
  }
  const row=$('#tlinner .tr .lab');
  const fallback=row&&row.getBoundingClientRect().width;
  return Number.isFinite(fallback)&&fallback>0?fallback:398;
}
function xToT(clientX){
  const inner=$('#tlinner').getBoundingClientRect();
  return clientXToFrame(clientX,inner.left,st.comp.ip,st.ppf,timelineLabelWidth());
}
function updatePlayhead(){
  const frameOffset=st.t-st.comp.ip;
  const labelWidth=timelineLabelWidth();
  const playhead=$('#ph');
  if(playhead){
    playhead.style.left=frameToTimelineX(st.t,st.comp.ip,st.ppf,labelWidth)+'px';
    playhead.dataset.frame=String(Math.round(frameOffset));
  }
  const ruler=$('#tlruler'),sc=$('#tlscroll'),rulerHead=$('#tlRulerPh');
  if(ruler&&sc) ruler.style.transform='translateX('+(-sc.scrollLeft)+'px)';
  if(rulerHead&&sc){
    rulerHead.style.left=(frameOffset*st.ppf-sc.scrollLeft)+'px';
    rulerHead.dataset.frame=String(Math.round(frameOffset));
  }
}
function scrub(e){
  if(e.target?.closest?.('.ruler-tools')) return;
  const inner=$('#tlinner').getBoundingClientRect();
  if(e.clientX-inner.left<timelineLabelWidth()) return;
  if(st.playing) pause();
  setT(Math.round(xToT(e.clientX)));
  drag(e,ev=>setT(Math.round(xToT(ev.clientX))));
}
function timelineEntriesForLayer(L,layers){
  const entries=[];
  const rows=buildRows(L,layers);
  let activeItem=null;
  rows.forEach(row=>{
    if(row.type==='head'&&row.item&&row.item.ty!=='tr'){
      const type=row.item.ty;
      if(!['gr','sh','rc','el','sr'].includes(type)) return;
      const label=type==='sh'&&!row.item.nm?'Vector':row.label;
      activeItem={key:row.key,item:row.item,label,depth:Math.max(1,(row.depth||1)+1)};
      entries.push({kind:'item',...activeItem});
      return;
    }
    if(row.type==='prop'&&row.prop&&row.prop.a){
      entries.push({
        kind:'property',row,label:row.label,
        depth:Math.max(1,(row.depth||0)+1),
        parentKey:activeItem?.key||null,
        parentItem:activeItem?.item||null
      });
    }
  });
  return entries;
}
function makeTimelineLabel(kind,label,depth,selected,onSelect){
  const glyph=h('span',{class:'timeline-glyph '+kind});
  if(kind==='artboard') glyph.textContent='ℓ';
  else if(kind==='layer') glyph.append(h('span',{},'▱'));
  else if(kind==='item') glyph.textContent='◇';
  else glyph.textContent='◇';
  const lab=h('div',{class:'lab '+(kind==='artboard'?'artboard-lab':kind==='layer'?'layer-lab':kind==='item'?'item-lab':'prop-lab')+(selected?' sel':''),style:'padding-left:'+(18+Math.max(0,depth)*20)+'px',onclick:onSelect,title:label});
  lab.append(glyph,h('span',{class:'nm'},label));
  return lab;
}
function addLayerBar(track,L,selected,ppf,comp){
  const layerIn=Number.isFinite(L.ip)?L.ip:comp.ip;
  const layerOut=Number.isFinite(L.op)?L.op:comp.op;
  const left=(layerIn-comp.ip)*ppf;
  const width=Math.max(6,(layerOut-layerIn)*ppf);
  const bar=h('div',{class:'track-bar'+(selected?' sel':''),style:'left:'+left+'px;width:'+width+'px',title:'Drag to move this layer; drag either edge to trim it'});
  const inner=h('div',{class:'hd l'});
  const outer=h('div',{class:'hd r'});
  bar.append(inner,outer);
  bar.addEventListener('pointerdown',e=>{
    e.stopPropagation(); e.preventDefault();
    const mode=e.target.classList.contains('l')?'in':e.target.classList.contains('r')?'out':'move';
    const x0=e.clientX,ip0=Number.isFinite(L.ip)?L.ip:comp.ip,op0=Number.isFinite(L.op)?L.op:comp.op,s0=L.st||0,key='bar'+L.ind+mode;
    beginGesture(key);
    drag(e,ev=>{
      const delta=Math.round((ev.clientX-x0)/st.ppf);
      if(!delta) return;
      mutate(()=>{
        if(mode==='move'){ L.ip=ip0+delta; L.op=op0+delta; L.st=s0+delta; }
        else if(mode==='in') L.ip=Math.min(ip0+delta,L.op-1);
        else L.op=Math.max(op0+delta,L.ip+1);
      },key);
    },endGesture);
  });
  track.append(bar);
}
function addPropertyKeyframes(track,entry,L,ppf,comp){
  const row=entry.row, property=row.prop;
  const line=h('div',{class:'property-range'});
  track.append(line);
  property.k.forEach(keyframe=>{
    const frame=keyframe.t+row.off;
    const selected=st.kf&&st.kf.ind===L.ind&&st.kf.key===row.key&&st.kf.kf===keyframe;
    const diamond=h('div',{class:'kf'+(selected?' sel':''),style:'left:'+(frame-comp.ip)*ppf+'px',title:'Frame '+fmt(frame)});
    diamond.addEventListener('pointerdown',e=>{
      e.stopPropagation(); e.preventDefault();
      selectLayer(L.ind,false,{key:entry.parentKey||row.key,item:entry.parentItem||null});
      st.kf={ind:L.ind,key:row.key,kf:keyframe};
      queue('layers','panel','tl'); setT(frame);
      const x0=e.clientX,t0=keyframe.t,key='kd'+L.ind+row.key;
      beginGesture(key);
      drag(e,ev=>{
        const delta=Math.round((ev.clientX-x0)/st.ppf);
        if(!delta) return;
        mutate(()=>{ keyframe.t=t0+delta; property.k.sort((a,b)=>a.t-b.t); },key);
        setT(keyframe.t+row.off);
      },()=>{ endGesture(); queue('panel'); });
    });
    track.append(diamond);
  });
  track.addEventListener('pointerdown',scrub);
  track.addEventListener('dblclick',e=>{
    const frame=Math.round(xToT(e.clientX)); setT(frame);
    mutate(()=>{
      if(!property.a) toggleAnim(row,frame);
      else if(!property.k.some(keyframe=>Math.abs(keyframe.t+row.off-frame)<0.5)){
        addKey(property,Math.round(frame-row.off),row.kind==='num'?readRow(row,frame):readRow(row,frame).slice());
      }
    },null,{panel:true});
  });
}
function renderTimeline(){
  const sc=$('#tlscroll'),inner=$('#tlinner'),c=st.comp;
  if(!sc||!inner||!c) return;
  const sl=sc.scrollLeft,stp=sc.scrollTop;
  inner.textContent='';
  const duration=Math.max(1,c.op-c.ip);
  const labelWidth=timelineLabelWidth();
  const metrics=timelineScale({viewportWidth:sc.clientWidth,labelWidth,duration,zoom:st.tlzoom,gutter:30});
  const ppf=metrics.pixelsPerFrame,W=metrics.trackWidth;
  st.ppf=ppf;
  inner.style.width=metrics.contentWidth+'px';

  // The ruler lives in the transport header and scrolls in lockstep with the tracks.
  const ruler=$('#tlruler');
  if(ruler){
    ruler.textContent='';
    ruler.style.width=W+'px';
    const seconds=Math.max(0,duration/c.fr);
    const pxPerSecond=ppf*c.fr;
    const majorStep=[0.1,0.2,0.25,0.5,1,2,5,10,30,60].find(step=>step*pxPerSecond>=145)||120;
    const minorStep=majorStep>=1?majorStep/5:majorStep/5;
    for(let sec=0;sec<=seconds+minorStep/2;sec+=minorStep){
      const x=sec*pxPerSecond;
      if(x>W+1) break;
      const major=Math.abs(sec/majorStep-Math.round(sec/majorStep))<0.001;
      if(major){
        const tick=h('div',{class:'major-tick'+(sec<0.001?' first':''),style:'left:'+x+'px'});
        if(sec>0.001||seconds<=0.5) tick.append(h('span',{},sec.toFixed(1)));
        ruler.append(tick);
      }else ruler.append(h('div',{class:'minor-dot',style:'left:'+x+'px'}));
    }
  }

  const appendRow=(kind,label,depth,selected,select,draw)=>{
    const lab=makeTimelineLabel(kind,label,depth,selected,select);
    const track=h('div',{class:'track',style:'width:'+W+'px'});
    if(draw) draw(track);
    inner.append(h('div',{class:'tr '+kind},lab,track));
  };

  // Artboard row is a stable root track above the layer hierarchy.
  appendRow('artboard','Artboard 1',0,false,()=>{ st.sel=null; st.itemSel=null; st.kf=null; queue('layers','panel','tl'); positionOverlay(); },track=>{
    const bar=h('div',{class:'track-bar artboard-bar',style:'left:0;width:'+W+'px',title:'Composition duration'});
    track.append(bar);
  });

  curLayers().forEach(L=>{
    const selected=st.sel===L.ind;
    const open=!!st.expanded[L.ind];
    appendRow('layer',L.nm||('Layer '+L.ind),0,selected,()=>selectLayer(L.ind),track=>{
      addLayerBar(track,L,selected,ppf,c);
    });
    if(!open) return;

    timelineEntriesForLayer(L,curLayers()).forEach(entry=>{
      if(entry.kind==='item'){
        const itemSelected=st.itemSel&&st.itemSel.ind===L.ind&&st.itemSel.key===entry.key;
        appendRow('item',entry.label,entry.depth,itemSelected,()=>selectLayer(L.ind,false,{key:entry.key,item:entry.item}),track=>{
          addLayerBar(track,L,itemSelected,ppf,c);
        });
      }else{
        const propertySelected=st.kf&&st.kf.ind===L.ind&&st.kf.key===entry.row.key;
        appendRow('property',entry.label,entry.depth,propertySelected,()=>selectLayer(L.ind,false,{key:entry.parentKey||entry.row.key,item:entry.parentItem||null}),track=>{
          addPropertyKeyframes(track,entry,L,ppf,c);
        });
      }
    });
  });

  inner.append(h('div',{id:'ph','data-frame':String(Math.round(st.t-c.ip))}));
  sc.scrollLeft=sl; sc.scrollTop=stp;
  updatePlayhead();
}

/* ---------- JSON pane + export ---------- */
function jsonText(){ return JSON.stringify(exportData(),null,st.minify?0:2); }
function renderJson(){
  if($('#paneCode').hidden) return;
  const ta=$('#codeText'); if(document.activeElement===ta) return;
  const t=jsonText(); ta.value=t;
  const report=validateAnimation(st.comp);
  const suffix=report.errors.length?' · '+report.errors.length+' errors':report.warnings.length?' · '+report.warnings.length+' warnings':' · structure OK';
  setStat(Math.round(t.length/102.4)/10+' KB · '+st.comp.layers.length+' layers'+suffix,report.errors.length>0,report.warnings.length>0&&!report.errors.length);
}
function setStat(m,err,warn){ const s=$('#codeStat'); s.textContent=m; s.className='stat'+(err?' err':warn?' warn':''); }
function applyJson(text){
  try{ const o=JSON.parse(text); loadComp(o); setStat('Applied.',false); toast('JSON applied'); }
  catch(e){ setStat('Cannot apply: '+e.message,true); toast('Cannot apply: '+e.message,true); }
}
async function saveFile(name,data){
  try{
    const type=name.toLowerCase().endsWith('.svg')?'image/svg+xml;charset=utf-8':'application/json;charset=utf-8';
    const blob=new Blob([data],{type});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url; a.download=name; a.style.display='none';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
    toast('Saved '+name);
  }catch(e){ toast('Could not save: '+(e&&e.message||'download failed'),true); }
}
async function copyJson(){
  const t=jsonText();
  try{ await navigator.clipboard.writeText(t); toast('JSON copied'); }
  catch(e){ showCode(); const ta=$('#codeText'); ta.value=t; ta.focus(); ta.select(); toast('Select all and copy (Ctrl+C)'); }
}
const fname=ext=>(st.comp.nm||'animation').replace(/[^\w\-]+/g,'-').toLowerCase()+ext;
function showCode(){ setTab('code'); }
function frameSvg(){
  const svg=curHolder&&curHolder.querySelector('svg'); if(!svg) return null;
  const c=svg.cloneNode(true); c.setAttribute('xmlns',NS); c.setAttribute('width',st.comp.w); c.setAttribute('height',st.comp.h);
  return new XMLSerializer().serializeToString(c);
}
function readFile(f){
  const r=new FileReader(); r.onload=()=>{ try{ loadComp(JSON.parse(r.result)); toast('Imported '+f.name); }catch(e){ toast('Cannot import: '+e.message,true); } };
  r.onerror=()=>toast('Could not read the file',true); r.readAsText(f);
}
function setTab(t){
  st.tab=t; document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('on',b.dataset.tab===t));
  $('#paneProps').hidden=t!=='props'; $('#paneComp').hidden=t!=='comp'; $('#paneCode').hidden=t!=='code';
  if(t==='code') renderJson(); if(t==='comp') renderCompPane();
}

/* ---------- wiring ---------- */
function setupIcons(){
  $('#btnUndo').append(icon('undo')); $('#btnRedo').append(icon('redo'));
  $('#toolSel').append(icon('cursor')); $('#toolPen').append(icon('pen'));
  $('#zOut').append(icon('minus')); $('#zIn').append(icon('plus'));
  $('#tFirst').append(icon('first')); $('#tLast').append(icon('last')); $('#tLoop').append(icon('loop'));
}
function wire(){
  $('#btnUndo').onclick=undo; $('#btnRedo').onclick=redo;
  $('#layersFocus').onclick=()=>$('#layerlist').focus();
  $('#btnImport').onclick=()=>$('#file').click();
  $('#file').onchange=e=>{ const f=e.target.files[0]; if(f) readFile(f); e.target.value=''; };
  $('#btnExport').onclick=()=>saveFile(fname('.json'),jsonText());
  $('#btnCopy').onclick=copyJson; $('#codeCopy').onclick=copyJson;
  $('#codeDl').onclick=()=>saveFile(fname('.json'),jsonText());
  $('#codeSvg').onclick=()=>{ const s=frameSvg(); if(!s) return toast('Nothing rendered yet',true); saveFile(fname('-frame-'+Math.round(st.t)+'.svg'),s); };
  $('#codeApply').onclick=()=>applyJson($('#codeText').value);
  $('#codeMin').onchange=e=>{ st.minify=e.target.checked; $('#codeText').blur(); renderJson(); };
  $('#codeText').addEventListener('input',()=>{ try{ JSON.parse($('#codeText').value); setStat('Valid JSON. Press Apply to load it.',false); }catch(e){ setStat(e.message,true); } });
  $('#tplsel').onchange=e=>{ const v=e.target.value; e.target.value=''; if(v) loadComp(TEMPLATES[v]()); };
  $('#addSel').onchange=e=>{ const v=e.target.value; e.target.value=''; if(!v) return; structural(()=>{ const ls=curLayers(),L=addLayer(st.comp,ls,v); st.sel=L.ind; st.expanded[L.ind]=true; }); };
  document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
  $('#toolSel').onclick=()=>setTool('select'); $('#toolPen').onclick=()=>setTool('pen');
  $('#zIn').onclick=()=>{ st.zoom=Math.min(8,st.zoom*1.25); layoutStage(); };
  $('#zOut').onclick=()=>{ st.zoom=Math.max(0.2,st.zoom/1.25); layoutStage(); };
  $('#zFit').onclick=()=>{ st.zoom=1; layoutStage(); };
  $('#transp').onchange=e=>{ st.transp=e.target.checked; layoutStage(); };
  $('#tPlay').onclick=()=>st.playing?pause():play();
  $('#tRecord').onclick=insertLayerKeyframes;
  $('#tPlay').setAttribute('aria-label','Play animation');
  $('#tFirst').onclick=()=>{ pause(); setT(st.comp.ip); };
  $('#tLast').onclick=()=>{ pause(); setT(st.comp.op-1); };
  $('#tLoop').onclick=()=>{ st.loop=!st.loop; updTransport(); };
  $('#tFrame').oninput=e=>{ const v=e.target.valueAsNumber; if(Number.isFinite(v)){ if(st.playing) pause(); setT(st.comp.ip+v*st.comp.fr); } };
  $('#tSpeed').onchange=e=>{ st.speed=+e.target.value; };
  $('#tlZoom').oninput=e=>{ st.tlzoom=+e.target.value; renderTimeline(); };
  $('#tlscroll').addEventListener('scroll',()=>updatePlayhead(),{passive:true});
  new ResizeObserver(()=>queue('layout','tl')).observe($('#stagearea'));
  addEventListener('keydown',e=>{
    const tg=e.target&&e.target.tagName; const typing=tg==='INPUT'||tg==='TEXTAREA'||tg==='SELECT';
    const mod=e.ctrlKey||e.metaKey;
    if(mod&&e.key.toLowerCase()==='z'&&!typing){ e.preventDefault(); e.shiftKey?redo():undo(); return; }
    if(mod&&e.key.toLowerCase()==='y'&&!typing){ e.preventDefault(); redo(); return; }
    if(typing) return;
    if(e.key===' '){ e.preventDefault(); st.playing?pause():play(); }
    else if(e.key==='ArrowLeft'){ e.preventDefault(); pause(); setT(Math.round(st.t)-(e.shiftKey?10:1)); }
    else if(e.key==='ArrowRight'){ e.preventDefault(); pause(); setT(Math.round(st.t)+(e.shiftKey?10:1)); }
    else if(e.key==='Delete'||e.key==='Backspace'){
      e.preventDefault();
      if(st.kf){ const L=findL(st.kf.ind); const r=L&&buildRows(L,curLayers()).find(x=>x.type==='prop'&&x.key===st.kf.key); if(r&&r.prop.a){ const i=r.prop.k.indexOf(st.kf.kf); if(i>=0) structural(()=>removeKey(r,i)); } }
      else delLayer();
    }
    else if(mod&&e.key.toLowerCase()==='d'){ e.preventDefault(); dupLayer(); }
    else if(e.key==='Enter'&&st.tool==='pen'&&st.pen.length>=2) penFinish(false);
    else if(e.key==='Escape'&&st.tool==='pen') setTool('select');
  });
  addEventListener('dragover',e=>{ e.preventDefault(); $('#app').classList.add('drop'); });
  addEventListener('dragleave',e=>{ if(!e.relatedTarget) $('#app').classList.remove('drop'); });
  addEventListener('drop',e=>{ e.preventDefault(); $('#app').classList.remove('drop'); const f=e.dataTransfer&&e.dataTransfer.files[0]; if(f) readFile(f); });
}
function boot(){
  setupIcons(); wire();
  let saved=null,savedError=null;
  try{ const raw=localStorage.getItem('lottie-bench:v1'); if(raw) saved=JSON.parse(raw); }
  catch(error){ savedError=error; }
  try{ loadComp(saved||TEMPLATES.bounce(),{initial:true}); }
  catch(error){
    savedError=error;
    loadComp(TEMPLATES.bounce(),{initial:true});
  }
  if(st.comp.layers[0]){ st.sel=st.comp.layers[0].ind; st.expanded[st.sel]=true; }
  setTab('props');
  if(savedError) setTimeout(()=>toast('The saved browser draft could not be restored: '+savedError.message,true),0);
}
boot();