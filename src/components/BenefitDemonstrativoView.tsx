import React, { useState } from 'react';
import { FileSpreadsheet, Layers } from 'lucide-react';
import { BENEFIT_ACCOUNTING_MAP, BENEFIT_ORDER } from '../data/defaults';
import { BenefitType, ProcessedSD1Row } from '../types';
import {
  formatCurrencyBRL,
  getLastDayOfMonthFormatted,
  triggerXlsxDownload,
} from '../utils/accountingEngine';
import { getPreviousMonthYear } from '../utils/parser';

interface BenefitDemonstrativoViewProps {
  includedRows: ProcessedSD1Row[];
  selectedMonthYear: string;
}

export const BenefitDemonstrativoView: React.FC<BenefitDemonstrativoViewProps> = ({
  includedRows,
  selectedMonthYear,
}) => {
  const [selectedSheet, setSelectedSheet] = useState<BenefitType | 'ALL'>('TRANSPORTE');

  const dotMonthYear = (selectedMonthYear || '09-2026').replace('-', '.');
  const launchDateStr = getLastDayOfMonthFormatted(selectedMonthYear);
  const prevMonthYear = getPreviousMonthYear(selectedMonthYear).replace('-', '/');
  const currMonthYear = selectedMonthYear.replace('-', '/');

  const benefitsToRender: BenefitType[] =
    selectedSheet === 'ALL' ? BENEFIT_ORDER : [selectedSheet];

  const formatExcelCurrencyParts = (val: number): string => {
    return val.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const renderParcelaTable = (
    bType: BenefitType,
    parcelaNum: 1 | 2,
    rows: ProcessedSD1Row[]
  ) => {
    const cfg = BENEFIT_ACCOUNTING_MAP[bType];
    const subtotal = rows.reduce(
      (acc, r) => Math.round((acc + r.valor) * 100) / 100,
      0
    );

    const periodExplanation =
      parcelaNum === 1
        ? `Mês anterior: 20/${prevMonthYear} ao último dia de ${prevMonthYear}`
        : `Mês apurado: 01/${currMonthYear} a 19/${currMonthYear}`;

    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span className="font-medium text-slate-700">
            {parcelaNum}° Parcela ({periodExplanation})
          </span>
          <span className="font-mono tabular-nums">
            {rows.length} lançamento(s) · Subtotal: {formatCurrencyBRL(subtotal)}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full max-w-[680px] border-collapse border border-slate-900 font-mono text-xs tabular-nums bg-white text-slate-950">
            <thead>
              {/* Linha 1: Nome do Vale */}
              <tr>
                <th
                  colSpan={5}
                  className="border border-slate-900 py-1 px-2 text-center font-normal tracking-wide bg-white"
                >
                  {cfg.sheetHeaderTitle}
                </th>
              </tr>
              {/* Linha 2: LANÇAMENTO DD/MM/AAAA - 1° ou 2° Parcela */}
              <tr>
                <th
                  colSpan={5}
                  className="border border-slate-900 py-1 px-2 text-center font-bold bg-white"
                >
                  LANÇAMENTO {launchDateStr} - {parcelaNum}° Parcela
                </th>
              </tr>
              {/* Linha 3: Linha divisória vazia com borda (idêntica à linha 3 e 19 da planilha) */}
              <tr>
                <th colSpan={5} className="border border-slate-900 h-5 bg-white" />
              </tr>
              {/* Linha 4: Cabeçalhos das 5 colunas */}
              <tr className="bg-white text-left">
                <th className="border border-slate-900 py-1 px-2.5 font-normal w-28">
                  NF
                </th>
                <th className="border border-slate-900 py-1 px-2.5 font-normal w-28">
                  C. Custo
                </th>
                <th className="border border-slate-900 py-1 px-2.5 font-normal w-32">
                  Débito
                </th>
                <th className="border border-slate-900 py-1 px-2.5 font-normal w-32">
                  Crédito
                </th>
                <th className="border border-slate-900 py-1 px-2.5 font-normal w-36">
                  Valor
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="border border-slate-900 py-3 px-3 text-center text-slate-400 font-sans"
                  >
                    Nenhum lançamento encontrado para a {parcelaNum}° Parcela deste vale.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const isAdminDebit =
                    row.natureza === 'ADMINISTRATIVO' ||
                    row.contaDebito === cfg.debitoAdministrativo;

                  return (
                    <tr
                      key={row.id}
                      title={`Emissão: ${row.raw.dtEmissaoRaw} | Produto: ${row.produtoNormalized} | Setor: ${
                        row.centroCustoCatalogItem?.descricao || 'Não cadastrado'
                      }`}
                    >
                      <td className="border border-slate-900 py-0.5 px-2.5 text-center whitespace-nowrap">
                        {row.raw.documento || '-'}
                      </td>
                      <td className="border border-slate-900 py-0.5 px-2.5 text-center whitespace-nowrap">
                        {row.centroCusto || '-'}
                      </td>
                      <td
                        className={`border border-slate-900 py-0.5 px-2.5 text-center whitespace-nowrap ${
                          isAdminDebit ? 'bg-[#FFFF00] font-medium' : 'bg-white'
                        }`}
                      >
                        {row.contaDebito}
                      </td>
                      <td className="border border-slate-900 py-0.5 px-2.5 text-center whitespace-nowrap">
                        {row.contaCredito}
                      </td>
                      <td className="border border-slate-900 py-0.5 px-2.5 whitespace-nowrap">
                        <div className="flex items-center justify-between gap-2">
                          <span>R$</span>
                          <span>{formatExcelCurrencyParts(row.valor)}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 font-bold">
                  <td
                    colSpan={4}
                    className="border border-slate-900 py-1 px-2.5 text-right"
                  >
                    Subtotal {parcelaNum}° Parcela ({rows.length} itens)
                  </td>
                  <td className="border border-slate-900 py-1 px-2.5 whitespace-nowrap">
                    <div className="flex items-center justify-between gap-2">
                      <span>R$</span>
                      <span>{formatExcelCurrencyParts(subtotal)}</span>
                    </div>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    );
  };

  return (
    <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      {/* Cabeçalho e Ação de Download XLSX */}
      <div className="p-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-slate-50/60">
        <div>
          <h2 className="text-base font-bold text-slate-900 font-display">
            Demonstrativo Contábil por Vale — 1° e 2° Parcela (Layout Excel 4 Planilhas)
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            <strong>1° Parcela:</strong> Emissões do dia 20 até o último dia do mês anterior ({prevMonthYear}) ·{' '}
            <strong>2° Parcela:</strong> Emissões do dia 01 até o dia 19 do mês apurado ({currMonthYear}) ·{' '}
            Contas de débito administrativas destacadas em amarelo (<span className="font-mono">4204...</span>).
          </p>
        </div>

        <button
          type="button"
          disabled={includedRows.length === 0}
          onClick={() => triggerXlsxDownload(includedRows, selectedMonthYear)}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
            includedRows.length > 0
              ? 'bg-emerald-700 text-white hover:bg-emerald-800 shadow-xs'
              : 'bg-slate-200 text-slate-500 cursor-not-allowed'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>
            Baixar Excel 4 Planilhas (.xlsx) — VT, VR, VC, VAL {dotMonthYear}
          </span>
        </button>
      </div>

      {/* Barra de Guias Estilo Planilha Excel (VT, VR, VC, VAL) */}
      <div className="px-5 pt-3 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {BENEFIT_ORDER.map((bType) => {
            const cfg = BENEFIT_ACCOUNTING_MAP[bType];
            const sheetLabel = `${cfg.shortTabPrefix} ${dotMonthYear}`;
            const count = includedRows.filter((r) => r.benefitType === bType).length;
            const isSelected = selectedSheet === bType;

            return (
              <button
                key={bType}
                type="button"
                onClick={() => setSelectedSheet(bType)}
                className={`px-3.5 py-2 text-xs font-mono rounded-t-md border-t-2 border-x transition-colors flex items-center gap-2 ${
                  isSelected
                    ? 'bg-white text-emerald-900 font-bold border-t-emerald-600 border-x-slate-300 -mb-px pb-2.5'
                    : 'bg-emerald-600/15 text-slate-800 border-t-transparent border-x-transparent hover:bg-emerald-600/25'
                }`}
              >
                <span>{sheetLabel}</span>
                <span
                  className={`px-1.5 py-0.2 text-[10px] rounded ${
                    isSelected
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-white/70 text-slate-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setSelectedSheet('ALL')}
            className={`px-3.5 py-2 text-xs font-medium rounded-t-md border-t-2 border-x transition-colors inline-flex items-center gap-1.5 ${
              selectedSheet === 'ALL'
                ? 'bg-white text-sky-900 font-bold border-t-sky-600 border-x-slate-300 -mb-px pb-2.5'
                : 'bg-slate-200/70 text-slate-700 border-t-transparent border-x-transparent hover:bg-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Ver Todas as 4 Planilhas</span>
          </button>
        </div>

        <div className="text-[11px] text-slate-500 pb-2 font-mono">
          Data base do título: LANÇAMENTO {launchDateStr}
        </div>
      </div>

      {/* Área das Planilhas */}
      <div className="p-6 space-y-10 bg-white">
        {benefitsToRender.map((bType) => {
          const cfg = BENEFIT_ACCOUNTING_MAP[bType];
          const sheetRows = includedRows.filter((r) => r.benefitType === bType);
          const parcela1Rows = sheetRows
            .filter((r) => r.parcela === 1)
            .sort((a, b) => a.raw.rowIndex - b.raw.rowIndex);
          const parcela2Rows = sheetRows
            .filter((r) => r.parcela === 2)
            .sort((a, b) => a.raw.rowIndex - b.raw.rowIndex);

          const totalBenefit = sheetRows.reduce(
            (acc, r) => Math.round((acc + r.valor) * 100) / 100,
            0
          );

          return (
            <div
              key={bType}
              className="space-y-6 pb-8 border-b border-slate-200 last:border-b-0 last:pb-0"
            >
              {/* Cabeçalho identificador da aba */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-md">
                <div className="flex items-center gap-2.5">
                  <span className="px-2.5 py-1 text-xs font-mono font-bold bg-emerald-700 text-white rounded">
                    {cfg.shortTabPrefix} {dotMonthYear}
                  </span>
                  <span className="text-sm font-bold text-slate-900">
                    {cfg.sheetHeaderTitle}
                  </span>
                  <span className="text-xs text-slate-500 font-mono">
                    (Crédito: {cfg.credito} · Déb. Admin: {cfg.debitoAdministrativo} · Déb. Oper: {cfg.debitoOperacional})
                  </span>
                </div>
                <div className="text-xs font-mono font-bold text-slate-900 tabular-nums">
                  Total {cfg.label}: {formatCurrencyBRL(totalBenefit)} ({sheetRows.length} lançamentos)
                </div>
              </div>

              {/* Bloco 1: 1° Parcela (Acima, igual no Excel) */}
              {renderParcelaTable(bType, 1, parcela1Rows)}

              {/* Bloco 2: 2° Parcela (Abaixo, igual no Excel) */}
              {renderParcelaTable(bType, 2, parcela2Rows)}
            </div>
          );
        })}
      </div>
    </section>
  );
};
