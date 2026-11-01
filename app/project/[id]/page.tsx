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

  const storageKey = useMemo(() => "ors-project-" + id, [id]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        if (typeof data.source === "string") setSource(data.source);
        if (typeof data.name === "string") setName(data.name);
      }
    } catch {}
  }, [storageKey]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify({ source, name }));
        setSaved(true);
      } catch { setSaved(false); }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [source, name, storageKey]);

  function downloadSource() {
    const blob = new Blob([source], { type: "application/x-tex;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = activeFile; a.click();
    URL.revokeObjectURL(url);
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
          <span className="brand-mark"><BookOpen size={17}/></span>
          <div className="project-heading">
            <input value={name} onChange={e=>setName(e.target.value)} aria-label="Project name"/>
            <span className="crumb">Personal workspace <span>·</span> {saved ? "All changes saved" : "Saving…"}</span>
          </div>
          <ChevronDown size={14} className="muted-icon"/>
        </div>
        <div className="editor-actions">
          <span className="save-state"><span className="save-dot"/> {saved ? "Saved" : "Saving"}</span>
          <button className="editor-ghost" onClick={downloadSource}><Download size={16}/> Export</button>
          <button className="editor-ghost" onClick={()=>setNotice("Sharing will be available after accounts and permissions are configured.")}><Share2 size={16}/> Share</button>
          <button className="compile-button" onClick={()=>setNotice("PDF compilation is not configured yet. Connect the Tectonic compiler service to enable builds.")}><Play size={15} fill="currentColor"/> Compile</button>
          <button className="editor-icon" aria-label="More options"><MoreHorizontal size={19}/></button>
        </div>
      </header>

      <div className="editor-workspace">
        {showFiles && <aside className="file-sidebar">
          <div className="pane-heading"><span>PROJECT</span><div><button title="New file" onClick={()=>setNotice("Multi-file project support is coming next.")}><Plus size={15}/></button><button title="Collapse files" onClick={()=>setShowFiles(false)}><PanelLeft size={15}/></button></div></div>
          <div className="file-tree">
            <div className="tree-folder"><ChevronDown size={14}/><FolderOpen size={16}/> <span>{name}</span></div>
            <button className={`tree-file ${activeFile==="main.tex"?"active":""}`} onClick={()=>setActiveFile("main.tex")}><FileText size={15}/> main.tex</button>
            <button className="tree-file muted-file" onClick={()=>setNotice("Create references.bib when bibliography editing is enabled.")}><FileText size={15}/> references.bib</button>
            <div className="tree-folder muted-file"><ChevronRight size={14}/><Folder size={16}/> <span>figures</span></div>
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
          <div className="editor-subbar"><span>LaTeX</span><span>UTF-8</span><span>Ln {source.split("\n").length}, Col 1</span></div>
          <div className="code-editor-wrap">
            <div className="line-numbers">{source.split("\n").map((_,i)=><span key={i}>{i+1}</span>)}</div>
            <textarea
              className="latex-editor"
              spellCheck={false}
              value={source}
              onChange={e=>{setSource(e.target.value);setSaved(false);}}
              aria-label="LaTeX source editor"
              onKeyDown={e=>{
                if(e.key==="Tab"){e.preventDefault();const t=e.currentTarget;const start=t.selectionStart;const end=t.selectionEnd;const value=t.value;t.value=value.slice(0,start)+"  "+value.slice(end);t.selectionStart=t.selectionEnd=start+2;setSource(t.value);}
              }}
            />
          </div>
          <div className="source-footer"><span><Code2 size={13}/> LaTeX source</span><span>{source.length.toLocaleString()} characters</span></div>
        </section>

        <section className="preview-pane">
          <div className="preview-toolbar">
            <div className="preview-tabs"><button className={tab==="preview"?"active":""} onClick={()=>setTab("preview")}>PDF preview</button><button className={tab==="source"?"active":""} onClick={()=>setTab("source")}>Rich preview</button></div>
            <div className="preview-tools"><span className="compile-status"><span/> Not compiled</span><button title="Download source" onClick={downloadSource}><Download size={15}/></button><button title="Fullscreen"><Maximize2 size={15}/></button></div>
          </div>
          {tab === "preview" ? <div className="pdf-empty">
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
            <div className="preview-empty-copy"><strong>Your PDF preview</strong><span>Compile your document to generate a typeset PDF. A TeX compiler service has not been connected yet.</span><button className="compile-button" onClick={()=>setNotice("PDF compilation requires the Tectonic service. No build was run.")}><Play size={14} fill="currentColor"/> Compile document</button></div>
          </div> : <div className="rich-preview"><h1>Research Project</h1><p className="rich-author">Author Name</p><h3>Abstract</h3><p>Write your abstract here. Summarize the research problem, methodology, key findings, and contribution of this work.</p><h2>1. Introduction</h2><p>Introduce the research problem and explain why it matters. Describe the context, motivation, and the specific gap this work addresses.</p><h2>2. Related Work</h2><p>Review relevant literature and position your contribution.</p><h2>3. Methodology</h2><p>Describe the proposed approach in enough detail for reproducibility.</p><div className="math-block">E = mc²</div><h2>4. Results and Discussion</h2><p>Present your findings and discuss their implications.</p><h2>5. Conclusion</h2><p>Summarize the contributions and outline future work.</p></div>}
        </section>

        {showAssistant && <aside className="assistant-pane">
          <div className="assistant-heading"><div><Sparkles size={16}/> <strong>AI Assistant</strong></div><button onClick={()=>setShowAssistant(false)} title="Close assistant"><X size={16}/></button></div>
          <div className="assistant-context"><span className="context-chip"><FileText size={12}/> main.tex</span><span className="context-chip"><BookOpen size={12}/> Research writing</span></div>
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
