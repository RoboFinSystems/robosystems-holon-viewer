# RoboSystems Holon Viewer

RoboSystems Holon Viewer is a static, client-side renderer for `holon.jsonld` financial reports — the analog of Arelle's `ixbrl-viewer`. A holon is a portable RDF artifact, not self-rendering HTML, so the viewer reconstructs the financial statements from the graph and layers on interactive inspection, in-browser SPARQL, and AI analysis. No sign-up and no backend — open a file and go.

- **File Mode**: Open a local `holon.jsonld` and render the full report — offline, no API key, no backend, no network call.
- **SEC Mode**: Search any public company and pull its report from the live SEC knowledge graph with your own RoboSystems API key. Same renderer; the authenticated call is made client-side.
- **Statement Rendering**: Reconstructs the complete report — balance sheet, income statement, cash flow, equity, and every disclosure section — from the holon's scene / boundary / projection named graphs, with a table-of-contents sidebar for navigation.
- **Dimensional Facts & Disclosures**: Renders dimensional breakdowns (segments and other axes) and text-block note disclosures alongside the numeric statements, at full fidelity.
- **Fact Inspection**: Inspect any fact — its element, period, unit, and the calculation rule it participates in — directly in the statement tables.
- **AI Analysis**: Ask questions of the loaded report in natural language. A Claude-powered agent answers by running SPARQL over the holon in your browser (MCP-style tools), so responses are grounded in the report's actual facts.
- **One-Click Summary**: Generate an AI narrative overview of the report on demand.
- **Voice**: Have summaries and answers read aloud via ElevenLabs text-to-speech, with a configurable voice.
- **In-Browser SPARQL**: A Comunica SPARQL engine runs entirely client-side over the report's RDF — it powers the AI's query tool with no server round-trip.
- **Bring-Your-Own Keys**: Anthropic, ElevenLabs, and RoboSystems API keys are entered in a keys drawer and persisted only in your browser — never sent to an app backend (there isn't one).

## Quick Start

```bash
npm install      # Install dependencies
npm run dev      # Start the dev server (Vite, default http://localhost:5173)
```

Open the bundled sample report, or drag in your own `holon.jsonld`. Build a holon from any SEC filing with [`robosystems-xbrl-holon`](https://github.com/RoboFinSystems/robosystems-xbrl-holon).

### Configuration

File Mode needs no configuration. For **SEC Mode**, the viewer talks to the RoboSystems API — production (`https://api.robosystems.ai`) by default. To point it at a local backend, copy the env template and set the URL:

```bash
cp .env.example .env
# VITE_ROBOSYSTEMS_API_URL=http://localhost:8000
```

In `npm run dev` the dev server proxies `/v1/*` to that target server-side, so a local backend works without a CORS allowlist entry. (Inline still works too: `VITE_ROBOSYSTEMS_API_URL=http://localhost:8000 npm run dev`.)

## Development Commands

### Core Development

```bash
npm run dev              # Start the Vite dev server
npm run build            # Production build → dist/ (pure static files)
npm run preview          # Preview the production build locally
```

### Testing

```bash
npm run test:all         # format:check + lint + typecheck + test + build (the CI gate)
npm run test             # Run the Vitest test suite
npm run test:watch       # Vitest in watch mode
```

### Code Quality

```bash
npm run lint             # ESLint validation
npm run lint:fix         # Auto-fix linting issues
npm run format           # Prettier code formatting
npm run format:check     # Check formatting compliance
npm run typecheck        # TypeScript type checking
```

### SDLC Commands

```bash
npm run feature:create   # Create a feature branch
```

### Prerequisites

#### System Requirements

- Node.js 18+
- npm
- Modern browser (Chrome, Firefox, Safari, Edge)

#### API Keys (bring-your-own, optional)

Keys are entered in the app's keys drawer and stored only in your browser.

- **File Mode** needs none.
- **RoboSystems API key** — for SEC Mode (pull live company reports)
- **Anthropic API key** — for AI analysis and summaries
- **ElevenLabs API key** — for voice / read-aloud

#### Deployment Requirements

- Fork this repo
- AWS account with IAM Identity Center (SSO)
- S3 + CloudFront for static hosting, provisioned via CloudFormation

## Architecture

**Application Layer:**

- Vite + React 19 + TypeScript single-page app
- [`@robosystems/report-components`](https://github.com/RoboFinSystems/robosystems-report-components) — the source-agnostic rendering library shared with the RoboLedger app and others; this repo is the shell around it
- N3.js quad store + Comunica for in-browser RDF and SPARQL
- Anthropic SDK for AI; ElevenLabs for voice
- `@robosystems/client` (RoboSystems TypeScript SDK) for SEC-mode reads

**Rendering:**

The render logic is not in this app — it lives in `@robosystems/report-components`. The viewer supplies two read-only adapters (a `holon.jsonld` file parser and a SEC graph client) plus the UI shell: file-drop / SEC-connect UX, fact inspection, chat, voice, and branding.

**Infrastructure:**

- Builds to pure static files — no backend at runtime
- Hosted on AWS S3 + CloudFront
- CloudFormation-managed; deployed via GitHub Actions

## CI/CD

- **`deploy.yml`**: Static-site deploy to S3 + CloudFront (manual dispatch)
- **`test.yml`**: Automated testing on pull requests

## Support

- [Issues](https://github.com/RoboFinSystems/robosystems-holon-viewer/issues)
- [Wiki](https://github.com/RoboFinSystems/robosystems/wiki)
- [Discussions](https://github.com/orgs/RoboFinSystems/discussions)

## License

MIT — see [`LICENSE`](./LICENSE).

MIT © 2026 RFS LLC
