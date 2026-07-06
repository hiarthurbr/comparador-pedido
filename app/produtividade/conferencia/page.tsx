"use client";

import {
  Button,
  ButtonGroup,
  Calendar,
  DateField,
  DatePicker,
  DateRange,
  DateRangePicker,
  Description,
  Label,
  NumberField,
  RangeCalendar,
  Spinner,
  Tabs,
  Tooltip,
} from "@heroui/react";
import {
  type DateValue,
  fromAbsolute,
  getLocalTimeZone,
  now,
  today,
} from "@internationalized/date";
import { useNow } from "@shined/react-use";
import { useQueryClient } from "@tanstack/react-query";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  MoveRightIcon,
  RefreshCwIcon,
} from "lucide-react";
import {
  createContext,
  type Dispatch,
  type SetStateAction,
  useEffect,
  useMemo,
  useState,
} from "react";
import { z } from "zod";
import { Auth } from "@/components/auth";
import { relative_locale } from "@/lib/utils";
import PerDay from "./per_day";

export const QUERY_KEY = "relatorio_conferencia";

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

export const NAME_KEYS = {
  total_embalagens: "Média de embalagens por hora",
  caixas: "N° de caixas",
  pedidos_conferidos: "N° de pedidos conferidos",
} as const;

export const SelectedUserContext = createContext<
  [string | null, Dispatch<SetStateAction<string | null>>] | null
>(null);
export const SelectedSectionContext = createContext<
  [string, Dispatch<SetStateAction<string>>] | null
>(null);

function Page() {
  const timezone = useMemo(() => getLocalTimeZone(), []);
  const [date, setDate] = useState<
    { type: "day"; value: DateValue } | { type: "range"; value: DateRange }
  >({
    type: "day",
    value:
      process.env.NODE_ENV !== "development"
        ? today(timezone)
        : today(timezone).subtract({ days: 1 }),
  });
  const [meta, setMeta] = useState(800);

  const curr_now = useNow({ interval: 1000 });
  const now_ = now(timezone);

  const queryClient = useQueryClient();
  const [isUpdated, setIsUpdated] = useState(false);

  const [dataUpdatedAt, setUpdatedAt] = useState(0);
  const [average, setAverage] = useState({
    mean: NaN,
    median: NaN,
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: precisamos atualizar o estado do botão de refresh toda vez que atualizamos os dados, por isso usamos o dataUpdatedAt
  useEffect(() => {
    setIsUpdated(true);
    setTimeout(() => setIsUpdated(false), 5000);
  }, [dataUpdatedAt]);

  const selectedUserState = useState<string | null>(null);
  const selectedSectionState = useState<string>("overview");

  const last_updated_seconds_raw = Math.floor(
    (curr_now.getTime() - dataUpdatedAt) / 1000,
  );
  const last_updated_seconds = last_updated_seconds_raw % 60;
  const last_updated_minutes =
    (last_updated_seconds_raw - last_updated_seconds) / 60;

  const isFetching = queryClient.isFetching({ queryKey: [QUERY_KEY] }) > 0;

  return (
    <SelectedSectionContext value={selectedSectionState}>
      <SelectedUserContext value={selectedUserState}>
        <main className="min-h-screen bg-background p-6 flex flex-col items-center">
          <div className="space-y-6">
            <header className="space-x-8 container grid grid-flow-col grid-cols-6 content-start">
              <div className="flex flex-col justify-self-end place-self-start my-12 space-y-2 w-53 items-center">
                <Button
                  isPending={isFetching}
                  onPress={() =>
                    queryClient.invalidateQueries({
                      queryKey: [QUERY_KEY],
                    })
                  }
                  className={`w-48 ${isUpdated ? "bg-lime-600 text-white" : ""}`}
                  isDisabled={
                    isUpdated ||
                    now_
                      .set({ hour: 0, minute: 0, second: 0, millisecond: 0 })
                      .compare(
                        date.type === "day"
                          ? date.value
                          : fromAbsolute(dataUpdatedAt, timezone),
                      ) > 0
                  }
                >
                  {({ isPending, isDisabled }) => (
                    <>
                      {isPending ? (
                        <Spinner color="current" size="sm" />
                      ) : isDisabled ? (
                        <CheckIcon />
                      ) : (
                        <RefreshCwIcon />
                      )}
                      {isPending
                        ? "Atualizando dados..."
                        : isDisabled
                          ? "Dados atualizados!"
                          : "Atualizar dados"}
                    </>
                  )}
                </Button>
                {dataUpdatedAt !== 0 && !isFetching && (
                  <Description className="text-center">
                    {now_
                      .set({ hour: 0, minute: 0, second: 0, millisecond: 0 })
                      .compare(
                        date.type === "day"
                          ? date.value
                          : fromAbsolute(dataUpdatedAt, timezone),
                      ) > 0 ? (
                      "Essas informações são estáticas e não suportam atualizações."
                    ) : (
                      <>
                        Atualizado{" "}
                        {last_updated_minutes > 0 &&
                          relative_locale.format(
                            -last_updated_minutes,
                            "minute",
                          )}
                        {last_updated_minutes > 0 &&
                          last_updated_seconds > 0 &&
                          " e "}
                        {last_updated_seconds > 0 &&
                          relative_locale
                            .format(-last_updated_seconds, "second")
                            .replace(last_updated_minutes > 0 ? "há " : "", "")}
                      </>
                    )}
                  </Description>
                )}
              </div>
              <div className="flex flex-col items-center mx-auto col-start-2 col-span-4 space-y-4">
                <h1 className="text-3xl font-bold tracking-tight text-foreground">
                  Painel de Produtividade
                </h1>
                <Tabs
                  variant="secondary"
                  className="w-lg"
                  selectedKey={date.type}
                  onSelectionChange={(key) =>
                    setDate((curr_date) => {
                      if (key === curr_date.type) return curr_date;

                      if (key === "range" && curr_date.type === "day") {
                        const date = curr_date.value;
                        const day = date.toDate(timezone).getDay();

                        const end = date
                          .add({
                            days: 5 - day,
                          })
                          .set({
                            hour: 0,
                            minute: 0,
                            second: 0,
                            millisecond: 0,
                          });

                        const max = now_.subtract({ days: 1 });

                        return {
                          type: "range",
                          value: {
                            start: date
                              .subtract({
                                days: day - 1,
                              })
                              .set({
                                hour: 0,
                                minute: 0,
                                second: 0,
                                millisecond: 0,
                              }),
                            end: (end.compare(max) <= 0 ? end : max).set({
                              hour: 0,
                              minute: 0,
                              second: 0,
                              millisecond: 0,
                            }),
                          },
                        };
                      }

                      if (key === "day" && curr_date.type === "range")
                        return {
                          type: "day",
                          value:
                            process.env.NODE_ENV !== "development"
                              ? today(timezone)
                              : today(timezone).subtract({ days: 1 }),
                        };

                      console.error({ key, curr_date });
                      return curr_date;
                    })
                  }
                >
                  <Tabs.ListContainer>
                    <Tabs.List aria-label="Options">
                      <Tabs.Tab id="day">
                        do dia
                        <Tabs.Indicator />
                      </Tabs.Tab>
                      <Tabs.Tab id="range" isDisabled>
                        de periodo
                        <Tabs.Indicator />
                      </Tabs.Tab>
                    </Tabs.List>
                  </Tabs.ListContainer>
                  <Tabs.Panel className="pt-4" id="day">
                    {date.type === "day" && (
                      <div className="flex flex-row space-x-4 justify-center">
                        <Tooltip delay={0}>
                          <Button
                            isIconOnly
                            className="place-self-start"
                            variant="secondary"
                            onPress={() =>
                              setDate((curr_date) =>
                                curr_date.type === "day"
                                  ? {
                                      type: "day",
                                      value: curr_date.value.subtract({
                                        weeks: 1,
                                      }),
                                    }
                                  : curr_date,
                              )
                            }
                          >
                            <ChevronsLeftIcon />
                          </Button>
                          <Tooltip.Content>
                            <p className="break-normal">Voltar 1 semana</p>
                          </Tooltip.Content>
                        </Tooltip>
                        <Tooltip delay={0}>
                          <Button
                            isIconOnly
                            className="place-self-start"
                            variant="secondary"
                            onPress={() =>
                              setDate((curr_date) =>
                                curr_date.type === "day"
                                  ? {
                                      type: "day",
                                      value: curr_date.value.subtract({
                                        days: 1,
                                      }),
                                    }
                                  : curr_date,
                              )
                            }
                          >
                            <ChevronLeftIcon />
                          </Button>
                          <Tooltip.Content>
                            <p className="break-normal">Voltar 1 dia</p>
                          </Tooltip.Content>
                        </Tooltip>
                        <div className="flex flex-col">
                          <DatePicker
                            name="date"
                            aria-label="produtividade do dia"
                            value={date.value}
                            granularity="day"
                            onChange={(date) =>
                              date != null &&
                              setDate({ type: "day", value: date })
                            }
                            className="w-72"
                          >
                            <DateField.Group fullWidth>
                              <DateField.Input>
                                {(segment) => (
                                  <DateField.Segment segment={segment} />
                                )}
                              </DateField.Input>
                              <DateField.Suffix>
                                <DatePicker.Trigger>
                                  <DatePicker.TriggerIndicator />
                                </DatePicker.Trigger>
                              </DateField.Suffix>
                            </DateField.Group>
                            <DatePicker.Popover>
                              <Calendar
                                aria-label="Event date"
                                maxValue={today(timezone)}
                              >
                                <Calendar.Header>
                                  <Calendar.YearPickerTrigger>
                                    <Calendar.YearPickerTriggerHeading />
                                    <Calendar.YearPickerTriggerIndicator />
                                  </Calendar.YearPickerTrigger>
                                  <Calendar.NavButton slot="previous" />
                                  <Calendar.NavButton slot="next" />
                                </Calendar.Header>
                                <Calendar.Grid>
                                  <Calendar.GridHeader>
                                    {(day) => (
                                      <Calendar.HeaderCell>
                                        {day}
                                      </Calendar.HeaderCell>
                                    )}
                                  </Calendar.GridHeader>
                                  <Calendar.GridBody>
                                    {(date) => <Calendar.Cell date={date} />}
                                  </Calendar.GridBody>
                                </Calendar.Grid>
                                <Calendar.YearPickerGrid>
                                  <Calendar.YearPickerGridBody>
                                    {({ year }) => (
                                      <Calendar.YearPickerCell year={year} />
                                    )}
                                  </Calendar.YearPickerGridBody>
                                </Calendar.YearPickerGrid>
                              </Calendar>
                            </DatePicker.Popover>
                            <Description className="text-center">
                              {date.value
                                .toDate(timezone)
                                .toLocaleString("pt-BR", {
                                  year: "numeric",
                                  month: "long",
                                  weekday: "long",
                                  day: "numeric",
                                })
                                .split(" ")
                                .map((text, i) => (
                                  <span
                                    className={
                                      [0, 3].includes(i) ? "capitalize" : ""
                                    }
                                    key={`${text}-${date.toString()}-${
                                      // biome-ignore lint/suspicious/noArrayIndexKey: o index é a unica informação adicional que temos para impedir duas keys iguais
                                      i
                                    }`}
                                  >
                                    {" "}
                                    {text}
                                  </span>
                                ))}{" "}
                              (
                              <span className="capitalize">
                                {relative_locale.format(
                                  -Math.floor(
                                    (curr_now.getTime() -
                                      date.value.toDate(timezone).getTime()) /
                                      86_400_000,
                                  ),
                                  "day",
                                )}
                              </span>
                              )
                            </Description>
                          </DatePicker>
                        </div>

                        <Tooltip delay={0}>
                          <Button
                            isIconOnly
                            className="place-self-start"
                            variant="secondary"
                            isDisabled={
                              now_.compare(date.value.add({ days: 1 })) < 0
                            }
                            onPress={() =>
                              setDate((curr_date) => {
                                if (curr_date.type !== "day") return curr_date;
                                const value = curr_date.value.add({ days: 1 });

                                if (now_.compare(value) >= 0)
                                  return { type: "day", value };
                                return curr_date;
                              })
                            }
                          >
                            <ChevronRightIcon />
                          </Button>
                          <Tooltip.Content>
                            <p className="break-normal">Avançar 1 dia</p>
                          </Tooltip.Content>
                        </Tooltip>

                        <Tooltip delay={0}>
                          <Button
                            isIconOnly
                            className="place-self-start"
                            isDisabled={
                              now_.compare(date.value.add({ weeks: 1 })) < 0
                            }
                            variant="secondary"
                            onPress={() =>
                              setDate((curr_date) => {
                                if (curr_date.type !== "day") return curr_date;
                                const value = curr_date.value.add({ weeks: 1 });

                                if (now_.compare(value) >= 0)
                                  return { type: "day", value };
                                return curr_date;
                              })
                            }
                          >
                            <ChevronsRightIcon />
                          </Button>
                          <Tooltip.Content>
                            <p className="break-normal">Avançar 1 semana</p>
                          </Tooltip.Content>
                        </Tooltip>
                      </div>
                    )}
                  </Tabs.Panel>
                  <Tabs.Panel className="pt-4" id="range">
                    {date.type === "range" && (
                      <div className="flex flex-col space-x-4 items-center gap-1">
                        <DateRangePicker
                          endName="endDate"
                          startName="startDate"
                          granularity="day"
                          value={date.value}
                          onChange={(value) =>
                            value != null && setDate({ type: "range", value })
                          }
                          className="w-full"
                          aria-label="Periodo"
                        >
                          <DateField.Group fullWidth>
                            <DateField.Input slot="start">
                              {(segment) => (
                                <DateField.Segment segment={segment} />
                              )}
                            </DateField.Input>
                            <DateRangePicker.RangeSeparator />
                            <DateField.Input slot="end">
                              {(segment) => (
                                <DateField.Segment segment={segment} />
                              )}
                            </DateField.Input>
                            <DateField.Suffix>
                              <DateRangePicker.Trigger>
                                <DateRangePicker.TriggerIndicator />
                              </DateRangePicker.Trigger>
                            </DateField.Suffix>
                          </DateField.Group>
                          <DateRangePicker.Popover>
                            <RangeCalendar
                              aria-label="Trip dates"
                              maxValue={today(timezone).subtract({ days: 1 })}
                            >
                              <RangeCalendar.Header>
                                <RangeCalendar.YearPickerTrigger>
                                  <RangeCalendar.YearPickerTriggerHeading />
                                  <RangeCalendar.YearPickerTriggerIndicator />
                                </RangeCalendar.YearPickerTrigger>
                                <RangeCalendar.NavButton slot="previous" />
                                <RangeCalendar.NavButton slot="next" />
                              </RangeCalendar.Header>
                              <RangeCalendar.Grid>
                                <RangeCalendar.GridHeader>
                                  {(day) => (
                                    <RangeCalendar.HeaderCell>
                                      {day}
                                    </RangeCalendar.HeaderCell>
                                  )}
                                </RangeCalendar.GridHeader>
                                <RangeCalendar.GridBody>
                                  {(date) => <RangeCalendar.Cell date={date} />}
                                </RangeCalendar.GridBody>
                              </RangeCalendar.Grid>
                              <RangeCalendar.YearPickerGrid>
                                <RangeCalendar.YearPickerGridBody>
                                  {({ year }) => (
                                    <RangeCalendar.YearPickerCell year={year} />
                                  )}
                                </RangeCalendar.YearPickerGridBody>
                              </RangeCalendar.YearPickerGrid>
                            </RangeCalendar>
                          </DateRangePicker.Popover>
                        </DateRangePicker>
                        <Description className="text-center inline-flex flex-row gap-1">
                          {date.value.start
                            .toDate(timezone)
                            .toLocaleString("pt-BR", {
                              year: "numeric",
                              month: "long",
                              weekday: "long",
                              day: "numeric",
                            })
                            .split(" ")
                            .map((text, i) => (
                              <span
                                className={
                                  [0, 3].includes(i) ? "capitalize" : ""
                                }
                                key={`${text}-${date.toString()}-${
                                  // biome-ignore lint/suspicious/noArrayIndexKey: o index é a unica informação adicional que temos para impedir duas keys iguais
                                  i
                                }`}
                              >
                                {" "}
                                {text}
                              </span>
                            ))}
                          <MoveRightIcon className="size-4 mx-1.5" />
                          {date.value.end
                            .toDate(timezone)
                            .toLocaleString("pt-BR", {
                              year: "numeric",
                              month: "long",
                              weekday: "long",
                              day: "numeric",
                            })
                            .split(" ")
                            .map((text, i) => (
                              <span
                                className={
                                  [0, 3].includes(i) ? "capitalize" : ""
                                }
                                key={`${text}-${date.toString()}-${
                                  // biome-ignore lint/suspicious/noArrayIndexKey: o index é a unica informação adicional que temos para impedir duas keys iguais
                                  i
                                }`}
                              >
                                {" "}
                                {text}
                              </span>
                            ))}
                        </Description>
                      </div>
                    )}
                  </Tabs.Panel>
                </Tabs>
              </div>
              <div className="col-start-6 flex items-center flex-col space-y-2">
                <NumberField
                  className="w-full max-w-64"
                  defaultValue={800}
                  minValue={0}
                  value={meta}
                  onChange={setMeta}
                  step={50}
                  name="meta"
                  isDisabled={isFetching}
                >
                  <Label>Meta por Hora</Label>
                  <NumberField.Group>
                    <NumberField.DecrementButton />
                    <NumberField.Input className="w-30" />
                    <NumberField.IncrementButton />
                  </NumberField.Group>
                </NumberField>
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-muted">Definir para:</p>
                  <ButtonGroup
                    variant="primary"
                    isDisabled={isFetching}
                    size="sm"
                  >
                    <Button onPress={() => setMeta(average.mean)}>
                      Média
                      {isFetching
                        ? ""
                        : ` (${average.mean.toLocaleString("pt-BR", { maximumFractionDigits: 0 })})`}
                    </Button>
                    <Button onPress={() => setMeta(average.median)}>
                      <ButtonGroup.Separator />
                      Mediana
                      {isFetching
                        ? ""
                        : ` (${average.median.toLocaleString("pt-BR", { maximumFractionDigits: 0 })})`}
                    </Button>
                  </ButtonGroup>
                </div>
              </div>
            </header>

            {date.type === "day" ? (
              <PerDay
                date={date.value}
                meta={meta}
                timezone={timezone}
                setUpdatedAt={setUpdatedAt}
                setAverage={setAverage}
              />
            ) : null}
          </div>
        </main>
      </SelectedUserContext>
    </SelectedSectionContext>
  );
}

const isDev = process.env.NODE_ENV === "development";
export default function Pre() {
  return isDev ? (
    <Page />
  ) : (
    // biome-ignore lint/style/noNonNullAssertion: o valor é hash é conferido no elemento Auth para verificar se é != de null
    <Auth Element={Page} hash={process.env.NEXT_PUBLIC_CONFERENCIA_HASH!} />
  );
}
