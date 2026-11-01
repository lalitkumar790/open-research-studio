"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft, ChevronDown, ChevronRight, FileText, Folder, FolderOpen,
  PanelLeft, PanelRight, Search, Settings, Sparkles, Play, Download,
  Share2, MoreHorizontal, Plus, MessageSquare, BookOpen, Code2,
  Check, AlertCircle, X, Copy, Maximize2
} from "lucide-react";

const starter = String.raw`\documentclass[11pt]{article}
\usepackage[margin=1in]{geometry}
\usepackage{amsmath, amssymb}
\usepackage{graphicx}
\usepackage{booktabs}
\usepackage{cite}

\title{Research Project}
\author{Author Name}
\date{\today}

\begin{document}

\maketitle

\begin{abstract}
Write your abstract here. Summarize the research problem, methodology,
key findings, and contribution of this work.
\end{abstract}

\section{Introduction}
Introduce the research problem and explain why it matters. Describe the
context, motivation, and the specific gap this work addresses.

\section{Related Work}
Review relevant literature and position your contribution.

\section{Methodology}
Describe the proposed approach in enough detail for reproducibility.

\begin{equation}
  E = mc^2
\end{equation}

\section{Results and Discussion}
Present your findings and discuss their implications.

\section{Conclusion}
Summarize the contributions and outline future work.

\bibliographystyle{plain}
\bibliography{references}

\end{document}
`;


const exampleTemplate = String.raw\`\\documentclass[11pt,a4paper]{article}
\\usepackage[margin=1in]{geometry}
\\usepackage{amsmath,amssymb,booktabs,graphicx}
\\usepackage[numbers]{natbib}
\\usepackage[hidelinks]{hyperref}

\\title{An Example Research Paper}
\\author{Author Name\\\\Department / Institution}
\\date{\\\\today}

\\begin{document}
\\maketitle

\\begin{abstract}
This example demonstrates a clean starting structure for a research manuscript.
Replace this paragraph with the research problem, approach, principal results,
and the contribution of your work. Keep claims precise and evidence-based.
\\end{abstract}

\\noindent\\textbf{Keywords:} research methodology; reproducibility; scientific writing

\\section{Introduction}
Introduce the problem, explain its significance, and identify the gap this work
addresses. End the section with a concise statement of the paper's contributions.

\\section{Related Work}
Organise prior work by theme rather than listing papers one by one. Explain how
the present study differs from and builds upon the literature.

\\section{Methodology}
Describe the system, dataset, experimental setup, and evaluation protocol so
another researcher can reproduce the work.

\\subsection{Mathematical formulation}
For example, a simple least-squares objective can be written as
\\begin{equation}
  \\hat{\\boldsymbol{\\theta}} =
  \\arg\\min_{\\boldsymbol{\\theta}}
  \\sum_{i=1}^{N}\\left(y_i-f(x_i;\\boldsymbol{\\theta})\\right)^2.
\\end{equation}

\\section{Results and Discussion}
Report measured results with appropriate units, baselines, and uncertainty.
Do not invent results: replace this guidance with your actual observations.

\\begin{table}[ht]
\\centering
\\caption{Example results table (replace with measured data).}
\\begin{tabular}{lcc}
\\toprule
Method & Metric A & Metric B \\\\
\\midrule
Baseline & -- & -- \\\\
Proposed method & -- & -- \\\\
\\bottomrule
\\end{tabular}
\\end{table}

\\section{Conclusion}
Summarise the verified contributions, limitations, and concrete future work.

\\section*{Acknowledgements}
Add funding and contributor acknowledgements where applicable.

\\bibliographystyle{plainnat}
\\bibliography{references}
\\end{document}
\`;

const exampleReferences = \`@article{example2024,
  author  = {Author, A. and Researcher, B.},
  title   = {Replace this placeholder with a verified reference},
  journal = {Journal Name},
  year    = {2024},
  volume  = {1},
  number  = {1},
  pages   = {1--10}
}
\`;

const outline = [
  { title: "Abstract", line: 15 },
  { title: "1  Introduction", line: 20 },
  { title: "2  Related Work", line: 24 },
  { title: "3  Methodology", line: 27 },
  { title: "4  Results and Discussion", line: 34 },
  { title: "5  Conclusion", line: 37 }
];

export default function ProjectEditor() {
  const params = useParams();
  const id = String(params.id ?? "project");
  const [name, setName] = useState("New Project");
  const [source, setSource] = useState(starter);
  const [hydrated, setHydrated] = useState(false);
  const [extraFiles, setExtraFiles] = useState<Record<string, string>>({ "references.bib": "% Add BibTeX entries here.\n" });
  const [tab, setTab] = useState<"preview" | "source">("preview");
  const [showFiles, setShowFiles] = useState(true);
  const [showAssistant, setShowAssistant] = useState(true);
  const [assistantText, setAssistantText] = useState("");
  const [messages, setMessages] = useState<{role:"assistant"|"user";text:string}[]>([
    { role: "assistant", text: "I’m your research writing assistant. I can help explain LaTeX, review structure, and suggest edits. Connect an AI provider to enable generated responses." }
  ]);
  const [notice, setNotice] = useState("");
  const [saved, setSaved] = useState(false);
  const [activeFile, setActiveFile] = useState("main.tex");
  const [compiling, setCompiling] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [compileError, setCompileError] = useState("");
  const [compileLogs, setCompileLogs] = useState("");

  const storageKey = useMemo(() => "ors-project-" + id, [id]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryName = params.get("name");
    if (queryName) setName(queryName);
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        if (typeof data.source === "string") setSource(data.source);
        if (typeof data.name === "string") setName(data.name);
        if (data.extraFiles && typeof data.extraFiles === "object" && !Array.isArray(data.extraFiles)) setExtraFiles(data.extraFiles);
      }
    } catch {}
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify({ source, name, extraFiles }));
        setSaved(true);
      } catch { setSaved(false); }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [source, name, extraFiles, storageKey, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const params = new URLSearchParams(window.location.search);
    if (localStorage.getItem(storageKey)) return;
    if (params.get("template") === "example") {
      setSource(exampleTemplate);
      setExtraFiles({ "references.bib": exampleReferences });
    }
  }, [hydrated, storageKey]);

  const activeContent = activeFile === "main.tex" ? source : (extraFiles[activeFile] ?? "");

  function downloadProject() {
    const bundle = { format: "open-research-studio-project", version: 1, exportedAt: new Date().toISOString(), name, source, extraFiles };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name.trim().replace(/[^a-z0-9-_]+/gi, "-") + ".ors.json"; a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function downloadSource() {
    const blob = new Blob([activeContent], { type: activeFile.endsWith(".bib") ? "text/plain;charset=utf-8" : "application/x-tex;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = activeFile; a.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    return () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); };
  }, [pdfUrl]);

  async function compileDocument() {
    setCompiling(true);
    setCompileError("");
    setCompileLogs("");
    setNotice("");
    try {
      const response = await fetch("/api/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, files: extraFiles })
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: "Compilation failed." }));
        setCompileError(data.error || "Compilation failed.");
        setCompileLogs(data.logs || data.details || "");
        return;
      }
      const pdf = await response.blob();
      const nextUrl = URL.createObjectURL(pdf);
      setPdfUrl(current => {
        if (current) URL.revokeObjectURL(current);
        return nextUrl;
      });
      setTab("preview");
    } catch (error) {
      setCompileError(error instanceof Error ? error.message : "Could not reach the compiler.");
    } finally {
      setCompiling(false);
    }
  }

  function askAssistant() {
    const prompt = assistantText.trim();
    if (!prompt) return;
    setMessages(current => [...current, { role: "user", text: prompt }, {
      role: "assistant",
      text: "AI generation is not connected yet. Your prompt is preserved in this conversation view; configure an AI provider and server-side API route to enable research-aware answers."
    }]);
    setAssistantText("");
  }

  function insertSection() {
    setSource(current => current + "\n\n\\section{New Section}\nWrite your content here.\n");
    setNotice("Section inserted into main.tex");
    window.setTimeout(() => setNotice(""), 2500);
  }

  return (
    <main className="editor-shell">
      <header className="editor-topbar">
        <div className="editor-brand">
          <a href="/" className="back-home" aria-label="Back to projects"><ArrowLeft size={18}/></a>
          <a href="/" className="brand-mark" aria-label="Open Research Studio home" title="Open Research Studio home"><BookOpen size={17}/></a>
          <div className="project-heading">
            <input value={name} onChange={e=>setName(e.target.value)} aria-label="Project name"/>
            <span className="crumb">Personal workspace <span>·</span> {saved ? "All changes saved" : "Saving…"}</span>
          </div>
          <ChevronDown size={14} className="muted-icon"/>
        </div>
        <div className="editor-actions">
          <span className="save-state"><span className="save-dot"/> {saved ? "Saved" : "Saving"}</span>
          <button className="editor-ghost" onClick={downloadSource}><Download size={16}/> Export file</button>
          <button className="editor-ghost" onClick={downloadProject}><Download size={16}/> Export project</button>
          <button className="editor-ghost" onClick={()=>setNotice("Sharing will be available after accounts and permissions are configured.")}><Share2 size={16}/> Share</button>
          <button className="compile-button" onClick={compileDocument} disabled={compiling}><Play size={15} fill="currentColor"/> {compiling ? "Compiling…" : "Compile"}</button>
          <button className="editor-icon" aria-label="More options"><MoreHorizontal size={19}/></button>
        </div>
      </header>

      <div className="editor-workspace">
        {showFiles && <aside className="file-sidebar">
          <div className="pane-heading"><span>PROJECT</span><div><button title="New file" onClick={()=>{const file=window.prompt("New file name (example: appendix.tex)");if(!file)return;const safe=file.trim();if(!/^[a-zA-Z0-9_-]+\\.(tex|bib|txt|sty|cls)$/.test(safe)){setNotice("Use a simple .tex, .bib, .txt, .sty or .cls filename.");return;}if(safe==="main.tex"||extraFiles[safe]!==undefined){setNotice("That file already exists.");return;}setExtraFiles(current=>({...current,[safe]:""}));setActiveFile(safe);setNotice("Created "+safe);}}><Plus size={15}/></button><button title="Collapse files" onClick={()=>setShowFiles(false)}><PanelLeft size={15}/></button></div></div>
          <div className="file-tree">
            <div className="tree-folder"><ChevronDown size={14}/><FolderOpen size={16}/> <span>{name}</span></div>
            <button className={`tree-file ${activeFile==="main.tex"?"active":""}`} onClick={()=>setActiveFile("main.tex")}><FileText size={15}/> main.tex</button>
            {Object.keys(extraFiles).sort().map(file=><button key={file} className={`tree-file ${activeFile===file?"active":""}`} onClick={()=>setActiveFile(file)}><FileText size={15}/> {file}</button>)}
            <label className="tree-file"><Plus size={15}/> Import files<input type="file" accept=".tex,.bib,.txt,.sty,.cls" multiple hidden onChange={e=>{Array.from(e.target.files??[]).forEach(file=>{if(file.size>200*1024){setNotice(file.name+" exceeds 200 KB.");return;}if(!/\.(tex|bib|txt|sty|cls)$/i.test(file.name)){setNotice("Unsupported file: "+file.name);return;}const reader=new FileReader();reader.onload=()=>setExtraFiles(current=>({...current,[file.name]:String(reader.result??"")}));reader.readAsText(file);});e.currentTarget.value="";}}/></label>
          </div>
          <div className="file-sidebar-bottom"><Settings size={15}/> Project settings</div>
        </aside>}

        <section className="source-pane">
          <div className="pane-tabs">
            {!showFiles && <button className="pane-tab-icon" onClick={()=>setShowFiles(true)}><PanelLeft size={16}/></button>}
            <div className="file-tab"><FileText size={14}/> {activeFile} <span className="tab-unsaved">●</span></div>
            <div className="pane-tab-spacer"/>
            <button className="pane-tab-icon" title="Insert section" onClick={insertSection}><Plus size={16}/></button>
            <button className="pane-tab-icon" title="Download source" onClick={downloadSource}><Download size={15}/></button>
          </div>
          <div className="editor-subbar"><span>{activeFile.endsWith(".bib")?"BibTeX":activeFile.endsWith(".tex")?"LaTeX":"Text"}</span><span>UTF-8</span><span>Ln {activeContent.split("\n").length}, Col 1</span></div>
          <div className="code-editor-wrap">
            <div className="line-numbers">{activeContent.split("\n").map((_,i)=><span key={i}>{i+1}</span>)}</div>
            <textarea
              className="latex-editor"
              spellCheck={false}
              value={activeContent}
              onChange={e=>{if(activeFile==="main.tex")setSource(e.target.value);else setExtraFiles(current=>({...current,[activeFile]:e.target.value}));setSaved(false);}}
              aria-label="LaTeX source editor"
              onKeyDown={e=>{
                if(e.key==="Tab"){e.preventDefault();const t=e.currentTarget;const start=t.selectionStart;const end=t.selectionEnd;const value=t.value;const next=value.slice(0,start)+"  "+value.slice(end);if(activeFile==="main.tex")setSource(next);else setExtraFiles(current=>({...current,[activeFile]:next}));requestAnimationFrame(()=>{t.selectionStart=t.selectionEnd=start+2;});}
              }}
            />
          </div>
          <div className="source-footer"><span><Code2 size={13}/> {activeFile}</span><span>{activeContent.length.toLocaleString()} characters</span></div>
        </section>

        <section className="preview-pane">
          <div className="preview-toolbar">
            <div className="preview-tabs"><button className={tab==="preview"?"active":""} onClick={()=>setTab("preview")}>PDF preview</button><button className={tab==="source"?"active":""} onClick={()=>setTab("source")}>Rich preview</button></div>
            <div className="preview-tools"><span className="compile-status"><span className={pdfUrl ? "compiled" : ""}/> {compiling ? "Compiling…" : pdfUrl ? "PDF ready" : "Not compiled"}</span><button title={pdfUrl ? "Download PDF" : "Download LaTeX source"} onClick={() => { if (pdfUrl) { const a = document.createElement("a"); a.href = pdfUrl; a.download = name.trim().replace(/[^a-z0-9-_]+/gi, "-") + ".pdf"; a.click(); } else downloadSource(); }}><Download size={15}/></button><button title="Fullscreen"><Maximize2 size={15}/></button></div>
          </div>
          {tab === "preview" ? <div className="pdf-viewer">
            {pdfUrl ? <iframe className="pdf-frame" src={pdfUrl} title="Compiled PDF preview"/> : <div className="pdf-empty">
              <div className="pdf-page-placeholder">
                <div className="pdf-paper-top"><span>OPEN RESEARCH STUDIO</span><span>PREVIEW</span></div>
                <div className="pdf-title-line"/><div className="pdf-title-line short"/>
                <div className="pdf-author-line"/>
                <div className="pdf-section-label">Abstract</div>
                <div className="pdf-line"/><div className="pdf-line"/><div className="pdf-line medium"/>
                <div className="pdf-section-label">1. Introduction</div>
                <div className="pdf-line"/><div className="pdf-line"/><div className="pdf-line"/><div className="pdf-line medium"/>
                <div className="pdf-equation">E = mc²</div>
                <div className="pdf-line"/><div className="pdf-line medium"/>
                <div className="pdf-placeholder-watermark"><FileText size={18}/> PDF preview will appear here</div>
              </div>
              <div className="preview-empty-copy"><strong>Your PDF preview</strong><span>Compile your LaTeX source to generate a real PDF using Tectonic.</span><button className="compile-button" onClick={compileDocument} disabled={compiling}><Play size={14} fill="currentColor"/> {compiling ? "Compiling…" : "Compile document"}</button></div>
            </div>}
            {compileError && <div className="compile-error"><div><AlertCircle size={15}/><strong>{compileError}</strong></div>{compileLogs && <pre>{compileLogs}</pre>}</div>}
          </div> : <div className="rich-preview"><h1>Research Project</h1><p className="rich-author">Author Name</p><h3>Abstract</h3><p>Write your abstract here. Summarize the research problem, methodology, key findings, and contribution of this work.</p><h2>1. Introduction</h2><p>Introduce the research problem and explain why it matters. Describe the context, motivation, and the specific gap this work addresses.</p><h2>2. Related Work</h2><p>Review relevant literature and position your contribution.</p><h2>3. Methodology</h2><p>Describe the proposed approach in enough detail for reproducibility.</p><div className="math-block">E = mc²</div><h2>4. Results and Discussion</h2><p>Present your findings and discuss their implications.</p><h2>5. Conclusion</h2><p>Summarize the contributions and outline future work.</p></div>}
        </section>

        {showAssistant && <aside className="assistant-pane">
          <div className="assistant-heading"><div><Sparkles size={16}/> <strong>AI Assistant</strong></div><button onClick={()=>setShowAssistant(false)} title="Close assistant"><X size={16}/></button></div>
          <div className="assistant-context"><span className="context-chip"><FileText size={12}/> {activeFile}</span><span className="context-chip"><BookOpen size={12}/> Research writing</span></div>
          <div className="assistant-messages">
            {messages.map((m,i)=><div className={`assistant-message ${m.role}`} key={i}>{m.role==="assistant"&&<span className="assistant-avatar"><Sparkles size={13}/></span>}<p>{m.text}</p></div>)}
          </div>
          <div className="assistant-suggestions"><span>Try asking</span><button onClick={()=>setAssistantText("Review the structure of my paper and suggest improvements.")}>Review my paper structure</button><button onClick={()=>setAssistantText("Explain the LaTeX equation environment.")}>Explain a LaTeX command</button><button onClick={()=>setAssistantText("Suggest a clearer abstract structure.")}>Improve my abstract</button></div>
          <div className="assistant-composer"><textarea value={assistantText} onChange={e=>setAssistantText(e.target.value)} placeholder="Ask anything about your paper…" rows={3}/><div><span>AI provider not connected</span><button onClick={askAssistant} disabled={!assistantText.trim()}><Sparkles size={15}/> Send</button></div></div>
        </aside>}
        {!showAssistant && <button className="show-assistant-tab" onClick={()=>setShowAssistant(true)}><Sparkles size={16}/> AI Assistant</button>}
      </div>
      {notice && <div className="editor-toast"><AlertCircle size={16}/>{notice}<button onClick={()=>setNotice("")}><X size={14}/></button></div>}
    </main>
  );
}
