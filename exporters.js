const CDN_LIBS = {
  pdf: "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js",
  docx: "https://cdn.jsdelivr.net/npm/docx@9.5.1/build/index.umd.js",
  saver: "https://cdn.jsdelivr.net/npm/file-saver@2.0.5/dist/FileSaver.min.js"
};
const loadedScripts = {};
function loadScriptOnce(src) {
  if (loadedScripts[src]) return loadedScripts[src];
  loadedScripts[src] = new Promise((resolve, reject) => {
    const existing = [...document.scripts].find(s => s.src === src);
    if (existing) { resolve(); return; }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load export library."));
    document.head.appendChild(script);
  });
  return loadedScripts[src];
}
async function ensurePDFLibs(){ await loadScriptOnce(CDN_LIBS.pdf); }
async function ensureDOCXLibs(){ await Promise.all([loadScriptOnce(CDN_LIBS.docx), loadScriptOnce(CDN_LIBS.saver)]); }


function safeName(name) {
  return (name || "CV").replace(/[^a-z0-9 _-]/gi,"").trim().replace(/\s+/g,"_") || "CV";
}

function addDomTextToPdf(pdf, page, onProgress) {
  const margin = 16;
  const pageW = 210, pageH = 297;
  const maxW = pageW - margin * 2;
  let y = margin;

  const ensure = (needed = 5) => {
    if (y + needed > pageH - margin) {
      pdf.addPage();
      y = margin;
    }
  };
  const write = (text, size, bold = false, gap = 3, lineHeight = 4.2) => {
    const clean = (text || "").replace(/\s+/g, " ").trim();
    if (!clean) return;
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    const lines = pdf.splitTextToSize(clean, maxW);
    ensure(lines.length * lineHeight + gap);
    pdf.text(lines, margin, y);
    y += lines.length * lineHeight + gap;
  };

  const walk = (el) => {
    for (const node of el.children) {
      const tag = node.tagName.toLowerCase();
      if (tag === "h1") write(node.textContent, 19, true, 3, 7);
      else if (tag === "h2") { ensure(10); y += 2; write(node.textContent, 10, true, 2, 4); }
      else if (tag === "h3") write(node.textContent, 9.5, true, 1.5, 4);
      else if (tag === "p") write(node.textContent, 8.8, false, 2.5, 3.8);
      else if (tag === "li") write("• " + node.textContent, 8.5, false, 1.3, 3.7);
      else if (tag === "article" || tag === "section" || tag === "div" || tag === "ul") walk(node);
      else if (node.textContent?.trim()) write(node.textContent, 8.5, false, 2.5, 3.8);
    }
  };

  onProgress("Building selectable-text PDF…");
  walk(page);
}

async function exportPDF(element, filename, onProgress = () => {}) {
  await ensurePDFLibs();
  const pages = [...element.querySelectorAll(".cv-page")];
  if (!pages.length) throw new Error("No CV pages available.");
  const PDFCtor = window.jspdf?.jsPDF; if (!PDFCtor) throw new Error("PDF library unavailable. Connect to the internet or use Print CV.");
  const pdf = new PDFCtor({ orientation:"portrait", unit:"mm", format:"a4", compress:true });
  pages.forEach((page, index) => {
    if (index) pdf.addPage();
    addDomTextToPdf(pdf, page, onProgress);
  });
  pdf.save(filename);
  onProgress("Done");
  return { blob:null, type:"application/pdf" };
}

async function exportDOCX(cv, filename, onProgress = () => {}) {
  await ensureDOCXLibs();
  onProgress("Building editable DOCX…");
  const Document = window.docx?.Document, Packer = window.docx?.Packer, Paragraph = window.docx?.Paragraph, TextRun = window.docx?.TextRun, HeadingLevel = window.docx?.HeadingLevel;
  const saveAs = window.saveAs;
  if (!Document || !Packer || !Paragraph || !TextRun || !HeadingLevel || !saveAs) throw new Error("DOCX libraries unavailable. Connect to the internet or use Print/PDF.");
  const children = [];
  children.push(new Paragraph({ text: cv.personal.fullName || cv.name, heading: HeadingLevel.TITLE }));
  if (cv.personal.title) children.push(new Paragraph({ text: cv.personal.title }));
  children.push(new Paragraph({ children: [new TextRun({
    text: [cv.personal.location,cv.personal.phone,cv.personal.email,cv.personal.linkedin,cv.personal.github,cv.personal.portfolio].filter(Boolean).join(" | ")
  })] }));
  children.push(new Paragraph({ text:"PROFILE SUMMARY", heading:HeadingLevel.HEADING_1 }));
  children.push(new Paragraph({ text:cv.summary || "" }));
  const sections = [
    ["SKILLS", () => cv.skills.flatMap(s => [new Paragraph({text:s.category, heading:HeadingLevel.HEADING_2}), new Paragraph({text:s.items.join(", ")})])],
    ["PROFESSIONAL EXPERIENCE", () => cv.experience.flatMap(e => [
      new Paragraph({text:`${e.title} — ${e.company}`, heading:HeadingLevel.HEADING_2}),
      new Paragraph({text:[e.location,e.start,e.end].filter(Boolean).join(" | ")}),
      ...e.bullets.map(b => new Paragraph({text:b, bullet:{level:0}}))
    ])],
    ["PROJECTS", () => cv.projects.flatMap(p => [new Paragraph({text:p.name, heading:HeadingLevel.HEADING_2}), new Paragraph({text:p.description}), ...(p.technologies.length ? [new Paragraph({text:`Technologies: ${p.technologies.join(", ")}`})] : [])])],
    ["EDUCATION", () => cv.education.map(e => new Paragraph({text:`${e.degree} — ${e.institution} | ${[e.location,e.start,e.end].filter(Boolean).join(" | ")}`}))],
    ["CERTIFICATIONS", () => cv.certifications.map(c => new Paragraph({text:`${c.name} — ${c.issuer}`}))],
    ["LANGUAGES", () => cv.languages.map(l => new Paragraph({text:[l.language,l.proficiency].filter(Boolean).join(" — ")}))]
  ];
  for (const [heading, make] of sections) {
    children.push(new Paragraph({ text:heading, heading:HeadingLevel.HEADING_1 }));
    children.push(...make());
  }
  const doc = new Document({ sections:[{ properties:{}, children }] });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, filename);
  onProgress("Done");
  return { blob, type:"application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
}

window.PixelExport={exportPDF,exportDOCX,safeName};
