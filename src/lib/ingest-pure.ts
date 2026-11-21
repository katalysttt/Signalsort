// Pure parsing helpers (no database access) — unit-testable.
export function cleanText(t: string): string {
  return t
    .replace(/\r\n?/g, "\n")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export interface ParsedItem {
  text: string;
  author?: string | null;
  createdAt?: string | null;
}

const TEXT_COLS = /^(feedback|review|reviews|comment|comments|text|body|message|response|answer|content|description|verbatim|note|notes|feedback_text|review_text)$/i;
const AUTHOR_COLS = /^(author|user|user_id|customer|customer_id|name|email|respondent|reviewer|username)$/i;
const DATE_COLS = /^(date|created|created_at|timestamp|submitted|submitted_at|time|review_date)$/i;

/** Split pasted text: blank lines or one-item-per-line when lines are short. */
export function splitPasted(text: string): string[] {
  const t = cleanText(text);
  if (!t) return [];
  const blocks = t.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
  if (blocks.length > 1) return blocks;
  const lines = t.split("\n").map((s) => s.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").replace(/^["“](.*)["”]$/, "$1").trim()).filter(Boolean);
  return lines.length > 1 ? lines : [t];
}

/**
 * Transcripts & support conversations: keep the participant/customer turns,
 * drop the interviewer/agent turns. Lines without speaker labels are kept.
 */
export function splitTranscript(text: string, kind: "transcript" | "support"): ParsedItem[] {
  const t = cleanText(text);
  const lines = t.split("\n");
  const speakerRe = /^\s*\[?(?:\d{1,2}:\d{2}(?::\d{2})?\]?\s*)?([A-Za-z][\w .'-]{0,30}?)\s*[:：]\s*(.*)$/;
  const staff = kind === "support" ? /^(agent|support|staff|rep|representative|bot|assistant|operator)\b/i : /^(interviewer|moderator|researcher|host|facilitator|q|question|me|pm)\b/i;
  const turns: { speaker: string | null; text: string }[] = [];
  let hasSpeakers = false;
  for (const line of lines) {
    const m = speakerRe.exec(line);
    if (m && m[2] !== undefined && m[1].split(" ").length <= 4) {
      hasSpeakers = true;
      turns.push({ speaker: m[1].trim(), text: m[2].trim() });
    } else if (turns.length && line.trim()) {
      turns[turns.length - 1].text += " " + line.trim();
    } else if (line.trim()) {
      turns.push({ speaker: null, text: line.trim() });
    }
  }
  if (!hasSpeakers) {
    // Unlabelled transcript: paragraph chunks.
    return t
      .split(/\n\s*\n/)
      .map((p) => p.replace(/\n/g, " ").trim())
      .filter((p) => p.length > 15)
      .map((p) => ({ text: p }));
  }
  return turns
    .filter((x) => x.speaker && !staff.test(x.speaker) && x.text.length > 15)
    .map((x) => ({ text: x.text, author: x.speaker }));
}

export function parseRows(rows: Record<string, unknown>[], survey: boolean): ParsedItem[] {
  if (!rows.length) return [];
  const cols = Object.keys(rows[0]);
  const avgLen = (c: string) => rows.slice(0, 50).reduce((n, r) => n + String(r[c] ?? "").length, 0) / Math.min(rows.length, 50);
  const authorCol = cols.find((c) => AUTHOR_COLS.test(c.trim()));
  const dateCol = cols.find((c) => DATE_COLS.test(c.trim()));
  const textish = cols.filter((c) => c !== authorCol && c !== dateCol && avgLen(c) > 12 && rows.some((r) => /[a-z]{3,}\s+[a-z]{2,}/i.test(String(r[c] ?? ""))));
  const out: ParsedItem[] = [];
  const named = cols.find((c) => TEXT_COLS.test(c.trim()));
  const textCols = survey ? (textish.length ? textish : named ? [named] : []) : named ? [named] : textish.sort((a, b) => avgLen(b) - avgLen(a)).slice(0, 1);
  for (const r of rows) {
    for (const c of textCols) {
      const v = cleanText(String(r[c] ?? ""));
      if (v.length < 3) continue;
      out.push({
        text: survey && textCols.length > 1 ? `${v}` : v,
        author: authorCol ? String(r[authorCol] ?? "") || null : null,
        createdAt: dateCol && r[dateCol] ? safeDate(String(r[dateCol])) : null,
      });
    }
  }
  return out;
}

function safeDate(s: string): string | null {
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

