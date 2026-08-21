export type DraftingInlineSegment = {
  kind: 'text' | 'strong' | 'emphasis' | 'line-break';
  text: string;
};

export type DraftingMarkdownBlock =
  | { kind: 'empty' }
  | { kind: 'heading'; level: 1 | 3; subject: boolean; content: DraftingInlineSegment[] }
  | { kind: 'divider' }
  | { kind: 'legal-basis'; content: DraftingInlineSegment[] }
  | { kind: 'sub-section'; content: DraftingInlineSegment[] }
  | { kind: 'bullet'; content: DraftingInlineSegment[] }
  | { kind: 'end-mark' }
  | { kind: 'paragraph'; content: DraftingInlineSegment[] }
  | { kind: 'table'; headerLayout: boolean; rows: DraftingInlineSegment[][][] };

const INLINE_MARKER = /(\*\*[^*]+\*\*|\*[^*]+\*|<br\s*\/?>)/giu;
const TABLE_DIVIDER = /^:?-+:?$/u;

export function parseInlineMarkdown(text: string): DraftingInlineSegment[] {
  const segments: DraftingInlineSegment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(INLINE_MARKER)) {
    const index = match.index ?? cursor;
    if (index > cursor) segments.push({ kind: 'text', text: text.slice(cursor, index) });

    const token = match[0];
    if (/^<br\s*\/?>$/iu.test(token)) {
      segments.push({ kind: 'line-break', text: '' });
    } else if (token.startsWith('**')) {
      segments.push({ kind: 'strong', text: token.slice(2, -2) });
    } else {
      segments.push({ kind: 'emphasis', text: token.slice(1, -1) });
    }
    cursor = index + token.length;
  }

  if (cursor < text.length) segments.push({ kind: 'text', text: text.slice(cursor) });
  return segments.length > 0 ? segments : [{ kind: 'text', text }];
}

export function parseDraftingMarkdown(markdown: string): DraftingMarkdownBlock[] {
  const lines = markdown.split('\n');
  const blocks: DraftingMarkdownBlock[] = [];

  for (let index = 0; index < lines.length;) {
    const trimmedLine = lines[index].trim();

    if (isTableLine(trimmedLine)) {
      const tableLines: string[] = [];
      while (index < lines.length && isTableLine(lines[index].trim())) {
        tableLines.push(lines[index].trim());
        index += 1;
      }
      blocks.push(parseTable(tableLines));
      continue;
    }

    if (isLegalBasisLine(trimmedLine)) {
      const legalLines: string[] = [];
      while (index < lines.length && isLegalBasisLine(lines[index].trim())) {
        legalLines.push(lines[index].trim());
        index += 1;
      }
      normalizeLegalBases(legalLines).forEach((line) => {
        blocks.push({ kind: 'legal-basis', content: parseInlineMarkdown(line) });
      });
      continue;
    }

    blocks.push(parseLine(trimmedLine));
    index += 1;
  }

  return blocks;
}

export function isSubjectLine(text: string): boolean {
  const normalizedText = text.toLocaleLowerCase('vi').trim();
  return normalizedText.startsWith('về việc')
    || normalizedText.startsWith('v/v')
    || normalizedText.startsWith('(về việc');
}

export function isLegalBasisLine(line: string): boolean {
  const normalizedLine = line.trim();
  return normalizedLine.startsWith('- Căn cứ')
    || normalizedLine.startsWith('* Căn cứ')
    || normalizedLine.startsWith('Căn cứ')
    || normalizedLine.startsWith('Xét đề nghị')
    || normalizedLine.startsWith('Theo đề nghị');
}

export function normalizeLegalBases(rawLines: string[]): string[] {
  return rawLines.map((rawLine, index) => {
    const content = rawLine.replace(/^[-*]\s*/u, '').replace(/[;.,:\s]+$/u, '').trim();
    const punctuation = index === rawLines.length - 1 ? '.' : ';';
    return `- ${content}${punctuation}`;
  });
}

function parseLine(line: string): DraftingMarkdownBlock {
  if (!line) return { kind: 'empty' };
  if (line.startsWith('# ')) {
    return { kind: 'heading', level: 1, subject: false, content: parseInlineMarkdown(line.slice(2)) };
  }
  if (/^#{2,3}\s+/u.test(line)) {
    const content = line.replace(/^#{2,3}\s+/u, '');
    return { kind: 'heading', level: 3, subject: isSubjectLine(content), content: parseInlineMarkdown(content) };
  }
  if (line === '---' || line === '***') return { kind: 'divider' };
  if (/^[a-z]\)\s+/u.test(line)) return { kind: 'sub-section', content: parseInlineMarkdown(line) };
  if (/^[-*]\s+/u.test(line)) return { kind: 'bullet', content: parseInlineMarkdown(line.replace(/^[-*]\s+/u, '')) };
  if (line === './.') return { kind: 'end-mark' };
  return { kind: 'paragraph', content: parseInlineMarkdown(line) };
}

function isTableLine(line: string): boolean {
  return line.startsWith('|') && line.endsWith('|');
}

function parseTable(lines: string[]): DraftingMarkdownBlock {
  const parsedRows = lines.map((line) => (
    line.split('|').slice(1, -1).map((cell) => cell.trim())
  ));
  const headerLayout = parsedRows.length >= 2
    && parsedRows[0].length === 2
    && parsedRows[1].every((cell) => TABLE_DIVIDER.test(cell));
  const contentRows = parsedRows.filter((row) => !row.every((cell) => TABLE_DIVIDER.test(cell)));

  return {
    kind: 'table',
    headerLayout,
    rows: contentRows.map((row) => row.map(parseInlineMarkdown)),
  };
}
