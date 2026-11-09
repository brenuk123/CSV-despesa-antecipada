import XLSXStyle from 'xlsx-js-style';
import { BENEFIT_ACCOUNTING_MAP, BENEFIT_ORDER } from '../data/defaults';
import {
  BenefitProductRule,
  BenefitType,
  CostCenterCatalogItem,
  CostCenterNature,
  CsvExportSettings,
  CsvOutputRow,
  DiscardedProductStat,
  ProcessedSD1Row,
  RawSD1Row,
  ReconciliationSummary,
  RowOverride,
  ValidationIssue,
} from '../types';
import {
  getPreviousMonthYear,
  normalizeCostCenterCode,
  parseDateParts,
} from './parser';

export function getLastDayOfMonthFormatted(monthYear: string): string {
  const match = String(monthYear ?? '').trim().match(/^(\d{1,2})-(\d{4})$/);
  if (!match) return `30/${monthYear.replace('-', '/')}`;
  const month = parseInt(match[1], 10);
  const year = parseInt(match[2], 10);
  if (month < 1 || month > 12) return `30/${monthYear.replace('-', '/')}`;
  const lastDay = new Date(year, month, 0).getDate();
  return `${String(lastDay).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
}

export function determineParcela(
  dateParts: { day: number; month: number; year: number; monthYear: string } | null,
  prevMonthYear: string,
  selectedMonthYear: string
): 1 | 2 {
  if (!dateParts) return 2;
  // Tudo que for do mês anterior (do dia 20 até o último dia do mês anterior) entra como 1ª Parcela
  if (dateParts.monthYear === prevMonthYear) {
    return 1;
  }
  // Tudo que for do mês apurado (do dia 01 até o dia 19) entra como 2ª Parcela
  if (dateParts.monthYear === selectedMonthYear) {
    return 2;
  }
  const selMatch = selectedMonthYear.match(/^(\d{1,2})-(\d{4})$/);
  if (selMatch) {
    const selM = parseInt(selMatch[1], 10);
    const selY = parseInt(selMatch[2], 10);
    if (
      dateParts.year < selY ||
      (dateParts.year === selY && dateParts.month < selM)
    ) {
      return 1;
    }
  }
  return 2;
}

export function inferDefaultCostCenterNature(
  ccCode: string,
  comercialRangeAsAdmin: boolean
): CostCenterNature {
  if (!ccCode) return 'A_CLASSIFICAR';
  // Verifica apenas códigos de 9 dígitos numéricos
  if (!/^\d{9}$/.test(ccCode)) {
    return 'A_CLASSIFICAR';
  }
  const num = parseInt(ccCode, 10);

  // Operacional: 000001000 a 000002999 e 000004000 a 000005999
  if ((num >= 1000 && num <= 2999) || (num >= 4000 && num <= 5999)) {
    return 'OPERACIONAL';
  }

  // Faixa 000003000 a 000003999 (Comercial)
  if (num >= 3000 && num <= 3999) {
    return comercialRangeAsAdmin ? 'ADMINISTRATIVO' : 'A_CLASSIFICAR';
  }

  // Administrativo: 000006000 a 000008999
  if (num >= 6000 && num <= 8999) {
    return 'ADMINISTRATIVO';
  }

  return 'A_CLASSIFICAR';
}

export function formatCsvValue(value: number, fixedTwoDecimals: boolean): string {
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  if (fixedTwoDecimals) {
    return rounded.toFixed(2).replace('.', ',');
  }
  // Compacto (estilo Excel geral: 600, 545,2, 389,95)
  const str = rounded.toFixed(2).replace(/\.?0+$/, '');
  return str.replace('.', ',');
}

export function formatCurrencyBRL(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export interface ProcessSD1Params {
  rawRows: RawSD1Row[];
  selectedMonthYear: string;
  benefitProducts: BenefitProductRule[];
  productDescriptions: Record<string, string>;
  costCenters: CostCenterCatalogItem[];
  customCostCenterNatures: Record<string, CostCenterNature>;
  rowOverrides: Record<string, RowOverride>;
  exportSettings: CsvExportSettings;
}

export interface ProcessSD1Output {
  processedRows: ProcessedSD1Row[];
  includedRows: ProcessedSD1Row[];
  csvRows: CsvOutputRow[];
  summary: ReconciliationSummary;
}

export function processSD1Data(params: ProcessSD1Params): ProcessSD1Output {
  const {
    rawRows,
    selectedMonthYear,
    benefitProducts,
    productDescriptions,
    costCenters,
    customCostCenterNatures,
    rowOverrides,
    exportSettings,
  } = params;

  const prevMonthYear = getPreviousMonthYear(selectedMonthYear);
  const dateFilterMode = exportSettings.dateFilterMode ?? 'CYCLE_20_19';

  // Mapa estrito por igualdade exata (trim + uppercase)
  const exactBenefitMap = new Map<string, BenefitProductRule>();
  for (const item of benefitProducts) {
    const key = item.codigo.trim().toUpperCase();
    if (key) {
      exactBenefitMap.set(key, item);
    }
  }

  const costCenterMap = new Map<string, CostCenterCatalogItem>();
  for (const cc of costCenters) {
    costCenterMap.set(cc.codigo, cc);
  }

  const discardedStatsMap = new Map<string, DiscardedProductStat>();

  let totalBenefitRowsInFile = 0;
  let includedRowsCount = 0;
  let discardedNotBenefitCount = 0;
  let discardedDateAfter19Count = 0;
  let discardedOtherMonthCount = 0;
  let totalIncludedValue = 0;

  const byBenefit: Record<BenefitType, { count: number; total: number }> = {
    TRANSPORTE: { count: 0, total: 0 },
    REFEICAO: { count: 0, total: 0 },
    COMBUSTIVEL: { count: 0, total: 0 },
    ALIMENTACAO: { count: 0, total: 0 },
  };

  const byNature: Record<CostCenterNature, { count: number; total: number }> = {
    OPERACIONAL: { count: 0, total: 0 },
    ADMINISTRATIVO: { count: 0, total: 0 },
    A_CLASSIFICAR: { count: 0, total: 0 },
  };

  const issueCounts = {
    EMPTY_CC: 0,
    UNKNOWN_CC: 0,
    SYNTHETIC_CC: 0,
    UNCLASSIFIED_NATURE: 0,
    totalRowsWithIssues: 0,
  };

  const processedRows: ProcessedSD1Row[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i];
    const rowId = `row-${raw.rowIndex}-${i}`;
    const produtoNormalized = raw.produto.trim().toUpperCase();
    const matchedBenefitRule = exactBenefitMap.get(produtoNormalized) ?? null;

    const descricaoProduto =
      matchedBenefitRule?.descricao ||
      productDescriptions[produtoNormalized] ||
      'Produto fora da tabela de vales';

    const effectiveDateStr = raw.dtEmissaoRaw;
    const dateParts = parseDateParts(effectiveDateStr);
    const parcela = determineParcela(dateParts, prevMonthYear, selectedMonthYear);

    // 1. FILTRO 1: Produto de vale por IGUALDADE EXATA
    if (!matchedBenefitRule) {
      discardedNotBenefitCount++;
      const codeKey = produtoNormalized || '(SEM CÓDIGO)';
      const existingStat = discardedStatsMap.get(codeKey);
      if (existingStat) {
        existingStat.count += 1;
        existingStat.totalValue = Math.round((existingStat.totalValue + raw.vlrTotal) * 100) / 100;
      } else {
        discardedStatsMap.set(codeKey, {
          codigo: codeKey,
          descricao: productDescriptions[codeKey] || 'Não cadastrado na listagem auxiliar',
          count: 1,
          totalValue: Math.round(raw.vlrTotal * 100) / 100,
        });
      }

      processedRows.push({
        id: rowId,
        raw,
        produtoNormalized,
        descricaoProduto,
        status: 'DISCARDED_NOT_BENEFIT',
        benefitType: null,
        dayOfMonth: dateParts?.day ?? null,
        monthYear: dateParts?.monthYear ?? null,
        parcela,
        centroCusto: normalizeCostCenterCode(raw.centroCustoRaw),
        centroCustoCatalogItem: null,
        natureza: 'A_CLASSIFICAR',
        contaDebito: '',
        contaCredito: '',
        valor: raw.vlrTotal,
        historico: '',
        issues: [],
        hasOverride: false,
      });
      continue;
    }

    totalBenefitRowsInFile++;
    const benefitType = matchedBenefitRule.tipoVale;

    // 2. FILTRO 2: Período de Apuração conforme modo selecionado
    if (dateFilterMode !== 'ALL_DATES') {
      if (!dateParts) {
        discardedOtherMonthCount++;
        processedRows.push({
          id: rowId,
          raw,
          produtoNormalized,
          descricaoProduto,
          status: 'DISCARDED_INVALID_DATE',
          benefitType,
          dayOfMonth: null,
          monthYear: null,
          parcela,
          centroCusto: normalizeCostCenterCode(raw.centroCustoRaw),
          centroCustoCatalogItem: null,
          natureza: 'A_CLASSIFICAR',
          contaDebito: '',
          contaCredito: '',
          valor: raw.vlrTotal,
          historico: '',
          issues: [],
          hasOverride: false,
        });
        continue;
      }

      let isIncludedByDate = false;
      if (dateFilterMode === 'CYCLE_20_19') {
        isIncludedByDate =
          (dateParts.monthYear === prevMonthYear && dateParts.day >= 20) ||
          (dateParts.monthYear === selectedMonthYear &&
            dateParts.day >= 1 &&
            dateParts.day <= 19);
      } else if (dateFilterMode === 'FULL_MONTH') {
        isIncludedByDate = dateParts.monthYear === selectedMonthYear;
      } else if (dateFilterMode === 'DAYS_01_19') {
        isIncludedByDate =
          dateParts.monthYear === selectedMonthYear &&
          dateParts.day >= 1 &&
          dateParts.day <= 19;
      }

      if (!isIncludedByDate) {
        if (dateParts.monthYear === selectedMonthYear && dateParts.day >= 20) {
          discardedDateAfter19Count++;
          processedRows.push({
            id: rowId,
            raw,
            produtoNormalized,
            descricaoProduto,
            status: 'DISCARDED_DATE_AFTER_19',
            benefitType,
            dayOfMonth: dateParts.day,
            monthYear: dateParts.monthYear,
            parcela,
            centroCusto: normalizeCostCenterCode(raw.centroCustoRaw),
            centroCustoCatalogItem: null,
            natureza: 'A_CLASSIFICAR',
            contaDebito: '',
            contaCredito: '',
            valor: raw.vlrTotal,
            historico: '',
            issues: [],
            hasOverride: false,
          });
        } else {
          discardedOtherMonthCount++;
          processedRows.push({
            id: rowId,
            raw,
            produtoNormalized,
            descricaoProduto,
            status: 'DISCARDED_OTHER_MONTH',
            benefitType,
            dayOfMonth: dateParts.day,
            monthYear: dateParts.monthYear,
            parcela,
            centroCusto: normalizeCostCenterCode(raw.centroCustoRaw),
            centroCustoCatalogItem: null,
            natureza: 'A_CLASSIFICAR',
            contaDebito: '',
            contaCredito: '',
            valor: raw.vlrTotal,
            historico: '',
            issues: [],
            hasOverride: false,
          });
        }
        continue;
      }
    }

    // Linha INCLUÍDA no CSV
    const override = rowOverrides[rowId];
    const hasOverride = Boolean(
      override &&
        (override.centroCusto !== undefined ||
          override.natureza !== undefined ||
          override.contaDebito !== undefined)
    );

    const effectiveCC =
      override?.centroCusto !== undefined
        ? normalizeCostCenterCode(override.centroCusto)
        : normalizeCostCenterCode(raw.centroCustoRaw);

    const catalogItem = effectiveCC ? costCenterMap.get(effectiveCC) ?? null : null;

    // Determinar natureza do Centro de Custo
    let natureza: CostCenterNature;
    if (override?.natureza) {
      natureza = override.natureza;
    } else if (effectiveCC && customCostCenterNatures[effectiveCC]) {
      natureza = customCostCenterNatures[effectiveCC];
    } else {
      natureza = inferDefaultCostCenterNature(effectiveCC, exportSettings.comercialRangeAsAdmin);
    }

    const accountingRule = BENEFIT_ACCOUNTING_MAP[benefitType];
    const contaCredito = accountingRule.credito;

    let contaDebito = '';
    if (override?.contaDebito !== undefined && override.contaDebito.trim() !== '') {
      contaDebito = override.contaDebito.trim();
      if (contaDebito === accountingRule.debitoOperacional) {
        natureza = 'OPERACIONAL';
      } else if (contaDebito === accountingRule.debitoAdministrativo) {
        natureza = 'ADMINISTRATIVO';
      }
    } else if (natureza === 'OPERACIONAL') {
      contaDebito = accountingRule.debitoOperacional;
    } else {
      // Administrativo por padrão (inclusive como fallback seguro para A_CLASSIFICAR, evitando célula vazia no CSV)
      contaDebito = accountingRule.debitoAdministrativo;
    }

    const historico = `${accountingRule.historicoPrefix} ${selectedMonthYear}`;

    // Validações e Alertas (informativos para revisão, não bloqueiam exportação)
    const issues: ValidationIssue[] = [];
    if (!effectiveCC) {
      issues.push({
        type: 'EMPTY_CC',
        message: 'Centro de custo em branco',
      });
      issueCounts.EMPTY_CC++;
    } else {
      if (costCenters.length > 0 && !catalogItem) {
        issues.push({
          type: 'UNKNOWN_CC',
          message: `Centro de custo ${effectiveCC} inexistente no cadastro`,
        });
        issueCounts.UNKNOWN_CC++;
      }
      if (catalogItem && catalogItem.classe === 'Sintetico') {
        issues.push({
          type: 'SYNTHETIC_CC',
          message: `Centro de custo ${effectiveCC} é Sintético (não recebe lançamento)`,
        });
        issueCounts.SYNTHETIC_CC++;
      }
    }

    if (natureza === 'A_CLASSIFICAR') {
      issues.push({
        type: 'UNCLASSIFIED_NATURE',
        message: 'Centro de custo fora das faixas padrão (alocado em Admin por padrão)',
      });
      issueCounts.UNCLASSIFIED_NATURE++;
    }

    const hasBlockingPending = issues.some(
      (iss) =>
        iss.type === 'EMPTY_CC' ||
        iss.type === 'SYNTHETIC_CC' ||
        iss.type === 'UNCLASSIFIED_NATURE'
    );

    if (hasBlockingPending) {
      issueCounts.totalRowsWithIssues++;
    }

    includedRowsCount++;
    totalIncludedValue = Math.round((totalIncludedValue + raw.vlrTotal) * 100) / 100;

    byBenefit[benefitType].count++;
    byBenefit[benefitType].total =
      Math.round((byBenefit[benefitType].total + raw.vlrTotal) * 100) / 100;

    byNature[natureza].count++;
    byNature[natureza].total = Math.round((byNature[natureza].total + raw.vlrTotal) * 100) / 100;

    processedRows.push({
      id: rowId,
      raw,
      produtoNormalized,
      descricaoProduto,
      status: 'INCLUDED',
      benefitType,
      dayOfMonth: dateParts?.day ?? null,
      monthYear: dateParts?.monthYear ?? null,
      parcela,
      centroCusto: effectiveCC,
      centroCustoCatalogItem: catalogItem,
      natureza,
      contaDebito,
      contaCredito,
      valor: raw.vlrTotal,
      historico,
      issues,
      hasOverride,
    });
  }

  // Filtrar incluídas e ordenar por Tipo de Vale (Transporte, Refeição, Combustível, Alimentação), depois por Parcela (1ª e 2ª) e ordem original do SD1
  const includedRows = processedRows
    .filter((r) => r.status === 'INCLUDED' && r.benefitType !== null)
    .sort((a, b) => {
      const orderA = BENEFIT_ACCOUNTING_MAP[a.benefitType!].order;
      const orderB = BENEFIT_ACCOUNTING_MAP[b.benefitType!].order;
      if (orderA !== orderB) return orderA - orderB;
      if (a.parcela !== b.parcela) return a.parcela - b.parcela;
      return a.raw.rowIndex - b.raw.rowIndex;
    });

  // Gerar linhas de saída do CSV sempre de forma individual (destrinchada 1:1, sem somar lançamentos do mesmo produto ou centro de custo)
  const csvRows: CsvOutputRow[] = includedRows.map((row) => {
    const formattedCC = row.centroCusto
      ? exportSettings.useApostropheOnCC
        ? `'${row.centroCusto}`
        : row.centroCusto
      : '';

    return {
      id: row.id,
      sourceRowIds: [row.id],
      sourceCount: 1,
      benefitType: row.benefitType!,
      parcela: row.parcela,
      debito: row.contaDebito,
      credito: row.contaCredito,
      valor: Math.round(row.valor * 100) / 100,
      valorFormatted: formatCsvValue(row.valor, exportSettings.fixedTwoDecimals),
      historico: row.historico,
      ccDebito: formattedCC,
      ccCredito: formattedCC,
      classeDe: '',
      itemDebi: '',
      itemCredito: '',
      centroCustoRaw: row.centroCusto,
      descricaoCC: row.centroCustoCatalogItem?.descricao || '',
      natureza: row.natureza,
      documentoSample: row.raw.documento,
      dtEmissaoSample: row.raw.dtEmissaoRaw,
      produtoSample: row.produtoNormalized,
      issues: row.issues,
    };
  });

  const totalCsvValue = csvRows.reduce(
    (acc, r) => Math.round((acc + r.valor) * 100) / 100,
    0
  );

  // Top 10 códigos descartados mais frequentes
  const topDiscardedProducts = Array.from(discardedStatsMap.values())
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return b.totalValue - a.totalValue;
    })
    .slice(0, 10);

  return {
    processedRows,
    includedRows,
    csvRows,
    summary: {
      totalRowsRead: rawRows.length,
      totalBenefitRowsInFile,
      includedRowsCount,
      discardedNotBenefitCount,
      discardedDateAfter19Count,
      discardedOtherMonthCount,
      totalIncludedValue,
      totalCsvValue,
      byBenefit,
      byNature,
      issueCounts,
      topDiscardedProducts,
    },
  };
}

export function buildCsvString(csvRows: CsvOutputRow[]): string {
  const header = [
    'Debito',
    'Credito',
    'Valor',
    'Historico',
    'CC Debito',
    'CC Credito',
    'CLASSE De',
    'ITEM Debi',
    'ITEM Credito',
  ].join(';');

  const lines = csvRows.map((row) =>
    [
      row.debito,
      row.credito,
      row.valorFormatted,
      row.historico,
      row.ccDebito,
      row.ccCredito,
      row.classeDe,
      row.itemDebi,
      row.itemCredito,
    ].join(';')
  );

  // UTF-8 com BOM (\uFEFF)
  return '\uFEFF' + [header, ...lines].join('\r\n') + '\r\n';
}

export function triggerCsvDownload(csvRows: CsvOutputRow[], monthYear: string): void {
  const content = buildCsvString(csvRows);
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeMonthYear = monthYear.replace(/[^0-9-]/g, '') || 'MM-AAAA';
  link.href = url;
  link.setAttribute('download', `vales_${safeMonthYear}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function triggerXlsxDownload(
  includedRows: ProcessedSD1Row[],
  selectedMonthYear: string
): void {
  const wb = XLSXStyle.utils.book_new();
  const launchDateStr = getLastDayOfMonthFormatted(selectedMonthYear);
  const dotMonthYear = (selectedMonthYear || '09-2026').replace('-', '.');

  const thinBorder = {
    top: { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left: { style: 'thin', color: { rgb: '000000' } },
    right: { style: 'thin', color: { rgb: '000000' } },
  };

  const baseFont = {
    name: 'Courier New',
    sz: 8,
    color: { rgb: '000000' },
  };

  const titleStyle = {
    font: { ...baseFont, bold: false },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: thinBorder,
  };

  const subtitleBoldStyle = {
    font: { ...baseFont, bold: true },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: thinBorder,
  };

  const emptyRowBorderStyle = {
    font: baseFont,
    alignment: { horizontal: 'center', vertical: 'center' },
    border: thinBorder,
  };

  const colHeaderStyle = {
    font: { ...baseFont, bold: false },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: thinBorder,
  };

  const dataCenterStyle = {
    font: baseFont,
    alignment: { horizontal: 'center', vertical: 'center' },
    border: thinBorder,
  };

  const dataDebitYellowStyle = {
    font: baseFont,
    alignment: { horizontal: 'center', vertical: 'center' },
    fill: { fgColor: { rgb: 'FFFF00' } },
    border: thinBorder,
  };

  const dataCurrencyStyle = {
    font: baseFont,
    alignment: { horizontal: 'right', vertical: 'center' },
    border: thinBorder,
    numFmt: '"R$" #,##0.00',
  };

  for (const bType of BENEFIT_ORDER) {
    const cfg = BENEFIT_ACCOUNTING_MAP[bType];
    const sheetName = `${cfg.shortTabPrefix} ${dotMonthYear}`.slice(0, 31);

    const rowsForBenefit = includedRows.filter((r) => r.benefitType === bType);
    const parcela1Rows = rowsForBenefit
      .filter((r) => r.parcela === 1)
      .sort((a, b) => a.raw.rowIndex - b.raw.rowIndex);
    const parcela2Rows = rowsForBenefit
      .filter((r) => r.parcela === 2)
      .sort((a, b) => a.raw.rowIndex - b.raw.rowIndex);

    const ws: Record<string, unknown> = {};
    const merges: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }> = [];

    const setCell = (r: number, c: number, cellObj: Record<string, unknown>) => {
      const addr = XLSXStyle.utils.encode_cell({ r, c });
      ws[addr] = cellObj;
    };

    const writeParcelaBlock = (
      startRow: number,
      parcelaNum: 1 | 2,
      pRows: ProcessedSD1Row[]
    ): number => {
      // Linha 1 do bloco: Nome do Vale (mesclado A:E)
      for (let c = 0; c <= 4; c++) {
        setCell(startRow, c, {
          v: c === 0 ? cfg.sheetHeaderTitle : '',
          t: 's',
          s: titleStyle,
        });
      }
      merges.push({ s: { r: startRow, c: 0 }, e: { r: startRow, c: 4 } });

      // Linha 2 do bloco: LANÇAMENTO DD/MM/AAAA - 1° ou 2° Parcela (mesclado A:E, negrito)
      const launchLabel = `LANÇAMENTO ${launchDateStr} - ${parcelaNum}° Parcela`;
      for (let c = 0; c <= 4; c++) {
        setCell(startRow + 1, c, {
          v: c === 0 ? launchLabel : '',
          t: 's',
          s: subtitleBoldStyle,
        });
      }
      merges.push({ s: { r: startRow + 1, c: 0 }, e: { r: startRow + 1, c: 4 } });

      // Linha 3 do bloco: linha em branco com borda (A:E)
      for (let c = 0; c <= 4; c++) {
        setCell(startRow + 2, c, {
          v: '',
          t: 's',
          s: emptyRowBorderStyle,
        });
      }
      merges.push({ s: { r: startRow + 2, c: 0 }, e: { r: startRow + 2, c: 4 } });

      // Linha 4 do bloco: Cabeçalhos NF | C. Custo | Débito | Crédito | Valor
      const headers = ['NF', 'C. Custo', 'Débito', 'Crédito', 'Valor'];
      headers.forEach((h, c) => {
        setCell(startRow + 3, c, {
          v: h,
          t: 's',
          s: colHeaderStyle,
        });
      });

      let currentRow = startRow + 4;

      if (pRows.length === 0) {
        // Linha vazia indicativa caso não haja lançamentos na parcela
        setCell(currentRow, 0, { v: '-', t: 's', s: dataCenterStyle });
        setCell(currentRow, 1, { v: '-', t: 's', s: dataCenterStyle });
        setCell(currentRow, 2, { v: '-', t: 's', s: dataCenterStyle });
        setCell(currentRow, 3, { v: cfg.credito, t: 's', s: dataCenterStyle });
        setCell(currentRow, 4, { v: 0, t: 'n', z: '"R$" #,##0.00', s: dataCurrencyStyle });
        currentRow++;
      } else {
        for (const item of pRows) {
          const isAdminDebit =
            item.natureza === 'ADMINISTRATIVO' ||
            item.contaDebito === cfg.debitoAdministrativo;

          setCell(currentRow, 0, {
            v: item.raw.documento || '',
            t: 's',
            s: dataCenterStyle,
          });
          setCell(currentRow, 1, {
            v: item.centroCusto || '',
            t: 's',
            s: dataCenterStyle,
          });
          setCell(currentRow, 2, {
            v: item.contaDebito || '',
            t: 's',
            s: isAdminDebit ? dataDebitYellowStyle : dataCenterStyle,
          });
          setCell(currentRow, 3, {
            v: item.contaCredito || '',
            t: 's',
            s: dataCenterStyle,
          });
          setCell(currentRow, 4, {
            v: Math.round(item.valor * 100) / 100,
            t: 'n',
            z: '"R$" #,##0.00',
            s: dataCurrencyStyle,
          });
          currentRow++;
        }
      }

      return currentRow;
    };

    // Bloco 1: 1° Parcela (começa na linha 0 -> Excel linha 1)
    const afterParcela1Row = writeParcelaBlock(0, 1, parcela1Rows);

    // 1 linha em branco separadora (igual à linha 16 da imagem)
    const startParcela2Row = afterParcela1Row + 1;

    // Bloco 2: 2° Parcela
    const endRow = writeParcelaBlock(startParcela2Row, 2, parcela2Rows);

    ws['!ref'] = XLSXStyle.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: endRow - 1, c: 4 },
    });
    ws['!merges'] = merges;
    ws['!cols'] = [
      { wch: 13 }, // NF
      { wch: 13 }, // C. Custo
      { wch: 15 }, // Débito
      { wch: 15 }, // Crédito
      { wch: 16 }, // Valor
    ];

    XLSXStyle.utils.book_append_sheet(wb, ws, sheetName);
  }

  const safeMonthYear = selectedMonthYear.replace(/[^0-9-]/g, '') || 'MM-AAAA';
  XLSXStyle.writeFile(wb, `demonstrativo_vales_${safeMonthYear}.xlsx`);
}

