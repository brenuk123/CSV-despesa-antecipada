export type BenefitType = 'TRANSPORTE' | 'REFEICAO' | 'COMBUSTIVEL' | 'ALIMENTACAO';

export type CostCenterNature = 'OPERACIONAL' | 'ADMINISTRATIVO' | 'A_CLASSIFICAR';

export type CostCenterClass = 'Sintetico' | 'Analitico';

export interface BenefitProductRule {
  codigo: string;
  descricao: string;
  tipoVale: BenefitType;
  isFixedDefault: boolean;
}

export interface CostCenterCatalogItem {
  codigo: string;
  classe: CostCenterClass;
  condicaoNormal: string;
  descricao: string;
}

export interface RawSD1Row {
  rowIndex: number;
  filial: string;
  itemNF: string;
  produto: string;
  vlrTotal: number;
  vlrTotalRaw: string;
  centroCustoRaw: string;
  dtEmissaoRaw: string;
  dtDigitacaoRaw: string;
  documento: string;
  fornCliente: string;
  tipoDocto: string;
}

export type DiscardReason =
  | 'INCLUDED'
  | 'DISCARDED_NOT_BENEFIT'
  | 'DISCARDED_DATE_AFTER_19'
  | 'DISCARDED_OTHER_MONTH'
  | 'DISCARDED_INVALID_DATE';

export type ValidationIssueType =
  | 'EMPTY_CC'
  | 'UNKNOWN_CC'
  | 'SYNTHETIC_CC'
  | 'UNCLASSIFIED_NATURE';

export interface ValidationIssue {
  type: ValidationIssueType;
  message: string;
}

export interface RowOverride {
  centroCusto?: string;
  natureza?: CostCenterNature;
  contaDebito?: string;
}

export interface ProcessedSD1Row {
  id: string;
  raw: RawSD1Row;
  produtoNormalized: string;
  descricaoProduto: string;
  status: DiscardReason;
  benefitType: BenefitType | null;
  dayOfMonth: number | null;
  monthYear: string | null; // MM-AAAA
  parcela: 1 | 2; // 1 = Mês anterior (dia 20 ao último dia), 2 = Mês apurado (dia 01 a 19)
  centroCusto: string; // 9 dígitos ou vazio
  centroCustoCatalogItem: CostCenterCatalogItem | null;
  natureza: CostCenterNature;
  contaDebito: string;
  contaCredito: string;
  valor: number;
  historico: string;
  issues: ValidationIssue[];
  hasOverride: boolean;
}

export interface CsvOutputRow {
  id: string;
  sourceRowIds: string[];
  sourceCount: number;
  benefitType: BenefitType;
  parcela: 1 | 2;
  debito: string;
  credito: string;
  valor: number;
  valorFormatted: string;
  historico: string;
  ccDebito: string;
  ccCredito: string;
  classeDe: string;
  itemDebi: string;
  itemCredito: string;
  centroCustoRaw: string;
  descricaoCC: string;
  natureza: CostCenterNature;
  documentoSample: string;
  dtEmissaoSample: string;
  produtoSample: string;
  issues: ValidationIssue[];
}

export interface DiscardedProductStat {
  codigo: string;
  descricao: string;
  count: number;
  totalValue: number;
}

export type DateFilterMode =
  | 'CYCLE_20_19'
  | 'FULL_MONTH'
  | 'DAYS_01_19'
  | 'ALL_DATES';

export interface ReconciliationSummary {
  totalRowsRead: number;
   totalBenefitRowsInFile: number;
  includedRowsCount: number;
  discardedNotBenefitCount: number;
  discardedDateAfter19Count: number;
  discardedOtherMonthCount: number;
  totalIncludedValue: number;
  totalCsvValue: number;
  byBenefit: Record<BenefitType, { count: number; total: number }>;
  byNature: Record<CostCenterNature, { count: number; total: number }>;
  issueCounts: {
    EMPTY_CC: number;
    UNKNOWN_CC: number;
    SYNTHETIC_CC: number;
    UNCLASSIFIED_NATURE: number;
    totalRowsWithIssues: number;
  };
  topDiscardedProducts: DiscardedProductStat[];
}

export interface CsvExportSettings {
  useApostropheOnCC: boolean;
  groupByBenefitAndCC: boolean;
  fixedTwoDecimals: boolean;
  comercialRangeAsAdmin: boolean;
  dateFilterMode?: DateFilterMode;
}

