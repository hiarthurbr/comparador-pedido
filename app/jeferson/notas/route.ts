export async function GET() {
  return fetch("https://api-erp.rainhadassete.com.br/api/expedicao/notas-kanban", {
    headers: {
      accept: "application/json, text/plain, */*",
      "accept-language": "pt-BR,pt;q=0.9",
      "cache-control": "no-cache",
      pragma: "no-cache",
      priority: "u=1, i",
    },
    referrer: "https://rainhaerp.rainhadassete.com.br/",
    body: null,
    method: "GET",
  })
    .then((r) => r.json())
    .then(Response.json);
}
