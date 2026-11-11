import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { getUserByMcpToken } from "@/lib/auth";
import { baseUrlFrom } from "@/lib/url";
import { buildMcpServer } from "@/mcp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(req: NextRequest, ctx: RouteContext<"/api/mcp/[token]">) {
  const { token } = await ctx.params;
  const user = await getUserByMcpToken(token);
  if (!user) {
    return Response.json(
      {
        jsonrpc: "2.0",
        error: { code: -32001, message: "Unknown BillDrop connector URL. Copy it again from the Connect page." },
        id: null,
      },
      { status: 404 },
    );
  }

  const db = await getDb();
  const server = buildMcpServer(db, user, baseUrlFrom(req));
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  try {
    return await transport.handleRequest(req);
  } finally {
    await server.close();
  }
}

export { handle as GET, handle as POST, handle as DELETE };
