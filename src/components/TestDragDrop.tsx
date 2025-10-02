import React, { useState, useCallback } from 'react';
import { Rnd } from 'react-rnd';
import { v4 as uuidv4 } from 'uuid';

interface TestField {
  id: string;
  type: string;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export default function TestDragDrop() {
  const [fields, setFields] = useState<TestField[]>([]);
  const [draggedFieldType, setDraggedFieldType] = useState<string | null>(null);

  const toolbarItems = [
    { id: 'text', title: 'Text Field', icon: '📝' },
    { id: 'signature', title: 'Signature', icon: '✍️' },
    { id: 'date', title: 'Date', icon: '📅' },
    { id: 'checkbox', title: 'Checkbox', icon: '☑️' }
  ];

  const handleDragStart = (e: React.DragEvent, fieldType: string) => {
    console.log('Drag start:', fieldType);
    setDraggedFieldType(fieldType);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    console.log('Drop event:', { draggedFieldType });
    
    if (!draggedFieldType) return;

    const x = e.clientX - 200; // Offset for toolbar
    const y = e.clientY - 100; // Offset for header
    
    const newField: TestField = {
      id: uuidv4(),
      type: draggedFieldType,
      title: toolbarItems.find(item => item.id === draggedFieldType)?.title || draggedFieldType,
      x,
      y,
      w: 150,
      h: 30
    };

    console.log('Creating field:', newField);
    setFields(prev => [...prev, newField]);
    setDraggedFieldType(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const updateField = (fieldId: string, updates: Partial<TestField>) => {
    setFields(prev => prev.map(field => 
      field.id === fieldId ? { ...field, ...updates } : field
    ));
  };

  const deleteField = (fieldId: string) => {
    setFields(prev => prev.filter(field => field.id !== fieldId));
  };

  return (
    <div className="h-screen flex">
      {/* Toolbar */}
      <div className="w-64 border-r bg-gray-50 p-4">
        <h3 className="text-lg font-semibold mb-4">Fields</h3>
        <div className="space-y-2">
          {toolbarItems.map(item => (
            <div
              key={item.id}
              draggable={true}
              onDragStart={(e) => handleDragStart(e, item.id)}
              className="p-3 rounded border cursor-grab bg-white hover:bg-blue-50 border-gray-300 hover:border-blue-400"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{item.icon}</span>
                <span className="font-medium">{item.title}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Drop Zone */}
      <div 
        className="flex-1 relative bg-white"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <div className="p-4">
          <h2 className="text-xl font-bold mb-4">Test Drag & Drop</h2>
          <p className="text-gray-600 mb-4">
            Drag fields from the toolbar to this area. Fields: {fields.length}
          </p>
        </div>

        {/* Render fields */}
        {fields.map(field => (
          <Rnd
            key={field.id}
            position={{ x: field.x, y: field.y }}
            size={{ width: field.w, height: field.h }}
            bounds="parent"
            onDragStop={(_, d) => {
              updateField(field.id, { x: d.x, y: d.y });
            }}
            onResizeStop={(_, __, ___, delta, position) => {
              updateField(field.id, {
                x: position.x,
                y: position.y,
                w: field.w + delta.width,
                h: field.h + delta.height
              });
            }}
          >
            <div className="w-full h-full border-2 border-blue-500 bg-blue-100 bg-opacity-50 flex items-center justify-center text-xs font-medium text-blue-800 cursor-move relative">
              {field.title}
              <button
                onClick={() => deleteField(field.id)}
                className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 text-white rounded-full text-xs hover:bg-red-600"
              >
                ×
              </button>
            </div>
          </Rnd>
        ))}
      </div>
    </div>
  );
}
