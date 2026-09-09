import z from "zod";
import { getTokenNoLocal } from "@/lib/pda";

const PedidoSchema = z
  .object({
    codigoPedido: z.string(),
    cliente: z.string(),
    descricaoStatus: z.string(),
  })
  .transform((obj) => {
    const [codigoPedido, codigoRelativo_] = obj.codigoPedido.split("/").map((s) => s.trim());
    const codigoRelativo = codigoRelativo_ ?? codigoPedido;
    const vinculo =
      codigoRelativo_ != null && !codigoRelativo_.startsWith(codigoPedido);

    return {
      ...obj,
      codigoPedido,
      codigoRelativo,
      vinculo,
    };
  });

const RessuprimentoSchema = z.object({
  origem: z.string(),
  destino: z.string().optional(),
  status: z.string(),
  tipoEndereco: z.string().optional(),
  produto: z.string(),
  quantidade: z.number(),
  quantidadeEndereco: z.number(),
});

export async function GET() {
  const authorization = await getTokenNoLocal();
  return fetch("https://api.pdahub.com.br/api/Relatorio/Pedido", {
    headers: {
      accept: "application/json, text/plain, */*",
      "accept-language": "pt-BR,pt;q=0.9",
      authorization,
      "cache-control": "no-cache",
      "content-type": "application/json",
      pragma: "no-cache",
      priority: "u=1, i",
    },
    referrer: "https://wms.pdahub.com.br/",
    body: JSON.stringify({
      CodigoStatus: "9",
      CodigoCliente: 30,
      codigoEcCliente: null,
      CodigoPedido: null,
      codigoTransportadora: null,
      notaFiscal: null,
      tipoPedido: null,
      inicio: new Date(Date.now() - 43_200 * 60_000).toISOString().substring(0, 10),
      //                            ^        ^
      //                            |        L 60 minutos em ms
      //                            L 1 mes em minutos
      fim: new Date().toISOString().substring(0, 10),
      periodo: null,
      user: 1297,
      filial: null,
      pedidoEcom: null,
      marketplace: null,
      dataEntrega: null,
      codigoMarca: null,
      observacao: null,
    }),
    method: "PATCH",
  })
    .then((r) => r.json())
    .then(PedidoSchema.array().parseAsync)
    .then((pedidos) =>
      Promise.all(
        pedidos.map((pedido) =>
          fetch("https://api.pdahub.com.br/api/Relatorio/Ressuprimento", {
            headers: {
              accept: "application/json, text/plain, */*",
              "accept-language": "pt-BR,pt;q=0.9",
              authorization,
              "cache-control": "no-cache",
              "content-type": "application/json",
              pragma: "no-cache",
              priority: "u=1, i",
            },
            referrer: "https://wms.pdahub.com.br/",
            body: JSON.stringify({
              CodigoCliente: "30",
              user: "1297",
              origem: null,
              destino: null,
              descricaoProduto: null,
              CodigoPedido: pedido.codigoPedido,
              tipo: null,
              status: null,
              tipoEndereco: null,
              curvaABC: null,
              dataInicio: null,
              dataFim: null,
            }),
            method: "PATCH",
          })
            .then((r) => r.json())
            .then(RessuprimentoSchema.array().parseAsync)
            .then((itens) => ({ ...pedido, itens })),
        ),
      ),
    )
    .then(Response.json);
}
