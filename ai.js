const ACTION_VERBS = ["managed","coordinated","implemented","developed","analyzed","performed","created","improved","supported","processed","documented","led","organized","resolved","conducted","delivered","maintained","optimized","monitored","assessed","proposed","designed","built","executed"];

function words(text) { return (text || "").toLowerCase().match(/[a-z0-9+#.-]+/g) || []; }
function unique(arr) { return [...new Set(arr)]; }

window.LocalAIService = {
  improveSummary(text) {
    const clean = (text || "").replace(/\s+/g, " ").trim();
    if (!clean) return "";
    const sentences = clean.split(/(?<=[.!?])\s+/).filter(Boolean);
    return sentences.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(" ");
  },
  shorten(text, maxWords = 75) {
    const ws = (text || "").split(/\s+/).filter(Boolean);
    return ws.length <= maxWords ? text : ws.slice(0, maxWords).join(" ") + "…";
  },
  expand(text) {
    const clean = (text || "").trim();
    return clean ? `${clean} Demonstrates practical application of relevant skills, attention to detail, and a results-focused approach.` : clean;
  },
  addActionVerb(text) {
    const clean = (text || "").trim();
    if (!clean) return clean;
    const first = clean.split(/\s+/)[0].toLowerCase();
    if (ACTION_VERBS.includes(first)) return clean;
    return `Managed ${clean.charAt(0).toLowerCase()}${clean.slice(1)}`;
  },
  extractKeywords(text) {
    const stop = new Set("the and for with from into that this your their our are was were have has had to of in on at by as an a or be is it its".split(" "));
    const counts = {};
    words(text).forEach(w => { if (w.length > 2 && !stop.has(w)) counts[w] = (counts[w] || 0) + 1; });
    return Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0, 30).map(([word]) => word);
  },
  improveBullet(text) {
    const t = (text || "").trim();
    if (!t) return t;
    const verb = this.addActionVerb(t);
    return verb.length > 180 ? this.shorten(verb, 32) : verb;
  },
  suggestSkills(cv, jobText = "") {
    const source = `${jobText} ${cv.summary} ${cv.experience.map(e => e.bullets.join(" ")).join(" ")} ${cv.skills.flatMap(s => s.items).join(" ")}`;
    return this.extractKeywords(source).filter(k => k.length > 3).slice(0, 12);
  }
};