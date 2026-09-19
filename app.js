
const {saveDraft,getDraft,listDrafts,deleteDraft,saveFileRecord,listFiles,getFileRecord,deleteFileRecord,saveSetting,getSetting}=window.PixelStorage;
const {LocalAIService}=window;
const {TEMPLATES}=window;
const {analyzeATS}=window;
const {exportPDF,exportDOCX,safeName}=window.PixelExport;
const {DEFAULT_CV}=window;
const clone = o => structuredClone(o);
let cv = clone(DEFAULT_CV);
let activeSection = "summary";
let activeMobile = "editor";
let atsResult = null;
let jobDescription = "";
let modal = null;
let toastTimer = null;
let autosaveTimer = null;
let history = [], historyIndex = -1;

const SECTION_META = {
  summary:["Profile Summary","summary"], skills:["Skills","skills"], experience:["Professional Experience","experience"],
  projects:["Projects","projects"], education:["Education","education"], certifications:["Certifications","certifications"], languages:["Languages","languages"]
};
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

function toast(message, type="success"){ clearTimeout(toastTimer); document.querySelector(".toast")?.remove(); const el=document.createElement("div"); el.className=`toast ${type}`; el.textContent=message; document.body.appendChild(el); toastTimer=setTimeout(()=>el.remove(),2600); }
function commit(next, message){ history=history.slice(0,historyIndex+1); history.push(clone(cv)); historyIndex++; cv=next; cv.updatedAt=new Date().toISOString(); scheduleSave(); render(); if(message) toast(message); }
function update(mutator, message){ const next=clone(cv); mutator(next); commit(next,message); }
function undo(){ if(historyIndex<0)return; cv=clone(history[historyIndex]); historyIndex--; render(); scheduleSave(); }
function redo(){ if(historyIndex>=history.length-1)return; historyIndex++; cv=clone(history[historyIndex]); render(); scheduleSave(); }

async function init(){
  try {
    const saved = await getDraft("default");
    if(saved){ cv=saved; }
    else { cv.id="default"; await saveDraft(cv); }
    const theme=await getSetting("theme"); document.documentElement.dataset.theme=theme||"light";
  } catch (e) {
    document.documentElement.dataset.theme="light";
    console.warn("Local storage unavailable; using in-memory mode.", e);
  }
  render();
  window.addEventListener("keydown", handleKeys);
  if("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(()=>{});
}
function handleKeys(e){
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="s"){e.preventDefault(); saveNow();}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"){e.preventDefault();e.shiftKey?redo():undo();}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();openCommandPalette();}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="p"){ e.preventDefault(); window.print(); }
  if(e.key==="Escape") closeModal();
}
function scheduleSave(){ clearTimeout(autosaveTimer); autosaveTimer=setTimeout(saveNow,700); }
async function saveNow(){ cv.id="default"; await saveDraft(cv); const s=document.querySelector("#save-state"); if(s)s.textContent="Saved"; }
function setSection(id){ activeSection=id; activeMobile="editor"; render(); }
function field(label,key,value,area=false){ return `<div class="field"><label>${esc(label)}</label>${area?`<textarea data-field="${esc(key)}">${esc(value)}</textarea>`:`<input data-field="${esc(key)}" value="${esc(value)}">`}</div>`; }

function render(){
  document.querySelector("#app").innerHTML = `
    <div class="app">
      ${renderTopbar()}
      <div class="layout">
        ${renderSidebar()}
        <main class="editor">${renderEditor()}</main>
        <section class="preview ${activeMobile==="preview"?"mobile-visible":""}">
          <div class="preview-toolbar">
            <button class="btn" data-action="zoom-out">−</button><span id="zoom-label">100%</span><button class="btn" data-action="zoom-in">+</button>
            <button class="btn" data-action="print">Print</button><button class="btn primary" data-action="pdf">Download PDF</button>
          </div>
          <div class="cv-stack" id="cv-preview">${renderCVPages()}</div>
        </section>
      </div>
      <nav class="mobile-nav">
        ${["editor","preview","ats","ai","files"].map(x=>`<button class="${activeMobile===x?"active":""}" data-mobile="${x}">${x[0].toUpperCase()+x.slice(1)}</button>`).join("")}
      </nav>
      ${modal||""}
      <div id="save-state" class="hide"></div>
    </div>`;
  bindEvents();
}
function renderTopbar(){
  return `<header class="topbar">
    <div class="brand"><img src="./PIXELMARKprime.png" alt="PIXELMARK"><div class="brand-copy">Professional CV Builder & ATS Optimizer</div></div>
    <div class="top-actions">
      <button class="btn secondary" data-action="new">New CV</button>
      <button class="btn secondary" data-action="recent">Recent Files</button>
      <button class="btn" data-action="theme">${document.documentElement.dataset.theme==="dark"?"Light":"Dark"}</button>
      <button class="btn primary" data-action="save">Save Draft</button>
      <button class="btn primary" data-action="export-menu">Export</button>
      <button class="btn icon" data-action="command" title="Command palette">⌘</button>
    </div>
  </header>`;
}
function renderSidebar(){
  return `<aside class="sidebar">
    <div class="nav-title">Workspace</div>
    <button class="nav-item active" data-action="hero">✦ Dashboard</button>
    <div class="nav-title">CV Sections</div>
    ${Object.entries(SECTION_META).map(([id,[label]])=>`<button class="nav-item ${activeSection===id?"active":""}" data-section="${id}">${label}</button>`).join("")}
    <button class="nav-item" data-action="custom">＋ Custom Section</button>
    <div class="nav-title">Tools</div>
    <button class="nav-item" data-action="templates">▦ Templates</button>
    <button class="nav-item" data-action="ats">✓ ATS Analyzer</button>
    <button class="nav-item" data-action="ai">✦ Smart Assistance</button>
    <button class="nav-item" data-action="files">▤ Recent Files</button>
    <button class="nav-item" data-action="settings">⚙ Settings</button>
    <div class="card" style="margin-top:18px;padding:13px"><div class="eyebrow">PIXELMARK</div><div style="font-size:12px;margin-top:5px">DESIGN. STRATEGY. GROWTH.</div></div>
  </aside>`;
}
function renderEditor(){
  const [label] = SECTION_META[activeSection] || ["Personal Information"];
  if(activeSection==="personal") return personalEditor();
  if(activeSection==="summary") return summaryEditor();
  if(activeSection==="skills") return skillsEditor();
  if(activeSection==="experience") return experienceEditor();
  if(activeSection==="projects") return projectsEditor();
  if(activeSection==="education") return educationEditor();
  if(activeSection==="certifications") return certificationsEditor();
  if(activeSection==="languages") return languagesEditor();
  if(activeSection.startsWith("custom:")) return customEditor(activeSection.slice(7));
  return dashboardEditor();
}
function header(title,desc){return `<div class="editor-header"><div><div class="eyebrow">PIXELMARK CV BUILDER</div><h1 class="title">${esc(title)}</h1><div class="sub">${esc(desc)}</div></div><div class="row"><span class="pill" id="save-state">Auto-save</span></div></div>`}
function dashboardEditor(){
 return `${header("Pixelmark CV Builder","Create professional, ATS-friendly resumes with intelligent local assistance.")}
 <div class="card"><div class="eyebrow">Welcome</div><h2 style="margin:7px 0">Build, analyze, export.</h2><p class="sub">Your current CV has been imported into structured editable data. Choose a section from the sidebar or use a speed action below.</p>
 <div class="row" style="margin-top:15px"><button class="btn primary" data-section="personal">Edit Personal Info</button><button class="btn" data-action="ats">Run ATS Analyzer</button><button class="btn" data-action="templates">Choose Template</button></div></div>
 <div class="grid2"><div class="card"><div class="eyebrow">ATS</div><h3>Pixelmark ATS Readiness</h3><div class="score">${atsResult?.score??"—"}</div><p class="sub">Transparent rule-based readiness estimate, not an external ATS vendor score.</p></div>
 <div class="card"><div class="eyebrow">Draft</div><h3>${esc(cv.name)}</h3><p class="sub">Changes auto-save to IndexedDB on this device.</p><button class="btn" data-action="save">Save now</button></div></div>`;
}
function personalEditor(){
 return `${header("Personal Information","Structured contact information used by every template.")}
 <div class="card">${field("Full Name","fullName",cv.personal.fullName)}${field("Professional Title","title",cv.personal.title)}
 <div class="grid2">${field("Location","location",cv.personal.location)}${field("Phone","phone",cv.personal.phone)}${field("Email","email",cv.personal.email)}${field("LinkedIn","linkedin",cv.personal.linkedin)}${field("GitHub","github",cv.personal.github)}${field("Portfolio","portfolio",cv.personal.portfolio)}</div>
 <div class="row"><button class="btn primary" data-action="apply-personal">Apply</button><button class="btn" data-action="clear-links">Clear links</button></div></div>`;
}
function summaryEditor(){
 return `${header("Profile Summary","Keep the original meaning while making content concise and machine-readable.")}
 <div class="card">${field("Profile Summary","summary",cv.summary,true)}
 <div class="row"><button class="btn primary" data-action="summary-improve">Improve</button><button class="btn" data-action="summary-ats">ATS Friendly</button><button class="btn" data-action="summary-short">Shorten</button><button class="btn" data-action="summary-expand">Expand</button></div>
 <p class="sub">${cv.summary.trim().split(/\s+/).filter(Boolean).length} words</p></div>`;
}
function skillsEditor(){
 return `${header("Skills","Organize skills into machine-readable categories.")}
 <div class="row" style="margin-bottom:12px"><button class="btn primary" data-action="add-skill-cat">＋ Add Category</button></div>
 <div>${cv.skills.map((s,i)=>`<div class="item-card"><div class="item-head"><strong>${esc(s.category)}</strong><div class="section-tools"><button class="btn" data-edit-skill-cat="${i}">Rename</button><button class="btn danger" data-delete-skill-cat="${i}">Delete</button></div></div><div class="row">${s.items.map((x,j)=>`<span class="tag">${esc(x)} <button data-remove-skill="${i}:${j}">×</button></span>`).join("")}</div><div class="row" style="margin-top:9px"><input id="new-skill-${i}" placeholder="Add skill…"><button class="btn" data-add-skill="${i}">Add</button></div></div>`).join("")}</div>`;
}
function experienceEditor(){
 return `${header("Professional Experience","Add roles and bullet points without changing source facts unless you choose a suggestion.")}
 <button class="btn primary" data-action="add-experience">＋ Add Experience</button>
 ${cv.experience.map((e,i)=>`<div class="item-card"><div class="item-head"><strong>${esc(e.title||"New Experience")}</strong><div class="section-tools"><button class="btn" data-duplicate-exp="${i}">Duplicate</button><button class="btn danger" data-delete-exp="${i}">Delete</button></div></div>
 <div class="grid2">${field("Job Title","",e.title)}${field("Company","",e.company)}${field("Location","",e.location)}${field("Start","",e.start)}${field("End","",e.end)}</div>
 <div class="field"><label>Bullets</label>${e.bullets.map((b,j)=>`<div class="bullet-row"><textarea data-exp="${i}:${j}">${esc(b)}</textarea><button class="btn" data-improve-bullet="${i}:${j}" title="Improve bullet">✦</button></div>`).join("")}</div>
 <div class="row"><button class="btn" data-exp-ai="${i}">Improve Bullets</button><button class="btn" data-save-exp="${i}">Save Entry</button></div></div>`).join("")}`;
}
function projectsEditor(){
 return `${header("Projects","Describe projects with factual, ATS-readable fields.")}<button class="btn primary" data-action="add-project">＋ Add Project</button>
 ${cv.projects.map((p,i)=>`<div class="item-card"><div class="item-head"><strong>${esc(p.name||"Project")}</strong><button class="btn danger" data-delete-project="${i}">Delete</button></div>
 ${field("Project Name","",p.name)}${field("Description","",p.description,true)}<div class="grid2">${field("Technologies (comma separated)","",p.technologies.join(", "))}${field("Date","",p.date)}${field("Project Link","",p.link)}${field("GitHub","",p.github)}</div><button class="btn" data-save-project="${i}">Save Entry</button></div>`).join("")}`;
}
function educationEditor(){
 return `${header("Education","Education fields are initialized only from the uploaded CV. Missing end years remain blank rather than being invented.")}<button class="btn primary" data-action="add-education">＋ Add Education</button>
 ${cv.education.map((e,i)=>`<div class="item-card">${field("Degree","",e.degree)}${field("Institution","",e.institution)}<div class="grid2">${field("Location","",e.location)}${field("Start","",e.start)}${field("End","",e.end)}</div>${field("Description","",e.description,true)}<button class="btn" data-save-education="${i}">Save Entry</button> <button class="btn danger" data-delete-education="${i}">Delete</button></div>`).join("")}`;
}
function certificationsEditor(){
 return `${header("Certifications","Repeatable certifications with optional credentials.")}<button class="btn primary" data-action="add-cert">＋ Add Certification</button>
 ${cv.certifications.map((c,i)=>`<div class="item-card">${field("Certification","",c.name)}${field("Issuer","",c.issuer)}<div class="grid2">${field("Date","",c.date)}${field("Credential ID","",c.credentialId)}${field("Credential URL","",c.url)}</div><button class="btn" data-save-cert="${i}">Save Entry</button> <button class="btn danger" data-delete-cert="${i}">Delete</button></div>`).join("")}`;
}
function languagesEditor(){
 return `${header("Languages","Language names and optional proficiency levels.")}<button class="btn primary" data-action="add-language">＋ Add Language</button>
 ${cv.languages.map((l,i)=>`<div class="item-card"><div class="grid2">${field("Language","",l.language)}${field("Proficiency","",l.proficiency)}</div><button class="btn" data-save-language="${i}">Save</button> <button class="btn danger" data-delete-language="${i}">Delete</button></div>`).join("")}`;
}
function customEditor(id){
 const c=cv.customSections.find(x=>x.id===id); if(!c)return dashboardEditor();
 return `${header(c.title,"Custom section — semantic text output.")}<div class="card">${field("Section Title","",c.title)}${field("Content","",c.content,true)}<button class="btn primary" data-save-custom="${esc(id)}">Save</button> <button class="btn danger" data-delete-custom="${esc(id)}">Delete</button></div>`;
}

function renderCVPages(){
  const sections=[];
  sections.push(`<section class="cv-header"><h1>${esc(cv.personal.fullName||cv.name)}</h1><div class="cv-subtitle">${esc(cv.personal.title)}</div><div class="cv-contact">${[cv.personal.location,cv.personal.phone,cv.personal.email,cv.personal.linkedin,cv.personal.github,cv.personal.portfolio].filter(Boolean).map(esc).join(" · ")}</div></section>`);
  const add = (title, html) => { if(html) sections.push(`<section><h2>${esc(title)}</h2>${html}</section>`); };
  add("Profile Summary", cv.summary ? `<p>${esc(cv.summary)}</p>` : "");
  add("Skills", cv.skills.length ? `<div class="cv-grid">${cv.skills.map(s=>`<div class="cv-skill-cat"><strong>${esc(s.category)}:</strong> <span>${esc(s.items.join(", "))}</span></div>`).join("")}</div>`:"");
  add("Professional Experience", cv.experience.length ? cv.experience.map(e=>`<article><h3>${esc(e.title)} — <span class="cv-accent">${esc(e.company)}</span></h3><p class="cv-contact">${esc([e.location,e.start,e.end].filter(Boolean).join(" · "))}</p><ul>${e.bullets.map(b=>`<li>${esc(b)}</li>`).join("")}</ul></article>`).join(""):"");
  add("Projects", cv.projects.length ? cv.projects.map(p=>`<article><h3>${esc(p.name)}</h3><p>${esc(p.description)}</p>${p.technologies.length?`<p class="cv-contact">Technologies: ${esc(p.technologies.join(", "))}</p>`:""}</article>`).join(""):"");
  add("Education", cv.education.length ? cv.education.map(e=>`<article><h3>${esc(e.degree)}</h3><p>${esc(e.institution)}${e.location?" · "+esc(e.location):""}${e.start||e.end?" · "+esc([e.start,e.end].filter(Boolean).join(" – ")):""}</p>${e.description?`<p>${esc(e.description)}</p>`:""}</article>`).join(""):"");
  add("Certifications", cv.certifications.length ? `<ul>${cv.certifications.map(c=>`<li><strong>${esc(c.name)}</strong>${c.issuer?" — "+esc(c.issuer):""}${c.date?" · "+esc(c.date):""}</li>`).join("")}</ul>`:"");
  add("Languages", cv.languages.length ? `<p>${cv.languages.map(l=>esc([l.language,l.proficiency].filter(Boolean).join(" — "))).join(" · ")}</p>`:"");
  cv.customSections.forEach(c=>add(c.title, `<p>${esc(c.content)}</p>`));
  const template = cv.template;
  return `<div class="cv-page cv-${esc(template)}" style="--cv-accent:${esc(cv.accent)}">${sections.join("")}</div>`;
}

function bindEvents(){
  document.querySelectorAll("[data-section]").forEach(b=>b.onclick=()=>setSection(b.dataset.section));
  document.querySelectorAll("[data-mobile]").forEach(b=>b.onclick=()=>{activeMobile=b.dataset.mobile; if(activeMobile==="ats")openATS(); else if(activeMobile==="ai")openAI(); else if(activeMobile==="files")openFiles(); else render();});
  document.querySelectorAll("[data-action]").forEach(b=>b.onclick=()=>action(b.dataset.action));
  document.querySelectorAll("[data-field]").forEach(el=>{
    if(el.closest(".experience")) return;
    el.oninput=()=>{ if(activeSection==="summary"){cv.summary=el.value;scheduleSave();renderPreviewOnly();} };
  });
  document.querySelectorAll("[data-add-skill]").forEach(b=>b.onclick=()=>{const i=+b.dataset.addSkill;const input=$(`#new-skill-${i}`);const v=input.value.trim();if(v)update(n=>n.skills[i].items.push(v),"Skill added");});
  document.querySelectorAll("[data-remove-skill]").forEach(b=>b.onclick=()=>{const [i,j]=b.dataset.removeSkill.split(":").map(Number);update(n=>n.skills[i].items.splice(j,1),"Skill removed");});
  document.querySelectorAll("[data-edit-skill-cat]").forEach(b=>b.onclick=()=>{const i=+b.dataset.editSkillCat;const v=prompt("Category name",cv.skills[i].category);if(v)update(n=>n.skills[i].category=v,"Category renamed");});
  document.querySelectorAll("[data-delete-skill-cat]").forEach(b=>b.onclick=()=>update(n=>n.skills.splice(+b.dataset.deleteSkillCat,1),"Category deleted"));
  document.querySelectorAll("[data-delete-exp]").forEach(b=>b.onclick=()=>update(n=>n.experience.splice(+b.dataset.deleteExp,1),"Experience deleted"));
  document.querySelectorAll("[data-duplicate-exp]").forEach(b=>b.onclick=()=>update(n=>{const e=clone(n.experience[+b.dataset.duplicateExp]);e.id=crypto.randomUUID();n.experience.splice(+b.dataset.duplicateExp+1,0,e)},"Experience duplicated"));
  document.querySelectorAll("[data-exp]").forEach(el=>el.oninput=()=>{const [i,j]=el.dataset.exp.split(":").map(Number);cv.experience[i].bullets[j]=el.value;scheduleSave();renderPreviewOnly();});
  document.querySelectorAll("[data-improve-bullet]").forEach(b=>b.onclick=()=>suggestBullet(+b.dataset.improveBullet.split(":")[0],+b.dataset.improveBullet.split(":")[1]));
  document.querySelectorAll("[data-save-exp]").forEach(b=>b.onclick=()=>{const card=b.closest(".item-card"), i=+b.dataset.saveExp;const inputs=card.querySelectorAll("input");const vals=[...inputs].map(x=>x.value);update(n=>{[n.experience[i].title,n.experience[i].company,n.experience[i].location,n.experience[i].start,n.experience[i].end]=vals;},"Experience saved");});
  document.querySelectorAll("[data-delete-project]").forEach(b=>b.onclick=()=>update(n=>n.projects.splice(+b.dataset.deleteProject,1),"Project deleted"));
  document.querySelectorAll("[data-save-project]").forEach(b=>b.onclick=()=>saveIndexedEntry("projects",+b.dataset.saveProject,b.closest(".item-card"),["name","description","technologies","date","link","github"]));
  document.querySelectorAll("[data-save-education]").forEach(b=>b.onclick=()=>saveIndexedEntry("education",+b.dataset.saveEducation,b.closest(".item-card"),["degree","institution","location","start","end","description"]));
  document.querySelectorAll("[data-delete-education]").forEach(b=>b.onclick=()=>update(n=>n.education.splice(+b.dataset.deleteEducation,1),"Education deleted"));
  document.querySelectorAll("[data-save-cert]").forEach(b=>b.onclick=()=>saveIndexedEntry("certifications",+b.dataset.saveCert,b.closest(".item-card"),["name","issuer","date","credentialId","url"]));
  document.querySelectorAll("[data-delete-cert]").forEach(b=>b.onclick=()=>update(n=>n.certifications.splice(+b.dataset.deleteCert,1),"Certification deleted"));
  document.querySelectorAll("[data-save-language]").forEach(b=>b.onclick=()=>saveIndexedEntry("languages",+b.dataset.saveLanguage,b.closest(".item-card"),["language","proficiency"]));
  document.querySelectorAll("[data-delete-language]").forEach(b=>b.onclick=()=>update(n=>n.languages.splice(+b.dataset.deleteLanguage,1),"Language deleted"));
  document.querySelectorAll("[data-save-custom]").forEach(b=>b.onclick=()=>{const c=cv.customSections.find(x=>x.id===b.dataset.saveCustom);const inputs=b.closest(".card").querySelectorAll("input,textarea");update(n=>{c.title=inputs[0].value;c.content=inputs[1].value},"Custom section saved");});
  document.querySelectorAll("[data-delete-custom]").forEach(b=>b.onclick=()=>update(n=>n.customSections=n.customSections.filter(x=>x.id!==b.dataset.deleteCustom),"Custom section deleted"));
  const ap=$("[data-action='apply-personal']"); if(ap) ap.onclick=()=>{const vals=[...ap.closest(".card").querySelectorAll("input")].map(x=>x.value);update(n=>{[n.personal.fullName,n.personal.title,n.personal.location,n.personal.phone,n.personal.email,n.personal.linkedin,n.personal.github,n.personal.portfolio]=vals;},"Personal information saved");};
  const cp=$("[data-action='clear-links']"); if(cp) cp.onclick=()=>update(n=>{n.personal.linkedin="";n.personal.github="";n.personal.portfolio=""},"Links cleared");
  const sum=$("[data-field='summary']"); if(sum) sum.oninput=()=>{cv.summary=sum.value;scheduleSave();renderPreviewOnly();};
}
function saveIndexedEntry(type,i,card,fields){
  const inputs=[...card.querySelectorAll("input,textarea")]; update(n=>{fields.forEach((f,j)=>{let v=inputs[j]?.value??"";if(f==="technologies")v=v.split(",").map(x=>x.trim()).filter(Boolean);n[type][i][f]=v;});},`${type} entry saved`);
}
function renderPreviewOnly(){const p=$("#cv-preview");if(p)p.innerHTML=renderCVPages();}
function suggestBullet(i,j){const original=cv.experience[i].bullets[j];const suggestion=LocalAIService.improveBullet(original);openConfirm("Improve Bullet",original,suggestion,()=>{update(n=>n.experience[i].bullets[j]=suggestion,"Suggested bullet applied");});}

function action(a){
  if(a==="theme"){const t=document.documentElement.dataset.theme==="dark"?"light":"dark";document.documentElement.dataset.theme=t;saveSetting("theme",t);render();}
  else if(a==="save")saveNow().then(()=>toast("Draft saved"));
  else if(a==="new")newCV();
  else if(a==="recent"||a==="files")openFiles();
  else if(a==="templates")openTemplates();
  else if(a==="ats")openATS();
  else if(a==="ai")openAI();
  else if(a==="settings")openSettings();
  else if(a==="command")openCommandPalette();
  else if(a==="print")window.print();
  else if(a==="pdf")doPDF();
  else if(a==="export-menu")openExportMenu();
  else if(a==="personal")setSection("personal");
  else if(a==="custom")addCustom();
  else if(a==="add-skill-cat")update(n=>n.skills.push({category:"New Category",items:[]}),"Category added");
  else if(a==="add-experience")update(n=>n.experience.push({id:crypto.randomUUID(),title:"",company:"",location:"",start:"",end:"",current:false,bullets:[""]}),"Experience added");
  else if(a==="add-project")update(n=>n.projects.push({id:crypto.randomUUID(),name:"",description:"",technologies:[],link:"",github:"",date:""}),"Project added");
  else if(a==="add-education")update(n=>n.education.push({id:crypto.randomUUID(),degree:"",institution:"",location:"",start:"",end:"",description:""}),"Education added");
  else if(a==="add-cert")update(n=>n.certifications.push({id:crypto.randomUUID(),name:"",issuer:"",date:"",credentialId:"",url:""}),"Certification added");
  else if(a==="add-language")update(n=>n.languages.push({id:crypto.randomUUID(),language:"",proficiency:""}),"Language added");
  else if(a.startsWith("summary-")) summaryAction(a);
}
function summaryAction(a){
 const original=cv.summary; let suggestion=original;
 if(a==="summary-improve")suggestion=LocalAIService.improveSummary(original);
 if(a==="summary-ats")suggestion=original.replace(/\bI\b/g,"").replace(/\s+/g," ").trim();
 if(a==="summary-short")suggestion=LocalAIService.shorten(original,70);
 if(a==="summary-expand")suggestion=LocalAIService.expand(original);
 openConfirm("Profile Summary Suggestion",original,suggestion,()=>update(n=>n.summary=suggestion,"Summary suggestion applied"));
}
function newCV(){openConfirm("Create New CV","This will replace the current working draft with a blank structured CV.","Create a new CV",()=>{cv=clone(DEFAULT_CV);cv.id="default";cv.name="New CV";cv.personal={fullName:"",title:"",location:"",phone:"",email:"",linkedin:"",github:"",portfolio:"",showPhoto:false};cv.summary="";cv.skills=[];cv.experience=[];cv.projects=[];cv.education=[];cv.certifications=[];cv.languages=[];cv.customSections=[];saveNow();render();toast("New CV created")});}
function addCustom(){const id=crypto.randomUUID();update(n=>n.customSections.push({id,title:"Custom Section",content:""}),"Custom section added");activeSection="custom:"+id;render();}
function openConfirm(title,original,suggestion,onApply){modal=`<div class="modal-backdrop"><div class="modal"><div class="row between"><div><div class="eyebrow">${esc(title)}</div><h2>Review before applying</h2></div><button class="btn" data-close>Close</button></div><div class="grid2"><div class="field"><label>Original</label><textarea readonly>${esc(original)}</textarea></div><div class="field"><label>Suggested</label><textarea readonly>${esc(suggestion)}</textarea></div></div><div class="row"><button class="btn" data-close>Cancel</button><button class="btn primary" id="apply-suggestion">Apply</button></div></div></div>`;renderModal();$("#apply-suggestion").onclick=()=>{onApply();closeModal();};}
function renderModal(){const old=document.querySelector(".modal-backdrop");old?.remove();document.body.insertAdjacentHTML("beforeend",modal);document.querySelectorAll("[data-close]").forEach(b=>b.onclick=closeModal);}
function closeModal(){document.querySelector(".modal-backdrop")?.remove();modal=null;}
function openCommandPalette(){
 modal=`<div class="modal-backdrop"><div class="modal"><div class="row between"><div><div class="eyebrow">SPEED ACTIONS</div><h2>Command Palette</h2></div><button class="btn" data-close>Esc</button></div><input id="command-search" placeholder="Search commands…"><div class="command-list" id="command-list" style="margin-top:10px">
 ${[["New CV","new"],["Save Draft","save"],["Download PDF","pdf"],["Print CV","print"],["ATS Analyzer","ats"],["Smart Assistance","ai"],["Recent Files","files"],["Templates","templates"],["Dark/Light Mode","theme"]].map(([x,a])=>`<button class="command" data-cmd="${a}">${x}</button>`).join("")}</div></div></div>`;renderModal();document.querySelectorAll("[data-cmd]").forEach(b=>b.onclick=()=>{closeModal();action(b.dataset.cmd)});$("#command-search").oninput=e=>{document.querySelectorAll("[data-cmd]").forEach(b=>b.style.display=b.textContent.toLowerCase().includes(e.target.value.toLowerCase())?"block":"none")};$("#command-search").focus();
}
function openExportMenu(){
 modal=`<div class="modal-backdrop"><div class="modal"><div class="row between"><div><div class="eyebrow">EXPORT</div><h2>Download your CV</h2></div><button class="btn" data-close>Close</button></div><p class="sub">PDF export preserves the visual A4 layout. DOCX export creates an editable, structured document.</p><div class="row"><button class="btn primary" id="m-pdf">Download PDF</button><button class="btn" id="m-docx">Download DOCX</button><button class="btn" id="m-print">Print</button></div></div></div>`;renderModal();$("#m-pdf").onclick=()=>{closeModal();doPDF()};$("#m-docx").onclick=()=>{closeModal();doDOCX()};$("#m-print").onclick=()=>{closeModal();window.print()};}
async function doPDF(){try{const el=$("#cv-preview");const name=`${safeName(cv.personal.fullName||cv.name)}_CV.pdf`;toast("Preparing PDF…");await exportPDF(el,name,msg=>{});await saveFileRecord({id:crypto.randomUUID(),name,cvName:cv.name,format:"PDF",createdAt:new Date().toISOString(),blob:null,draft:clone(cv)});toast("PDF exported successfully");}catch(e){toast("Unable to generate PDF. Please try again.","error");console.error(e)}}
async function doDOCX(){try{const name=`${safeName(cv.personal.fullName||cv.name)}_CV.docx`;toast("Preparing DOCX…");const result=await exportDOCX(cv,name);await saveFileRecord({id:crypto.randomUUID(),name,cvName:cv.name,format:"DOCX",createdAt:new Date().toISOString(),blob:result.blob,draft:clone(cv)});toast("DOCX exported successfully");}catch(e){toast("Unable to generate DOCX. Please try again.","error");console.error(e)}}
async function openFiles(){
 const files=await listFiles(); modal=`<div class="modal-backdrop"><div class="modal"><div class="row between"><div><div class="eyebrow">LOCAL FILE REGISTRY</div><h2>Recent Files</h2></div><button class="btn" data-close>Close</button></div>
 ${files.length?files.map(f=>`<div class="item-card"><div class="row between"><div><strong>${esc(f.name)}</strong><div class="sub">${esc(f.format)} · ${new Date(f.createdAt).toLocaleString()}</div></div><div class="row"><button class="btn" data-file-open="${f.id}">Open</button><button class="btn" data-file-download="${f.id}">Download</button><button class="btn danger" data-file-delete="${f.id}">Delete</button></div></div></div>`).join(""):`<div class="card" style="text-align:center"><h3>No recent files</h3><p class="sub">Your exported CVs will appear here.</p></div>`}
 </div></div>`;renderModal();
 document.querySelectorAll("[data-file-delete]").forEach(b=>b.onclick=async()=>{await deleteFileRecord(b.dataset.fileDelete);openFiles()});
 document.querySelectorAll("[data-file-open]").forEach(b=>b.onclick=async()=>{const f=await getFileRecord(b.dataset.fileOpen);if(f?.draft){cv=f.draft;closeModal();render();toast("Draft restored from file record")}});
 document.querySelectorAll("[data-file-download]").forEach(b=>b.onclick=async()=>{const f=await getFileRecord(b.dataset.fileDownload);if(f?.blob)saveAs(f.blob,f.name);else toast("This PDF was downloaded previously; regenerate it from the current draft.","error")});
}
function openTemplates(){
 modal=`<div class="modal-backdrop"><div class="modal"><div class="row between"><div><div class="eyebrow">CV OUTPUT</div><h2>Templates</h2></div><button class="btn" data-close>Close</button></div><div class="template-grid">${Object.values(TEMPLATES).map(t=>`<button class="template-card ${cv.template===t.id?"selected":""}" data-template="${t.id}"><strong>${esc(t.name)}</strong><p class="sub">${esc(t.description)}</p><span class="pill">${t.ats?"ATS-safe structure":"—"}</span></button>`).join("")}</div></div></div>`;renderModal();document.querySelectorAll("[data-template]").forEach(b=>b.onclick=()=>{update(n=>n.template=b.dataset.template,"Template changed");closeModal();});
}
function openATS(){
 atsResult=analyzeATS(cv,jobDescription); activeMobile="ats";
 modal=`<div class="modal-backdrop"><div class="modal"><div class="row between"><div><div class="eyebrow">PIXELMARK ATS ANALYZER</div><h2>ATS Readiness</h2></div><button class="btn" data-close>Close</button></div>
 <div class="card"><div class="score">${atsResult.score}/100</div><div class="progress"><span style="width:${atsResult.score}%"></span></div><p class="sub">Transparent Pixelmark rule-based estimate. This is not a score from an external ATS vendor.</p></div>
 ${atsResult.results.map(r=>`<div class="analysis-row"><div><strong>${esc(r.label)}</strong><div class="sub">${esc(r.detail)}</div></div><strong class="${r.ok?"ok":"warn"}">${r.points}/${r.max}</strong></div>`).join("")}
 <div class="field" style="margin-top:16px"><label>Optional Job Description</label><textarea id="job-text" placeholder="Paste a job description to calculate a Pixelmark Job Match estimate…">${esc(jobDescription)}</textarea></div>
 <button class="btn primary" id="run-match">Analyze Job Match</button>
 ${atsResult.jobMatch!==null?`<div class="card" style="margin-top:12px"><div class="eyebrow">JOB MATCH</div><div class="score">${atsResult.jobMatch}%</div><p class="sub">Matched: ${esc(atsResult.matchedKeywords.join(", ")||"None")}<br>Potentially missing: ${esc(atsResult.missingKeywords.join(", ")||"None")}</p></div>`:""}
 </div></div>`;renderModal();$("#run-match").onclick=()=>{jobDescription=$("#job-text").value;openATS();};
}
function openAI(){
 modal=`<div class="modal-backdrop"><div class="modal"><div class="row between"><div><div class="eyebrow">LOCAL SMART ASSISTANCE</div><h2>AI-like CV tools without an API key</h2></div><button class="btn" data-close>Close</button></div>
 <p class="sub">These tools run locally in the browser using deterministic rules. No CV content is sent to an external AI provider.</p>
 <div class="command-list">${[
 ["Extract CV Keywords","keywords"],["Suggest Action Verbs","verbs"],["Detect Repetition","repeat"],["Suggest Skills from Job Description","skills"]
 ].map(([x,a])=>`<button class="command" data-ai="${a}">${x}</button>`).join("")}</div><div id="ai-output" class="card" style="margin-top:12px;display:none"></div></div></div>`;renderModal();
 document.querySelectorAll("[data-ai]").forEach(b=>b.onclick=()=>runAI(b.dataset.ai));
}
function runAI(kind){
 const out=$("#ai-output");out.style.display="block";
 if(kind==="keywords")out.innerHTML=`<strong>Top keywords</strong><p>${esc(LocalAIService.extractKeywords(cv.summary+" "+cv.experience.flatMap(e=>e.bullets).join(" ")).join(", "))}</p>`;
 if(kind==="verbs")out.innerHTML=`<strong>Action verb check</strong><p>Bullets beginning with recognized action verbs are highlighted by the ATS analyzer. Use “Improve Bullet” on individual experience items to review suggestions.</p>`;
 if(kind==="repeat"){const all=cv.experience.flatMap(e=>e.bullets.map(b=>b.toLowerCase()));const dup=all.filter((x,i)=>all.indexOf(x)!==i);out.innerHTML=`<strong>Exact repeated bullets</strong><p>${dup.length?esc([...new Set(dup)].join(" | ")):"No exact duplicate bullets detected."}</p>`;}
 if(kind==="skills")out.innerHTML=`<strong>Suggested skills from job description</strong><p>${esc(LocalAIService.suggestSkills(cv,jobDescription).join(", ")||"Paste a job description in ATS Analyzer first.")}</p>`;
}
function openSettings(){
 modal=`<div class="modal-backdrop"><div class="modal"><div class="row between"><div><div class="eyebrow">SETTINGS</div><h2>Application Settings</h2></div><button class="btn" data-close>Close</button></div>
 <div class="card"><h3>Appearance</h3><div class="row"><button class="btn" data-set-theme="light">Light</button><button class="btn" data-set-theme="dark">Dark</button></div></div>
 <div class="card"><h3>CV defaults</h3><div class="grid2"><div class="field"><label>Default template</label><select id="setting-template">${Object.values(TEMPLATES).map(t=>`<option value="${t.id}" ${cv.template===t.id?"selected":""}>${esc(t.name)}</option>`).join("")}</select></div><div class="field"><label>Accent</label><input id="setting-accent" type="color" value="${esc(cv.accent)}"></div></div><button class="btn primary" id="save-settings">Save settings</button></div>
 <div class="card"><h3>Storage & Privacy</h3><p class="sub">Drafts are stored locally in IndexedDB by default. Local account mode is not secure multi-device authentication. External AI is intentionally not enabled in this static build.</p><button class="btn" id="backup">Export Backup</button><label class="btn">Import Backup<input id="restore" type="file" accept="application/json" hidden></label></div>
 <div class="card"><h3>About</h3><p class="sub">PIXELMARK · Pixelmark CV Builder · v1.0.0</p></div>
 </div></div>`;renderModal();
 document.querySelectorAll("[data-set-theme]").forEach(b=>b.onclick=()=>{document.documentElement.dataset.theme=b.dataset.setTheme;saveSetting("theme",b.dataset.setTheme)});
 $("#save-settings").onclick=()=>{update(n=>{n.template=$("#setting-template").value;n.accent=$("#setting-accent").value},"Settings saved");closeModal()};
 $("#backup").onclick=()=>downloadJSON({version:1,cv,drafts:awaitSafeDrafts(),settings:{theme:document.documentElement.dataset.theme}});
 $("#restore").onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const data=JSON.parse(await f.text());if(!data.cv||!data.cv.personal)throw new Error("Invalid backup");cv=data.cv;await saveDraft(cv);closeModal();render();toast("Backup restored");}catch(err){toast("Invalid backup file.","error")}};
}
async function awaitSafeDrafts(){return []}
function downloadJSON(data){const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});saveAs(blob,"pixelmark-cv-backup.json");toast("Backup exported");}

window.addEventListener("error", e => { console.error(e.error || e.message); });
init().catch(e => { console.error(e); document.querySelector("#app").innerHTML = `<div style="padding:40px;font-family:system-ui"><h1>Pixelmark CV Builder</h1><p>The app could not initialize. Refresh the page or use the GitHub Pages URL.</p></div>`; });