import { parseMarkdown, flattenPhrasing, type ParserError } from './shared.js';
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
 * Strip a leading `**N. ` and trailing `**` if present so the task name
 * extracted from `- [ ] **3. Implement init**` becomes `Implement init`.
 */
function cleanTaskName(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^\*\*/, '').replace(/\*\*$/, '');
  s = s.replace(/^\d+\.\s*/, '');
  return s.trim();
}

export function parseTasks(text: string, _file: string): { ast: TasksAst; errors: ParserError[] } {
  const root = parseMarkdown(text);
  const tasks: TaskAst[] = [];

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

      const nested = item.children.find((c) => c.type === 'list') as List | undefined;
      if (nested) {
        for (const sub of nested.children as ListItem[]) {
          const sp = sub.children[0];
          if (!sp || sp.type !== 'paragraph') continue;
          const line = flattenPhrasing((sp as Paragraph).children);

          const specMatch = line.match(/^\s*Spec:\s*(.+)$/i);
          const filesMatch = line.match(/^\s*Files?:\s*(.+)$/i);

          if (specMatch) task.specRefs.push(specMatch[1].trim());
          if (filesMatch) {
            const parts = filesMatch[1]
              .split(',')
              .map((s) => s.trim().replace(/^`+|`+$/g, ''))
              .filter(Boolean);
            for (const p of parts) task.files.push(p);
          }
        }
      }

      // Only treat this as a real task if it had at least one Spec: or Files: line,
      // OR explicit checkbox marker. Otherwise it's just a sibling bullet, not a task.
      if (task.specRefs.length > 0 || task.files.length > 0) {
        tasks.push(task);
      }
    }
  }

  return { ast: { tasks }, errors: [] };
}
