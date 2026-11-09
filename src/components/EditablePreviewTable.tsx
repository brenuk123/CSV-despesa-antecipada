import React, { useState } from 'react';
import {
  AlertCircle,
  Check,
  RotateCcw,
  Search,
} from 'lucide-react';
import { BENEFIT_ACCOUNTING_MAP } from '../data/defaults';
import {
  BenefitType,
  CostCenterCatalogItem,
  CostCenterNature,
  CsvExportSettings,
  CsvOutputRow,
  ProcessedSD1Row,
  RowOverride,
  ValidationIssueType,
} from '../types';
import { formatCsvValue, formatCurrencyBRL } from '../utils/accountingEngine';
import { normalizeCostCenterCode } from '../utils/parser';
import { BenefitDemonstrativoView } from './BenefitDemonstrativoView';

interface EditablePreviewTableProps {
  includedRows: ProcessedSD1Row[];
  discardedDateRows: ProcessedSD1Row[];
  csvRows: CsvOutputRow[];
  costCenters: CostCenterCatalogItem[];
  selectedMonthYear: string;
  exportSettings: CsvExportSettings;
  onUpdateExportSettings: (patch: Partial<CsvExportSettings>) => void;
  onUpdateRowOverride: (rowId: string, override: RowOverride | null) => void;
  onSetPermanentCCNature: (ccCode: string, natureza: CostCenterNature) => void;
  activeIssueFilter: ValidationIssueType | 'ALL_ISSUES' | null;
  onClearIssueFilter: () => void;
  activeBenefitFilter: BenefitType | 'ALL';
}

export const EditablePreviewTable: React.FC<EditablePreviewTableProps> = ({
  includedRows,
  discardedDateRows,
  csvRows,
  costCenters,
  selectedMonthYear,
  exportSettings,
  onUpdateExportSettings,
  onUpdateRowOverride,
  onSetPermanentCCNature,
  activeIssueFilter,
  onClearIssueFilter,
  activeBenefitFilter,
}) => {
  const [viewTab, setViewTab] = useState<
    'INCLUDED' | 'DEMONSTRATIVO_XLSX' | 'CSV_FINAL' | 'DISCARDED_DATE'
  >('INCLUDED');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [draftCC, setDraftCC] = useState('');
  const [draftDebit, setDraftDebit] = useState('');
  const [draftNature, setDraftNature] = useState<CostCenterNature>('ADMINISTRATIVO');
  const [applyToAllSameCC, setApplyToAllSameCC] = useState(true);

  const startEditingRow = (row: ProcessedSD1Row) => {
    setEditingRowId(row.id);
    setDraftCC(row.centroCusto);
    setDraftDebit(row.contaDebito);
    setDraftNature(
      row.natureza === 'A_CLASSIFICAR' ? 'ADMINISTRATIVO' : row.natureza
    );
  };

  const handleSaveRowEdit = (row: ProcessedSD1Row) => {
    const normalizedCC = normalizeCostCenterCode(draftCC);
    const bRule = BENEFIT_ACCOUNTING_MAP[row.benefitType!];
    let finalDebit = draftDebit.trim();

    if (!finalDebit) {
      finalDebit =
        draftNature === 'OPERACIONAL'
          ? bRule.debitoOperacional
          : bRule.debitoAdministrativo;
    }

    onUpdateRowOverride(row.id, {
      centroCusto: normalizedCC,
      natureza: draftNature,
      contaDebito: finalDebit,
    });

    if (applyToAllSameCC && normalizedCC && draftNature !== 'A_CLASSIFICAR') {
      onSetPermanentCCNature(normalizedCC, draftNature);
    }

    setEditingRowId(null);
  };

  // Filtrar linhas incluídas
  const filteredIncluded = includedRows.filter((row) => {
    if (activeBenefitFilter !== 'ALL' && row.benefitType !== activeBenefitFilter) {
      return false;
    }
    if (activeIssueFilter === 'ALL_ISSUES' && row.issues.length === 0) {
      return false;
    }
    if (
      activeIssueFilter &&
      activeIssueFilter !== 'ALL_ISSUES' &&
      !row.issues.some((i) => i.type === activeIssueFilter)
    ) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const matchDoc = row.raw.documento.toLowerCase().includes(q);
      const matchProd = row.produtoNormalized.toLowerCase().includes(q);
      const matchCC = row.centroCusto.toLowerCase().includes(q);
      const matchDescCC = (row.centroCustoCatalogItem?.descricao || '')
        .toLowerCase()
        .includes(q);
      const matchHist = row.historico.toLowerCase().includes(q);
      const matchDeb = row.contaDebito.toLowerCase().includes(q);
      return matchDoc || matchProd || matchCC || matchDescCC || matchHist || matchDeb;
    }
    return true;
  });

  const filteredCsvRows = csvRows.filter((row) => {
    if (activeBenefitFilter !== 'ALL' && row.benefitType !== activeBenefitFilter) {
      return false;
    }
    if (activeIssueFilter === 'ALL_ISSUES' && row.issues.length === 0) {
      return false;
    }
    if (
      activeIssueFilter &&
      activeIssueFilter !== 'ALL_ISSUES' &&
      !row.issues.some((i) => i.type === activeIssueFilter)
    ) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      return (
        row.ccDebito.toLowerCase().includes(q) ||
        row.historico.toLowerCase().includes(q) ||
        row.debito.toLowerCase().includes(q) ||
        row.credito.toLowerCase().includes(q) ||
        row.descricaoCC.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <section className="bg-white border border-slate-200 rounded-lg">
      {/* Barra de Ferramentas da Tabela */}
      <div className="p-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex flex-wrap items-center p-1 bg-slate-100 rounded-md gap-0.5">
            <button
              type="button"
              onClick={() => setViewTab('INCLUDED')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                viewTab === 'INCLUDED'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Prévia Editável ({includedRows.length})
            </button>
            <button
              type="button"
              onClick={() => setViewTab('DEMONSTRATIVO_XLSX')}
              className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap shrink-0 ${
                viewTab === 'DEMONSTRATIVO_XLSX'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-emerald-800 hover:bg-emerald-50'
              }`}
            >
              Demonstrativo por Vale — 1° e 2° Parcela (XLSX)
            </button>
            <button
              type="button"
              onClick={() => setViewTab('CSV_FINAL')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                viewTab === 'CSV_FINAL'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Espelho Exato CSV ({csvRows.length})
            </button>
            <button
              type="button"
              onClick={() => setViewTab('DISCARDED_DATE')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                viewTab === 'DISCARDED_DATE'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Vales Fora do Ciclo 20–19 ({discardedDateRows.length})
            </button>
          </div>

          {activeIssueFilter && (
            <div className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded">
              <span>Filtro de pendência ativo</span>
              <button
                type="button"
                onClick={onClearIssueFilter}
                className="font-semibold underline hover:text-amber-950"
              >
                Exibir todas
              </button>
            </div>
          )}
        </div>

        {/* Opções de Formatação CSV e Busca */}
        <div className="flex flex-wrap items-center gap-4">
          <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={exportSettings.useApostropheOnCC}
              onChange={(e) =>
                onUpdateExportSettings({ useApostropheOnCC: e.target.checked })
              }
              className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            <span>Apóstrofo no CC (&apos;000006100)</span>
          </label>

          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded font-medium">
            <span>Valores Destrinchados (1:1 sem somar)</span>
          </span>

          <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={exportSettings.fixedTwoDecimals}
              onChange={(e) =>
                onUpdateExportSettings({ fixedTwoDecimals: e.target.checked })
              }
              className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            <span>2 casas decimais fixas (600,00)</span>
          </label>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar CC, conta, NF..."
              className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-sky-600 w-48"
            />
          </div>
        </div>
      </div>

      {/* ABA 1: Prévia Editável */}
      {viewTab === 'INCLUDED' && (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <th className="py-2.5 px-3 font-semibold whitespace-nowrap">NF / Emissão</th>
                <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Produto / Vale</th>
                <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Debito</th>
                <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Credito</th>
                <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">Valor</th>
                <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Historico</th>
                <th className="py-2.5 px-3 font-semibold whitespace-nowrap">CC Debito / Credito</th>
                <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Natureza & Setor</th>
                <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Status / Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredIncluded.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-500">
                    Nenhuma linha encontrada para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredIncluded.map((row) => {
                  const hasIssues = row.issues.length > 0;
                  const isEditing = editingRowId === row.id;
                  const bConfig = BENEFIT_ACCOUNTING_MAP[row.benefitType!];
                  const formattedCC = row.centroCusto
                    ? exportSettings.useApostropheOnCC
                      ? `'${row.centroCusto}`
                      : row.centroCusto
                    : '';

                  return (
                    <tr
                      key={row.id}
                      className={
                        hasIssues
                          ? 'bg-amber-50/60 hover:bg-amber-50'
                          : 'hover:bg-slate-50/80'
                      }
                    >
                      {/* NF / Emissão / Parcela */}
                      <td className="py-2 px-3 font-mono tabular-nums whitespace-nowrap">
                        <div className="font-medium text-slate-900">
                          {row.raw.documento || 'S/N'}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {row.raw.dtEmissaoRaw} ·{' '}
                          <span className="font-semibold text-slate-700">
                            {row.parcela}° Parcela
                          </span>
                        </div>
                      </td>

                      {/* Produto / Vale */}
                      <td className="py-2 px-3 whitespace-nowrap">
                        <div className="font-mono text-slate-900 tabular-nums">
                          {row.produtoNormalized}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Vale {bConfig.label}
                        </div>
                      </td>

                      {/* Debito */}
                      <td className="py-2 px-3 font-mono tabular-nums whitespace-nowrap">
                        {isEditing ? (
                          <div className="space-y-1">
                            <select
                              value={draftNature}
                              onChange={(e) => {
                                const newNat = e.target.value as CostCenterNature;
                                setDraftNature(newNat);
                                if (newNat === 'OPERACIONAL') {
                                  setDraftDebit(bConfig.debitoOperacional);
                                } else if (newNat === 'ADMINISTRATIVO') {
                                  setDraftDebit(bConfig.debitoAdministrativo);
                                }
                              }}
                              className="block w-44 text-xs font-sans border border-slate-300 rounded px-2 py-1 bg-white"
                            >
                              <option value="ADMINISTRATIVO">
                                Admin ({bConfig.debitoAdministrativo})
                              </option>
                              <option value="OPERACIONAL">
                                Operac ({bConfig.debitoOperacional})
                              </option>
                            </select>
                            <input
                              type="text"
                              value={draftDebit}
                              onChange={(e) => setDraftDebit(e.target.value)}
                              placeholder="Conta débito customizada"
                              className="block w-44 text-xs font-mono border border-slate-300 rounded px-2 py-1 bg-white"
                            />
                          </div>
                        ) : row.contaDebito ? (
                          <span className="font-medium text-slate-900">
                            {row.contaDebito}
                          </span>
                        ) : (
                          <span className="text-red-600 font-sans font-semibold">
                            Pendente
                          </span>
                        )}
                      </td>

                      {/* Credito */}
                      <td className="py-2 px-3 font-mono text-slate-700 tabular-nums whitespace-nowrap">
                        {row.contaCredito}
                      </td>

                      {/* Valor */}
                      <td className="py-2 px-3 font-mono font-semibold text-right text-slate-900 tabular-nums whitespace-nowrap">
                        {formatCsvValue(row.valor, exportSettings.fixedTwoDecimals)}
                      </td>

                      {/* Historico */}
                      <td className="py-2 px-3 font-mono text-slate-700 whitespace-nowrap">
                        {row.historico}
                      </td>

                      {/* CC Debito / Credito */}
                      <td className="py-2 px-3 font-mono tabular-nums whitespace-nowrap">
                        {isEditing ? (
                          <div className="space-y-1">
                            <input
                              type="text"
                              list={`cc-datalist-${row.id}`}
                              value={draftCC}
                              onChange={(e) => setDraftCC(e.target.value)}
                              placeholder="Ex: 000006100"
                              className="w-36 text-xs font-mono border border-slate-300 rounded px-2 py-1 bg-white"
                            />
                            <datalist id={`cc-datalist-${row.id}`}>
                              {costCenters
                                .filter((c) => c.classe === 'Analitico')
                                .map((c) => (
                                  <option key={c.codigo} value={c.codigo}>
                                    {c.codigo} - {c.descricao}
                                  </option>
                                ))}
                            </datalist>
                            <label className="flex items-center gap-1 text-[11px] font-sans text-slate-600">
                              <input
                                type="checkbox"
                                checked={applyToAllSameCC}
                                onChange={(e) => setApplyToAllSameCC(e.target.checked)}
                              />
                              <span>Salvar natureza p/ este CC</span>
                            </label>
                          </div>
                        ) : formattedCC ? (
                          <span className="text-slate-900 font-medium">
                            {formattedCC}
                          </span>
                        ) : (
                          <span className="text-red-600 font-sans font-semibold">
                            (Em branco)
                          </span>
                        )}
                      </td>

                      {/* Natureza & Setor */}
                      <td className="py-2 px-3 whitespace-nowrap">
                        <div className="font-medium text-slate-800">
                          {row.natureza === 'OPERACIONAL'
                            ? 'Operacional'
                            : row.natureza === 'ADMINISTRATIVO'
                            ? 'Administrativo'
                            : 'A Classificar'}
                        </div>
                        <div className="text-[11px] text-slate-500 max-w-[180px] truncate">
                          {row.centroCustoCatalogItem
                            ? `${row.centroCustoCatalogItem.descricao} · ${row.centroCustoCatalogItem.classe}`
                            : row.centroCusto
                            ? 'Fora do cadastro de CC'
                            : 'Sem centro de custo'}
                        </div>
                      </td>

                      {/* Status / Ação */}
                      <td className="py-2 px-3 whitespace-nowrap">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleSaveRowEdit(row)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-sky-600 text-white text-xs font-medium rounded hover:bg-sky-700"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Salvar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingRowId(null)}
                              className="px-2 py-1 text-xs text-slate-600 hover:text-slate-900"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              {hasIssues ? (
                                <div className="space-y-0.5">
                                  {row.issues.map((iss) => (
                                    <div
                                      key={iss.type}
                                      className="flex items-center gap-1 text-amber-800 font-medium text-[11px]"
                                    >
                                      <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                      <span>{iss.message}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-emerald-700 font-medium">
                                  OK {row.hasOverride ? '· Editado' : ''}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => startEditingRow(row)}
                                className="text-xs font-medium text-sky-700 hover:text-sky-900 underline"
                              >
                                Editar
                              </button>
                              {row.hasOverride && (
                                <button
                                  type="button"
                                  onClick={() => onUpdateRowOverride(row.id, null)}
                                  title="Restaurar valores originais do SD1"
                                  className="text-slate-400 hover:text-slate-700"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ABA DEMONSTRATIVO: 4 Planilhas (VT, VR, VC, VAL) por 1° e 2° Parcela */}
      {viewTab === 'DEMONSTRATIVO_XLSX' && (
        <div className="p-4">
          <BenefitDemonstrativoView
            includedRows={includedRows}
            selectedMonthYear={selectedMonthYear}
          />
        </div>
      )}

      {/* ABA 2: Espelho Exato das 9 Colunas do CSV */}
      {viewTab === 'CSV_FINAL' && (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-sans">
                <th className="py-2.5 px-3 font-semibold">Debito</th>
                <th className="py-2.5 px-3 font-semibold">Credito</th>
                <th className="py-2.5 px-3 font-semibold text-right">Valor</th>
                <th className="py-2.5 px-3 font-semibold">Historico</th>
                <th className="py-2.5 px-3 font-semibold">CC Debito</th>
                <th className="py-2.5 px-3 font-semibold">CC Credito</th>
                <th className="py-2.5 px-3 font-semibold text-slate-400">CLASSE De</th>
                <th className="py-2.5 px-3 font-semibold text-slate-400">ITEM Debi</th>
                <th className="py-2.5 px-3 font-semibold text-slate-400">ITEM Credito</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCsvRows.map((row) => (
                <tr
                  key={row.id}
                  className={
                    row.issues.length > 0
                      ? 'bg-amber-50/60 hover:bg-amber-50'
                      : 'hover:bg-slate-50/80'
                  }
                >
                  <td className="py-1.5 px-3 text-slate-900">
                    {row.debito || 'PENDENTE'}
                  </td>
                  <td className="py-1.5 px-3 text-slate-800">{row.credito}</td>
                  <td className="py-1.5 px-3 text-right font-semibold text-slate-900">
                    {row.valorFormatted}
                  </td>
                  <td className="py-1.5 px-3 text-slate-800">{row.historico}</td>
                  <td className="py-1.5 px-3 text-slate-800">{row.ccDebito}</td>
                  <td className="py-1.5 px-3 text-slate-800">{row.ccCredito}</td>
                  <td className="py-1.5 px-3 text-slate-300">{row.classeDe}</td>
                  <td className="py-1.5 px-3 text-slate-300">{row.itemDebi}</td>
                  <td className="py-1.5 px-3 text-slate-300">{row.itemCredito}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ABA 3: Linhas de Vale Descartadas por Data >= 20 */}
      {viewTab === 'DISCARDED_DATE' && (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <th className="py-2.5 px-3 font-semibold">Documento NF</th>
                <th className="py-2.5 px-3 font-semibold">DT Emissao</th>
                <th className="py-2.5 px-3 font-semibold">Produto</th>
                <th className="py-2.5 px-3 font-semibold">Tipo de Vale</th>
                <th className="py-2.5 px-3 font-semibold">Centro Custo</th>
                <th className="py-2.5 px-3 font-semibold text-right">Vlr.Total</th>
                <th className="py-2.5 px-3 font-semibold">Motivo do Descarte</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {discardedDateRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Nenhuma linha de vale fora do período de apuração (20 do mês anterior a 19 do mês apurado) encontrada.
                  </td>
                </tr>
              ) : (
                discardedDateRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-mono tabular-nums text-slate-900">
                      {row.raw.documento}
                    </td>
                    <td className="py-2 px-3 font-mono tabular-nums font-semibold text-amber-800">
                      {row.raw.dtEmissaoRaw}
                    </td>
                    <td className="py-2 px-3 font-mono tabular-nums text-slate-800">
                      {row.produtoNormalized}
                    </td>
                    <td className="py-2 px-3 text-slate-700">
                      {row.benefitType
                        ? `Vale ${BENEFIT_ACCOUNTING_MAP[row.benefitType].label}`
                        : '-'}
                    </td>
                    <td className="py-2 px-3 font-mono tabular-nums text-slate-700">
                      {row.centroCusto || '(Vazio)'}
                    </td>
                    <td className="py-2 px-3 font-mono tabular-nums text-right text-slate-900">
                      {formatCurrencyBRL(row.valor)}
                    </td>
                    <td className="py-2 px-3 text-slate-600">
                      {row.status === 'DISCARDED_DATE_AFTER_19'
                        ? 'Emissão a partir do dia 20 do mês apurado (entra na próxima competência)'
                        : 'Emissão anterior ao dia 20 do mês precedente (fora do ciclo 20 a 19)'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
