/**
 * Report-context glue for the chat: the identity of the report the user is
 * currently looking at, plus the prompts that key the agent on it.
 *
 * File mode needs none of this — the SPARQL backend is scoped to the one report
 * already. SEC mode queries a shared graph of thousands of filers, so to ask
 * "about this report" the agent must be told WHICH entity/report to anchor on;
 * `secContextNote` is appended to the backend system prompt for those calls.
 */

/** Identity of the SEC filing on screen, lifted out of `SecMode` for the chat. */
export interface SecReportContext {
  entityName: string
  ticker: string | null
  form: string
  reportDate: string | null
  /** The Report node's `identifier` — a selective Cypher anchor. */
  reportId: string
}

/**
 * A system-prompt suffix telling the Cypher agent to anchor on this specific
 * filing. Used for the one-click summary always, and for ordinary SEC chat only
 * when the user pins the report.
 */
export function secContextNote(ctx: SecReportContext): string {
  const ticker = ctx.ticker ? ` (${ctx.ticker})` : ''
  const dated = ctx.reportDate ? ` dated ${ctx.reportDate}` : ''
  return `REPORT IN CONTEXT — the user is currently viewing this specific filing:
  Company: ${ctx.entityName}${ticker}
  Filing: ${ctx.form}${dated}
  Report identifier: ${ctx.reportId}
Anchor your queries on this Entity (match by ticker or the company name) and, when the question is about "this report" / "this filing", on the Report with identifier "${ctx.reportId}". If the user clearly asks about a different company or the graph at large, answer that instead.`
}

/**
 * The one-click "business summary" instruction. Sent as the user turn; kept
 * short and prose-shaped because it may be read aloud.
 */
export const SUMMARY_PROMPT = `Give me a concise business summary of this company based on this financial report. Cover, in a few short paragraphs of plain prose (no tables, no bullet lists — this may be read aloud):
1. What the company does.
2. Its financial position and how it performed over the period — cite the key figures (revenue, net income, total assets, cash) with their periods.
3. Anything notable or unusual in the numbers.
Bold only the most important figures. Keep it tight and readable.`
