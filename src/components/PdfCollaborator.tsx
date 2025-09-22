import { useEffect, useRef, useState, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { CollabOp, DrawOp, TextOp, ClearOp, CursorOp } from "../types/collab";
import { LocalDataTrack } from "twilio-video";

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

type Props = {
  localDataTrack: LocalDataTrack | null;
  onRemoteData: (data: CollabOp) => void;
  isNotary: boolean;
  participantInfo: {
    notary: { identity: string; isConnected: boolean; isReady: boolean };
    client: { identity: string; isConnected: boolean; isReady: boolean };
  };
  onCanvasRef?: (canvas: HTMLCanvasElement | null) => void;
  remoteData?: CollabOp | null;
};

export default function PdfCollaborator({ 
  localDataTrack, 
  onRemoteData: _onRemoteData, 
  isNotary,
  participantInfo,
  onCanvasRef,
  remoteData
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const compositeRef = useRef<HTMLCanvasElement | null>(null);
  const compositeRafRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cursorTimeoutRef = useRef<number | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingPath, setDrawingPath] = useState<Array<[number, number]>>([]);
  const [drawings, setDrawings] = useState<Map<number, DrawOp[]>>(new Map());
  const [texts, setTexts] = useState<Map<number, TextOp[]>>(new Map());
  const [scale] = useState(1.5);
  const [currentColor, setCurrentColor] = useState("#000000");
  const [currentStrokeWidth, setCurrentStrokeWidth] = useState(2);
  const [remoteCursor, setRemoteCursor] = useState<{x: number, y: number, page: number, isVisible: boolean} | null>(null);

  // Load sample PDF
  useEffect(() => {
    const loadPdf = async () => {
      try {
        // Load the sample PDF from public folder
        const response = await fetch('/sample.pdf');
        const pdfData = await response.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
      } catch (error: any) {
        console.error(`[${isNotary ? 'Notary' : 'Client'}] Failed to load PDF:`, error);
        // Fallback: create a simple canvas with text
        createFallbackDocument();
      }
    };

    loadPdf();
  }, []);

  const createFallbackDocument = () => {
    console.log(`[${isNotary ? 'Notary' : 'Client'}] Creating fallback document`);
    // Create a fallback document if PDF loading fails
    setTotalPages(1);
    setPdfDoc({ numPages: 1 });
  };

  // Handle remote data from parent component
  useEffect(() => {
    console.log(`[${isNotary ? 'Notary' : 'Client'}] PdfCollaborator mounted with localDataTrack:`, !!localDataTrack);
    if (localDataTrack) {
      console.log(`[${isNotary ? 'Notary' : 'Client'}] PdfCollaborator received localDataTrack, should render document editor`);
    } else {
      console.log(`[${isNotary ? 'Notary' : 'Client'}] PdfCollaborator waiting for localDataTrack...`);
    }
  }, [localDataTrack, isNotary]);

  const renderPage = useCallback(async (pageNum: number) => {
    if (!canvasRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    
    if (!context) {
      return;
    }

    try {
      if (pdfDoc && pdfDoc.numPages) {
        // Render actual PDF page
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        if (canvas.width !== viewport.width || canvas.height !== viewport.height) {
          canvas.width = viewport.width;
          canvas.height = viewport.height;
        }

        await page.render({
          canvasContext: context,
          viewport: viewport,
        }).promise;
      } else {
        // Render fallback document
        const targetW = 612 * scale;
        const targetH = 792 * scale;
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }
        
        // Clear canvas
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw document content
        context.fillStyle = "#000000";
        context.font = "16px Arial";
        context.fillText("APPLICATION FOR CERTIFIED COPY OF BIRTH RECORD", 50, 50);
        context.font = "14px Arial";
        context.fillText("State of California - Health and Human Services Agency", 50, 80);
        context.fillText("California Department of Public Health", 50, 100);
        
        context.font = "12px Arial";
        context.fillText("Preview your document", 50, 140);
        context.fillText("Please read the instructions before completing the application.", 50, 160);
        
        context.fillText("CERTIFICATE TYPE", 50, 200);
        context.fillText("☐ AUTHORIZED COPY (notarized sworn statement required)", 50, 220);
        context.fillText("☐ INFORMATIONAL COPY", 50, 240);
        
        context.fillText("Part 1 - Relationship to Person on Certificate", 50, 280);
        context.fillText("☐ Registrant  ☐ Parent  ☐ Legal Guardian", 50, 300);
        context.fillText("☐ Child  ☐ Spouse  ☐ Law Enforcement", 50, 320);
        context.fillText("☐ Attorney", 50, 340);
        
        context.fillText("Part 2 - Birth Record Information", 50, 380);
        context.fillText("FIRST Name: ________________________", 50, 400);
        context.fillText("MIDDLE Name: _______________________", 50, 420);
        context.fillText("LAST Name: _________________________", 50, 440);
        context.fillText("City of Birth: ______________________", 50, 460);
        context.fillText("County of Birth: ____________________", 50, 480);
        context.fillText("Date of Birth: ______________________", 50, 500);
        
        context.fillText("Part 3 - Applicant Information", 50, 540);
        context.fillText("Applicant Name: ____________________", 50, 560);
        context.fillText("Mailing Address: ___________________", 50, 580);
        context.fillText("Zip Code: __________________________", 50, 600);
        context.fillText("City: ______________________________", 50, 620);
        context.fillText("State/Province: ____________________", 50, 640);
        context.fillText("Country: ___________________________", 50, 660);
        context.fillText("Telephone: ________________________", 50, 680);
        context.fillText("Email Address: ____________________", 50, 700);
        context.fillText("Reason for Request: ________________", 50, 720);
        
        context.fillText("Application Checklist", 50, 760);
        context.fillText("☐ Check/Money Order Enclosed (No Cash)", 50, 780);
        context.fillText("☐ Notarized Sworn Statement Enclosed (if applicable)", 50, 800);
        context.fillText("Number of Copies: _________________", 50, 820);
        
        context.font = "14px Arial";
        context.fillStyle = "#ff0000";
        context.fillText("Cost: $29.00 PER COPY", 50, 860);
        
        context.fillStyle = "#000000";
        context.font = "10px Arial";
        context.fillText("For current processing times, visit: www.cdph.ca.gov", 50, 880);
      }

      // Size and redraw overlay on top of the PDF canvas
      const overlay = overlayRef.current;
      if (overlay) {
        if (overlay.width !== canvas.width || overlay.height !== canvas.height) {
          overlay.width = canvas.width;
          overlay.height = canvas.height;
        }
        const octx = overlay.getContext('2d');
        if (octx) {
          // Clear overlay
          octx.clearRect(0, 0, overlay.width, overlay.height);

          // Draw existing drawings for this page on overlay
          const pageDrawings = drawings.get(pageNum) || [];
          pageDrawings.forEach(draw => {
            if (draw.type === "draw") {
              octx.save();
              // Ensure no PDF.js transforms affect us
              octx.setTransform(1, 0, 0, 1, 0, 0);
              octx.strokeStyle = draw.color;
              const toCanvasPoint = (pt: [number, number]): [number, number] => (
                draw.normalized ? [pt[0] * overlay.width, pt[1] * overlay.height] : pt
              ) as [number, number];
              octx.lineWidth = Math.max(1, draw.strokeWidth || 1);
              octx.lineCap = "round";
              octx.lineJoin = "round";
              octx.beginPath();
              draw.path.forEach((p, index) => {
                const [x, y] = toCanvasPoint(p as [number, number]);
                if (index === 0) {
                  octx.moveTo(x, y);
                } else {
                  octx.lineTo(x, y);
                }
              });
              octx.stroke();
              octx.restore();
            }
          });

          // Draw in-progress local stroke
          if (isNotary && pageNum === currentPage && isDrawing && drawingPath.length > 1) {
            octx.save();
            octx.setTransform(1, 0, 0, 1, 0, 0);
            octx.strokeStyle = currentColor;
            octx.lineWidth = currentStrokeWidth;
            octx.lineCap = "round";
            octx.lineJoin = "round";
            octx.beginPath();
            drawingPath.forEach(([x, y], index) => {
              if (index === 0) {
                octx.moveTo(x, y);
              } else {
                octx.lineTo(x, y);
              }
            });
            octx.stroke();
            octx.restore();
          }
        }
      }

      // Draw existing texts for this page
      const pageTexts = texts.get(pageNum) || [];
      pageTexts.forEach(text => {
        if (text.type === "text") {
          context.fillStyle = text.color;
          context.font = `${text.fontSize}px Arial`;
          context.fillText(text.value, text.x, text.y);
        }
      });

    } catch (error) {
      console.error("Error rendering page:", error);
    }
  }, [pdfDoc, scale, drawings, texts, isDrawing, drawingPath, currentColor, currentStrokeWidth, currentPage, isNotary]);

  useEffect(() => {
    renderPage(currentPage);
  }, [currentPage, renderPage]);

  // Pass canvas ref to parent for sharing
  useEffect(() => {
    if (!onCanvasRef) return;
    const base = canvasRef.current;
    const overlay = overlayRef.current;
    if (!base || !overlay) return;

    // Create or sync composite canvas
    if (!compositeRef.current) {
      compositeRef.current = document.createElement('canvas');
    }
    const composite = compositeRef.current;

    const step = () => {
      if (!base || !overlay || !composite) return;
      if (composite.width !== base.width || composite.height !== base.height) {
        composite.width = base.width;
        composite.height = base.height;
      }
      const cctx = composite.getContext('2d');
      if (cctx) {
        // Draw base PDF content
        cctx.clearRect(0, 0, composite.width, composite.height);
        cctx.drawImage(base, 0, 0);
        // Draw overlay annotations
        cctx.drawImage(overlay, 0, 0);
      }
      compositeRafRef.current = requestAnimationFrame(step);
    };

    // Start composite loop and provide composite canvas to parent
    onCanvasRef(composite);
    compositeRafRef.current = requestAnimationFrame(step);

    return () => {
      if (compositeRafRef.current) cancelAnimationFrame(compositeRafRef.current);
      compositeRafRef.current = null;
      onCanvasRef(null);
    };
  }, [onCanvasRef]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isNotary) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    console.log(`[PdfCollaborator] Mouse down at canvas coordinates: (${x}, ${y}), scale: ${scale}, canvas size: ${canvas.width}x${canvas.height}`);

    setIsDrawing(true);
    setDrawingPath([[x, y]]);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isNotary) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Send cursor position to remote participants
    if (localDataTrack) {
      const normX = x / canvas.width;
      const normY = y / canvas.height;
      const cursorOp: CursorOp = {
        type: "cursor",
        x: normX,
        y: normY,
        page: currentPage,
        isVisible: true,
        normalized: true
      };
      localDataTrack.send(JSON.stringify(cursorOp));
    }

    // Continue drawing if in drawing mode
    if (isDrawing) {
      setDrawingPath(prev => {
        const nextPath = [...prev, [x, y] as [number, number]];

        // Stream incremental segment to remote for real-time rendering
        if (localDataTrack && prev.length > 0) {
          const lastPoint = prev[prev.length - 1];
          const drawOp: DrawOp = {
            type: "draw",
            page: currentPage,
            path: [
              [lastPoint[0] / canvas.width, lastPoint[1] / canvas.height],
              [x / canvas.width, y / canvas.height]
            ],
            color: currentColor,
            strokeWidth: currentStrokeWidth,
            normalized: true,
          };
          try {
            localDataTrack.send(JSON.stringify(drawOp));
          } catch (err) {
            console.warn("Failed to send incremental draw op", err);
          }
        }

        return nextPath;
      });
    }
  };

  const handleMouseUp = () => {
    if (!isDrawing || !isNotary || !localDataTrack) return;

    const canvas = canvasRef.current!;
    const drawOp: DrawOp = {
      type: "draw",
      page: currentPage,
      path: drawingPath.map(([px, py]) => [px / canvas.width, py / canvas.height] as [number, number]),
      color: currentColor,
      strokeWidth: currentStrokeWidth,
      normalized: true,
    };

    console.log(`[PdfCollaborator] Sending draw operation:`, drawOp);

    // Update local state
    setDrawings(prev => {
      const newDrawings = new Map(prev);
      const pageDrawings = newDrawings.get(currentPage) || [];
      newDrawings.set(currentPage, [...pageDrawings, drawOp]);
      return newDrawings;
    });

    // Send to remote participant
    localDataTrack.send(JSON.stringify(drawOp));

    setIsDrawing(false);
    setDrawingPath([]);
  };

  const handleMouseLeave = () => {
    if (!isNotary || !localDataTrack) return;

    // Hide cursor when mouse leaves canvas
    const cursorOp: CursorOp = {
      type: "cursor",
      x: 0,
      y: 0,
      page: currentPage,
      isVisible: false,
      normalized: true
    };
    localDataTrack.send(JSON.stringify(cursorOp));
  };

  const handleRemoteData = (data: CollabOp) => {
    if (data.type === "draw") {
      console.log(`[PdfCollaborator] Received remote draw operation:`, data);
      // For incremental segments (2 points), draw directly on canvas to avoid full re-render
      if (data.path.length === 2) {
        const overlay = overlayRef.current;
        const ctx = overlay ? overlay.getContext("2d") : null;
        if (overlay && ctx && data.page === currentPage) {
          const toPx = (pt: [number, number]): [number, number] => (
            data.normalized ? [pt[0] * overlay.width, pt[1] * overlay.height] : pt
          ) as [number, number];
          const [p0, p1] = data.path as [number, number][];
          const [x0, y0] = toPx(p0);
          const [x1, y1] = toPx(p1);
          ctx.save();
          ctx.strokeStyle = data.color;
          ctx.lineWidth = Math.max(1, data.strokeWidth || 1);
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.stroke();
          ctx.restore();
          // Do not update drawings to avoid triggering renderPage; keep it lightweight
          return;
        }
      }

      // For completed strokes (path > 2) or non-incremental, update drawings and let effect re-render
      setDrawings(prev => {
        const newDrawings = new Map(prev);
        const pageDrawings = newDrawings.get(data.page) || [];
        newDrawings.set(data.page, [...pageDrawings, data]);
        return newDrawings;
      });
    } else if (data.type === "text") {
      setTexts(prev => {
        const newTexts = new Map(prev);
        const pageTexts = newTexts.get(data.page) || [];
        newTexts.set(data.page, [...pageTexts, data]);
        return newTexts;
      });
    } else if (data.type === "clear") {
      setDrawings(prev => {
        const newDrawings = new Map(prev);
        newDrawings.set(data.page, []);
        return newDrawings;
      });
      setTexts(prev => {
        const newTexts = new Map(prev);
        newTexts.set(data.page, []);
        return newTexts;
      });
    } else if (data.type === "cursor") {
      // Debounce cursor updates to prevent excessive re-renders
      if (cursorTimeoutRef.current) {
        clearTimeout(cursorTimeoutRef.current);
      }
      
      cursorTimeoutRef.current = setTimeout(() => {
        const canvas = canvasRef.current;
        if (!canvas) {
          return;
        }
        const pixelX = (data as any).normalized ? data.x * canvas.width : data.x;
        const pixelY = (data as any).normalized ? data.y * canvas.height : data.y;
        setRemoteCursor({
          x: pixelX,
          y: pixelY,
          page: data.page,
          isVisible: data.isVisible
        });
      }, 16); // ~60fps
      
      // Cursor updates don't need page re-render
      return;
    }

    // Don't re-render immediately - let useEffect handle it
  };

  // Handle remote data when it changes
  useEffect(() => {
    if (remoteData) {
      handleRemoteData(remoteData);
    }
  }, [remoteData]);

  // Re-render page when drawings or texts change for current page
  useEffect(() => {
    if (pdfDoc && canvasRef.current) {
      renderPage(currentPage);
    }
  }, [drawings, texts, currentPage, pdfDoc]);

  // Update cursor position without re-rendering the page
  useEffect(() => {
    // Cursor updates don't need to trigger page re-render
    // The cursor is rendered separately in the JSX
  }, [remoteCursor]);

  // Cleanup cursor timeout on unmount
  useEffect(() => {
    return () => {
      if (cursorTimeoutRef.current) {
        clearTimeout(cursorTimeoutRef.current);
      }
    };
  }, []);

  const clearPage = () => {
    if (!isNotary || !localDataTrack) return;

    const clearOp: ClearOp = {
      type: "clear",
      page: currentPage,
    };

    // Update local state
    setDrawings(prev => {
      const newDrawings = new Map(prev);
      newDrawings.set(currentPage, []);
      return newDrawings;
    });
    setTexts(prev => {
      const newTexts = new Map(prev);
      newTexts.set(currentPage, []);
      return newTexts;
    });

    // Send to remote participant
    localDataTrack.send(JSON.stringify(clearOp));
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <h2 className="text-lg font-semibold text-gray-800">
          {isNotary ? 'Document Editor' : 'Document View (Read-only)'}
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
          
          {isNotary && (
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={currentColor}
                onChange={(e) => setCurrentColor(e.target.value)}
                className="w-8 h-8 rounded border"
              />
              <input
                type="range"
                min="1"
                max="10"
                value={currentStrokeWidth}
                onChange={(e) => setCurrentStrokeWidth(Number(e.target.value))}
                className="w-20"
              />
              <button
                onClick={clearPage}
                className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-sm"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      </div>

      {/* PDF Viewer */}
      <div className="flex-1 overflow-auto p-4">
        <div ref={containerRef} className="flex justify-center">
          <div className="relative">
            <canvas
              ref={canvasRef}
              className="border border-gray-300 shadow-lg"
            />
            <canvas
              ref={overlayRef}
              className="absolute top-0 left-0 pointer-events-auto"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
              style={{ cursor: isNotary ? 'crosshair' : 'default' }}
            />
            
            {/* Remote cursor indicator */}
            {!isNotary && remoteCursor && remoteCursor.isVisible && remoteCursor.page === currentPage && (
              <div
                className="absolute pointer-events-none z-10"
                style={{
                  left: remoteCursor.x,
                  top: remoteCursor.y,
                  transform: 'translate(-50%, -50%)'
                }}
              >
                <div className="w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-lg animate-pulse">
                  <div className="w-2 h-2 bg-white rounded-full absolute top-1 left-1"></div>
                </div>
              </div>
            )}
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
        </div>
        <div className="text-xs text-gray-500">
          {isNotary ? 'You can edit this document' : 'Viewing document (read-only)'}
        </div>
      </div>
    </div>
  );
}
