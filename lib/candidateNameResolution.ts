/**
 * When PDF text extraction misses a graphic header, the model may put a job title
 * or certification line in candidateName. We detect that and fall back to the
 * upload file name when it looks like "First Last … Resume.pdf".
 *
 * When the model returns first+last but the filename or first header line includes
 * middle name(s), we merge to the fuller string when tokens match in order.
 *
 * PDF extract often breaks the printed name across lines (e.g. "SHERMAINE" /
 * "NARIO TOREJA"); we stitch 2–3 consecutive header lines before merging so
 * middle names are not lost.
 */

const ROLE_STOPWORDS = new Set([
  "business",
  "analyst",
  "engineer",
  "developer",
  "consultant",
  "manager",
  "director",
  "lead",
  "senior",
  "junior",
  "resume",
  "cv",
  "vitae",
  "sap",
  "certified",
  "associate",
  "specialist",
  "architect",
  "coordinator",
  "scientist",
  "designer",
  "administrator",
  "executive",
  "officer",
  "intern",
  "trainee",
  "professional",
  "summary",
  "profile",
  "objective",
  "about",
  "personal",
  "information",
  "contact",
  "curriculum",
  "overview",
  "background",
]);

/** True if the string looks like a headline role or certification, not a person’s name. */
export function looksLikeJobTitleOrCertification(name: string): boolean {
  const t = name.trim();
  if (!t) return true;

  if (t.length > 55) return true;

  const rolePatterns = [
    /\bSAP\b/i,
    /\bCERTIFIED\b/i,
    /\bCONSULTANT\b/i,
    /\bANALYST\b/i,
    /\bENGINEER\b/i,
    /\bIMPLEMENTATION\b/i,
    /\bPROCUREMENT\b/i,
    /\bASSOCIATE\b/i,
    /\bARIBA\b/i,
    /\bMANAGER\b/i,
    /\bDEVELOPER\b/i,
    /\bSPECIALIST\b/i,
    /\bARCHITECT\b/i,
    /\bBUSINESS\b/i,
  ];

  let hits = 0;
  for (const p of rolePatterns) {
    if (p.test(t)) hits += 1;
  }
  if (hits >= 2) return true;
  if (hits >= 1 && t.split(/\s+/).length >= 5) return true;

  if (/\bCERTIFIED\b/i.test(t) && t.split(/\s+/).length >= 3) return true;

  return false;
}

/**
 * Parse "Shermaine Toreja Business Analyst Resume.pdf" → "Shermaine Toreja".
 * Stops at common role words or resume/cv suffix.
 */
export function parseNameFromFileName(fileName: string): string | null {
  const base = fileName.replace(/[/\\]/g, "/").split("/").pop() ?? fileName;
  const noExt = base.replace(/\.[^./]+$/i, "").trim();
  if (!noExt) return null;

  const cleaned = noExt
    .replace(/\s*[-–—]\s*.*$/i, "")
    .replace(/\s+(resume|cv)\s*$/i, "")
    .trim();

  const rawTokens = cleaned.split(/\s+/).filter(Boolean);
  const nameParts: string[] = [];

  for (const tok of rawTokens) {
    const lower = tok.toLowerCase().replace(/[^a-z]/g, "");
    if (ROLE_STOPWORDS.has(lower)) break;
    if (/^\d+$/.test(tok)) break;
    if (tok.length > 45) break;
    nameParts.push(tok);
    if (nameParts.length >= 6) break;
  }

  if (nameParts.length < 2) return null;
  return nameParts.join(" ");
}

/** Two-word lines that are almost always a place, not a person name (avoids "John" + "New York"). */
function looksLikeCityPairLine(line: string): boolean {
  const words = line.trim().split(/\s+/).filter(Boolean);
  if (words.length !== 2) return false;
  const [a, b] = [normTok(words[0]), normTok(words[1])];
  const pairs: [string, string][] = [
    ["new", "york"],
    ["los", "angeles"],
    ["san", "francisco"],
    ["san", "diego"],
    ["san", "antonio"],
    ["san", "jose"],
    ["fort", "worth"],
    ["salt", "lake"],
    ["kansas", "city"],
    ["oklahoma", "city"],
    ["las", "vegas"],
    ["hong", "kong"],
    ["rio", "janeiro"],
    ["buenos", "aires"],
    ["delhi", "ncr"],
  ];
  return pairs.some(([x, y]) => a === x && b === y);
}

/**
 * Tokens on one line that can belong to a printed name (letters only; rejects role/doc words).
 */
function nameWordsFromLine(line: string): string[] | null {
  const raw = line.trim().split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (const w of raw) {
    if (w.length < 2) continue;
    if (!/^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'.-]*$/.test(w)) return null;
    if (/^(and|or|the|of|at|in)$/i.test(w)) return null;
    if (ROLE_STOPWORDS.has(normTok(w))) return null;
    out.push(w);
  }
  return out.length ? out : null;
}

/**
 * PDF extract often splits a heading across lines (e.g. "SHERMAINE" then "NARIO TOREJA").
 * Stitch up to 3 consecutive short lines when each looks like name tokens and the merge is 2–6 words.
 */
function guessNameFromStitchedHeaderLines(lines: string[], headLineCount: number): string | null {
  const limit = Math.min(headLineCount, lines.length);
  for (let i = 0; i < limit; i++) {
    const first = lines[i];
    if (first.length < 2 || first.length > 90 || /@/.test(first) || looksLikeJobTitleOrCertification(first)) {
      continue;
    }

    const parts: string[][] = [];
    for (let j = i; j < Math.min(i + 3, limit); j++) {
      const line = lines[j];
      if (line.length < 2 || line.length > 90 || /@/.test(line) || looksLikeJobTitleOrCertification(line)) {
        break;
      }
      if (parts.length > 0 && looksLikeCityPairLine(line)) {
        break;
      }

      const w = nameWordsFromLine(line);
      if (!w?.length || w.length > 4) break;
      parts.push(w);

      const flat = parts.flat();
      if (flat.length > 6) break;
      if (parts.length >= 2 && flat.length >= 2 && flat.length <= 6) {
        const candidate = flat.join(" ");
        if (!looksLikeJobTitleOrCertification(candidate)) {
          return candidate;
        }
      }
    }
  }
  return null;
}

function splitNonEmptyLines(text: string): string[] {
  return text
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

/** First lines often contain the full printed name; single line 3+ words, or 2–3 stitched lines. */
function guessNameFromFirstLines(text: string): string | null {
  const lines = splitNonEmptyLines(text);
  const head = Math.min(12, lines.length);

  const stitched = guessNameFromStitchedHeaderLines(lines, head);
  if (stitched) return stitched;

  for (let i = 0; i < Math.min(8, lines.length); i++) {
    const line = lines[i];
    if (line.length > 90 || line.length < 6) continue;
    if (looksLikeJobTitleOrCertification(line)) continue;
    if (/@/.test(line)) continue;

    const words = line.split(/\s+/).filter((w) => {
      return (
        w.length > 1 &&
        /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'.-]*$/.test(w) &&
        !/^(and|or|the|of|at|in)$/i.test(w)
      );
    });
    if (words.length >= 3 && words.length <= 6) {
      return words.join(" ");
    }
  }

  return null;
}

function guessNameFromLinesAboveEmail(text: string): string | null {
  const lines = splitNonEmptyLines(text);

  const emailIdx = lines.findIndex((l) => /\S+@\S+\.\S+/.test(l));
  if (emailIdx <= 0) return null;

  const start = Math.max(0, emailIdx - 8);
  const above = lines.slice(start, emailIdx);
  const stitched = guessNameFromStitchedHeaderLines(above, above.length);
  if (stitched) return stitched;

  for (let i = emailIdx - 1; i >= start; i--) {
    const line = lines[i];
    if (line.length > 90 || line.length < 4) continue;
    if (looksLikeJobTitleOrCertification(line)) continue;
    if (/@/.test(line)) continue;

    const words = line.split(/\s+/).filter((w) => {
      return (
        w.length > 1 &&
        /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'.-]*$/.test(w) &&
        !/^(and|or|the|of|at|in)$/i.test(w)
      );
    });
    if (words.length >= 2 && words.length <= 6) {
      return words.join(" ");
    }
  }

  return null;
}

function normTok(t: string): string {
  return t.toLowerCase().replace(/[^a-z]/g, "");
}

/** True if every token in `a` appears in the same order within `b`. */
function isSubsequenceTokens(a: string[], b: string[]): boolean {
  if (a.length === 0) return true;
  if (a.length > b.length) return false;
  let j = 0;
  for (let i = 0; i < b.length && j < a.length; i++) {
    if (normTok(b[i]) === normTok(a[j])) j += 1;
  }
  return j === a.length;
}

/**
 * When the model returns a shorter name but another source has the same tokens in
 * order with extra middle name(s), prefer the longer string.
 */
function preferRicherCompatibleName(
  extracted: string,
  richer: string | null,
): string {
  const e = extracted.trim().split(/\s+/).filter(Boolean);
  const f = richer?.trim().split(/\s+/).filter(Boolean);
  if (!f?.length || f.length <= e.length) return extracted;
  if (!isSubsequenceTokens(e, f)) return extracted;
  return richer!.trim();
}

/** Merge filename / header heuristics so a shorter model name can pick up middle names from the PDF. */
function mergeNameFromSources(
  base: string,
  sources: ReadonlyArray<string | null | undefined>,
): string {
  let m = base.trim();
  for (const s of sources) {
    const next = preferRicherCompatibleName(m, s ?? null);
    if (next.trim()) m = next.trim();
  }
  return m;
}

/**
 * Prefer verbatim extraction; if it’s clearly a title/cert or empty, use file name
 * or a short line above the email in extracted text.
 */
export function resolveCandidateName(
  extractedName: string,
  fileName: string | undefined,
  resumeText: string,
): string {
  const trimmed = extractedName.trim();
  const fromFile = fileName ? parseNameFromFileName(fileName) : null;
  const guessHead = guessNameFromFirstLines(resumeText);
  const guessEmail = guessNameFromLinesAboveEmail(resumeText);
  const enrichers = [fromFile, guessHead, guessEmail] as const;

  if (!trimmed) {
    const merged = mergeNameFromSources("", [...enrichers]);
    return merged || "Candidate";
  }

  if (!looksLikeJobTitleOrCertification(trimmed)) {
    return mergeNameFromSources(trimmed, [...enrichers]) || trimmed;
  }

  if (fromFile) return fromFile;

  const fromText = guessEmail ?? guessHead;
  if (fromText) return fromText;

  return trimmed;
}
