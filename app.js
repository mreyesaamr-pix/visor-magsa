/* ===== CONFIGURACIÓN DEL MAPA =====
   Pega aquí tu clave de MapTiler (cloud.maptiler.com > Claves API).
   Si queda vacía, el visor usa los mapas de Esri como antes. */
const MAPTILER_KEY="l6GPdOEjDmYae88xQro9";
/* ---- datos: se cargan desde data/bd.json y data/cpp.json (ver index.html) ---- */
const BD=window.__BD,CPP=window.__CPP;delete window.__BD;delete window.__CPP;
const $=(s,r=document)=>r.querySelector(s);
const $$=$;const toast=m=>{const t=$('#toast');t.textContent=m;t.style.display='block';clearTimeout(toast.h);toast.h=setTimeout(()=>t.style.display='none',2200)};
const copyTxt=t=>(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).catch(()=>{const a=document.createElement('textarea');a.value=t;document.body.appendChild(a);a.select();try{document.execCommand('copy')}catch(e){}a.remove()}).then(()=>toast('Reporte copiado'));
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const norm=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const uniq=a=>[...new Set(a)].sort((x,y)=>x.localeCompare(y,'es'));
const cl=(v,a,b)=>Math.min(b,Math.max(a,v));
const wx=l=>(l+180)/360,wy=l=>{const r=l*Math.PI/180;return(1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2};
/* ---- datos ---- */
const mkBd=r=>({key:String(r[0]),raw:r,n:r[4],d:r[1],p:r[2],t:r[3],la:r[10],lo:r[11],zona:r[7],cp:r[0],
 sub:r[3]+' · '+r[2]+' · '+r[1]+' · CP '+r[0],
 cards:[['Frecuencia de reparto',r[12]],['Tipo de reparto',r[13]],['Repartidor o agencia',r[14]],['Contacto',r[15]],['Cód. postal',r[0]],['Zona',r[7]]],
 chips:['CNS: '+r[8],'CF: '+r[9],'Asistente: '+r[16],'Repartidor: '+r[5]],
 bad:/NO CONTAMOS|NO HABILITADA/.test(r[13]+r[12]),of:r[14]||'—'});const bdRows=BD.map(mkBd);
const cppRows=CPP.rows.map(r=>({n:r[1],d:CPP.D[r[3]],p:CPP.P[r[4]],t:CPP.T[r[5]],la:r[7],lo:r[8],
 sub:CPP.T[r[5]]+' · '+CPP.P[r[4]]+' · '+CPP.D[r[3]]+' · '+r[6],
 cards:[['Código centro poblado',r[0]],['Ubigeo',r[2]],['Capital',r[6]],['Altitud (msnm)',r[9]],['Fuente de coordenadas',r[10]],['Coordenadas',r[7]+', '+r[8]]],chips:[]}));
const finish=R=>{R.forEach(r=>r.k=norm(r.n));const c={};R.forEach(r=>c[r.k]=(c[r.k]||0)+1);R.forEach(r=>r.dup=c[r.k])};[bdRows,cppRows].forEach(finish);

/* puntos base: centros poblados (forma de referencia del Perú) */
const NP=cppRows.length,PX=new Float32Array(NP),PY=new Float32Array(NP),order=cppRows.map((_,i)=>i).sort((a,b)=>CPP.rows[a][3]-CPP.rows[b][3]);
const ND=CPP.D.length,rng=new Array(ND).fill(0).map(()=>[0,0]),cen=new Array(ND).fill(0).map(()=>[0,0,0]);
order.forEach((i,j)=>{const r=CPP.rows[i],d=r[3];PX[j]=wx(r[8]);PY[j]=wy(r[7]);if(!rng[d][1])rng[d][0]=j;rng[d][1]=j+1;cen[d][0]+=PX[j];cen[d][1]+=PY[j];cen[d][2]++});
/* ---- mapa ---- */
const tiles={},LAYERS={calles:{u:['World_Street_Map'],mz:19,m:()=>'streets-v2',mm:20},sat:{u:['World_Imagery','Reference/World_Boundaries_and_Places'],mz:18,m:()=>'hybrid',mm:20}};
const MT={key:MAPTILER_KEY||'',bad:false,fail:0,okc:false,
 on(){return !!this.key&&!this.bad},
 url(id,t,x,y){return'https://api.maptiler.com/maps/'+id+'/256/'+t+'/'+x+'/'+y+((devicePixelRatio||1)>1.2?'@2x':'')+'.png?key='+encodeURIComponent(this.key)},
 reset(){this.bad=false;this.fail=0;this.okc=false;for(const k in tiles)delete tiles[k];if(typeof maps!=='undefined')Object.values(maps).forEach(m=>{m.ok=false;m.req()})},
 setKey(v){this.key=v;try{v?localStorage.setItem('magsa-mtkey',v):localStorage.removeItem('magsa-mtkey')}catch(e){}this.reset()},
 err(){if(this.okc||this.bad||++this.fail<4)return;this.bad=true;toast('No se pudo usar MapTiler (revisa la clave o sus restricciones). Usando mapa de Esri.');for(const k in tiles)delete tiles[k];if(typeof maps!=='undefined')Object.values(maps).forEach(m=>{m.ok=false;m.req()})}};
if(!MT.key)try{MT.key=localStorage.getItem('magsa-mtkey')||''}catch(e){}
class MapV{
 constructor(cv){this.cv=cv;this.c=cv.getContext('2d');this.sel=null;this.pt=new Map();this.ly='calles';this.cov=null;this.covOn=true;this.hid=new Set();this.me=null;this.dn=null;this.fit();
  new ResizeObserver(()=>{this.size();this.draw()}).observe(cv);
  cv.addEventListener('wheel',e=>{e.preventDefault();const b=cv.getBoundingClientRect();this.zoomAt(e.clientX-b.left,e.clientY-b.top,this.z-cl(e.deltaY,-120,120)*.003)},{passive:false});
  cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);this.dn=this.pt.size?null:[e.clientX,e.clientY];this.pt.set(e.pointerId,[e.clientX,e.clientY]);cv.style.cursor='grabbing'});
  cv.addEventListener('pointermove',e=>{const b=cv.getBoundingClientRect(),W=256*2**this.z;
   if(this.pt.has(e.pointerId)){const o=this.pt.get(e.pointerId);
    if(this.pt.size==2){const ids=[...this.pt.keys()],a=this.pt.get(ids[0]),c=this.pt.get(ids[1]),d0=Math.hypot(a[0]-c[0],a[1]-c[1]);this.pt.set(e.pointerId,[e.clientX,e.clientY]);const a2=this.pt.get(ids[0]),c2=this.pt.get(ids[1]),d1=Math.hypot(a2[0]-c2[0],a2[1]-c2[1]);if(d0>0)this.zoomAt((a2[0]+c2[0])/2-b.left,(a2[1]+c2[1])/2-b.top,this.z+Math.log2(d1/d0))}
    else{this.cx-=(e.clientX-o[0])/W;this.cy-=(e.clientY-o[1])/W;this.pt.set(e.pointerId,[e.clientX,e.clientY]);this.req()}}
   const x=this.cx+(e.clientX-b.left-this.w/2)/W,y=this.cy+(e.clientY-b.top-this.h/2)/W,la=Math.atan(Math.sinh(Math.PI*(1-2*y)))*180/Math.PI;
   this.onc&&this.onc(la.toFixed(4)+', '+(x*360-180).toFixed(4))});
  const up=e=>{const one=this.pt.size===1&&this.dn&&e.type==='pointerup';this.pt.delete(e.pointerId);cv.style.cursor='grab';if(one&&Math.hypot(e.clientX-this.dn[0],e.clientY-this.dn[1])<6)this.hit(e.clientX,e.clientY);this.dn=null};cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up)}
 size(){const d=devicePixelRatio||1,b=this.cv.getBoundingClientRect();this.w=b.width;this.h=b.height;this.cv.width=b.width*d;this.cv.height=b.height*d;this.c.setTransform(d,0,0,d,0,0)}
 fit(){this.cx=wx(-75.2);this.cy=wy(-9.2);this.sel=null;this.size();const h=this.h||600,w=this.w||800;this.z=Math.log2(Math.min(h*.9/.0525,w*.9/.036)/256);this.req()}
 zoomAt(px,py,nz){nz=cl(nz,3.5,MT.on()?20:18);const W0=256*2**this.z,xx=this.cx+(px-this.w/2)/W0,yy=this.cy+(py-this.h/2)/W0;this.z=nz;const W1=256*2**nz;this.cx=xx-(px-this.w/2)/W1;this.cy=yy-(py-this.h/2)/W1;this.req()}
 zoomBy(d){this.zoomAt(this.w/2,this.h/2,this.z+d)}
  snapshot(){return new Promise(res=>{try{this.draw();this.cv.toBlob(b=>res(b),'image/png')}catch(e){res(null)}})}
  setCov(rr,def){const m=new Map(def.o);this.cov=[];for(const r of rr){if(typeof r.la!=='number'||typeof r.lo!=='number'||!isFinite(r.la)||!isFinite(r.lo))continue;const k=def.f(r);this.cov.push({r,x:wx(r.lo),y:wy(r.la),k,col:m.get(k)||GR})}this.req()}
  pr(){return cl(2.4+(this.z-6)*.9,3,9)}
  hit(x,y){if(!(this.cov&&this.covOn)||!this.onhit)return;const b=this.cv.getBoundingClientRect(),W=256*2**this.z,ox=this.cx*W-this.w/2,oy=this.cy*W-this.h/2,px=x-b.left,py=y-b.top;let best=null,bd=Math.max(10,this.pr()+5);for(const p of this.cov){if(this.hid.has(p.k))continue;const d=Math.hypot(p.x*W-ox-px,p.y*W-oy-py);if(d<bd){bd=d;best=p}}if(best)this.onhit(best.r)}
  fitPts(now){if(!this.cov||!this.cov.length){if(now){this.fit();this.draw()}return}this.size();let x0=1,x1=0,y0=1,y1=0;for(const p of this.cov){if(p.x<x0)x0=p.x;if(p.x>x1)x1=p.x;if(p.y<y0)y0=p.y;if(p.y>y1)y1=p.y}
   const dx=Math.max(x1-x0,1e-5),dy=Math.max(y1-y0,1e-5),z=cl(Math.log2(Math.min((this.w||800)*.8/dx,(this.h||600)*.8/dy)/256),3.5,14),cx=(x0+x1)/2,cy=(y0+y1)/2;
   if(now){this.cx=cx;this.cy=cy;this.z=z;this.draw()}else this.fly(Math.atan(Math.sinh(Math.PI*(1-2*cy)))*180/Math.PI,cx*360-180,z)}
  home(){this.cov&&this.cov.length?this.fitPts(true):(this.fit(),this.draw())}
 fly(la,lo,z){const s=[this.cx,this.cy,this.z],t=[wx(lo),wy(la),z],t0=performance.now(),k=now=>{const u=cl((now-t0)/650,0,1),e=1-(1-u)**3;this.cx=s[0]+(t[0]-s[0])*e;this.cy=s[1]+(t[1]-s[1])*e;this.z=s[2]+(t[2]-s[2])*e;this.draw();if(u<1)requestAnimationFrame(k)};requestAnimationFrame(k)}
 lay(t,sv,ox,oy,W,w,h){const n=2**t,ts=W/n,x0=Math.floor(ox/ts),x1=Math.floor((ox+w)/ts),y0=Math.max(0,Math.floor(oy/ts)),y1=Math.min(n-1,Math.floor((oy+h)/ts));if((x1-x0+1)*(y1-y0+1)>80)return;
  for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){const xm=((x%n)+n)%n,k=sv+'/'+t+'/'+xm+'/'+y;let im=tiles[k];if(!im){const ks=Object.keys(tiles);if(ks.length>700)ks.slice(0,200).forEach(q=>delete tiles[q]);im=tiles[k]=new Image();const isM=sv.startsWith('mt:');im.onload=()=>{this.ok=true;if(isM)MT.okc=true;this.req()};if(isM)im.onerror=()=>MT.err();im.src=isM?MT.url(sv.slice(3),t,xm,y):'https://server.arcgisonline.com/ArcGIS/rest/services/'+sv+'/MapServer/tile/'+t+'/'+y+'/'+xm}
   if(im.complete&&im.naturalWidth)this.c.drawImage(im,x*ts-ox,y*ts-oy,ts+.6,ts+.6)}}
 req(){cancelAnimationFrame(this.f);this.f=requestAnimationFrame(()=>this.draw())}
 draw(){const c=this.c,w=this.w,h=this.h;if(!w)return;const W=256*2**this.z,ox=this.cx*W-w/2,oy=this.cy*W-h/2,st=getComputedStyle(document.documentElement);
  c.clearRect(0,0,w,h);
  const L=LAYERS[this.ly],mt=MT.on(),tz=cl(Math.round(this.z+.35),0,mt?L.mm:L.mz);
  for(const t of [tz-1,tz])if(t>=0)for(const sv of (mt?['mt:'+L.m()]:L.u))this.lay(t,sv,ox,oy,W,w,h);
  const r=cl(1+(this.z-5)*.55,1.3,5);
  if((!(this.cov&&this.covOn)||!this.ok)&&(!this.ok||this.z<9))for(let d=0;d<ND;d++){c.fillStyle='hsla('+(d*47%360)+',55%,50%,.55)';for(let j=rng[d][0];j<rng[d][1];j++){const px=PX[j]*W-ox,py=PY[j]*W-oy;if(px>-5&&px<w+5&&py>-5&&py<h+5)c.fillRect(px,py,r,r)}}
  if(this.z<7.6){c.font='600 11px system-ui';c.textAlign='center';c.lineWidth=3;c.strokeStyle='#fff';c.fillStyle='#141414';for(let d=0;d<ND;d++){const px=cen[d][0]/cen[d][2]*W-ox,py=cen[d][1]/cen[d][2]*W-oy;c.strokeText(CPP.D[d],px,py);c.fillText(CPP.D[d],px,py)}}
  if(this.cov&&this.covOn){const pr=this.pr();c.lineWidth=1;c.strokeStyle='rgba(255,255,255,.9)';for(const p of this.cov){if(this.hid.has(p.k))continue;const px=p.x*W-ox,py=p.y*W-oy;if(px<-10||px>w+10||py<-10||py>h+10)continue;c.beginPath();c.arc(px,py,pr,0,7);c.fillStyle=p.col;c.fill();c.stroke()}}
if(this.sel){const px=this.sel[1]*W-ox,py=this.sel[0]*W-oy;c.beginPath();c.arc(px,py,16,0,7);c.fillStyle='rgba(22,163,74,.2)';c.fill();c.save();c.translate(px,py-8);c.shadowColor='rgba(0,0,0,.25)';c.shadowBlur=2.5;c.shadowOffsetY=1;c.beginPath();c.moveTo(0,0);c.bezierCurveTo(-3.5,-9,-5.5,-8.5,-9.6,-14);c.arc(0,-22,12.5,2.447,6.977,false);c.bezierCurveTo(5.5,-8.5,3.5,-9,0,0);c.closePath();c.fillStyle='#E84337';c.fill();c.shadowColor='transparent';c.lineWidth=1;c.strokeStyle='#C5382E';c.stroke();c.beginPath();c.arc(0,-22,5,0,7);c.fillStyle='#B81616';c.fill();c.restore()}
  if(this.me){const px=wx(this.me[1])*W-ox,py=wy(this.me[0])*W-oy;c.beginPath();c.arc(px,py,16,0,7);c.fillStyle='rgba(26,115,232,.22)';c.fill();c.beginPath();c.arc(px,py,7,0,7);c.fillStyle='#1a73e8';c.fill();c.lineWidth=3;c.strokeStyle='#fff';c.stroke()}
c.textAlign='right';c.font='10px system-ui';c.fillStyle=st.getPropertyValue('--mu');c.fillText(MT.on()?'© MapTiler © OpenStreetMap contributors':'Mapa © Esri, HERE, Garmin, OpenStreetMap contributors',w-8,h-8)}
}
/* ===== v2: categorías de cobertura, resumen y calidad ===== */
let curTab='bd';
const hav=(a,b,c,d)=>{const t=x=>x*Math.PI/180,h=Math.sin(t(c-a)/2)**2+Math.cos(t(a))*Math.cos(t(c))*Math.sin(t(d-b)/2)**2;return 12742*Math.asin(Math.sqrt(h))};
const ofName=s=>String(s||'—').replace(/^DISTRIBUIDOR MAGSA\s*-\s*/i,'');
const PAL=['#0072B2','#E69F00','#009E73','#CC79A7','#D55E00','#56B4E9','#6C4AB6'],GR='#8a8a8a';
const tipoOf=r=>{const s=r.raw[13]||'';if(/NO CONTAMOS/.test(s))return'Sin entrega';if(/^A DOMICILIO\s*\/\s*RECOJO/.test(s))return'Domicilio / recojo';if(/^A DOMICILIO/.test(s))return'A domicilio';if(/AGENCIA/.test(s))return'Recojo en agencia';if(/PUNTO|PARADERO|COLECTIVO/.test(s))return'Punto coordinado';return'Otro'};
const TIPO=[['A domicilio','#009E73'],['Domicilio / recojo','#56B4E9'],['Recojo en agencia','#0072B2'],['Punto coordinado','#E69F00'],['Sin entrega','#D55E00'],['Otro',GR]];
const freqOf=r=>{const s=norm(r.raw[12]||'');if(/no habilitada/.test(s))return'Sin servicio';if(/^s1/.test(s))return'Variable por semana';if(/^diaria/.test(s))return'Diaria';if(/interdiaria/.test(s))return'Interdiaria';const n=(s.match(/lunes|martes|miercoles|jueves|viernes|sabado|domingo/g)||[]).length;return n>=2?'2 a 4 días/semana':'1 día/semana'};
const FREQ=[['Diaria','#009E73'],['Interdiaria','#56B4E9'],['2 a 4 días/semana','#0072B2'],['1 día/semana','#E69F00'],['Variable por semana','#CC79A7'],['Sin servicio','#D55E00']];
function catDef(mode,rows){
 if(mode==='zona')return{o:[['Ciudad principal','#0072B2'],['Zona alejada','#E69F00']],f:r=>r.raw[7]==='C.PRINCIPAL'?'Ciudad principal':'Zona alejada'};
 if(mode==='freq')return{o:FREQ,f:freqOf};
 if(mode==='cns'||mode==='cf'){const i=mode==='cns'?8:9;return{o:[['SI','#009E73'],['NO','#D55E00'],['Sin dato',GR]],f:r=>r.raw[i]==='SI'?'SI':r.raw[i]==='NO'?'NO':'Sin dato'}}
 if(mode==='of'){const c={};rows.forEach(r=>{const k=ofName(r.of);c[k]=(c[k]||0)+1});
  const top=Object.entries(c).filter(e=>e[0]!=='--'&&e[0]!=='—').sort((a,b)=>b[1]-a[1]).slice(0,7).map(e=>e[0]);
  return{o:top.map((k,i)=>[k,PAL[i]]).concat([['Otros / sin asignar',GR]]),f:r=>{const k=ofName(r.of);return top.includes(k)?k:'Otros / sin asignar'}}}
 return{o:TIPO,f:tipoOf}}
const COVHTML='<div class="cov"><div class="cvh"><label><input type="checkbox" class="cvon" checked>Cobertura</label><select class="cvm" title="Colorear barrios por"><option value="tipo">Tipo de entrega</option><option value="zona">Zona</option><option value="freq">Frecuencia</option><option value="of">Oficina de reparto</option><option value="cns">CNS</option><option value="cf">CF</option></select><button class="cvx" title="Plegar leyenda">▾</button></div><div class="cvl"></div></div>';

/* ---- resumen ---- */
const GRP={d:['Departamento',r=>r.d],p:['Provincia',r=>r.d+' › '+r.p],t:['Distrito',r=>r.d+' › '+r.p+' › '+r.t],o:['Oficina de reparto',r=>ofName(r.of)]};
let rsG='d',rsS=['n',-1],rsF='';
const PC=(a,b)=>b?Math.round(100*a/b)+'%':'—';
const csvOf=a=>'﻿'+a.map(r=>r.map(c=>{c=c==null?'':String(c);return /[",\n;]/.test(c)?'"'+c.replace(/"/g,'""')+'"':c}).join(',')).join('\r\n');
function goBd(f){maps.bd.setFilter(f);show('bd')}
function rsRows(){const m=new Map();
 bdRows.forEach(r=>{const k=GRP[rsG][1](r);let o=m.get(k);
  if(!o)m.set(k,o={k,n:0,dom:0,age:0,pun:0,sin:0,f:{d:rsG==='o'?'':r.d,p:rsG==='p'||rsG==='t'?r.p:'',t:rsG==='t'?r.t:'',o:rsG==='o'?r.of:''}});
  const t=r._t||(r._t=tipoOf(r));o.n++;
  if(t==='A domicilio'||t==='Domicilio / recojo')o.dom++;else if(t==='Recojo en agencia')o.age++;else if(t==='Sin entrega')o.sin++;else o.pun++});
 let a=[...m.values()];a.forEach(o=>o.pc=o.n?o.dom/o.n:0);
 const f=norm(rsF);if(f)a=a.filter(o=>norm(o.k).includes(f));
 const[c,d]=rsS;a.sort((x,y)=>c==='k'?d*x.k.localeCompare(y.k,'es'):d*(x[c]-y[c])||x.k.localeCompare(y.k,'es'));return a}
function renderTable(){const a=rsRows(),H=[['k','Grupo'],['n','Barrios'],['dom','A domicilio'],['age','Agencia'],['pun','Punto coord.'],['sin','Sin entrega'],['pc','Distribución']];
 const arr=c=>rsS[0]===c?(rsS[1]<0?' ▼':' ▲'):'';
 $('#rtb').innerHTML='<table class="gt"><thead><tr>'+H.map(h=>'<th data-s="'+h[0]+'"'+(h[0]!=='k'&&h[0]!=='pc'?' class="n"':'')+'>'+h[1]+arr(h[0])+'</th>').join('')+'</tr></thead><tbody>'+
  a.map((o,i)=>{const w=x=>(100*x/o.n).toFixed(2)+'%';
   return'<tr class="rw" data-i="'+i+'"><td><b>'+esc(o.k)+'</b></td><td class="n">'+o.n.toLocaleString('es')+'</td><td class="n">'+o.dom+' <small>('+PC(o.dom,o.n)+')</small></td><td class="n">'+o.age+'</td><td class="n">'+o.pun+'</td><td class="n">'+(o.sin?'<b style="color:var(--wn)">'+o.sin+'</b>':'0')+'</td><td><div class="sb" title="A domicilio '+o.dom+' · Agencia '+o.age+' · Punto coord. '+o.pun+' · Sin entrega '+o.sin+'"><i style="width:'+w(o.dom)+';background:#009E73"></i><i style="width:'+w(o.age)+';background:#0072B2"></i><i style="width:'+w(o.pun)+';background:#E69F00"></i><i style="width:'+w(o.sin)+';background:#D55E00"></i></div></td></tr>'}).join('')+'</tbody></table>';
 const tb=$('#rtb');tb.onclick=e=>{const th=e.target.closest('th[data-s]');if(th){const c=th.dataset.s;rsS=rsS[0]===c?[c,-rsS[1]]:[c,c==='k'?1:-1];return renderTable()}
  const tr=e.target.closest('tr.rw');if(tr)goBd(a[+tr.dataset.i].f)}}
function renderRes(){const R=bdRows,T=R.length,tp=r=>r._t||(r._t=tipoOf(r));
 const dom=R.filter(r=>/^(A domicilio|Domicilio)/.test(tp(r))).length,age=R.filter(r=>tp(r)==='Recojo en agencia').length,sin=R.filter(r=>tp(r)==='Sin entrega').length,pun=T-dom-age-sin,
  alej=R.filter(r=>r.raw[7]!=='C.PRINCIPAL').length,ofs=new Set(R.map(r=>ofName(r.of)).filter(x=>x!=='--'&&x!=='—')).size,
  dis=new Set(R.map(r=>r.d+'|'+r.p+'|'+r.t)).size,prv=new Set(R.map(r=>r.d+'|'+r.p)).size,dep=new Set(R.map(r=>r.d)).size;
 const tile=(l,v,s,c)=>'<div class="tile'+(c?' '+c:'')+'"><small>'+l+'</small><strong>'+v+'</strong><em>'+s+'</em></div>';
 $('#t-res').innerHTML='<div class="pg"><h2 class="pgt">Resumen de cobertura</h2><p class="pgs">Calculado sobre la BD actual del visor, incluidas las ediciones guardadas.</p><div class="kp">'+
  tile('Barrios en la base',T.toLocaleString('es'),dep+' departamentos · '+prv+' provincias · '+dis+' distritos')+
  tile('Entrega a domicilio',dom.toLocaleString('es'),PC(dom,T)+' de los barrios')+
  tile('Recojo en agencia',age.toLocaleString('es'),PC(age,T)+' de los barrios')+
  tile('Punto coordinado',pun.toLocaleString('es'),PC(pun,T)+' de los barrios')+
  tile('Sin entrega',sin.toLocaleString('es'),PC(sin,T)+' · zona no habilitada','bad')+
  tile('Zonas alejadas',alej.toLocaleString('es'),PC(alej,T)+' · el resto es ciudad principal')+
  tile('Oficinas de reparto',ofs,'distribuidores con barrios asignados')+
  '</div><div class="rsh"><label>Agrupar por<select id="rg">'+Object.entries(GRP).map(([k,v])=>'<option value="'+k+'"'+(k===rsG?' selected':'')+'>'+v[0]+'</option>').join('')+'</select></label><label>Filtrar<input id="rf" type="search" placeholder="Escribe para filtrar…" value="'+esc(rsF)+'" autocomplete="off"></label><button id="rcsv">⬇ Descargar CSV</button></div><div class="tw" id="rtb"></div><p class="pgs" style="margin-left:0;margin-top:10px">Toca una fila para ver ese grupo en el mapa. “A domicilio” incluye “A domicilio/recojo”. Verde: domicilio · Azul: agencia · Naranja: punto coordinado · Rojo: sin entrega.</p></div>';
 $('#rg').onchange=e=>{rsG=e.target.value;renderTable()};
 $('#rf').oninput=e=>{rsF=e.target.value;renderTable()};
 $('#rcsv').onclick=()=>{const a=rsRows();saveFile('Resumen_cobertura_'+GRP[rsG][0].replace(/\s+/g,'_')+'_'+stamp()+'.csv',csvOf([[GRP[rsG][0],'Barrios','A domicilio','Recojo en agencia','Punto coordinado','Sin entrega','% a domicilio']].concat(a.map(o=>[o.k,o.n,o.dom,o.age,o.pun,o.sin,PC(o.dom,o.n)]))))};
 renderTable()}

/* ---- calidad de datos ---- */
let DCm=null;
function distC(){if(DCm)return DCm;DCm=new Map();const nd=CPP.D.map(norm),np=CPP.P.map(norm),nt=CPP.T.map(norm),g=new Map();
 CPP.rows.forEach(r=>{const k=nd[r[3]]+'|'+np[r[4]]+'|'+nt[r[5]];let a=g.get(k);if(!a)g.set(k,a=[[],[]]);a[0].push(r[7]);a[1].push(r[8])});
 const md=a=>{a.sort((x,y)=>x-y);return a[a.length>>1]};g.forEach((a,k)=>DCm.set(k,[md(a[0]),md(a[1])]));return DCm}
function qChecks(){const R=bdRows,DC=distC(),hasC=r=>typeof r.la==='number'&&typeof r.lo==='number'&&isFinite(r.la)&&isFinite(r.lo),vac=v=>v==null||/^[\s-]*$/.test(String(v));
 const C=[];
 C.push({t:'Sin coordenadas',sev:'alta',d:'No se pueden ubicar en el mapa ni calcular cercanía.',items:R.filter(r=>!hasC(r)).map(r=>[r,'Latitud o longitud vacía o no numérica'])});
 C.push({t:'Coordenadas fuera del Perú',sev:'alta',d:'Latitud o longitud fuera del rango del país: probable error de signo o de digitación.',items:R.filter(r=>hasC(r)&&(r.la>1||r.la<-19||r.lo>-68||r.lo<-82)).map(r=>[r,r.la+', '+r.lo])});
 const far=[];R.forEach(r=>{if(!hasC(r))return;const c=DC.get(norm(r.d)+'|'+norm(r.p)+'|'+norm(r.t));if(!c)return;const km=hav(r.la,r.lo,c[0],c[1]);if(km>30)far.push([r,'A '+Math.round(km)+' km del centro de los centros poblados de su distrito',km])});
 far.sort((a,b)=>b[2]-a[2]);
 C.push({t:'Coordenada lejos de su distrito (más de 30 km)',sev:'media',d:'Distancia al centro de los centros poblados del distrito según INEI. En distritos muy extensos puede ser correcto; conviene revisar.',items:far});
 const cc=new Map();R.forEach(r=>{if(hasC(r)){const k=r.la+','+r.lo;(cc.get(k)||cc.set(k,[]).get(k)).push(r)}});
 const sh=[];cc.forEach(a=>{if(a.length>=3)a.forEach(r=>sh.push([r,'Comparte la misma coordenada con '+(a.length-1)+' barrios más']))});
 C.push({t:'Misma coordenada en 3 o más barrios',sev:'media',d:'Suele indicar una coordenada de relleno (por ejemplo, la del distrito) en lugar de la del barrio.',items:sh});
 const nm=new Map();R.forEach(r=>{const k=norm(r.n)+'|'+norm(r.d)+'|'+norm(r.p)+'|'+norm(r.t);(nm.get(k)||nm.set(k,[]).get(k)).push(r)});
 const dp=[];nm.forEach(a=>{if(a.length>1)a.forEach(r=>dp.push([r,'Nombre repetido ×'+a.length+' en el mismo distrito']))});
 C.push({t:'Nombre repetido en el mismo distrito',sev:'baja',d:'Pueden ser barrios distintos con el mismo nombre; verifica que cada uno tenga su propia ubicación.',items:dp});
 C.push({t:'Con servicio pero sin contacto',sev:'media',d:'Barrios con entrega o recojo cuyo campo Contacto está vacío o es “--”.',items:R.filter(r=>!r.bad&&vac(r.raw[15])).map(r=>[r,'Contacto vacío'])});
 C.push({t:'Con servicio pero sin repartidor o agencia',sev:'media',d:'Barrios con servicio cuyo campo Repartidor o Agencia está vacío o es “--”.',items:R.filter(r=>!r.bad&&vac(r.raw[14])).map(r=>[r,'Repartidor o agencia vacío'])});
 C.push({t:'Tipo de entrega y frecuencia no coinciden',sev:'media',d:'Uno dice que no hay entrega y el otro indica una frecuencia de reparto (o al revés).',items:R.filter(r=>/NO CONTAMOS/.test(r.raw[13]||'')!==/NO HABILITADA/.test(r.raw[12]||'')).map(r=>[r,(r.raw[13]||'—')+' / '+(r.raw[12]||'—')])});
 C.push({t:'Distrito no reconocido en la base INEI',sev:'baja',d:'La combinación departamento, provincia y distrito no existe en la hoja CPP Perú: revisa la ortografía.',items:R.filter(r=>!DC.has(norm(r.d)+'|'+norm(r.p)+'|'+norm(r.t))).map(r=>[r,r.d+' › '+r.p+' › '+r.t])});
 return C}
function qBadge(){const el=$('#calb');if(!el)return;const n=qChecks().filter(c=>c.items.length&&c.sev!=='baja').length;el.textContent=n||'';el.style.display=n?'inline-block':'none';el.title=n+' revisiones con hallazgos'}
function renderCal(){const C=qChecks(),T=bdRows.length,bad=new Set();C.forEach(c=>c.sev!=='baja'&&c.items.forEach(i=>bad.add(i[0].key)));
 const con=C.filter(c=>c.items.length).length,tile=(l,v,s,c)=>'<div class="tile'+(c?' '+c:'')+'"><small>'+l+'</small><strong>'+v+'</strong><em>'+s+'</em></div>';
 $('#t-cal').innerHTML='<div class="pg"><h2 class="pgt">Calidad de datos</h2><p class="pgs">Revisión automática de la BD actual. Se recalcula cuando se guardan ediciones.</p><div class="kp">'+
  tile('Barrios revisados',T.toLocaleString('es'),C.length+' revisiones automáticas')+
  tile('Con observaciones importantes',bad.size.toLocaleString('es'),PC(bad.size,T)+' (severidad alta o media)',bad.size?'bad':'')+
  tile('Revisiones con hallazgos',con+' de '+C.length,con?'abre cada una para ver el detalle':'todo en orden')+
  '</div><div class="rsh"><button id="qcsv">⬇ CSV de hallazgos</button></div>'+
  C.map(c=>'<details class="ck"'+(c.items.length&&c.sev!=='baja'?' open':'')+'><summary><span class="sv '+c.sev+'">'+c.sev+'</span><b>'+esc(c.t)+'</b><i class="ct'+(c.items.length?'':' ok')+'">'+(c.items.length?c.items.length.toLocaleString('es'):'✓ sin hallazgos')+'</i></summary><p>'+esc(c.d)+'</p>'+
   (c.items.length?'<div class="tw"><table class="gt"><tbody>'+c.items.slice(0,200).map(i=>'<tr><td><b>'+esc(i[0].n)+'</b><br><small>'+esc(i[0].sub)+'</small></td><td>'+esc(i[1])+'</td><td class="n"><button class="vb" data-k="'+esc(i[0].key)+'">Ver</button></td></tr>').join('')+'</tbody></table></div>'+(c.items.length>200?'<p class="pgs">Mostrando 200 de '+c.items.length.toLocaleString('es')+'. El CSV incluye todos.</p>':''):'')+'</details>').join('')+'</div>';
 $('#t-cal').onclick=e=>{const b=e.target.closest('.vb');if(b){show('bd');maps.bd.focus(b.dataset.k)}};
 $('#qcsv').onclick=()=>{const o=[['Revisión','Severidad','Cód. postal','Barrio','Distrito','Provincia','Departamento','Detalle']];C.forEach(c=>c.items.forEach(i=>o.push([c.t,c.sev,i[0].key,i[0].n,i[0].t,i[0].p,i[0].d,i[1]])));saveFile('Calidad_datos_MAGSA_'+stamp()+'.csv',csvOf(o))};
 qBadge()}
setTimeout(qBadge,500);

/* ===== v4: motor WebGL (MapLibre GL) con la misma interfaz que MapV ===== */
let INEI_FC=null;
const ineiFC=()=>INEI_FC||(INEI_FC={type:'FeatureCollection',features:CPP.rows.map((r,i)=>({type:'Feature',geometry:{type:'Point',coordinates:[+r[8],+r[7]]},properties:{i,n:r[1]}}))});
const EMPTY_FC={type:'FeatureCollection',features:[]};
class MapG{
 constructor(cv){
  this._cv=cv;this.host=document.createElement('div');this.host.className='glmap';cv.replaceWith(this.host);try{this._init(cv)}catch(e){try{this.host.replaceWith(cv);if(this.attr)this.attr.remove()}catch(_){}throw e}
 }
 _init(cv){
  this.attr=document.createElement('div');this.attr.className='attr';this.host.parentNode.appendChild(this.attr);
  this.cov=null;this.covOn=true;this.hid=new Set();this._me=null;this._sel=null;this.ly='calles';this.ok=false;this.ineiOn=false;
  this.dirty={cov:true,mk:true};this.selName=null;this._lblTxt=null;this._lblPend=false;this.ready=false;this._loaded=false;this._pend=null;this._hk=null;this._raf=0;this._sg=this._sig();
  const m=this.map=new maplibregl.Map({container:this.host,style:this._style(),center:[-75.2,-9.2],zoom:4,minZoom:3,maxZoom:20,attributionControl:false,preserveDrawingBuffer:true,dragRotate:false,pitchWithRotate:false,touchPitch:false,renderWorldCopies:false,fadeDuration:120});
  try{m.touchZoomRotate.disableRotation();m.keyboard.disable()}catch(e){}
  this._attrTxt();
  m.on('style.load',()=>{window.__glLoaded=true;this._loaded=true;if(this._msg)this._msg.remove();this._add();this.ready=true;this._sync()});
  m.on('error',e=>{try{window.__mgErr=String((e&&e.error&&(e.error.message||e.error.status))||'error')}catch(_){}const s=e&&e.error&&e.error.status;if(MT.on()&&(s===401||s===403)){MT.bad=true;toast('No se pudo usar MapTiler (revisa la clave o sus restricciones). Usando mapa de Esri.');Object.values(maps).forEach(x=>x.req&&x.req())}});
  m.on('idle',()=>{if(this._lblPend)this._label()});
  m.on('mousemove',e=>this.onc&&this.onc(e.lngLat.lat.toFixed(4)+', '+e.lngLat.lng.toFixed(4)));
  m.on('click',e=>{const ids=['cov','inei'].filter(id=>m.getLayer(id)&&m.getLayoutProperty(id,'visibility')!=='none');if(!ids.length)return;
   const f=m.queryRenderedFeatures([[e.point.x-7,e.point.y-7],[e.point.x+7,e.point.y+7]],{layers:ids})[0];if(!f)return;
   if(f.layer.id==='cov'){const p=this.cov&&this.cov[f.properties.i];if(p&&this.onhit)this.onhit(p.r)}else if(this.onfeat)this.onfeat(f.properties)});
  new ResizeObserver(()=>this.size()).observe(this.host);
  setTimeout(()=>{if(this._loaded)return;const d=document.createElement('div');d.className='mapmsg';d.innerHTML='Cargando el mapa…<br><button>Usar mapa clásico</button>';this.host.parentNode.appendChild(d);this._msg=d;d.querySelector('button').onclick=()=>{toClassic('manual');location.reload()}},3500);
  setTimeout(()=>{if(this._loaded||/magsa-fb/.test(window.name))return;window.name+=' magsa-fb';toClassic('sin respuesta del mapa moderno');toast('El mapa moderno no cargó; cambiando al clásico…');setTimeout(()=>location.reload(),1200)},12000);
 }
 _dk(){return document.documentElement.dataset.theme==='dark'}
 _sig(){return(MT.on()?MT.key:'e')+'|'+this.ly}
 _attrTxt(){this.attr.textContent=MT.on()?'© MapTiler © OpenStreetMap contributors':'© Esri, HERE, Garmin, OpenStreetMap contributors'}
 _style(){
  if(MT.on()){const id=this.ly==='sat'?'hybrid':'streets-v2';return'https://api.maptiler.com/maps/'+id+'/style.json?key='+encodeURIComponent(MT.key)}
  const E='https://server.arcgisonline.com/ArcGIS/rest/services/',t=s=>E+s+'/MapServer/tile/{z}/{y}/{x}',
   S={calles:['World_Street_Map'],sat:['World_Imagery','Reference/World_Boundaries_and_Places']}[this.ly]||['World_Street_Map'];
  return{version:8,sources:Object.fromEntries(S.map((s,i)=>['b'+i,{type:'raster',tiles:[t(s)],tileSize:256,maxzoom:this.ly==='calles'?19:18}])),layers:S.map((s,i)=>({id:'b'+i,type:'raster',source:'b'+i}))}}
 get sel(){return this._sel}
 set sel(v){this._sel=v;if(!v)this.selName=null;this._lblTxt=null;this._lblPend=!!v;this.dirty.mk=true;this.req()}
 get me(){return this._me}
 set me(v){this._me=v;this.dirty.mk=true;this.req()}
 _selLL(){const v=this._sel;return v?[v[1]*360-180,Math.atan(Math.sinh(Math.PI*(1-2*v[0])))*180/Math.PI]:null}
 _pt(ll){return ll?{type:'FeatureCollection',features:[{type:'Feature',geometry:{type:'Point',coordinates:ll},properties:{}}]}:EMPTY_FC}
 _covFC(){return{type:'FeatureCollection',features:(this.cov||[]).map((p,i)=>({type:'Feature',geometry:{type:'Point',coordinates:[p.r.lo,p.r.la]},properties:{i,k:p.k,col:p.col}}))}}
 _pin(){const m=this.map;if(m.hasImage&&m.hasImage('magsa-pin'))return;const W=30,H=38,s=3,c=document.createElement('canvas');c.width=W*s;c.height=H*s;const x=c.getContext('2d');x.scale(s,s);x.translate(2,1);
  x.shadowColor='rgba(0,0,0,.25)';x.shadowBlur=2.5;x.shadowOffsetY=1;x.beginPath();x.moveTo(13,35);x.bezierCurveTo(9.5,26,7.5,26.5,3.4,21);x.arc(13,13,12.5,2.447,6.977,false);x.bezierCurveTo(18.5,26.5,16.5,26,13,35);x.closePath();
  x.fillStyle='#E84337';x.fill();x.shadowColor='transparent';x.lineWidth=1;x.strokeStyle='#C5382E';x.stroke();x.beginPath();x.arc(13,13,5,0,7);x.fillStyle='#B81616';x.fill();
  m.addImage('magsa-pin',x.getImageData(0,0,W*s,H*s),{pixelRatio:s})}
 _lblFC(){const ll=this._selLL();return ll&&this._lblTxt?{type:'FeatureCollection',features:[{type:'Feature',geometry:{type:'Point',coordinates:ll},properties:{t:this._lblTxt}}]}:EMPTY_FC}
 _refStyle(){const m=this.map,L=((m.getStyle()||{}).layers||[]).filter(l=>l.type==='symbol'&&l.layout&&l.layout['text-field']&&!/^(sel|inei|cov|me)/.test(l.id));
  const ref=L.find(l=>/village|hamlet|suburb|neighbo|locality|town|place|city/i.test(l.id))||L[0]||{},ly=ref.layout||{},pt=ref.paint||{};
  const safe=(v,d)=>{if(v==null)return d;return /"get"|"has"|"feature-state"|"geometry-type"|"properties"|"property"/.test(JSON.stringify(v))?d:v};
  return{font:safe(ly['text-font'],['Noto Sans Regular']),size:safe(ly['text-size'],12),tt:safe(ly['text-transform'],null),ls:safe(ly['text-letter-spacing'],null),color:safe(pt['text-color'],'#333'),halo:safe(pt['text-halo-color'],'#fff'),hw:safe(pt['text-halo-width'],1.2),hb:safe(pt['text-halo-blur'],0)}}
 _label(){if(!this._lblPend)return;this._lblPend=false;const m=this.map,ll=this._selLL(),nm=this.selName;
  if(!ll||!nm||!m.getLayer('sel-t')){this._lblTxt=null;this.dirty.mk=true;this.req();return}
  let found=false;try{const p=m.project(ll),fs=m.queryRenderedFeatures([[p.x-100,p.y-80],[p.x+100,p.y+60]]);
   for(const f of fs){const id=f.layer&&f.layer.id;if(!id||/^(sel|me|cov)/.test(id)||f.layer.type!=='symbol')continue;
    for(const k in f.properties){if((/^name/.test(k)||k==='n')&&typeof f.properties[k]==='string'&&nameSim(nm,f.properties[k])){found=true;break}}if(found)break}}catch(e){}
  this._lblTxt=found?null:fmtName(nm);this.dirty.mk=true;this.req()}
 _glyphs(){return MT.on()}
 _addInei(){const m=this.map;if(m.getSource('inei'))return;const b=m.getLayer('cov')?'cov':undefined,dk=false;
  m.addSource('inei',{type:'geojson',data:ineiFC()});
  m.addLayer({id:'inei',type:'circle',source:'inei',paint:{'circle-radius':['interpolate',['linear'],['zoom'],4,.6,8,1.6,11,3.2,14,5.5,17,8],'circle-color':dk?'#9db4d6':'#4b5d7a','circle-opacity':.8,'circle-stroke-width':['interpolate',['linear'],['zoom'],10,0,13,1],'circle-stroke-color':dk?'#0b0b0b':'#fff'}},b);
  if(this._glyphs())m.addLayer({id:'inei-l',type:'symbol',source:'inei',minzoom:12,layout:{'text-field':['get','n'],'text-font':['Noto Sans Regular'],'text-size':11,'text-offset':[0,.9],'text-anchor':'top','text-optional':true},paint:{'text-color':dk?'#e5e7eb':'#1f2937','text-halo-color':dk?'#0b0b0b':'#fff','text-halo-width':1.3}},b)}
 _add(){const m=this.map;this._hk=null;
  if(this.ineiOn)this._addInei();
  m.addSource('cov',{type:'geojson',data:this._covFC()});
  m.addLayer({id:'cov',type:'circle',source:'cov',paint:{'circle-radius':['interpolate',['linear'],['zoom'],4,2.6,8,4,12,6.5,16,9],'circle-color':['get','col'],'circle-stroke-width':1,'circle-stroke-color':'#fff','circle-stroke-opacity':.9}});
  m.addSource('sel',{type:'geojson',data:this._pt(this._selLL())});
  m.addLayer({id:'sel-h',type:'circle',source:'sel',paint:{'circle-radius':16,'circle-color':'#16a34a','circle-opacity':.2}});
  this._pin();m.addLayer({id:'sel',type:'symbol',source:'sel',layout:{'icon-image':'magsa-pin','icon-anchor':'bottom','icon-size':1,'icon-offset':[0,-6],'icon-allow-overlap':true,'icon-ignore-placement':true}});
  m.addSource('selname',{type:'geojson',data:this._lblFC()});
  if(this._glyphs()){const s=this._refStyle(),lo={'text-field':['get','t'],'text-font':s.font,'text-size':s.size,'text-anchor':'top','text-offset':[0,1.5],'text-allow-overlap':true,'text-ignore-placement':true,'text-max-width':9};
   if(s.tt)lo['text-transform']=s.tt;if(s.ls!=null)lo['text-letter-spacing']=s.ls;
   m.addLayer({id:'sel-t',type:'symbol',source:'selname',layout:lo,paint:{'text-color':s.color,'text-halo-color':s.halo,'text-halo-width':s.hw,'text-halo-blur':s.hb}})}
  this._lblPend=!!this._sel;
  m.addSource('me',{type:'geojson',data:this._pt(this._me?[this._me[1],this._me[0]]:null)});
  m.addLayer({id:'me-h',type:'circle',source:'me',paint:{'circle-radius':16,'circle-color':'#1a73e8','circle-opacity':.22}});
  m.addLayer({id:'me',type:'circle',source:'me',paint:{'circle-radius':7,'circle-color':'#1a73e8','circle-stroke-width':3,'circle-stroke-color':'#fff'}});
  this.dirty={cov:false,mk:false}}
 _sync(){if(!this.ready)return;const m=this.map,sg=this._sig();
  if(sg!==this._sg){this._sg=sg;this.ready=false;this._attrTxt();m.setStyle(this._style(),{diff:false});return}
  if(this.ineiOn)this._addInei();
  if(this.dirty.cov){m.getSource('cov').setData(this._covFC());this.dirty.cov=false}
  if(this.dirty.mk){m.getSource('sel').setData(this._pt(this._selLL()));m.getSource('selname').setData(this._lblFC());m.getSource('me').setData(this._pt(this._me?[this._me[1],this._me[0]]:null));this.dirty.mk=false}
  const hk=[...this.hid].sort().join('|');if(hk!==this._hk){this._hk=hk;m.setFilter('cov',['!',['in',['get','k'],['literal',[...this.hid]]]])}
  const vis=(id,on)=>{if(m.getLayer(id))m.setLayoutProperty(id,'visibility',on?'visible':'none')};
  vis('cov',this.covOn);vis('inei',this.ineiOn);vis('inei-l',this.ineiOn)}
 req(){if(this._raf)return;this._raf=requestAnimationFrame(()=>{this._raf=0;this._sync()})}
 draw(){this.req()}
 size(){if(!this.host.clientWidth)return;this.map.resize();if(this._pend){const f=this._pend;this._pend=null;f()}}
 setCov(rr,def){const m=new Map(def.o);this.cov=[];for(const r of rr){if(typeof r.la!=='number'||typeof r.lo!=='number'||!isFinite(r.la)||!isFinite(r.lo))continue;const k=def.f(r);this.cov.push({r,x:wx(r.lo),y:wy(r.la),k,col:m.get(k)||GR})}this.dirty.cov=true;this.req()}
 fit(){if(!this.host.clientWidth){this._pend=()=>this.fit();return}this.map.fitBounds([[-81.4,-18.4],[-68.6,.1]],{padding:10,duration:0})}
 fitPts(now){if(!this.cov||!this.cov.length){if(now)this.fit();return}
  if(!this.host.clientWidth){this._pend=()=>this.fitPts(now);return}
  let a=180,b=90,c=-180,d=-90;for(const p of this.cov){const lo=p.r.lo,la=p.r.la;if(lo<a)a=lo;if(lo>c)c=lo;if(la<b)b=la;if(la>d)d=la}
  this.map.fitBounds([[a,b],[c,d]],{padding:40,maxZoom:14,duration:now?0:700})}
 home(){this.cov&&this.cov.length?this.fitPts(true):this.fit()}
 fly(la,lo,z){const o={center:[lo,la],zoom:Math.max(z-1,3)};if(!this.host.clientWidth)this.map.jumpTo(o);else this.map.flyTo({...o,duration:650,essential:true})}
 zoomBy(d){this.map.zoomTo(this.map.getZoom()+d,{duration:250})}
 snapshot(la,lo){return new Promise(res=>{const m=this.map;let a=0,b=0;
  const fin=()=>{if(b++)return;try{const cv=m.getCanvas(),o=document.createElement('canvas');o.width=cv.width;o.height=cv.height;o.getContext('2d').drawImage(cv,0,0);o.toBlob(x=>res(x),'image/png')}catch(e){res(null)}};
  const st2=()=>{if(a++)return;if(this._lblPend)this._label();setTimeout(()=>{if(m.loaded())fin();else{m.once('idle',fin);setTimeout(fin,2500)}},80)};
  try{if(la!=null){const p=m.project([lo,la]),w=this.host.clientWidth,hh=this.host.clientHeight;if(p.x<w*.15||p.x>w*.85||p.y<hh*.2||p.y>hh*.85||m.getZoom()<11){m.jumpTo({center:[lo,la],zoom:Math.max(m.getZoom(),12)});this._lblPend=!!this._sel}}}catch(e){}
  try{m.triggerRepaint()}catch(e){}
  if(m.loaded())st2();else m.once('idle',st2);setTimeout(st2,3500)})}
}
const GLOK=(()=>{try{if(!window.maplibregl)return false;const c=document.createElement('canvas');return!!(c.getContext('webgl2')||c.getContext('webgl'))}catch(e){return false}})();
let MOTOR='gl';try{MOTOR=localStorage.getItem('magsa-motor')||'gl'}catch(e){}if(/magsa-classic/.test(window.name))MOTOR='canvas';
const ENGINE=GLOK&&MOTOR!=='canvas'?MapG:MapV;
const toClassic=why=>{if(!/magsa-classic/.test(window.name))window.name+=' magsa-classic';try{localStorage.setItem('magsa-motor','canvas')}catch(e){}try{console.warn('MAGSA: motor clásico →',why)}catch(e){}};
const mkEngine=cv=>{if(ENGINE===MapG){try{return new MapG(cv)}catch(e){toClassic(e&&e.message)}}return new MapV(cv)};
window.addEventListener('error',ev=>{try{if(ENGINE!==MapG||/magsa-fb2/.test(window.name)||window.__glLoaded)return;window.name+=' magsa-fb2';toClassic(ev&&ev.message);location.reload()}catch(e){}});
function openCfg(){const ov=$('#ov');
 ov.innerHTML='<div class="dlg"><h3>Ajustes del mapa</h3><div class="fg"><label>Clave API de MapTiler<input id="cfk" value="'+esc(MT.key)+'" placeholder="(vacía = mapa de Esri)" autocomplete="off"></label><label>Motor del mapa<select id="cfm"><option value="gl">Moderno (WebGL, vectorial)</option><option value="canvas">Clásico (más compatible)</option></select></label></div><p class="pgs" style="margin-left:0">Motor activo: '+(ENGINE===MapG?'moderno (WebGL)':'clásico')+(GLOK?'':' · WebGL o MapLibre no disponible en este navegador')+'</p><p class="pgs" style="margin-left:0;font-size:11px;line-height:1.5;word-break:break-all">Diagnóstico: protocolo '+esc(location.protocol)+' · seguro '+(window.isSecureContext?'sí':'no')+' · WebGL '+(GLOK?'sí':'no')+' · compartir '+(navigator.share?'sí':'no')+' · portapapeles imagen '+(window.ClipboardItem?'sí':'no')+' · último error del mapa: '+esc(window.__mgErr||'ninguno')+'</p><div class="er"></div><div class="bt"><button class="sv">Guardar y recargar</button><button class="cn">Cancelar</button></div></div>';
 ov.style.display='flex';$('#cfm',ov).value=MOTOR==='canvas'?'canvas':'gl';
 $('.cn',ov).onclick=()=>ov.style.display='none';
 $('.sv',ov).onclick=()=>{const k=$('#cfk',ov).value.trim(),mo=$('#cfm',ov).value;try{k?localStorage.setItem('magsa-mtkey',k):localStorage.removeItem('magsa-mtkey');localStorage.setItem('magsa-motor',mo);try{sessionStorage.removeItem('magsa-fb')}catch(e){}location.reload()}catch(e){$('.er',ov).textContent='No se pudo guardar en este navegador. Cambia MAPTILER_KEY en el archivo.'}}}

/* ===== v6: captura del mapa para el reporte + utilidades de rótulo ===== */
const fname=s=>norm(s||'reporte').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,40)||'reporte';
const GENT=new Set(['cp','ah','aahh','pj','urb','ba','asoc','asent','as','cc','pp','uv','agrup','coop','de','del','la','las','los','el','y']);
const nmCore=s=>norm(s).replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(t=>t&&!GENT.has(t)).join(' ');
const lev=(a,b)=>{const m=a.length,n=b.length;let p=Array.from({length:n+1},(_,j)=>j);for(let i=1;i<=m;i++){const c=[i];for(let j=1;j<=n;j++)c[j]=Math.min(p[j]+1,c[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));p=c}return p[n]};
const nameSim=(x,y)=>{const a=nmCore(x),b=nmCore(y);if(!a||!b)return false;if(a===b)return true;const ml=Math.max(a.length,b.length);if(ml<4)return false;
 if((a.includes(b)||b.includes(a))&&Math.min(a.length,b.length)/ml>=.7)return true;return 1-lev(a,b)/ml>=.78};
const fmtName=n=>String(n).trim().toLowerCase().replace(/\s+/g,' ').split(' ').map((w,i)=>/^(cp|ah|aahh|pj|urb|ba|asoc|cc|pp|uv|ii|iii|iv|vi|vii|viii|ix|xi)\.?$/.test(w)?w.toUpperCase():(i&&/^(de|del|la|las|los|el|y|e|en)$/.test(w)?w:w.charAt(0).toUpperCase()+w.slice(1))).join(' ');
async function mapShot(blob){if(!blob)return null;
 const img=await new Promise(ok=>{const i=new Image(),u=URL.createObjectURL(blob);i.onload=()=>{ok(i);URL.revokeObjectURL(u)};i.onerror=()=>ok(null);i.src=u});if(!img)return blob;
 const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const x=c.getContext('2d');x.drawImage(img,0,0);
 const s=Math.max(1,img.width/900),at=MT.on()?'© MapTiler © OpenStreetMap contributors':'© Esri, HERE, Garmin, OpenStreetMap contributors';
 x.font='400 '+Math.round(11*s)+'px system-ui,sans-serif';const w=x.measureText(at).width+10*s;x.fillStyle='rgba(255,255,255,.85)';x.fillRect(c.width-w,c.height-18*s,w,18*s);
 x.fillStyle='#444';x.textAlign='right';x.textBaseline='middle';x.fillText(at,c.width-5*s,c.height-9*s);
 return new Promise(ok=>c.toBlob(ok,'image/png'))}

/* ---- visor genérico ---- */
function viewer(root,rows,ph,isBD){
 root.innerHTML='<div class="mv"><button class="on" data-v="l">☰ Lista</button><button data-v="m">🗺 Mapa</button></div><div class="viewer" data-v="l"><aside class="panel"><div class="ph"><input class="q" type="search" placeholder="'+ph+'" autocomplete="off"><select class="d"></select><select class="p"></select><select class="t"></select>'+(isBD?'<select class="o"></select>':'')+'</div><div class="meta"><span class="cnt"></span><span>'+(isBD?'<button class="adm nw">➕ Nuevo</button> ':'')+'<button class="clr">Limpiar</button></span></div><ul class="list"></ul></aside><section class="main"><div class="mapwrap"><canvas></canvas><div class="lay"><button data-l="calles" class="on">Calles</button><button data-l="sat">Satélite</button><button class="mk" title="Clave de MapTiler">⚙</button></div><div class="ctrl"><button class="zi" title="Acercar">+</button><button class="zo" title="Alejar">−</button><button class="fi" title="Ver todo">⌖</button><button class="gps" title="Mi ubicación: ver los más cercanos">◎</button><button class="inei" title="Capa: centros poblados INEI">▦</button></div><div class="coord"></div><div class="empty">Este registro no tiene coordenadas válidas</div></div><div class="actbar"></div></section><aside class="info"><div class="hint">Busca un barrio o centro poblado y selecciónalo en la lista para ver su ubicación y datos.</div></aside></div>';
 const q=$('.q',root),sd=$('.d',root),sp=$('.p',root),st=$('.t',root),so=$('.o',root),ul=$('.list',root),info=$('.info',root),M=mkEngine($('canvas',root));
 M.onc=s=>$('.coord',root).textContent=s;let cur=-1,res=[],near=false,quiet=false,cm='tipo',curRR=[];
 const opts=(s,v,p)=>{const c=s.value;s.innerHTML='<option value="">'+p+' (todos)</option>'+v.map(x=>'<option>'+esc(x)+'</option>').join('');s.value=v.includes(c)?c:''};
 function run(fit){const dv=sd.value;const rp=dv?rows.filter(r=>r.d===dv):rows;opts(sp,uniq(rp.map(r=>r.p)),'Provincia');const pv=sp.value,rt=pv?rp.filter(r=>r.p===pv):rp;opts(st,uniq(rt.map(r=>r.t)),'Distrito');const tv=st.value,ru=tv?rt.filter(r=>r.t===tv):rt;let rr=ru;if(so){opts(so,uniq(ru.map(r=>r.of)),'Oficina');rr=so.value?ru.filter(r=>r.of===so.value):ru}
  const k=norm(q.value),tk=k.split(/\s+/).filter(Boolean);res=rr.filter(r=>tk.every(t=>r.k.includes(t)));
  if(k)res.sort((a,b)=>(b.k.startsWith(k)-a.k.startsWith(k))||a.k.localeCompare(b.k));else res.sort((a,b)=>a.k.localeCompare(b.k));
   if(near&&M.me){res.forEach(r=>r.dist=typeof r.la==='number'&&isFinite(r.la)?hav(M.me[0],M.me[1],r.la,r.lo):1e9);res.sort((a,b)=>a.dist-b.dist)}
  $('.cnt',root).textContent=res.length.toLocaleString('es')+' coincidencia'+(res.length==1?'':'s')+(res.length>150?' (mostrando 150)':'')+(near&&M.me?' · más cercanos primero':'');
  ul.innerHTML=res.slice(0,150).map((r,i)=>'<li data-i="'+i+'"><b>'+esc(r.n)+(r.dup>1?'<i class="dup" title="Nombre repetido en la base">×'+r.dup+'</i>':'')+(near&&r.dist<1e9?'<i class="km">'+(r.dist<10?r.dist.toFixed(1):Math.round(r.dist))+' km</i>':'')+'</b><span>'+esc(r.sub)+'</span></li>').join('');
  if(isBD){curRR=rr;repaint();if(fit===true)M.fitPts()}
if(res.length==1)pick(0,quiet)}
 function pick(i,nf){const r=res[i];if(!r)return;cur=i;[...ul.children].forEach((li,j)=>li.classList.toggle('on',j==i));if(ul.children[i]&&ul.offsetParent)ul.children[i].scrollIntoView({block:'nearest'});
  const ok=typeof r.la==='number'&&typeof r.lo==='number'&&isFinite(r.la)&&isFinite(r.lo);$('.empty',root).style.display=ok?'none':'block';
  if(ok){M.selName=r.n;M.sel=[wy(r.la),wx(r.lo)];nf?M.req():M.fly(r.la,r.lo,13)}else{M.sel=null;M.req()}
  info.innerHTML='<h2>'+esc(r.n)+'</h2><p>'+esc(r.sub)+'</p><div class="cards">'+r.cards.map(c=>'<div class="card'+(r.bad&&/Frecuencia|Tipo/.test(c[0])?' bad':'')+'"><small>'+esc(c[0])+'</small><strong>'+esc(c[1]||'—')+'</strong></div>').join('')+'</div>'+(r.chips.length?'<div class="chips">'+r.chips.map(x=>'<span>'+esc(x)+'</span>').join('')+'</div>':'');$('.actbar',root).innerHTML='<div class="act">'+'<button data-a="nat">Compartir…</button>'+'<button data-a="cp">Copiar reporte</button>'+(ok?'<button data-a="gm">Abrir en Google Maps</button>':'')+(isBD?'<button class="adm" data-a="ed">✏️ Editar registro</button>':'')+'</div>';}
 const okc=r=>typeof r.la==='number'&&typeof r.lo==='number',gm=r=>'https://www.google.com/maps?q='+r.la+','+r.lo;
 const rep=r=>'📍 *'+r.n+'*\n'+r.sub+'\n\n'+r.cards.map(c=>c[0]+': '+(c[1]||'—')).join('\n')+(okc(r)?'\n\n🗺️ Ubicación: '+gm(r):'')+'\n\n_Visor MAGSA · 2026_';
 $('.actbar',root).onclick=e=>{const b=e.target.closest('[data-a]'),r=res[cur];if(!b||!r)return;const a=b.dataset.a,t=rep(r);
  if(a==='nat')shareRep(r,t);
  
  
  else if(a==='ed')openEdit(r);
  else if(a==='gm')window.open(gm(r),'_blank','noopener');
  else copyRep(r,t)};
 $$('.lay',root).onclick=e=>{const b=e.target.closest('[data-l]');if(!b)return;M.ly=b.dataset.l;M.ok=false;[...$$('.lay',root).children].forEach(x=>x.classList.toggle('on',x===b));M.req()};
 let tm;q.oninput=()=>{near=false;clearTimeout(tm);tm=setTimeout(()=>run(),120)};q.onkeydown=e=>{if(e.key==='Enter'){pick(0);if(res.length)mv('m')}};
 st.onchange=()=>{if(so)so.value='';run(true)};if(so)so.onchange=()=>run(true);sd.onchange=()=>{sp.value='';st.value='';if(so)so.value='';run(true)};sp.onchange=()=>{st.value='';if(so)so.value='';run(true)};
 ul.onclick=e=>{const li=e.target.closest('li');if(li){pick(+li.dataset.i);mv('m')}};
 $('.clr',root).onclick=()=>{q.value='';near=false;sd.value=sp.value=st.value='';if(so)so.value='';run();M.sel=null;M.home();mv('l');info.innerHTML='<div class="hint">Busca un barrio o centro poblado y selecciónalo en la lista para ver su ubicación y datos.</div>';$('.actbar',root).innerHTML='';$('.empty',root).style.display='none'};
 $('.mk',root).onclick=openCfg;
 $('.zi',root).onclick=()=>M.zoomBy(1);$('.zo',root).onclick=()=>M.zoomBy(-1);$('.fi',root).onclick=()=>M.home();
 const HINT='<div class="hint">Busca un barrio o centro poblado y selecciónalo en la lista para ver su ubicación y datos.</div>';
 M.refresh=()=>{const k=cur>=0&&res[cur]?res[cur].key:null;opts(sd,uniq(rows.map(r=>r.d)),'Departamento');run();if(k){const i=res.findIndex(r=>r.key===k);if(i>=0)pick(i,1);else{info.innerHTML=HINT;$('.actbar',root).innerHTML='';M.sel=null;M.req()}}};
 M.focus=(k,n=0)=>{const r=rows.find(x=>x.key===k);if(!r){if(n<8)setTimeout(()=>M.focus(k,n+1),400);return}q.value=r.n;sd.value=sp.value=st.value='';run();const i=res.findIndex(x=>x.key===k);if(i>=0){pick(i);$('.list',root).scrollTop=0}};
 const nb=$('.nw',root);if(nb)nb.onclick=()=>openEdit(null);
 const vw=$('.viewer',root),lgEl=$('.cov',root);
 function mv(v,force){if(!force&&!matchMedia('(max-width:820px)').matches)return;vw.dataset.v=v;root.querySelectorAll('.mv button').forEach(b=>b.classList.toggle('on',b.dataset.v===v));if(v==='m'){M.size();M.draw()}}
 $('.mv',root).onclick=e=>{const b=e.target.closest('[data-v]');if(b)mv(b.dataset.v,true)};
 function repaint(){if(!lgEl){M.covOn=false;M.setCov(curRR,catDef('tipo',rows));return}const def=catDef(cm,rows);M.setCov(curRR,def);const n=new Map();M.cov.forEach(p=>n.set(p.k,(n.get(p.k)||0)+1));
  $('.cvl',root).innerHTML=def.o.filter(o=>n.has(o[0])||M.hid.has(o[0])).map(o=>'<button class="lg'+(M.hid.has(o[0])?' off':'')+'" data-k="'+esc(o[0])+'"><i style="background:'+o[1]+'"></i><span>'+esc(o[0])+'</span><b>'+(n.get(o[0])||0).toLocaleString('es')+'</b></button>').join('')+'<div class="cvt">'+M.cov.length.toLocaleString('es')+' barrios en el mapa · toca un color para ocultarlo</div>'}
 if(lgEl){if(matchMedia('(max-width:820px)').matches)lgEl.classList.add('fold');
  $('.cvm',root).onchange=e=>{cm=e.target.value;M.hid.clear();repaint()};
  $('.cvon',root).onchange=e=>{M.covOn=e.target.checked;lgEl.classList.toggle('noc',!M.covOn);M.req()};
  $('.cvx',root).onclick=()=>lgEl.classList.toggle('fold');
  $('.cvl',root).onclick=e=>{const b=e.target.closest('.lg');if(!b)return;const k=b.dataset.k;M.hid.has(k)?M.hid.delete(k):M.hid.add(k);repaint()};
  M.onhit=r=>{quiet=true;q.value=r.n;near=false;run();quiet=false;const i=res.findIndex(x=>x.key===r.key);if(i>=0)pick(i,1)}}
 $('.gps',root).onclick=()=>{if(!navigator.geolocation)return toast('Este navegador no permite obtener la ubicación');toast('Buscando tu ubicación…');
  navigator.geolocation.getCurrentPosition(p=>{M.me=[p.coords.latitude,p.coords.longitude];near=true;q.value='';quiet=true;run();quiet=false;M.fly(M.me[0],M.me[1],12);toast('Lista ordenada por cercanía')},e=>toast(e.code===1?'Permiso de ubicación denegado':'No se pudo obtener tu ubicación'),{enableHighAccuracy:true,timeout:15000,maximumAge:60000})};
 const repBlob=async r=>{if(!(okc(r)&&isFinite(r.la)))return null;let mb=null;try{mb=await M.snapshot(r.la,r.lo)}catch(e){}return mapShot(mb)};
 const txt2html=t=>esc(t).replace(/\*([^*\n]+)\*/g,'<b>$1</b>').replace(/(^|[\s>])_([^_\n]+)_/g,'$1<i>$2</i>').replace(/(https?:\/\/[^\s<]+)/g,'<a href="$1">$1</a>').replace(/\n/g,'<br>');
 const b2url=b=>new Promise(ok=>{const fr=new FileReader();fr.onload=()=>ok(fr.result);fr.onerror=()=>ok('');fr.readAsDataURL(b)});
 async function copyRep(r,t){toast('Generando reporte con mapa…');
  try{if(window.ClipboardItem&&navigator.clipboard&&navigator.clipboard.write){
   const bp=repBlob(r).then(b=>{if(!b)throw 0;return b});
   const html=bp.then(async b=>new Blob(['<div style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;line-height:1.35"><img src="'+await b2url(b)+'" width="520" alt="Mapa de ubicación" style="max-width:100%;border-radius:8px"><br><br>'+txt2html(t)+'</div>'],{type:'text/html'}));
   await navigator.clipboard.write([new ClipboardItem({'image/png':bp,'text/plain':bp.then(()=>new Blob([t],{type:'text/plain'})),'text/html':html})]);
   toast('Reporte copiado: imagen + texto');return}}catch(e){}
  copyTxt(t)}
 async function shareRep(r,t){
  if(!navigator.share){toast('Este navegador no permite compartir archivos: abriendo WhatsApp con el texto…');try{window.open('https://wa.me/?text='+encodeURIComponent(t),'_blank')}catch(e){}copyRep(r,t);return}
  toast('Generando reporte con mapa…');const bl=await repBlob(r),f=bl&&new File([bl],'Mapa_'+fname(r.n)+'.png',{type:'image/png'});
  try{if(f&&navigator.canShare&&navigator.canShare({files:[f]}))await navigator.share({files:[f],text:t});else await navigator.share({text:t})}
  catch(e){if(!e||e.name!=='AbortError')copyRep(r,t)}}
 const ib=$('.inei',root);
 const showExtra=r=>{cur=-1;[...ul.children].forEach(li=>li.classList.remove('on'));M.selName=r.n;M.sel=[wy(r.la),wx(r.lo)];M.req();$('.empty',root).style.display='none';$('.actbar',root).innerHTML='';
  info.innerHTML='<h2>'+esc(r.n)+'</h2><p>'+esc(r.sub)+'</p><div class="chips" style="margin:0 0 10px"><span>Centro poblado INEI</span></div><div class="cards">'+r.cards.map(c=>'<div class="card"><small>'+esc(c[0])+'</small><strong>'+esc(c[1]||'—')+'</strong></div>').join('')+'</div>'};
 if(!(M instanceof MapG))ib.style.display='none';
 else{if(!isBD){M.ineiOn=true;ib.classList.add('on')}
  ib.onclick=()=>{M.ineiOn=!M.ineiOn;ib.classList.toggle('on',M.ineiOn);M.req();if(M.ineiOn)toast('Centros poblados INEI visibles · acerca para ver los nombres')};
  M.onfeat=p=>{const r=cppRows[p.i];if(!r)return;if(isBD)showExtra(r);else{quiet=true;q.value=r.n;near=false;run();quiet=false;const i=res.indexOf(r);if(i>=0)pick(i,1)}}}
 M.setFilter=f=>{q.value='';near=false;sd.value=f.d||'';run();sp.value=f.p||'';run();st.value=f.t||'';run();if(so)so.value=f.o||'';quiet=true;run(true);quiet=false;info.innerHTML=HINT;$('.actbar',root).innerHTML='';M.sel=null;$('.empty',root).style.display='none';mv('l')};
 opts(sd,uniq(rows.map(r=>r.d)),'Departamento');run();return M}
const maps={bd:viewer($('#t-bd'),bdRows,'Buscar barrio (ej. Alto Trujillo)…',true),cpp:viewer($('#t-cpp'),cppRows,'Buscar centro poblado…')};
function show(t){if(!maps[t]&&t!=='res'&&t!=='cal')t='bd';curTab=t;document.querySelectorAll('nav button[data-t]').forEach(b=>b.classList.toggle('on',b.dataset.t===t));['bd','cpp','res','cal'].forEach(k=>$('#t-'+k).classList.toggle('on',k===t));if(maps[t]){maps[t].size();maps[t].home()}else if(t==='res')renderRes();else renderCal();try{history.replaceState(null,'','#'+t)}catch(e){}}
document.querySelectorAll('nav button[data-t]').forEach(b=>b.onclick=()=>show(b.dataset.t));
addEventListener('hashchange',()=>show(location.hash.slice(1)));show(location.hash.slice(1)||'bd');

/* ---- edición compartida (db) y exportación ---- */
const BDH=['Cod Postal','DEPARTAMENTO','PROVINCIA','DISTRITO','BARRIO','REPARTIDOR','Region','Zona','CNS','CF','Latitud','Longitud','Frecuencia','Tipo de Entrega','Repartidor o Agencia','Contacto','Asistente'];
const CPPH=['Código Centro Poblado','Nombre Centro Poblado','Ubigeo','Departamento','Provincia','Distrito','Capital','Latitud','Longitud','Altitud','Fuente de coordenadas'];
const BASEKEYS=new Set(BD.map(r=>String(r[0])));let DB=null,admin=false,edits={},dels={};
function applyBd(){const l=[];BD.forEach(r=>{const k=String(r[0]);if(!dels[k])l.push(mkBd(edits[k]||r))});Object.keys(edits).forEach(k=>{if(!BASEKEYS.has(k)&&!dels[k])l.push(mkBd(edits[k]))});bdRows.length=0;l.forEach(r=>bdRows.push(r));finish(bdRows);maps.bd.refresh();if(curTab==='res')renderRes();if(curTab==='cal')renderCal();qBadge()}
function sub(){DB.collection('bd_edits').onSnapshot(s=>{edits={};s.docs.forEach(d=>{const v=d.data().v;if(Array.isArray(v)&&v.length===17)edits[d.id]=v});applyBd()},()=>{});
 DB.collection('bd_del').onSnapshot(s=>{dels={};s.docs.forEach(d=>dels[d.id]=1);applyBd()},()=>{})}
/* ---- edición sin Claude: un editor publica ediciones.json en GitHub; los demás lo ven en solo lectura ---- */
const GH={repo:'mreyesaamr-pix/visor-magsa',file:'ediciones.json',branch:'main'};
const ghTok=()=>{try{return localStorage.getItem('magsa-gh')||''}catch(e){return''}};
let dirty=false;
const saveDraft=()=>{try{localStorage.setItem('magsa-draft',JSON.stringify({edits,dels}))}catch(e){}};
const updPub=()=>{const b=$('#pub');if(b){const n=Object.keys(edits).length+Object.keys(dels).length;b.textContent=dirty?'⬆ Publicar cambios':'✔ Publicado';b.classList.toggle('on',dirty);b.title=n+' registros con cambios respecto a la base original'}};
const mark=()=>{dirty=true;saveDraft();applyBd();updPub()};
const localDB={doc(p){const[c,id]=p.split('/');return{set:async d=>{if(c==='bd_edits')edits[id]=d.v;else dels[id]=1;mark()},delete:async()=>{if(c==='bd_edits')delete edits[id];else delete dels[id];mark()}}},collection(){return{onSnapshot(){}}}};
async function publishEd(){const tok=ghTok();if(!tok)throw new Error('Falta la clave de GitHub');
 const url='https://api.github.com/repos/'+GH.repo+'/contents/'+GH.file,H={Authorization:'Bearer '+tok,Accept:'application/vnd.github+json'};
 let sha;const g=await fetch(url+'?ref='+GH.branch+'&t='+Date.now(),{headers:H,cache:'no-store'});if(g.ok)sha=(await g.json()).sha;else if(g.status!==404)throw new Error('GitHub respondió '+g.status+' (revisa la clave)');
 const body=JSON.stringify({edits,dels,updated:new Date().toISOString()});
 const p=await fetch(url,{method:'PUT',headers:H,body:JSON.stringify({message:'Actualización de la BD desde el visor',content:btoa(unescape(encodeURIComponent(body))),sha,branch:GH.branch})});
 if(!p.ok){let m='';try{m=(await p.json()).message}catch(e){}throw new Error('No se pudo publicar ('+p.status+') '+m)}
 dirty=false;saveDraft();updPub()}
function edDlg(){const ov=$('#ov');const on=!!ghTok();
 ov.innerHTML='<div class="dlg" style="max-width:460px"><h3>Modo editor</h3>'+(on?'<p style="margin:0 0 10px;font-size:13px;color:var(--mu)">Los cambios se guardan en este dispositivo y se ven para todos al pulsar <b>Publicar cambios</b>.</p><div class="bt"><button class="ex">Salir del modo editor</button><button class="cn">Cerrar</button></div>':'<p style="margin:0 0 10px;font-size:13px;color:var(--mu)">Pega la clave de GitHub del editor (token con permiso de escritura en «Contents» del repositorio). Se guarda solo en este dispositivo.</p><label style="display:grid;gap:3px;font-size:11px;color:var(--mu);text-transform:uppercase">Clave de GitHub<input id="ghk" type="password" autocomplete="off" placeholder="github_pat_…"></label><div class="bt"><button class="sv">Activar y recargar</button><button class="cn">Cancelar</button></div>')+'<div class="er"></div></div>';
 ov.style.display='flex';$('.cn',ov).onclick=()=>{ov.style.display='none'};
 const sv=$('.sv',ov);if(sv)sv.onclick=()=>{const k=$('#ghk',ov).value.trim();if(!k)return;try{localStorage.setItem('magsa-gh',k);location.reload()}catch(e){$('.er',ov).textContent='Este navegador no permite guardar la clave.'}};
 const ex=$('.ex',ov);if(ex)ex.onclick=()=>{try{localStorage.removeItem('magsa-gh');localStorage.removeItem('magsa-draft')}catch(e){}location.reload()}}
async function localBoot(){
 try{const r=await fetch(GH.file+'?t='+Date.now(),{cache:'no-store'});if(r.ok){const j=await r.json();edits={};Object.keys(j.edits||{}).forEach(k=>{if(Array.isArray(j.edits[k])&&j.edits[k].length===17)edits[k]=j.edits[k]});dels=j.dels||{}}}catch(e){}
 if(ghTok()){try{const d=JSON.parse(localStorage.getItem('magsa-draft')||'null');if(d){edits=d.edits||{};dels=d.dels||{};dirty=true}}catch(e){}admin=true;DB=localDB;
  $('#role').insertAdjacentHTML('afterend','<button id="pub" class="adm" style="border:1px solid #ffc400;background:transparent;color:#ffc400;padding:7px 14px;border-radius:8px;cursor:pointer;font:inherit"></button>');
  $('#pub').onclick=async()=>{const b=$('#pub');if(!dirty)return toast('No hay cambios pendientes');b.disabled=true;toast('Publicando…');try{await publishEd();toast('Publicado. Los demás usuarios lo verán en 1–2 minutos')}catch(e){toast(e.message||'No se pudo publicar')}b.disabled=false};
  updPub()}
 $('#role').style.cursor='pointer';$('#role').onclick=()=>{if(!window.claude)edDlg()};
 applyBd()}
/* ---- carga masiva desde Excel ---- */
const BKEYS=['n','d','p','t'];
function curRow(k){if(dels[k])return null;if(edits[k])return edits[k];const r=BD.find(x=>String(x[0])===k);return r||null}
const hn=s=>norm(s).replace(/\s+/g,' ');
async function bulkParse(file){await loadX();const wb=XLSX.read(await file.arrayBuffer(),{type:'array'});
 const sn=wb.SheetNames.find(n=>hn(n)==='bd')||wb.SheetNames[0],aoa=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,raw:true,defval:''});
 if(!aoa.length)throw new Error('El archivo está vacío.');
 const hd=aoa[0].map(hn),idx=BDH.map(h=>hd.indexOf(hn(h))),miss=BDH.filter((h,i)=>idx[i]<0);
 if(miss.length)throw new Error('La cabecera no coincide con la base original. Faltan columnas: '+miss.join(', ')+'.');
 const out={sheet:sn,items:[],cnt:{nuevo:0,upd:0,igual:0,err:0}},seen=new Set();
 for(let r=1;r<aoa.length;r++){const raw=aoa[r];if(!raw||raw.every(c=>String(c).trim()===''))continue;
  const fila=r+1,get=i=>{const v=raw[idx[i]];return v==null?'':v};
  const key=String(get(0)).trim().replace(/\.0+$/,'');
  const it={fila,key,n:String(get(4)).trim(),st:'',msg:'',row:null,ch:[]};
  const bad=m=>{it.st='err';it.msg=m;out.cnt.err++;out.items.push(it)};
  if(!key){bad('Sin Cod Postal');continue}
  if(seen.has(key)){bad('Cod Postal repetido en el archivo (se usa la primera fila)');continue}
  seen.add(key);
  const v=BDH.map((h,i)=>{let x=get(i);if(i===10||i===11){const s=String(x).trim().replace(',','.');return s===''?'':Number(s)}return String(x).trim()});v[0]=key;
  if((v[10]!==''&&!isFinite(v[10]))||(v[11]!==''&&!isFinite(v[11]))){bad('Latitud o longitud no es un número');continue}
  const old=curRow(key);
  if(!old){const f=[1,2,3,4].filter(i=>!v[i]).map(i=>BDH[i]);if(f.length){bad('Registro nuevo sin: '+f.join(', '));continue}
   it.st='nuevo';it.row=v;out.cnt.nuevo++}
  else{const m=old.slice();BDH.forEach((h,i)=>{if(i===0)return;const u=v[i];if(u===''||u==null)return;if(String(u)!==String(old[i])){it.ch.push([h,old[i]===''||old[i]==null?'—':old[i],u]);m[i]=u}});
   if(it.ch.length){it.st='upd';it.row=m;out.cnt.upd++}else{it.st='igual';out.cnt.igual++}}
  out.items.push(it)}
 if(!out.items.length)throw new Error('No se encontraron filas con datos.');return out}
function bulkDlg(){const ov=$('#ov');
 ov.innerHTML='<div class="dlg" style="max-width:520px"><h3>Cargar Excel</h3><p style="margin:0 0 8px;font-size:13px;color:var(--mu)">Usa un Excel con la <b>misma cabecera</b> de la base (hoja «BD» o la primera hoja). La columna <b>Cod Postal</b> identifica cada registro:</p><ul style="margin:0 0 12px;padding-left:18px;font-size:13px;line-height:1.5"><li>Si el código <b>no existe</b>: se agrega como registro nuevo.</li><li>Si <b>ya existe</b> y trae datos distintos: se actualizan solo esos campos.</li><li>Las celdas vacías <b>no borran</b> datos existentes.</li></ul><div class="bt" style="flex-wrap:wrap"><button class="pk">Elegir archivo…</button><button class="tp">Descargar plantilla</button><button class="cn">Cancelar</button></div><div class="er"></div><input type="file" id="bfile" accept=".xlsx,.xls,.csv" style="display:none"></div>';
 ov.style.display='flex';const er=$('.er',ov);$('.cn',ov).onclick=()=>{ov.style.display='none'};
 $('.pk',ov).onclick=()=>$('#bfile',ov).click();
 $('.tp',ov).onclick=async()=>{try{await loadX();const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([BDH]),'BD');saveFile('Plantilla_carga_BD_MAGSA.xlsx',XLSX.write(wb,{bookType:'xlsx',type:'array'}))}catch(e){er.textContent='No se pudo generar la plantilla.'}};
 $('#bfile',ov).onchange=async e=>{const f=e.target.files[0];if(!f)return;er.textContent='Leyendo archivo…';try{bulkPrev(await bulkParse(f),f.name)}catch(x){er.textContent=x.message||'No se pudo leer el archivo.'}}}
function bulkPrev(R,fname){const ov=$('#ov'),c=R.cnt;
 const rows=R.items.filter(i=>i.st==='nuevo'||i.st==='upd').slice(0,60).map(i=>'<tr><td>'+(i.st==='nuevo'?'<b style="color:#16a34a">NUEVO</b>':'<b style="color:#b45309">ACTUALIZA</b>')+'</td><td>'+esc(i.key)+'</td><td>'+esc(i.row[4])+'</td><td>'+(i.st==='nuevo'?esc(i.row[1]+' · '+i.row[2]+' · '+i.row[3]):i.ch.map(x=>esc(x[0])+': '+esc(String(x[1]))+' → <b>'+esc(String(x[2]))+'</b>').join('<br>'))+'</td></tr>').join('');
 const errs=R.items.filter(i=>i.st==='err').slice(0,30).map(i=>'<li>Fila '+i.fila+(i.key?' ('+esc(i.key)+')':'')+': '+esc(i.msg)+'</li>').join('');
 ov.innerHTML='<div class="dlg"><h3>Revisión de la carga</h3><p style="margin:0 0 8px;font-size:12px;color:var(--mu)">'+esc(fname)+' · hoja «'+esc(R.sheet)+'»</p><div class="chips" style="margin:0 0 10px"><span>'+c.nuevo+' nuevos</span><span>'+c.upd+' a actualizar</span><span>'+c.igual+' sin cambios</span><span>'+c.err+' con errores</span></div>'
 +'<div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:10px;font-size:13px"><label><input type="checkbox" id="bn" checked> Agregar nuevos</label><label><input type="checkbox" id="bu" checked> Aplicar actualizaciones</label></div>'
 +(rows?'<div class="tw" style="max-height:38vh;overflow:auto"><table class="gt"><thead><tr><th>Acción</th><th>Cod Postal</th><th>Barrio</th><th>Detalle</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+((c.nuevo+c.upd)>60?'<p style="font-size:12px;color:var(--mu)">Se muestran los primeros 60 cambios; el reporte incluye todos.</p>':''):'<p>No hay registros nuevos ni cambios para aplicar.</p>')
 +(errs?'<details style="margin-top:8px"><summary style="cursor:pointer;font-size:13px">Ver errores ('+c.err+')</summary><ul style="font-size:12px;margin:6px 0 0;padding-left:18px">'+errs+'</ul></details>':'')
 +'<div class="bt" style="flex-wrap:wrap;margin-top:12px"><button class="ap">Aplicar cambios</button><button class="rp">Descargar reporte</button><button class="cn">Cancelar</button></div><div class="er"></div></div>';
 ov.style.display='flex';const er=$('.er',ov),ap=$('.ap',ov),bn=$('#bn',ov),bu=$('#bu',ov);
 const sel=()=>R.items.filter(i=>(i.st==='nuevo'&&bn.checked)||(i.st==='upd'&&bu.checked));
 const lab=()=>{const n=sel().length;ap.textContent='Aplicar '+n+' cambio'+(n===1?'':'s');ap.disabled=!n};lab();bn.onchange=bu.onchange=lab;
 $('.cn',ov).onclick=()=>{ov.style.display='none'};
 $('.rp',ov).onclick=()=>{const L=[['Fila','Cod Postal','Barrio','Resultado','Detalle']].concat(R.items.map(i=>[i.fila,i.key,i.n,{nuevo:'Nuevo',upd:'Actualizado',igual:'Sin cambios',err:'Error'}[i.st],i.st==='err'?i.msg:i.ch.map(x=>x[0]+': '+x[1]+' -> '+x[2]).join(' | ')]));
  saveFile('Reporte_carga_'+stamp()+'.csv','﻿'+L.map(r=>r.map(c=>{c=c==null?'':String(c);return /[",\n;]/.test(c)?'"'+c.replace(/"/g,'""')+'"':c}).join(',')).join('\r\n'))};
 ap.onclick=async()=>{const S=sel();if(!S.length)return;ap.disabled=true;er.textContent='Aplicando…';
  try{if(DB===localDB){S.forEach(i=>{edits[i.key]=i.row;delete dels[i.key]});mark()}else{for(const i of S){await DB.doc('bd_edits/'+i.key).set({v:i.row,t:Date.now()});if(dels[i.key])await DB.doc('bd_del/'+i.key).delete()}}
   ov.style.display='none';const nn=S.filter(i=>i.st==='nuevo').length,uu=S.length-nn;toast(nn+' nuevos y '+uu+' actualizados'+(DB===localDB?'. Pulsa «Publicar cambios» para que los vean los demás':''))}
  catch(e){er.textContent='No se pudo aplicar: '+(e.message||e);ap.disabled=false}}}
document.addEventListener('click',e=>{if(e.target.closest&&e.target.closest('#bulk'))bulkDlg()});
(async()=>{if(!window.claude)await localBoot();if(window.claude){try{const[d,u]=await Promise.all([claude.use('db'),claude.use('user')]);DB=d;admin=!!(d&&u&&await u.canEdit())}catch(e){}}
 document.body.classList.toggle('admin',admin);const rl=$('#role');rl.textContent=admin?'✏️ Modo editor':'👁 Solo lectura';rl.classList.toggle('on',admin);if(DB)sub()})();
const ov=$('#ov'),DL=[1,2,3,5,6,7,8,9,12,13,14,16];
function ubiHier(){const H={},add=(d,p,t)=>{d=String(d||'').trim();p=String(p||'').trim();t=String(t||'').trim();if(!d)return;const kd=d.toUpperCase(),D=H[kd]||(H[kd]={n:d,p:{}});if(!p)return;const kp=p.toUpperCase(),P=D.p[kp]||(D.p[kp]={n:p,d:new Set()});if(t)P.d.add(t.toUpperCase())};
 bdRows.forEach(x=>add(x.raw[1],x.raw[2],x.raw[3]));CPP.rows.forEach(r=>add(CPP.D[r[3]],CPP.P[r[4]],CPP.T[r[5]]));return H}
function nextSincod(){let m=0;const f=k=>{const x=/^SINCOD(\d+)$/i.exec(String(k));if(x)m=Math.max(m,parseInt(x[1],10))};bdRows.forEach(x=>f(x.key));Object.keys(edits||{}).forEach(f);return 'SINCOD'+String(m+1).padStart(3,'0')}
function openEdit(r){const isNew=!r,v=r?r.raw.slice():BDH.map(()=>'');if(isNew)v[6]='Norte';
 const dls=DL.map(i=>'<datalist id="dl'+i+'">'+(i===1||i===2||i===3?'':uniq(bdRows.map(x=>x.raw[i]).filter(Boolean)).map(x=>'<option value="'+esc(x)+'">').join(''))+'</datalist>').join('');
 ov.innerHTML='<div class="dlg"><h3>'+(isNew?'Nuevo registro':'Editar: '+esc(r.n))+'</h3><div class="fg">'+BDH.map((h,i)=>'<label>'+esc(h)+'<input data-i="'+i+'" value="'+esc(v[i]??'')+'"'+(DL.includes(i)?' list="dl'+i+'"':'')+(i===0&&!isNew?' readonly':'')+'></label>').join('')+'</div>'+dls+'<div class="er"></div><div class="bt"><button class="sv">Guardar</button><button class="cn">Cancelar</button>'+(!isNew&&edits[r.key]&&BASEKEYS.has(r.key)?'<button class="rs">Restaurar original</button>':'')+(!isNew?'<button class="dx">Eliminar</button>':'')+'</div></div>';
 ov.style.display='flex';const $o=s=>ov.querySelector(s),err=m=>$o('.er').textContent=m,close=()=>ov.style.display='none';
 $o('.cn').onclick=close;
 const nk=x=>String(x||'').trim().toUpperCase(),hier=ubiHier(),inp=i=>$o('[data-i="'+i+'"]');
 const fill=(i,arr)=>{const el=$o('#dl'+i);if(!el)return;el.innerHTML=uniq(arr).map(x=>'<option value="'+esc(x)+'">').join('')};
 const upd=()=>{const d=nk(inp(1).value),p=nk(inp(2).value);
  fill(1,Object.keys(hier).map(k=>hier[k].n));
  const dd=d&&hier[d];fill(2,dd?Object.keys(dd.p).map(k=>dd.p[k].n):Object.keys(hier).flatMap(k=>Object.keys(hier[k].p).map(q=>hier[k].p[q].n)));
  const pp=dd&&p&&dd.p[p];fill(3,pp?[...pp.d]:(dd?Object.keys(dd.p).flatMap(q=>[...dd.p[q].d]):[]))};
 inp(1).addEventListener('input',()=>{const d=nk(inp(1).value);if(hier[d]&&inp(2).value&&!hier[d].p[nk(inp(2).value)]){inp(2).value='';inp(3).value=''}upd()});
 inp(2).addEventListener('input',()=>{const d=nk(inp(1).value),p=nk(inp(2).value);if(hier[d]&&hier[d].p[p]&&inp(3).value&&!hier[d].p[p].d.has(inp(3).value.trim().toUpperCase()))inp(3).value='';upd()});
 if(isNew){inp(0).placeholder='Vacío = '+nextSincod();inp(0).style.setProperty('--ph','1')}
 upd();
 $o('.sv').onclick=async()=>{const nv=BDH.map((h,i)=>$o('[data-i="'+i+'"]').value.trim());
  if(isNew&&!nv[0])nv[0]=nextSincod();
  if(!nv[0]||!nv[4])return err('BARRIO es obligatorio.');
  if(!/^[A-Za-z0-9_.~:@+-]+$/.test(nv[0]))return err('El código postal solo admite letras y números.');
  if(isNew&&bdRows.some(x=>x.key===nv[0]))return err('Ya existe un registro con ese código postal.');
  for(const i of [10,11]){if(nv[i]===''){nv[i]=null;continue}const n=parseFloat(nv[i].replace(',','.'));if(!isFinite(n))return err(BDH[i]+' no es un número válido.');nv[i]=n}
  if(nv[10]!==null&&nv[11]!==null&&(nv[10]>1||nv[10]<-19||nv[11]>-68||nv[11]<-82))return err('Las coordenadas están fuera del Perú. Revisa latitud y longitud.');
  if(!DB)return err('Sin conexión a la base de datos.');
  try{await DB.doc('bd_edits/'+nv[0]).set({v:nv,t:Date.now()});if(dels[nv[0]])await DB.doc('bd_del/'+nv[0]).delete();close();toast('Registro guardado');maps.bd.focus(nv[0])}catch(e){err('No se pudo guardar: '+(e.message||e.code))}};
 const rs=$o('.rs');if(rs)rs.onclick=async()=>{try{await DB.doc('bd_edits/'+r.key).delete();close();toast('Registro restaurado al original');maps.bd.focus(r.key)}catch(e){err('No se pudo restaurar: '+(e.message||e.code))}};
 const dx=$o('.dx');if(dx)dx.onclick=async()=>{if(!dx.dataset.c){dx.dataset.c=1;dx.textContent='¿Seguro? Confirmar eliminación';return}
  try{if(BASEKEYS.has(r.key))await DB.doc('bd_del/'+r.key).set({t:Date.now()});await DB.doc('bd_edits/'+r.key).delete();close();toast('Registro eliminado')}catch(e){err('No se pudo eliminar: '+(e.message||e.code))}}}
ov.onclick=e=>{if(e.target===ov)ov.style.display='none'};
/* exportar */
const stamp=()=>new Date().toISOString().slice(0,10);
const bdAoa=()=>[BDH].concat(bdRows.map(r=>r.raw.map((x,i)=>i===0&&/^\d+$/.test(x)?Number(x):x)));
const cppAoa=()=>[CPPH].concat(CPP.rows.map(r=>[r[0],r[1],r[2],CPP.D[r[3]],CPP.P[r[4]],CPP.T[r[5]],r[6],r[7],r[8],r[9],r[10]]));
async function saveFile(name,data){const dl=window.claude?await claude.use('downloads'):null;
 if(dl){try{await dl.save({filename:name,data});toast('Archivo listo');return}catch(e){if(e&&e.code==='declined')return}}
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data]));a.download=name;document.body.appendChild(a);a.click();a.remove()}
const loadX=()=>window.XLSX?Promise.resolve():new Promise((ok,no)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';s.onload=ok;s.onerror=no;document.head.appendChild(s)});
async function exportX(both){toast('Preparando Excel…');try{await loadX()}catch(e){return toast('No se pudo cargar el módulo de Excel. Usa la opción CSV.')}
 const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(bdAoa()),'BD');if(both)XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(cppAoa()),'CPP PERÚ');
 saveFile('VISOR_MAGSA_actualizado_'+stamp()+'.xlsx',XLSX.write(wb,{bookType:'xlsx',type:'array'}))}
function exportCsv(){saveFile('BD_MAGSA_actualizada_'+stamp()+'.csv','\ufeff'+bdAoa().map(r=>r.map(c=>{c=c==null?'':String(c);return /[",\n;]/.test(c)?'"'+c.replace(/"/g,'""')+'"':c}).join(',')).join('\r\n'))}
$('#exp').onclick=e=>{e.stopPropagation();const x=$('#xm');x.innerHTML='<button data-x="xl">Excel completo (BD + CPP Perú)</button><button data-x="bx">Excel solo BD actualizada</button><button data-x="cv">CSV solo BD actualizada</button>';x.style.display=x.style.display==='block'?'none':'block'};
$('#xm').onclick=e=>{const b=e.target.closest('[data-x]');if(!b)return;const k=b.dataset.x;k==='cv'?exportCsv():exportX(k==='xl')};
document.addEventListener('click',()=>$('#xm').style.display='none');

const thb=$('#th');function setTheme(t){document.documentElement.dataset.theme=t;thb.textContent=t==='dark'?'☀️ Claro':'🌙 Oscuro';try{localStorage.setItem('magsa-tema',t)}catch(e){}Object.values(maps).forEach(m=>m.req())}
thb.onclick=()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');
let t0;try{t0=localStorage.getItem('magsa-tema')}catch(e){}setTheme(t0||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'));
document.getElementById('boot')?.remove();
