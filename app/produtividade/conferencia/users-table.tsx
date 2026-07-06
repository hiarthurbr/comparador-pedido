"use client";

import {
  Button,
  Chip,
  Description,
  Modal,
  Pagination,
  Separator,
  Skeleton,
  Spinner,
  Table,
  Tooltip,
} from "@heroui/react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { DiffIcon, LogsIcon, SearchIcon, TriangleAlertIcon } from "lucide-react";
import type React from "react";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, Tooltip as ChartTooltip, XAxis, YAxis } from "recharts";
import type z from "zod";
import type { produtividade_conferencia_schema } from "@/lib/schemas";
import { duration, SortableColumnHeader, toSortDescriptor, toSortingState } from "@/lib/utils";
import { NAME_KEYS, SelectedSectionContext, SelectedUserContext } from "./page";

type ProductsTableData = NonNullable<
  z.infer<typeof produtividade_conferencia_schema>["per_user"]
>[string]["produtos"];
const columnHelperProducts = createColumnHelper<ProductsTableData[number]>();

const columnsProducts = [
  columnHelperProducts.accessor("sku", { header: "SKU" }),
  columnHelperProducts.accessor("quantidade_pre", {
    header: "Qntd",
    sortDescFirst: true,
    sortingFn: "basic",
    cell: (info) => info.getValue().toLocaleString("pt-BR"),
  }),
  columnHelperProducts.accessor("multiplo", {
    cell: (info) => info.getValue()?.toLocaleString("pt-BR") ?? "N/D",
    header: "Multiplo",
    sortDescFirst: true,
    sortingFn: "alphanumeric",
  }),
  columnHelperProducts.accessor(
    (row) => (row.quantidade_pre / (row.multiplo ?? 1)).toLocaleString("pt-BR"),
    { header: "Valor final", sortDescFirst: true, sortingFn: "basic" },
  ),
];

function ProdutsTable({ data }: { data: ProductsTableData }) {
  const PAGE_SIZE = useMemo(() => 15, []);
  const [sorting, setSorting] = useState<SortingState>([]);
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    columns: columnsProducts,
    data,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: { pagination: { pageSize: PAGE_SIZE } },
    onSortingChange: setSorting,
    state: { sorting },
  });

  const sortDescriptor = useMemo(() => toSortDescriptor(sorting), [sorting]);
  const { pageIndex } = table.getState().pagination;
  const pageCount = table.getPageCount();
  const start = pageIndex * PAGE_SIZE + 1;
  const end = useMemo(
    () => Math.min((pageIndex + 1) * PAGE_SIZE, data.length),
    [pageIndex, data.length, PAGE_SIZE],
  );
  const pageNumbers = useMemo(() => {
    const neighbors = 1; // Number of pages to show on each side of current page
    const items: (number | "ellipsis")[] = [];

    for (let i = 1; i <= pageCount; i++) {
      const isFirstPage = i === 1;
      const isLastPage = i === pageCount;
      const isWithinRange = i >= pageIndex - neighbors && i <= pageIndex + neighbors;

      if (isFirstPage || isLastPage || isWithinRange) {
        items.push(i);
      } else if (
        (i === pageIndex - neighbors - 1 || i === pageIndex + neighbors + 1) &&
        items[items.length - 1] !== "ellipsis"
      ) {
        items.push("ellipsis");
      }
    }

    return items;
  }, [pageCount, pageIndex]);
  const pages = useMemo(
    () =>
      pageNumbers.map((p, i) =>
        p === "ellipsis" ? (
          <Pagination.Item
            key={`ellipsis-${
              // biome-ignore lint/suspicious/noArrayIndexKey: usar o index aqui não é um problema, já que a unica informação aparente é justamente o index
              i
            }`}
          >
            <Pagination.Ellipsis />
          </Pagination.Item>
        ) : (
          <Pagination.Item key={p}>
            <Pagination.Link
              isActive={p === pageIndex + 1}
              onPress={() => table.setPageIndex(p - 1)}
              className="data-[active=true]:bg-accent data-[active=true]:text-accent-foreground"
            >
              {p}
            </Pagination.Link>
          </Pagination.Item>
        ),
      ),
    [pageIndex, table, pageNumbers],
  );

  return (
    <Table>
      <Table.ScrollContainer>
        <Table.Content
          aria-label="Team members"
          className="min-w-fit"
          sortDescriptor={sortDescriptor}
          onSortChange={(d) => setSorting(toSortingState(d))}
        >
          <Table.Header>
            {table.getHeaderGroups()[0]?.headers.map((header) => (
              <Table.Column
                key={header.id}
                allowsSorting={header.column.getCanSort()}
                id={header.id}
                isRowHeader
              >
                {({ sortDirection }) => (
                  <SortableColumnHeader sortDirection={sortDirection}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </SortableColumnHeader>
                )}
              </Table.Column>
            ))}
          </Table.Header>
          <Table.Body items={table.getRowModel().rows}>
            {(row) => (
              <Table.Row key={row.id} id={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <Table.Cell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </Table.Cell>
                ))}
              </Table.Row>
            )}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
      <Table.Footer className="flex items-center justify-between px-4 space-x-8">
        <Pagination size="sm">
          <Pagination.Summary>
            {start} to {end} of {data.length} results
          </Pagination.Summary>
          <Pagination.Content>
            <Pagination.Item>
              <Pagination.Previous
                isDisabled={!table.getCanPreviousPage()}
                onPress={() => table.previousPage()}
              >
                <Pagination.PreviousIcon />
                Prev
              </Pagination.Previous>
            </Pagination.Item>
            {pages}
            <Pagination.Item>
              <Pagination.Next
                isDisabled={!table.getCanNextPage()}
                onPress={() => table.nextPage()}
              >
                Next
                <Pagination.NextIcon />
              </Pagination.Next>
            </Pagination.Item>
          </Pagination.Content>
        </Pagination>
      </Table.Footer>
    </Table>
  );
}

const columnHelper = createColumnHelper<
  NonNullable<z.infer<typeof produtividade_conferencia_schema>["per_user"]>[string] & {
    name: string;
  }
>();
const columns = [
  columnHelper.accessor("name", {
    header: "Nome",
    sortingFn: "text",
    cell: (info) => {
      const selectedSectionState = useContext(SelectedSectionContext);
      const selectedUserState = useContext(SelectedUserContext);

      return (
        <div className="flex flex-row items-center space-x-2">
          {selectedUserState?.[1] != null && selectedSectionState != null && (
            <Tooltip delay={0}>
              <Button
                variant="secondary"
                size="sm"
                className="scale-80"
                isIconOnly
                onPress={() => {
                  selectedUserState[1](info.getValue());
                  selectedSectionState[1]("analytics");
                }}
              >
                <SearchIcon />
              </Button>
              <Tooltip.Content>
                <p className="break-normal">Ver métricas do usuário</p>
              </Tooltip.Content>
            </Tooltip>
          )}
          <span>{info.getValue()}</span>
        </div>
      );
    },
  }),
  columnHelper.accessor("total_embalagens", {
    header: "Total Embalagens",
    sortingFn: "basic",
    cell: (info) => {
      return Number.isFinite(info.getValue()) ? (
        <Modal>
          <div className="flex flex-row items-center space-x-2">
            {new URLSearchParams(window.location.search).get("debug") === "true" && (
              <Button variant="secondary" size="sm" className="scale-80" isIconOnly>
                <LogsIcon />
              </Button>
            )}
            <span>{info.getValue().toLocaleString("pt-BR", { maximumFractionDigits: 1 })}</span>
          </div>
          <Modal.Backdrop>
            <Modal.Container placement="center" size="lg">
              <Modal.Dialog className="max-w-2xl">
                <Modal.CloseTrigger />
                <Modal.Header>
                  <Modal.Heading>Produtos conferidos por {info.row.original.name}</Modal.Heading>
                </Modal.Header>
                <Modal.Body>
                  <ProdutsTable data={info.row.original.produtos} />
                </Modal.Body>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </Modal>
      ) : (
        <Skeleton className="h-3 w-full rounded-lg" />
      );
    },
  }),
  columnHelper.accessor("caixas_por_hora", {
    header: "Caixas/Hora",
    sortingFn: "basic",
    cell: (info) =>
      Number.isFinite(info.getValue()) ? (
        info.getValue().toLocaleString("pt-BR", { maximumFractionDigits: 1 })
      ) : (
        <Skeleton className="h-3 w-full rounded-lg" />
      ),
  }),
  columnHelper.accessor("pedidos_por_hora", {
    header: "Pedidos/Hora",
    sortingFn: "basic",

    cell: (info) =>
      Number.isFinite(info.getValue()) ? (
        info.getValue().toLocaleString("pt-BR", { maximumFractionDigits: 1 })
      ) : (
        <Skeleton className="h-3 w-full rounded-lg" />
      ),
  }),
  columnHelper.accessor(({ embalagens_por_hora, meta }) => ({ embalagens_por_hora, meta }), {
    header: "Embalagens/Hora",
    id: "emb_p_hora",
    sortDescFirst: true,
    sortingFn: (a, b) =>
      a.original.embalagens_por_hora > b.original.embalagens_por_hora &&
      Number.isFinite(a.original.embalagens_por_hora) &&
      Number.isFinite(b.original.embalagens_por_hora)
        ? 1
        : a.original.embalagens_por_hora < b.original.embalagens_por_hora ||
            !Number.isFinite(a.original.embalagens_por_hora) ||
            !Number.isFinite(b.original.embalagens_por_hora)
          ? -1
          : 0,
    cell: (info) => {
      const meta_percentage =
        ((info.getValue().embalagens_por_hora / info.getValue().meta) * 100) >> 0;
      return Number.isFinite(info.getValue().embalagens_por_hora) ? (
        <span className="w-full flex flex-row justify-between items-center">
          <span>
            {info.getValue().embalagens_por_hora.toLocaleString("pt-BR", {
              maximumFractionDigits: 1,
            })}
          </span>
          <span className="flex flex-row items-center">
            {info.row.original.duração <= 60 && (
              <Tooltip delay={0}>
                <Button isIconOnly variant="tertiary" size="sm" className="scale-80">
                  <TriangleAlertIcon />
                </Button>
                <Tooltip.Content>
                  <p className="break-normal">
                    Esse usuário conferiu por menos de 1 hora; Como resultado disso, essa média é
                    uma previsão, baseada nos dados até o momento.
                  </p>
                </Tooltip.Content>
              </Tooltip>
            )}
            <Chip
              variant="soft"
              color={
                meta_percentage >= 100 ? "success" : meta_percentage >= 80 ? "warning" : "danger"
              }
            >
              {meta_percentage.toLocaleString("pt-BR", {
                maximumFractionDigits: 0,
              })}
              %
            </Chip>
          </span>
        </span>
      ) : (
        <Skeleton className="h-3 w-full rounded-lg" />
      );
    },
  }),
  columnHelper.accessor("duração", {
    header: "Duração",
    sortingFn: "basic",
    cell: (info) => duration(info.getValue()),
  }),
  columnHelper.accessor("hora_inicio", {
    header: "Hora Inicio",
    sortingFn: "datetime",
    cell: (info) =>
      info.getValue()?.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
  }),
  columnHelper.accessor("hora_fim", {
    header: "Hora Fim",
    sortingFn: "datetime",
    cell: (info) =>
      info.getValue()?.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
  }),
];

const PAGE_SIZE = 14;
export function UsersTable({
  data: { avg, ...data },
  isFetching,
}: {
  data: z.infer<typeof produtividade_conferencia_schema>;
  isFetching: boolean;
}) {
  const [sorting, setSorting] = useState<SortingState>([
    {
      id: "emb_p_hora",
      desc: true,
    },
  ]);
  const users = useMemo(
    () =>
      Object.entries(data.per_user ?? {}).map(([name, data]) => ({
        ...data,
        name,
      })),
    [data.per_user],
  );

  const table = useReactTable({
    columns: "per_hour" in data ? columns : columns.filter((_, i) => i !== 6 && i !== 7),
    data: users,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: {
      pagination: { pageSize: PAGE_SIZE },
    },
    onSortingChange: setSorting,
    state: { sorting },
  });

  const sortDescriptor = useMemo(() => toSortDescriptor(sorting), [sorting]);
  const { pageIndex } = table.getState().pagination;
  const pageCount = table.getPageCount();
  const start = pageIndex * PAGE_SIZE + 1;
  const end = useMemo(
    () => Math.min((pageIndex + 1) * PAGE_SIZE, users.length),
    [pageIndex, users.length],
  );
  const pageNumbers = useMemo(() => {
    const neighbors = 1; // Number of pages to show on each side of current page
    const items: (number | "ellipsis")[] = [];

    for (let i = 1; i <= pageCount; i++) {
      const isFirstPage = i === 1;
      const isLastPage = i === pageCount;
      const isWithinRange = i >= pageIndex - neighbors && i <= pageIndex + neighbors;

      if (isFirstPage || isLastPage || isWithinRange) {
        items.push(i);
      } else if (
        (i === pageIndex - neighbors - 1 || i === pageIndex + neighbors + 1) &&
        items[items.length - 1] !== "ellipsis"
      ) {
        items.push("ellipsis");
      }
    }

    return items;
  }, [pageCount, pageIndex]);
  const pages = useMemo(
    () =>
      pageNumbers.map((p, i) =>
        p === "ellipsis" ? (
          <Pagination.Item
            key={`ellipsis-${
              // biome-ignore lint/suspicious/noArrayIndexKey: usar o index aqui não é um problema, já que a unica informação aparente é justamente o index
              i
            }`}
          >
            <Pagination.Ellipsis />
          </Pagination.Item>
        ) : (
          <Pagination.Item key={p}>
            <Pagination.Link
              isActive={p === pageIndex + 1}
              onPress={() => table.setPageIndex(p - 1)}
              className="data-[active=true]:bg-accent data-[active=true]:text-accent-foreground"
            >
              {p}
            </Pagination.Link>
          </Pagination.Item>
        ),
      ),
    [pageIndex, table, pageNumbers],
  );

  const get_footer_offset = useCallback((key: string) => {
    const _table = document.querySelector("table");
    const column = document.querySelector(`th[data-key=${key}]`);
    if (_table == null || column == null) return 0;

    return column.getBoundingClientRect().x - _table.getBoundingClientRect().x;
  }, []);

  const footer_values = useMemo(() => {
    const arr = Object.values(data.per_user ?? {})
      .map((x) => x.embalagens_por_hora)
      .filter((x) => Number.isFinite(x));
    const mad =
      avg == null
        ? NaN
        : arr.reduce((sum, val) => sum + Math.abs(val - avg.median), 0) / arr.length;

    type keys =
      | "name"
      | "total_embalagens"
      | "pedidos_por_hora"
      | "caixas_por_hora"
      | "emb_p_hora"
      | "hora_inicio"
      | "hora_fim"
      | "duração";

    return {
      emb_p_hora: (
        <Description className="flex flex-row space-x-1 items-center">
          <span>Media de emb/hora:</span>
          {avg != null && (
            <>
              <span>{avg.mean.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</span>
              <DiffIcon className="size-2.5" />
              <span>{mad.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</span>
            </>
          )}
        </Description>
      ),
      duração: (
        <Pagination size="sm">
          <Pagination.Summary>
            {start}-{end} de {users.length}
          </Pagination.Summary>
          <Pagination.Content>
            <Pagination.Item>
              <Pagination.Previous
                isDisabled={!table.getCanPreviousPage()}
                onPress={() => table.previousPage()}
              >
                <Pagination.PreviousIcon />
                Prev
              </Pagination.Previous>
            </Pagination.Item>
            {pages}
            <Pagination.Item>
              <Pagination.Next
                isDisabled={!table.getCanNextPage()}
                onPress={() => table.nextPage()}
              >
                Next
                <Pagination.NextIcon />
              </Pagination.Next>
            </Pagination.Item>
          </Pagination.Content>
        </Pagination>
      ),
    } satisfies { [key in keys]?: React.ReactNode };
  }, [
    data.per_user,
    avg,
    end,
    start,
    table.getCanNextPage,
    table.getCanPreviousPage,
    table.nextPage,
    table.previousPage,
    users.length,
    pages,
  ]);

  const [footer, setFooter] = useState<React.ReactNode>(
    <Skeleton className="w-full h-4 rounded-2xl" />,
  );

  useEffect(() => {
    const id = setInterval(() => {
      if (document.querySelector("th") != null) {
        setFooter(
          table.getHeaderGroups()[0]?.headers.map((header, i) => (
            <div
              key={header.id}
              className="absolute flex flex-row items-center space-x-2 pt-0.5"
              style={{ left: get_footer_offset(header.id) }}
            >
              {i > 0 && footer_values[header.id as keyof typeof footer_values] != null && (
                <Separator variant="tertiary" orientation="vertical" className="h-4.5 my-auto" />
              )}
              <span>{footer_values[header.id as keyof typeof footer_values]}</span>
            </div>
          )),
        );
        clearInterval(id);
      }
    }, 100);

    return () => clearInterval(id);
  }, [footer_values, get_footer_offset, table.getHeaderGroups]);

  const graph_data = Object.entries(("per_hour" in data ? data.per_hour : data.per_day) ?? {}).map(
    ([hora, { caixas, pedidos_conferidos, total_embalagens }]) => ({
      hora:
        "per_hour" in data
          ? `${hora}h`
          : new Date(hora).toLocaleString("pt-BR", {
              year: "numeric",
              month: "long",
              weekday: "long",
              day: "numeric",
            }),
      [NAME_KEYS.caixas]: caixas.size,
      [NAME_KEYS.pedidos_conferidos]: pedidos_conferidos.size,
      [NAME_KEYS.total_embalagens]: total_embalagens,
    }),
  );

  return (
    <div className="flex flex-col justify-center">
      <AreaChart
        style={{
          width: "100%",
          maxWidth: "2000px",
          maxHeight: "30vh",
          aspectRatio: 2,
        }}
        responsive
        data={graph_data}
        margin={{ top: 10, right: 0, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="color06b6d4" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8} />
            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colord946ef" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#d946ef" stopOpacity={0.8} />
            <stop offset="95%" stopColor="#d946ef" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorfacc15" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#facc15" stopOpacity={0.8} />
            <stop offset="95%" stopColor="#facc15" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="hora" />
        <YAxis width="auto" yAxisId="left" />
        <YAxis width="auto" yAxisId="right" orientation="right" />
        <ChartTooltip />
        <Area
          type="monotone"
          yAxisId="left"
          dataKey={NAME_KEYS.total_embalagens}
          stroke="#06b6d4"
          fillOpacity={1}
          fill="url(#color06b6d4)"
          isAnimationActive
        />
        <Area
          type="monotone"
          yAxisId="right"
          dataKey={NAME_KEYS.caixas}
          stroke="#d946ef"
          fillOpacity={1}
          fill="url(#colord946ef)"
          isAnimationActive
        />
        <Area
          type="monotone"
          yAxisId="right"
          dataKey={NAME_KEYS.pedidos_conferidos}
          stroke="#facc15"
          fillOpacity={1}
          fill="url(#colorfacc15)"
          isAnimationActive
        />
      </AreaChart>
      <Table>
        <Table.ScrollContainer>
          <Table.Content
            aria-label="Team members"
            className="min-w-150"
            sortDescriptor={sortDescriptor}
            onSortChange={(d) => setSorting(toSortingState(d))}
          >
            <Table.Header>
              {table.getHeaderGroups()[0]?.headers.map((header) => (
                <Table.Column
                  key={header.id}
                  allowsSorting={header.column.getCanSort()}
                  id={header.id}
                  isRowHeader
                >
                  {({ sortDirection }) => (
                    <SortableColumnHeader sortDirection={sortDirection}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </SortableColumnHeader>
                  )}
                </Table.Column>
              ))}
            </Table.Header>
            <Table.Body>
              {isFetching && (
                <Table.LoadMore isLoading={isFetching} scrollOffset={0}>
                  <Table.LoadMoreContent>
                    <Spinner size="md" />
                  </Table.LoadMoreContent>
                </Table.LoadMore>
              )}
              <Table.Collection items={table.getRowModel().rows}>
                {(row) => (
                  <Table.Row key={row.id} id={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <Table.Cell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </Table.Cell>
                    ))}
                  </Table.Row>
                )}
              </Table.Collection>
            </Table.Body>
          </Table.Content>
          <Table.Footer className="relative h-10">{footer}</Table.Footer>
        </Table.ScrollContainer>
      </Table>
    </div>
  );
}
