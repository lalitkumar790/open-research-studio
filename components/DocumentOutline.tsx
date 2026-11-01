"use client";

import { useMemo } from "react";

type OutlineEntry = { title: string; line: number; level: number };

type DocumentOutlineProps = {
  source: string;
  onJump: (line: number) => void;
};

export default function DocumentOutline({ source, onJump }: DocumentOutlineProps) {
  const entries = useMemo<OutlineEntry[]>(() => {
    const levels: Record<string, number> = {
      part: 0,
      chapter: 1,
      section: 2,
      subsection: 3,
      subsubsection: 4,
      paragraph: 5,
      subparagraph: 6,
    };

    return source.split("\n").flatMap((line, index) => {
      const match = line.match(/^\s*\\(part|chapter|section|subsection|subsubsection|paragraph|subparagraph)\*?\s*(?:\[[^\]]*\])?\s*\{([^}]*)\}/);
      if (!match) return [];
      return [{
        title: match[2].trim(),
        line: index + 1,
        level: levels[match[1]] ?? 2,
      }];
    });
  }, [source]);

  return (
    <section className="outline-panel" aria-label="Document outline">
      <div className="outline-title">OUTLINE</div>
      {entries.length ? entries.map((entry, index) => (
        <button
          key={entry.line + "-" + index}
          className="outline-item"
          style={{ paddingLeft: 10 + entry.level * 9 }}
          title={"Go to line " + entry.line}
          onClick={() => onJump(entry.line)}
        >
          <span>{entry.title}</span>
          <small>{entry.line}</small>
        </button>
      )) : <div className="outline-empty">No section headings in this file.</div>}
    </section>
  );
}
