"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Settings, PanelLeft, Search, ListFilter, Grid3X3, Plus, ChevronDown,
  ChevronUp, MoreHorizontal, FileText, FolderPlus, Upload, FilePlus2,
  LayoutGrid, Share2, Trash2, Pencil, X, Check, Clock3, ArrowUpDown, BookOpen
} from "lucide-react";

type Project = { id: number; name: string; created: string; kind?: "document" | "project"; shared?: boolean };
type Menu = "new" | "import" | "view" | "sort" | "account" | null;

const initialProjects: Project[] = [
  { id: 1, name: "New Project", created: "16h" },
  { id: 2, name: "New Project", created: "1mo" },
  { id: 3, name: "New Project", created: "1mo" },
  { id: 4, name: "Lalit_Kumar_MTech_Progress_Report", created: "1mo", kind: "document" },
  { id: 5, name: "Mid term dissertation", created: "1mo" },
  { id: 6, name: "NPDSM_UPDATED PAPER", created: "2mo" },
  { id: 7, name: "New Project", created: "2mo" },
  { id: 8, name: "New Project", created: "3mo" },
  { id: 9, name: "New Project", created: "3mo" },
  { id: 10, name: "New Project", created: "3mo" },
  { id: 11, name: "New Project", created: "3mo" },
  { id: 12, name: "New Project", created: "3mo" },
  { id: 13, name: "New Project", created: "3mo" }
];

export default function Home() {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [folders, setFolders] = useState<string[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [search, setSearch] = useState("");
  const [activeNav, setActiveNav] = useState("Your Projects");
  const [menu, setMenu] = useState<Menu>(null);
  const [grid, setGrid] = useState(false);
  const [sortOldest, setSortOldest] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [renaming, setRenaming] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [folderName, setFolderName] = useState("");
  const [showFolder, setShowFolder] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const savedProjects = localStorage.getItem("ors-dashboard-projects-v1");
      const savedFolders = localStorage.getItem("ors-dashboard-folders-v1");
      if (savedProjects) {
        const parsed = JSON.parse(savedProjects);
        if (Array.isArray(parsed)) setProjects(parsed.filter(item =>
          item && Number.isFinite(item.id) && typeof item.name === "string" && typeof item.created === "string"
        ));
      }
      if (savedFolders) {
        const parsed = JSON.parse(savedFolders);
        if (Array.isArray(parsed)) setFolders(parsed.filter(item => typeof item === "string"));
      }
    } catch {
      // Keep the starter workspace available if browser storage is unavailable or invalid.
    } finally {
      setStorageReady(true);
    }
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    try {
      localStorage.setItem("ors-dashboard-projects-v1", JSON.stringify(projects));
      localStorage.setItem("ors-dashboard-folders-v1", JSON.stringify(folders));
    } catch {
      // Browser storage can be full or disabled; the current session remains usable.
    }
  }, [projects, folders, storageReady]);

  const visibleProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    let items = projects.filter(p => {
      const matches = p.name.toLowerCase().includes(q);
      if (activeNav === "Shared with you") return matches && p.shared;
      return matches;
    });
    return [...items].sort((a,b) => sortOldest ? b.id-a.id : a.id-b.id);
  }, [projects, search, activeNav, sortOldest]);

  function createProject(example = false) {
    const p = { id: Date.now(), name: example ? "Example Project" : "New Project", created: "now" };
    setProjects(current => [p, ...current]);
    setMenu(null);
  }

  function commitRename(id: number) {
    const value = renameValue.trim();
    if (value) setProjects(current => current.map(p => p.id === id ? { ...p, name: value } : p));
    setRenaming(null);
  }

  function deleteProject(id: number) {
    setProjects(current => current.filter(p => p.id !== id));
    setSelected(null);
  }

  return (
    <main className="app-shell" onClick={() => { if (menu) setMenu(null); if (selected !== null) setSelected(null); }}>
      <aside className={`sidebar ${collapsed ? "sidebar-collapsed" : ""}`} onClick={e => e.stopPropagation()}>
        <div className="side-top">
          <a className="workspace-brand" href="/" aria-label="Open Research Studio home"><span className="workspace-brand-mark"><BookOpen size={17}/></span><span className="workspace-brand-name">Open Research <small>STUDIO</small></span></a>
          <button className="icon-button settings-button" aria-label="Settings" title="Settings"><Settings size={19}/></button>
          <button className="icon-button collapse-button" aria-label="Collapse sidebar" onClick={() => setCollapsed(v => !v)}><PanelLeft size={18}/></button>
        </div>
        <nav className="side-nav">
          {["All Projects", "Your Projects", "Shared with you"].map(item => (
            <button key={item} className={`nav-item ${activeNav === item ? "active" : ""}`} onClick={() => setActiveNav(item)} title={item}>
              {!collapsed && item}
            </button>
          ))}
        </nav>
        <button className="account-area" onClick={() => setMenu(menu === "account" ? null : "account")}>
          <span className="avatar">L</span>
          {!collapsed && <span className="account-copy"><strong>Lalit kumar</strong><small>♙ Personal workspace</small></span>}
          {!collapsed && <ChevronDown size={13} className="account-chevron"/>}
          {menu === "account" && <div className="account-menu pop-menu"><div className="menu-label">Personal workspace</div><button>Account settings</button><button>Help & feedback</button></div>}
        </button>
      </aside>

      <section className="main-panel" onClick={e => e.stopPropagation()}>
        <header className="toolbar">
          <h1>{activeNav}</h1>
          <div className="toolbar-actions">
            <label className="search-box"><Search size={19}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search" aria-label="Search projects"/>{search && <button onClick={() => setSearch("")} aria-label="Clear search"><X size={15}/></button>}</label>
            <div className="menu-wrap">
              <button className={`round-tool ${!grid ? "selected" : ""}`} title="List view" onClick={() => setGrid(false)}><ListFilter size={19}/></button>
              <button className={`round-tool ${grid ? "selected" : ""}`} title="Grid view" onClick={() => setGrid(true)}><Grid3X3 size={18}/></button>
            </div>
            <div className="menu-wrap">
              <button className="toolbar-pill" onClick={() => setMenu(menu === "import" ? null : "import")}>Import <ChevronDown size={16}/></button>
              {menu === "import" && <div className="dropdown import-menu"><button onClick={() => fileInput.current?.click()}><Upload size={17}/> Upload files</button><button onClick={() => fileInput.current?.click()}><FileText size={17}/> Import LaTeX project (.zip)</button></div>}
            </div>
            <div className="menu-wrap">
              <button className="new-button" onClick={() => setMenu(menu === "new" ? null : "new")}><Plus size={19}/> New <ChevronDown size={16}/></button>
              {menu === "new" && <div className="dropdown new-menu">
                <button onClick={() => createProject(false)}>Blank project</button>
                <button onClick={() => createProject(true)}>Example project</button>
                <div className="menu-divider"/>
                <button onClick={() => { setShowFolder(true); setMenu(null); }}>New folder</button>
              </div>}
            </div>
            <input ref={fileInput} type="file" multiple accept=".zip,.tex,.bib,.pdf,.png,.jpg" hidden onChange={e => { if(e.target.files?.length) { const p = {id:Date.now(),name:e.target.files[0].name,created:"now",kind:"document" as const}; setProjects(cur=>[p,...cur]); } e.currentTarget.value=""; }}/>
          </div>
        </header>

        <div className="table-head">
          <button className="column-name" onClick={() => setSortOldest(v => !v)}>Name <ArrowUpDown size={13}/></button>
          <button className="column-created" onClick={() => setSortOldest(v => !v)}>Created <ChevronDown size={13}/></button>
        </div>

        {showFolder && <div className="modal-backdrop" onClick={() => setShowFolder(false)}><div className="modal" onClick={e => e.stopPropagation()}><div className="modal-heading"><strong>New folder</strong><button className="icon-button" onClick={() => setShowFolder(false)}><X size={18}/></button></div><input autoFocus value={folderName} onChange={e=>setFolderName(e.target.value)} placeholder="Folder name"/><div className="modal-actions"><button className="subtle-button" onClick={()=>setShowFolder(false)}>Cancel</button><button className="new-button small" onClick={()=>{if(folderName.trim())setFolders(v=>[...v,folderName.trim()]);setFolderName("");setShowFolder(false);}}>Create folder</button></div></div></div>}

        <div className={`project-list ${grid ? "project-grid" : ""}`}>
          {visibleProjects.map(project => (
            <article className="project-row" key={project.id} onDoubleClick={() => { setRenaming(project.id); setRenameValue(project.name); }}>
              <div className="project-thumb">{project.kind === "document" ? <div className="paper-thumb"><span/> <span/> <span/> <span/></div> : <Settings size={19}/>}</div>
              <div className="project-title">
                {renaming === project.id ? <form onSubmit={e=>{e.preventDefault();commitRename(project.id);}}><input autoFocus value={renameValue} onChange={e=>setRenameValue(e.target.value)} onBlur={()=>commitRename(project.id)} onKeyDown={e=>{if(e.key==="Escape")setRenaming(null);}}/></form> : <a className="project-open-link" href={`/project/${project.id}?name=${encodeURIComponent(project.name)}`} title="Open project">{project.name}</a>}
              </div>
              <span className="created-time">{project.created}</span>
              <div className="row-menu-wrap">
                <button className="row-more" aria-label={`Options for ${project.name}`} onClick={() => setSelected(selected === project.id ? null : project.id)}><MoreHorizontal size={18}/></button>
                {selected === project.id && <div className="dropdown row-menu"><button onClick={()=>{setRenaming(project.id);setRenameValue(project.name);setSelected(null);}}><Pencil size={15}/> Rename</button><button onClick={()=>setSelected(null)}><Share2 size={15}/> Share</button><button className="danger" onClick={()=>deleteProject(project.id)}><Trash2 size={15}/> Delete</button></div>}
              </div>
            </article>
          ))}
          {folders.map((folder,i)=><article className="project-row" key={`folder-${i}`}><div className="project-thumb"><FolderPlus size={20}/></div><div className="project-title"><button>{folder}</button></div><span className="created-time">now</span></article>)}
          {visibleProjects.length === 0 && <div className="empty-state"><Search size={28}/><strong>No projects found</strong><span>Try a different search term.</span></div>}
        </div>
      </section>
    </main>
  );
}