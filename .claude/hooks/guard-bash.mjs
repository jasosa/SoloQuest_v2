// PreToolUse guard for Bash. Blocks commands that destroy work, leak secrets or skip the checks.
import { readInput, block } from './_read-input.mjs';

const input = await readInput();
const cmd = String(input.tool_input?.command || '');

const rules = [
  [/git\s+push\b.*(--force|-f\b|--force-with-lease)/, 'Force push is not allowed.'],
  [/git\s+(commit|push)\b.*--no-verify/, 'Do not skip the git hooks. Fix what verify reports.'],
  [
    /git\s+commit\b[^\n]*(&&|;)\s*git\s+push\b/,
    'Do not chain commit and push. Commit first, check it worked, then push separately (and only when asked).',
  ],
  [/git\s+add\b[^\n]*(reference\/|\.pdf\b)/i, 'reference/ and PDFs never go into git.'],
  [/git\s+add\b[^\n]*\.env(?!\.example)\b/, 'Do not stage .env files.'],
  [/\b(cat|type|head|tail|Get-Content)\b[^|]*\.env(?!\.example)\b/i, 'Do not print .env files.'],
  [
    /git\s+(reset\s+--hard|clean\s+-[a-z]*f)/,
    'Destructive git command. Ask the user first, or use a safer way (stash, new branch).',
  ],
  [/rm\s+-[a-z]*r[a-z]*f?\s+(\/|~|\.\.?|\*)(\s|$)/, 'Dangerous recursive delete.'],
  [/\btaskkill\b[^\n]*\/IM\s+node/i, 'Do not kill all node processes. Kill the one port or PID.'],
];

for (const [re, msg] of rules) if (re.test(cmd)) block('Blocked: ' + msg);
process.exit(0);
