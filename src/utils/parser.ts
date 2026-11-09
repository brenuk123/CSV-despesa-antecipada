import * as XLSX from 'xlsx';
import { DEFAULT_BENEFIT_PRODUCTS } from '../data/defaults';
import { CostCenterCatalogItem, CostCenterClass, RawSD1Row } from '../types';

function normalizeHeaderKey(header: string): string {
  return String(header ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function detectDelimiter(text: string): string {
  const firstLines = text
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0)
    .slice(0, 5);
  if (firstLines.length === 0) return '\t';

  const headerLine = firstLines[0];
  const tabCount = (headerLine.match(/\t/g) || []).length;
  const semiCount = (headerLine.match(/;/g) || []).length;
  const commaCount = (headerLine.match(/,/g) || []).length;

  if (tabCount >= semiCount && tabCount >= commaCount && tabCount > 0) return '\t';
  if (semiCount >= commaCount && semiCount > 0) return ';';
  if (commaCount > 0) return ',';
  return '\t';
}

export function parseDelimitedLine(line: string, delimiter: string): string[] {
  if (delimiter === '\t') {
    return line.split('\t');
  }
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

export function parseBrazilianNumber(val: unknown): number {
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : 0;
  }
  const str = String(val ?? '').trim();
  if (!str) return 0;

  const lastComma = str.lastIndexOf(',');
  const lastDot = str.lastIndexOf('.');

  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      // Padrão brasileiro: 1.234,56
      const cleaned = str.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
      const parsed = parseFloat(cleaned);
      return Number.isFinite(parsed) ? parsed : 0;
    } else {
      // Padrão americano: 1,234.56
      const cleaned = str.replace(/,/g, '').replace(/[^\d.-]/g, '');
      const parsed = parseFloat(cleaned);
      return Number.isFinite(parsed) ? parsed : 0;
    }
  }

  if (lastComma !== -1) {
    // Somente vírgula decimal: 600,00 ou 545,2
    const cleaned = str.replace(',', '.').replace(/[^\d.-]/g, '');
    const parsed = parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const parsed = parseFloat(str.replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatExcelSerialToDateString(serial: number): string {
  const parsed = XLSX.SSF.parse_date_code(serial);
  if (parsed && parsed.d && parsed.m && parsed.y) {
    const dd = String(parsed.d).padStart(2, '0');
    const mm = String(parsed.m).padStart(2, '0');
    const yyyy = String(parsed.y).padStart(4, '0');
    return `${dd}/${mm}/${yyyy}`;
  }
  return '';
}

export function normalizeDateString(val: unknown, preferMDY = false): string {
  if (val == null) return '';
  if (typeof val === 'number' && val > 20000 && val < 80000) {
    return formatExcelSerialToDateString(val);
  }
  const str = String(val)
    .trim()
    .replace(/^['"]+|['"]+$/g, '')
    .trim();
  if (!str) return '';

  // Se for número serial em string (ex: "46269" ou "46269,0")
  if (/^\d{5}([.,]\d+)?$/.test(str)) {
    const num = parseFloat(str.replace(',', '.'));
    if (num > 20000 && num < 80000) {
      return formatExcelSerialToDateString(num);
    }
  }

  // aaaa-mm-dd (ISO)
  const isoMatch = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (isoMatch) {
    const yyyy = isoMatch[1];
    const mm = isoMatch[2].padStart(2, '0');
    const dd = isoMatch[3].padStart(2, '0');
    return `${dd}/${mm}/${yyyy}`;
  }

  // dd/mm/aaaa ou mm/dd/aaaa (com ano de 2 ou 4 dígitos, ignorando hora se houver)
  const slashMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (slashMatch) {
    const part1 = parseInt(slashMatch[1], 10);
    const part2 = parseInt(slashMatch[2], 10);
    let yyyy = slashMatch[3];
    if (yyyy.length === 2) {
      yyyy = `20${yyyy}`;
    }

    let day = part1;
    let month = part2;

    if (part1 <= 12 && part2 > 12) {
      // Inequivocamente MM/DD/YYYY (ex: 09/24/2026)
      month = part1;
      day = part2;
    } else if (part1 > 12 && part2 <= 12) {
      // Inequivocamente DD/MM/YYYY (ex: 24/09/2026)
      day = part1;
      month = part2;
    } else if (preferMDY) {
      month = part1;
      day = part2;
    }

    const dd = String(day).padStart(2, '0');
    const mm = String(month).padStart(2, '0');
    return `${dd}/${mm}/${yyyy}`;
  }

  // aaaammdd (8 dígitos Protheus banco: 20260904)
  const protheusMatch = str.match(/^(20\d{2})(\d{2})(\d{2})$/);
  if (protheusMatch) {
    return `${protheusMatch[3]}/${protheusMatch[2]}/${protheusMatch[1]}`;
  }

  // ddmmaaaa (8 dígitos: 04092026)
  const digitsMatch = str.match(/^(\d{2})(\d{2})(20\d{2})$/);
  if (digitsMatch) {
    return `${digitsMatch[1]}/${digitsMatch[2]}/${digitsMatch[3]}`;
  }

  return str;
}

export function getPreviousMonthYear(monthYear: string): string {
  const match = String(monthYear ?? '').trim().match(/^(\d{1,2})-(\d{4})$/);
  if (!match) return '';
  let m = parseInt(match[1], 10);
  let y = parseInt(match[2], 10);
  if (m <= 1) {
    m = 12;
    y -= 1;
  } else {
    m -= 1;
  }
  return `${String(m).padStart(2, '0')}-${y}`;
}

export function getNextMonthYear(monthYear: string): string {
  const match = String(monthYear ?? '').trim().match(/^(\d{1,2})-(\d{4})$/);
  if (!match) return '';
  let m = parseInt(match[1], 10);
  let y = parseInt(match[2], 10);
  if (m >= 12) {
    m = 1;
    y += 1;
  } else {
    m += 1;
  }
  return `${String(m).padStart(2, '0')}-${y}`;
}

export function getCompetenceRangeLabel(
  monthYear: string,
  mode: 'CYCLE_20_19' | 'FULL_MONTH' | 'DAYS_01_19' | 'ALL_DATES' = 'CYCLE_20_19'
): string {
  const formattedMY = monthYear.replace('-', '/');
  if (mode === 'ALL_DATES') {
    return 'Todas as datas do arquivo SD1';
  }
  if (mode === 'FULL_MONTH') {
    return `01/${formattedMY} a 31/${formattedMY}`;
  }
  if (mode === 'DAYS_01_19') {
    return `01/${formattedMY} a 19/${formattedMY}`;
  }
  const prev = getPreviousMonthYear(monthYear);
  if (!prev) return `20/mês ant. a 19/${formattedMY}`;
  return `20/${prev.replace('-', '/')} a 19/${formattedMY}`;
}

export function parseDateParts(
  dtStr: string
): { day: number; month: number; year: number; monthYear: string } | null {
  const normalized = normalizeDateString(dtStr);
  const match = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  const monthYear = `${String(month).padStart(2, '0')}-${year}`;
  return { day, month, year, monthYear };
}

export function normalizeCostCenterCode(raw: unknown): string {
  const str = String(raw ?? '').trim().replace(/^'+/, '');
  if (!str) return '';
  if (/^\d+$/.test(str)) {
    if (str === '9000' || str === '9001') {
      return str;
    }
    return str.padStart(9, '0');
  }
  return str;
}

export async function readMatrixFromFile(
  file: File
): Promise<{ matrix: string[][]; detectedDelimiter: string }> {
  const fileName = file.name.toLowerCase();
  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, {
      type: 'array',
      cellDates: false,
      cellNF: true,
      cellText: true,
    });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const ref = worksheet['!ref'];
    if (!ref) {
      return { matrix: [], detectedDelimiter: 'XLSX' };
    }

    const range = XLSX.utils.decode_range(ref);
    const matrix: string[][] = [];
    const headerNames: string[] = [];

    // Localiza a linha de cabeçalho (primeira linha com pelo menos 2 termos conhecidos de SD1/cadastros)
    let headerR = range.s.r;
    const maxScanR = Math.min(range.e.r, range.s.r + 15);
    for (let R = range.s.r; R <= maxScanR; ++R) {
      let knownMatches = 0;
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = worksheet[addr];
        if (!cell) continue;
        const norm = normalizeHeaderKey(String(cell.w ?? cell.v ?? ''));
        if (
          norm === 'produto' ||
          norm === 'filial' ||
          norm === 'vlr.total' ||
          norm === 'documento' ||
          norm === 'centro custo' ||
          norm === 'c custo' ||
          norm === 'codigo' ||
          norm === 'dt emissao' ||
          norm === 'dt digitacao'
        ) {
          knownMatches++;
        }
      }
      if (knownMatches >= 2) {
        headerR = R;
        break;
      }
    }

    for (let R = headerR; R <= range.e.r; ++R) {
      const row: string[] = [];
      let hasNonEmpty = false;

      for (let C = range.s.c; C <= range.e.c; ++C) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = worksheet[addr];

        if (!cell || cell.v === undefined || cell.v === null) {
          row.push('');
          continue;
        }

        if (R === headerR) {
          const hText = String(cell.w ?? cell.v ?? '').trim();
          headerNames[C] = normalizeHeaderKey(hText);
          row.push(hText);
          if (hText) hasNonEmpty = true;
          continue;
        }

        const colHeader = headerNames[C] || '';
        const isDateCol =
          colHeader.includes('emissao') ||
          colHeader.includes('digitacao') ||
          colHeader.includes('dt ') ||
          colHeader.startsWith('dt.') ||
          colHeader.includes('data') ||
          colHeader.includes('valid');

        const isCodeCol =
          colHeader.includes('produto') ||
          colHeader.includes('custo') ||
          colHeader === 'cc' ||
          colHeader.includes('documento') ||
          colHeader.includes('item') ||
          colHeader.includes('filial') ||
          colHeader.includes('forn') ||
          colHeader.includes('loja') ||
          colHeader.includes('serie') ||
          colHeader.includes('codigo');

        let cellStr = '';

        if (cell.t === 'n') {
          const numVal = Number(cell.v);
          if (isDateCol && numVal > 20000 && numVal < 80000) {
            cellStr = formatExcelSerialToDateString(numVal);
          } else if (isCodeCol && cell.w) {
            cellStr = String(cell.w).trim();
          } else {
            cellStr = String(numVal).replace('.', ',');
          }
        } else if (cell.t === 'd' && cell.v instanceof Date) {
          const d = cell.v;
          const dd = String(d.getUTCDate()).padStart(2, '0');
          const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
          const yyyy = String(d.getUTCFullYear());
          cellStr = `${dd}/${mm}/${yyyy}`;
        } else {
          cellStr = String(cell.v ?? cell.w ?? '').trim();
        }

        if (cellStr !== '') hasNonEmpty = true;
        row.push(cellStr);
      }

      if (hasNonEmpty) {
        matrix.push(row);
      }
    }

    return { matrix, detectedDelimiter: 'XLSX' };
  }

  const text = await file.text();
  return readMatrixFromText(text);
}

export function readMatrixFromText(text: string): {
  matrix: string[][];
  detectedDelimiter: string;
} {
  const cleanText = text.replace(/^\uFEFF/, '');
  const delimiter = detectDelimiter(cleanText);
  const lines = cleanText.split(/\r?\n/);
  const matrix: string[][] = [];

  for (const line of lines) {
    if (line.trim().length === 0) continue;
    matrix.push(parseDelimitedLine(line, delimiter));
  }

  const delimiterName =
    delimiter === '\t'
      ? 'Tabulação (TSV)'
      : delimiter === ';'
      ? 'Ponto e vírgula (;)'
      : 'Vírgula (,)';
  return { matrix, detectedDelimiter: delimiterName };
}

export interface MonthOptionStat {
  monthYear: string;
  totalRows: number;
  benefitRowsCount: number;
  benefitRowsDay1To19Count: number; // Vales no ciclo 20/Ant a 19/Atual
  benefitRowsFullMonthCount: number; // Vales no mês calendário 01 a 31/Atual
}

export interface ParsedSD1Result {
  rows: RawSD1Row[];
  detectedMonthYear: string;
  availableMonths: MonthOptionStat[];
  detectedDelimiter: string;
  duplicateHeadersFound: string[];
  dateColumnUsed: string;
  totalBenefitRowsInFile: number;
}

export function parseSD1Matrix(
  matrix: string[][],
  detectedDelimiter: string,
  knownBenefitCodes?: string[]
): ParsedSD1Result {
  if (matrix.length < 2) {
    return {
      rows: [],
      detectedMonthYear: '09-2026',
      availableMonths: [],
      detectedDelimiter,
      duplicateHeadersFound: [],
      dateColumnUsed: 'DT Emissao',
      totalBenefitRowsInFile: 0,
    };
  }

  // Encontra dinamicamente a linha de cabeçalho caso haja linhas em branco/título no início de CSV/TXT
  let headerRowIdx = 0;
  for (let r = 0; r < Math.min(matrix.length, 10); r++) {
    const rowNorms = (matrix[r] || []).map((c) => normalizeHeaderKey(c));
    const matches = rowNorms.filter(
      (n) =>
        n === 'produto' ||
        n === 'filial' ||
        n === 'vlr.total' ||
        n === 'documento' ||
        n === 'centro custo' ||
        n === 'dt emissao' ||
        n === 'dt digitacao'
    ).length;
    if (matches >= 2) {
      headerRowIdx = r;
      break;
    }
  }

  const headerRow = matrix[headerRowIdx];
  const firstOccurrenceMap = new Map<string, number>();
  const duplicateHeadersFound: string[] = [];

  headerRow.forEach((rawColName, colIdx) => {
    const trimmed = String(rawColName ?? '').trim();
    if (!trimmed) return;
    const norm = normalizeHeaderKey(trimmed);
    if (!firstOccurrenceMap.has(norm)) {
      firstOccurrenceMap.set(norm, colIdx);
    } else if (!duplicateHeadersFound.includes(trimmed)) {
      duplicateHeadersFound.push(trimmed);
    }
  });

  const findColumnIndex = (candidates: string[]): number => {
    for (const candidate of candidates) {
      const idx = firstOccurrenceMap.get(normalizeHeaderKey(candidate));
      if (idx !== undefined) return idx;
    }
    return -1;
  };

  const idxFilial = findColumnIndex(['Filial', 'D1_FILIAL']);
  const idxItemNF = findColumnIndex(['Item NF', 'Item', 'D1_ITEM']);
  const idxProduto = findColumnIndex(['Produto', 'Cod.Produto', 'Codigo', 'D1_COD']);
  const idxVlrTotal = findColumnIndex([
    'Vlr.Total',
    'Vlr Total',
    'Valor Total',
    'Valor',
    'D1_TOTAL',
  ]);
  const idxCentroCusto = findColumnIndex([
    'Centro Custo',
    'C Custo',
    'C. Custo',
    'CC',
    'D1_CC',
  ]);
  const idxDtEmissao = findColumnIndex([
    'DT Emissao',
    'Data Emissao',
    'Dt. Emissao',
    'Emissao',
    'D1_EMISSAO',
  ]);
  const idxDtDigitacao = findColumnIndex([
    'DT Digitacao',
    'Dt. Digitacao',
    'Data Digitacao',
    'Digitacao',
    'D1_DTDIGIT',
  ]);
  const idxDocumento = findColumnIndex([
    'Documento',
    'Doc',
    'NF',
    'Numero NF',
    'D1_DOC',
  ]);
  const idxFornCliente = findColumnIndex([
    'Forn/Cliente',
    'Fornecedor',
    'D1_FORNECE',
  ]);
  const idxTipoDocto = findColumnIndex(['Tipo Docto.', 'Tipo Docto', 'D1_TP']);

  const dateColumnUsed =
    idxDtEmissao >= 0 ? 'DT Emissao' : 'Coluna DT Emissao não encontrada';

  // Pré-varredura na coluna DT Emissao para detectar se datas em texto estão em MM/DD/YYYY (padrão americano)
  let dmyEvidence = 0;
  let mdyEvidence = 0;
  if (idxDtEmissao >= 0) {
    for (let i = headerRowIdx + 1; i < matrix.length; i++) {
      const rawDt = String(matrix[i]?.[idxDtEmissao] ?? '')
        .trim()
        .replace(/^['"]+|['"]+$/g, '');
      const m = rawDt.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
      if (m) {
        const p1 = parseInt(m[1], 10);
        const p2 = parseInt(m[2], 10);
        if (p1 > 12 && p2 <= 12) dmyEvidence++;
        if (p2 > 12 && p1 <= 12) mdyEvidence++;
      }
    }
  }
  const preferMDY = mdyEvidence > dmyEvidence;

  const benefitCodeSet = new Set<string>(
    (knownBenefitCodes ?? DEFAULT_BENEFIT_PRODUCTS.map((p) => p.codigo)).map((c) =>
      c.trim().toUpperCase()
    )
  );

  const rows: RawSD1Row[] = [];
  const competenceStatsMap = new Map<string, MonthOptionStat>();
  const calendarMonthsPresent = new Set<string>();
  let totalBenefitRowsInFile = 0;

  const ensureStat = (monthYear: string): MonthOptionStat => {
    let stat = competenceStatsMap.get(monthYear);
    if (!stat) {
      stat = {
        monthYear,
        totalRows: 0,
        benefitRowsCount: 0,
        benefitRowsDay1To19Count: 0,
        benefitRowsFullMonthCount: 0,
      };
      competenceStatsMap.set(monthYear, stat);
    }
    return stat;
  };

  for (let i = headerRowIdx + 1; i < matrix.length; i++) {
    const rawCells = matrix[i];
    if (!rawCells || rawCells.every((c) => String(c ?? '').trim() === '')) {
      continue;
    }

    const getCell = (idx: number): string => {
      if (idx < 0 || idx >= rawCells.length) return '';
      return String(rawCells[idx] ?? '').trim();
    };

    const produto = getCell(idxProduto).replace(/^'+/, '').trim();
    const vlrTotalRaw = getCell(idxVlrTotal);
    const centroCustoRaw = getCell(idxCentroCusto).replace(/^'+/, '').trim();
    // Considera exclusivamente a coluna DT Emissao para apuração e relatórios
    const dtEmissaoRaw = normalizeDateString(getCell(idxDtEmissao), preferMDY);
    const dtDigitacaoRaw = normalizeDateString(getCell(idxDtDigitacao), preferMDY);
    const documento = getCell(idxDocumento).replace(/^'+/, '').trim();
    const itemNF = getCell(idxItemNF).replace(/^'+/, '').trim();
    const filial = getCell(idxFilial).replace(/^'+/, '').trim();
    const fornCliente = getCell(idxFornCliente).replace(/^'+/, '').trim();
    const tipoDocto = getCell(idxTipoDocto);

    if (!produto && !vlrTotalRaw && !dtEmissaoRaw) {
      continue;
    }

    const vlrTotal = parseBrazilianNumber(vlrTotalRaw);
    const isBenefit = benefitCodeSet.has(produto.toUpperCase());
    if (isBenefit) {
      totalBenefitRowsInFile++;
    }

    const dateParts = parseDateParts(dtEmissaoRaw);
    if (dateParts) {
      calendarMonthsPresent.add(dateParts.monthYear);

      // 1. Contabiliza no próprio mês calendário (01 a 31/MM-AAAA)
      const calStat = ensureStat(dateParts.monthYear);
      calStat.totalRows++;
      if (isBenefit) {
        calStat.benefitRowsFullMonthCount++;
      }

      // 2. Contabiliza na competência do ciclo 20/Ant a 19/Atual
      const targetCycleCompetence =
        dateParts.day >= 20
          ? getNextMonthYear(dateParts.monthYear)
          : dateParts.monthYear;
      const cycleStat = ensureStat(targetCycleCompetence);
      if (isBenefit) {
        cycleStat.benefitRowsDay1To19Count++;
        cycleStat.benefitRowsCount++;
      }
    }

    rows.push({
      rowIndex: i + 1,
      filial,
      itemNF,
      produto,
      vlrTotal,
      vlrTotalRaw,
      centroCustoRaw,
      dtEmissaoRaw,
      dtDigitacaoRaw,
      documento,
      fornCliente,
      tipoDocto,
    });
  }

  // Filtra competências relevantes (que existem como mês no arquivo ou possuem vales)
  const allCompetences = Array.from(competenceStatsMap.values());
  const relevantCompetences = allCompetences.filter(
    (c) =>
      calendarMonthsPresent.has(c.monthYear) ||
      c.benefitRowsDay1To19Count > 0 ||
      c.benefitRowsFullMonthCount > 0
  );
  const availableMonths = (
    relevantCompetences.length > 0 ? relevantCompetences : allCompetences
  ).sort((a, b) => {
    // Prioriza o mês que é um mês calendário presente no arquivo e que tenha mais vales (no ciclo ou no mês cheio)
    const maxBenefitA = Math.max(a.benefitRowsDay1To19Count, a.benefitRowsFullMonthCount);
    const maxBenefitB = Math.max(b.benefitRowsDay1To19Count, b.benefitRowsFullMonthCount);
    if (maxBenefitB !== maxBenefitA) {
      return maxBenefitB - maxBenefitA;
    }
    if (b.benefitRowsDay1To19Count !== a.benefitRowsDay1To19Count) {
      return b.benefitRowsDay1To19Count - a.benefitRowsDay1To19Count;
    }
    return b.totalRows - a.totalRows;
  });

  let detectedMonthYear = '09-2026';
  if (availableMonths.length > 0) {
    detectedMonthYear = availableMonths[0].monthYear;
  }

  return {
    rows,
    detectedMonthYear,
    availableMonths,
    detectedDelimiter,
    duplicateHeadersFound,
    dateColumnUsed,
    totalBenefitRowsInFile,
  };
}


export async function parseProductsDictionaryFile(file: File): Promise<{
  descriptions: Record<string, string>;
  count: number;
}> {
  const { matrix } = await readMatrixFromFile(file);
  if (matrix.length < 2) return { descriptions: {}, count: 0 };

  const headerRow = matrix[0];
  const colMap = new Map<string, number>();
  headerRow.forEach((col, i) => {
    const norm = normalizeHeaderKey(col);
    if (!colMap.has(norm)) colMap.set(norm, i);
  });

  const idxCodigo =
    colMap.get('codigo') ??
    colMap.get('cod') ??
    colMap.get('produto') ??
    colMap.get('b1_cod') ??
    1;
  const idxDescricao =
    colMap.get('descricao') ??
    colMap.get('desc') ??
    colMap.get('b1_desc') ??
    2;

  const descriptions: Record<string, string> = {};
  let count = 0;

  for (let i = 1; i < matrix.length; i++) {
    const row = matrix[i];
    if (!row) continue;
    const codigo = String(row[idxCodigo] ?? '')
      .trim()
      .replace(/^'+/, '')
      .toUpperCase();
    const descricao = String(row[idxDescricao] ?? '').trim();
    if (codigo && descricao) {
      descriptions[codigo] = descricao;
      count++;
    }
  }

  return { descriptions, count };
}

export async function parseCostCentersCatalogFile(
  file: File
): Promise<CostCenterCatalogItem[]> {
  const { matrix } = await readMatrixFromFile(file);
  if (matrix.length < 2) return [];

  const headerRow = matrix[0];
  const colMap = new Map<string, number>();
  headerRow.forEach((col, i) => {
    const norm = normalizeHeaderKey(col);
    if (!colMap.has(norm)) colMap.set(norm, i);
  });

  const idxCodigo =
    colMap.get('c custo') ??
    colMap.get('centro custo') ??
    colMap.get('codigo') ??
    colMap.get('ctt_custo') ??
    0;
  const idxClasse = colMap.get('classe') ?? colMap.get('ctt_classe') ?? 1;
  const idxCond =
    colMap.get('cond normal') ?? colMap.get('condicao normal') ?? 2;
  const idxDesc =
    colMap.get('desc moeda 1') ??
    colMap.get('descricao') ??
    colMap.get('desc') ??
    3;

  const items: CostCenterCatalogItem[] = [];
  const seen = new Set<string>();

  for (let i = 1; i < matrix.length; i++) {
    const row = matrix[i];
    if (!row) continue;
    const rawCode = String(row[idxCodigo] ?? '').trim();
    if (!rawCode) continue;
    const codigo = normalizeCostCenterCode(rawCode);
    if (seen.has(codigo)) continue;
    seen.add(codigo);

    const rawClasse = String(row[idxClasse] ?? '').trim().toLowerCase();
    const classe: CostCenterClass = rawClasse.startsWith('sint')
      ? 'Sintetico'
      : 'Analitico';
    const condicaoNormal = String(row[idxCond] ?? 'Despesa').trim() || 'Despesa';
    const descricao = String(row[idxDesc] ?? '').trim();

    items.push({
      codigo,
      classe,
      condicaoNormal,
      descricao,
    });
  }

  return items;
}
