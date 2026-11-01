"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { track } from "@vercel/analytics";
import { useRouter } from "next/navigation";
import { authClient, authenticatedFetch } from "../lib/auth/client";
import {
  Settings, PanelLeft, Search, ListFilter, Grid3X3, Plus, ChevronDown,
  MoreHorizontal, FileText, FolderPlus, Upload, Share2, Trash2, Pencil,
  X, ArrowUpDown, BookOpen, LogOut
} from "lucide-react";

type Project = { id: string; name: string; createdAt: string; updatedAt: string; owned: boolean; role: string };
type Menu = "new" | "import" | "account" | null;

export default function Home() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [search, setSearch] = useState("");
  const [activeNav, setActiveNav] = useState("Your Projects");
  const [menu, setMenu] = useState<Menu>(null);
  const [grid, setGrid] = useState(false);
  const [sortOldest, setSortOldest] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [user, setUser] = useState<{name?:string;email?:string}|null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const loadProjects = useCallback(async () => {
    const sessionResult = await authClient.getSession();
    const session = (sessionResult as any)?.data ?? sessionResult;
    if (!session?.user) { router.replace("/auth"); return; }
    setUser({ name: session.user.name, email: session.user.email });
    const response = await authenticatedFetch("/api/projects");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load projects.");
    setProjects(data.projects || []);
  }, [router]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try { await loadProjects(); }
      catch (e) { if (alive) setError(e instanceof Error ? e.message : "Could not load workspace."); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [loadProjects]);

  const visibleProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    const items = projects.filter(p => p.name.toLowerCase().includes(q) &&
      (activeNav !== "Shared with you" || !p.owned));
    return [...items].sort((a,b) => sortOldest
      ? new Date(a.createdAt).getTime()-new Date(b.createdAt).getTime()
      : new Date(b.updatedAt).getTime()-new Date(a.updatedAt).getTime());
  }, [projects, search, activeNav, sortOldest]);

  async function createProject(example = false) {
    setBusy(true); setError(""); setMenu(null);
    try {
      const name = example ? "Research Paper — Example" : "Untitled Project";
      const files = example ? [
        { path: "main.tex", content: "\\documentclass[11pt,a4paper]{article}\n\\usepackage{amsmath,amssymb,booktabs,graphicx}\n\\usepackage[numbers]{natbib}\n\\title{An Example Research Paper}\n\\author{Author Name}\n\\date{\\today}\n\\begin{document}\n\\maketitle\n\\begin{abstract}\nReplace this paragraph with your research problem, approach, and verified contribution.\n\\end{abstract}\n\\section{Introduction}\nIntroduce the problem and research gap.\n\\section{Methodology}\nDescribe a reproducible method.\n\\section{Results and Discussion}\nReport measured results; do not invent data.\n\\section{Conclusion}\nSummarise verified findings.\n\\bibliographystyle{plainnat}\n\\bibliography{references}\n\\end{document}" },
        { path: "references.bib", content: "% Add verified BibTeX references here.\n" }
      ] : [];
      const response = await authenticatedFetch("/api/projects", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({name,files}) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create project.");
      track("project_created", { template: example ? "example" : "blank" });
      router.push(`/project/${data.project.id}`);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not create project."); }
    finally { setBusy(false); }
  }

  async function importFiles(fileList: FileList) {
    const files = Array.from(fileList); if (!files.length) return;
    setBusy(true); setError(""); setMenu(null);
    try {
      const main = files.find(f => f.name.toLowerCase() === "main.tex") ?? files.find(f => f.name.toLowerCase().endsWith(".tex"));
      if (!main) throw new Error("Include at least one .tex file. main.tex is recommended.");
      const valid = files.filter(f => /\\.(tex|bib|txt|sty|cls|png|jpe?g|pdf)$/i.test(f.name) && f.size <= 10*1024*1024);
      if (valid.length !== files.length) throw new Error("Some files are unsupported or exceed the 10 MB per-file limit.");
      const textFiles = await Promise.all(valid.filter(f=>! /\\.(png|jpe?g|pdf)$/i.test(f.name)).map(async f=>({path:f.name,content:await f.text()})));
      const projectName = main.name.replace(/\\.[^.]+$/,"") || "Imported Project";
      const response = await authenticatedFetch("/api/projects", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:projectName,files:textFiles})});
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Could not create imported project.");
      for (const file of valid.filter(f=>/\\.(png|jpe?g|pdf)$/i.test(f.name))) {
        const contentType = file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream");
        const signed = await authenticatedFetch(`/api/projects/${data.project.id}/files/upload-url`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({path:file.name,contentType,byteSize:file.size})});
        const signedData=await signed.json(); if(!signed.ok) throw new Error(signedData.error || "Could not prepare file upload.");
        const upload=await fetch(signedData.url,{method:"PUT",headers:{"Content-Type":contentType},body:file});
        if(!upload.ok) throw new Error("Upload failed for "+file.name);
        const complete=await authenticatedFetch(`/api/projects/${data.project.id}/files/${signedData.fileId}/complete`,{method:"POST"});
        if(!complete.ok) throw new Error("Could not verify "+file.name);
      }
      router.push(`/project/${data.project.id}`);
    } catch(e) { setError(e instanceof Error ? e.message : "Could not import files."); }
    finally { setBusy(false); }
  }

  async function commitRename(id: string) {
    const value=renameValue.trim(); setRenaming(null);
    if(!value) return;
    try {
      const response=await authenticatedFetch(`/api/projects/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:value})});
      const data=await response.json(); if(!response.ok) throw new Error(data.error || "Rename failed.");
      setProjects(items=>items.map(p=>p.id===id?{...p,name:data.project.name,updatedAt:data.project.updatedAt}:p));
    } catch(e) { setError(e instanceof Error?e.message:"Rename failed."); }
  }

  async function deleteProject(id: string) {
    if(!window.confirm("Delete this project? This cannot be undone.")) return;
    try {
      const response=await authenticatedFetch(`/api/projects/${id}`,{method:"DELETE"});
      const data=await response.json(); if(!response.ok) throw new Error(data.error || "Delete failed.");
      setProjects(items=>items.filter(p=>p.id!==id)); setSelected(null);
    } catch(e) { setError(e instanceof Error?e.message:"Delete failed."); }
  }

  async function signOut() {
    await authClient.signOut(); router.replace("/auth"); router.refresh();
  }

  return (
    <main className="app-shell" onClick={()=>{if(menu)setMenu(null);if(selected!==null)setSelected(null);}}>
      <aside className={`sidebar ${collapsed?"sidebar-collapsed":""}`} onClick={e=>e.stopPropagation()}>
        <div className="side-top">
          <a className="workspace-brand" href="/" aria-label="Open Research Studio home"><span className="workspace-brand-mark"><BookOpen size={17}/></span><span className="workspace-brand-name">Open Research <small>STUDIO</small></span></a>
          <button className="icon-button settings-button" aria-label="Settings"><Settings size={19}/></button>
          <button className="icon-button collapse-button" aria-label="Collapse sidebar" onClick={()=>setCollapsed(v=>!v)}><PanelLeft size={18}/></button>
        </div>
        <nav className="side-nav">
          {["All Projects","Your Projects","Shared with you"].map(item=><button key={item} className={`nav-item ${activeNav===item?"active":""}`} onClick={()=>setActiveNav(item)} title={item}>{!collapsed&&item}</button>)}
        </nav>
        <button className="account-area" onClick={()=>setMenu(menu==="account"?null:"account")}>
          <span className="avatar">{(user?.name||user?.email||"U").slice(0,1).toUpperCase()}</span>
          {!collapsed&&<span className="account-copy"><strong>{user?.name||user?.email||"Account"}</strong><small>{user?.email||"Personal workspace"}</small></span>}
          {!collapsed&&<ChevronDown size={13} className="account-chevron"/>}
          {menu==="account"&&<div className="account-menu pop-menu"><div className="menu-label">Signed in</div><button onClick={e=>{e.stopPropagation();void signOut();}}><LogOut size={15}/> Sign out</button></div>}
        </button>
      </aside>
      <section className="main-panel" onClick={e=>e.stopPropagation()}>
        <header className="toolbar">
          <h1>{activeNav}</h1>
          <div className="toolbar-actions">
            <label className="search-box"><Search size={19}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search" aria-label="Search projects"/>{search&&<button onClick={()=>setSearch("")} aria-label="Clear search"><X size={15}/></button>}</label>
            <div className="menu-wrap"><button className={`round-tool ${!grid?"selected":""}`} title="List view" onClick={()=>setGrid(false)}><ListFilter size={19}/></button><button className={`round-tool ${grid?"selected":""}`} title="Grid view" onClick={()=>setGrid(true)}><Grid3X3 size={18}/></button></div>
            <div className="menu-wrap"><button className="toolbar-pill" onClick={()=>setMenu(menu==="import"?null:"import")}>Import <ChevronDown size={16}/></button>{menu==="import"&&<div className="dropdown import-menu"><button onClick={()=>fileInput.current?.click()}><Upload size={17}/> Import source files</button><p className="import-note">Import .tex, .bib, .sty, .cls, images and PDFs.</p></div>}</div>
            <div className="menu-wrap"><button className="new-button" disabled={busy} onClick={()=>setMenu(menu==="new"?null:"new")}><Plus size={19}/> New <ChevronDown size={16}/></button>{menu==="new"&&<div className="dropdown new-menu"><button onClick={()=>void createProject(false)}>Blank project</button><button onClick={()=>void createProject(true)}>Example project</button></div>}</div>
            <input ref={fileInput} type="file" multiple accept=".tex,.bib,.txt,.sty,.cls,.png,.jpg,.jpeg,.pdf" hidden onChange={e=>{const input=e.currentTarget;if(input.files)void importFiles(input.files);input.value="";}}/>
          </div>
        </header>
        <div className="table-head"><button className="column-name" onClick={()=>setSortOldest(v=>!v)}>Name <ArrowUpDown size={13}/></button><button className="column-created" onClick={()=>setSortOldest(v=>!v)}>Last edited <ArrowUpDown size={13}/></button></div>
        {error&&<div className="editor-toast" role="alert">{error}<button onClick={()=>setError("")}><X size={14}/></button></div>}
        {loading||busy?<div className="empty-state"><span>{loading?"Loading your workspace…":"Working…"}</span></div>:<div className={`project-list ${grid?"project-grid":""}`}>
          {visibleProjects.map(project=><article className="project-row" key={project.id}>
            <div className="project-thumb"><div className="paper-thumb"><span/><span/><span/><span/></div></div>
            <div className="project-title">{renaming===project.id?<form onSubmit={e=>{e.preventDefault();void commitRename(project.id);}}><input autoFocus value={renameValue} onChange={e=>setRenameValue(e.target.value)} onBlur={()=>void commitRename(project.id)} onKeyDown={e=>{if(e.key==="Escape")setRenaming(null);}}/></form>:<a className="project-open-link" href={`/project/${project.id}`} title="Open project">{project.name}</a>}</div>
            <span className="created-time">{new Date(project.updatedAt).toLocaleDateString()}</span>
            <div className="row-menu-wrap"><button className="row-more" aria-label={`Options for ${project.name}`} onClick={()=>setSelected(selected===project.id?null:project.id)}><MoreHorizontal size={18}/></button>
              {selected===project.id&&<div className="dropdown row-menu"><button onClick={()=>{setRenaming(project.id);setRenameValue(project.name);setSelected(null);}}><Pencil size={15}/> Rename</button><button onClick={()=>setSelected(null)}><Share2 size={15}/> Share</button>{project.owned&&<button className="danger" onClick={()=>void deleteProject(project.id)}><Trash2 size={15}/> Delete</button>}</div>}
            </div>
          </article>)}
          {visibleProjects.length===0&&<div className="empty-state"><FileText size={28}/><strong>{search?"No projects found":"Your workspace is empty"}</strong><span>{search?"Try a different search term.":"Create a blank project or start with the example."}</span></div>}
        </div>}
      </section>
    </main>
  );
}
