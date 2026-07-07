"use client";

import { Card, Chip, ListBox, Select, Tabs } from "@heroui/react";
import { fromDate, getLocalTimeZone } from "@internationalized/date";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Tooltip as ChartTooltip,
  Label,
  XAxis,
  YAxis,
} from "recharts";
import type z from "zod";
import type {
  per_user_day_schema,
  per_user_range_schema,
  produtividade_conferencia_schema,
} from "@/lib/schemas";
import { duration } from "@/lib/utils";

const EmbalagemPorHora = ({
  user,
}: {
  user: NonNullable<z.infer<typeof produtividade_conferencia_schema>["per_user"]>[string];
}) => {
  const meta_percentage = ((user.embalagens_por_hora / user.meta) * 100) >> 0;
  return (
    <span className="w-full flex flex-row space-x-2 items-center justify-end">
      <Chip
        variant="soft"
        color={meta_percentage >= 100 ? "success" : meta_percentage >= 80 ? "warning" : "danger"}
      >
        {meta_percentage.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%
      </Chip>
      <span>
        {user.embalagens_por_hora.toLocaleString("pt-BR", {
          maximumFractionDigits: 1,
        })}
      </span>
    </span>
  );
};

const ONE_DAY_IN_MS = 86_400_000;

const NAME_KEYS = {
  total_embalagens: "N° de embalagens",
  caixas: "N° de caixas",
  pedidos_conferidos: "N° de pedidos",
} as const;

export function UserComparison({
  data,
}: {
  data: NonNullable<z.infer<typeof produtividade_conferencia_schema>["per_user"]>;
}) {
  const [graphKey, setGraphKey] = useState("total_embalagens");
  const userNames = useMemo(() => Object.keys(data), [data]);
  const [user1, setUser1] = useState(userNames[0]);
  const [user2, setUser2] = useState(userNames[1]);

  const userData1 = data[user1];
  const userData2 = data[user2];

  const date_entries = [
    ...("por_hora" in userData1
      ? Object.entries(userData1.por_hora)
          .filter(([, values]) =>
            Object.values(values).some((v) => (typeof v === "number" ? v : v.size) !== 0),
          )
          .map(([key]) => Number(key))
      : Object.entries(userData1.por_dia)
          .filter(([, values]) =>
            Object.values(values).some((v) => (typeof v === "number" ? v : v.size) !== 0),
          )
          .map(([date]) => new Date(date).getTime())),
    ...("por_hora" in userData2
      ? Object.entries(userData2.por_hora)
          .filter(([, values]) =>
            Object.values(values).some((v) => (typeof v === "number" ? v : v.size) !== 0),
          )
          .map(([key]) => Number(key))
      : Object.entries(userData2.por_dia)
          .filter(([, values]) =>
            Object.values(values).some((v) => (typeof v === "number" ? v : v.size) !== 0),
          )
          .map(([date]) => new Date(date).getTime())),
  ];
  const entry_type = "por_hora" in userData1 ? "hour" : "date";
  const startDate = Math.min(...date_entries);
  const endDate = Math.max(...date_entries);
  const timezone = getLocalTimeZone();

  const hourlyComparisonData = Array.from({
    length:
      entry_type === "date"
        ? fromDate(new Date(endDate), timezone).compare(fromDate(new Date(startDate), timezone)) /
            ONE_DAY_IN_MS +
          1
        : endDate - startDate,
  })
    .fill(null)
    .map((_, i) =>
      entry_type === "hour"
        ? i + startDate
        : fromDate(new Date(startDate), timezone).add({ days: i }),
    )
    .map((hour) => {
      if (typeof hour === "number") {
        const userData1_ = userData1 as z.infer<typeof per_user_day_schema>;
        const userData2_ = userData2 as z.infer<typeof per_user_day_schema>;

        return {
          [NAME_KEYS.caixas]: {
            hour: `${hour}h`,
            [user1]: userData1_.por_hora[hour]?.caixas.size || 0,
            [user2]: userData2_.por_hora[hour]?.caixas.size || 0,
          },
          [NAME_KEYS.pedidos_conferidos]: {
            hour: `${hour}h`,
            [user1]: userData1_.por_hora[hour]?.pedidos_conferidos.size || 0,
            [user2]: userData2_.por_hora[hour]?.pedidos_conferidos.size || 0,
          },
          [NAME_KEYS.total_embalagens]: {
            hour: `${hour}h`,
            [user1]: userData1_.por_hora[hour]?.total_embalagens || 0,
            [user2]: userData2_.por_hora[hour]?.total_embalagens || 0,
          },
        };
      } else {
        const userData1_ = userData1 as z.infer<typeof per_user_range_schema>;
        const userData2_ = userData2 as z.infer<typeof per_user_range_schema>;

        const date = hour.toDate();
        const iso_string = date.toISOString();
        const date_string = date.toLocaleDateString("pt-BR", {
          year: "numeric",
          month: "long",
          weekday: "long",
          day: "numeric",
        });

        return {
          [NAME_KEYS.caixas]: {
            hour: date_string,
            [user1]: userData1_.por_dia[iso_string]?.caixas.size || 0,
            [user2]: userData2_.por_dia[iso_string]?.caixas.size || 0,
          },
          [NAME_KEYS.pedidos_conferidos]: {
            hour: date_string,
            [user1]: userData1_.por_dia[iso_string]?.pedidos_conferidos.size || 0,
            [user2]: userData2_.por_dia[iso_string]?.pedidos_conferidos.size || 0,
          },
          [NAME_KEYS.total_embalagens]: {
            hour: date_string,
            [user1]: userData1_.por_dia[iso_string]?.total_embalagens || 0,
            [user2]: userData2_.por_dia[iso_string]?.total_embalagens || 0,
          },
        };
      }
    });

  // Normalize data for radar chart (0-100 scale)
  const maxEmbalagens = Math.max(userData1.total_embalagens, userData2.total_embalagens);
  const maxEmbalagensHora = Math.max(userData1.embalagens_por_hora, userData2.embalagens_por_hora);
  const maxCaixasHora = Math.max(userData1.caixas_por_hora, userData2.caixas_por_hora);
  const maxPedidosHora = Math.max(userData1.pedidos_por_hora, userData2.pedidos_por_hora);

  const _radarData = [
    {
      metric: "Total Embalagens",
      [user1]: (userData1.total_embalagens / maxEmbalagens) * 100,
      [user2]: (userData2.total_embalagens / maxEmbalagens) * 100,
    },
    {
      metric: "Embalagens/Hora",
      [user1]: (userData1.embalagens_por_hora / maxEmbalagensHora) * 100,
      [user2]: (userData2.embalagens_por_hora / maxEmbalagensHora) * 100,
    },
    {
      metric: "Caixas/Hora",
      [user1]: (userData1.caixas_por_hora / maxCaixasHora) * 100,
      [user2]: (userData2.caixas_por_hora / maxCaixasHora) * 100,
    },
    {
      metric: "Pedidos/Hora",
      [user1]: (userData1.pedidos_por_hora / maxPedidosHora) * 100,
      [user2]: (userData2.pedidos_por_hora / maxPedidosHora) * 100,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4 justify-center">
        <div className="flex items-center gap-2">
          <Select
            className="w-[256px]"
            aria-label="user1"
            placeholder="Select a state"
            value={user1}
            onChange={(value) => setUser1(value as string)}
          >
            <Label>Usuário 1</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {userNames.map((name) => (
                  <ListBox.Item key={name} id={name} textValue={name}>
                    {name}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Select
            aria-label="user2"
            className="w-[256px]"
            placeholder="Select a state"
            value={user2}
            onChange={(value) => setUser2(value as string)}
          >
            <Label>Usuário 2</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {userNames.map((name) => (
                  <ListBox.Item key={name} id={name} textValue={name}>
                    {name}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-l-4 border-l-[#b100e8] max-w-72 min-w-max w-full place-self-end">
          <Card.Header className="pb-2">
            <Card.Title className="text-lg">{user1}</Card.Title>
          </Card.Header>
          <Card.Content className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Embalagens:</span>
              <span className="font-medium">
                {userData1.total_embalagens.toLocaleString("pt-BR")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Embalagens/Hora:</span>
              <EmbalagemPorHora user={userData1} />
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Caixas/Hora:</span>
              <span className="font-medium">
                {userData1.caixas_por_hora.toLocaleString("pt-BR", {
                  maximumFractionDigits: 1,
                })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pedidos/Hora:</span>
              <span className="font-medium">
                {userData1.pedidos_por_hora.toLocaleString("pt-BR", {
                  maximumFractionDigits: 1,
                })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Duracao:</span>
              <span className="font-medium">{duration(userData1.duração)}</span>
            </div>
          </Card.Content>
        </Card>

        <Card className="border-l-4 border-l-[#ff7b00] max-w-72 min-w-max w-full place-self-start">
          <Card.Header className="pb-2">
            <Card.Title className="text-lg">{user2}</Card.Title>
          </Card.Header>
          <Card.Content className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Embalagens:</span>
              <span className="font-medium">
                {userData2.total_embalagens.toLocaleString("pt-BR")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Embalagens/Hora:</span>
              <EmbalagemPorHora user={userData2} />
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Caixas/Hora:</span>
              <span className="font-medium">
                {userData2.caixas_por_hora.toLocaleString("pt-BR", {
                  maximumFractionDigits: 1,
                })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pedidos/Hora:</span>
              <span className="font-medium">
                {userData2.pedidos_por_hora.toLocaleString("pt-BR", {
                  maximumFractionDigits: 1,
                })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Duracao:</span>
              <span className="font-medium">{duration(userData2.duração)}</span>
            </div>
          </Card.Content>
        </Card>
      </div>

      <div className="flex flex-row space-x-4">
        <Card className="w-full">
          <Card.Header>
            <Card.Title>{NAME_KEYS[graphKey as keyof typeof NAME_KEYS]}</Card.Title>
          </Card.Header>
          <Card.Content>
            <div className="h-80">
              <AreaChart
                style={{
                  width: "100%",
                  maxWidth: "2000px",
                  maxHeight: "30vh",
                  aspectRatio: 2,
                }}
                responsive
                data={hourlyComparisonData.map(
                  (data) => data[NAME_KEYS[graphKey as keyof typeof NAME_KEYS]],
                )}
                margin={{ top: 10, right: 0, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorb100e8" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#b100e8" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#b100e8" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorff7b00" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff7b00" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#ff7b00" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis width="auto" />
                <ChartTooltip />
                <Area
                  type="monotone"
                  dataKey={user1}
                  stroke="#b100e8"
                  fillOpacity={1}
                  fill="url(#colorb100e8)"
                  isAnimationActive
                />
                <Area
                  type="monotone"
                  dataKey={user2}
                  stroke="#ff7b00"
                  fillOpacity={1}
                  fill="url(#colorff7b00)"
                  isAnimationActive
                />
              </AreaChart>
            </div>
          </Card.Content>
        </Card>
        <Tabs
          className="w-56"
          orientation="vertical"
          variant="secondary"
          onSelectionChange={(key) => setGraphKey(key as string)}
          selectedKey={graphKey}
        >
          <Tabs.ListContainer>
            <Tabs.List aria-label="Vertical tabs" className="space-y-6">
              {Object.entries(NAME_KEYS).map(([key, value]) => (
                <Tabs.Tab key={key} id={key} className="py-4">
                  {value}
                  <Tabs.Indicator />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
      </div>
    </div>
  );
}
