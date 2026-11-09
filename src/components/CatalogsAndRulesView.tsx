import React, { useState } from 'react';
import { Plus, RotateCcw, Trash2, Upload } from 'lucide-react';
import { BENEFIT_ACCOUNTING_MAP, BENEFIT_ORDER } from '../data/defaults';
import {
  BenefitProductRule,
  BenefitType,
  CostCenterCatalogItem,
  CostCenterClass,
  CostCenterNature,
  CsvExportSettings,
} from '../types';
import { inferDefaultCostCenterNature } from '../utils/accountingEngine';
import { normalizeCostCenterCode } from '../utils/parser';

interface CatalogsAndRulesViewProps {
  benefitProducts: BenefitProductRule[];
  onAddBenefitProduct: (rule: BenefitProductRule) => void;
  onRemoveBenefitProduct: (codigo: string) => void;
  onResetBenefitProducts: () => void;
  productDescriptionsCount: number;
  onUploadProductDictionary: (file: File) => void;
  costCenters: CostCenterCatalogItem[];
  customCostCenterNatures: Record<string, CostCenterNature>;
  onSetCostCenterNature: (codigo: string, natureza: CostCenterNature) => void;
  onAddCostCenterItem: (item: CostCenterCatalogItem, natureza?: CostCenterNature) => void;
  onUploadCostCentersFile: (file: File) => void;
  onResetCostCentersAndRules: () => void;
  exportSettings: CsvExportSettings;
  onUpdateExportSettings: (patch: Partial<CsvExportSettings>) => void;
}

export const CatalogsAndRulesView: React.FC<CatalogsAndRulesViewProps> = ({
  benefitProducts,
  onAddBenefitProduct,
  onRemoveBenefitProduct,
  onResetBenefitProducts,
  productDescriptionsCount,
  onUploadProductDictionary,
  costCenters,
  customCostCenterNatures,
  onSetCostCenterNature,
  onAddCostCenterItem,
  onUploadCostCentersFile,
  onResetCostCentersAndRules,
  exportSettings,
  onUpdateExportSettings,
}) => {
  // Novo produto de vale manual
  const [newProdCode, setNewProdCode] = useState('');
  const [newProdDesc, setNewProdDesc] = useState('');
  const [newProdType, setNewProdType] = useState<BenefitType>('TRANSPORTE');

  // Novo centro de custo manual
  const [newCCCode, setNewCCCode] = useState('');
  const [newCCDesc, setNewCCDesc] = useState('');
  const [newCCClass, setNewCCClass] = useState<CostCenterClass>('Analitico');
  const [newCCNature, setNewCCNature] = useState<CostCenterNature>('ADMINISTRATIVO');

  const [ccFilter, setCcFilter] = useState('');

  const handleAddProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = newProdCode.trim().toUpperCase();
    if (!cleanCode) return;
    onAddBenefitProduct({
      codigo: cleanCode,
      descricao: newProdDesc.trim().toUpperCase() || `VALE ${newProdType}`,
      tipoVale: newProdType,
      isFixedDefault: false,
    });
    setNewProdCode('');
    setNewProdDesc('');
  };

  const handleAddCCSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCC = normalizeCostCenterCode(newCCCode);
    if (!cleanCC) return;
    onAddCostCenterItem(
      {
        codigo: cleanCC,
        classe: newCCClass,
        condicaoNormal: 'Despesa',
        descricao: newCCDesc.trim().toUpperCase() || 'CENTRO DE CUSTO CUSTOMIZADO',
      },
      newCCNature
    );
    setNewCCCode('');
    setNewCCDesc('');
  };

  const filteredCostCenters = costCenters.filter((cc) => {
    if (!ccFilter.trim()) return true;
    const q = ccFilter.trim().toLowerCase();
    return (
      cc.codigo.toLowerCase().includes(q) ||
      cc.descricao.toLowerCase().includes(q) ||
      cc.classe.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-8">
      {/* Seção 1: Tabela Fixa de Produtos de Vale (Identificação por Igualdade Exata) */}
      <section className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              1. Tabela de Códigos de Produtos de Vale (Filtro por Igualdade Exata)
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              A comparação com a coluna &quot;Produto&quot; do SD1 é feita por igualdade exata (sem usar prefixos DP001/DP002 e sem usar descrição). Qualquer código fora desta tabela é descartado.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer transition-colors whitespace-nowrap">
              <Upload className="w-3.5 h-3.5" />
              <span>Subir Listagem p/ Descrições ({productDescriptionsCount})</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.txt"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onUploadProductDictionary(file);
                  e.target.value = '';
                }}
                className="hidden"
              />
            </label>
            <button
              type="button"
              onClick={onResetBenefitProducts}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-md whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restaurar 8 Códigos Fixos</span>
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Tabela dos códigos */}
          <div className="lg:col-span-8 overflow-x-auto border border-slate-200 rounded-md">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="py-2.5 px-3 font-semibold">Código Exato</th>
                  <th className="py-2.5 px-3 font-semibold">Descrição</th>
                  <th className="py-2.5 px-3 font-semibold">Tipo de Vale</th>
                  <th className="py-2.5 px-3 font-semibold">Origem</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {benefitProducts.map((item) => (
                  <tr key={item.codigo} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-mono font-semibold text-slate-900 tabular-nums">
                      {item.codigo}
                    </td>
                    <td className="py-2 px-3 text-slate-700">{item.descricao}</td>
                    <td className="py-2 px-3 font-medium text-slate-900">
                      {BENEFIT_ACCOUNTING_MAP[item.tipoVale].label}
                    </td>
                    <td className="py-2 px-3 text-slate-500">
                      {item.isFixedDefault ? 'Padrão Fixo (8)' : 'Adicionado Manualmente'}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {!item.isFixedDefault ? (
                        <button
                          type="button"
                          onClick={() => onRemoveBenefitProduct(item.codigo)}
                          className="inline-flex items-center gap-1 text-red-600 hover:text-red-800 text-xs font-medium"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remover</span>
                        </button>
                      ) : (
                        <span className="text-slate-400">Fixo</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Formulário para adicionar novo código manualmente */}
          <form
            onSubmit={handleAddProductSubmit}
            className="lg:col-span-4 bg-slate-50 border border-slate-200 rounded-md p-4 space-y-3 self-start"
          >
            <h3 className="text-xs font-bold text-slate-900">
              Incluir Novo Código de Produto Manualmente
            </h3>
            <p className="text-[11px] text-slate-500">
              Para incluir um código novo na apuração, informe o código exato do Protheus e o tipo de vale correspondente.
            </p>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Código do Produto (Exato)
              </label>
              <input
                type="text"
                value={newProdCode}
                onChange={(e) => setNewProdCode(e.target.value)}
                placeholder="Ex: DP0010020000048"
                required
                className="w-full px-3 py-1.5 text-xs font-mono border border-slate-300 rounded bg-white focus:outline-none focus:border-sky-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Tipo de Vale
              </label>
              <select
                value={newProdType}
                onChange={(e) => setNewProdType(e.target.value as BenefitType)}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded bg-white focus:outline-none focus:border-sky-600"
              >
                {BENEFIT_ORDER.map((b) => (
                  <option key={b} value={b}>
                    {BENEFIT_ACCOUNTING_MAP[b].label}
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
                value={newProdDesc}
                onChange={(e) => setNewProdDesc(e.target.value)}
                placeholder="Ex: VALE TRANSPORTE EXTRA"
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded bg-white focus:outline-none focus:border-sky-600"
              />
            </div>
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Adicionar à Tabela de Vales</span>
            </button>
          </form>
        </div>
      </section>

      {/* Seção 2: Matriz de Contas Contábeis */}
      <section className="bg-white border border-slate-200 rounded-lg p-6">
        <h2 className="text-base font-bold text-slate-900">
          2. Matriz de Contas Contábeis e Históricos
        </h2>
        <p className="text-xs text-slate-600 mt-1">
          A conta de crédito depende apenas do tipo de vale. A conta de débito depende do tipo de vale e da natureza do centro de custo (Administrativo ou Operacional).
        </p>

        <div className="mt-4 overflow-x-auto border border-slate-200 rounded-md">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <th className="py-2.5 px-3 font-semibold">Ordem / Vale</th>
                <th className="py-2.5 px-3 font-semibold">Conta Crédito</th>
                <th className="py-2.5 px-3 font-semibold">Débito Administrativo</th>
                <th className="py-2.5 px-3 font-semibold">Débito Operacional</th>
                <th className="py-2.5 px-3 font-semibold">Padrão de Histórico</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
              {BENEFIT_ORDER.map((bType) => {
                const cfg = BENEFIT_ACCOUNTING_MAP[bType];
                return (
                  <tr key={bType} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-sans font-semibold text-slate-900">
                      {cfg.order}. {cfg.label}
                    </td>
                    <td className="py-2 px-3 text-slate-800">{cfg.credito}</td>
                    <td className="py-2 px-3 text-slate-800">
                      {cfg.debitoAdministrativo}
                    </td>
                    <td className="py-2 px-3 text-slate-800">
                      {cfg.debitoOperacional}
                    </td>
                    <td className="py-2 px-3 text-slate-700">
                      {cfg.historicoPrefix} MM-AAAA
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Seção 3: Cadastro e Natureza dos Centros de Custo */}
      <section className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              3. Cadastro de Centros de Custo e Regras de Natureza
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              Altere a natureza de qualquer centro de custo abaixo. As configurações ficam salvas automaticamente no navegador.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-md cursor-pointer">
              <input
                type="checkbox"
                checked={exportSettings.comercialRangeAsAdmin}
                onChange={(e) =>
                  onUpdateExportSettings({ comercialRangeAsAdmin: e.target.checked })
                }
                className="rounded border-slate-300 text-sky-600"
              />
              <span>Classificar Comercial (000003xxx) como Administrativo por padrão</span>
            </label>

            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer transition-colors whitespace-nowrap">
              <Upload className="w-3.5 h-3.5" />
              <span>Substituir Cadastro CC (.xlsx/.csv)</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.txt"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onUploadCostCentersFile(file);
                  e.target.value = '';
                }}
                className="hidden"
              />
            </label>

            <button
              type="button"
              onClick={onResetCostCentersAndRules}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-md whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restaurar Padrão</span>
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-3">
            <div className="flex items-center justify-between">
              <input
                type="text"
                value={ccFilter}
                onChange={(e) => setCcFilter(e.target.value)}
                placeholder="Filtrar por código ou descrição do centro de custo..."
                className="w-full max-w-sm px-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-sky-600"
              />
              <span className="text-xs text-slate-500 font-mono tabular-nums">
                {filteredCostCenters.length} centros de custo
              </span>
            </div>

            <div className="overflow-x-auto max-h-[460px] border border-slate-200 rounded-md">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="py-2 px-3 font-semibold">C Custo (9 díg.)</th>
                    <th className="py-2 px-3 font-semibold">Classe</th>
                    <th className="py-2 px-3 font-semibold">Descrição</th>
                    <th className="py-2 px-3 font-semibold">Natureza Contábil</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCostCenters.map((cc) => {
                    const effectiveNature =
                      customCostCenterNatures[cc.codigo] ??
                      inferDefaultCostCenterNature(
                        cc.codigo,
                        exportSettings.comercialRangeAsAdmin
                      );
                    const isCustom = Boolean(customCostCenterNatures[cc.codigo]);

                    return (
                      <tr key={cc.codigo} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono font-semibold text-slate-900 tabular-nums">
                          {cc.codigo}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={
                              cc.classe === 'Sintetico'
                                ? 'text-amber-800 font-medium'
                                : 'text-slate-600'
                            }
                          >
                            {cc.classe}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-800">{cc.descricao}</td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <select
                              value={effectiveNature}
                              onChange={(e) =>
                                onSetCostCenterNature(
                                  cc.codigo,
                                  e.target.value as CostCenterNature
                                )
                              }
                              className="text-xs border border-slate-200 rounded px-2 py-1 bg-white text-slate-900 focus:border-sky-600"
                            >
                              <option value="OPERACIONAL">Operacional (4101...)</option>
                              <option value="ADMINISTRATIVO">
                                Administrativo (4204...)
                              </option>
                              <option value="A_CLASSIFICAR">
                                A Classificar (Pendência)
                              </option>
                            </select>
                            {isCustom && (
                              <span className="text-[11px] text-sky-700">
                                Customizado
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Adicionar Centro de Custo Manualmente */}
          <form
            onSubmit={handleAddCCSubmit}
            className="lg:col-span-4 bg-slate-50 border border-slate-200 rounded-md p-4 space-y-3 self-start"
          >
            <h3 className="text-xs font-bold text-slate-900">
              Cadastrar Centro de Custo Manualmente
            </h3>
            <p className="text-[11px] text-slate-500">
              Adicione um centro de custo caso ele apareça no SD1 e ainda não conste na planilha base.
            </p>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Código do Centro de Custo
              </label>
              <input
                type="text"
                value={newCCCode}
                onChange={(e) => setNewCCCode(e.target.value)}
                placeholder="Ex: 000006101"
                required
                className="w-full px-3 py-1.5 text-xs font-mono border border-slate-300 rounded bg-white focus:outline-none focus:border-sky-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Descrição do Setor
              </label>
              <input
                type="text"
                value={newCCDesc}
                onChange={(e) => setNewCCDesc(e.target.value)}
                placeholder="Ex: CONTABILIDADE FISCAL"
                required
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded bg-white focus:outline-none focus:border-sky-600"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Classe
                </label>
                <select
                  value={newCCClass}
                  onChange={(e) => setNewCCClass(e.target.value as CostCenterClass)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white"
                >
                  <option value="Analitico">Analítico</option>
                  <option value="Sintetico">Sintético</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Natureza
                </label>
                <select
                  value={newCCNature}
                  onChange={(e) => setNewCCNature(e.target.value as CostCenterNature)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white"
                >
                  <option value="ADMINISTRATIVO">Administrativo</option>
                  <option value="OPERACIONAL">Operacional</option>
                  <option value="A_CLASSIFICAR">A Classificar</option>
                </select>
              </div>
            </div>
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Adicionar Centro de Custo</span>
            </button>
          </form>
        </div>
      </section>
    </div>
  );
};
