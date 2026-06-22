import { parseMarkdown, flattenPhrasing, pos, type ParserError, type Position } from './shared.js';

export interface TaskAst {
  name: string;
  specRefs: string[];
  files: string[];
}

export interface TasksAst {
  tasks: TaskAst[];
}

// Alt file-bullet markup the parser does NOT consume (CF-B2-1). When a
// task lists files this way but omits the canonical `Files:` line, the
// raw schema error ("files must NOT have fewer than 1 items", SDD011) is
// misleading — the author DID list files, just in unsupported syntax.
// We detect it and emit a targeted SDD013 hint instead.
const ALT_FILE_BULLET = /^\s*(Create|Modify|Delete|Test|Add|Update|Remove):\s*\S/i;

/**
 * Parallel to TasksAst.tasks. Tasks ast is what the schema validates;
 * positions are kept on the side so the validator can map ajv errors
 * back to source positions without bloating the AST or the schema.
 */
export interface TasksPositions {
  tasks: Position[];
}

/**
 * Strip a leading `**N. ` and trailing `**` if present so the task name
 * extracted from `- [ ] **3. Implement init**` becomes `Implement init`.
 */
function cleanTaskName(raw: string): string {
  let s = raw.trim();
  // Strip a leading GitHub task-list checkbox (`[ ]`, `[x]`, `[~]`, ...)
  // that remark surfaces as literal text in the flattened header.
  s = s.replace(/^\[[ xX~!-]?\]\s*/, '');
  s = s.replace(/^\*\*/, '').replace(/\*\*$/, '');
  s = s.replace(/^\d+\.\s*/, '');
  return s.trim();
}

export function parseTasks(
  text: string,
  file: string,
): { ast: TasksAst; positions: TasksPositions; errors: ParserError[] } {
  const root = parseMarkdown(text);
  const tasks: TaskAst[] = [];
  const positions: Position[] = [];
  const errors: ParserError[] = [];

  for (const node of root.children) {
    if (node.type !== 'list') continue;
    const list = node;

    for (const item of list.children) {
      const firstChild = item.children[0];
      if (!firstChild || firstChild.type !== 'paragraph') continue;

      const header = flattenPhrasing((firstChild).children);
      const name = cleanTaskName(header);
      if (!name) continue;

      const task: TaskAst = { name, specRefs: [], files: [] };
      const itemPos = pos(item);
      let sawSpecOrFiles = false;
      // Alt file-bullet markup seen on this task (e.g. "Create:", "Modify:")
      // that the parser does not consume into `task.files`.
      const altFileBullets: string[] = [];

      const nested = item.children.find((c) => c.type === 'list');
      if (nested) {
        for (const sub of nested.children) {
          const sp = sub.children[0];
          if (!sp || sp.type !== 'paragraph') continue;
          const line = flattenPhrasing((sp).children);

          const specMatch = line.match(/^\s*Spec:\s*(.+)$/i);
          const filesMatch = line.match(/^\s*Files?:\s*(.+)$/i);

          if (specMatch) {
            task.specRefs.push((specMatch[1] ?? '').trim());
            sawSpecOrFiles = true;
          }
          if (filesMatch) {
            sawSpecOrFiles = true;
            const parts = (filesMatch[1] ?? '')
              .split(',')
              .map((s) => s.trim().replace(/^`+|`+$/g, ''))
              .filter(Boolean);
            for (const p of parts) task.files.push(p);
          }
          if (!specMatch && !filesMatch && ALT_FILE_BULLET.test(line)) {
            altFileBullets.push(line.trim());
          }
        }
      }

      // Only treat this as a real task if it had at least one Spec: or Files: line.
      // Otherwise it's just a sibling bullet, not a task. Tasks missing one but
      // not the other still need to surface as schema violations, hence the
      // sawSpecOrFiles flag (vs. simply checking task.specRefs.length).
      if (sawSpecOrFiles) {
        // CF-B2-1: a task that lists files via unsupported bullet markup
        // (Create:/Modify:/Test:/...) but no `Files:` line would otherwise
        // get the misleading bare SDD011. Emit a targeted hint instead so
        // the author knows to switch to the inline `Files:` form. validate.ts
        // suppresses the generic SDD011 for tasks carrying this hint.
        if (task.files.length === 0 && altFileBullets.length > 0) {
          const sample = altFileBullets[0];
          errors.push({
            file,
            line: itemPos.line,
            col: itemPos.col,
            code: 'SDD013',
            message: `Task "${name}" lists files via unsupported bullet markup (e.g. "${sample}"); this parser reads only the inline form. Use: 'Files: path/a.ts, path/b.ts'.`,
          });
        }
        tasks.push(task);
        positions.push(itemPos);
      }
    }
  }

  return { ast: { tasks }, positions: { tasks: positions }, errors };
}
