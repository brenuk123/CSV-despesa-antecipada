import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FolderKanban,
  Play,
  Upload,
} from 'lucide-react';
import { BenefitDemonstrativoView } from './components/BenefitDemonstrativoView';
import { CatalogsAndRulesView } from './components/CatalogsAndRulesView';
import { ConferencePanel } from './components/ConferencePanel';
import { EditablePreviewTable } from './components/EditablePreviewTable';
import {
  BENEFIT_ACCOUNTING_MAP,
  BENEFIT_ORDER,
  DEFAULT_BENEFIT_PRODUCTS,
  DEFAULT_COST_CENTERS,
  DEFAULT_PRODUCT_DESCRIPTIONS,
  generateSampleSD1Text,
} from './data/defaults';
import {
  BenefitProductRule,
  BenefitType,
  CostCenterCatalogItem,
  CostCenterNature,
  CsvExportSettings,
  RawSD1Row,
  RowOverride,
  ValidationIssueType,
} from './types';
import {
  processSD1Data,
  triggerCsvDownload,
  triggerXlsxDownload,
} from './utils/accountingEngine';
import {
  getCompetenceRangeLabel,
  MonthOptionStat,
  parseCostCentersCatalogFile,
  parseProductsDictionaryFile,
  parseSD1Matrix,
  readMatrixFromFile,
  readMatrixFromText,
} from './utils/parser';

const STORAGE_KEYS = {
  BENEFIT_PRODUCTS: 'sd1_vales_benefit_products_v1',
  PRODUCT_DESCRIPTIONS: 'sd1_vales_product_descriptions_v1',
  COST_CENTERS: 'sd1_vales_cost_centers_v1',
  CUSTOM_CC_NATURES: 'sd1_vales_custom_cc_natures_v1',
  EXPORT_SETTINGS: 'sd1_vales_export_settings_v1',
};

export default function App() {
  const [activeNav, setActiveNav] = useState<'APURACAO' | 'DEMONSTRATIVO' | 'CADASTROS'>('APURACAO');

  // Estado dos cadastros persistidos no navegador
  const [benefitProducts, setBenefitProducts] = useState<BenefitProductRule[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.BENEFIT_PRODUCTS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    return DEFAULT_BENEFIT_PRODUCTS;
  });

  const [productDescriptions, setProductDescriptions] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PRODUCT_DESCRIPTIONS);
      if (saved) {
        return { ...DEFAULT_PRODUCT_DESCRIPTIONS, ...JSON.parse(saved) };
      }
    } catch {
      // fallback
    }
    return DEFAULT_PRODUCT_DESCRIPTIONS;
  });

  const [costCenters, setCostCenters] = useState<CostCenterCatalogItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.COST_CENTERS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    return DEFAULT_COST_CENTERS;
  });

  const [customCostCenterNatures, setCustomCostCenterNatures] = useState<
    Record<string, CostCenterNature>
  >(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CUSTOM_CC_NATURES);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return {};
  });

  const [exportSettings, setExportSettings] = useState<CsvExportSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.EXPORT_SETTINGS);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          useApostropheOnCC: true,
          fixedTwoDecimals: true,
          comercialRangeAsAdmin: true,
          dateFilterMode: 'CYCLE_20_19',
          ...parsed,
          groupByBenefitAndCC: false,
        };
      }
    } catch {
      // fallback
    }
    return {
      useApostropheOnCC: true,
      groupByBenefitAndCC: false,
      fixedTwoDecimals: true,
      comercialRangeAsAdmin: true,
      dateFilterMode: 'CYCLE_20_19',
    };
  });

  // Persistência automática em localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.BENEFIT_PRODUCTS, JSON.stringify(benefitProducts));
    } catch {
      // ignore storage errors
    }
  }, [benefitProducts]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.PRODUCT_DESCRIPTIONS,
        JSON.stringify(productDescriptions)
      );
    } catch {
      // ignore
    }
  }, [productDescriptions]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.COST_CENTERS, JSON.stringify(costCenters));
    } catch {
      // ignore
    }
  }, [costCenters]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.CUSTOM_CC_NATURES,
        JSON.stringify(customCostCenterNatures)
      );
    } catch {
      // ignore
    }
  }, [customCostCenterNatures]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.EXPORT_SETTINGS, JSON.stringify(exportSettings));
    } catch {
      // ignore
    }
  }, [exportSettings]);

  // Estado do arquivo SD1 carregado
  const [rawSD1Rows, setRawSD1Rows] = useState<RawSD1Row[]>([]);
  const [availableMonths, setAvailableMonths] = useState<MonthOptionStat[]>([]);
  const [sd1FileName, setSd1FileName] = useState<string>('');
  const [sd1DelimiterInfo, setSd1DelimiterInfo] = useState<string>('');
  const [sd1DateColumnUsed, setSd1DateColumnUsed] = useState<string>('DT Emissao');
  const [productsFileName, setProductsFileName] = useState<string>('8 códigos fixos ativos');
  const [costCentersFileName, setCostCentersFileName] = useState<string>(
    `Pré-carregado (${DEFAULT_COST_CENTERS.length} centros)`
  );
  const [selectedMonthYear, setSelectedMonthYear] = useState<string>('09-2026');
  const [rowOverrides, setRowOverrides] = useState<Record<string, RowOverride>>({});

  // Filtros de visualização
  const [activeIssueFilter, setActiveIssueFilter] = useState<
    ValidationIssueType | 'ALL_ISSUES' | null
  >(null);
  const [activeBenefitFilter, setActiveBenefitFilter] = useState<BenefitType | 'ALL'>('ALL');
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Modal de inclusão rápida de código a partir do Top 10 descartados
  const [quickAddModal, setQuickAddModal] = useState<{
    codigo: string;
    descricao: string;
    tipoVale: BenefitType;
  } | null>(null);

  // Carregar lote de exemplo automaticamente na primeira abertura para demonstrar funcionamento completo
  useEffect(() => {
    const sampleText = generateSampleSD1Text();
    const { matrix, detectedDelimiter } = readMatrixFromText(sampleText);
    const parsed = parseSD1Matrix(
      matrix,
      detectedDelimiter,
      DEFAULT_BENEFIT_PRODUCTS.map((p) => p.codigo)
    );
    setRawSD1Rows(parsed.rows);
    setAvailableMonths(parsed.availableMonths);
    setSelectedMonthYear(parsed.detectedMonthYear);
    setSd1FileName('SD1_Ago_Set_2026_Exemplo.tsv');
    setSd1DelimiterInfo(parsed.detectedDelimiter);
    setSd1DateColumnUsed(parsed.dateColumnUsed);
  }, []);

  // Processamento reativo 100% no navegador
  const processedOutput = useMemo(() => {
    return processSD1Data({
      rawRows: rawSD1Rows,
      selectedMonthYear,
      benefitProducts,
      productDescriptions,
      costCenters,
      customCostCenterNatures,
      rowOverrides,
      exportSettings,
    });
  }, [
    rawSD1Rows,
    selectedMonthYear,
    benefitProducts,
    productDescriptions,
    costCenters,
    customCostCenterNatures,
    rowOverrides,
    exportSettings,
  ]);

  const { includedRows, csvRows, summary, processedRows } = processedOutput;

  const discardedDateRows = useMemo(
    () =>
      processedRows.filter(
        (r) =>
          r.status === 'DISCARDED_DATE_AFTER_19' ||
          r.status === 'DISCARDED_OTHER_MONTH' ||
          r.status === 'DISCARDED_INVALID_DATE'
      ),
    [processedRows]
  );

  // Handlers de arquivos
  const handleSD1FileUpload = async (file: File) => {
    try {
      const { matrix, detectedDelimiter } = await readMatrixFromFile(file);
      const parsed = parseSD1Matrix(
        matrix,
        detectedDelimiter,
        benefitProducts.map((p) => p.codigo)
      );
      setRawSD1Rows(parsed.rows);
      setAvailableMonths(parsed.availableMonths);
      setSelectedMonthYear(parsed.detectedMonthYear);
      setSd1FileName(file.name);
      setSd1DelimiterInfo(parsed.detectedDelimiter);
      setSd1DateColumnUsed(parsed.dateColumnUsed);
      setRowOverrides({});
      setActiveIssueFilter(null);
      setActiveBenefitFilter('ALL');

      // Seleciona automaticamente o modo de período que garante que os vales do arquivo apareçam
      const topMonth = parsed.availableMonths[0];
      let chosenMode: CsvExportSettings['dateFilterMode'] = 'CYCLE_20_19';
      if (topMonth) {
        if (topMonth.benefitRowsDay1To19Count > 0) {
          chosenMode = 'CYCLE_20_19';
        } else if (topMonth.benefitRowsFullMonthCount > 0) {
          chosenMode = 'FULL_MONTH';
        } else if (parsed.totalBenefitRowsInFile > 0) {
          chosenMode = 'ALL_DATES';
        }
      } else if (parsed.totalBenefitRowsInFile > 0) {
        chosenMode = 'ALL_DATES';
      }

      setExportSettings((prev) => ({
        ...prev,
        dateFilterMode: chosenMode,
      }));

      const rangeDesc = getCompetenceRangeLabel(parsed.detectedMonthYear, chosenMode);
      setStatusBanner(
        `Arquivo SD1 "${file.name}" processado: ${parsed.rows.length} linhas lidas (${parsed.totalBenefitRowsInFile} vales encontrados · Coluna de data: ${parsed.dateColumnUsed}) · Competência: ${parsed.detectedMonthYear} (${rangeDesc}).`
      );
    } catch {
      setStatusBanner(
        'Não foi possível ler o arquivo SD1. Verifique se o formato é .xlsx, .xls, .csv ou .txt.'
      );
    }
  };

  const handleLoadSampleData = () => {
    const sampleText = generateSampleSD1Text();
    const { matrix, detectedDelimiter } = readMatrixFromText(sampleText);
    const parsed = parseSD1Matrix(
      matrix,
      detectedDelimiter,
      benefitProducts.map((p) => p.codigo)
    );
    setRawSD1Rows(parsed.rows);
    setAvailableMonths(parsed.availableMonths);
    setSelectedMonthYear(parsed.detectedMonthYear);
    setSd1FileName('SD1_Ago_Set_2026_Exemplo.tsv');
    setSd1DelimiterInfo(parsed.detectedDelimiter);
    setSd1DateColumnUsed(parsed.dateColumnUsed);
    setRowOverrides({});
    setActiveIssueFilter(null);
    setActiveBenefitFilter('ALL');
    setExportSettings((prev) => ({ ...prev, dateFilterMode: 'CYCLE_20_19' }));
    setStatusBanner(
      `Lote de demonstração Ago/Set 2026 carregado com ${parsed.rows.length} linhas (73 vales no ciclo 20/08/2026 a 19/09/2026, 4 vales fora do ciclo e 25 outros itens do SD1).`
    );
  };

  const handleUploadProductDictionary = async (file: File) => {
    try {
      const { descriptions, count } = await parseProductsDictionaryFile(file);
      setProductDescriptions((prev) => ({ ...prev, ...descriptions }));
      setProductsFileName(`${file.name} (${count} descr.)`);
      setStatusBanner(
        `Listagem auxiliar "${file.name}" carregada (${count} descrições). Os códigos aprovados para o CSV continuam restritos à Tabela de Vales.`
      );
    } catch {
      setStatusBanner('Erro ao ler a planilha de produtos.');
    }
  };

  const handleUploadCostCentersFile = async (file: File) => {
    try {
      const items = await parseCostCentersCatalogFile(file);
      if (items.length > 0) {
        setCostCenters(items);
        setCostCentersFileName(`${file.name} (${items.length} CCs)`);
        setStatusBanner(
          `Cadastro de Centros de Custo atualizado com ${items.length} registros de "${file.name}".`
        );
      }
    } catch {
      setStatusBanner('Erro ao ler o arquivo de Centros de Custo.');
    }
  };

  // Handlers de regras
  const handleAddBenefitProduct = (rule: BenefitProductRule) => {
    setBenefitProducts((prev) => {
      const filtered = prev.filter(
        (p) => p.codigo.trim().toUpperCase() !== rule.codigo.trim().toUpperCase()
      );
      return [...filtered, rule];
    });
    setProductDescriptions((prev) => ({
      ...prev,
      [rule.codigo.trim().toUpperCase()]: rule.descricao,
    }));
    setStatusBanner(
      `Código ${rule.codigo} (${BENEFIT_ACCOUNTING_MAP[rule.tipoVale].label}) incluído na tabela de produtos de vale.`
    );
  };

  const handleRemoveBenefitProduct = (codigo: string) => {
    setBenefitProducts((prev) =>
      prev.filter(
        (p) => p.isFixedDefault || p.codigo.trim().toUpperCase() !== codigo.trim().toUpperCase()
      )
    );
  };

  const handleResetBenefitProducts = () => {
    setBenefitProducts(DEFAULT_BENEFIT_PRODUCTS);
    setStatusBanner('Tabela de produtos restaurada para os 8 códigos fixos originais.');
  };

  const handleSetCostCenterNature = (codigo: string, natureza: CostCenterNature) => {
    setCustomCostCenterNatures((prev) => ({
      ...prev,
      [codigo]: natureza,
    }));
  };

  const handleAddCostCenterItem = (
    item: CostCenterCatalogItem,
    natureza?: CostCenterNature
  ) => {
    setCostCenters((prev) => {
      const filtered = prev.filter((c) => c.codigo !== item.codigo);
      return [...filtered, item].sort((a, b) => a.codigo.localeCompare(b.codigo));
    });
    if (natureza) {
      setCustomCostCenterNatures((prev) => ({
        ...prev,
        [item.codigo]: natureza,
      }));
    }
    setStatusBanner(`Centro de custo ${item.codigo} (${item.descricao}) cadastrado.`);
  };

  const handleResetCostCentersAndRules = () => {
    setCostCenters(DEFAULT_COST_CENTERS);
    setCustomCostCenterNatures({});
    setCostCentersFileName(`Pré-carregado (${DEFAULT_COST_CENTERS.length} centros)`);
    setStatusBanner('Cadastro e regras de centros de custo restaurados ao padrão.');
  };

  const handleUpdateRowOverride = (rowId: string, override: RowOverride | null) => {
    setRowOverrides((prev) => {
      const next = { ...prev };
      if (override === null) {
        delete next[rowId];
      } else {
        next[rowId] = override;
      }
      return next;
    });
  };

  const hasUnresolvedIssues = summary.issueCounts.totalRowsWithIssues > 0;
  // O botão de exportação fica sempre disponível quando houver linhas de vale no CSV
  const canExport = csvRows.length > 0;
  const activeDateMode = exportSettings.dateFilterMode ?? 'CYCLE_20_19';
  const currentRangeLabel = getCompetenceRangeLabel(selectedMonthYear, activeDateMode);

  const handleExportCsv = () => {
    if (!canExport) return;
    triggerCsvDownload(csvRows, selectedMonthYear);
  };

  const handleExportXlsx = () => {
    if (!canExport) return;
    triggerXlsxDownload(includedRows, selectedMonthYear);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Bar Contract: [Brand title, one line] — [nav links, single-line] — [primary actions] */}
      <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between gap-6 sticky top-0 z-20">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveNav('APURACAO');
          }}
          className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 font-display"
        >
          Apurador Contábil SD1
        </a>

        <nav className="flex items-center gap-6 text-sm font-medium text-slate-600">
          <button
            type="button"
            onClick={() => setActiveNav('APURACAO')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeNav === 'APURACAO'
                ? 'border-sky-600 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Apuração & Conferência
          </button>
          <button
            type="button"
            onClick={() => setActiveNav('DEMONSTRATIVO')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeNav === 'DEMONSTRATIVO'
                ? 'border-emerald-600 text-emerald-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Demonstrativo por Vale (1° e 2° Parcela)
          </button>
          <button
            type="button"
            onClick={() => setActiveNav('CADASTROS')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeNav === 'CADASTROS'
                ? 'border-sky-600 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Cadastros Base & Regras ({benefitProducts.length} Vales · {costCenters.length} CCs)
          </button>
        </nav>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            disabled={!canExport}
            onClick={handleExportXlsx}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              canExport
                ? 'bg-emerald-700 text-white hover:bg-emerald-800'
                : 'bg-slate-200 text-slate-500 cursor-not-allowed'
            }`}
            title="Gerar arquivo Excel (.xlsx) com 4 planilhas (VT, VR, VC, VAL) separadas em 1° e 2° Parcela"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Baixar Excel 4 Abas (.xlsx)</span>
          </button>

          <button
            type="button"
            disabled={!canExport}
            onClick={handleExportCsv}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              canExport
                ? 'bg-sky-600 text-white hover:bg-sky-700'
                : 'bg-slate-200 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>
              Exportar vales_{selectedMonthYear}.csv
              {csvRows.length > 0 ? ` (${csvRows.length})` : ''}
            </span>
          </button>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-6 space-y-6">
        {statusBanner && (
          <div className="bg-sky-50 border border-sky-200 text-sky-950 px-4 py-2.5 rounded-md flex items-center justify-between text-xs">
            <span>{statusBanner}</span>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              className="text-sky-700 hover:underline font-medium ml-4 shrink-0"
            >
              Fechar
            </button>
          </div>
        )}

        {/* Faixa de Entradas: 1. SD1, 2. Produtos, 3. Centros de Custo, 4. Mês de Apuração */}
        <section className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 pb-4 border-b border-slate-100">
            <div>
              <h1 className="text-lg font-bold text-slate-900 font-display">
                Importação SD1 Protheus & Geração de Lote Contábil de Benefícios
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Processamento 100% local no navegador · Filtra os códigos exatos de Vale Transporte, Refeição, Combustível e Alimentação considerando exclusivamente a coluna DT Emissao
              </p>
            </div>
            <button
              type="button"
              onClick={handleLoadSampleData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              <Play className="w-3.5 h-3.5 text-sky-600" />
              <span>Recarregar Lote Exemplo (Ago/Set 2026)</span>
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Upload SD1 */}
            <div className="p-3.5 rounded-md border border-slate-200 bg-slate-50/60 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                  <span>1. Arquivo SD1 (Protheus)</span>
                  <FileSpreadsheet className="w-4 h-4 text-sky-600 shrink-0" />
                </div>
                <div className="mt-1.5 text-xs font-mono text-slate-900 truncate">
                  {sd1FileName || 'Nenhum arquivo selecionado'}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {rawSD1Rows.length > 0
                    ? `${rawSD1Rows.length} linhas · ${sd1DelimiterInfo} · ${sd1DateColumnUsed}`
                    : 'Formatos: .xlsx, .xls, .csv, .txt'}
                </div>
              </div>
              <label className="mt-3 inline-flex items-center justify-center gap-1.5 w-full px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5" />
                <span>Carregar SD1 (.xlsx/.csv/.txt)</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,.txt,.tsv"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleSD1FileUpload(file);
                    e.target.value = '';
                  }}
                  className="hidden"
                />
              </label>
            </div>

            {/* 2. Listagem de Produtos */}
            <div className="p-3.5 rounded-md border border-slate-200 bg-slate-50/60 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                  <span>2. Produtos de Vale (Código Exato)</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                </div>
                <div className="mt-1.5 text-xs font-mono text-slate-900 truncate">
                  {benefitProducts.length} códigos ativos ({productsFileName})
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  8 códigos DP001/DP002 fixos · Upload só p/ descrição
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <label className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded cursor-pointer transition-colors whitespace-nowrap">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Subir Descrições</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv,.txt"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadProductDictionary(file);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setActiveNav('CADASTROS')}
                  className="px-2.5 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-50 rounded whitespace-nowrap"
                >
                  Ver Tabela
                </button>
              </div>
            </div>

            {/* 3. Cadastro de Centros de Custo */}
            <div className="p-3.5 rounded-md border border-slate-200 bg-slate-50/60 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                  <span>3. Cadastro Centros de Custo</span>
                  <FolderKanban className="w-4 h-4 text-sky-600 shrink-0" />
                </div>
                <div className="mt-1.5 text-xs font-mono text-slate-900 truncate">
                  {costCentersFileName}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Valida analítico/sintético e natureza contábil
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <label className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded cursor-pointer transition-colors whitespace-nowrap">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Substituir (.xlsx)</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv,.txt"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadCostCentersFile(file);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setActiveNav('CADASTROS')}
                  className="px-2.5 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-50 rounded whitespace-nowrap"
                >
                  Configurar
                </button>
              </div>
            </div>

            {/* 4. Mês de Apuração e Recorte de Datas */}
            <div className="p-3.5 rounded-md border border-slate-200 bg-slate-50/60 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                  <span>4. Mês de Apuração (MM-AAAA)</span>
                  <Calendar className="w-4 h-4 text-sky-600 shrink-0" />
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <input
                    type="text"
                    value={selectedMonthYear}
                    onChange={(e) => setSelectedMonthYear(e.target.value.trim())}
                    placeholder="09-2026"
                    className="w-24 px-2.5 py-1 text-xs font-mono font-bold text-slate-900 bg-white border border-slate-300 rounded focus:outline-none focus:border-sky-600 tabular-nums shrink-0"
                  />
                  <select
                    value={activeDateMode}
                    onChange={(e) =>
                      setExportSettings((prev) => ({
                        ...prev,
                        dateFilterMode: e.target.value as CsvExportSettings['dateFilterMode'],
                      }))
                    }
                    className="flex-1 min-w-0 px-2 py-1 text-[11px] font-medium text-slate-800 bg-white border border-slate-300 rounded focus:outline-none focus:border-sky-600"
                    title="Escolha o recorte de datas considerado para incluir os vales no CSV"
                  >
                    <option value="CYCLE_20_19">Ciclo 20/Ant. a 19/Atual</option>
                    <option value="FULL_MONTH">Mês Completo (01 a 31)</option>
                    <option value="DAYS_01_19">Dias 01 a 19 do Mês</option>
                    <option value="ALL_DATES">
                      Todas as Datas do SD1 ({summary.totalBenefitRowsInFile})
                    </option>
                  </select>
                </div>

                <div className="mt-1 text-[11px] font-mono text-slate-500 tabular-nums truncate">
                  Período: {currentRangeLabel}
                </div>

                {availableMonths.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    {availableMonths.slice(0, 4).map((m) => {
                      const countForMode =
                        activeDateMode === 'FULL_MONTH'
                          ? m.benefitRowsFullMonthCount
                          : activeDateMode === 'ALL_DATES'
                          ? summary.totalBenefitRowsInFile
                          : m.benefitRowsDay1To19Count;
                      return (
                        <button
                          key={m.monthYear}
                          type="button"
                          onClick={() => setSelectedMonthYear(m.monthYear)}
                          className={`px-2 py-0.5 text-[11px] font-mono rounded border transition-colors tabular-nums ${
                            selectedMonthYear === m.monthYear
                              ? 'bg-sky-600 text-white border-sky-600 font-semibold'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                          }`}
                          title={`Competência ${m.monthYear}: ${m.benefitRowsDay1To19Count} vales no ciclo 20-19 | ${m.benefitRowsFullMonthCount} vales no mês 01-31`}
                        >
                          {m.monthYear} ({countForMode})
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="mt-2.5 pt-2 border-t border-slate-200/80">
                {csvRows.length > 0 ? (
                  <div className="flex items-center justify-between text-[11px] text-emerald-700 font-medium">
                    <span className="inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>{csvRows.length} lançamentos prontos p/ exportar</span>
                    </span>
                    {hasUnresolvedIssues && (
                      <span className="text-amber-700 font-mono tabular-nums">
                        ({summary.issueCounts.totalRowsWithIssues} alerta(s))
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-[11px] text-amber-800 font-medium">
                    <span>0 vales no período selecionado</span>
                    {summary.totalBenefitRowsInFile > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setExportSettings((prev) => ({
                            ...prev,
                            dateFilterMode: 'ALL_DATES',
                          }))
                        }
                        className="text-sky-700 underline font-semibold hover:text-sky-900"
                      >
                        Incluir todos ({summary.totalBenefitRowsInFile})
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {activeNav === 'APURACAO' ? (
          <>
            {/* Painel de Conferência */}
            <ConferencePanel
              summary={summary}
              dateFilterLabel={currentRangeLabel}
              onIncludeAllFileDates={() =>
                setExportSettings((prev) => ({
                  ...prev,
                  dateFilterMode: 'ALL_DATES',
                }))
              }
              activeIssueFilter={activeIssueFilter}
              onSelectIssueFilter={setActiveIssueFilter}
              activeBenefitFilter={activeBenefitFilter}
              onSelectBenefitFilter={setActiveBenefitFilter}
              onQuickAddProductFromDiscarded={(codigo, descricao) =>
                setQuickAddModal({
                  codigo,
                  descricao:
                    descricao === 'Não cadastrado na listagem auxiliar'
                      ? ''
                      : descricao,
                  tipoVale: 'TRANSPORTE',
                })
              }
            />

            {/* Tabela de Pré-visualização Editável */}
            <EditablePreviewTable
              includedRows={includedRows}
              discardedDateRows={discardedDateRows}
              csvRows={csvRows}
              costCenters={costCenters}
              selectedMonthYear={selectedMonthYear}
              exportSettings={exportSettings}
              onUpdateExportSettings={(patch) =>
                setExportSettings((prev) => ({ ...prev, ...patch }))
              }
              onUpdateRowOverride={handleUpdateRowOverride}
              onSetPermanentCCNature={handleSetCostCenterNature}
              activeIssueFilter={activeIssueFilter}
              onClearIssueFilter={() => setActiveIssueFilter(null)}
              activeBenefitFilter={activeBenefitFilter}
            />

            {/* Barra Inferior de Exportação e Verificação */}
            <section className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <span>Pronto para Exportação Contábil</span>
                  <span className="text-slate-400">·</span>
                  <span className="font-mono text-sky-700 tabular-nums">
                    vales_{selectedMonthYear}.csv
                  </span>
                  <span className="text-slate-400">/</span>
                  <span className="font-mono text-emerald-700 tabular-nums">
                    demonstrativo_vales_{selectedMonthYear}.xlsx
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  CSV individual (1:1 sem somar) e Planilha Excel (.xlsx) com 4 abas (VT, VR, VC, VAL) separadas em 1° Parcela (mês anterior dia 20+) e 2° Parcela (mês apurado dias 01 a 19).
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                {hasUnresolvedIssues && (
                  <div className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 px-3 py-2 rounded-md">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      {summary.issueCounts.totalRowsWithIssues} linha(s) com alerta de Centro de Custo (alocadas em Admin por padrão)
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  disabled={!canExport}
                  onClick={handleExportXlsx}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                    canExport
                      ? 'bg-emerald-700 text-white hover:bg-emerald-800'
                      : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Baixar Excel 4 Planilhas (.xlsx)</span>
                </button>

                <button
                  type="button"
                  disabled={!canExport}
                  onClick={handleExportCsv}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                    canExport
                      ? 'bg-sky-600 text-white hover:bg-sky-700'
                      : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <Download className="w-4 h-4" />
                  <span>Exportar CSV ({csvRows.length} linhas)</span>
                </button>
              </div>
            </section>
          </>
        ) : activeNav === 'DEMONSTRATIVO' ? (
          <BenefitDemonstrativoView
            includedRows={includedRows}
            selectedMonthYear={selectedMonthYear}
          />
        ) : (
          <CatalogsAndRulesView
            benefitProducts={benefitProducts}
            onAddBenefitProduct={handleAddBenefitProduct}
            onRemoveBenefitProduct={handleRemoveBenefitProduct}
            onResetBenefitProducts={handleResetBenefitProducts}
            productDescriptionsCount={Object.keys(productDescriptions).length}
            onUploadProductDictionary={handleUploadProductDictionary}
            costCenters={costCenters}
            customCostCenterNatures={customCostCenterNatures}
            onSetCostCenterNature={handleSetCostCenterNature}
            onAddCostCenterItem={handleAddCostCenterItem}
            onUploadCostCentersFile={handleUploadCostCentersFile}
            onResetCostCentersAndRules={handleResetCostCentersAndRules}
            exportSettings={exportSettings}
            onUpdateExportSettings={(patch) =>
              setExportSettings((prev) => ({ ...prev, ...patch }))
            }
          />
        )}
      </main>

      {/* Modal para incluir código descartado na Tabela de Vales */}
      {quickAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-md w-full p-6 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Incluir Código na Tabela de Vales
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                O código <span className="font-mono font-semibold text-slate-800">{quickAddModal.codigo}</span> passará a ser reconhecido por igualdade exata como um benefício.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Tipo de Vale Contábil
                </label>
                <select
                  value={quickAddModal.tipoVale}
                  onChange={(e) =>
                    setQuickAddModal({
                      ...quickAddModal,
                      tipoVale: e.target.value as BenefitType,
                    })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded bg-white"
                >
                  {BENEFIT_ORDER.map((b) => (
                    <option key={b} value={b}>
                      {BENEFIT_ACCOUNTING_MAP[b].label} (Créd: {BENEFIT_ACCOUNTING_MAP[b].credito})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Descrição do Produto
                </label>
                <input
                  type="text"
                  value={quickAddModal.descricao}
                  onChange={(e) =>
                    setQuickAddModal({
                      ...quickAddModal,
                      descricao: e.target.value,
                    })
                  }
                  placeholder="Ex: VALE TRANSPORTE COMPLEMENTAR"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded bg-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setQuickAddModal(null)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  handleAddBenefitProduct({
                    codigo: quickAddModal.codigo,
                    descricao:
                      quickAddModal.descricao.trim().toUpperCase() ||
                      `VALE ${quickAddModal.tipoVale}`,
                    tipoVale: quickAddModal.tipoVale,
                    isFixedDefault: false,
                  });
                  setQuickAddModal(null);
                }}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded"
              >
                Confirmar Inclusão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
