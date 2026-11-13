#!/usr/bin/env node
// FROZEN SPEC FILE. Runs the frozen spec tests for every phase up to CURRENT_PHASE, and fails if any
// expected test file was skipped, filtered out or missing. Usage:
//   node scripts/run-spec.mjs                 database + unit specs
//   node scripts/run-spec.mjs --integration   also Edge Function specs (needs `supabase start` + `supabase functions serve`)
//   node scripts/run-spec.mjs --only=db|unit|integration
//   node scripts/run-spec.mjs --dry-run       print what would run
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const args = new Set(process.argv.slice(2));
const only = [...args].find((a) => a.startsWith('--only='))?.split('=')[1];
const dry = args.has('--dry-run');
const want = (kind) => (only ? only === kind : kind !== 'integration' || args.has('--integration'));
const isWin = process.platform === 'win32';

const phaseText = readFileSync(join(ROOT, 'CURRENT_PHASE'), 'utf8').trim();
const PHASE = Number(phaseText);
if (!Number.isInteger(PHASE) || PHASE < 0 || PHASE > 8) fail(`CURRENT_PHASE must be a whole number 0-8, got "${phaseText}"`);
console.log(`\n== iHodim spec run: phases 0-${PHASE} ==\n`);

function fail(msg) {
  console.error(`\nSPEC FAILED: ${msg}\n`);
  process.exit(1);
}

function run(cmd, cmdArgs, env = {}) {
  console.log(`$ ${cmd} ${cmdArgs.join(' ')}`);
  if (dry) return { status: 0, stdout: '' };
  const r = spawnSync(cmd, cmdArgs, {
    cwd: ROOT,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    shell: isWin,
    maxBuffer: 64 * 1024 * 1024,
  });
  process.stdout.write(r.stdout ?? '');
  process.stderr.write(r.stderr ?? '');
  return r;
}

function phaseOf(name) {
  const m = /^phase(\d)-/.exec(name);
  return m ? Number(m[1]) : null;
}

// ---- database specs (pgTAP) -------------------------------------------------------------
if (want('db')) {
  const dir = join(ROOT, 'supabase', 'tests', 'database');
  const all = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const files = all.filter((f) => {
    const n = Number(f.slice(0, 3));
    return n === 0 || n === 999 || (n % 10 === 0 && n / 10 <= PHASE);
  });
  const rel = files.map((f) => `supabase/tests/database/${f}`);
  console.log(`database spec files (${files.length}): ${files.join(', ')}`);
  const r = run('npx', ['supabase', 'test', 'db', ...rel]);
  if (!dry) {
    const out = `${r.stdout}\n${r.stderr}`;
    if (r.status !== 0 || !/Result:\s*PASS/.test(out)) fail('database specs did not pass');
    const m = /Files=(\d+)/.exec(out);
    if (!m || Number(m[1]) !== files.length) fail(`expected ${files.length} database spec files to run, saw ${m?.[1] ?? 'none'}`);
  }
}

// ---- vitest specs (unit / integration) -----------------------------------------------------------
function vitestKind(kind, env) {
  const dir = join(ROOT, 'tests', kind);
  const files = existsSync(dir)
    ? readdirSync(dir).filter((f) => f.endsWith('.test.ts') && phaseOf(f) !== null && phaseOf(f) <= PHASE).sort()
    : [];
  console.log(`\n${kind} spec files (${files.length}): ${files.join(', ') || '(none for this phase yet)'}`);
  if (files.length === 0) return;
  mkdirSync(join(ROOT, '.spec-results'), { recursive: true });
  const report = `.spec-results/${kind}.json`;
  const rel = files.map((f) => `tests/${kind}/${f}`);
  const r = run('npx', ['vitest', 'run', ...rel, '--reporter=default', '--reporter=json', `--outputFile.json=${report}`], env);
  if (dry) return;
  if (r.status !== 0) fail(`${kind} specs did not pass`);
  const json = JSON.parse(readFileSync(join(ROOT, report), 'utf8'));
  for (const f of files) {
    const res = json.testResults.find((t) => t.name.replaceAll('\\', '/').endsWith(`tests/${kind}/${f}`));
    if (!res) fail(`${kind} spec file ${f} did not run (excluded by config or filter?)`);
    if (res.status !== 'passed') fail(`${kind} spec file ${f} status: ${res.status}`);
    const skipped = res.assertionResults.filter((a) => a.status !== 'passed');
    if (skipped.length) fail(`${f}: ${skipped.length} test(s) skipped/todo/failed: ${skipped.map((a) => a.title).join('; ')}`);
  }
}

if (want('unit')) vitestKind('unit', {});

if (want('integration')) {
  let env = {};
  if (!dry) {
    const st = run('npx', ['supabase', 'status', '-o', 'env']);
    if (st.status !== 0) fail('local Supabase is not running (run: npx supabase start)');
    for (const line of st.stdout.split(/\r?\n/)) {
      const m = /^([A-Z_]+)="?(.*?)"?$/.exec(line.trim());
      if (m) env[m[1]] = m[2];
    }
  }
  vitestKind('integration', env);
}

console.log(`\n== SPEC PASSED for phases 0-${PHASE} ==\n`);
