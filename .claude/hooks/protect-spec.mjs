#!/usr/bin/env node
// PreToolUse hook: blocks Claude Code from editing the frozen spec. Humans can still edit these files
// directly; any change must go through a PR labelled `spec-change` (enforced by .github/workflows/spec-guard.yml).
import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const PROTECTED = [
  'supabase/tests/',
  'tests/',
  'scripts/run-spec.mjs',
  'docs/CONTRACTS.md',
  'CURRENT_PHASE',
  '.claude/hooks/',
  '.claude/settings.json',
  '.github/workflows/spec-guard.yml',
];

let input = {};
try {
  input = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  process.exit(0);
}
const tool = input.tool_name ?? '';
const ti = input.tool_input ?? {};
const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const norm = (p) => p.replaceAll('\\', '/').replace(/^\.\//, '');
const isProtected = (rel) => {
  const r = norm(rel).toLowerCase();
  return PROTECTED.some((p) => r === p.toLowerCase().replace(/\/$/, '') || r.startsWith(p.toLowerCase()));
};

function block(what) {
  process.stderr.write(
    `BLOCKED: ${what} is part of the frozen spec (see docs/CONTRACTS.md). ` +
      'Do not change, skip or work around spec tests. If you believe a test or contract is wrong, ' +
      'stop and explain which one and why, so the developers can decide in a `spec-change` PR.\n',
  );
  process.exit(2);
}

const filePath = ti.file_path ?? ti.notebook_path ?? ti.path;
if (['Write', 'Edit', 'MultiEdit', 'NotebookEdit'].includes(tool) && typeof filePath === 'string') {
  const rel = relative(resolve(root), resolve(root, filePath));
  if (!rel.startsWith('..') && isProtected(rel)) block(norm(rel));
  process.exit(0);
}

if (['Bash', 'PowerShell'].includes(tool) && typeof ti.command === 'string') {
  const cmd = norm(ti.command);
  const touched = PROTECTED.filter((p) => cmd.toLowerCase().includes(p.toLowerCase().replace(/\/$/, '')));
  const writes =
    /(^|[^<])>{1,2}(?!&)|\b(rm|rmdir|mv|cp|tee|truncate|touch|unlink|ln|chmod|install|patch|dd)\b|sed\s+(-[a-z]*i|--in-place)|perl\s+-[a-z]*i|\bgit\s+(checkout|restore|rm|mv|apply|stash|reset|clean)\b|Set-Content|Add-Content|Out-File|Remove-Item|Move-Item|Copy-Item|New-Item|\bdel\b|\berase\b|\bren(ame)?\b|writeFile|unlinkSync|rmSync|fs\.|open\(.+['"]w/i;
  if (touched.length && writes.test(cmd)) block(touched.join(', '));
}
process.exit(0);
