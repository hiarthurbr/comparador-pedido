import z from "zod";
import { token_schema } from "@/lib/schemas";

const kardex_n_itens = z
  .object({
    total: z.int(),
  })
  .transform(({ total }) => total);

const kardex_itens = z
  .object({
    itens: z
      .object({
        tipo: z.literal("Movimentação"),
        endereco: z.string(),
        produto: z.string().optional(),
        descricaoProduto: z.string().optional(),
        quantidade: z.number(),
        usuario: z.string(),
        deposito: z.string(),
        data: z.coerce.date(),
      })
      .array(),
  })
  .transform(({ itens }) => itens);

export async function GET() {
  const authorization = await fetch("https://api.pdahub.com.br/api/Autenticacao", {
    headers: {
      accept: "application/json, text/plain, */*",
      "content-type": "application/json",
    },
    body: JSON.stringify({ Login: "arthur.bufalo" }),
    method: "POST",
  })
    .then((r) => r.json())
    .then(token_schema.parseAsync)
    .then((token) => `Bearer ${token.accessToken}`);

  const n_itens = await fetch(
    "https://api.pdahub.com.br/api/Relatorio/KardexV2?CodigoCliente=30&pagina=1&quantidadePorPagina=1&produto=&tipo=Movimenta%C3%A7%C3%A3o",
    {
      headers: {
        accept: "application/json, text/plain, */*",
        "accept-language": "pt-BR,pt;q=0.9",
        authorization,
        "cache-control": "no-cache",
        pragma: "no-cache",
        priority: "u=1, i",
      },
      referrer: "https://wms.pdahub.com.br/",
      body: null,
      method: "GET",
    },
  )
    .then((r) => r.json())
    .then(kardex_n_itens.parseAsync);

  const this_year = new Date().getFullYear();

  return fetch(
    `https://api.pdahub.com.br/api/Relatorio/KardexV2?CodigoCliente=30&pagina=1&quantidadePorPagina=${n_itens}&produto=&tipo=Movimenta%C3%A7%C3%A3o`,
    {
      headers: {
        accept: "application/json, text/plain, */*",
        "accept-language": "pt-BR,pt;q=0.9",
        authorization,
        "cache-control": "no-cache",
        pragma: "no-cache",
        priority: "u=1, i",
      },
      referrer: "https://wms.pdahub.com.br/",
      body: null,
      method: "GET",
    },
  )
    .then((r) => r.json())
    .then(kardex_itens.parseAsync)
    .then((itens) =>
      itens.filter(
        (i) =>
          (i.deposito === "Picking" || i.deposito === "Buffer") &&
          i.data.getFullYear() >= this_year,
      ),
    )
    .then(Response.json);
}
