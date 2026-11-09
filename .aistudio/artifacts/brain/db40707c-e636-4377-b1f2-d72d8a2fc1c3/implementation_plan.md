# Apurador Contábil SD1 — Benefícios e Vales (Protheus TOTVS)

Aplicação web 100% client-side para importar a exportação da tabela SD1 (itens de notas fiscais de entrada do TOTVS Protheus), filtrar e auditar exclusivamente despesas de Vale Transporte, Vale Refeição, Vale Combustível e Vale Alimentação por código exato de produto e janela de emissão (dias 01 a 19 do mês de apuração), validar centros de custo e exportar o arquivo CSV contábil padronizado (`vales_MM-AAAA.csv`).

---

## Revisão do Usuário & Decisões Confirmadas

> [!IMPORTANT]
> As decisões e regras abaixo foram confirmadas pelo usuário e governam o comportamento estrito da aplicação:

- **Decisão Confirmada 1 — Filtro de Produto por Igualdade Exata (8 Códigos Fixos)**:
  - A identificação de produtos de vale será feita **exclusivamente por igualdade exata** (`trim().toUpperCase()`) contra a tabela de códigos autorizados, iniciando com os 8 códigos oficiais:
    - `DP0010020000044` — `VALE TRANSPORTE` → **Transporte**
    - `DP0010020000045` — `VALE REFEICAO` → **Refeição**
    - `DP0010020000046` — `VALE ALIMENTACAO` → **Alimentação**
    - `DP0010020000047` — `VALE COMBUSTIVEL` → **Combustível**
    - `DP0020030000017` — `VALE COMBUSTIVEL` → **Combustível**
    - `DP0020030000018` — `VALE TRANSPORTE` → **Transporte**
    - `DP0020030000019` — `VALE REFEICAO` → **Refeição**
    - `DP0020030000020` — `VALE ALIMENTACAO` → **Alimentação**
  - **Proibido usar prefixos** (`DP`, `DP001`, `DP002`), "começa com" ou busca textual na descrição para classificar um item como vale. Qualquer código fora desta tabela é descartado, mesmo que sua descrição contenha a palavra "VALE".
  - **Papel da Listagem de Produtos e Inclusão Manual**: A tabela de códigos de vale fica fixa no sistema e visível na tela de **Cadastros Base**, onde o usuário pode adicionar manualmente um novo código informando sua descrição e o Tipo de Vale. Caso o usuário faça upload de uma planilha geral de produtos (`.xlsx`/`.csv`), ela servirá **apenas como dicionário auxiliar para exibir a descrição** dos itens (inclusive na lista de descartados), nunca para aprovar produtos automaticamente.
- **Decisão Confirmada 2 — Auditoria dos Top 10 Produtos Descartados**:
  - No **Painel de Conferência**, além de exibir o total de linhas descartadas por *"produto fora da lista"*, o sistema listará os **10 códigos descartados mais frequentes** (com código, descrição se disponível no dicionário e quantidade de ocorrências/valor) para que o analista confira rapidamente se algum código novo de vale ficou de fora.
- **Decisão Confirmada 3 — Formato Numérico de Valor no CSV**:
  - A coluna `Valor` do CSV exportado utilizará como padrão 2 casas decimais fixas com vírgula e sem separador de milhar (ex.: `600,00`, `533,19`), com opção rápida caso o usuário deseje alternar para o formato compacto sem zeros finais (`600`, `545,2`).
- **Decisão Confirmada 4 — Classificação Inicial de Centros de Custo**:
  - **Operacional**: Faixas `000001000` a `000002999` e `000004000` a `000005999` (Oficina, Manutenção, Logística, Operação, Reformas).
  - **Administrativo**: Faixa Comercial `000003000` a `000003999` e faixa `000006000` a `000008999` (Comercial, Contabilidade, DP, Financeiro, Compras, Almoxarifado, Diretoria, RH, TI/Desenvolvimento etc.).
  - **A Classificar (Pendência)**: Filiais e unidades especiais a partir de `000100000` (`Inhaúma`, `Caturb`, `Sucata BR BAP`, `Gusa`, `Filial Guadalupe`, `9000/9001`) ou códigos fora das faixas até definição pelo usuário.

---

## 1. Visão Geral & Conceito Central

- **O Que Faz**: Processa localmente (100% no navegador, sem envio a servidores externos) arquivos da tabela SD1 do Protheus, filtrando estritamente os códigos de produto cadastrados na tabela de vales e emissões dos dias 01 a 19 do mês apurado, validando centros de custo analíticos/sintéticos e mapeando automaticamente as contas contábeis de Débito e Crédito para geração do CSV contábil.
- **Público-Alvo / Persona**: Analistas contábeis, financeiros e de departamento pessoal responsáveis pela conciliação e importação mensal de despesas de benefícios no TOTVS Protheus.
- **Valor Principal**: Garante precisão determinística (nenhum item fora da tabela oficial de códigos ou emitido a partir do dia 20 entra no lote), oferece visibilidade imediata dos 10 códigos descartados mais frequentes para auditoria e assegura que a soma do CSV bata exatamente com o `Vlr.Total` das linhas incluídas.

---

## 2. Experiência do Usuário & Design Visual

### Fluxos Principais do Usuário
1. **Importação e Detecção Automática**:
   - Área de upload para o arquivo principal **SD1** (`.xlsx`, `.xls`, `.csv`, `.txt` separado por tabulação, ponto e vírgula ou vírgula) com detecção automática de delimitador e remoção de espaços extras nos cabeçalhos.
   - Botão **"Carregar Dados de Exemplo (Set/2026)"** para testar todo o fluxo imediatamente.
   - Indicadores de status dos cadastros (**Tabela de 8 Produtos de Vale**, **Dicionário de Descrições de Produtos opcional** e **Cadastro de Centros de Custo** pré-carregado), com acesso rápido para substituição ou adição manual.
   - Detecção automática do **Mês/Ano de Apuração (`MM-AAAA`)** pelo mês mais frequente em `DT Emissao`, com campo editável.
2. **Painel de Conferência e Auditoria**:
   - Resumo financeiro com **Total Geral Incluído**, subtotais para os 4 tipos de vale (**Transporte**, **Refeição**, **Combustível**, **Alimentação**) e subtotais por natureza (**Operacional** vs. **Administrativo**).
   - Contagem detalhada de linhas lidas, incluídas e descartadas por motivo:
     - *Produto fora da lista*;
     - *Emissão a partir do dia 20* (ou fora do mês de apuração).
   - **Quadro "Top 10 Códigos Descartados Mais Frequentes"**: Exibe os 10 produtos mais recorrentes que foram barrados pelo filtro de produto (mostrando Código, Descrição auxiliar se disponível, Quantidade de linhas e Valor Total somado), permitindo ao usuário auditar se algum código legítimo de vale precisa ser adicionado manualmente na tabela.
   - **Alertas de Pendências** interativos (clicar filtra a tabela):
     - Centro de custo em branco;
     - Centro de custo inexistente no cadastro;
     - Centro de custo **Sintético** (não recebe lançamento);
     - Centro de custo **A Classificar**.
3. **Pré-visualização Editável e Resolução de Pendências**:
   - Tabela de alta densidade exibindo as colunas exatas do CSV (`Debito`, `Credito`, `Valor`, `Historico`, `CC Debito`, `CC Credito`, `CLASSE De`, `ITEM Debi`, `ITEM Credito`) e colunas de conferência (`Documento`, `DT Emissao`, `Produto`, `Natureza`).
   - Edição inline do **Centro de Custo** e da **Natureza / Conta de Débito** de uma linha antes de exportar, com opção de salvar a natureza escolhida no cadastro permanente.
4. **Cadastros Base & Regras Contábeis**:
   - Tela dedicada exibindo a **Tabela Oficial de Produtos de Vale** (fixa por padrão com os 8 códigos, permitindo adicionar manualmente um novo código + descrição + tipo de vale, ou remover códigos adicionados manualmente, além de subir planilha auxiliar apenas para enriquecer descrições).
   - Gestão do **Cadastro de Centros de Custo** e configuração de sua natureza (`Operacional`, `Administrativo`, `A Classificar`) com persistência em `localStorage`.

### Identidade Visual & Tema (SaaS Financeiro / Auditoria Contábil)
- **Direção Estética**: Utilitário corporativo de alta precisão, superfícies planas com bordas de `1px` (`border-slate-200`), sem cartões aninhados.
- **Paleta de Cores (60-30-10)**:
  - *60% Canvas Dominante*: Fundo claro neutro (`#F8FAFC` / `slate-50`) e tabelas em branco puro (`#FFFFFF`).
  - *30% Estrutura & Tipografia*: Texto principal em `#0F172A` (`slate-900`), rótulos secundários em `#475569` (`slate-600`), divisores em `#E2E8F0` (`slate-200`).
  - *10% Acento & Semântica*: Azul contábil (`#0284C7` / `sky-600`) para ações; Verde (`#16A34A`) para itens válidos; Âmbar (`#D97706`) para alertas de classificação; Vermelho (`#DC2626`) para pendências impeditivas.
- **Tipografia & Hierarquia**:
  - *Display / Títulos*: `Plus Jakarta Sans` (SemiBold/Bold).
  - *Corpo / Interface*: `Public Sans` ou `Plus Jakarta Sans`.
  - *Dados Contábeis, Códigos e Valores*: `JetBrains Mono` com `font-variant-numeric: tabular-nums` em todas as contas contábeis, códigos de produto, centros de custo, quantidades e valores monetários.

---

## 3. Decisões de Produto & Trade-offs Técnicos

- **Decisão 1 — Identificação Determinística de Produtos por Igualdade Exata**:
  - *Abordagem Escolhida*: O motor mantém um mapa chaveado pelo código exato normalizado (`codigo.trim().toUpperCase()`) contendo inicialmente apenas os 8 códigos especificados. Nenhum fallback por prefixo ou substring na descrição é executado.
  - *Por quê*: Evita falsos positivos (ex.: serviços ou reembolsos diversos na tabela SD1 cuja descrição contenha a palavra "VALE" ou que pertençam ao mesmo grupo `DP001`/`DP002`).
- **Decisão 2 — Separação entre Tabela de Vales Autorizados e Dicionário de Descrições**:
  - *Abordagem Escolhida*: Quando o usuário importa uma planilha geral de produtos (`.xlsx`), o sistema armazena um `Map<codigo, descricao>` puramente informativo. Para que um código passe no filtro e gere lançamento no CSV, ele deve constar na **Tabela de Produtos de Vale** (os 8 códigos fixos + eventuais códigos adicionados manualmente pelo usuário com seu respectivo Tipo de Vale).
  - *Por quê*: Garante controle estrito sobre quais produtos entram na contabilidade, ao mesmo tempo em que enriquece o relatório de "Top 10 Códigos Descartados" com o nome dos produtos barrados.
- **Decisão 3 — Leitura Posicional Tolerante a Colunas Duplicadas e Zeros à Esquerda**:
  - *Abordagem Escolhida*: Leitura da primeira ocorrência de cada coluna após `trim()` do cabeçalho e preservação estrita de texto/zeros à esquerda para `Produto`, `Centro Custo` (9 dígitos) e `Documento`.

---

## 4. Arquitetura Técnica & Estratégia de Dados

### Diagrama de Arquitetura e Fluxo de Dados

```
┌────────────────────────────────────────────────────────────────────────────┐
│                   CAMADA DE ENTRADA & PARSING (100% Browser)               │
│                                                                            │
│  ┌──────────────────────┐  ┌─────────────────────┐  ┌───────────────────┐  │
│  │ Arquivo SD1          │  │ Tabela de Vales (8) │  │ Cadastro C. Custo │  │
│  │ (.xlsx/.xls/.csv/tsv)│  │ +Inclusão Manual    │  │ (Pré-carregado+Up)│  │
│  └──────────┬───────────┘  │ +Dicionário Descr.  │  └─────────┬─────────┘  │
│             │              └──────────┬──────────┘            │            │
│             ▼                         ▼                       ▼            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ Motor de Leitura SD1 (SheetJS / Auto-Delimiter TSV/CSV Parser)       │  │
│  │ • Trim de cabeçalhos + Mapeamento pela 1ª ocorrência de cada coluna  │  │
│  │ • Preservação de zeros à esquerda (Produto, Centro Custo, Documento) │  │
│  │ • Detecção automática do mês MM-AAAA mais frequente em DT Emissao    │  │
│  └────────────────────────────────────┬─────────────────────────────────┘  │
└───────────────────────────────────────┼────────────────────────────────────┘
                                        │
                                        ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                 MOTOR DE REGRAS CONTÁBEIS & VALIDAÇÃO                      │
│                                                                            │
│  1. Filtro de Produto por IGUALDADE EXATA (produto.trim().toUpperCase())   │
│     ├─ Fora da lista de Vales ──► [Contador + Ranking Top 10 Descartados]  │
│     ▼                                                                      │
│  2. Filtro de Data ("DT Emissao" no mês MM-AAAA, dias 01 a 19 inclusive)   │
│     ├─ Dia >= 20 ou outro mês ──► [Contador: Descartado por Data Emissão]  │
│     ▼                                                                      │
│  3. Classificação Contábil e Auditoria de Centro de Custo                  │
│     ├─ Determina Natureza (Operacional / Administrativo / A Classificar)   │
│     ├─ Valida CC (Em branco / Inexistente no Cadastro / Classe Sintético)  │
│     └─ Atribui Debito, Credito e Historico (DESPESA VALE ... REF. MM-AAAA) │
└───────────────────────────────────────┬────────────────────────────────────┘
                                        │
                                        ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                     INTERFACE DO USUÁRIO & EXPORTAÇÃO                      │
│                                                                            │
│  ┌─────────────────────────┐  ┌─────────────────────────┐                  │
│  │ Painel de Conferência   │  │ Cadastros Base & Regras │                  │
│  │ • Subtotais Vale/Natur. │  │ • 8 Produtos Fixos      │                  │
│  │ • Top 10 Cód. Descart.  │  │ • Inclusão Manual Vale  │                  │
│  │ • Alertas de Pendências │  │ • Natureza por C. Custo │                  │
│  └────────────┬────────────┘  └────────────┬────────────┘                  │
│               ▼                            ▼                               │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ Grade Editável de Lançamentos (Ordenada por Vale -> Centro de Custo) │  │
│  │ • Edição inline de CC e Conta Débito • Agrupamento opcional          │  │
│  └────────────────────────────────────┬─────────────────────────────────┘  │
│                                       ▼                                    │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ Gerador CSV (UTF-8 com BOM \uFEFF, delimitador ';', vales_MM-AAAA)   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

### Modelo de Dados & Estado Principal
- **`BenefitProductRule`**: `{ codigo: string, descricao: string, tipoVale: 'TRANSPORTE' | 'REFEICAO' | 'COMBUSTIVEL' | 'ALIMENTACAO', isDefault: boolean }` (inicia com os 8 códigos fixos; novos códigos só entram por adição manual explícita do usuário).
- **`ProductDescriptionDictionary`**: `Record<string, string>` (alimentado pelos 8 produtos fixos e por eventual planilha de produtos carregada pelo usuário, usado exclusivamente para exibir o nome do produto na tela e no Top 10 descartados).
- **`DiscardedProductStat`**: `{ codigo: string, descricao: string, count: number, totalValue: number }` (ordenado decrescentemente por `count` para exibir os Top 10 códigos descartados no Painel de Conferência).
- **`CostCenterCatalogItem`**: `{ codigo: string, classe: 'Sintetico' | 'Analitico', condicaoNormal: string, descricao: string, natureza: 'OPERACIONAL' | 'ADMINISTRATIVO' | 'A_CLASSIFICAR' }`.
