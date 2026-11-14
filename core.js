// Scoring + a small RAG pipeline. Plain JS, no dependencies, runs in the browser and in Node.
const _D = (typeof module !== "undefined") ? require("./data.js") : { REELS, KB, CTA_WORDS };
const HOURS = 72;
const WEIGHTS = { velocity:.25, share:.20, spread:.20, cta:.20, unverified:.15 };   // assumptions, to be tuned on real data
const T = { watch:40, mobilizing:65, severe:80 };                                    // assumptions, to be tuned on real data

function rng(seed){ let s = seed>>>0; return () => ((s = Math.imul(s,1664525)+1013904223>>>0)/4294967296); }
const sig = x => 1/(1+Math.exp(-x));
const clamp = (x,a=0,b=1) => Math.min(b,Math.max(a,x));
function hash(str){ let h=2166136261; for(const c of str){ h^=c.charCodeAt(0); h=Math.imul(h,16777619);} return h>>>0; }

function simulate(r){
  const R = rng(hash(r.id)), views=[], shares=[], states=[];
  for(let t=0;t<HOURS;t++){
    const lift = 1 + (r.surge.peak-1)*sig((t-r.surge.s)/r.surge.w);
    const v = Math.round(r.typical*lift*(0.9+0.2*R()));
    const ratio = r.share.base + (r.share.surge-r.share.base)*sig((t-r.surge.s)/r.surge.w);
    views.push(v); shares.push(Math.round(v*ratio));
    states.push(Math.round(r.states.s0 + (r.states.smax-r.states.s0)*sig((t-r.states.s)/r.states.w)));
  }
  return { views, shares, states };
}
function ctaCount(caption){ const c = caption.toLowerCase(); return _D.CTA_WORDS.filter(w=>c.includes(w)).length; }

function signalsAt(r, sim, h){            // h = hours since upload (1..72); uses data up to hour h
  const i = Math.min(h,HOURS)-1, a = Math.max(0,i-2);
  const recent = sim.views.slice(a,i+1).reduce((x,y)=>x+y,0)/(i-a+1);
  const ratioVel = recent / r.typical;
  const w6 = Math.max(0,i-5);
  const v6 = sim.views.slice(w6,i+1).reduce((x,y)=>x+y,0), s6 = sim.shares.slice(w6,i+1).reduce((x,y)=>x+y,0);
  const shareRatio = s6/Math.max(1,v6);
  const newStates = sim.states[i] - (w6>0 ? sim.states[w6-1] : sim.states[0]);
  const cta = ctaCount(r.caption);
  const unverified = (r.claim && r.verified===false) ? 1 : 0;
  const parts = {
    velocity: clamp(Math.log10(Math.max(1,ratioVel))/2),
    share: clamp(shareRatio/0.12),
    spread: clamp(newStates/10),
    cta: clamp(cta/3),
    unverified,
  };
  // Content cues (call to action, unverified claim) only count once the reel is actually growing fast.
  const dyn = (WEIGHTS.velocity*parts.velocity + WEIGHTS.share*parts.share + WEIGHTS.spread*parts.spread) / (WEIGHTS.velocity+WEIGHTS.share+WEIGHTS.spread);
  const content = (WEIGHTS.cta*parts.cta + WEIGHTS.unverified*parts.unverified) / (WEIGHTS.cta+WEIGHTS.unverified);
  const dw = WEIGHTS.velocity+WEIGHTS.share+WEIGHTS.spread, gate = clamp(dyn/0.4);
  const score = dw*dyn + (1-dw)*content*gate;
  return { score: Math.round(score*100), parts, raw:{ ratioVel, shareRatio, newStates, cta, statesNow: sim.states[i] } };
}
function rungFor(score, r){
  const verified = r.verified===true, unverified = r.claim && r.verified===false;
  if(score < T.watch)      return { rung:0, label:"Ordinary virality: no action" };
  if(verified)             return { rung:0, label:"Verified civic mobilization: monitor, do not demote" };
  if(!unverified)          return { rung:0, label:"Fast but no unverified claim: monitor" };
  if(score < T.mobilizing) return { rung:1, label:"Rung 1: slow the boost" };
  if(score < T.severe)     return { rung:3, label:"Rungs 2 + 3: context label and priority human review" };
  return { rung:4, label:"Rungs 2 + 3 + 4: label, review, propose time-boxed boost hold (human approves)" };
}
function scoreCurve(r, sim){ return Array.from({length:HOURS},(_,i)=>signalsAt(r,sim,i+1).score); }
function firstCross(curve, thr){ const i = curve.findIndex(s=>s>=thr); return i<0 ? null : i+1; }

// ---------- RAG ----------
const STOP = new Set("a an the of to in on and or is are be it this that for with as at by from not no can must may such so if than then into their its was were has have had will who which they them we our you your".split(" "));
const tok = s => s.toLowerCase().replace(/[^a-z0-9 ]+/g," ").split(/\s+/).filter(w=>w&&!STOP.has(w));
function chunkText(text, size=55, overlap=12){
  const w = text.split(/\s+/), out=[]; let i=0;
  while(i<w.length){ out.push(w.slice(i,i+size).join(" ")); if(i+size>=w.length) break; i += size-overlap; }
  return out;
}
function buildIndex(kb=_D.KB, size=55, overlap=12){
  const chunks=[]; kb.forEach(d=>chunkText(d.text,size,overlap).forEach((t,k)=>chunks.push({ doc:d.id, title:d.title, n:k+1, text:t, toks:tok(d.title+" "+t) })));
  const df={}; chunks.forEach(c=>new Set(c.toks).forEach(w=>df[w]=(df[w]||0)+1));
  const N=chunks.length, idf=w=>Math.log(1+N/(1+(df[w]||0)));
  const vec = toks => { const tf={}; toks.forEach(w=>tf[w]=(tf[w]||0)+1); const v={}; let n=0; for(const w in tf){ v[w]=(1+Math.log(tf[w]))*idf(w); n+=v[w]*v[w]; } n=Math.sqrt(n)||1; for(const w in v) v[w]/=n; return v; };
  chunks.forEach(c=>c.vec=vec(c.toks));
  return { chunks, vec };
}
function retrieve(index, query, k=3){
  const q = index.vec(tok(query));
  const res = index.chunks.map(c=>{ let s=0; for(const w in q) if(c.vec[w]) s+=q[w]*c.vec[w]; return { ...c, score:s }; });
  const seen=new Set(), out=[];                       // best chunk per policy document
  for(const c of res.sort((a,b)=>b.score-a.score)){ if(!seen.has(c.doc)){ seen.add(c.doc); out.push(c);} if(out.length===k) break; }
  return out;
}
function queryFor(r, sig){
  const bits=[r.caption, r.claim||"", r.kind];
  if(sig.raw.cta) bits.push("call to action gather crowd");
  if(r.verified===false) bits.push("unverified claim label human review amplification ladder");
  if(r.verified===true) bits.push("verified civic mobilization allowed do not demote");
  if(/share before/i.test(r.caption)) bits.push("urgency share before deleted");
  return bits.join(" ");
}

// ---------- Prompt harness ----------
const SYSTEM_PROMPT = `IDENTITY: You are the Mobilization Triage Assistant for PulseReel's trust and safety reviewers.
TASK AND LIMITS: Write a short reviewer brief for one flagged reel using ONLY the SIGNALS and POLICY CONTEXT provided. Never say a claim is false; say it is unverified. Never recommend deleting a reel or blocking a creator. Recommend only a rung from the ladder in the policy context. Cite policy ids in square brackets. If the policy context does not cover the case, reply exactly: INSUFFICIENT CONTEXT, ESCALATE TO HUMAN.
STYLE: Neutral, factual, no emotive words. Use exactly these headings: What we see / Why it is flagged / Recommended rung / What the reviewer should check. Maximum 150 words.
AUDIENCE: A busy human reviewer who makes the final decision.`;
const DEFAULT_PARAMS = { temperature:0.2, top_p:0.8, max_tokens:300 };
function buildMessages(r, s, ctx, rung){
  const sigTxt = `velocity ${s.raw.ratioVel.toFixed(0)}x typical; share ratio ${(s.raw.shareRatio*100).toFixed(1)}%; ${s.raw.statesNow} states reached (${s.raw.newStates} new in 6h); call-to-action cues ${s.raw.cta}; verified source: ${r.verified===false?"none":r.verified?"yes":"not applicable"}; mobilization score ${s.score}/100; system-suggested action: ${rung.label}`;
  const ctxTxt = ctx.map((c,i)=>`[${c.doc}] ${c.title}: ${c.text}`).join("\n");
  return [
    { role:"system", content:SYSTEM_PROMPT },
    { role:"user", content:`REEL CAPTION: "${r.caption}"\nCLAIM: ${r.claim||"none"}\nSIGNALS: ${sigTxt}\n\nPOLICY CONTEXT:\n${ctxTxt}` },
  ];
}
function fallbackBrief(r, s, ctx, rung){
  if(!ctx.length || ctx[0].score < 0.08) return "INSUFFICIENT CONTEXT, ESCALATE TO HUMAN.";
  const ids = ctx.map(c=>`[${c.doc}]`).join(" ");
  return [
   `What we see: a reel growing ${s.raw.ratioVel.toFixed(0)}x above the creator's usual reach, with a ${(s.raw.shareRatio*100).toFixed(1)}% share ratio and spread to ${s.raw.statesNow} states. ${r.claim?`It reports: "${r.claim}". `:""}${s.raw.cta? `It contains ${s.raw.cta} call-to-action cue(s). `:""}`,
   `Why it is flagged: mobilization score ${s.score}/100. ${r.verified===false?"No verified source is attached to the claim.":r.verified?"The claim comes from a verified institution.":"No factual claim is made."} ${ids}`,
   `Recommended rung: ${rung.label}.`,
   `What the reviewer should check: ${r.verified===false?"confirm the event with local news desks or official handles; check the creator's history; approve, edit or reject the suggested rung.":"confirm the source is current; no demotion is suggested."}`,
  ].join("\n\n") + "\n\n(Template brief: generated by rules, not by a model.)";
}
const CORE = { REELS:_D.REELS, KB:_D.KB, HOURS, WEIGHTS, T, simulate, signalsAt, rungFor, scoreCurve, firstCross, buildIndex, retrieve, queryFor, chunkText, SYSTEM_PROMPT, DEFAULT_PARAMS, buildMessages, fallbackBrief };
if (typeof module !== "undefined") module.exports = CORE;
