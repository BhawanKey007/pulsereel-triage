const $ = id => document.getElementById(id);
const sims = {}, curves = {};
CORE.REELS.forEach(r => { sims[r.id] = CORE.simulate(r); curves[r.id] = CORE.scoreCurve(r, sims[r.id]); });
const index = CORE.buildIndex();
let sel = "r6";
$("idxinfo").textContent = `${CORE.KB.length} documents, ${index.chunks.length} chunks`;
$("idxdetail").textContent = "Indexing: documents are split into 55-word chunks with a 12-word overlap, turned into TF-IDF vectors and stored in memory. Retrieval embeds the query the same way and ranks chunks by cosine similarity, keeping the best chunk per policy document. A neural embedding model can replace the TF-IDF step later.";
$("mode").textContent = WORKER_URL ? "Brief: model via Worker, template fallback" : "Brief: template (no Worker set)";
const colour = s => s >= CORE.T.mobilizing ? "#E11D48" : s >= CORE.T.watch ? "#F59E0B" : "#059669";
const hour = () => +$("hour").value;

function renderList(){
  const h = hour();
  const rows = CORE.REELS.map(r => ({ r, s: CORE.signalsAt(r, sims[r.id], h) })).sort((a,b) => b.s.score - a.s.score);
  $("list").innerHTML = rows.map(({r,s}) => `<div class="reel ${r.id===sel?"on":""}" data-id="${r.id}"><div class="sc" style="background:${colour(s.score)}">${s.score}</div><div><b>${r.title}</b><small>${r.kind}</small></div></div>`).join("");
  document.querySelectorAll(".reel").forEach(e => e.onclick = () => { sel = e.dataset.id; render(); });
}
function chart(r){
  const c = curves[r.id], W=640, H=190, p=28, x = i => p + i*(W-2*p)/71, y = v => H-p - v*(H-2*p)/100;
  const h = hour(), line = c.map((v,i)=>`${i?"L":"M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const th = (v,l,col) => `<line x1="${p}" x2="${W-p}" y1="${y(v)}" y2="${y(v)}" stroke="${col}" stroke-dasharray="4 4"/><text x="${W-p}" y="${y(v)-3}" font-size="10" text-anchor="end" fill="${col}">${l}</text>`;
  return `<svg viewBox="0 0 ${W} ${H}">${th(CORE.T.mobilizing,"mobilizing 65","#E11D48")}${th(CORE.T.watch,"watch 40","#F59E0B")}
  <path d="${line}" fill="none" stroke="#5B3DF5" stroke-width="2.5"/>
  <line x1="${x(h-1)}" x2="${x(h-1)}" y1="${p-8}" y2="${H-p}" stroke="#6B7280"/><circle cx="${x(h-1)}" cy="${y(c[h-1])}" r="5" fill="#5B3DF5"/>
  <text x="${p}" y="${H-8}" font-size="10" fill="#6B7280">hour 1</text><text x="${W-p}" y="${H-8}" font-size="10" text-anchor="end" fill="#6B7280">hour 72</text></svg>`;
}
function render(){
  const r = CORE.REELS.find(x => x.id===sel), h = hour(), s = CORE.signalsAt(r, sims[r.id], h), g = CORE.rungFor(s.score, r);
  $("hh").textContent = h; $("title").innerHTML = `<b>${r.title}</b> ${r.creator}`;
  $("chart").innerHTML = chart(r);
  const c65 = CORE.firstCross(curves[r.id], CORE.T.mobilizing);
  $("lead").textContent = c65 ? `Score first reaches ${CORE.T.mobilizing} at hour ${c65}. ${r.verified===false?`That is ${72-c65} hours before the 72-hour mark in the brief.`:"This reel is verified, so crossing the line does not trigger demotion."}` : "Score never reaches the mobilizing threshold.";
  $("big").innerHTML = `<span style="color:${colour(s.score)}">${s.score}</span><span style="font-size:16px;color:var(--mut)"> / 100</span>`;
  const rows = [["Growth vs creator's usual reach", `${s.raw.ratioVel.toFixed(0)}x`, s.parts.velocity], ["Share ratio (last 6h)", `${(s.raw.shareRatio*100).toFixed(1)}%`, s.parts.share],
    ["New states reached (6h)", `${s.raw.newStates} (total ${s.raw.statesNow})`, s.parts.spread], ["Call-to-action cues", s.raw.cta, s.parts.cta], ["Unverified claim", r.claim ? (r.verified===false?"yes":"no, verified") : "no claim", s.parts.unverified]];
  $("signals").innerHTML = rows.map(([n,v,p]) => `<div class="row"><span>${n}</span><b style="color:var(--ink)">${v}</b></div><div class="bar"><i style="width:${Math.round(p*100)}%"></i></div>`).join("");
  const names = ["1 Slow boost","2 Context label","3 Human review","4 Boost hold*"];
  const active = [g.rung>=1, g.rung>=3, g.rung>=3, g.rung>=4];
  $("ladder").innerHTML = names.map((n,i)=>`<div class="rung ${active[i]?"on":""}">${n}</div>`).join("");
  if(g.rung===0 && s.score>=CORE.T.watch) $("ladder").insertAdjacentHTML("afterend","");
  $("rungtxt").textContent = g.label + "  (*needs human approval)";
  const q = CORE.queryFor(r, s), ctx = CORE.retrieve(index, q, 3); window._ctx = ctx;
  $("ctx").innerHTML = ctx.map(c=>`<div class="chunk"><b>[${c.doc}] ${c.title}</b> · similarity ${c.score.toFixed(2)}<br>${c.text.slice(0,210)}…</div>`).join("");
  window._m = CORE.buildMessages(r, s, ctx, g); $("prompt").textContent = `[system]\n${window._m[0].content}\n\n[user]\n${window._m[1].content}`;
  $("brief").textContent = "Press Generate brief."; $("status").textContent = "";
  renderList();
}
["temp","topp","maxt"].forEach(id => $(id).oninput = upd); function upd(){ $("tv").textContent=$("temp").value; $("pv").textContent=$("topp").value; $("mv").textContent=$("maxt").value; } upd();
$("hour").oninput = render;
$("gen").onclick = async () => {
  const r = CORE.REELS.find(x=>x.id===sel), s = CORE.signalsAt(r, sims[r.id], hour()), g = CORE.rungFor(s.score, r), ctx = window._ctx;
  const params = { temperature:+$("temp").value, top_p:+$("topp").value, max_tokens:+$("maxt").value };
  $("gen").disabled = true; $("status").textContent = "Generating…";
  let text = null, via = "template";
  if (WORKER_URL && ctx.length && ctx[0].score >= 0.08) {
    try { const ac = new AbortController(); setTimeout(()=>ac.abort(), 12000);
      const res = await fetch(WORKER_URL, { method:"POST", headers:{ "Content-Type":"application/json" }, signal:ac.signal, body:JSON.stringify({ messages:window._m, ...params }) });
      const j = await res.json(); if (j.text) { text = j.text; via = "model via Worker"; } } catch(e) { via = "template (Worker unreachable)"; }
  }
  if (!text) text = CORE.fallbackBrief(r, s, ctx, g);
  $("brief").textContent = text; $("status").textContent = `Source: ${via} · temperature ${params.temperature}, top-p ${params.top_p}, max tokens ${params.max_tokens}`;
  $("gen").disabled = false;
};
render();
