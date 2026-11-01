# Open Research Studio

An independent AI-assisted scientific writing workspace, inspired by the workflow of modern research editors.

## Current implementation

The first milestone recreates the signed-in project dashboard shown in the supplied reference screenshots:

- Dark workspace shell with collapsible left navigation
- All Projects, Your Projects, and Shared with you views
- Searchable project list
- List and grid layouts
- Project creation menu: Blank project, Example project, New folder
- Import menu for files and LaTeX ZIP projects
- Rename and delete project actions
- Responsive layout for smaller screens

The dashboard currently uses local in-browser state and sample project rows. Authentication, persistent storage, real import/parsing, live LaTeX compilation, PDF rendering, AI assistance, citations, and collaboration are planned follow-on milestones and are not yet implemented.

## Tech stack

- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Lucide icons

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Roadmap

1. Workspace UI and project navigation
2. Durable user accounts, project storage, and file uploads
3. Multi-file LaTeX editor with autosave
4. TeX compilation service and PDF preview
5. AI writing and LaTeX debugging assistant
6. Bibliography, citation, and figure management
7. Sharing, permissions, and export

## Note

This is an independent implementation. It does not use OpenAI's private source code, internal APIs, or proprietary assets, and is not affiliated with OpenAI.
