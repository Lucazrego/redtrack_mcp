# RedTrack MCP Server

A stateless Model Context Protocol (MCP) server that exposes RedTrack attribution data via two endpoints and can be deployed with one click on Railway.

## Endpoints
| Method | Path       | Purpose                                  |
| ------ | ---------- | ---------------------------------------- |
| GET    | /manifest  | Returns MCP manifest (tools description) |
| POST   | /run       | Executes a tool (e.g., `get_conversions`) and returns JSON |

### Example Run Payload
```jsonc
{
  "tool": "get_conversions",
  "input": {
    "startDate": "2025-07-01",
    "endDate": "2025-07-08"
  }
}
```

## Quick Start (local test)
```bash
npm install
REDTRACK_KEY=YOUR_KEY node package.json
```
Visit `http://localhost:3000/manifest`.

## One-Click Deploy on Railway
1. Fork or push this repo to GitHub.
2. Click the Railway template link below or create a new project → “Deploy from GitHub”.
3. Add env vars:
   * `REDTRACK_KEY` – your RedTrack API key.
4. Deployment finishes and exposes a public HTTPS URL.

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.com/deploy?repo=https://github.com/your/repo)

## IDE Configuration Snippet
Add this server in your IDE’s MCP settings:
```json
{
  "mcpServers": {
    "redtrack": {
      "url": "https://<your-subdomain>.up.railway.app/mcp",
      "type": "http"
    }
  }
}
```

The IDE will request `/mcp` for the handshake, then `/mcp/run` for tool execution.

## Key Files for Senior Developer Review
Share these 6 files (all under 10) so a senior dev can understand and extend the service:
| File | Purpose |
| ---- | ------- |
| `package.json` | Express bootstrap, routing, aliases, JSON-RPC handling |
| `redtrack.mjs` | Thin RedTrack API client and tool dispatcher |
| `manifest.mjs` | In-memory MCP manifest with tool definitions |
| `package.json` | Dependencies (`express`, `node-fetch`) and start script |
| `README.md` | Project overview, deployment & IDE instructions (this file) |
| `.gitignore` | Ignore `node_modules/` & local secrets |

No other local assets are required; everything else is generated at runtime.
