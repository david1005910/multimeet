import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableCell, TableRow, WidthType } from 'docx';

// **굵게** 인라인 마크다운을 TextRun 배열로 변환한다
function runsFromInline(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const parts = text.split(/\*\*(.+?)\*\*/g);
  parts.forEach((part, i) => {
    if (!part) return;
    // split의 홀수 인덱스는 **...** 내부 문자열이다
    runs.push(new TextRun({ text: part, bold: i % 2 === 1 }));
  });
  return runs.length ? runs : [new TextRun({ text: '' })];
}

function stripInline(text: string): string {
  return text.replace(/\*\*/g, '').replace(/`/g, '').trim();
}

// | a | b | 형태의 행을 셀 배열로 파싱한다
function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

// ---|:-:|-: 같은 구분 행인지 검사한다
function isTableSeparator(cells: string[]): boolean {
  return cells.length > 0 && cells.every((c) => /^:?-{3,}:?$/.test(c) || c === '');
}

function buildTable(rows: string[][]): Table {
  const [header, ...dataRows] = rows;

  const headerRow = new TableRow({
    tableHeader: true,
    children: header.map((cell) => new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text: cell, bold: true })] })],
    })),
  });

  const bodyRows = dataRows.map((row) => new TableRow({
    children: row.map((cell) => new TableCell({
      children: [new Paragraph({ text: cell })],
    })),
  }));

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...bodyRows],
  });
}

export class ExportService {
  async toDocx(markdownContent: string): Promise<Buffer> {
    const lines = markdownContent.split('\n');
    const children: (Paragraph | Table)[] = [];

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];

      // 마크다운 표: '|'로 시작하는 연속된 줄을 하나의 테이블로 묶는다
      if (line.trim().startsWith('|')) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          tableLines.push(lines[i]);
          i++;
        }
        const parsed = tableLines
          .map(parseTableRow)
          .filter((cells) => !isTableSeparator(cells));
        if (parsed.length > 0) {
          children.push(buildTable(parsed));
          children.push(new Paragraph({ text: '' })); // 표 뒤 간격
        }
        continue;
      }

      if (line.startsWith('## ')) {
        children.push(new Paragraph({
          text: line.replace('## ', ''),
          heading: HeadingLevel.HEADING_1,
        }));
      } else if (line.startsWith('### ')) {
        children.push(new Paragraph({
          text: line.replace('### ', ''),
          heading: HeadingLevel.HEADING_2,
        }));
      } else if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
        children.push(new Paragraph({ text: '' }));
      } else if (line.startsWith('- ')) {
        children.push(new Paragraph({
          children: runsFromInline(line.replace(/^- /, '')),
          bullet: { level: 0 },
        }));
      } else if (line.trim()) {
        children.push(new Paragraph({ children: runsFromInline(line) }));
      } else {
        children.push(new Paragraph({ text: '' }));
      }
      i++;
    }

    const doc = new Document({
      sections: [{ properties: {}, children }],
    });

    return Packer.toBuffer(doc);
  }

  toMarkdown(content: string): Buffer {
    return Buffer.from(content, 'utf-8');
  }
}

export const exportService = new ExportService();
