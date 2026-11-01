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

The dashboard uses sample project rows and browser state. The editor supports editing a starter LaTeX document, browser-local autosave, a PDF preview pane, source export, and a Tectonic compile API that returns real PDF bytes when the Tectonic binary is installed. A Dockerfile and Compose setup package the app with Tectonic for self-hosting. Authentication, server-side persistent project storage, multi-file project uploads, AI-provider integration, citations, and collaboration are not yet implemented.

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

1. Workspace UI and project navigation — implemented
2. Single-file LaTeX editor with browser-local autosave — initial UI implemented
3. Three-pane workspace with file tree, source editor, PDF preview, and AI assistant panel — initial UI implemented
4. Tectonic compile API, PDF response, and self-hosted Docker packaging — implemented, requires Tectonic runtime
5. Durable user accounts, project storage, and multi-file uploads
6. AI writing and LaTeX debugging assistant backed by a configured provider
7. Bibliography, citation, figure management, sharing, permissions, and export

## Note

This is an independent implementation. It does not use OpenAI's private source code, internal APIs, or proprietary assets, and is not affiliated with OpenAI.


## Current limitations

- Dashboard projects and folders are stored in browser local storage, not an account-backed database. They do not sync across browsers or devices.
- Editor source is stored locally per project in the current browser.
- Vercel hosts the web interface, but hosted LaTeX compilation is not enabled yet. The current Tectonic integration requires a native executable; use the Docker deployment for compilation.
