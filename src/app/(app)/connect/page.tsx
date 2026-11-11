import { headers } from "next/headers";
import { rotateMcpToken } from "@/app/actions/settings";
import { CopyButton } from "@/components/client-utils";
import { DEMO_EMAIL } from "@/db/seed";
import { requireUser } from "@/lib/auth";
import { baseUrlFromHeaders } from "@/lib/url";

const prompts = [
  "Invoice Lumen Labs (finance@lumenlabs.io) for 3 days of UX research at $750/day and $90 for user-testing incentives. Due in 14 days, add 18% GST.",
  "Here's the email thread with my client — turn the agreed scope into a BillDrop invoice.",
  "Who owes me money right now? Draft a polite reminder for anything overdue.",
  "Add a 10% discount to INV-0003 and push the due date to the end of the month, then publish it.",
];

export default async function ConnectPage({ searchParams }: PageProps<"/connect">) {
  const user = await requireUser();
  const { welcome } = await searchParams;
  const mcpUrl = `${baseUrlFromHeaders(await headers())}/api/mcp/${user.mcpToken}`;
  const isDemo = user.email === DEMO_EMAIL;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {welcome && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          Welcome to BillDrop, {user.name.split(" ")[0]}! One last step: connect your Claude.
        </div>
      )}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Connect Claude</h1>
        <p className="mt-1 text-sm text-slate-500">
          BillDrop has no AI inside. Your own Claude does the thinking and sends the results here.
        </p>
      </div>

      <div className="card p-6">
        <p className="label">Your personal connector URL</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <code className="flex-1 overflow-x-auto whitespace-nowrap rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs leading-6 text-slate-800">
            {mcpUrl}
          </code>
          <CopyButton text={mcpUrl} label="Copy URL" className="btn-primary" />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Treat it like a password — anyone with this URL can create invoices in your account.
        </p>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold">Add it to Claude (2 minutes)</h2>
        <ol className="mt-4 space-y-3 text-sm text-slate-700">
          <li className="flex gap-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">1</span>
            <span>
              Open <a className="font-medium text-brand-600 hover:underline" href="https://claude.ai/settings/connectors" target="_blank" rel="noreferrer">claude.ai → Settings → Connectors</a>.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">2</span>
            <span>
              Click <b>Add custom connector</b>, name it <b>BillDrop</b>, paste the URL above and click <b>Add</b>. No
              OAuth or API key needed.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">3</span>
            <span>
              In a new chat, open the <b>+ / tools</b> menu and make sure <b>BillDrop</b> is enabled. Then just ask.
            </span>
          </li>
        </ol>
        <p className="mt-4 text-xs text-slate-500">
          Works in Claude on the web, desktop and mobile. Also works with any MCP client that supports remote
          “Streamable HTTP” servers (Claude Desktop, Cursor, ChatGPT developer mode…).
        </p>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold">Things to try</h2>
        <ul className="mt-4 space-y-2">
          {prompts.map((p) => (
            <li key={p} className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
              <span>“{p}”</span>
              <CopyButton text={p} label="Copy" className="btn-ghost px-2 py-1 text-xs" />
            </li>
          ))}
        </ul>
      </div>

      {!isDemo && (
        <form action={rotateMcpToken} className="text-right">
          <button className="btn-danger text-xs">Regenerate URL (disconnects existing Claude connections)</button>
        </form>
      )}
    </div>
  );
}
