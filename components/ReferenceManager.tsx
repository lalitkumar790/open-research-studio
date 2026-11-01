"use client";

import { useMemo, useState } from "react";
import { BookOpen, ChevronDown, ChevronRight, Search } from "lucide-react";

type ReferenceItem = {
  key: string;
  type: string;
  title: string;
  author: string;
  year: string;
  file: string;
};

function readField(entry: string, field: string) {
  const match = entry.match(new RegExp("\\b" + field + "\\s*=\\s*(?:\\{([^}]*)\\}|\"([^\"]*)\"|([\\w-]+))", "i"));
  return (match?.[1] ?? match?.[2] ?? match?.[3] ?? "").replace(/[\r\n]+/g, " ").trim();
}

function parseBibFiles(files: Record<string, string>): ReferenceItem[] {
  const items: ReferenceItem[] = [];
  for (const [file, contents] of Object.entries(files)) {
    if (!file.toLowerCase().endsWith(".bib") || typeof contents !== "string") continue;
    const entries = contents.split(/(?=^\s*@)/m).filter(part => /^\s*@(?!comment\b|preamble\b|string\b)/i.test(part));
    for (const entry of entries) {
      const head = entry.match(/^\s*@([a-z]+)\s*[({]\s*([^,\s]+)\s*,/i);
      if (!head) continue;
      items.push({
        key: head[2],
        type: head[1].toLowerCase(),
        title: readField(entry, "title"),
        author: readField(entry, "author"),
        year: readField(entry, "year"),
        file
      });
    }
  }
  return items;
}

export default function ReferenceManager({
  files,
  onInsert
}: {
  files: Record<string, string>;
  onInsert: (citation: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(true);
  const references = useMemo(() => parseBibFiles(files), [files]);
  const filtered = references.filter(item =>
    [item.key, item.title, item.author, item.year, item.file].join(" ").toLowerCase().includes(query.toLowerCase())
  );

  return (
    <section className="reference-manager">
      <button className="reference-manager-heading" onClick={() => setExpanded(value => !value)} aria-expanded={expanded}>
        <span><BookOpen size={14}/> REFERENCES <span className="reference-count">{references.length}</span></span>
        {expanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
      </button>
      {expanded && (
        <div className="reference-manager-body">
          {references.length > 0 ? (
            <>
              <label className="reference-search">
                <Search size={13}/>
                <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a reference…" aria-label="Search references"/>
              </label>
              <div className="reference-list">
                {filtered.map((item, index) => (
                  <div className="reference-item" key={item.file + ":" + item.key + ":" + index}>
                    <div className="reference-item-copy">
                      <strong>{item.key}</strong>
                      <span>{item.title || item.author || item.type}</span>
                      <small>{[item.author, item.year, item.file].filter(Boolean).join(" · ")}</small>
                    </div>
                    <button title={"Insert citation for " + item.key} onClick={() => onInsert("\\cite{" + item.key + "}")}>Cite</button>
                  </div>
                ))}
                {filtered.length === 0 && <p className="reference-empty">No matching references.</p>}
              </div>
            </>
          ) : (
            <p className="reference-empty">Add a .bib file to browse and insert citations.</p>
          )}
        </div>
      )}
    </section>
  );
}
