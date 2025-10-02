import {
  PdfTemplate,
  PdfField,
  PdfSchema,
  PdfSubmitter,
} from "../types/pdfFields";

export interface ExportData {
  template: PdfTemplate;
}

export function createPdfTemplate(
  fields: PdfField[],
  submitters: PdfSubmitter[],
  templateName: string = "Sample Local PDF"
): ExportData {
  // Create schema for the PDF attachment
  const schema: PdfSchema[] = [
    {
      name: "Sample Local PDF.pdf",
      attachment_uuid: "c78a37f8-7709-4d85-b5b8-a04545e22738", // This should be dynamic
    },
  ];

  const template: PdfTemplate = {
    name: `${templateName}_${new Date().toISOString().replace(/[:.]/g, "-")}`,
    schema,
    submitters,
    fields,
  };

  return { template };
}

export function exportToJson(data: ExportData): string {
  return JSON.stringify(data, null, 2);
}

export function downloadJson(
  data: ExportData,
  filename: string = "pdf-template.json"
): void {
  const jsonString = exportToJson(data);
  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

export function sendToBackend(
  data: ExportData,
  endpoint: string = "/api/pdf-template"
): Promise<Response> {
  return fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
}
