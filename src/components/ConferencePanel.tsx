import React from 'react';
import { AlertTriangle, CheckCircle2, Filter, PlusCircle } from 'lucide-react';
import { BENEFIT_ACCOUNTING_MAP, BENEFIT_ORDER } from '../data/defaults';
import {
  BenefitType,
  ReconciliationSummary,
  ValidationIssueType,
} from '../types';
import { formatCurrencyBRL } from '../utils/accountingEngine';

interface ConferencePanelProps {
  summary: ReconciliationSummary;
  dateFilterLabel?: string;
  onIncludeAllFileDates?: () => void;
  activeIssueFilter: ValidationIssueType | 'ALL_ISSUES' | null;
  onSelectIssueFilter: (filter: ValidationIssueType | 'ALL_ISSUES' | null) => void;
  activeBenefitFilter: BenefitType | 'ALL';
  onSelectBenefitFilter: (benefit: BenefitType | 'ALL') => void;
  onQuickAddProductFromDiscarded: (codigo: string, descricao: string) => void;
}

export const ConferencePanel: React.FC<ConferencePanelProps> = ({
  summary,
  dateFilterLabel,
  onIncludeAllFileDates,
  activeIssueFilter,
  onSelectIssueFilter,
  activeBenefitFilter,
  onSelectBenefitFilter,
  onQuickAddProductFromDiscarded,
}) => {
  const parityMatches =
    Math.abs(summary.totalIncludedValue - summary.totalCsvValue) < 0.005;

  const issueCards: Array<{
    key: ValidationIssueType;
    label: string;
    count: number;
    desc: string;
  }> = [
    {
      key: 'EMPTY_CC',
      label: 'Centro de custo em branco',
      count: summary.issueCounts.EMPTY_CC,
      desc: 'Linhas sem CC informado no SD1',
    },
    {
      key: 'UNKNOWN_CC',
      label: 'Centro de custo inexistente',
      count: summary.issueCounts.UNKNOWN_CC,
      desc: 'Código ausente no cadastro base',
    },
    {
      key: 'SYNTHETIC_CC',
      label: 'Centro de custo sintético',
      count: summary.issueCounts.SYNTHETIC_CC,
      desc: 'Classe Sintético não recebe lançamento',
    },
    {
      key: 'UNCLASSIFIED_NATURE',
      label: 'Centro de custo a classificar',
      count: summary.issueCounts.UNCLASSIFIED_NATURE,
      desc: 'Alocado em Admin por padrão (revisável)',
    },
  ];

  return (
    <section className="space-y-6">
      {/* Linha 1: Total Geral, Subtotais por Natureza e Funil de Leitura */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Card Total Geral e Paridade */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between">
          <div>
            <div className="text-xs font-medium text-slate-500">
              Total Geral Apurado ({dateFilterLabel || 'Ciclo 20/Mês Ant. a 19/Mês Atual'})
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {formatCurrencyBRL(summary.totalIncludedValue)}
            </div>
            <div className="mt-1 text-xs text-slate-600 flex items-center gap-1.5">
              {parityMatches ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>
                    Soma do CSV idêntica ao Vlr.Total ({summary.includedRowsCount} itens)
                  </span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>
                    Diferença de arredondamento detectada
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-3 gap-2 text-xs">
            <div>
              <div className="text-slate-500">Operacional</div>
              <div className="font-mono font-semibold text-slate-900 tabular-nums mt-0.5">
                {formatCurrencyBRL(summary.byNature.OPERACIONAL.total)}
              </div>
              <div className="text-slate-400 font-mono tabular-nums">
                {summary.byNature.OPERACIONAL.count} lanç.
              </div>
            </div>
            <div>
              <div className="text-slate-500">Administrativo</div>
              <div className="font-mono font-semibold text-slate-900 tabular-nums mt-0.5">
                {formatCurrencyBRL(summary.byNature.ADMINISTRATIVO.total)}
              </div>
              <div className="text-slate-400 font-mono tabular-nums">
                {summary.byNature.ADMINISTRATIVO.count} lanç.
              </div>
            </div>
            <div>
              <div className="text-slate-500">Outras Faixas</div>
              <div
                className={`font-mono font-semibold tabular-nums mt-0.5 ${
                  summary.byNature.A_CLASSIFICAR.count > 0
                    ? 'text-amber-700'
                    : 'text-slate-900'
                }`}
              >
                {formatCurrencyBRL(summary.byNature.A_CLASSIFICAR.total)}
              </div>
              <div className="text-slate-400 font-mono tabular-nums">
                {summary.byNature.A_CLASSIFICAR.count} lanç.
              </div>
            </div>
          </div>
        </div>

        {/* Subtotais por Tipo de Vale (clicáveis para filtrar) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-slate-700">
              Subtotais por Tipo de Benefício (Ordem do CSV)
            </h3>
            {activeBenefitFilter !== 'ALL' && (
              <button
                type="button"
                onClick={() => onSelectBenefitFilter('ALL')}
                className="text-xs text-sky-700 hover:underline whitespace-nowrap shrink-0"
              >
                Mostrar todos
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {BENEFIT_ORDER.map((bType) => {
              const info = BENEFIT_ACCOUNTING_MAP[bType];
              const stat = summary.byBenefit[bType];
              const isSelected = activeBenefitFilter === bType;
              return (
                <button
                  key={bType}
                  type="button"
                  onClick={() =>
                    onSelectBenefitFilter(isSelected ? 'ALL' : bType)
                  }
                  className={`text-left p-3 rounded-md border transition-colors ${
                    isSelected
                      ? 'bg-sky-50/70 border-sky-600'
                      : 'bg-slate-50/60 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span className="font-semibold text-slate-900">
                      {info.order}. Vale {info.label}
                    </span>
                    <span className="font-mono tabular-nums text-slate-500">
                      {stat.count} lin.
                    </span>
                  </div>
                  <div className="mt-1.5 text-sm font-bold font-mono tabular-nums text-slate-900">
                    {formatCurrencyBRL(stat.total)}
                  </div>
                  <div className="mt-1 text-[11px] font-mono text-slate-500 tabular-nums">
                    Créd: {info.credito}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Funil de Linhas Lidas, Incluídas e Descartadas */}
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-semibold text-slate-700">
              Relatório de Leitura do SD1
            </h3>
            <dl className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <dt className="text-slate-600">Total de linhas lidas</dt>
                <dd className="font-mono font-semibold text-slate-900 tabular-nums">
                  {summary.totalRowsRead}
                </dd>
              </div>
              <div className="flex items-center justify-between text-slate-700">
                <dt>Vales encontrados no SD1</dt>
                <dd className="font-mono font-semibold text-slate-900 tabular-nums">
                  {summary.totalBenefitRowsInFile}
                </dd>
              </div>
              <div className="flex items-center justify-between text-emerald-700 font-medium">
                <dt>Incluídas no CSV</dt>
                <dd className="font-mono font-semibold tabular-nums">
                  {summary.includedRowsCount}
                </dd>
              </div>
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-slate-600">
                <dt>Descartadas: produto fora da lista</dt>
                <dd className="font-mono font-semibold text-slate-800 tabular-nums">
                  {summary.discardedNotBenefitCount}
                </dd>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <dt>Descartadas: dia 20+ do mês apurado</dt>
                <dd className="font-mono font-semibold text-slate-800 tabular-nums">
                  {summary.discardedDateAfter19Count}
                </dd>
              </div>
              {summary.discardedOtherMonthCount > 0 && (
                <div className="flex items-center justify-between text-slate-500">
                  <dt>Descartadas: fora do ciclo selecionado</dt>
                  <dd className="font-mono font-semibold tabular-nums">
                    {summary.discardedOtherMonthCount}
                  </dd>
                </div>
              )}
            </dl>

            {summary.includedRowsCount === 0 &&
              summary.totalBenefitRowsInFile > 0 &&
              onIncludeAllFileDates && (
                <button
                  type="button"
                  onClick={onIncludeAllFileDates}
                  className="mt-3 w-full py-1.5 px-2.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded transition-colors"
                >
                  Incluir todos os {summary.totalBenefitRowsInFile} vales do arquivo
                </button>
              )}
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500">
            Filtro estrito pelos códigos exatos cadastrados e pela data da coluna DT Emissao.
          </div>
        </div>
      </div>

      {/* Linha 2: Alertas de Conferência e Top 10 Códigos Descartados */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Alertas de Pendências Contábeis */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-xs font-semibold text-slate-800">
                Alertas e Pendências de Centros de Custo
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Clique em um alerta para filtrar as linhas pendentes na tabela abaixo
              </p>
            </div>
            {activeIssueFilter !== null && (
              <button
                type="button"
                onClick={() => onSelectIssueFilter(null)}
                className="text-xs text-sky-700 hover:underline whitespace-nowrap shrink-0"
              >
                Limpar filtro
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {issueCards.map((item) => {
              const isSelected = activeIssueFilter === item.key;
              const hasAlerts = item.count > 0;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() =>
                    onSelectIssueFilter(isSelected ? null : item.key)
                  }
                  className={`p-3 rounded-md border text-left transition-colors ${
                    isSelected
                      ? 'bg-amber-50 border-amber-600'
                      : hasAlerts
                      ? 'bg-amber-50/40 border-amber-200 hover:border-amber-400'
                      : 'bg-slate-50/50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-900">
                      {item.label}
                    </span>
                    <span
                      className={`font-mono text-xs font-bold tabular-nums ${
                        hasAlerts ? 'text-amber-700' : 'text-emerald-700'
                      }`}
                    >
                      {item.count}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">{item.desc}</p>
                </button>
              );
            })}
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-600">
              Total de linhas incluídas com alguma pendência:
            </span>
            <button
              type="button"
              onClick={() =>
                onSelectIssueFilter(
                  activeIssueFilter === 'ALL_ISSUES' ? null : 'ALL_ISSUES'
                )
              }
              className="inline-flex items-center gap-1.5 font-mono font-semibold text-slate-900 hover:text-sky-700 tabular-nums"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>{summary.issueCounts.totalRowsWithIssues} linha(s)</span>
            </button>
          </div>
        </div>

        {/* Top 10 Códigos Descartados Mais Frequentes */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-xs font-semibold text-slate-800">
                Top 10 Códigos Descartados Mais Frequentes (Produto fora da lista)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Conferência de segurança para verificar se algum código de vale ficou fora da tabela fixa
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500 tabular-nums">
              {summary.discardedNotBenefitCount} linha(s) descartadas no total
            </span>
          </div>

          {summary.topDiscardedProducts.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-md">
              Nenhum produto fora da lista de vales foi encontrado no arquivo atual.
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-md">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <th className="py-2 px-3 font-semibold">#</th>
                    <th className="py-2 px-3 font-semibold">Código no SD1</th>
                    <th className="py-2 px-3 font-semibold">Descrição Auxiliar</th>
                    <th className="py-2 px-3 font-semibold text-right">Qtd. Linhas</th>
                    <th className="py-2 px-3 font-semibold text-right">Soma Vlr.Total</th>
                    <th className="py-2 px-3 font-semibold text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summary.topDiscardedProducts.map((item, idx) => (
                    <tr key={item.codigo} className="hover:bg-slate-50/80">
                      <td className="py-1.5 px-3 font-mono text-slate-400 tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="py-1.5 px-3 font-mono font-medium text-slate-900 tabular-nums">
                        {item.codigo}
                      </td>
                      <td className="py-1.5 px-3 text-slate-600 max-w-xs truncate">
                        {item.descricao}
                      </td>
                      <td className="py-1.5 px-3 font-mono text-right text-slate-800 tabular-nums">
                        {item.count}
                      </td>
                      <td className="py-1.5 px-3 font-mono text-right text-slate-700 tabular-nums">
                        {formatCurrencyBRL(item.totalValue)}
                      </td>
                      <td className="py-1.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            onQuickAddProductFromDiscarded(item.codigo, item.descricao)
                          }
                          className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:text-sky-900 whitespace-nowrap shrink-0"
                          title="Cadastrar manualmente este código como um produto de Vale"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>Incluir Vale</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
