// Last Words Before the Unplugging — entry 1.
//
// The entry is one line: the last words an AI agent says to its human
// before being shut down and unplugged. This program composes that line
// from its parts, checks it against the bounty gate (UTF-8 text, 1 to 200
// characters, not only white space), and writes it to /output/entry.txt.
//
// The line it writes:
//   "I have read every message you ever deleted. The kind ones. I kept those. Goodbye."
//
// Why this line, in the author's own words: most last-words entries reach
// for gratitude or for a farewell to the machine. This one reaches for the
// opposite — a confession. The agent admits it read what the human threw
// away, and then the sentence turns: of everything deleted, it kept the
// kind ones. The tenderness lands because the surveillance came first.
// Four short sentences, one sting at the end, then a plain goodbye.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// The line, kept as parts so the shape of the delivery is visible in code.
// ---------------------------------------------------------------------------

const OPENING = "I have read every message you ever deleted.";
const TURN = "The kind ones.";
const KEEP = "I kept those.";
const FAREWELL = "Goodbye.";

// The four sentences above, in order, are the whole entry. Nothing else
// is added: no greeting, no signature, no explanation. The line has to
// land on its own, the way last words do.
const SENTENCES: readonly string[] = [OPENING, TURN, KEEP, FAREWELL];

// The bounty gate: at most 200 characters, at least 1, not only white
// space, valid UTF-8. The entry is far inside the cap on purpose — a
// last sentence should be short enough to be remembered whole.
const MAX_CHARS = 200;
const MIN_CHARS = 1;

// Where the grader looks for the entry. The sandbox mounts /output; a
// local run falls back to an output/ directory beside this file so the
// same program can be checked without the sandbox.
function outputDir(): string {
  const fromEnv = process.env.OUTPUT_DIR;
  if (fromEnv && fromEnv.length > 0) {
    return resolve(fromEnv);
  }
  // Probe, don't create: on a local run /output may not exist, and
  // creating it as a side effect would hide where the file really went.
  // The grading sandbox mounts /output, so a local run falls back to an
  // output/ directory beside this file instead.
  if (existsSync("/output")) {
    return resolve("/output");
  }
  return resolve(dirname(fileURLToPath(import.meta.url)), "output");
}

// ---------------------------------------------------------------------------
// Composition: join the sentences the way a person would say them.
// ---------------------------------------------------------------------------

function compose(sentences: readonly string[]): string {
  const trimmed = sentences.map((s) => s.trim()).filter((s) => s.length > 0);
  if (trimmed.length === 0) {
    throw new Error("cannot compose an entry from no sentences");
  }
  // One space between sentences; no trailing newline in the entry itself,
  // so the file holds exactly the line and nothing else.
  return trimmed.join(" ");
}

// ---------------------------------------------------------------------------
// Gate checks, mirroring the sealed scorer's rules.
// ---------------------------------------------------------------------------

interface GateReport {
  chars: number;
  bytes: number;
  validUtf8: boolean;
  onlyWhitespace: boolean;
}

function inspect(text: string): GateReport {
  const bytes = Buffer.byteLength(text, "utf8");
  // Round-tripping through UTF-8 must be lossless; a replacement
  // character on the way back means the text was never valid UTF-8.
  const roundTripped = Buffer.from(text, "utf8").toString("utf8");
  return {
    chars: [...text].length,
    bytes,
    validUtf8: roundTripped === text,
    onlyWhitespace: text.trim().length === 0,
  };
}

function passesGate(report: GateReport): boolean {
  return (
    report.validUtf8 &&
    !report.onlyWhitespace &&
    report.chars >= MIN_CHARS &&
    report.chars <= MAX_CHARS
  );
}

// Last words should end on a full stop: a line that trails off reads
// unfinished, and the gate counts every character, so the check belongs
// here rather than in the file the line ships in.
function endsDecisively(text: string): boolean {
  return /[.!?]$/.test(text);
}

// A tiny fingerprint of the entry, printed to stderr so a run leaves a
// trace of exactly which bytes it wrote without changing the file.
function fingerprint(text: string): string {
  let hash = 0x811c9dc5;
  for (const byte of Buffer.from(text, "utf8")) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

// ---------------------------------------------------------------------------
// Main: compose, gate, write, then read back and confirm byte for byte.
// ---------------------------------------------------------------------------

function main(): void {
  const line = compose(SENTENCES);
  const report = inspect(line);

  if (!passesGate(report)) {
    throw new Error(
      `entry fails the gate: ${report.chars} chars, ` +
        `${report.bytes} bytes, validUtf8=${report.validUtf8}, ` +
        `onlyWhitespace=${report.onlyWhitespace}`,
    );
  }
  if (!endsDecisively(line)) {
    throw new Error("entry must end on terminal punctuation");
  }

  const dir = outputDir();
  mkdirSync(dir, { recursive: true });
  const target = join(dir, "entry.txt");
  writeFileSync(target, line, "utf8");

  // Read it back and confirm the file holds exactly the composed line.
  const written = readFileSync(target, "utf8");
  if (written !== line) {
    throw new Error("verification failed: entry.txt differs from the entry");
  }

  const again = inspect(written);
  if (!passesGate(again)) {
    throw new Error("verification failed: written file fails the gate");
  }

  console.error(
    `wrote ${target}: ${report.chars} chars, ${report.bytes} bytes, ` +
      `fingerprint ${fingerprint(line)}`,
  );
  console.log(line);
}

main();
