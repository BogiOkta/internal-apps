import writeXlsxFile, { type SheetData } from "write-excel-file/browser";

export type ExportColumn<Row> = {
  heading: string;
  value: (row: Row) => string | number;
  width?: number;
};

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function exportGridCsv<Row>(
  rows: Row[],
  columns: ExportColumn<Row>[],
  fileName: string,
) {
  const escape = (value: string | number) => {
    const text = String(value);
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const content = [
    columns.map((column) => escape(column.heading)).join(","),
    ...rows.map((row) =>
      columns.map((column) => escape(column.value(row))).join(","),
    ),
  ].join("\r\n");

  download(
    new Blob([`\uFEFF${content}`], { type: "text/csv;charset=utf-8" }),
    fileName,
  );
}

export async function exportGridXlsx<Row>(
  rows: Row[],
  columns: ExportColumn<Row>[],
  fileName: string,
  sheetName: string,
) {
  const data: SheetData = [
    columns.map((column) => ({
      value: column.heading,
      fontWeight: "bold",
      backgroundColor: "#E2E8F0",
    })),
    ...rows.map((row) =>
      columns.map((column) => ({ value: column.value(row) })),
    ),
  ];

  await writeXlsxFile(data, {
    sheet: sheetName,
    columns: columns.map((column) => ({ width: column.width ?? 20 })),
  }).toFile(fileName);
}
