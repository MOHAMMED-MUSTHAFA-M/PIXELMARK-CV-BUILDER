const STANDARD = ["profile summary","summary","professional experience","experience","skills","education","certifications","languages","projects","contact"];
const ACTIONS = ["managed","coordinated","implemented","developed","analyzed","performed","created","improved","supported","processed","documented","led","organized","resolved","conducted","delivered","maintained","optimized","monitored","assessed","proposed","designed","built","executed"];

function flatten(cv) {
  return [
    cv.summary,
    ...cv.skills.flatMap(s => [s.category, ...s.items]),
    ...cv.experience.flatMap(e => [e.title,e.company,e.location,e.start,e.end,...e.bullets]),
    ...cv.projects.flatMap(p => [p.name,p.description,...p.technologies]),
    ...cv.education.flatMap(e => [e.degree,e.institution,e.location,e.start,e.end,e.description]),
    ...cv.certifications.flatMap(c => [c.name,c.issuer,c.date]),
    ...cv.languages.flatMap(l => [l.language,l.proficiency])
  ].join(" ");
}
function wordCount(text) { return text.trim().split(/\s+/).filter(Boolean).length; }
function keywords(text) {
  const stop = new Set("the and for with from into that this your their our are was were have has had to of in on at by as an a or be is it its".split(" "));
  const m = text.toLowerCase().match(/[a-z0-9+#.-]+/g) || [];
  const c = {}; m.forEach(w => { if(w.length > 2 && !stop.has(w)) c[w]=(c[w]||0)+1; });
  return Object.entries(c).sort((a,b)=>b[1]-a[1]).slice(0,50).map(([w])=>w);
}

function analyzeATS(cv, jobText = "") {
  const text = flatten(cv);
  const results = [];
  let score = 0;

  const contact = [cv.personal.fullName, cv.personal.email, cv.personal.phone, cv.personal.location].filter(Boolean).length;
  const contactPts = Math.round((contact / 4) * 10);
  score += contactPts;
  results.push({ label:"Contact information", points:contactPts, max:10, ok:contact >= 3, detail: contact >= 3 ? "Core contact fields are present." : "Add missing name, email, phone, or location." });

  const sections = ["summary","skills","experience","education","certifications","languages"].map(k => cv[k] ?? null);
  const sectionPts = Math.round((sections.filter(Boolean).length / sections.length) * 10);
  score += sectionPts;
  results.push({ label:"Section structure", points:sectionPts, max:10, ok:sectionPts >= 8, detail:"Standard resume sections are represented in structured data." });

  const nonEmpty = cv.experience.length + cv.skills.length + cv.education.length + cv.certifications.length;
  const contentPts = Math.min(15, Math.round(nonEmpty / 2));
  score += contentPts;
  results.push({ label:"Content completeness", points:contentPts, max:15, ok:contentPts >= 10, detail: nonEmpty ? "Core professional content is populated." : "Add experience, skills, education, or certifications." });

  const bullets = cv.experience.flatMap(e => e.bullets);
  const withAction = bullets.filter(b => ACTIONS.some(v => b.trim().toLowerCase().startsWith(v))).length;
  const actionPts = bullets.length ? Math.round((withAction / bullets.length) * 10) : 0;
  score += actionPts;
  results.push({ label:"Action-oriented bullets", points:actionPts, max:10, ok:actionPts >= 6, detail:`${withAction} of ${bullets.length} bullets begin with a recognized action verb.` });

  const formatSafe = cv.personal.email && cv.personal.phone && cv.experience.every(e => e.title && e.company && e.bullets.length);
  const formatPts = formatSafe ? 10 : 5;
  score += formatPts;
  results.push({ label:"Formatting safety", points:formatPts, max:10, ok:formatSafe, detail:"Pixelmark templates use semantic headings, lists, selectable text, and conventional reading order." });

  const keywordPts = Math.min(20, Math.round(keywords(text).length * 0.4));
  score += keywordPts;
  results.push({ label:"Keyword coverage", points:keywordPts, max:20, ok:keywordPts >= 12, detail:"Calculated from distinct meaningful terms in the current CV; not an external ATS vendor score." });

  const readabilityPts = wordCount(text) >= 250 ? 10 : 6;
  score += readabilityPts;
  results.push({ label:"Readability/content density", points:readabilityPts, max:10, ok:readabilityPts >= 8, detail:`Current CV contains about ${wordCount(text)} words.` });

  const linksPts = (cv.personal.linkedin || cv.personal.github || cv.personal.portfolio) ? 5 : 2;
  score += linksPts;
  results.push({ label:"Professional links", points:linksPts, max:5, ok:linksPts >= 5, detail:"LinkedIn, GitHub, or portfolio links can improve machine-readable contact context when applicable." });

  const dateConsistency = cv.experience.every(e => e.start && e.end);
  const datePts = dateConsistency ? 5 : 3;
  score += datePts;
  results.push({ label:"Date completeness", points:datePts, max:5, ok:dateConsistency, detail: dateConsistency ? "Experience dates are populated." : "Some date fields may be incomplete in the source CV." });

  const job = (jobText || "").toLowerCase();
  const cvText = text.toLowerCase();
  const jobTerms = [...new Set((job.match(/[a-z0-9+#.-]{3,}/g) || []).filter(x => !["the","and","for","with","from","into","that","this","are","you","your","our"].includes(x)))];
  const matched = jobTerms.filter(k => cvText.includes(k));
  const match = jobTerms.length ? Math.round((matched.length / jobTerms.length) * 100) : null;

  return {
    score: Math.min(100, score),
    results,
    jobMatch: match,
    matchedKeywords: matched.slice(0,50),
    missingKeywords: jobTerms.filter(k => !cvText.includes(k)).slice(0,50)
  };
}
window.analyzeATS=analyzeATS;
