import type z from "zod";
import { dashboard_data_schema, type status_pedido_pda_enum, token_schema } from "./schemas";

const TOKEN_KEY = "PDA:TOKEN";

export async function getTokenNoLocal() {
  return fetch("https://api.pdahub.com.br/api/Autenticacao", {
    headers: {
      accept: "application/json, text/plain, */*",
      "content-type": "application/json",
    },
    body: JSON.stringify({ Login: "arthur.bufalo" }),
    method: "POST",
  })
    .then((r) => r.json())
    .then(token_schema.parseAsync)
    .then((token) => `Bearer ${token.accessToken}` as const);
}

export async function getToken() {
  const curr_token = token_schema.safeParse(JSON.parse(localStorage.getItem(TOKEN_KEY) ?? "{}"));
  if (!curr_token.success || new Date() > new Date(curr_token.data.expiration)) {
    console.log("Refreshing token...");
    return await fetch("https://api.pdahub.com.br/api/Autenticacao", {
      headers: {
        accept: "application/json, text/plain, */*",
        "content-type": "application/json",
      },
      body: JSON.stringify({ Login: "arthur.bufalo" }),
      method: "POST",
    })
      .then((r) => r.json())
      .then(token_schema.parseAsync)
      .then((token) => {
        localStorage.setItem(TOKEN_KEY, JSON.stringify(token));
        return `Bearer ${token.accessToken}` as const;
      });
  }
  console.log("Current token expires on:", curr_token.data.expiration);
  return `Bearer ${curr_token.data.accessToken}` as const;
}

export async function get_dashboard_data() {
  const token = await getToken();

  const data = await fetch("https://prd-apidash-wms.pdacloud.com.br/Dash/Progresso", {
    headers: {
      accept: "application/json, text/plain, */*",
      "accept-language": "pt-BR,pt;q=0.9",
      authorization: token,
    },
    referrer: "https://bi.pdahub.com.br/",
    body: null,
    method: "GET",
  })
    .then((res) => res.json())
    .then(dashboard_data_schema.parseAsync);

  console.log(data);

  return data;
}

export async function get_relatorio_separacao(payload: {
  produto?: string;
  pedido?: string;
  status?: z.infer<typeof status_pedido_pda_enum>;
  data?: { inicio: Date; fim: Date };
}) {}
