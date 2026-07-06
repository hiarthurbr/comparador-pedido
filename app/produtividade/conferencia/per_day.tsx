"use client";

import { Description, Label, ProgressBar, Tabs } from "@heroui/react";
import { DateValue, fromDate, now } from "@internationalized/date";
import { useQuery } from "@tanstack/react-query";
import { Grid2x2XIcon } from "lucide-react";
import {
  createContext,
  type Dispatch,
  type SetStateAction,
  useContext,
  useEffect,
  useMemo,
} from "react";
import { z } from "zod";
import { produtividade_conferencia_schema } from "@/lib/schemas";
import { get_relatorio_conferencia } from "./get_data";
import skus_pre from "./skus.json";
import { UserComparison } from "./user-comparison";
import { UserDashboard } from "./user-dashboard";
import { UsersTable } from "./users-table";
import { QUERY_KEY, SelectedSectionContext } from "./page";

const skus = z
  .record(z.string(), z.number().positive().catch(1))
  .parse(skus_pre);

export const per_user_schema = z.record(
  z.string(),
  z.object({
    total_embalagens: z.number(),
    pedidos_conferidos: z.set(z.string()),
    caixas: z.set(z.string()),
    por_hora: z.record(
      z.string(),
      z.object({
        total_embalagens: z.number(),
        pedidos_conferidos: z.set(z.string()),
        caixas: z.set(z.string()),
      }),
    ),
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
  }),
);

export const horas_trabalhadas = [
  7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
];
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

const data_processing_schema = produtividade_conferencia_schema
  .omit({ avg: true, meta: true })
  .or(z.object({ per_user: z.null(), per_hour: z.null() }));

export const NAME_KEYS = {
  total_embalagens: "Média de embalagens por hora",
  caixas: "N° de caixas",
  pedidos_conferidos: "N° de pedidos conferidos",
} as const;

export default function PerDay({
  date,
  meta,
  timezone,
  setUpdatedAt,
  setAverage,
}: {
  date: DateValue;
  meta: number;
  timezone: string;
  setUpdatedAt: Dispatch<SetStateAction<number>>;
  setAverage: Dispatch<SetStateAction<{ mean: number; median: number }>>;
}) {
  const now_ = now(timezone);

  const hours_filter = useMemo(
    () =>
      horas_trabalhadas.map(
        (h) =>
          [
            h,
            new Date(date.toDate(timezone).getTime() + h * 1000 * 60 * 60),
            new Date(
              date.toDate(timezone).getTime() + (h + 1) * 1000 * 60 * 60,
            ),
          ] as const,
      ),
    [date, timezone],
  );
  const { data, isFetching, dataUpdatedAt, isPending } = useQuery({
    queryKey: [QUERY_KEY, date] as const,
    queryFn: () => get_relatorio_conferencia(date.toDate(timezone)),
    refetchInterval: 1000 * 60 * 60,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    staleTime: (query) =>
      now_
        .set({ hour: 0, minute: 0, second: 0, millisecond: 0 })
        .compare(query.queryKey[1]) > 0
        ? "static"
        : 1000 * 60 * 15,
    placeholderData: (previousData, _) => previousData,
    throwOnError(error, query) {
      console.log({ error, query });
      return false;
    },
    networkMode: "offlineFirst",
    // enabled: false,
  });

  useEffect(() => {
    setUpdatedAt(dataUpdatedAt);
  }, [setUpdatedAt, dataUpdatedAt]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: usar o dataUpdatedAt é necessario, porque o data pode não atualizar no momento do refetch, se o resultado anterior for o mesmo
  const { per_user, per_hour }: z.infer<typeof data_processing_schema> =
    useMemo(() => {
      if (data == null) return { per_hour: null, per_user: null };

      return {
        per_user: Object.fromEntries(
          Array.from(new Set(data.map((e) => e.usuario)))
            .map((user) => data.filter((cx) => cx.usuario === user))
            .map((data) => {
              const produtos = Object.entries(
                data.reduce(
                  (obj, prod) => {
                    if (prod.produto in obj)
                      obj[prod.produto] += prod.quantidade;
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
                .map(
                  ({ quantidade_pre, multiplo }) =>
                    quantidade_pre / (multiplo ?? 1),
                )
                .reduce((a, b) => a + b, 0);

              const pedidos_conferidos = new Set(
                data.map((cx) => cx.codigoPedido),
              );

              const hora_inicio = Math.min(
                ...data.map((cx) => cx.montagem.getTime()),
              );
              const hora_fim = Math.max(
                ...data.map((cx) => cx.montagem.getTime()),
              );

              const horas_conferidas =
                Math.abs(hora_fim - hora_inicio) / 3_600_000;

              const por_hora = hours_filter
                .filter(([, start]) => start <= now_.toDate())
                .map(
                  ([hour, start, end]) =>
                    [
                      hour,
                      data.filter(
                        (cx) =>
                          fromDate(cx.montagem, timezone).compare(
                            fromDate(start, timezone),
                          ) > 0 &&
                          fromDate(cx.montagem, timezone).compare(
                            fromDate(end, timezone),
                          ) < 0,
                      ),
                    ] as const,
                )
                .map(
                  ([hour, data]) =>
                    [
                      hour,
                      {
                        total_embalagens: Object.entries(
                          data.reduce(
                            (obj, prod) => {
                              if (prod.produto in obj)
                                obj[prod.produto] += prod.quantidade;
                              else obj[prod.produto] = prod.quantidade;
                              return obj;
                            },
                            {} as Record<string, number>,
                          ),
                        )
                          .map(
                            ([produto, quantidade]) =>
                              quantidade /
                              (skus[produto as keyof typeof skus] ?? 1),
                          )
                          .reduce((a, b) => a + b, 0),
                        pedidos_conferidos: new Set(
                          data.map((cx) => cx.codigoPedido),
                        ),
                        caixas: new Set(data.map((cx) => cx.caixa)),
                      },
                    ] as const,
                );

              const pedidos_por_hora =
                pedidos_conferidos.size / horas_conferidas;

              const caixas = new Set(data.map((cx) => cx.caixa));

              const caixas_por_hora = caixas.size / horas_conferidas;

              return [
                data[0].usuario,
                {
                  total_embalagens,
                  pedidos_conferidos,
                  caixas,
                  por_hora: Object.fromEntries(por_hora),
                  pedidos_por_hora,
                  caixas_por_hora,
                  embalagens_por_hora: total_embalagens / horas_conferidas,
                  hora_inicio: new Date(hora_inicio),
                  hora_fim: new Date(hora_fim),
                  duração: Math.floor(
                    Math.abs(hora_inicio - hora_fim) / 60_000,
                  ),
                  produtos,
                  meta,
                },
              ];
            }),
        ),
        per_hour: Object.fromEntries(
          hours_filter
            .filter(([, start]) => start <= now_.toDate())
            .map(
              ([hour, start, end]) =>
                [
                  hour,
                  data.filter(
                    (cx) => cx.montagem >= start && cx.montagem < end,
                  ),
                ] as const,
            )
            .map(
              ([hour, data]) =>
                [
                  hour,
                  {
                    total_embalagens: Math.round(
                      Object.entries(
                        data.reduce(
                          (obj, prod) => {
                            if (prod.produto in obj)
                              obj[prod.produto] += prod.quantidade;
                            else obj[prod.produto] = prod.quantidade;
                            return obj;
                          },
                          {} as Record<string, number>,
                        ),
                      )
                        .map(
                          ([produto, quantidade]) =>
                            quantidade /
                            (skus[produto as keyof typeof skus] ?? 1),
                        )
                        .reduce((a, b) => a + b, 0) /
                        Math.max(1, new Set(data.map((cx) => cx.usuario)).size),
                    ),
                    pedidos_conferidos: new Set(
                      data.map((cx) => cx.codigoPedido),
                    ),
                    caixas: new Set(data.map((cx) => cx.caixa)),
                  },
                ] as const,
            ),
        ),
      };
    }, [data, hours_filter, meta, timezone]);

  console.log({ per_user, per_hour });

  const average = useMemo(() => {
    const values = Object.values(per_user ?? {})
      .filter((v) => Number.isFinite(v.embalagens_por_hora))
      .map((x) => x.embalagens_por_hora);

    const sorted = values.sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    return {
      mean: values.reduce((a, b) => a + b, 0) / values.length,
      median:
        sorted.length % 2 !== 0
          ? sorted[mid]
          : (sorted[mid - 1] + sorted[mid]) / 2,
    };
  }, [per_user]);

  useEffect(() => {
    setAverage(average);
  }, [setAverage, average]);

  const selectedSectionState = useContext(SelectedSectionContext);

  return isPending ? (
    <div className="flex flex-col items-center pt-32">
      <ProgressBar
        size="lg"
        isIndeterminate
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
      <Description className="mb-8">
        Selecione outra data no seletor acima
      </Description>
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
        <UsersTable
          data={{ per_user, per_hour, meta, avg: average }}
          isFetching={isFetching}
        />
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
