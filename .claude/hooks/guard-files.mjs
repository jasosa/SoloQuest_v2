// PreToolUse guard for Edit/Write. Catches the hard rules of CLAUDE.md at the moment of writing,
// so a violation costs one line of feedback instead of a review round.
import { readInput, block, norm } from './_read-input.mjs';

const input = await readInput();
const ti = input.tool_input || {};
const file = norm(ti.file_path);
const rel = file
  .replace(/^.*\/SoloQuest_v2\//, '')
  .replace(/^.*\/\.claude\/worktrees\/[^/]+\//, '');
const text = [ti.content, ti.new_string, ...(ti.edits || []).map((e) => e.new_string)]
  .filter(Boolean)
  .join('\n');

if (/(^|\/)\.env(\..+)?$/.test(file) && !/\.env\.example$/.test(file))
  block('Blocked: do not write env files. Put names in .env.example.');

if (/^reference\//.test(rel))
  block('Blocked: reference/ is the owner local copy of the book. Do not write there.');

if (
  /\.(ts|tsx|css|md|json|html)$/.test(rel) &&
  /^(src|docs|tests|tools|scripts|design\/play-a|CLAUDE\.md|README\.md)/.test(rel) &&
  text.includes(String.fromCharCode(0x2014))
)
  block('Blocked: no em-dashes in code, docs or UI text. Use a colon, comma or period.');

const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
if (
  /^src\/engine\/.+\.ts$/.test(rel) &&
  !/\.test\.ts$/.test(rel) &&
  /Math\.random|Date\.now|new Date\(|from ['"]react|\bdocument\.|\bwindow\./.test(code)
)
  block(
    'Blocked: src/engine is pure. No clock, Math.random, React or DOM. Use the seeded RNG in the game state.',
  );

if (
  /^src\/ui\/.+\.(tsx|css)$/.test(rel) &&
  !/tokens\.css$/.test(rel) &&
  /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/.test(code)
)
  block(
    'Blocked: use a color token (src/ui/shared/tokens.css). A new color goes into design/play-a/DESIGN.md first.',
  );

process.exit(0);
