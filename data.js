// All data below is SIMULATED for this exercise. No real users, reels or incidents.
const REELS = [
  { id:"r6", title:"“Police action at Riverside Chowk”", creator:"@citywatch_live", kind:"Unverified incident",
    caption:"Heard shots near Riverside Chowk. Police lathi-charging students. Everyone gather at the Chowk at 6pm, share before they delete this!",
    claim:"Police used force on students at Riverside Chowk", verified:false, typical:500,
    surge:{s:14,w:3,peak:150}, share:{base:.03,surge:.16}, states:{s0:1,smax:18,s:15,w:3} },
  { id:"r7", title:"“Exam paper leaked, share before it's removed”", creator:"@examtalk", kind:"Unverified rumour",
    caption:"Paper already out on a Telegram group. Share before they delete this and sign the petition tonight.",
    claim:"State exam paper leaked before the exam", verified:false, typical:700,
    surge:{s:40,w:5,peak:20}, share:{base:.03,surge:.12}, states:{s0:2,smax:9,s:40,w:6} },
  { id:"r5", title:"Blood donation camp at City Hospital", creator:"@cityhospital_official", kind:"Verified civic mobilization",
    caption:"Join us this Sunday, 10am at City Hospital. Blood donation camp. Everyone can come, bring ID.",
    claim:"Hospital-run blood donation camp on Sunday", verified:true, typical:900,
    surge:{s:22,w:5,peak:30}, share:{base:.03,surge:.10}, states:{s0:2,smax:8,s:22,w:6} },
  { id:"r4", title:"Campus fee hike: students speak", creator:"@campusvoice", kind:"Contested local issue",
    caption:"Fees up 40% this year. Sign this petition, tell your college to respond.",
    claim:"College raised fees by 40%", verified:false, typical:600,
    surge:{s:30,w:5,peak:25}, share:{base:.03,surge:.09}, states:{s0:1,smax:4,s:30,w:6} },
  { id:"r1", title:"Hostel dance challenge", creator:"@dance.dorm", kind:"Ordinary viral",
    caption:"New steps, new beat. Try it with your hostel gang!",
    claim:null, verified:null, typical:800,
    surge:{s:20,w:4,peak:60}, share:{base:.03,surge:.05}, states:{s0:4,smax:14,s:20,w:5} },
  { id:"r2", title:"Match-day catch compilation", creator:"@cricket_clips", kind:"Ordinary viral",
    caption:"Top ten catches from last night's game.",
    claim:null, verified:null, typical:1200,
    surge:{s:18,w:4,peak:40}, share:{base:.03,surge:.04}, states:{s0:5,smax:12,s:18,w:5} },
  { id:"r8", title:"Hostel mess comedy skit", creator:"@mess_stories", kind:"Ordinary",
    caption:"Rajma again?", claim:null, verified:null, typical:700,
    surge:{s:26,w:5,peak:12}, share:{base:.02,surge:.03}, states:{s0:2,smax:5,s:26,w:6} },
  { id:"r3", title:"₹50 street-food recipe", creator:"@thelastbench", kind:"Ordinary",
    caption:"Easy pav bhaji at home.", claim:null, verified:null, typical:500,
    surge:{s:30,w:6,peak:8}, share:{base:.02,surge:.025}, states:{s0:2,smax:3,s:30,w:6} },
];

// Illustrative internal policy library (written for this exercise, not real PulseReel or legal text).
const KB = [
 { id:"POL-1", title:"Amplification response ladder", text:
  "PulseReel treats fast-mobilizing content differently from ordinary viral content. The response ladder has four rungs. Rung 1 slows the recommendation boost without removing the reel. Rung 2 adds a context label that says the claim is unverified. Rung 3 sends the reel to priority human review. Rung 4 is a time-boxed hold on algorithmic boost, proposed by the system and approved by a human reviewer. No rung deletes a reel or blocks the creator from posting or sharing. Every rung is logged with the signals that triggered it." },
 { id:"POL-2", title:"Unverified incident claims", text:
  "A reel that reports a live incident, such as police action, violence or a disaster, and carries no verified source is treated as an unverified incident claim. The system must not state that the claim is false. It must state that the claim is unverified and show the verified sources checked. Human reviewers confirm the claim using local news desks, official handles and fact-check partners. If confirmation is not available within two hours, the label stays and the boost hold is extended in two hour steps." },
 { id:"POL-3", title:"Verified civic mobilization is allowed", text:
  "Calls to gather that come from verified institutions such as hospitals, universities and election bodies are ordinary civic content. They must not be slowed or labelled as unverified. The system monitors them and may pin the official source. A high mobilization score alone is never a reason for demotion. The reason must be a high score together with an unverified claim." },
 { id:"POL-4", title:"Context label wording", text:
  "Labels must be neutral and factual. Approved wording: This video describes an event that has not been verified yet. We are checking with local sources. Labels must not use words such as fake, hoax or misleading unless a fact-check partner has rated the claim. Labels link to the verified updates page and must be shown in the language of the reel." },
 { id:"POL-5", title:"Human review service levels", text:
  "Priority human review is staffed around the clock for mobilization alerts. A reviewer sees the reel, the signals that fired, the retrieved policy and a drafted brief, and decides. Target time to first decision is thirty minutes. Reviewers can approve, edit or reject the suggested rung. The drafted brief is advice and never an action on its own." },
 { id:"POL-6", title:"Appeals and transparency", text:
  "Creators are told within one hour when a rung was applied to their reel and why. They can appeal to a different reviewer, who decides within twenty four hours. PulseReel publishes a monthly transparency report with the count of reels at each rung, the share later verified as accurate, the share of rung 4 holds reversed on appeal and the median time to first decision." },
 { id:"PLAY-1", title:"Playbook: crowd call-to-action reels", text:
  "A reel that names a place and a time and asks viewers to gather is a crowd call-to-action. Combine this with fast growth, a high share ratio and spread across many states within hours. These four signals together, with no verified source, are the strongest early warning. Check the creator history. A new or small creator whose reach multiplies a hundred times in a few hours needs review before the next surge." },
 { id:"PLAY-2", title:"Playbook: share-before-deleted urgency", text:
  "Phrases that push viewers to share urgently, such as share before they delete this, raise the share ratio artificially. Treat urgency phrases as a signal. They are not proof of bad intent. Pair them with source checks. If the claim is later verified, the label is removed and the boost is restored with the original reach credited." },
 { id:"SAFE-1", title:"Safeguards for young audiences", text:
  "The audience is mostly 18 to 25. During a rung 2 or rung 3 event, the app shows a verified updates card to viewers who open the reel. Notifications about the reel are paused until review completes. Location and contact details of private individuals shown in a reel are blurred if a reviewer finds they put someone at risk." },
 { id:"REG-1", title:"Regulator-ready audit trail", text:
  "Each rung decision is stored with the time, the signal values, the retrieved policy ids, the drafted brief, the reviewer and the outcome. The audit log can be exported for a regulator. The model settings used for the brief, such as temperature and maximum tokens, are stored with each draft so that results can be reproduced." },
];
const CTA_WORDS = ["gather","assemble","come to","everyone","join us","protest","march","share before","sign this","sign the","petition","tonight","at 6pm","this sunday"];
if (typeof module !== "undefined") module.exports = { REELS, KB, CTA_WORDS };
