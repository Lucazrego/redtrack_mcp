import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { z } from "zod";

// ── RedTrack API helper ──────────────────────────────────────────────
const REDTRACK_API = "https://api.redtrack.io";
const API_KEY = process.env.REDTRACK_KEY;

if (!API_KEY) {
  console.error("REDTRACK_KEY environment variable is required");
  process.exit(1);
}

async function redtrackFetch(path, params = {}) {
  const url = new URL(path, REDTRACK_API);
  url.searchParams.set("api_key", API_KEY);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  console.log(`[RedTrack API] ${url.toString().replace(API_KEY, "***")}`);

  const res = await fetch(url.toString(), {
    headers: { "Accept": "application/json" }
  });

  const bodyText = await res.text();
  console.log(`[RedTrack API] Status: ${res.status}, Body length: ${bodyText.length}`);

  if (!res.ok) {
    console.error(`[RedTrack API] Error body: ${bodyText.substring(0, 500)}`);
    throw new Error(`RedTrack API error ${res.status}: ${bodyText.substring(0, 300)}`);
  }

  try {
    return JSON.parse(bodyText);
  } catch {
    return { raw: bodyText };
  }
}

// ── MCP Server ───────────────────────────────────────────────────────
const server = new McpServer({
  name: "redtrack-mcp-server",
  version: "2.0.0"
});

// Tool: ping
server.registerTool(
  "ping",
  {
    title: "Ping",
    description: "Health check. Returns 'pong'.",
    inputSchema: {},
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async () => {
    return { content: [{ type: "text", text: "pong" }] };
  }
);

// Tool: get_conversions
server.registerTool(
  "get_conversions",
  {
    title: "Get Conversions",
    description: `Return a list of conversions from RedTrack between two dates.

Args:
  - date_from (string): Start date in YYYY-MM-DD format
  - date_to (string): End date in YYYY-MM-DD format

Returns:
  JSON array of conversion objects with details like click ID, offer, payout, revenue, etc.

Examples:
  - "Show my conversions from the last 7 days"
  - "How many conversions did I get yesterday?"`,
    inputSchema: {
      date_from: z.string().describe("Start date (YYYY-MM-DD)"),
      date_to: z.string().describe("End date (YYYY-MM-DD)")
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async ({ date_from, date_to }) => {
    try {
      const data = await redtrackFetch("/conversions", { date_from, date_to });
      const conversions = Array.isArray(data) ? data : (data.conversions || data.rows || data.value || []);
      return {
        content: [{
          type: "text",
          text: `Found ${conversions.length} conversion(s) between ${date_from} and ${date_to}.\n\n${JSON.stringify(conversions, null, 2)}`
        }]
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error fetching conversions: ${err.message}` }],
        isError: true
      };
    }
  }
);

// Tool: export_conversions
server.registerTool(
  "export_conversions",
  {
    title: "Export Conversions",
    description: `Export conversions log from RedTrack between two dates (alternative endpoint).

Args:
  - date_from (string): Start date in YYYY-MM-DD format
  - date_to (string): End date in YYYY-MM-DD format

Returns:
  Exported conversion data.`,
    inputSchema: {
      date_from: z.string().describe("Start date (YYYY-MM-DD)"),
      date_to: z.string().describe("End date (YYYY-MM-DD)")
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async ({ date_from, date_to }) => {
    try {
      const data = await redtrackFetch("/conversions/export", { date_from, date_to });
      return {
        content: [{
          type: "text",
          text: `Exported conversions between ${date_from} and ${date_to}:\n\n${JSON.stringify(data, null, 2)}`
        }]
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error exporting conversions: ${err.message}` }],
        isError: true
      };
    }
  }
);

// Tool: list_reference_data
server.registerTool(
  "list_reference_data",
  {
    title: "List Reference Data",
    description: `Fetch reference/lookup data from RedTrack such as countries, browsers, devices, OS, languages, ISPs, etc.

Args:
  - data_type (string): One of: countries, browsers, browser_fullnames, devices, device_fullnames, device_brands, os, os_fullnames, categories, cities, regions, languages, isp, currencies, timezones, connection_types, proxy_types

Returns:
  JSON array of reference data items.

Examples:
  - "List all available countries in RedTrack"
  - "Show me the browser list"`,
    inputSchema: {
      data_type: z.enum([
        "countries", "browsers", "browser_fullnames", "devices",
        "device_fullnames", "device_brands", "os", "os_fullnames",
        "categories", "cities", "regions", "languages", "isp",
        "currencies", "timezones", "connection_types", "proxy_types"
      ]).describe("Type of reference data to fetch")
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async ({ data_type }) => {
    try {
      const data = await redtrackFetch(`/${data_type}`);
      const items = Array.isArray(data) ? data : (data.value || data.items || data);
      return {
        content: [{
          type: "text",
          text: `RedTrack ${data_type} (${Array.isArray(items) ? items.length : 'N/A'} items):\n\n${JSON.stringify(items, null, 2)}`
        }]
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error fetching ${data_type}: ${err.message}` }],
        isError: true
      };
    }
  }
);

// Tool: debug_api_call
server.registerTool(
  "debug_api_call",
  {
    title: "Debug API Call",
    description: `Make a raw GET request to any RedTrack API endpoint for debugging.
Use this to test what endpoints and parameters work.

Args:
  - endpoint (string): The API path (e.g., "/conversions", "/countries")
  - params (string, optional): Query parameters as JSON string (e.g., '{"date_from":"2025-01-01","date_to":"2025-01-31"}')

Returns:
  Raw API response including status and body for debugging.

Examples:
  - endpoint: "/conversions", params: '{"date_from":"2025-02-01","date_to":"2025-02-25"}'
  - endpoint: "/countries"
  - endpoint: "/currencies"`,
    inputSchema: {
      endpoint: z.string().describe("API endpoint path starting with / (e.g., /conversions)"),
      params: z.string().optional().describe("Optional JSON string of extra query parameters")
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async ({ endpoint, params }) => {
    try {
      const queryParams = params ? JSON.parse(params) : {};
      const data = await redtrackFetch(endpoint, queryParams);
      return {
        content: [{
          type: "text",
          text: `Response from GET ${endpoint}:\n\n${JSON.stringify(data, null, 2)}`
        }]
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Debug call to ${endpoint} failed: ${err.message}` }],
        isError: true
      };
    }
  }
);

// ── Streamable HTTP Transport ────────────────────────────────────────
const app = express();
app.use(express.json());

app.post("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });
  res.on("close", () => transport.close());
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.get("/mcp", (req, res) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed. Use POST." },
    id: null
  });
});

app.delete("/mcp", (req, res) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed." },
    id: null
  });
});

app.get("/", (req, res) => {
  res.json({ status: "ok", name: "redtrack-mcp-server", version: "2.0.0" });
});

const port = parseInt(process.env.PORT || "8080");
app.listen(port, () => {
  console.log(`RedTrack MCP server v2.0.0 listening on port ${port}`);
});
