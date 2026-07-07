import { NumberParser } from "@internationalized/number";
import { uuidv7 } from "uuidv7";
import z from "zod";

export const recebimento_schema = z.object({
  codigoRecebimento: z.number(),
  notafiscal: z.string(),
  codigoPedido: z.string(),
  lote: z.string(),
  numeroSerie: z.string(),
  produto: z.string(),
  cor: z.string(),
  tamanho: z.string(),
  grade: z.string(),
  descricao: z.string(),
  quantidadePedido: z.number(),
  quantidadeRecebido: z.number(),
  quantidadeArmazenada: z.number(),
  pendenteArmazenar: z.number(),
  usuarioRecebimento: z.string(),
  dataRecebimento: z.coerce.date().or(z.date()),
  usuarioArmazenagem: z.string().optional(),
  dataArmazenagem: z.coerce.date().or(z.date()).optional(),
  tipoPedido: z.string(),
});

export const motivo_devolução_enum = z.enum({
  F: "Falta",
  S: "Sobra",
  G: "Garantia",
  T: "Troca de mercadoria",
  C: "Comprou errado",
});

export const departamento_enum = z.enum({
  Exp: "Expedição",
  Emb: "Embalagem",
  Fat: "Faturamento",
  Vend: "Vendas",
  C: "Cliente",
  Qual: "Qualidade",
  Josi: "Josimar",
});

export const excel_cell_error_value_enum = z.enum([
  "#N/A",
  "#REF!",
  "#NAME?",
  "#DIV/0!",
  "#NULL!",
  "#VALUE!",
  "#NUM!",
]);

export const excel_cell_value_schema = z
  .string()
  .or(z.number())
  .or(z.boolean())
  .or(z.date())
  .or(z.null())
  .or(z.undefined())
  .or(
    // excel.CellErrorValue
    excel_cell_error_value_enum,
  )
  .or(
    // excel.CellRichTextValue
    z.strictObject({
      richText: z.array(
        z.strictObject({
          text: z.string(),
          font: z
            .strictObject({
              name: z.string(),
              size: z.number(),
              family: z.number(),
              scheme: z.enum(["minor", "major", "none"]),
              charset: z.number(),
              color: z.strictObject({
                argb: z.string().optional(),
                theme: z.number().optional(),
              }),
              bold: z.boolean(),
              italic: z.boolean(),
              underline: z
                .boolean()
                .or(
                  z.enum([
                    "none",
                    "single",
                    "double",
                    "singleAccounting",
                    "doubleAccounting",
                  ]),
                ),
              vertAlign: z.enum(["superscript", "subscript"]),
              strike: z.boolean(),
              outline: z.boolean(),
            })
            .optional(),
        }),
      ),
    }),
  )
  .or(
    // excel.CellHyperlinkValue
    z.strictObject({
      text: z.string(),
      hyperlink: z.string(),
      tooltip: z.string().optional(),
    }),
  )
  .or(
    //excel.CellFormulaValue
    z.strictObject({
      formula: z.string(),
      result: z
        .number()
        .or(z.string())
        .or(z.boolean())
        .or(z.date())
        .or(excel_cell_error_value_enum)
        .optional(),
      date1904: z.boolean().optional(),
    }),
  )
  .or(
    // excel.CellSharedFormulaValue
    z.strictObject({
      sharedFormula: z.string(),
      formula: z.string().readonly().optional(),
      result: z
        .number()
        .or(z.string())
        .or(z.boolean())
        .or(z.date())
        .or(excel_cell_error_value_enum)
        .optional(),
      date1904: z.boolean().optional(),
    }),
  );

export const nota_fiscal_schema = z.object({
  Transportador: z.string().default("Entregador não definido"),
  PrevisaoSaida: z.coerce.date().or(z.date()).optional(),
  NumeroNotaFiscal: z.coerce.number(),
  Origem: z.string(),
  CodigoNotaFiscal: z.int(),
  IdEntrega: z.int(),
  Destinatario: z.string(),
  EnderecoDestinatario: z.string().optional(),
  BairroDestinatario: z.string().optional(),
  ValorLiquido: z.number(),
  PesoLiquido: z.number(),
  Volumes: z.int(),
  DataAutorizacao: z.coerce.date().or(z.date()),
  Tipo: z.coerce.number(),
  Transportadora: z.string().optional(),
  EnderecoTransportadora: z.string().optional(),
  BairroTransportadora: z.string().optional(),
  Status: z.enum(["Entregue", "Pendente"]),
  DataEntrega: z.coerce.date().or(z.date()).optional(),
  DataColeta: z.coerce.date().or(z.date()).optional(),
  UsuarioColeta: z.string().optional(),
  UsuarioEntrega: z.string().optional(),
  Latitude: z.number().optional(),
  Longitude: z.number().optional(),
  NumeroColeta: z.string().optional(),
});

export const status_pedido_pda_enum = z.enum([
  "Aguardando Faturamento",
  "Aguardando Embarque",
  "Aguardando Conferência",
  "Andamento",
  "Planejado",
  "Criado",
  "Ressuprimento",
  "Estoque Insuficiente",
  "Aguardando Integração",
  "Finalizado c/divergência",
]);

export const relatorio_conferencia_schema = z.object({
  codigoPedido: z.string(),
  codigoEcCliente: z.number(),
  quantidadePedido: z.number(),
  descricaoStatus: status_pedido_pda_enum,
  tipoPedido: z.enum(["", "Vinculo"]),
  usuario: z.string(),
  caixa: z.string(),
  palete: z.string(),
  codigoTransportadora: z.string(),
  transportadora: z.string(),
  nomeCliente: z.string(),
  notaFiscal: z.string(),
  produto: z.string(),
  ean: z.string(),
  dataIntegracao: z.coerce.date().or(z.date()),
  cor: z.string(),
  tamanho: z.string(),
  grade: z.string(),
  descricaoEndereco: z.string(),
  serie: z.string(),
  quantidadeConferencia: z.number(),
  dataInicioConferencia: z.coerce.date().or(z.date()),
  dataFimConferencia: z.coerce.date().or(z.date()),
});

export const relatorio_separacao_schema = z.object({
  codigoPedido: z.string(),
  codigoTransportadora: z.string(),
  codigoEcCliente: z.number(),
  nomeCliente: z.string(),
  produto: z.string(),
  descricaoStatus: status_pedido_pda_enum,
  transportadora: z.string(),
  dataIntegracao: z.coerce.date().or(z.date()),
  cor: z.string(),
  tamanho: z.date(),
  grade: z.date(),
  descricaoEndereco: z.string(),
  quantidadePicking: z.number(),
  notaFiscal: z.date(),
  serie: z.date(),
  dataInicioSeparacao: z.coerce.date().or(z.date()),
  tipoPedido: z.enum(["Vinculo", "Pedido"]),
  quantidadePedido: z.number(),
  ean: z.date(),
  lote: z.date(),
  promocao: z.date(),
});

const num_parser = new NumberParser("pt-BR", { style: "decimal" });
const porcentagem_fmt = z
  .string()
  .transform((str) => num_parser.parse(str.replace("%", "")));

export const dado_etapa_schema = z.object({
  nome: z.string(),
  valor: z.int(),
  ordem: z.int(),
  progresso: porcentagem_fmt,
});

export const etapa_schema = z.object({
  etapa: z.enum(["Pedido", "Picking", "Conferência", "Expedição"]),
  progressoGeralEtapa: porcentagem_fmt,
  valorTotal: z.int(),
  ordem: z.int(),
  dados: z.array(dado_etapa_schema),
});

export const dashboard_data_schema = z.object({
  geral: z.object({
    atualizacao: z.coerce.date().or(z.date()),
    periodo: z.int(),
    progressoGeral: z.object({
      porcentagem: porcentagem_fmt,
      valor: z.int(),
      cor: z.string().startsWith("#").length(7),
    }),
    cor: z.null(),
    etapas: z.array(etapa_schema),
  }),
});

export const token_schema = z.object({
  authenticated: z.boolean(),
  created: z.coerce.date(),
  expiration: z.coerce.date(),
  accessToken: z.string(),
  refreshToken: z.uuidv4(),
});

export const status_proposta_pda_schema = z.object({
  codigoProposta: z.int(),
  numeroProposta: z.string(),
  nomeEmpresa: z.string(),
  nomeVendedor: z.string(),
  dataLiberacaoProposta: z.coerce.date().or(z.date()),
  liquidoProposta: z.number(),
  vinculos: z.int(),
  itensDiferentesTotalProposta: z.int(),
  itensDiferentesAlocadosProposta: z.int(),
  percentualItensAlocadosProposta: z.number(),
  percentualItensAlocadosPropostaNoGrupo: z.number(),
  statusProposta: z.number(),
  statusPda: z.number(),
  descricaoStatusPda: z.string(),
  ePrioridade: z.boolean(),
  critico: z.boolean(),
  programada: z.string(),
  pais: z.coerce.number(),
  estado: z.string(),
  pendenciaFinanceira: z.string(),
});

export const produto_titanium_schema = z.object({
  produto: z.string(),
  nome: z.string(),
  unidade: z.enum(["UNID"]),
  tipo: z.string(),
  nivel: z.number(),
  necessario: z.number(),
  estoque: z.number(),
  emCompra: z.number(),
  emProducao: z.number(),
  falta: z.number(),
  origem: z.string(),
  paiDireto: z.string(),
  estrutura: z.string(),
  status: z.string(),
});

export const montagem_caixa_schema = z.object({
  id: z.uuidv7().default(() => uuidv7()),
  endereco: z.string(),
  codigoCaixa: z.number(),
  caixa: z.string(),
  produto: z.string(),
  descricaoProduto: z.string(),
  quantidade: z.number().positive(),
  usuario: z.string(),
  montagem: z.coerce.date().or(z.date()),
  codigoPedido: z.string(),
  descTipoCaixa: z.string(),
});

const user_history_schema = z.record(
  z.string(),
  z.object({
    total_embalagens: z.number(),
    pedidos_conferidos: z.set(z.string()),
    caixas: z.set(z.string()),
  }),
);

export const per_user_day_schema = z.object({
  total_embalagens: z.number(),
  pedidos_conferidos: z.set(z.string()),
  caixas: z.set(z.string()),
  produtos: z.array(
    z.object({
      sku: z.string(),
      quantidade_pre: z.number(),
      multiplo: z.number().optional().nullable(),
    }),
  ),
  pedidos_por_hora: z.number(),
  caixas_por_hora: z.number(),
  embalagens_por_hora: z.number(),
  hora_inicio: z.date(),
  hora_fim: z.date(),
  duração: z.number(),
  meta: z.number(),
  por_hora: user_history_schema,
});

export const per_user_range_schema = z.object({
  total_embalagens: z.number(),
  pedidos_conferidos: z.set(z.string()),
  caixas: z.set(z.string()),
  produtos: z.array(
    z.object({
      sku: z.string(),
      quantidade_pre: z.number(),
      multiplo: z.number().optional().nullable(),
    }),
  ),
  pedidos_por_hora: z.number(),
  caixas_por_hora: z.number(),
  embalagens_por_hora: z.number(),
  hora_inicio: z.date().nullable(),
  hora_fim: z.date().nullable(),
  duração: z.number(),
  meta: z.number(),
  por_dia: user_history_schema,
});

export const produtividade_conferencia_day_schema = z.object({
  meta: z.number(),
  avg: z
    .object({
      mean: z.number(),
      median: z.number(),
    })
    .nullable(),
  per_user: z.record(z.string(), per_user_day_schema).nullable(),
  per_hour: user_history_schema.nullable(),
});

export const produtividade_conferencia_range_schema = z.object({
  meta: z.number(),
  avg: z
    .object({
      mean: z.number(),
      median: z.number(),
    })
    .nullable(),
  per_user: z.record(z.string(), per_user_range_schema).nullable(),
  per_day: user_history_schema.nullable(),
});

export const produtividade_conferencia_schema =
  produtividade_conferencia_day_schema.or(
    produtividade_conferencia_range_schema,
  );
