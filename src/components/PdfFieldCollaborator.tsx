import React, { useEffect, useRef, useState, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { Rnd } from "react-rnd";
import { v4 as uuidv4 } from "uuid";
import { PdfField, FieldToolbarItem, ApprovalState } from "../types/pdfFields";
import { useYjs } from "../contexts/YjsContext";
import { createPdfTemplate, downloadJson, sendToBackend } from "../lib/pdfExport";

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface PdfFieldCollaboratorProps {
  isNotary: boolean;
  participantInfo: {
    notary: { identity: string; isConnected: boolean; isReady: boolean };
    client: { identity: string; isConnected: boolean; isReady: boolean };
  };
  submitterUuid: string;
  submitterName: string;
  onFieldsChange?: (fields: PdfField[]) => void;
  onApprovalChange?: (approvals: ApprovalState) => void;
  submitters: Array<{ name: string; uuid: string }>;
}

export default function PdfFieldCollaborator({
  isNotary,
  participantInfo,
  submitterUuid,
  submitterName,
  onFieldsChange,
  onApprovalChange,
  submitters
}: PdfFieldCollaboratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale] = useState(1.5);
  const [draggedFieldType, setDraggedFieldType] = useState<string | null>(null);
  
  // Use Yjs context
  const { fields, approvals, usedFields, addField, updateField, deleteField, updateApproval, isConnected } = useYjs();

  // Toolbar items
  const toolbarItems: FieldToolbarItem[] = [
    { id: 'text', type: 'text', title: 'Text Field', icon: '📝', used: false },
    { id: 'signature', type: 'signature', title: 'Signature', icon: '✍️', used: false },
    { id: 'date', type: 'date', title: 'Date', icon: '📅', used: false },
    { id: 'checkbox', type: 'checkbox', title: 'Checkbox', icon: '☑️', used: false },
    { id: 'select', type: 'select', title: 'Select', icon: '📋', used: false }
  ];

  // Load PDF
  useEffect(() => {
    const loadPdf = async () => {
      try {
        console.log('Loading PDF...');
        const response = await fetch('/sample.pdf');
        console.log('PDF response:', response.status, response.ok);
        const pdfData = await response.arrayBuffer();
        console.log('PDF data size:', pdfData.byteLength);
        const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
        console.log('PDF loaded successfully:', pdf.numPages, 'pages');
        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
      } catch (error) {
        console.error('Failed to load PDF:', error);
        setTotalPages(1);
        setPdfDoc({ numPages: 1 });
      }
    };

    loadPdf();
  }, []);

  // Render PDF page
  const renderPage = useCallback(async (pageNum: number) => {
    console.log('Rendering page:', pageNum, 'canvas:', !!canvasRef.current, 'pdfDoc:', !!pdfDoc);
    if (!canvasRef.current) {
      console.log('No canvas ref');
      return;
    }

    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    if (!context) {
      console.log('No canvas context');
      return;
    }

    try {
      if (pdfDoc && pdfDoc.numPages) {
        console.log('Rendering PDF page:', pageNum);
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        
        console.log('Canvas dimensions:', { width: canvas.width, height: canvas.height });
        console.log('Viewport dimensions:', { width: viewport.width, height: viewport.height });
        
        if (canvas.width !== viewport.width || canvas.height !== viewport.height) {
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          console.log('Canvas resized to:', { width: canvas.width, height: canvas.height });
        }

        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';

        await page.render({
          canvasContext: context,
          viewport: viewport,
        }).promise;
        console.log('Page rendered successfully');
      } else {
        console.log('Using fallback document');
        // Fallback document
        const targetW = 612 * scale;
        const targetH = 792 * scale;
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }
        
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        context.fillStyle = "#000000";
        context.font = "16px Arial";
        context.fillText("DOCUMENT PREVIEW", 50, 50);
        context.font = "12px Arial";
        context.fillText("This is a sample document for field placement.", 50, 80);
      }
    } catch (error) {
      console.error("Error rendering page:", error);
    }
  }, [pdfDoc, scale]);

  useEffect(() => {
    renderPage(currentPage);
  }, [currentPage, renderPage]);

  // Handle field creation
  const createField = useCallback((type: string, x: number, y: number, w: number, h: number) => {
    console.log('Creating field:', { type, x, y, w, h, isNotary, usedFields: Array.from(usedFields.keys()) });
    if (!isNotary || usedFields.has(type)) {
      console.log('Field creation blocked:', { isNotary, typeUsed: usedFields.has(type) });
      return;
    }

    const fieldId = uuidv4();
    const fieldUuid = uuidv4();
    const attachmentUuid = uuidv4(); // This should come from the actual PDF attachment

    const canvasWidth = canvasRef.current?.width || 1;
    const canvasHeight = canvasRef.current?.height || 1;
    
    const normalizedX = x / canvasWidth;
    const normalizedY = y / canvasHeight;
    const normalizedW = w / canvasWidth;
    const normalizedH = h / canvasHeight;
    
    console.log('Normalized coordinates:', {
      original: { x, y, w, h },
      normalized: { x: normalizedX, y: normalizedY, w: normalizedW, h: normalizedH },
      canvas: { width: canvasWidth, height: canvasHeight }
    });

    const newField: PdfField = {
      id: fieldId,
      type: type as PdfField['type'],
      name: type,
      title: toolbarItems.find(item => item.id === type)?.title || type,
      submitter_uuid: submitterUuid,
      required: false,
      default_value: type === 'date' ? new Date().toISOString().split('T')[0] : '',
      role: submitterName,
      preferences: type === 'date' ? { format: 'DD/MM/YYYY' } : {},
      uuid: fieldUuid,
      areas: [{
        x: normalizedX,
        y: normalizedY,
        w: normalizedW,
        h: normalizedH,
        page: currentPage,
        attachment_uuid: attachmentUuid
      }]
    };

    console.log('New field created:', newField);
    addField(newField);
    
    if (onFieldsChange) {
      onFieldsChange([...fields, newField]);
    }
  }, [isNotary, usedFields, submitterUuid, submitterName, currentPage, fields, onFieldsChange, addField]);

  // Handle approval toggle
  const toggleApproval = useCallback(() => {
    const newApproval = !approvals[submitterUuid];
    updateApproval(submitterUuid, newApproval);
    if (onApprovalChange) {
      onApprovalChange({ ...approvals, [submitterUuid]: newApproval });
    }
  }, [approvals, submitterUuid, onApprovalChange, updateApproval]);

  // Handle drag start from toolbar
  const handleDragStart = (e: React.DragEvent, fieldType: string) => {
    console.log('Drag start:', { fieldType, isNotary, usedFields: Array.from(usedFields.keys()) });
    if (!isNotary || usedFields.has(fieldType)) {
      e.preventDefault();
      return;
    }
    setDraggedFieldType(fieldType);
  };

  // Handle drop on canvas
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    console.log('Drop event:', { 
      draggedFieldType, 
      canvasRef: !!canvasRef.current,
      isNotary,
      usedFields: Array.from(usedFields.keys())
    });
    
    if (!draggedFieldType || !canvasRef.current) {
      console.log('Drop blocked: no dragged field or canvas');
      return;
    }

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    console.log('Drop coordinates:', { 
      x, 
      y, 
      canvasSize: { width: canvas.width, height: canvas.height },
      rect: { left: rect.left, top: rect.top },
      clientX: e.clientX,
      clientY: e.clientY
    });
    
    // Check if coordinates are within canvas bounds
    if (x < 0 || y < 0 || x > canvas.width || y > canvas.height) {
      console.log('Drop coordinates outside canvas bounds');
    }
    
    // Default field size
    const w = 150;
    const h = 30;
    
    console.log('Calling createField with:', { type: draggedFieldType, x, y, w, h });
    createField(draggedFieldType, x, y, w, h);
    setDraggedFieldType(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Get fields for current page
  const currentPageFields = fields.filter(field => 
    field.areas.some(area => area.page === currentPage)
  );
  
  console.log('Current page fields:', {
    currentPage,
    totalFields: fields.length,
    currentPageFields: currentPageFields.length,
    fields: currentPageFields.map(f => ({ id: f.id, type: f.type, areas: f.areas })),
    allFields: fields.map(f => ({ id: f.id, type: f.type, areas: f.areas }))
  });

  // Check if all participants approved
  const allApproved = Object.values(approvals).every(approved => approved);

  // Handle export
  const handleExport = useCallback(async () => {
    if (!allApproved) {
      alert('All participants must approve before exporting');
      return;
    }

    try {
      const templateData = createPdfTemplate(fields, submitters);
      
      // Try to send to backend first
      try {
        const response = await sendToBackend(templateData);
        if (response.ok) {
          alert('Template successfully saved to backend!');
        } else {
          throw new Error('Backend save failed');
        }
      } catch (error) {
        console.warn('Backend save failed, downloading locally:', error);
        // Fallback: download locally
        downloadJson(templateData);
        alert('Template downloaded locally (backend unavailable)');
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    }
  }, [allApproved, fields, submitters]);

  return (
    <div className="flex h-full bg-white rounded-lg shadow-lg">
      {/* Main PDF Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-800">
            {isNotary ? 'Document Editor' : 'Document View'}
          </h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1}
                className="px-3 py-1 bg-gray-200 hover:bg-gray-300 disabled:opacity-50 rounded"
              >
                ←
              </button>
              <span className="text-sm text-gray-600">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage >= totalPages}
                className="px-3 py-1 bg-gray-200 hover:bg-gray-300 disabled:opacity-50 rounded"
              >
                →
              </button>
            </div>
            
            {/* Approval Button */}
            <button
              onClick={toggleApproval}
              disabled={!isNotary}
              className={`px-4 py-2 rounded font-medium ${
                approvals[submitterUuid] 
                  ? 'bg-green-600 hover:bg-green-700 text-white' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              } disabled:opacity-50`}
            >
              {approvals[submitterUuid] ? '✓ Approved' : 'Approve'}
            </button>
            
            {/* Export Button */}
            <button
              onClick={handleExport}
              disabled={!allApproved}
              className={`px-4 py-2 rounded font-medium ${
                allApproved
                  ? 'bg-purple-600 hover:bg-purple-700 text-white'
                  : 'bg-gray-400 text-gray-600 cursor-not-allowed'
              }`}
            >
              Export Template
            </button>
          </div>
        </div>

        {/* PDF Canvas */}
        <div className="flex-1 overflow-auto p-4">
          <div ref={containerRef} className="flex justify-center">
            <div className="relative">
              <canvas
                ref={canvasRef}
                className="border border-gray-300 shadow-lg"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              />
              
              {/* Render fields as draggable/resizable components */}
              {currentPageFields.map(field => {
                console.log('Processing field for render:', { fieldId: field.id, fieldType: field.type, areas: field.areas });
                const area = field.areas.find(a => a.page === currentPage);
                if (!area || !canvasRef.current) {
                  console.log('Field not rendered:', { fieldId: field.id, hasArea: !!area, hasCanvas: !!canvasRef.current, currentPage });
                  return null;
                }

                const canvas = canvasRef.current;
                const x = area.x * canvas.width;
                const y = area.y * canvas.height;
                const w = area.w * canvas.width;
                const h = area.h * canvas.height;
                
                console.log('Rendering field:', {
                  fieldId: field.id,
                  fieldType: field.type,
                  area: area,
                  canvas: { width: canvas.width, height: canvas.height },
                  position: { x, y, w, h }
                });

                return (
                  <Rnd
                    key={field.id}
                    position={{ x, y }}
                    size={{ width: w, height: h }}
                    bounds="parent"
                    onDragStop={(_, d) => {
                      const newX = d.x / canvas.width;
                      const newY = d.y / canvas.height;
                      updateField(field.id, {
                        areas: field.areas.map(a => 
                          a.page === currentPage 
                            ? { ...a, x: newX, y: newY }
                            : a
                        )
                      });
                    }}
                    onResizeStop={(_, __, ___, delta, position) => {
                      const newW = (w + delta.width) / canvas.width;
                      const newH = (h + delta.height) / canvas.height;
                      const newX = position.x / canvas.width;
                      const newY = position.y / canvas.height;
                      updateField(field.id, {
                        areas: field.areas.map(a => 
                          a.page === currentPage 
                            ? { ...a, x: newX, y: newY, w: newW, h: newH }
                            : a
                        )
                      });
                    }}
                    enableResizing={isNotary}
                    disableDragging={!isNotary}
                  >
                    <div className="w-full h-full border-2 border-blue-500 bg-blue-100 bg-opacity-50 flex items-center justify-center text-xs font-medium text-blue-800 cursor-move">
                      {field.title}
                      {isNotary && (
                        <button
                          onClick={() => deleteField(field.id)}
                          className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 text-white rounded-full text-xs hover:bg-red-600"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </Rnd>
                );
              })}
            </div>
          </div>
        </div>

        {/* Status Bar */}
        <div className="flex items-center justify-between p-3 bg-gray-50 border-t text-sm text-gray-600">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${participantInfo.notary.isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span>Notary: {participantInfo.notary.identity}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${participantInfo.client.isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span>Client: {participantInfo.client.identity}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span>Sync: {isConnected ? 'Connected' : 'Disconnected'}</span>
            </div>
          </div>
          <div className="text-xs text-gray-500">
            {allApproved ? 'All participants approved' : 'Waiting for approvals...'}
          </div>
        </div>
      </div>

      {/* Field Toolbar */}
      <div className="w-64 border-l bg-gray-50 p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Fields</h3>
        <div className="space-y-2">
          {toolbarItems.map(item => (
            <div
              key={item.id}
              draggable={isNotary && !usedFields.has(item.id)}
              onDragStart={(e) => handleDragStart(e, item.id)}
              className={`p-3 rounded border cursor-pointer transition-colors ${
                usedFields.has(item.id)
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : isNotary
                  ? 'bg-white hover:bg-blue-50 border-gray-300 hover:border-blue-400'
                  : 'bg-gray-100 text-gray-500 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{item.icon}</span>
                <span className="font-medium">{item.title}</span>
              </div>
              {usedFields.has(item.id) && (
                <div className="text-xs text-gray-500 mt-1">
                  Used by {usedFields.get(item.id) === submitterUuid ? 'You' : 'Other'}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Instructions */}
        <div className="mt-6 p-3 bg-blue-50 rounded text-sm text-blue-800">
          <h4 className="font-medium mb-2">Instructions:</h4>
          <ul className="space-y-1 text-xs">
            <li>• Drag fields from here to the document</li>
            <li>• Each field type can only be used once</li>
            <li>• Drag fields to reposition them</li>
            <li>• Resize fields by dragging corners</li>
            <li>• Click "Approve" when done</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
