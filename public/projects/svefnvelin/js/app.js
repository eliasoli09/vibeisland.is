"use strict";
let DATA=null, CUR="heim", CURCH=null, D="med";
// Textathettleiki er raunveruleg stilling: hann breytir thvi HVAD er synt,
// ekki bara leturstaerd. Ordretti textinn er stori hlutinn, svo hann styrir honum.
const DENS={
  low: {quote:false, cards:6,  eps:10,  full:false},
  med: {quote:true,  cards:14, eps:45,  full:false},
  high:{quote:true,  cards:32, eps:140, full:true}
};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const num=n=>String(n).replace(/\B(?=(\d{3})+(?!\d))/g,".");   // islenskt thusundamerki

/* ---------- textaþéttleiki ---------- */
function setD(d){
  D=d;
  document.documentElement.dataset.d=d;
  $$("#dens button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.d===d));
  try{localStorage.setItem("svefn-d",d)}catch(e){}
  if(!DATA) return;
  const y=window.scrollY, h=document.body.scrollHeight;
  if(CURCH) openChapter(CURCH);
  renderCompare(); renderEps(); if(DATA.supplements) buildSupp();
  // sidan styttist thegar textinn minnkar - ekki skilja lesandann eftir i tomu rymi
  requestAnimationFrame(()=>{ if(y>document.body.scrollHeight-window.innerHeight)
      window.scrollTo({top:Math.max(0,document.body.scrollHeight-window.innerHeight),behavior:"instant"}); });
}
$("#dens").addEventListener("click",e=>{const b=e.target.closest("button"); if(b) setD(b.dataset.d)});
let d0="med"; try{d0=localStorage.getItem("svefn-d")||"med"}catch(e){}
setD(d0);

/* ---------- leiðakerfi ---------- */
function mountStage(target){
  const st=$("#stage"); if(!st||!target||st.parentElement===target) return;
  target.appendChild(st);
  if(B) requestAnimationFrame(()=>B.resize());
}
function go(v){
  CUR=v;
  $$(".view").forEach(s=>s.hidden = s.id!=="v-"+v);
  $$("#nav button").forEach(b=>b.setAttribute("aria-current",String(b.dataset.v===v)));
  if(v==="likami"){ mountStage($("#stageWrap")); initBody(); if(B) B.setSpin(true); }
  if(v==="baetiefni" && B) B.setSpin(false);
  window.scrollTo({top:0,behavior:"instant"});
  if(location.hash.slice(1)!==v) history.replaceState(null,"","#"+v);
}
$("#nav").addEventListener("click",e=>{const b=e.target.closest("button"); if(b) go(b.dataset.v)});

/* ---------- ræsing ---------- */
fetch("data/chapters.json",{cache:"no-store"}).then(r=>r.json()).then(d=>{DATA=d; boot();})
 .catch(e=>{ $("#stats").innerHTML='<p class="muted">Gögn hlóðust ekki: '+esc(e.message)+'</p>'; });

function boot(){
  $("#stats").innerHTML=[
    [num(DATA.episodeTotal),"þættir"],
    [num(Math.round(DATA.wordTotal/1000))+"k","orð í uppskriftum"],
    [num(DATA.effectTotal),"mældar áhrifastærðir"],
    [num(DATA.chapters.length),"kaflar"]
  ].map(([b,s])=>`<div class="stat"><b>${b}</b><span>${s}</span></div>`).join("");

  $("#homeChapters").innerHTML=DATA.chapters.map(c=>`
    <article class="card click" data-ch="${c.key}">
      <h3>${esc(c.name)}</h3>
      <p class="muted" style="margin:0 0 10px">${esc(c.desc)}</p>
      <div class="src">
        <span class="tag">${c.episodeCount} þættir</span>
        ${c.effects.length?`<span class="tag ok">${c.effects.length} áhrifastærðir</span>`:""}
        ${c.videos.length?`<span class="tag inst">${c.videos.length} myndb.</span>`:""}
      </div>
    </article>`).join("");
  $("#homeChapters").addEventListener("click",e=>{
    const a=e.target.closest("[data-ch]"); if(a) openChapter(a.dataset.ch);
  });

  buildChapters(); buildCompare(); buildEpisodes();
  const h=location.hash.slice(1);
  buildMethod(); buildSupp();
  go(["heim","kaflar","samanburdur","likami","thaettir","adferd","baetiefni"].includes(h)?h:"heim");
}

/* ---------- kaflar ---------- */
function buildChapters(){
  $("#v-kaflar").innerHTML=`
    <p class="kicker">Tíu kaflar úr 300 þáttum</p>
    <h1 style="font-size:clamp(1.7rem,4vw,2.5rem);margin-block:8px 12px">Kaflar</h1>
    <p class="lede">Hver kafli safnar saman þáttunum sem fjalla um efnið og tölunum sem mælast í þeim.</p>
    <div class="grid g2" id="chList" style="margin-top:20px"></div>
    <div id="chDetail"></div>`;
  $("#chList").innerHTML=DATA.chapters.map(c=>`
    <article class="card click" data-ch="${c.key}">
      <h3>${esc(c.name)}</h3>
      <p class="muted" style="margin:0 0 10px">${esc(c.desc)}</p>
      <div class="src">
        <span class="tag">${c.episodeCount} þættir</span>
        ${c.effects.length?`<span class="tag ok">${c.effects.length} áhrifastærðir</span>`:""}
        ${c.videos.length?`<span class="tag inst">${c.videos.length} myndb.</span>`:""}
      </div>
    </article>`).join("");
  $("#chList").addEventListener("click",e=>{
    const a=e.target.closest("[data-ch]"); if(a) openChapter(a.dataset.ch);
  });
}

function cmpCard(x){
  const heiti = x.effect_is || x.effect;
  const enska = `<details class="orig"><summary>orðrétt á ensku</summary><div class="body">
      <div class="quote">${esc(x.text)}</div></div></details>`;
  let mal;
  if(x.text_is){
    mal = DENS[D].quote
      ? `<div class="quote is">${esc(x.text_is)}</div>${enska}`
      : `<details><summary>lesa á íslensku</summary><div class="body">
           <div class="quote is" style="margin:0">${esc(x.text_is)}</div></div></details>${enska}`;
  } else {
    mal = DENS[D].quote
      ? `<div class="quote">${esc(x.text)}</div>
         <p class="muted" style="margin:-4px 0 0;font-size:.74rem">Íslensk þýðing ekki komin fyrir þessa tilvitnun.</p>`
      : `<details><summary>orðrétt á ensku</summary><div class="body">
           <div class="quote" style="margin:0">${esc(x.text)}</div></div></details>`;
  }
  return `<article class="cmp">
    <div class="eff">${esc(heiti)}${x.effect_is?`<span class="effen"> · ${esc(x.effect)}</span>`:""}</div>
    ${effGraph(x.graph, heiti)}
    ${mal}
    <div class="src">
      <span>${esc(x.title)}</span>
      ${x.study?'<span class="tag ok">rannsókn nefnd</span>':''}
      ${x.inst?`<span class="tag inst">${esc(x.inst)}</span>`:''}
      ${x.contrast?'<span class="tag">beinn samanburður</span>':''}
    </div>
  </article>`;
}

function openChapter(key){
  const c=DATA.chapters.find(x=>x.key===key); if(!c) return;
  CURCH=key; go("kaflar");
  $("#chList").parentElement.querySelector("#chList").style.display="none";
  const eff=c.effects;
  $("#chDetail").innerHTML=`
    <p style="margin-block:18px 8px"><button class="chip" id="backCh">← allir kaflar</button></p>
    <p class="kicker">Kafli</p>
    <h2 style="font-size:2rem;margin-block:6px 10px">${esc(c.name)}</h2>
    <p class="lede">${esc(c.desc)}</p>

    ${c.videos.length?c.videos.map(v=>videoBlock(v,`
      <div class="d-high" style="margin-top:8px;color:var(--ink3);font-size:.82rem">
        Rennt í Blender á staðnum, 1280×720, 24 rammar á sekúndu, EEVEE.
        Möskvarnir eru úr BodyParts3D - sömu möskvar og eru í þrívíddarsýninni undir „Líkaminn".
      </div>`)).join(""):`
    <div class="note" style="margin-block:20px">Ekkert myndband komið fyrir þennan kafla enn.</div>`}

    <h3 style="font-size:1.25rem;margin-block:26px 6px">Þeir sem gera það á móti þeim sem gera það ekki</h3>
    ${eff.length?`
      <p class="muted" style="margin-top:0">${eff.length} mældar áhrifastærðir úr þessum þáttum. Orðrétt.</p>
      <div class="grid" style="gap:13px">${eff.slice(0,DENS[D].cards).map(cmpCard).join("")}</div>
      ${eff.length>DENS[D].cards?`<p class="muted" style="margin-top:12px">${eff.length-DENS[D].cards} til viðbótar í <a href="#samanburdur" data-goto="samanburdur">Samanburði</a>.</p>`:""}
    `:`<p class="muted">Engin fullyrðing í þessum kafla stóðst kröfuna um tölu inni í samanburði.</p>`}

    <h3 style="font-size:1.25rem;margin-block:30px 6px">Þættirnir í þessum kafla</h3>
    <p class="muted" style="margin-top:0">Raðað eftir því hve oft efnið kemur fyrir.</p>
    <div class="eplist">${c.episodes.slice(0,DENS[D].eps).map(e=>`
      <div class="ep"><span class="n">${esc(e.id)}</span><span class="t">${esc(e.title)}</span><span class="c">${e.n}×</span></div>`).join("")}</div>
    ${c.episodes.length>DENS[D].eps?`<p class="muted">…og ${num(c.episodes.length-DENS[D].eps)} í viðbót.</p>`:""}
  `;
  armGraphs($("#chDetail")); armVideos($("#chDetail"));
  $("#backCh").onclick=()=>{ CURCH=null; $("#chList").style.display=""; $("#chDetail").innerHTML=""; };
  $$("#chDetail [data-goto]").forEach(a=>a.onclick=ev=>{ev.preventDefault(); go(a.dataset.goto)});
}



/* ---------- myndband með tímasettum texta ---------- */
function videoBlock(v, extra){
  const caps = v.caps || [];
  return `<div class="vidbox" style="margin-block:20px">
    <div class="vidwrap">
      <video src="video/${v.id}.mp4" controls loop muted playsinline preload="metadata"
             data-caps="${esc(JSON.stringify(caps))}"></video>
      <div class="vcap"><b></b></div>
    </div>
    ${caps.length?`<div class="vsteps">${caps.map((c,i)=>
      `<button class="vstep" data-t="${c[0]}" data-i="${i}">${c[0].toFixed(0)}s</button>`).join("")}</div>`:""}
    <div class="vidcap">
      <b>${esc(v.name)}</b> <span class="muted tnum">${v.sec} sek</span><br>
      ${esc(v.what)}
      <span class="d-lowonly"><br><span class="tag">skýringarmynd að hluta</span></span>
      <div class="d-med" style="margin-top:9px;color:var(--ink3);font-size:.84rem">
        <b style="color:var(--good)">Það sem er raunverulegt:</b> ${esc(v.real)}
      </div>
      <div class="d-med" style="margin-top:6px;color:var(--ink3);font-size:.84rem">
        <b style="color:var(--gold)">Það sem er skýringarmynd:</b> ${esc(v.schem)}
      </div>
      ${extra||""}
    </div>
  </div>`;
}
function armVideos(root){
  (root||document).querySelectorAll(".vidbox video[data-caps]").forEach(vd=>{
    if(vd.dataset.armed) return;
    vd.dataset.armed="1";
    let caps=[]; try{ caps=JSON.parse(vd.dataset.caps)||[]; }catch(e){}
    if(!caps.length) return;
    const box=vd.closest(".vidbox");
    const cap=box.querySelector(".vcap"), b=cap.querySelector("b");
    const steps=[...box.querySelectorAll(".vstep")];
    let cur=-1;
    const show=i=>{
      if(i===cur) return;
      cur=i;
      if(i<0){ cap.classList.remove("show"); steps.forEach(s=>s.setAttribute("aria-current","false")); return; }
      b.textContent=caps[i][1];
      cap.classList.add("show");
      steps.forEach(s=>s.setAttribute("aria-current", String(+s.dataset.i===i)));
    };
    vd.addEventListener("timeupdate",()=>{
      const t=vd.currentTime;
      let i=-1;
      for(let k=0;k<caps.length;k++){ if(t>=caps[k][0]) i=k; }
      show(i);
    });
    vd.addEventListener("seeked",()=>vd.dispatchEvent(new Event("timeupdate")));
    steps.forEach(s=>s.onclick=()=>{ vd.currentTime=+s.dataset.t; if(vd.paused) vd.play().catch(()=>{}); });
    show(0);
  });
}

/* ---------- hreyfimyndagraf ---------- */
const fmtN = n => (n>=1000 ? Math.round(n).toLocaleString("is-IS").replace(/,/g,".")
                           : (n%1===0 ? String(n) : n.toFixed(1).replace(".",",")));
function effGraph(g, effTxt){
  if(!g) return "";
  const mx  = Math.max(g.base, g.other) || 100;
  const w1  = Math.max(2, g.base/mx*100), w2 = Math.max(2, g.other/mx*100);
  const col = g.dir < 0 ? "var(--good)" : "var(--gold)";
  const ord = g.dir < 0 ? "lægra" : "hærra";
  return `<div class="eg">
    <div class="egrow">
      <span class="eglab">viðmiðunarhópur</span>
      <span class="egbar"><i style="--w:${w1.toFixed(1)}%;background:var(--ink3)"></i></span>
      <span class="egval" style="color:var(--ink2)">100</span>
    </div>
    <div class="egrow">
      <span class="eglab">hinn hópurinn</span>
      <span class="egbar"><i style="--w:${w2.toFixed(1)}%;background:${col}"></i></span>
      <span class="egval" style="color:${col}">${fmtN(g.other)}</span>
    </div>
    <p class="egcap">Viðmiðunarhópurinn er settur á 100 og hinn hópurinn mælist <b style="color:${col}">${fmtN(g.other)}</b> - ${ord}.
      Lesið beint úr orðalaginu <b>„${esc(effTxt)}"</b>; hvor hópurinn er hvor kemur fram í tilvitnuninni.</p>
  </div>`;
}
let egObs = null;
function armGraphs(root){
  const els = (root||document).querySelectorAll(".eg:not(.on)");
  if(!els.length) return;
  if(!("IntersectionObserver" in window)){
    els.forEach(e=>e.classList.add("on")); return;
  }
  if(!egObs) egObs = new IntersectionObserver(es=>{
    es.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add("on"); egObs.unobserve(e.target); } });
  }, {rootMargin:"0px 0px -10% 0px"});
  els.forEach(e=>egObs.observe(e));
  // oryggisnet: sidan ma aldrei standa eftir tom ef vaktarinn kviknar ekki
  setTimeout(()=>(root||document).querySelectorAll(".eg:not(.on)").forEach(e=>e.classList.add("on")), 1400);
}

/* ---------- samanburður ---------- */
let ALLEFF=[], fTopic=null, fStudy=false, fInst=false;
function buildCompare(){
  const seen=new Set();
  DATA.chapters.forEach(c=>c.effects.forEach(x=>{
    const k=x.ep+"|"+x.text.slice(0,70);
    if(!seen.has(k)){ seen.add(k); ALLEFF.push(x); }
  }));
  $("#cmpLede").textContent=`${ALLEFF.length} staðir í uppskriftunum þar sem tala stendur inni í samanburði. Auglýsingar kostunaraðila eru síaðar burt.`;
  $("#cmpTopics").innerHTML=`<button class="chip" data-t="" aria-pressed="true">Allt</button>`+
    DATA.chapters.filter(c=>c.effects.length).map(c=>`<button class="chip" data-t="${c.key}">${esc(c.name)}</button>`).join("");
  $("#cmpTopics").addEventListener("click",e=>{
    const b=e.target.closest(".chip"); if(!b) return;
    fTopic=b.dataset.t||null;
    $$("#cmpTopics .chip").forEach(x=>x.setAttribute("aria-pressed",String(x===b)));
    renderCompare();
  });
  $("#fStudy").onclick=()=>{fStudy=!fStudy; $("#fStudy").setAttribute("aria-pressed",String(fStudy)); renderCompare()};
  $("#fInst").onclick =()=>{fInst=!fInst;  $("#fInst").setAttribute("aria-pressed",String(fInst));  renderCompare()};
  $("#cmpSearch").addEventListener("input",renderCompare);
  renderCompare();
}
function renderCompare(){
  if(!ALLEFF.length) return;
  const q=$("#cmpSearch").value.trim().toLowerCase();
  let r=ALLEFF.filter(x=>
    (!fTopic||x.topics.includes(fTopic)) && (!fStudy||x.study) && (!fInst||x.inst) &&
    (!q||x.text.toLowerCase().includes(q)||x.title.toLowerCase().includes(q)));
  r=r.slice().sort((a,b)=>b.rank-a.rank);
  $("#cmpCount").textContent=`${r.length} af ${ALLEFF.length}`;
  $("#cmpList").innerHTML=r.slice(0,DENS[D].cards*4).map(cmpCard).join("")||'<p class="muted">Ekkert fannst.</p>';
  armGraphs($("#cmpList"));
}

/* ---------- þættir ---------- */
function buildEpisodes(){
  $("#epLede").textContent=`Allir ${num(DATA.episodeTotal)} þættirnir. Smelltu á þátt til að leita í heilu uppskriftinni hans.`;
  $("#epSearch").addEventListener("input",renderEps);
  $("#epList").addEventListener("click",e=>{
    const b=e.target.closest("[data-ep]"); if(b) openEp(b.dataset.ep);
  });
  renderEps();
}

/* ---------- þáttur: leit í heilli uppskrift ---------- */
let TXCACHE={};
async function openEp(id){
  const e=DATA.allEpisodes.find(x=>x.id===id); if(!e) return;
  const eff=ALLEFF.filter(x=>x.ep===id);
  const box=$("#epDetail");
  box.innerHTML=`
    <div class="card" style="margin-block:16px">
      <p style="margin:0 0 4px"><button class="chip" id="epBack">× loka</button></p>
      <p class="kicker" style="margin-top:12px">${esc(id)}</p>
      <h3 style="font-size:1.25rem;margin-block:4px 8px">${esc(e.title)}</h3>
      <p class="muted tnum" style="margin-top:0">${num(e.words)} orð í uppskriftinni${eff.length?` · ${eff.length} mældar áhrifastærðir`:""}</p>
      ${eff.length?`<div class="grid" style="gap:12px;margin-block:14px">${eff.map(cmpCard).join("")}</div>`:
        `<p class="muted">Engin tala stendur inni í samanburði í þessum þætti.</p>`}
      <hr class="sep" style="margin-block:20px">
      <h4 style="font-family:var(--f-head);font-size:1.05rem;margin-bottom:8px">Leita í uppskriftinni</h4>
      <input type="search" id="txq" placeholder="t.d. sleep, cortisol, caffeine…">
      <p class="muted" id="txStatus" style="margin-block:10px"></p>
      <div id="txHits"></div>
    </div>`;
  armGraphs(box);
  box.scrollIntoView({behavior:"smooth",block:"start"});
  $("#epBack").onclick=()=>{ box.innerHTML=""; };
  const q=$("#txq"); q.focus();
  let t=null;
  q.addEventListener("input",()=>{ clearTimeout(t); t=setTimeout(()=>txSearch(id,q.value.trim()),220); });
}
async function txSearch(id,q){
  const st=$("#txStatus"), hits=$("#txHits");
  if(q.length<3){ st.textContent="Sláðu inn a.m.k. 3 stafi."; hits.innerHTML=""; return; }
  st.textContent="leita…";
  try{
    if(!TXCACHE[id]){
      const r=await fetch("data/tx_"+id+".txt");
      if(!r.ok) throw new Error("uppskrift fannst ekki");
      TXCACHE[id]=await r.text();
    }
  }catch(err){ st.textContent="Uppskriftin hlóðst ekki: "+err.message; return; }
  const t=TXCACHE[id], lq=q.toLowerCase(), lt=t.toLowerCase();
  const out=[]; let i=0;
  while(out.length<40){
    const k=lt.indexOf(lq,i); if(k<0) break;
    let a=Math.max(0,k-230), b=Math.min(t.length,k+q.length+230);
    while(a>0 && !/\s/.test(t[a-1])) a--;
    while(b<t.length && !/\s/.test(t[b])) b++;
    out.push([a,k,k+q.length,b]); i=k+q.length+200;
  }
  const total=(lt.match(new RegExp(lq.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"g"))||[]).length;
  st.textContent=total?`${num(total)} fundnir staðir · ${out.length} samhengisbútar (staðir sem liggja þétt saman renna í einn)`:"ekkert fannst";
  hits.innerHTML=out.map(([a,s1,s2,b])=>
    `<div class="quote">${esc(t.slice(a,s1))}<b style="color:var(--gold)">${esc(t.slice(s1,s2))}</b>${esc(t.slice(s2,b))}</div>`).join("");
}
function renderEps(){
  if(!DATA) return;
  const q=$("#epSearch").value.trim().toLowerCase();
  const names=Object.fromEntries(DATA.chapters.map(c=>[c.key,c.name]));
  const r=DATA.allEpisodes.filter(e=>!q||e.title.toLowerCase().includes(q));
  $("#epCount").textContent=`${r.length} af ${DATA.episodeTotal}`;
  $("#epList").innerHTML=r.slice(0,DENS[D].full?300:DENS[D].eps*3).map(e=>`
    <button class="ep" data-ep="${esc(e.id)}"><span class="n">${esc(e.id)}</span><span class="t">${esc(e.title)}</span>
    <span class="c">${e.topics.map(t=>esc(names[t]||t)).join(" · ")}</span></button>`).join("");
}

/* ---------- þrívídd ---------- */
/* Kerfin eru hlaðin eitt og eitt thegar kveikt er a theim - allt safnid
   er 23,8 milljon marghyrningar og sprengir vafrann. */
const MSYS=[
 {k:"beinagrind", n:"Beinagrind",   c:0xcfd6e2, a:0.42, on:true},
 {k:"vodvar",     n:"Vöðvar",       c:0xd6564a, a:0.94, on:false},
 {k:"slagaedar",  n:"Slagæðar",     c:0xe04a4a, a:0.95, on:false},
 {k:"blaaedar",   n:"Bláæðar",      c:0x5a80dc, a:0.92, on:false},
 {k:"taugar",     n:"Taugar",       c:0xf2c76b, a:0.92, on:true},
 {k:"hjarta",     n:"Hjarta",       c:0xed858f, a:0.96, on:true},
 {k:"ondun",      n:"Öndun",        c:0x8fd9bf, a:0.62, on:true},
 {k:"melting",    n:"Melting",      c:0xc79a66, a:0.58, on:false},
 {k:"skynfaeri",  n:"Skynfæri",     c:0x9ed6f2, a:0.92, on:true},
 {k:"hormonar",   n:"Hormónakirtlar",c:0xff9e38, a:1.00, on:true},
 {k:"thvagfaeri", n:"Þvagfæri",     c:0xb49fe0, a:0.86, on:false},
 {k:"bandvefur",  n:"Bandvefur",    c:0xbfc6d4, a:0.50, on:false},
 {k:"kona",       n:"Kvenlíkami",   c:0xd8a8b4, a:0.70, on:false}
];
let B=null;
function initBody(){
  if(B){ B.resize(); return; }
  if(typeof THREE==="undefined"){ $("#stageMsg").textContent="three.js hlóðst ekki (engin nettenging?)"; return; }
  const host=$("#stage");
  const ren=new THREE.WebGLRenderer({antialias:true,alpha:true});
  ren.setPixelRatio(Math.min(devicePixelRatio,2));
  ren.setSize(host.clientWidth,host.clientHeight);
  ren.outputEncoding=THREE.sRGBEncoding;
  ren.toneMapping=THREE.ACESFilmicToneMapping; ren.toneMappingExposure=1.1;
  host.appendChild(ren.domElement);

  const sc=new THREE.Scene();
  const cam=new THREE.PerspectiveCamera(36,host.clientWidth/host.clientHeight,0.01,60);
  cam.position.set(0.55,1.15,2.15);
  const ctr=new THREE.OrbitControls(cam,ren.domElement);
  ctr.target.set(0,0.92,0); ctr.enableDamping=true; ctr.dampingFactor=0.07;
  ctr.minDistance=0.25; ctr.maxDistance=6;
  ctr.autoRotate=true; ctr.autoRotateSpeed=0.4;

  sc.add(new THREE.AmbientLight(0x35507a,0.8));
  const mk=(col,i,p)=>{const l=new THREE.DirectionalLight(col,i); l.position.set(...p); sc.add(l); return l;};
  mk(0xfff0dc,1.35,[1.7,2.3,2.6]); mk(0x8fbcff,0.85,[-2.0,1.4,-1.8]); mk(0xffd9a8,0.42,[-1.2,0.5,1.8]);

  const groups={}, loading={};
  const loader=new THREE.GLTFLoader();
  function load(sy){
    if(groups[sy.k]||loading[sy.k]) return;
    loading[sy.k]=true; setChip(sy.k,"hleð…");
    loader.load("models/master/"+sy.k+".glb", g=>{
      const m=new THREE.MeshStandardMaterial({color:sy.c,roughness:0.55,metalness:0.04,
        transparent:sy.a<1, opacity:sy.a, depthWrite:sy.a>0.85});
      let n=0;
      g.scene.traverse(o=>{ if(o.isMesh){ o.material=m; n++; } });
      groups[sy.k]=g.scene; sc.add(g.scene);
      g.scene.visible = !!sy.on;
      loading[sy.k]=false; setChip(sy.k, n+" hlutar");
      if($("#stageMsg")) $("#stageMsg").remove();
    }, undefined, err=>{
      loading[sy.k]=false; setChip(sy.k,"vantar");
    });
  }
  function setChip(k,txt){
    const b=$('#sysFilters [data-s="'+k+'"] .st'); if(b) b.textContent=txt;
  }
  $("#sysFilters").innerHTML=MSYS.map(s=>
    `<button class="chip" data-s="${s.k}" aria-pressed="${s.on}">${esc(s.n)}
      <span class="st tnum" style="opacity:.55;font-size:.78em"></span></button>`).join("");
  $("#sysFilters").onclick=e=>{
    const b=e.target.closest(".chip"); if(!b) return;
    const sy=MSYS.find(x=>x.k===b.dataset.s); if(!sy) return;
    sy.on = b.getAttribute("aria-pressed")!=="true";
    b.setAttribute("aria-pressed",String(sy.on));
    if(sy.on && !groups[sy.k]) load(sy);
    else if(groups[sy.k]) groups[sy.k].visible=sy.on;
  };
  MSYS.filter(s=>s.on).forEach(load);

  function resize(){
    const w=host.clientWidth,h=host.clientHeight;
    ren.setSize(w,h); cam.aspect=w/h; cam.updateProjectionMatrix();
  }
  addEventListener("resize",resize);

  // ramma inn thau kerfi sem eru synileg
  function fit(keys){
    const box=new THREE.Box3(); let any=false;
    (keys&&keys.length?keys:Object.keys(groups)).forEach(k=>{
      const g=groups[k]; if(g&&g.visible){ box.expandByObject(g); any=true; }
    });
    if(!any) return;
    const c=box.getCenter(new THREE.Vector3()), sz=box.getSize(new THREE.Vector3());
    const r=Math.max(sz.x,sz.y,sz.z)*0.62+0.06;
    const d=r/Math.tan(THREE.MathUtils.degToRad(cam.fov*0.5));
    ctr.target.copy(c);
    cam.position.set(c.x+d*0.34, c.y+d*0.16, c.z+d*0.92);
  }
  function show(keys){
    const want=new Set(keys||[]);
    MSYS.forEach(sy=>{
      sy.on = want.has(sy.k);
      const b=$('#sysFilters [data-s="'+sy.k+'"]');
      if(b) b.setAttribute("aria-pressed",String(sy.on));
      if(sy.on && !groups[sy.k]) load(sy);
      else if(groups[sy.k]) groups[sy.k].visible=sy.on;
    });
    // bida eftir thvi sem er ad hladast adur en rammad er inn
    let tries=0;
    (function waitFit(){
      const pending=[...want].some(k=>loading[k]);
      if(pending && tries++<80){ setTimeout(waitFit,150); return; }
      fit([...want]);
    })();
  }
  (function loop(){ requestAnimationFrame(loop); ctr.update(); ren.render(sc,cam); })();
  B={resize,show,fit,setSpin:v=>{ctr.autoRotate=v;}};
}



/* synir eitt baetiefni i thrividdarlikananu */
function showInBody(x){
  const keys = sysFor(x.parts.map(p=>p.key));
  $("#suppStage").hidden = false;
  mountStage($("#stageHost"));
  initBody();
  if(B) { B.setSpin(false); B.show(keys); }
  const miss = (x.parts||[]).filter(p=>!(PART2SYS[p.key]||[]).length);
  $("#suppInfo").innerHTML = `
    <p class="kicker">Í líkamanum</p>
    <h3 style="font-size:1.35rem;margin-block:6px 4px">${esc(x.name)}</h3>
    <p class="muted" style="margin-top:0">${esc(x.target)}</p>
    <div class="src" style="margin-block:12px">
      ${(x.parts||[]).map(p=>`<span class="tag${(PART2SYS[p.key]||[]).length?" inst":""}">${esc(p.name)} · ${p.n}</span>`).join("")}
    </div>
    <p style="font-size:.9rem;line-height:1.6;color:var(--ink2)">
      Kveikt er á þeim kerfum sem þessi líkamshlutar tilheyra:
      <b style="color:var(--gold)">${keys.map(k=>esc((MSYS.find(m=>m.k===k)||{}).n||k)).join(", ")}</b>.
      Dragðu til að snúa.</p>
    ${miss.length?`<div class="note" style="font-size:.85rem">
      <b>${miss.map(p=>esc(p.name)).join(", ")}</b> er ekki til sem möskvi í þessu gagnasafni, svo það sést ekki hér.</div>`:""}
    <p class="muted" style="font-size:.84rem">Tölurnar eru fjöldi búta úr uppskriftunum þar sem efnið og
      líkamshlutinn koma fyrir saman. Þær segja <b>hvar er rætt um efnið</b> - ekki að það hafi mælda verkun þar.</p>
    <p style="margin-top:14px"><button class="chip" id="suppClose">× loka</button></p>`;
  $("#suppClose").onclick=()=>{ $("#suppStage").hidden=true; };
  $("#suppStage").scrollIntoView({behavior:"smooth",block:"center"});
}

/* ---------- aðferð ---------- */
function buildMethod(){
  const vids=[...new Set(DATA.chapters.flatMap(c=>c.videos.map(v=>v.id)))];
  $("#v-adferd").innerHTML=`
  <p class="kicker">Hvað er mælt og hvað er teiknað</p>
  <h1 style="font-size:clamp(1.7rem,4vw,2.5rem);margin-block:8px 12px">Aðferð</h1>
  <p class="lede">Ef þú ætlar að treysta einhverju hér þarftu að vita hvernig það varð til. Þetta er sú síða.</p>

  <h3 style="font-size:1.2rem;margin-block:28px 6px">Gögnin</h3>
  <p>Unnið er úr <b>${num(DATA.episodeTotal)} þáttum</b> af Huberman Lab - <b>${num(DATA.wordTotal)} orðum</b> af uppskriftum.
  Unnið var úr <b>heilu uppskriftunum</b>, ekki úr samantektum eða punktum sem dregnir höfðu verið úr þeim.</p>
  <div class="note"><b>Uppskriftirnar eru sjálfvirkir myndatextar.</b> ${236} af ${num(DATA.episodeTotal)} þeirra hafa
  <b>engin greinarmerki og enga hástafi</b>. Þess vegna eru tilvitnanirnar lágstafa og renna saman.
  Ég snyrti þær ekki: ef ég setti inn punkta og kommur væri ég að ákveða hvar setningar enda, og það getur breytt merkingu.</div>

  <h3 style="font-size:1.2rem;margin-block:28px 6px">Hvernig samanburðurinn var fundinn</h3>
  <p>Af því að uppskriftirnar hafa engin greinarmerki er ekki hægt að skipta þeim í setningar.
  Í staðinn var leitað í <b>stafagluggum</b>: alls staðar þar sem <b>tala stendur inni í samanburðarorðalagi</b>
  - „40% meira en“, „þrisvar sinnum líklegri“, „50% lækkun samanborið við“.</p>
  <ul class="d-med">
    <li><b>${num(DATA.effectTotal)} staðir</b> stóðust þá kröfu.</li>
    <li>Þar sem orðin „rannsókn“, „tilraun“ eða „birt“ standa nálægt er merkt <span class="tag ok">rannsókn nefnd</span>.</li>
    <li>Þar sem stofnun er nefnd (Stanford, Harvard, Finnland …) er merkt <span class="tag inst">stofnun</span>.</li>
    <li><b>Auglýsingar kostunaraðila voru síaðar burt.</b> Huberman les inn langar auglýsingar og þær eru
      fullar af tölum sem líta út eins og vísindi. Þær eiga ekki heima hér.</li>
  </ul>

  <h3 style="font-size:1.2rem;margin-block:28px 6px">Hvað tölurnar segja ekki</h3>
  <div class="note"><b>Fylgni er ekki orsök.</b> Stór hluti þessara talna kemur úr rannsóknum sem fylgjast með hópum
  yfir tíma - ekki tilraunum. Að fólk sem fer oft í sauna fái síður heilabilun sannar ekki að saunan valdi því.
  Það getur líka verið að heilbrigðara fólk fari frekar í sauna.</div>
  <p class="d-med">Merkingin <span class="tag ok">rannsókn nefnd</span> þýðir aðeins að orðið kom fyrir í textanum
  í kringum fullyrðinguna. Hún þýðir ekki að ég hafi lesið rannsóknina, né að hún sé góð.</p>

  <h3 style="font-size:1.2rem;margin-block:28px 6px">Myndböndin</h3>
  <p><b>${vids.length} myndbönd</b> voru unnin í Blender á þessari vél. Möskvarnir eru úr
  <b>BodyParts3D 4.0</b> (CC BY 4.0) - raunverulegt líffærafræðilegt gagnasafn, ekki teiknaðar nálganir.
  Staðsetningar líffæranna eru lesnar úr hnitum möskvanna sjálfra.</p>
  <div class="note"><b>Það sem myndböndin eru ekki.</b> Þau eru ekki smásjármyndir og ekki mælingar.
  Glóandi kúlan sem ferðast er <b>skýringarmynd fyrir boð</b>. Birta sem vex stendur fyrir magn, ekki ljós.
  Tíminn er alls staðar þjappaður. Hver kafli segir nákvæmlega hvað er raunverulegt og hvað er teiknað.</div>
  <p class="d-high muted">Tæknilegt: EEVEE, 1280×720, 24 rammar/sek, 48 sýni á ramma, dithered gagnsæi.
  Hver sena er 8-15 mínútna renderun á staðnum.</p>

  <h3 style="font-size:1.2rem;margin-block:28px 6px">Líkanið</h3>
  <p>Þrívíddarsýnin og myndböndin nota <b>BodyParts3D 4.0</b> - karlkyns viðmiðunarlíkan byggt á TARO
  segulómun. Safnið telur 2.234 möskva: 402 vöðva, 639 slagæðar, 404 bláæðar, 296 bein, 139 taugabyggingar
  og fleira. Kvenlíkaminn er <b>HRA united-female v1.5</b>, 888 möskvar.</p>
  <div class="note"><b>Þetta er ekki „1:1 líkan af þér".</b> Skjölin sem fylgja líkaninu segja það beint:
  þetta er <b>hlutaafhending til myndbirtingar</b>, ekki staðfest 1:1 vísindalíkan og ekki endurgerð
  af tilteknum einstaklingi. Karl og kona eru <b>tveir ótengdir einstaklingar</b> úr sitthvoru gagnasafninu -
  ekki sami líkami í tveimur útgáfum. Kvenlíkaninu fylgja aðeins 4 vöðvamöskvar á móti 402 hjá karlinum.</p>
  <p class="d-med muted">Hæðarmörk mælast 1,73 m hjá karlinum og 1,67 m hjá konunni. Það eru mörk möskvanna,
  ekki staðfest líkamshæð. Engin hæðarstöðlun var gerð og upprunalegar stellingar haldast.</p>
  <p class="d-high muted">Æðakerfin eru einfölduð í 55% og kvenlíkaminn í 25% svo vafrinn ráði við þau.
  Hvert kerfi er sér skrá sem hleðst fyrst þegar kveikt er á henni.</p>

  <h3 style="font-size:1.2rem;margin-block:28px 6px">Það sem ekki tókst</h3>
  <p>Beiðnin var myndband í <b>hverjum kafla</b> - og það tókst fyrir alla tíu.
  En upphaflega hugmyndin um myndband fyrir <b>hvern þátt</b> gengur ekki upp:
  ${num(DATA.episodeTotal)} myndbönd á tíu mínútum hvert væru um <b>${Math.round(DATA.episodeTotal*10/60)} klukkustundir</b> af samfelldri renderun.</p>
  <p class="d-med">Kaflinn <b>Koffín</b> hefur aðeins 3 mældar áhrifastærðir. Það er ekki villa - það er
  einfaldlega hversu oft tala stendur inni í samanburði um koffín í þessum 300 þáttum.</p>

  <hr class="sep">
  <p class="muted"><b>Þetta er ekki læknisráðgjöf.</b> Ekkert hér á að nota til að breyta lyfjum, skömmtum
  eða meðferð. Slíkt á heima hjá lækni.</p>
  <p class="muted">Líffærafræði: <b>BodyParts3D</b>, © The Database Center for Life Science,
  <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>.
  Mitsuhashi o.fl. (2009). Kvenlíkami: HRA united-female v1.5.
  Vefaðlögun byggð á <a href="https://github.com/ashemag/human-atlas" target="_blank" rel="noopener">ashemag/human-atlas</a> (MIT).</p>
  `;
}


/* ---------- bætiefni ---------- */
/* hvada kerfi i likananu svarar hverjum likamshluta */
const PART2SYS = {
  vodvi:["vodvar","beinagrind"], heili:["taugar"], taugar:["taugar"],
  bein:["beinagrind"], hjarta:["hjarta","slagaedar"],
  thaermar:["melting"], blod:["slagaedar","blaaedar"],
  nyrnahettur:["hormonar","thvagfaeri"], svefn:["taugar"],
  hud:[]   // engin hud i gagnasafninu - vid latum sem hun se til
};
const PARTNAME = {vodvi:"vöðvi",heili:"heili",taugar:"taugar",bein:"bein",hjarta:"hjarta",
  thaermar:"þarmar",blod:"blóð",nyrnahettur:"nýrnahettur",svefn:"svefn",hud:"húð"};
function sysFor(parts){
  const out=[]; (parts||[]).forEach(p=>(PART2SYS[p]||[]).forEach(k=>{ if(!out.includes(k)) out.push(k); }));
  return out;
}

/* raunveruleg hnit reiknud ur moskvunum i Blender - ekki agiskud */
const BODYPTS=[
 ["Heili",0.4993,0.0956,"#b29eeb","L",0.09],
 ["Brjóstvöðvi",0.3831,0.2698,"#ffb84c","L",0.25],
 ["Nýrnahetta",0.4491,0.3592,"#ff9e38","L",0.37],
 ["Berkja",0.5397,0.2570,"#8fd9bf","R",0.21],
 ["Hjarta",0.5363,0.2782,"#ed858f","R",0.30],
 ["Smágirni",0.5070,0.4345,"#9ed6f2","R",0.43],
 ["Lærleggur",0.5996,0.6069,"#ccd1e0","R",0.59]
];
function bodyMap(){
  const W=430,H=540,IX=95,IY=14,IW=240,IH=493;
  const px=x=>IX+IW*x, py=y=>IY+IH*y;
  const lines=BODYPTS.map(([n,x,y,c,side,ly])=>{
    const bx = side==="L" ? 104 : 326, tx = side==="L" ? 88 : 342;
    return `<polyline points="${px(x).toFixed(1)},${py(y).toFixed(1)} ${bx},${(IY+IH*ly).toFixed(1)} ${tx},${(IY+IH*ly).toFixed(1)}"/>`;
  }).join("");
  const dots=BODYPTS.map(([n,x,y,c])=>`<circle cx="${px(x).toFixed(1)}" cy="${py(y).toFixed(1)}" r="3.6" fill="${c}"/>`).join("");
  const labs=BODYPTS.map(([n,x,y,c,side,ly])=>{
    const tx = side==="L" ? 84 : 346;
    return `<text x="${tx}" y="${(IY+IH*ly+4).toFixed(1)}" text-anchor="${side==="L"?"end":"start"}">${esc(n)}</text>`;
  }).join("");
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:430px;height:auto" role="img"
    aria-label="Renderuð mynd af raunverulegri líffærafræði með merktum svæðum">
    <image href="img/likami-merkt.png" x="${IX}" y="${IY}" width="${IW}" height="${IH}"/>
    <g stroke="var(--gold)" stroke-width="1" fill="none" opacity=".55">${lines}</g>
    <g>${dots}</g>
    <g font-family="Inter,system-ui,sans-serif" font-size="12" font-weight="500" fill="#dbe4f2">${labs}</g>
  </svg>`;
}

function suppCard(x){
  const tone = x.n>=38 ? "var(--good)" : x.n>=10 ? "var(--gold)" : "var(--ink3)";
  const q = x.quotes.slice(0, DENS[D].quote ? 4 : 2);
  return `<article class="card" style="border-left:3px solid ${tone}">
    <div style="display:flex;gap:14px;align-items:baseline">
      <h3 style="flex:1;margin:0">${esc(x.name)}</h3>
      <span class="tnum" style="font-family:var(--f-mono);font-size:1.15rem;color:${tone}">${num(x.n)}</span>
    </div>
    <p class="muted" style="margin:2px 0 10px">${esc(x.target)}</p>
    <div class="src" style="margin-bottom:10px">
      ${x.parts.map(p=>`<span class="tag">${esc(p.name)} · ${p.n}</span>`).join("")}
      ${x.evid?`<span class="tag ok">${x.evid} nefna rannsókn</span>`:""}
      ${x.neg?`<span class="tag" style="border-color:#6b4a2a;color:var(--gold)">${x.neg} efasemdir</span>`:""}
    </div>
    ${sysFor(x.parts.map(p=>p.key)).length?`<p style="margin:0 0 10px">
      <button class="chip" data-show="${esc(x.key)}">Sýna í líkamanum →</button></p>`:
      `<p class="muted" style="margin:0 0 10px">Húð er ekki til í þessu gagnasafni, svo þetta er ekki hægt að sýna í líkamanum.</p>`}
    ${x.n<=5?`<p class="muted" style="margin:0 0 10px"><b style="color:var(--ink2)">Nánast ekkert efni.</b> ${num(x.n)} ${x.n===1?"bútur fannst":"bútar fundust"} í öllum 300 þáttunum. Það er svarið.</p>`:""}
    ${q.length?`<details><summary>orðrétt · ${q.length} af ${num(x.n)}</summary><div class="body">
      ${q.map(c=>`<div class="quote">${esc(c.text)}</div>
        <p class="src" style="margin:-4px 0 14px">${esc(c.title)}
          ${c.evid?'<span class="tag ok">rannsókn</span>':''}
          ${c.neg?'<span class="tag" style="border-color:#6b4a2a;color:var(--gold)">efasemd</span>':''}</p>`).join("")}
    </div></details>`:""}
  </article>`;
}
function buildSupp(){
  const S=DATA.supplements||[];
  let PROTV=null;
  DATA.chapters.forEach(c=>c.videos.forEach(v=>{ if(v.id==="protein") PROTV=v; }));
  $("#v-baetiefni").innerHTML=`
  <p class="kicker">Fjórtán efni · sýnd á líkananu</p>
  <h1 style="font-size:clamp(1.7rem,4vw,2.5rem);margin-block:8px 12px">Bætiefni og líkaminn</h1>
  <p class="lede">Hvert efni er sett þar sem það kemur oftast fyrir í uppskriftunum. Talan er fjöldi búta sem fundust - hún mælir <b>hversu mikið er rætt um efnið</b>, ekki hvort það virkar.</p>

  ${PROTV?videoBlock(PROTV,""):""}

  <div class="note" style="margin-block:18px">
    <b>Engir skammtar.</b> Ég síaði skammtaleiðbeiningar og persónuleg prógrömm burt úr textanum viljandi.
    Fæðubótarefni geta haft áhrif á lyfseðilsskyld lyf - sú spurning á heima hjá lækni eða lyfjafræðingi.
  </div>

  <div id="suppStage" hidden style="margin-block:22px">
    <div class="grid" style="grid-template-columns:minmax(0,1.25fr) minmax(240px,1fr);gap:20px;align-items:start">
      <div id="stageHost"></div>
      <div id="suppInfo"></div>
    </div>
  </div>

  <div class="filters" id="suppSort">
    <button class="chip" data-s="n" aria-pressed="true">Eftir umfjöllun</button>
    <button class="chip" data-s="evid">Eftir rannsóknum</button>
    <button class="chip" data-s="name">Í stafrófsröð</button>
  </div>
  <div class="grid g2" id="suppList" style="align-items:start"></div>

  <div class="d-med" style="margin-top:26px">
    <div class="note"><b>Mikið rætt er ekki það sama og virkar.</b>
    Kollagen er efst á listanum með flest bútana - og um leið flestar efasemdir í textanum.
    Grænt duft er neðst með einn bút úr 6,1 milljón orðum.</div>
  </div>`;
  const list=$("#suppList");
  let mode="n";
  const draw=()=>{
    const r=S.slice().sort((a,b)=> mode==="name" ? a.name.localeCompare(b.name,"is")
      : mode==="evid" ? (b.evid-a.evid)||(b.n-a.n) : b.n-a.n);
    list.innerHTML=r.map(suppCard).join(""); armGraphs(list);
  };
  list.addEventListener("click",e=>{
    const b=e.target.closest("[data-show]"); if(!b) return;
    const x=S.find(v=>v.key===b.dataset.show); if(!x) return;
    showInBody(x);
  });

  $("#suppSort").onclick=e=>{
    const b=e.target.closest(".chip"); if(!b) return;
    mode=b.dataset.s;
    $$("#suppSort .chip").forEach(x=>x.setAttribute("aria-pressed",String(x===b)));
    draw();
  };
  draw();
  armVideos($("#v-baetiefni"));
}
