export interface PdfField {
  id: string;
  type: "text" | "signature" | "date" | "checkbox" | "select";
  name: string;
  title: string;
  submitter_uuid: string;
  required: boolean;
  default_value?: string;
  role: string;
  preferences?: Record<string, any>;
  areas: PdfFieldArea[];
  uuid: string;
}

export interface PdfFieldArea {
  x: number; // normalized coordinates (0-1)
  y: number; // normalized coordinates (0-1)
  w: number; // normalized width (0-1)
  h: number; // normalized height (0-1)
  page: number;
  attachment_uuid: string;
}

export interface PdfTemplate {
  name: string;
  schema: PdfSchema[];
  submitters: PdfSubmitter[];
  fields: PdfField[];
}

export interface PdfSchema {
  name: string;
  attachment_uuid: string;
}

export interface PdfSubmitter {
  name: string;
  uuid: string;
}

export interface FieldToolbarItem {
  id: string;
  type: PdfField["type"];
  title: string;
  icon: string;
  used: boolean;
  submitter_uuid?: string;
}

export interface ApprovalState {
  [submitter_uuid: string]: boolean;
}

export interface YjsFieldData {
  fields: Map<string, PdfField>;
  approvals: Map<string, boolean>;
  usedFields: Map<string, string>; // field type -> submitter_uuid
}
