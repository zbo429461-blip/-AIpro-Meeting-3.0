
import React, { useState, useEffect, useRef } from 'react';
import { FormTemplate, FormField, FormSubmission, AppSettings } from '../types';
import { 
  FileSignature, Plus, Trash2, FileText, Send, ArrowLeft, Download, 
  Microscope, ChevronRight, Sparkles, Upload, 
  Loader2, Save, X, CheckCircle2, LayoutGrid, FileSpreadsheet, Printer,
  Clock, MousePointer2, ListPlus, Search, Info, Settings, AlertCircle, Eye, MonitorPlay,
  RotateCw, Crop, ScanLine, Table as IconTable, Grid, FileJson, Copy, FileDown, BrainCircuit, Ban, PenTool, Crosshair,
  Layers, Zap, Network
} from 'lucide-react';
import { parseFormFromDocument, parseFormFromExcelData, getAIProviderLabel } from '../services/aiService';
import { utils, read, writeFile } from 'https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs';
import { Document, Packer, Paragraph, Table, TableCell, TableRow, WidthType, BorderStyle, TextRun, AlignmentType, VerticalAlign, ShadingType, VerticalMergeType, TableLayoutType, HeightRule } from 'docx';
import saveAs from 'file-saver';

interface FormsViewProps {
    settings: AppSettings;
}

export const FormsView: React.FC<FormsViewProps> = ({ settings }) => {
  const [activeTab, setActiveTab] = useState<'templates' | 'submissions'>('templates');
  const [selectedTemplate, setSelectedTemplate] = useState<FormTemplate | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<FormSubmission | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState(0); 
  const [scanImagePreview, setScanImagePreview] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Studio Builder State
  const [showCreateOptions, setShowCreateOptions] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<FormTemplate | null>(null);
  const [isManualCreate, setIsManualCreate] = useState(false);
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);

  // Form Filling State
  const [isHandwriting, setIsHandwriting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mobileStepTimerRef = useRef<number | null>(null);

  // Advanced OCR Steps Configuration
  const scanSteps = [
      { id: 0, label: "图像预处理 (二值化/去噪/倾斜校正)", icon: RotateCw, type: 'preprocessing' },
      { id: 1, label: "视觉特征提取 (CNN/vLLM 视觉模型)", icon: Layers, type: 'feature_extraction' },
      { id: 2, label: "字符分类识别 (SVM/DeepLearning)", icon: BrainCircuit, type: 'classification' },
      { id: 3, label: "全局上下文分析 (Self-Attention)", icon: Network, type: 'attention' },
      { id: 4, label: "结构化后处理 (规则引擎/LLM纠错)", icon: Zap, type: 'post_processing' },
      { id: 5, label: "生成高保真电子表单", icon: FileJson, type: 'finalizing' }
  ];

  useEffect(() => {
    const savedSubs = localStorage.getItem('app_form_submissions');
    if (savedSubs) try { setSubmissions(JSON.parse(savedSubs)); } catch (e) {}
    
    // Load templates or init with default
    const savedTemps = localStorage.getItem('app_form_templates');
    if (savedTemps) {
        try { 
            setTemplates(JSON.parse(savedTemps)); 
        } catch (e) {}
    } else {
        setTemplates([]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('app_form_submissions', JSON.stringify(submissions));
    localStorage.setItem('app_form_templates', JSON.stringify(templates));
  }, [submissions, templates]);

  const cancelScanning = () => {
      if (mobileStepTimerRef.current) clearInterval(mobileStepTimerRef.current);
      setIsScanning(false);
      setScanStep(0);
      setScanImagePreview(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      setIsScanning(true);
      setShowCreateOptions(false);
      setScanStep(0); 

      // Simulate detailed OCR progression steps
      if (mobileStepTimerRef.current) clearInterval(mobileStepTimerRef.current);
      
      // Step 0: Preprocessing (0-1500ms)
      // Step 1: CNN (1500-3000ms)
      // Step 2: Classification (3000-4500ms)
      
      let currentSimStep = 0;
      mobileStepTimerRef.current = window.setInterval(() => {
          if (currentSimStep < 3) {
              currentSimStep++;
              setScanStep(currentSimStep);
          }
      }, 1500);

      try {
          if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
              const data = await file.arrayBuffer();
              if (mobileStepTimerRef.current) clearInterval(mobileStepTimerRef.current);
              setScanStep(3); 
              
              const workbook = read(data);
              const result = await parseFormFromExcelData(utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 }) as any[][], settings);
              
              setScanStep(4);
              await new Promise(r => setTimeout(r, 800));
              setScanStep(5);
              await new Promise(r => setTimeout(r, 600));
              openEditorWithResult(result, "EXCEL");
          } else if (file.name.endsWith('.docx') || file.name.endsWith('.doc')) {
              alert("AI 暂时无法直接扫描 Word 布局。请另存为 PDF 或截图上传，效果更佳。");
              setIsScanning(false);
              if (mobileStepTimerRef.current) clearInterval(mobileStepTimerRef.current);
          } else {
              const reader = new FileReader();
              reader.readAsDataURL(file);
              reader.onload = async () => {
                  setScanImagePreview(reader.result as string);
                  try {
                      const base64 = (reader.result as string).split(',')[1];
                      
                      // Wait for simulation steps to progress a bit
                      await new Promise(r => setTimeout(r, 4500)); 
                      if (mobileStepTimerRef.current) clearInterval(mobileStepTimerRef.current);
                      
                      setScanStep(3); // Attention
                      await new Promise(r => setTimeout(r, 1500));
                      
                      setScanStep(4); // Post-processing
                      
                      // Timeout race
                      const timeoutPromise = new Promise((_, reject) => 
                          setTimeout(() => reject(new Error("AI 响应超时（已等待 5 分钟）。建议：1.检查网络 2.切换为 Flash 模型 3.压缩图片/PDF")), 300000)
                      );
                      
                      const result: any = await Promise.race([
                          parseFormFromDocument(base64, file.type, settings),
                          timeoutPromise
                      ]);
                      
                      setScanStep(5); // Finalize
                      await new Promise(r => setTimeout(r, 800));

                      openEditorWithResult(result, file.name.toUpperCase());
                  } catch (err: any) { 
                      console.error(err);
                      alert(err.message || "识别失败，请重试或检查 API Key"); 
                  } finally { 
                      setIsScanning(false); 
                      setScanImagePreview(null);
                  }
              };
              reader.onerror = () => {
                  alert("文件读取失败");
                  setIsScanning(false);
                  setScanImagePreview(null);
                  if (mobileStepTimerRef.current) clearInterval(mobileStepTimerRef.current);
              };
          }
      } catch (err: any) { 
          alert(err.message); 
          setIsScanning(false); 
          setScanImagePreview(null);
          if (mobileStepTimerRef.current) clearInterval(mobileStepTimerRef.current);
      }
      e.target.value = '';
  };

  const openEditorWithResult = (result: any, source: string) => {
      setEditingTemplate({
          id: `T${Date.now().toString().slice(-4)}`,
          title: result.title || "数字化导入表单",
          description: result.description || `由 AI 从 ${source} 逆向生成`,
          category: 'Admin',
          fields: (result.fields || []).map((f: any) => ({ ...f, id: f.id || Math.random().toString(36).slice(2, 7) })),
          createdAt: Date.now()
      });
  };

  const saveTemplate = () => {
      if (!editingTemplate) return;
      setTemplates([editingTemplate, ...templates]);
      setEditingTemplate(null);
      alert("表单已存入数字化模板库");
  };

  const addField = () => {
      if (!editingTemplate) return;
      const newField: FormField = { id: Math.random().toString(36).slice(2, 7), label: '新字段', type: 'text', colSpan: 24, required: false };
      setEditingTemplate({ ...editingTemplate, fields: [...editingTemplate.fields, newField] });
      setActiveFieldId(newField.id);
  };

  const updateField = (id: string, updates: Partial<FormField>) => {
      if (!editingTemplate) return;
      setEditingTemplate({ ...editingTemplate, fields: editingTemplate.fields.map(f => f.id === id ? { ...f, ...updates } : f) });
  };

  const handleSaveDraft = () => {
      if (!selectedTemplate) return;
      const newSub: FormSubmission = {
        id: `D${Date.now().toString().slice(-6)}`,
        templateId: selectedTemplate.id,
        data: { ...formData },
        submittedAt: Date.now(),
        status: 'pending', 
        history: [{ status: '草稿', time: Date.now(), note: '用户暂存' }]
      };
      setSubmissions([newSub, ...submissions]);
      alert("草稿已保存到[我的申请单]");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate) return;
    const newSub: FormSubmission = {
      id: `S${Date.now().toString().slice(-6)}`,
      templateId: selectedTemplate.id,
      data: { ...formData },
      submittedAt: Date.now(),
      status: 'pending',
      history: [{ status: '已提交', time: Date.now(), note: '业务人员发起' }]
    };
    setSubmissions([newSub, ...submissions]);
    setSelectedTemplate(null);
    setFormData({});
    alert("申请已提交，等待审核。");
  };

  // --- Strict Implementation of generateDocxRows ---
  const generateDocxRowsStrict = (template: FormTemplate, submissionData?: Record<string, string>, isBlank: boolean = false) => {
      // 1. Initialize Grid
      const gridIds: string[][] = [];
      const fieldMap = new Map<string, FormField>();
      let currentRow = 0;
      let currentCol = 0;
      
      const getNextFree = () => {
          while(true) {
              if (!gridIds[currentRow]) gridIds[currentRow] = new Array(24).fill(null);
              if (currentCol >= 24) { currentRow++; currentCol=0; continue; }
              if (!gridIds[currentRow][currentCol]) return {r: currentRow, c: currentCol};
              currentCol++;
          }
      };

      template.fields.forEach(f => {
          const pos = getNextFree();
          const rs = f.rowSpan || 1;
          const cs = f.colSpan || 24;
          fieldMap.set(f.id, f);
          for(let i=0; i<rs; i++){
              for(let j=0; j<cs; j++){
                  if(!gridIds[pos.r+i]) gridIds[pos.r+i] = new Array(24).fill(null);
                  gridIds[pos.r+i][pos.c+j] = f.id;
              }
          }
          currentCol += cs;
      });

      // 2. Generate Rows - High Fidelity Styling
      // Match "border-slate-900" (Dark Blue/Grey) -> Color "0F172A", Size 12 (1.5pt) for a bold look
      const borderStyle = { style: BorderStyle.SINGLE, size: 12, color: "0F172A" };
      const borders = { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle };

      return gridIds.map((row, rIdx) => {
          const cells: TableCell[] = [];
          for (let c=0; c<24; c++) {
              const fieldId = row[c];
              if (!fieldId) {
                  // Empty filler
                  cells.push(new TableCell({ width: {size: 100/24, type: WidthType.PERCENTAGE}, children:[], borders }));
                  continue;
              }

              const field = fieldMap.get(fieldId)!;
              const cs = field.colSpan || 24;
              
              const isFieldStartCol = (c === 0) || (row[c-1] !== fieldId);
              const isFieldStartRow = (rIdx === 0) || (gridIds[rIdx-1][c] !== fieldId);

              if (!isFieldStartCol) continue;

              const cellChildren = [];
              if (field.type === 'section') {
                  cellChildren.push(new Paragraph({
                      children: [new TextRun({ text: field.label, bold: true, size: 28, font: "SimHei" })],
                      alignment: AlignmentType.CENTER
                  }));
              } else {
                  if (!field.hideLabel) {
                       cellChildren.push(new Paragraph({
                          children: [new TextRun({ text: field.label, bold: true, size: 22, color: "000000", font: "SimHei" })], // SimHei for Labels (Sans-like)
                          spacing: { after: 120 }
                      }));
                  }
                  const val = isBlank ? '' : (field.readOnly ? (field.defaultValue || '') : (submissionData?.[field.id] || ''));
                  const lines = val.split('\n');
                  const textRuns = lines.map((line, i) => 
                      new TextRun({ 
                          text: line, 
                          bold: field.readOnly, 
                          size: 22,
                          font: "SimSun", // SimSun for Content (Serif-like, formal)
                          break: i > 0 ? 1 : 0 
                      })
                  );

                  cellChildren.push(new Paragraph({
                      children: textRuns,
                      spacing: { after: 100 }
                  }));
              }

              let vMerge = undefined;
              if (!isFieldStartRow) {
                  vMerge = VerticalMergeType.CONTINUE;
                  while(cellChildren.length > 0) cellChildren.pop();
                  cellChildren.push(new Paragraph({})); 
              } else if (field.rowSpan && field.rowSpan > 1) {
                  vMerge = VerticalMergeType.RESTART;
              }

              cells.push(new TableCell({
                  width: { size: (cs/24)*100, type: WidthType.PERCENTAGE },
                  columnSpan: cs,
                  verticalMerge: vMerge,
                  children: cellChildren,
                  borders: borders,
                  shading: field.type === 'section' ? { fill: "F1F5F9", type: ShadingType.CLEAR, color: "auto" } : undefined,
                  verticalAlign: VerticalAlign.CENTER,
                  // Increased margins to 150 twips (~2.6mm) to match the "comfortable" preview look
                  margins: { top: 150, bottom: 150, left: 150, right: 150 }
              }));
          }
          return new TableRow({ 
              children: cells,
              height: { value: 800, rule: HeightRule.ATLEAST } // ~1.4cm min height for closer match to min-h-[50px]
          });
      });
  };

  const exportToDocx = async (submission: FormSubmission) => {
    const template = templates.find(t => t.id === submission.templateId);
    if (!template) return;

    const tableRows = generateDocxRowsStrict(template, submission.data, false);

    const doc = new Document({
        sections: [{
            properties: {
                page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } }
            },
            children: [
                new Paragraph({
                    children: [new TextRun({ text: template.title, bold: true, size: 36, font: "SimHei" })],
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 400 }
                }),
                new Table({
                    rows: tableRows,
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    layout: TableLayoutType.FIXED,
                })
            ]
        }]
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${template.title}_${submission.id}.docx`);
  };

  const handleDownloadBlankDocx = async () => {
    if (!selectedTemplate) return;
    const tableRows = generateDocxRowsStrict(selectedTemplate, undefined, true);
    const doc = new Document({
        sections: [{
            properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
            children: [
                new Paragraph({
                    children: [new TextRun({ text: selectedTemplate.title, bold: true, size: 36, font: "SimHei" })],
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 400 }
                }),
                new Table({
                    rows: tableRows,
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    layout: TableLayoutType.FIXED,
                })
            ]
        }]
    });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${selectedTemplate.title}_Blank.docx`);
  };

  const handleDownloadBlankExcel = () => {
    if (!selectedTemplate) return;
    // ... (Existing Excel logic - mostly standard)
    const gridIds: string[][] = [];
    const fieldMap = new Map<string, FormField>();
    let currentRow = 0;
    let currentCol = 0;
    const getNextFree = () => {
        while(true) {
            if (!gridIds[currentRow]) gridIds[currentRow] = new Array(24).fill(null);
            if (currentCol >= 24) { currentRow++; currentCol=0; continue; }
            if (!gridIds[currentRow][currentCol]) return {r: currentRow, c: currentCol};
            currentCol++;
        }
    };
    selectedTemplate.fields.forEach(f => {
        const pos = getNextFree();
        const rs = f.rowSpan || 1;
        const cs = f.colSpan || 24;
        fieldMap.set(f.id, f);
        for(let i=0; i<rs; i++){
            for(let j=0; j<cs; j++){
                if(!gridIds[pos.r+i]) gridIds[pos.r+i] = new Array(24).fill(null);
                gridIds[pos.r+i][pos.c+j] = f.id;
            }
        }
        currentCol += cs;
    });
    const ws_data: any[][] = [];
    const merges: any[] = [];
    for (let r = 0; r < gridIds.length; r++) { ws_data[r] = new Array(24).fill(""); }
    const processedMap = new Set<string>();
    for (let r = 0; r < gridIds.length; r++) {
        for (let c = 0; c < 24; c++) {
            const fieldId = gridIds[r][c];
            if (!fieldId) continue;
            if (processedMap.has(fieldId)) continue;
            const field = fieldMap.get(fieldId)!;
            const rs = field.rowSpan || 1;
            const cs = field.colSpan || 24;
            processedMap.add(fieldId);
            let cellValue = field.type === 'section' ? field.label : (!field.hideLabel ? field.label : "");
            if (field.readOnly && field.defaultValue) cellValue += (cellValue ? ": " : "") + field.defaultValue;
            ws_data[r][c] = cellValue;
            if (rs > 1 || cs > 1) { merges.push({ s: { r: r, c: c }, e: { r: r + rs - 1, c: c + cs - 1 } }); }
        }
    }
    const wb = utils.book_new();
    const ws = utils.aoa_to_sheet(ws_data);
    ws['!merges'] = merges;
    ws['!cols'] = new Array(24).fill({ wch: 3 });
    utils.book_append_sheet(wb, ws, "Form Template");
    writeFile(wb, `${selectedTemplate.title}_Blank.xlsx`);
  };

  const exportToExcel = (submission: FormSubmission) => {
    const template = templates.find(t => t.id === submission.templateId);
    if (!template) return;
    const exportData = template.fields.reduce((acc, field) => {
      if (field.type !== 'section') {
          acc[field.label] = submission.data[field.id] || field.defaultValue || "";
      }
      return acc;
    }, {} as Record<string, string>);
    const ws = utils.json_to_sheet([exportData]);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Submission Data");
    writeFile(wb, `Form_Export_${submission.id}.xlsx`);
  };

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] overflow-hidden font-sans">
      <header className="bg-white border-b h-20 flex