#!/usr/bin/env node
/**
 * MCP server for the NOVA WORKS event-production app.
 *
 * Exposes the Crewplanungen, the freelancer roster and the per-event documents
 * (Hotelplanung, Schichtplan, Bauzeitenplan) that the static HTML tools keep in
 * the Supabase `app_data` key-value table.
 *
 * Transport: stdio. Configure via NOVA_SUPABASE_URL, NOVA_SUPABASE_KEY,
 * NOVA_ALLOW_WRITE and NOVA_CREWPLANUNG_HTML.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { ALLOW_WRITE, SUPABASE_URL } from "./constants.js";
import { registerCrewTools } from "./tools/crew.js";
import { registerDocumentTools } from "./tools/documents.js";
import { registerProjectTools } from "./tools/projects.js";
import { registerRawTools } from "./tools/raw.js";
import { registerWriteTools } from "./tools/write.js";

const server = new McpServer(
  { name: "nova-works-mcp-server", version: "1.0.0" },
  {
    instructions: [
      "Tools for the NOVA WORKS event-production planning app.",
      "",
      "Start from nova_list_projects to find a Crewplanung, then nova_get_project for its crew.",
      "nova_search_crew answers 'where is person X booked', nova_staffing_gaps shows what is",
      "still unconfirmed, and nova_find_conflicts reports people double-booked across projects.",
      "nova_search_technicians is the freelancer address book, not the booking list.",
      "Per-event documents are reached via nova_list_events first, since they are keyed by",
      "event name rather than by project id.",
      "",
      "All dates are ISO (YYYY-MM-DD); phase fields store a range as 'start/end'.",
      "Booking status is one of angefragt, bestaetigt, abgesagt.",
      ALLOW_WRITE
        ? "Writing is ENABLED: nova_set_crew_status and nova_add_crew_member modify live planning data."
        : "Writing is disabled; the mutating tools will explain how to enable it.",
    ].join("\n"),
  },
);

registerProjectTools(server);
registerCrewTools(server);
registerDocumentTools(server);
registerRawTools(server);
registerWriteTools(server);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `nova-works-mcp-server ready on stdio — project ${SUPABASE_URL}, writes ${ALLOW_WRITE ? "enabled" : "disabled"}`,
  );
}

main().catch((error: unknown) => {
  console.error(
    "nova-works-mcp-server failed to start:",
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});
