"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { track } from "@vercel/analytics";
import DocumentOutline from "../../../components/DocumentOutline";
import {
  ArrowLeft, ChevronDown, ChevronRight, FileText, Folder, FolderOpen,
  PanelLeft, PanelRight, Search, Settings, Sparkles, Play, Download,
  Share2, MoreHorizontal, Plus, MessageSquare, BookOpen, Code2,
  Check, AlertCircle, X, Copy, Maximize2
} from "lucide-react";


const exampleTemplate = "\\documentclass[11pt,a4paper]{article}\n\\usepackage[margin=1in]{geometry}\n\\usepackage{amsmath,amssymb,booktabs,graphicx}\n\\usepackage[numbers]{natbib}\n\\usepackage[hidelinks]{hyperref}\n\n\\title{An Example Research Paper}\n\\author{Author Name\\\\Department / Institution}\n\\date{\\today}\n\n\\begin{document}\n\\maketitle\n\n\\begin{abstract}\nThis example demonstrates a clean starting structure for a research manuscript.\nReplace this paragraph with the research problem, approach, principal results,\nand the contribution of your work. Keep claims precise and evidence-based.\n\\end{abstract}\n\n\\noindent\\textbf{Keywords:} research methodology; reproducibility; scientific writing\n\n\\section{Introduction}\nIntroduce the problem, explain its significance, and identify the gap this work\naddresses. End the section with a concise statement of the paper's contributions.\n\n\\section{Related Work}\nOrganise prior work by theme rather than listing papers one by one. Explain how\nthe present study differs from and builds upon the literature.\n\n\\section{Methodology}\nDescribe the system, dataset, experimental setup, and evaluation protocol so\nanother researcher can reproduce the work.\n\n\\subsection{Mathematical formulation}\nFor example, a simple least-squares objective can be written as\n\\begin{equation}\n  \\hat{\\boldsymbol{\\theta}} =\n  \\arg\\min_{\\boldsymbol{\\theta}}\n  \\sum_{i=1}^{N}\\left(y_i-f(x_i;\\boldsymbol{\\theta})\\right)^2.\n\\end{equation}\n\n\\section{Results and Discussion}\nReport measured results with appropriate units, baselines, and uncertainty.\nDo not invent results: replace this guidance with your actual observations.\n\n\\begin{table}[ht]\n\\centering\n\\caption{Example results table (replace with measured data).}\n\\begin{tabular}{lcc}\n\\toprule\nMethod & Metric A & Metric B \\\\\n\\midrule\nBaseline & -- & -- \\\\\nProposed method & -- & -- \\\\\n\\bottomrule\n\\end{tabular}\n\\end{table}\n\n\\section{Conclusion}\nSummarise the verified contributions, limitations, and concrete future work.\n\n\\section*{Acknowledgements}\nAdd funding and contributor acknowledgements where applicable.\n\n\\bibliographystyle{plainnat}\n\\bibliography{references}\n\\end{document}";
const exampleReferences = "@article{example2024,\n  author  = {Author, A. and Researcher, B.},\n  title   = {Replace this placeholder with a verified reference},\n  journal = {Journal Name},\n  year    = {2024},\n  volume  = {1},\n  number  = {1},\n  pages   = {1--10}\n}";

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
  const [source, setSource] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [extraFiles, setExtraFiles] = useState<Record<string, string>>({});
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
  const editorRef = useRef<HTMLTextAreaElement>(null);

  const storageKey = useMemo(() => "ors-project-" + id, [id]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryName = params.get("name");
    if (queryName) setName(queryName);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryName = params.get("name");
    if (queryName) setName(queryName);
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        if (typeof data.source === "string") setSource(data.source);
        if (typeof data.name === "string") setName(data.name);
        if (data.extraFiles && typeof data.extraFiles === "object" && !Array.isArray(data.extraFiles)) setExtraFiles(data.extraFiles);
      } else if (params.get("template") === "example") {
        setSource(exampleTemplate);
        setExtraFiles({ "references.bib": exampleReferences });
      }
    } catch {
      setNotice("This project could not be fully restored from browser storage.");
    }
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

  function importProjectFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    const relativePaths = files.map(file => (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name);
    const firstSegments = relativePaths.map(path => path.split("/")[0]);
    const commonRoot = files.length > 0 && firstSegments.every(part => part === firstSegments[0]) && relativePaths.every(path => path.includes("/")) ? firstSegments[0] + "/" : "";
    const projectPaths = relativePaths.map(path => path.replace(/\\/g, "/").slice(commonRoot.length));
    const entryTexPath = projectPaths.find(path => path.toLowerCase() === "main.tex")
      ?? projectPaths.find(path => path.toLowerCase().endsWith(".tex"));
    let imported = 0;
    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      const normalizedPath = relativePaths[index].replace(/\\/g, "/").slice(commonRoot.length);
      const parts = normalizedPath.split("/");
      if (parts.some(part => !part || part === "." || part === ".." || part.startsWith(".") || !/^[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/.test(part))) { setNotice("Unsafe project path: " + normalizedPath); continue; }
      if (!/\.(tex|bib|txt|sty|cls|png|jpe?g|pdf)$/i.test(normalizedPath)) { setNotice("Unsupported file: " + normalizedPath); continue; }
      if (file.size > 2 * 1024 * 1024) { setNotice(normalizedPath + " exceeds 2 MB."); continue; }
      const binary = /\.(png|jpe?g|pdf)$/i.test(normalizedPath);
      const reader = new FileReader();
      reader.onload = () => {
        const contents = String(reader.result ?? "");
        if (normalizedPath === entryTexPath) setSource(contents);
        else setExtraFiles(current => ({ ...current, [normalizedPath]: contents }));
        track("files_imported", { count: 1, bytes: file.size, format: normalizedPath.split(".").pop() || "text" });
      };
      if (binary) reader.readAsDataURL(file); else reader.readAsText(file);
      imported++;
    }
    if (imported) setNotice("Importing " + imported + " project file" + (imported === 1 ? "" : "s") + "…");
  }


  const isBinaryAsset = /\.(png|jpe?g|pdf)$/i.test(activeFile);
  const activeContent = activeFile === "main.tex" ? source : (isBinaryAsset ? "[Binary project asset — included when compiling]" : (extraFiles[activeFile] ?? ""));

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
    const compileStartedAt = Date.now();
    if (!activeFile.toLowerCase().endsWith(".tex")) {
      setCompileError("Open a .tex file before compiling.");
      return;
    }
    const entryFile = activeFile;
    const entrySource = entryFile === "main.tex" ? source : extraFiles[entryFile];
    if (typeof entrySource !== "string" || !entrySource.trim()) {
      setCompileError("The selected .tex file is empty or unavailable.");
      return;
    }
    const supportingFiles = entryFile === "main.tex"
      ? { ...extraFiles }
      : { ...extraFiles, "main.tex": source };
    delete supportingFiles[entryFile];
    const inputBytes = new Blob([entrySource, ...Object.values(supportingFiles)]).size;
    track("compile_started", { input_bytes: inputBytes, supporting_files: Object.keys(supportingFiles).length, entry_file: entryFile });
    setCompiling(true);
    setCompileError("");
    setCompileLogs("");
    setNotice("");
    try {
      const response = await fetch("/api/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: entrySource, files: supportingFiles, entryFile })
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: "Compilation failed." }));
        setCompileError(data.error || "Compilation failed.");
        setCompileLogs(data.logs || data.details || "");
        track("compile_failed", { duration_ms: Date.now() - compileStartedAt, status: response.status });
        return;
      }
      const pdf = await response.blob();
      track("compile_succeeded", { duration_ms: Date.now() - compileStartedAt, input_bytes: inputBytes, output_bytes: pdf.size, entry_file: entryFile });
      const nextUrl = URL.createObjectURL(pdf);
      setPdfUrl(current => {
        if (current) URL.revokeObjectURL(current);
        return nextUrl;
      });
    } catch (error) {
      track("compile_failed", { duration_ms: Date.now() - compileStartedAt, status: "network" });
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

  function jumpToOutlineLine(line: number) {
    const editor = editorRef.current;
    if (!editor) return;
    const lines = activeContent.split("\n");
    const position = lines.slice(0, Math.max(0, line - 1)).reduce((total, item) => total + item.length + 1, 0);
    editor.focus();
    editor.setSelectionRange(position, position);
    editor.scrollTop = Math.max(0, (line - 3) * 22);
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
          <button className="compile-button" onClick={compileDocument} disabled={compiling || !activeFile.toLowerCase().endsWith(".tex")}><Play size={15} fill="currentColor"/> {compiling ? "Compiling…" : "Compile"}</button>
          <button className="editor-icon" aria-label="More options"><MoreHorizontal size={19}/></button>
        </div>
      </header>

      <div className="editor-workspace">
        {showFiles && <aside className="file-sidebar">
          <div className="pane-heading"><span>FILES</span><div><button title="Add files to this project" onClick={()=>document.getElementById("ors-import-files")?.click()}><Plus size={15}/></button><button title="Collapse files" onClick={()=>setShowFiles(false)}><PanelLeft size={15}/></button></div></div>
          <div className="file-tree">
            <div className="tree-folder"><ChevronDown size={14}/><FolderOpen size={16}/> <span>{name}</span></div>
            <button className={`tree-file ${activeFile==="main.tex"?"active":""}`} onClick={()=>setActiveFile("main.tex")}><FileText size={15}/> main.tex</button>
            {Object.keys(extraFiles).sort().map(file=><button key={file} className={`tree-file ${activeFile===file?"active":""}`} onClick={()=>setActiveFile(file)}><FileText size={15}/> {file}</button>)}
            <button className="tree-file" onClick={()=>document.getElementById("ors-import-files")?.click()}><Plus size={15}/> Add files</button>
            {activeFile.toLowerCase().endsWith(".tex") && <DocumentOutline source={activeContent} onJump={jumpToOutlineLine}/>}
            <input id="ors-import-files" type="file" accept=".tex,.bib,.txt,.sty,.cls,.png,.jpg,.jpeg,.pdf" multiple hidden onChange={e=>{if(e.target.files)importProjectFiles(e.target.files);e.currentTarget.value="";}}/>
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
              ref={editorRef}
              className="latex-editor"
              spellCheck={false}
              value={activeContent}
              readOnly={isBinaryAsset}
              onChange={e=>{if(isBinaryAsset)return;if(activeFile==="main.tex")setSource(e.target.value);else setExtraFiles(current=>({...current,[activeFile]:e.target.value}));setSaved(false);}}
              aria-label="LaTeX source editor"
              onKeyDown={e=>{
                if(e.key==="Tab"){e.preventDefault();const t=e.currentTarget;const start=t.selectionStart;const end=t.selectionEnd;const value=t.value;const next=value.slice(0,start)+"  "+value.slice(end);if(activeFile==="main.tex")setSource(next);else setExtraFiles(current=>({...current,[activeFile]:next}));requestAnimationFrame(()=>{t.selectionStart=t.selectionEnd=start+2;});}
              }}
            />
          </div>
          <div className="source-footer"><span><Code2 size={13}/> {activeFile}</span><span>{activeContent.length.toLocaleString()} characters</span></div>
        </section>

        <section className="preview-pane">
          <div className="preview-toolbar preview-toolbar-simple">
            <span className="preview-heading">PDF</span>
            <div className="preview-tools">
              <span className="compile-status"><span className={pdfUrl ? "compiled" : ""}/> {compiling ? "Compiling…" : pdfUrl ? "Ready" : "Not compiled"}</span>
              <button className="pdf-download-button" disabled={!pdfUrl} title="Download PDF" onClick={() => { if (!pdfUrl) return; const a = document.createElement("a"); a.href = pdfUrl; a.download = name.trim().replace(/[^a-z0-9-_]+/gi, "-") + ".pdf"; a.click(); }}><Download size={14}/> Download PDF</button>
            </div>
          </div>
          <div className="pdf-viewer">
            {pdfUrl ? <iframe className="pdf-frame" src={pdfUrl + "#toolbar=0&navpanes=0&scrollbar=1&view=FitH"} title="Compiled PDF preview"/> : <div className="pdf-empty">
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
              <div className="preview-empty-copy"><strong>Your PDF preview</strong><span>Compile your LaTeX source to generate a real PDF using Tectonic.</span><button className="compile-button" onClick={compileDocument} disabled={compiling || !activeFile.toLowerCase().endsWith(".tex")}><Play size={14} fill="currentColor"/> {compiling ? "Compiling…" : "Compile document"}</button></div>
            </div>}
            {compileError && <div className="compile-error"><div><AlertCircle size={15}/><strong>{compileError}</strong></div>{compileLogs && <pre>{compileLogs}</pre>}</div>}
          </div>
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
