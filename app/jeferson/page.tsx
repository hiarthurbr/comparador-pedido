"use client";

import {
  Button,
  Calendar,
  Card,
  Chip,
  Disclosure,
  Label,
  Link,
  Modal,
  Separator,
  Table,
  TableLayout,
  Tabs,
  TimeField,
  Virtualizer,
} from "@heroui/react";
import { parseAbsoluteToLocal } from "@internationalized/date";
import excel from "exceljs";
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRightFromSquareIcon,
  CalendarIcon,
  ClockIcon,
  Database,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { FileUploader } from "@/components/file-uploader";
import { nota_fiscal_schema } from "@/lib/schemas";

const STORAGE_KEY = "jeferson-nfs-data";

const StoredNFsData = z.object({
  nfs: z.array(nota_fiscal_schema),
  lastUpdated: z.coerce.date(),
});

const Result = z.object({
  corr: z.array(nota_fiscal_schema),
  err: z.array(z.strictObject({ id: z.number() }).or(nota_fiscal_schema)),
  ni: z.array(nota_fiscal_schema),
});

async function parseXlsx(buffer: ArrayBuffer) {
  const workbook = new excel.Workbook();
  await workbook.xlsx.load(buffer);

  console.log({
    worksheets: workbook.worksheets.filter((w) => w.state === "visible"),
  });

  const dateWorksheet = workbook.worksheets.find(
    (w) =>
      w.state === "visible" &&
      w.findCell("A1", 0)?.value?.toString().trim().toLocaleUpperCase() ===
        "Fechamento Geral".toLocaleUpperCase(),
  );

  if (dateWorksheet == null) throw new Error("Date worksheet not found");

  const dates = dateWorksheet.getColumn("A").values;

  const swap_day_month = dates
    .filter((d) => d instanceof Date)
    .every((d, _, a) => d.getDate() === a[0].getDate());

  const dates_map = dates.map((v) => {
    try {
      if (v instanceof Date) {
        console.log({ year: v.getFullYear(), month: v.getMonth(), day: v.getDate() });
        return swap_day_month
          ? new Date(
              `${v.getFullYear()}-${(v.getDate() + 1).toFixed(0).padStart(2, "0")}-${(v.getMonth() + 1).toFixed(0).padStart(2, "0")}T00:00:00.000`,
            )
          : v;
      }

      // @ts-expect-error
      return new Date(`${v.toString().split("/").reverse().join("-")}T00:00:00.000`);
    } catch (e) {
      console.log(e);
      return null;
    }
  });

  console.log({ swap_day_month, dates_map, dates_len: dates.length });

  // @ts-expect-error
  globalThis.worksheets = workbook.worksheets.filter((w) => w.state === "visible");
  // @ts-expect-error
  globalThis.dateWorksheet = dateWorksheet;

  return {
    nfs: workbook.worksheets
      .filter(
        (w) =>
          w.state === "visible" &&
          w.findCell("A1", 0)?.value?.toString().trim().toLocaleUpperCase() ===
            "FECHAMENTO JEFFTRANSPORTE",
      )
      .flatMap((w) =>
        w
          .getColumn("A")
          .values.map((v) => (typeof v === "string" ? v.trim() : v))
          .filter((v) => z.coerce.number().safeParse(v).success)
          .map((n) => z.coerce.number().parse(n)),
      ),
    startDate: new Date(
      Math.min(
        // @ts-expect-error
        ...dates_map.filter((v) => v != null && !Number.isNaN(v.getTime())),
      ),
    ),
    endDate: new Date(
      Math.max(
        // @ts-expect-error
        ...dates_map.filter((v) => v != null && !Number.isNaN(v.getTime())),
      ),
    ),
  };
}

function compareWithStoredData(
  xlsxData: Awaited<ReturnType<typeof parseXlsx>>,
  storedData: z.infer<typeof StoredNFsData>,
): z.infer<typeof Result> {
  console.log({ xlsxData, storedData });

  const NFStore = storedData.nfs.filter(
    (nfe) =>
      nfe.PrevisaoSaida &&
      nfe.PrevisaoSaida >= xlsxData.startDate &&
      nfe.PrevisaoSaida &&
      nfe.PrevisaoSaida <= xlsxData.endDate,
  );
  const NFStoreJeferson = NFStore.filter(
    (nfe) => nfe.Transportador?.trim().toLocaleLowerCase() === "jeferson",
  );
  const NFStoreJeferson_nf = NFStoreJeferson.map((nfe) => nfe.NumeroNotaFiscal);

  const NFNome = Object.fromEntries(
    NFStore.map((nfe) => [nfe.NumeroNotaFiscal, nfe.Transportador ?? "Nenhum especificado"]),
  );

  const Correct = xlsxData.nfs.filter((nf) => NFStoreJeferson_nf.includes(nf));
  const NotIncluded = xlsxData.nfs
    .filter((nf) => !Correct.includes(nf))
    .map((nf) => NFStore.find((nfe) => nfe.NumeroNotaFiscal === nf))
    .filter((nf) => nf != null)
    .filter((nf) => nf.Transportador === "Jeferson");
  const NotCorrect = xlsxData.nfs.filter((nf) => !Correct.includes(nf));

  console.log({
    NFStore,
    NFStoreJeferson,
    NFNome,
    Correct,
    NotCorrect,
    NotIncluded,
  });

  return {
    corr: Correct.map((nf) => storedData.nfs.find((nfe) => nfe.NumeroNotaFiscal === nf))
      .filter((nf) => nf != null)
      .map((nf) => ({ id: nf.NumeroNotaFiscal, ...nf })),
    err: NotCorrect.map((nf) => ({
      store: storedData.nfs.find((nfe) => nfe.NumeroNotaFiscal === nf),
      nf,
    })).map((nf) => (nf.store ? { id: nf.store.NumeroNotaFiscal, ...nf.store } : { id: nf.nf })),
    ni: NotIncluded.map((nf) => ({ id: nf.NumeroNotaFiscal, ...nf })),
  };
}

function List({ nfs }: { nfs: Array<z.infer<typeof nota_fiscal_schema> | { id: number }> }) {
  return (
    <Virtualizer
      layout={TableLayout}
      layoutOptions={{
        headingHeight: 48,
        rowHeight: 48,
      }}
    >
      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label="Example table" className="h-75 min-w-175 overflow-auto">
            <Table.Header>
              <Table.Column allowsSorting isRowHeader>
                NF
              </Table.Column>
              <Table.Column allowsSorting isRowHeader>
                Transportador
              </Table.Column>
              <Table.Column isRowHeader>Expandir</Table.Column>
            </Table.Header>
            <Table.Body items={nfs}>
              {(nf) =>
                "NumeroNotaFiscal" in nf ? (
                  <Table.Row>
                    <Table.Cell>{nf.NumeroNotaFiscal}</Table.Cell>
                    <Table.Cell>{nf.Transportador}</Table.Cell>
                    <Table.Cell>
                      <Modal
                        onOpenChange={(open) => {
                          open && console.log(nf);
                        }}
                      >
                        <Button variant="secondary" size="sm">
                          Detalhes
                        </Button>
                        <Modal.Backdrop>
                          <Modal.Container size="cover">
                            <Modal.Dialog>
                              <Modal.CloseTrigger />
                              <Modal.Header>
                                <AlertCircle className="size-5" />
                                <Modal.Heading>Detalhes da NFe</Modal.Heading>
                              </Modal.Header>
                              <Modal.Body>
                                <div className="flex flex-col space-y-2">
                                  <div className="flex flex-row space-x-2">
                                    <Chip variant="soft">{nf.NumeroNotaFiscal}</Chip>
                                    <Chip
                                      variant="primary"
                                      color={nf.Status === "Entregue" ? "success" : "warning"}
                                    >
                                      {nf.Status}
                                    </Chip>
                                    <Chip
                                      variant="primary"
                                      color={nf.Transportador === "Jeferson" ? "success" : "danger"}
                                    >
                                      {nf.Transportador}
                                    </Chip>
                                  </div>
                                  <Separator className="my-4" />
                                  <div className="space-x-2">
                                    <h3 className="text-lg font-bold">Local de entrega</h3>
                                    <span>
                                      Endereço:{" "}
                                      {nf.EnderecoTransportadora ?? "Endereço não informado"}
                                    </span>
                                    {nf.Latitude && nf.Longitude && (
                                      <Link
                                        href={`https://www.google.com/maps/search/${nf.Latitude},${nf.Longitude}`}
                                        target="_blank"
                                        referrerPolicy="no-referrer"
                                      >
                                        Abrir no Maps
                                        <Link.Icon className="ml-1.5 size-3">
                                          <ArrowUpRightFromSquareIcon />
                                        </Link.Icon>
                                      </Link>
                                    )}
                                  </div>
                                  {nf.DataEntrega && <Separator className="my-4" />}
                                  {nf.DataEntrega && (
                                    <div className="flex flex-col space-x-2">
                                      <h3 className="text-lg font-bold">Data da entrega</h3>
                                      <Label>Data</Label>
                                      <Calendar
                                        isReadOnly
                                        aria-label="Data de entrega"
                                        defaultValue={parseAbsoluteToLocal(
                                          nf.DataEntrega.toISOString(),
                                        )}
                                      >
                                        <Calendar.Header>
                                          <Calendar.Heading />
                                          <Calendar.NavButton slot="previous" />
                                          <Calendar.NavButton slot="next" />
                                        </Calendar.Header>
                                        <Calendar.Grid>
                                          <Calendar.GridHeader>
                                            {(day) => (
                                              <Calendar.HeaderCell>{day}</Calendar.HeaderCell>
                                            )}
                                          </Calendar.GridHeader>
                                          <Calendar.GridBody>
                                            {(date) => <Calendar.Cell date={date} />}
                                          </Calendar.GridBody>
                                        </Calendar.Grid>
                                      </Calendar>
                                      <TimeField
                                        className="w-[256px]"
                                        name="time"
                                        value={parseAbsoluteToLocal(nf.DataEntrega.toISOString())}
                                      >
                                        <Label>Hora</Label>
                                        <TimeField.Group>
                                          <TimeField.Prefix>
                                            <ClockIcon className="size-4 text-muted" />
                                          </TimeField.Prefix>
                                          <TimeField.Input>
                                            {(segment) => <TimeField.Segment segment={segment} />}
                                          </TimeField.Input>
                                        </TimeField.Group>
                                      </TimeField>
                                    </div>
                                  )}
                                  <Separator className="my-4" />
                                  <Disclosure>
                                    <Disclosure.Heading>
                                      <Button slot="trigger" variant="secondary">
                                        Detalhes da nota
                                        <Disclosure.Indicator />
                                      </Button>
                                    </Disclosure.Heading>
                                    <Disclosure.Content>
                                      <Disclosure.Body>
                                        <Table>
                                          <Table.ScrollContainer>
                                            <Table.Content aria-label="Detalhes da nota">
                                              <Table.Header>
                                                <Table.Column allowsSorting isRowHeader>
                                                  Chave
                                                </Table.Column>
                                                <Table.Column allowsSorting isRowHeader>
                                                  Valor
                                                </Table.Column>
                                              </Table.Header>
                                              <Table.Body>
                                                {Object.entries(nf).map(([key, value]) => (
                                                  <Table.Row key={key}>
                                                    <Table.Cell>{key}</Table.Cell>
                                                    <Table.Cell>{value?.toString()}</Table.Cell>
                                                  </Table.Row>
                                                ))}
                                              </Table.Body>
                                            </Table.Content>
                                          </Table.ScrollContainer>
                                        </Table>
                                      </Disclosure.Body>
                                    </Disclosure.Content>
                                  </Disclosure>
                                </div>
                              </Modal.Body>
                              <Modal.Footer>
                                <Button className="w-full" slot="close">
                                  Fechar
                                </Button>
                              </Modal.Footer>
                            </Modal.Dialog>
                          </Modal.Container>
                        </Modal.Backdrop>
                      </Modal>
                    </Table.Cell>
                  </Table.Row>
                ) : (
                  <Table.Row>
                    <Table.Cell>{nf.id}</Table.Cell>
                    <Table.Cell>Desconhecido</Table.Cell>
                    <Table.Cell>
                      <Button variant="secondary" size="sm" isDisabled>
                        NF não encontrada
                      </Button>
                    </Table.Cell>
                  </Table.Row>
                )
              }
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
    </Virtualizer>
  );
}

export default function JefersonPage() {
  const [xlsxFile, setXlsxFile] = useState<File | null>(null);
  const [storedData, setStoredData] = useState<z.infer<typeof StoredNFsData> | null>(null);
  const [results, setResults] = useState<z.infer<typeof Result> | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateFile, setUpdateFile] = useState<File | null>(null);

  // Carrega dados do localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setStoredData(StoredNFsData.parse(JSON.parse(saved)));
      } catch (e) {
        console.error("Erro ao carregar dados salvos", e);
      }
    }
  }, []);

  const handleCompare = useCallback(async () => {
    if (!xlsxFile || !storedData) return;

    setIsProcessing(true);
    try {
      const xlsxBuffer = await xlsxFile.arrayBuffer();
      const xlsxData = await parseXlsx(xlsxBuffer);
      const comparison = compareWithStoredData(xlsxData, storedData);
      console.log({ comparison });
      setResults(comparison);
    } catch (error) {
      console.error("Erro ao processar arquivo:", error);
    } finally {
      setIsProcessing(false);
    }
  }, [xlsxFile, storedData]);

  const handleUpdateStorage = useCallback(async () => {
    setIsUpdating(true);
    try {
      const nfs: Array<z.infer<typeof nota_fiscal_schema>> = await fetch(
        "https://api-erp.rainhadassete.com.br/api/expedicao/notas-kanban",
        {
          headers: {
            accept: "application/json, text/plain, */*",
          },
          referrer: "https://rainhaerp.rainhadassete.com.br/",
          body: null,
          method: "GET",
        },
      )
        .then((r) => r.json())
        .then((r) => r.data)
        .then(z.array(nota_fiscal_schema).parseAsync);

      const newData: z.infer<typeof StoredNFsData> = {
        lastUpdated: new Date(),
        nfs,
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
      setStoredData(newData);
      setResults(null);
    } catch (error) {
      console.error("Erro ao atualizar dados:", error);
    } finally {
      setIsUpdating(false);
    }
  }, []);

  const handleClearStorage = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setStoredData(null);
    setResults(null);
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "long",
      timeStyle: "short",
    }).format(date);
  };

  const handleReset = () => {
    setXlsxFile(null);
    setResults(null);
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 text-sm"
          >
            <ArrowLeft className="size-4" />
            Voltar ao comparador principal
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Comparador Jeferson</h1>
          <p className="text-muted-foreground mt-2">
            Compare arquivos XLSX com os dados armazenados localmente
          </p>
        </div>

        {/* Stored Data Status */}
        <Card className="mb-6">
          <Card.Header>
            <Card.Title className="flex items-center gap-2 text-lg">
              <Database className="size-5" />
              Dados Armazenados
            </Card.Title>
            <Card.Description>Base de dados local para comparação</Card.Description>
          </Card.Header>
          <Card.Content>
            {storedData ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <CalendarIcon className="size-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Ultima atualização</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(storedData.lastUpdated.toISOString())}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">{storedData.nfs.length}</p>
                    <p className="text-xs text-muted-foreground">NFs</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleUpdateStorage}>
                    {isUpdating ? (
                      <>
                        <RefreshCw className="size-4 mr-2 animate-spin" />
                        Atualizando...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="size-4 mr-2" />
                        Atualizar dados
                      </>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearStorage}
                    className="text-danger hover:text-danger hover:bg-danger/10"
                  >
                    <Trash2 className="size-4 mr-2" />
                    Limpar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-muted/30 px-4 py-6 justify-center">
                  <Database className="size-6 text-muted-foreground" />
                  <p className="text-muted-foreground">Nenhum dado armazenado.</p>
                  <Button onClick={handleUpdateStorage} isDisabled={isUpdating} className="w-1/3">
                    {isUpdating ? (
                      <>
                        <RefreshCw className="size-4 mr-2 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Download className="size-4 mr-2" />
                        Criar base de referência
                      </>
                    )}
                  </Button>
                </div>

                <FileUploader
                  label="Comparar banco de dados com planilha (.xlsx)"
                  accept=".xlsx,.xls"
                  file={updateFile}
                  onFileChange={setUpdateFile}
                  icon="xlsx"
                />
              </div>
            )}
          </Card.Content>
        </Card>

        {/* Comparison Section */}
        {storedData && !results && (
          <Card>
            <Card.Header>
              <Card.Title className="flex items-center gap-2 text-lg">
                <FileSpreadsheet className="size-5" />
                Comparar Arquivo
              </Card.Title>
              <Card.Description>
                Selecione um arquivo .xlsx para comparar com os dados armazenados
              </Card.Description>
            </Card.Header>
            <Card.Content className="space-y-4">
              <FileUploader
                label="Arquivo para comparação (.xlsx)"
                accept=".xlsx,.xls"
                file={xlsxFile}
                onFileChange={setXlsxFile}
                icon="xlsx"
              />

              {xlsxFile && (
                <Button
                  onClick={handleCompare}
                  isDisabled={isProcessing}
                  className="w-full"
                  size="lg"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="size-4 mr-2 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    "Comparar arquivos"
                  )}
                </Button>
              )}
            </Card.Content>
          </Card>
        )}

        {/* Results */}
        {results && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Resultados da Comparação</h2>
              <Button variant="outline" onClick={handleReset}>
                Nova comparação
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <Card>
                <Card.Content className="pt-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-green-600">{results.corr.length}</p>
                    <p className="text-sm text-muted-foreground">Notas corretas</p>
                  </div>
                </Card.Content>
              </Card>
              <Card>
                <Card.Content className="pt-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-danger">{results.err.length}</p>
                    <p className="text-sm text-muted-foreground">Notas divergentes</p>
                  </div>
                </Card.Content>
              </Card>
              <Card>
                <Card.Content className="pt-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold">{results.ni.length}</p>
                    <p className="text-sm text-muted-foreground">Notas não incluidas</p>
                  </div>
                </Card.Content>
              </Card>
            </div>
            <Tabs className="w-full">
              <Tabs.ListContainer>
                <Tabs.List aria-label="Notas">
                  <Tabs.Tab id="err">
                    Notas divergentes
                    <Tabs.Indicator />
                  </Tabs.Tab>
                  <Tabs.Tab id="ni">
                    Notas não incluidas
                    <Tabs.Indicator />
                  </Tabs.Tab>
                  <Tabs.Tab id="corr">
                    Notas corretas
                    <Tabs.Indicator />
                  </Tabs.Tab>
                </Tabs.List>
              </Tabs.ListContainer>
              <Tabs.Panel className="pt-4" id="err">
                <List nfs={results.err} />
              </Tabs.Panel>
              <Tabs.Panel className="pt-4" id="ni">
                <List nfs={results.ni} />
              </Tabs.Panel>
              <Tabs.Panel className="pt-4" id="corr">
                <List nfs={results.corr} />
              </Tabs.Panel>
            </Tabs>
          </div>
        )}
      </div>
    </main>
  );
}
