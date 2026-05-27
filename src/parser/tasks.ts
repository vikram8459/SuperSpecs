import { parseMarkdown, flattenPhrasing, pos, type ParserError, type Position } from './shared.js';
import type { List, ListItem, Paragraph } from 'mdast';

export interface TaskAst {
  name: string;
  specRefs: string[];
  files: string[];
}

export interface TasksAst {
  tasks: TaskAst[];
}

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
  s = s.replace(/^\*\*/, '').replace(/\*\*$/, '');
  s = s.replace(/^\d+\.\s*/, '');
  return s.trim();
}

export function parseTasks(
  text: string,
  _file: string,
): { ast: TasksAst; positions: TasksPositions; errors: ParserError[] } {
  const root = parseMarkdown(text);
  const tasks: TaskAst[] = [];
  const positions: Position[] = [];

  for (const node of root.children) {
    if (node.type !== 'list') continue;
    const list = node as List;

    for (const item of list.children as ListItem[]) {
      const firstChild = item.children[0];
      if (!firstChild || firstChild.type !== 'paragraph') continue;

      const header = flattenPhrasing((firstChild as Paragraph).children);
      const name = cleanTaskName(header);
      if (!name) continue;

      const task: TaskAst = { name, specRefs: [], files: [] };
      const itemPos = pos(item);
      let sawSpecOrFiles = false;

      const nested = item.children.find((c) => c.type === 'list') as List | undefined;
      if (nested) {
        for (const sub of nested.children as ListItem[]) {
          const sp = sub.children[0];
          if (!sp || sp.type !== 'paragraph') continue;
          const line = flattenPhrasing((sp as Paragraph).children);

          const specMatch = line.match(/^\s*Spec:\s*(.+)$/i);
          const filesMatch = line.match(/^\s*Files?:\s*(.+)$/i);

          if (specMatch) {
            task.specRefs.push(specMatch[1].trim());
            sawSpecOrFiles = true;
          }
          if (filesMatch) {
            sawSpecOrFiles = true;
            const parts = filesMatch[1]
              .split(',')
              .map((s) => s.trim().replace(/^`+|`+$/g, ''))
              .filter(Boolean);
            for (const p of parts) task.files.push(p);
          }
        }
      }

      // Only treat this as a real task if it had at least one Spec: or Files: line.
      // Otherwise it's just a sibling bullet, not a task. Tasks missing one but
      // not the other still need to surface as schema violations, hence the
      // sawSpecOrFiles flag (vs. simply checking task.specRefs.length).
      if (sawSpecOrFiles) {
        tasks.push(task);
        positions.push(itemPos);
      }
    }
  }

  return { ast: { tasks }, positions: { tasks: positions }, errors: [] };
}
