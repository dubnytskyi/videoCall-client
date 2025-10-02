import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as Y from 'yjs';
import { PdfField, ApprovalState } from '../types/pdfFields';

interface YjsContextType {
  doc: Y.Doc | null;
  fields: PdfField[];
  approvals: ApprovalState;
  usedFields: Map<string, string>;
  addField: (field: PdfField) => void;
  updateField: (fieldId: string, updates: Partial<PdfField>) => void;
  deleteField: (fieldId: string) => void;
  updateApproval: (submitterUuid: string, approved: boolean) => void;
  updateUsedField: (fieldType: string, submitterUuid: string) => void;
  isConnected: boolean;
}

const YjsContext = createContext<YjsContextType | null>(null);

interface YjsProviderProps {
  children: React.ReactNode;
  roomId: string;
  submitterUuid: string;
}

export function YjsProvider({ children, roomId, submitterUuid }: YjsProviderProps) {
  const [doc, setDoc] = useState<Y.Doc | null>(null);
  const [fields, setFields] = useState<PdfField[]>([]);
  const [approvals, setApprovals] = useState<ApprovalState>({});
  const [usedFields, setUsedFields] = useState<Map<string, string>>(new Map());
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Create Yjs document
    const yDoc = new Y.Doc();
    setDoc(yDoc);

    // Create WebSocket connection
    const ws = new WebSocket(`ws://localhost:1234?room=${roomId}`);
    // Ensure we receive ArrayBuffer instead of Blob on supported browsers
    try { (ws as any).binaryType = 'arraybuffer'; } catch {}
    
    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };

    ws.onmessage = (event) => {
      const apply = (buf: ArrayBuffer) => {
        try {
          const update = new Uint8Array(buf);
          Y.applyUpdate(yDoc, update);
        } catch (error) {
          console.error('Error applying Yjs update:', error);
        }
      };

      const data = event.data as unknown;
      if (data instanceof ArrayBuffer) {
        apply(data);
      } else if (data instanceof Blob) {
        (data as Blob).arrayBuffer().then(apply).catch((err) => {
          console.error('Failed to read WS Blob data:', err);
        });
      } else {
        // Some environments might send strings (shouldn't happen for Y updates)
        console.warn('Unexpected WS message type; ignoring', { type: typeof data });
      }
    };

    // Set up Yjs maps
    const fieldsMap = yDoc.getMap('fields');
    const approvalsMap = yDoc.getMap('approvals');
    const usedFieldsMap = yDoc.getMap('usedFields');

    // Listen for changes and send updates
    const sendUpdate = (update: Uint8Array) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(update);
      }
    };

    yDoc.on('update', sendUpdate);

    // Listen for changes
    const updateFields = () => {
      console.log('updateFields called - Yjs fields map changed');
      const fieldsArray: PdfField[] = [];
      fieldsMap.forEach((field: any) => {
        // Field is already a plain object, not a Yjs structure
        fieldsArray.push(field);
      });
      console.log('YjsContext: Fields updated:', {
        count: fieldsArray.length,
        fields: fieldsArray.map(f => ({ id: f.id, type: f.type, areas: f.areas }))
      });
      setFields(fieldsArray);
    };

    const updateApprovals = () => {
      const approvalsObj: ApprovalState = {};
      approvalsMap.forEach((approved: any, submitterUuid: string) => {
        approvalsObj[submitterUuid] = approved;
      });
      setApprovals(approvalsObj);
    };

    const updateUsedFields = () => {
      console.log('updateUsedFields called - Yjs used fields map changed');
      const usedFieldsObj = new Map<string, string>();
      usedFieldsMap.forEach((submitterUuid: any, fieldType: string) => {
        usedFieldsObj.set(fieldType, submitterUuid);
      });
      console.log('YjsContext: Used fields updated:', Array.from(usedFieldsObj.keys()));
      setUsedFields(usedFieldsObj);
    };

    // Initial load
    updateFields();
    updateApprovals();
    updateUsedFields();

    // Set up listeners
    fieldsMap.observe(updateFields);
    approvalsMap.observe(updateApprovals);
    usedFieldsMap.observe(updateUsedFields);

    return () => {
      ws.close();
      yDoc.destroy();
    };
  }, [roomId, submitterUuid]);

  const addField = useCallback((field: PdfField) => {
    console.log('YjsContext addField called:', { field, doc: !!doc });
    if (!doc) {
      console.log('No Yjs document available');
      return;
    }
    
    const fieldsMap = doc.getMap('fields');
    const usedFieldsMap = doc.getMap('usedFields');
    
    console.log('Adding field to Yjs maps:', { fieldId: field.id, fieldType: field.type });
    fieldsMap.set(field.id, field);
    usedFieldsMap.set(field.type, field.submitter_uuid);
    console.log('Field added successfully');
    
    // Don't update local state here - let updateFields handle it
    // This prevents duplicate fields when both addField and updateFields are called
  }, [doc]);

  const updateField = useCallback((fieldId: string, updates: Partial<PdfField>) => {
    if (!doc) return;
    
    const fieldsMap = doc.getMap('fields');
    const field = fieldsMap.get(fieldId);
    if (field) {
      // Field is already a plain object, not a Yjs structure
      const updatedField = { ...field, ...updates };
      fieldsMap.set(fieldId, updatedField);
    }
  }, [doc]);

  const deleteField = useCallback((fieldId: string) => {
    console.log('YjsContext deleteField called:', { fieldId, doc: !!doc });
    if (!doc) {
      console.log('No Yjs document available');
      return;
    }
    
    const fieldsMap = doc.getMap('fields');
    const usedFieldsMap = doc.getMap('usedFields');
    const field = fieldsMap.get(fieldId);
    
    if (field) {
      console.log('Deleting field:', { fieldId, fieldType: (field as any).type });
      fieldsMap.delete(fieldId);
      // Field is already a plain object, not a Yjs structure
      usedFieldsMap.delete((field as any).type);
      console.log('Field deleted successfully');
    } else {
      console.log('Field not found:', fieldId);
    }
  }, [doc]);

  const updateApproval = useCallback((submitterUuid: string, approved: boolean) => {
    if (!doc) return;
    
    const approvalsMap = doc.getMap('approvals');
    approvalsMap.set(submitterUuid, approved);
  }, [doc]);

  const updateUsedField = useCallback((fieldType: string, submitterUuid: string) => {
    if (!doc) return;
    
    const usedFieldsMap = doc.getMap('usedFields');
    usedFieldsMap.set(fieldType, submitterUuid);
  }, [doc]);

  const contextValue: YjsContextType = {
    doc,
    fields,
    approvals,
    usedFields,
    addField,
    updateField,
    deleteField,
    updateApproval,
    updateUsedField,
    isConnected
  };

  return (
    <YjsContext.Provider value={contextValue}>
      {children}
    </YjsContext.Provider>
  );
}

export function useYjs() {
  const context = useContext(YjsContext);
  if (!context) {
    throw new Error('useYjs must be used within a YjsProvider');
  }
  return context;
}
