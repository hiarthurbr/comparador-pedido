"use client";

import { type DateRange, Description, Label, ProgressBar, Tabs } from "@heroui/react";
import { type DateValue, fromDate, now } from "@internationalized/date";
import { useQueries } from "@tanstack/react-query";
import { Grid2x2XIcon } from "lucide-react";
import { type Dispatch, type SetStateAction, useContext, useEffect, useState } from "react";
import { z } from "zod";
import type { produtividade_conferencia_range_schema } from "@/lib/schemas";
import { get_relatorio_conferencia } from "./get_data";
import { QUERY_KEY, SelectedSectionContext } from "./page";
import skus_pre from "./skus.json";
import { UserComparison } from "./user-comparison";
import { UserDashboard } from "./user-dashboard";
import { UsersTable } from "./users-table";

const skus = z.record(z.string(), z.number().positive().catch(1)).parse(skus_pre);

export const marcadores: Array<{
  label: string;
  momento: { hh: number; mm: number };
}> = [
  { label: "Entrada 2° turno", momento: { hh: 12, mm: 0 } },
  { label: "Saída almoço", momento: { hh: 12, mm: 15 } },
  { label: "Volta do almoço", momento: { hh: 13, mm: 15 } },
  { label: "Saída 1° turno", momento: { hh: 17, mm: 0 } },
  { label: "Saída jantar", momento: { hh: 17, mm: 30 } },
  { label: "Volta do jantar", momento: { hh: 18, mm: 30 } },
];

export const NAME_KEYS = {
  total_embalagens: "Média de embalagens por hora",
  caixas: "N° de caixas",
  pedidos_conferidos: "N° de pedidos conferidos",
} as const;

export default function PerRange({
  date_range,
  timezone,
  setUpdatedAt,
  setAverage,
}: {
  date_range: DateRange;
  timezone: string;
  setUpdatedAt: Dispatch<SetStateAction<number>>;
  setAverage: Dispatch<SetStateAction<{ mean: number; median: number }>>;
}) {
  const [dates, setDates] = useState<DateValue[]>([]);

  useEffect(() => {
    const arr: DateValue[] = [];

    let curr = date_range.start;

    while (curr.compare(date_range.end) <= 0) {
      arr.push(curr);
      curr = curr.add({ days: 1 });
    }

    setDates(arr);
  }, [date_range]);

  const { data, isPending, progress } = useQueries({
    queries: dates.map((date) => ({
      queryKey: [QUERY_KEY, date] as const,
      queryFn: () => get_relatorio_conferencia(date.toDate(timezone)),
      staleTime: "static",
      networkMode: "offlineFirst",
      // enabled: false,
    })),
    combine: (results) => ({
      data: results.flatMap((result) => result.data).filter((data) => data != null),
      isPending: results.some((result) => result.isPending),
      progress: {
        total: results.length,
        done: results.filter((r) => !r.isPending).length,
      },
    }),
  });

  useEffect(() => {
    setUpdatedAt(0);
  }, [setUpdatedAt]);

  const [{ per_user, per_day, average }, setData] = useState<
    Omit<z.infer<typeof produtividade_conferencia_range_schema>, "meta" | "avg"> & {
      average: {
        mean: number;
        median: number;
      } | null;
    }
  >({ per_day: null, per_user: null, average: null });

  useEffect(() => {
    if (isPending) return;
    const now_ = now(timezone);

    const users = Array.from(new Set(data.map((e) => e.usuario)));

    const result = {
      per_user: Object.fromEntries(
        users
          .map((user) => data.filter((cx) => cx.usuario === user))
          .map((data) => {
            const produtos = Object.entries(
              data.reduce(
                (obj, prod) => {
                  if (prod.produto in obj) obj[prod.produto] += prod.quantidade;
                  else obj[prod.produto] = prod.quantidade;
                  return obj;
                },
                {} as Record<string, number>,
              ),
            ).map(([sku, quantidade_pre]) => ({
              sku,
              quantidade_pre,
              multiplo: skus[sku as keyof typeof skus],
            }));

            const total_embalagens = produtos
              .map(({ quantidade_pre, multiplo }) => quantidade_pre / (multiplo ?? 1))
              .reduce((a, b) => a + b, 0);

            const pedidos_conferidos = new Set(data.map((cx) => cx.codigoPedido));

            const cx_p_dia = dates.map(
              (date) =>
                [
                  date,
                  data.filter((cx) => {
                    const montagem = fromDate(cx.montagem, timezone);

                    const start = now_.set({
                      year: date.year,
                      month: date.month,
                      day: date.day,
                      hour: 0,
                      minute: 0,
                      second: 0,
                      millisecond: 0,
                    });

                    const end = now_.set({
                      year: date.year,
                      month: date.month,
                      day: date.day,
                      hour: 23,
                      minute: 59,
                      second: 59,
                      millisecond: 999,
                    });

                    return montagem.compare(start) >= 0 && montagem.compare(end) <= 0;
                  }),
                ] as const,
            );

            const horas_conferidas = cx_p_dia
              .map(([, cxs]) => {
                if (cxs.length === 0) return 0

                const hora_inicio = Math.min(...cxs.map((cx) => cx.montagem.getTime()));
                const hora_fim = Math.max(...cxs.map((cx) => cx.montagem.getTime()));

                const horas_conferidas = Math.abs(hora_fim - hora_inicio) / 3_600_000;

                return horas_conferidas
              })
              .reduce((a, b) => a + b, 0);

            const por_dia = cx_p_dia.map(
              ([hour, data]) =>
                [
                  hour.toDate(timezone).toISOString(),
                  {
                    total_embalagens: Object.entries(
                      data.reduce(
                        (obj, prod) => {
                          if (prod.produto in obj) obj[prod.produto] += prod.quantidade;
                          else obj[prod.produto] = prod.quantidade;
                          return obj;
                        },
                        {} as Record<string, number>,
                      ),
                    )
                      .map(
                        ([produto, quantidade]) =>
                          quantidade / (skus[produto as keyof typeof skus] ?? 1),
                      )
                      .reduce((a, b) => a + b, 0),
                    pedidos_conferidos: new Set(data.map((cx) => cx.codigoPedido)),
                    caixas: new Set(data.map((cx) => cx.caixa)),
                  },
                ] as const,
            );

            const pedidos_por_hora = pedidos_conferidos.size / horas_conferidas;

            const caixas = new Set(data.map((cx) => cx.caixa));

            const caixas_por_hora = caixas.size / horas_conferidas;

            return [
              data[0].usuario,
              {
                total_embalagens,
                pedidos_conferidos,
                caixas,
                por_dia: Object.fromEntries(por_dia),
                pedidos_por_hora,
                caixas_por_hora,
                embalagens_por_hora: total_embalagens / horas_conferidas,
                hora_inicio: null,
                hora_fim: null,
                duração: Math.floor(horas_conferidas * 60),
                produtos,
              },
            ];
          }),
      ),
      per_day: Object.fromEntries(
        dates
          .map(
            (date) =>
              [
                date.toDate(timezone).toISOString(),
                data.filter((cx) => {
                  const montagem = fromDate(cx.montagem, timezone);

                  const start = now_.set({
                    year: date.year,
                    month: date.month,
                    day: date.day,
                    hour: 0,
                    minute: 0,
                    second: 0,
                    millisecond: 0,
                  });

                  const end = now_.set({
                    year: date.year,
                    month: date.month,
                    day: date.day,
                    hour: 23,
                    minute: 59,
                    second: 59,
                    millisecond: 999,
                  });

                  return montagem.compare(start) >= 0 && montagem.compare(end) <= 0;
                }),
              ] as const,
          )
          .map(
            ([date, data]) =>
              [
                date,
                {
                  total_embalagens: Math.round(
                    Object.entries(
                      data.reduce(
                        (obj, prod) => {
                          if (prod.produto in obj) obj[prod.produto] += prod.quantidade;
                          else obj[prod.produto] = prod.quantidade;
                          return obj;
                        },
                        {} as Record<string, number>,
                      ),
                    )
                      .map(
                        ([produto, quantidade]) =>
                          quantidade / (skus[produto as keyof typeof skus] ?? 1),
                      )
                      .reduce((a, b) => a + b, 0) /
                      Math.max(1, new Set(data.map((cx) => cx.usuario)).size),
                  ),
                  pedidos_conferidos: new Set(data.map((cx) => cx.codigoPedido)),
                  caixas: new Set(data.map((cx) => cx.caixa)),
                },
              ] as const,
          ),
      ),
    };

    const values = Object.values(result.per_user)
      .filter((v) => Number.isFinite(v.embalagens_por_hora))
      .map((x) => x.embalagens_por_hora);

    const sorted = values.sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    const average = {
      mean: values.reduce((a, b) => a + b, 0) / values.length,
      median: sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2,
    };

    console.log(result);
    setData({ ...result, average });

    setAverage(average);
  }, [data, timezone, dates.map, isPending, setAverage]);

  const selectedSectionState = useContext(SelectedSectionContext);

  return isPending ? (
    <div className="flex flex-col items-center pt-32">
      <ProgressBar
        size="lg"
        isIndeterminate={progress.total === 0}
        maxValue={progress.total}
        value={progress.done}
        aria-label="Loading"
        className="w-64"
      >
        <Label className="mb-3.5 mt-5">Carregando dados</Label>
        <ProgressBar.Track>
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>
    </div>
  ) : Object.keys(per_user ?? {}).length === 0 ? (
    <div className="flex flex-col items-center pt-32">
      <Grid2x2XIcon />
      <Label className="mb-3.5 mt-5">Nenhum dado encontrado</Label>
      <Description className="mb-8">Selecione outra data no seletor acima</Description>
    </div>
  ) : (
    <Tabs
      className="min-w-full"
      onSelectionChange={(key) => selectedSectionState?.[1](key as string)}
      selectedKey={selectedSectionState?.[0] ?? "overview"}
    >
      <Tabs.ListContainer>
        <Tabs.List aria-label="Options">
          <Tabs.Tab id="overview">
            Tabela Geral
            <Tabs.Indicator />
          </Tabs.Tab>
          <Tabs.Tab id="analytics">
            Metricas do usuário
            <Tabs.Indicator />
          </Tabs.Tab>
          <Tabs.Tab id="reports">
            Comparação
            <Tabs.Indicator />
          </Tabs.Tab>
        </Tabs.List>
      </Tabs.ListContainer>
      <Tabs.Panel className="pt-4" id="overview">
        <UsersTable data={{ per_user, per_day, average }} isFetching={isPending} />
      </Tabs.Panel>
      <Tabs.Panel className="pt-4" id="analytics">
        <UserDashboard data={per_user ?? {}} />
      </Tabs.Panel>
      <Tabs.Panel className="pt-4" id="reports">
        <UserComparison data={per_user ?? {}} />
      </Tabs.Panel>
    </Tabs>
  );
}
