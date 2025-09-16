export type DrawOp = {
  type: "draw";
  page: number;
  path: Array<[number, number]>;
  color: string;
  strokeWidth: number;
  // If true, path coordinates are normalized (0..1) relative to sender's canvas
  // and strokeWidth represents a fraction of canvas width. Receiver should denormalize.
  normalized?: boolean;
};

export type TextOp = {
  type: "text";
  page: number;
  x: number;
  y: number;
  value: string;
  fontSize: number;
  color: string;
};

export type ClearOp = {
  type: "clear";
  page: number;
};

export type CursorOp = {
  type: "cursor";
  x: number;
  y: number;
  page: number;
  isVisible: boolean;
  // If true, x/y are normalized (0..1) relative to sender's canvas
  normalized?: boolean;
};

export type CollabOp = DrawOp | TextOp | ClearOp | CursorOp;

export type Participant = {
  identity: string;
  role: "notary" | "client";
  isConnected: boolean;
  isReady: boolean;
};
