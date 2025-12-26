
import React, { useState, useEffect, useRef } from 'react';
import { FormTemplate, FormField, FormSubmission, AppSettings } from '../types';
import { 
  FileSignature, Plus, Trash2, FileText, Send, ArrowLeft, Download, 
  Microscope, ChevronRight, Sparkles, Upload, 
  Loader2, Save, X, CheckCircle2, LayoutGrid, FileSpreadsheet, Printer,
  Clock, MousePointer2, ListPlus, Search, Info, Settings, AlertCircle, Eye, MonitorPlay,
  RotateCw, Crop, ScanLine, Table as IconTable, Grid, FileJson, Copy, FileDown, BrainCircuit, Ban, PenTool, Crosshair,
  Layers, Zap, Network, ArrowRight
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
                          children: [new TextRun({ text: field.label, bold: true, size: 22, color: "000000", font: "SimHei" })], 
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
                          font: "SimSun", 
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
                  margins: { top: 150, bottom: 150, left: 150, right: 150 }
              }));
          }
          return new TableRow({ 
              children: cells,
              height: { value: 800, rule: HeightRule.ATLEAST }
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
      {/* Header */}
      <header className="bg-white border-b h-20 flex items-center justify-between px-8 shrink-0 shadow-sm z-30">
           <div className="flex items-center gap-4">
                <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                    <FileSignature size={24}/>
                </div>
                <div>
                    <h1 className="text-xl font-black text-slate-900">电子表单中心</h1>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Smart Form Engine</p>
                </div>
           </div>
           
           <div className="flex bg-slate-100 p-1 rounded-xl">
               <button 
                   onClick={() => setActiveTab('templates')}
                   className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'templates' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
               >
                   模板库
               </button>
               <button 
                   onClick={() => setActiveTab('submissions')}
                   className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'submissions' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
               >
                   我的申请单
               </button>
           </div>

           <div className="flex gap-3 relative">
                <button 
                    onClick={() => setShowCreateOptions(!showCreateOptions)} 
                    className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 text-[11px] font-black uppercase shadow-lg transition-all active:scale-95"
                >
                    <Plus size={16}/> 新建表单
                </button>
                {showCreateOptions && (
                    <div className="absolute top-14 right-0 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 w-64 animate-slideUp z-50 flex flex-col gap-1">
                        <button onClick={() => { setIsManualCreate(true); setShowCreateOptions(false); setEditingTemplate({ id: '', title: '未命名表单', description: '', category: 'Admin', fields: [], createdAt: Date.now() }); }} className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl text-left">
                            <div className="p-2 bg-slate-100 rounded-lg text-slate-600"><PenTool size={16}/></div>
                            <div>
                                <div className="text-xs font-bold text-slate-800">手动创建</div>
                                <div className="text-[10px] text-slate-400">空白画布，自由拖拽</div>
                            </div>
                        </button>
                        <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl text-left">
                            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600"><ScanLine size={16}/></div>
                            <div>
                                <div className="text-xs font-bold text-slate-800">智能扫描建单</div>
                                <div className="text-[10px] text-slate-400">上传图片/Excel/PDF自动识别</div>
                            </div>
                        </button>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*,.pdf,.xlsx,.xls" onChange={handleFileUpload} />
                    </div>
                )}
           </div>
      </header>

      <main className="flex-1 overflow-hidden relative">
          {/* Scanning Overlay */}
          {isScanning && (
              <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-md z-50 flex flex-col items-center justify-center p-8 text-white">
                  <div className="w-full max-w-3xl space-y-8">
                      <div className="flex justify-between items-center">
                          <h2 className="text-3xl font-black flex items-center gap-3"><Microscope className="text-indigo-400" size={32}/> AI 视觉引擎深度解析中</h2>
                          <button onClick={cancelScanning} className="p-2 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-colors"><X size={24}/></button>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-8">
                          {/* Preview Area */}
                          <div className="aspect-[3/4] bg-black/50 rounded-2xl border-2 border-dashed border-white/20 relative overflow-hidden flex items-center justify-center">
                              {scanImagePreview && (
                                  <>
                                      <img src={scanImagePreview} className="w-full h-full object-contain opacity-50 blur-sm scale-105" alt="blur-bg"/>
                                      <img src={scanImagePreview} className="absolute inset-0 w-full h-full object-contain z-10 p-4" alt="preview"/>
                                      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-indigo-500/10 to-transparent z-20 animate-scan"></div>
                                  </>
                              )}
                              {!scanImagePreview && <Loader2 className="animate-spin text-white/20" size={48}/>}
                          </div>

                          {/* Progress Steps */}
                          <div className="space-y-6 flex flex-col justify-center">
                              {scanSteps.map((step) => {
                                  const isActive = scanStep === step.id;
                                  const isDone = scanStep > step.id;
                                  return (
                                      <div key={step.id} className={`flex items-center gap-4 transition-all duration-500 ${isActive ? 'translate-x-2 opacity-100' : isDone ? 'opacity-40' : 'opacity-20'}`}>
                                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all ${isActive ? 'bg-indigo-600 border-indigo-400 text-white shadow-[0_0_20px_rgba(79,70,229,0.5)]' : isDone ? 'bg-green-500 border-green-500 text-white' : 'border-white/20'}`}>
                                              {isDone ? <CheckCircle2 size={20}/> : <step.icon size={20} className={isActive ? 'animate-pulse' : ''}/>}
                                          </div>
                                          <div>
                                              <p className={`font-bold text-sm ${isActive ? 'text-white' : 'text-white/80'}`}>{step.label}</p>
                                              {isActive && <p className="text-[10px] text-indigo-300 font-mono mt-1">Processing...</p>}
                                          </div>
                                      </div>
                                  );
                              })}
                          </div>
                      </div>
                  </div>
              </div>
          )}

          {/* Template Editor */}
          {editingTemplate ? (
              <div className="absolute inset-0 bg-slate-50 z-40 flex">
                  {/* Left: Component Toolbox */}
                  <div className="w-64 bg-white border-r border-slate-200 flex flex-col p-4">
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">组件库</h3>
                      <button onClick={addField} className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 font-bold text-xs hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2">
                          <Plus size={16}/> 添加新字段
                      </button>
                      
                      <div className="mt-6 flex-1 overflow-y-auto space-y-2">
                          {editingTemplate.fields.map((field, idx) => (
                              <div 
                                  key={field.id} 
                                  onClick={() => setActiveFieldId(field.id)}
                                  className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${activeFieldId === field.id ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-100 hover:border-slate-300'}`}
                              >
                                  <div className="font-bold truncate">{field.label || '未命名'}</div>
                                  <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
                                      <span>{field.type}</span>
                                      <span>Col: {field.colSpan}</span>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>

                  {/* Center: Canvas Preview */}
                  <div className="flex-1 overflow-y-auto p-8 bg-slate-100 flex justify-center">
                      <div className="w-[210mm] min-h-[297mm] bg-white shadow-xl p-12 relative flex flex-col">
                          <div className="mb-8 text-center border-b-2 border-slate-800 pb-4">
                              <input 
                                  value={editingTemplate.title} 
                                  onChange={e => setEditingTemplate({...editingTemplate, title: e.target.value})}
                                  className="text-3xl font-black text-center w-full outline-none placeholder-slate-300" 
                                  placeholder="请输入表单标题"
                              />
                          </div>
                          
                          <div className="grid grid-cols-24 border-2 border-slate-900 bg-slate-900 gap-[1px]">
                              {editingTemplate.fields.map(field => (
                                  <div 
                                      key={field.id}
                                      style={{ gridColumn: `span ${field.colSpan || 24}` }}
                                      className={`bg-white p-3 min-h-[50px] relative group border border-transparent ${activeFieldId === field.id ? 'ring-2 ring-indigo-500 z-10' : 'hover:bg-slate-50'}`}
                                      onClick={() => setActiveFieldId(field.id)}
                                  >
                                      {field.type === 'section' ? (
                                          <div className="font-bold text-center bg-slate-100 py-2">{field.label}</div>
                                      ) : (
                                          <div className="h-full flex flex-col">
                                              {!field.hideLabel && <div className="font-bold text-xs mb-1 text-slate-700">{field.label}</div>}
                                              <div className="flex-1 bg-slate-50/50 border-b border-slate-200 text-xs text-slate-400 p-1 italic">
                                                  {field.readOnly ? `[固定值] ${field.defaultValue}` : field.placeholder || 'User Input Area'}
                                              </div>
                                          </div>
                                      )}
                                      <button 
                                          onClick={(e) => { e.stopPropagation(); setEditingTemplate({...editingTemplate, fields: editingTemplate.fields.filter(f => f.id !== field.id)}); }}
                                          className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                      >
                                          <Trash2 size={10}/>
                                      </button>
                                  </div>
                              ))}
                          </div>
                      </div>
                  </div>

                  {/* Right: Property Inspector */}
                  <div className="w-72 bg-white border-l border-slate-200 p-4 flex flex-col">
                      <div className="flex justify-between items-center mb-6">
                          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">属性配置</h3>
                          <div className="flex gap-2">
                              <button onClick={() => setEditingTemplate(null)} className="p-2 hover:bg-slate-100 rounded text-slate-500"><X size={16}/></button>
                              <button onClick={saveTemplate} className="p-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 shadow-md"><Save size={16}/></button>
                          </div>
                      </div>

                      {activeFieldId ? (
                          <div className="space-y-4">
                              {(() => {
                                  const field = editingTemplate.fields.find(f => f.id === activeFieldId);
                                  if (!field) return null;
                                  return (
                                      <>
                                          <div>
                                              <label className="block text-[10px] font-bold text-slate-500 mb-1">字段标题</label>
                                              <input value={field.label} onChange={e => updateField(field.id, {label: e.target.value})} className="w-full p-2 border rounded text-xs"/>
                                          </div>
                                          <div className="grid grid-cols-2 gap-2">
                                              <div>
                                                  <label className="block text-[10px] font-bold text-slate-500 mb-1">类型</label>
                                                  <select value={field.type} onChange={e => updateField(field.id, {type: e.target.value as any})} className="w-full p-2 border rounded text-xs">
                                                      <option value="text">文本</option>
                                                      <option value="section">分节标题</option>
                                                      <option value="date">日期</option>
                                                      <option value="number">数字</option>
                                                  </select>
                                              </div>
                                              <div>
                                                  <label className="block text-[10px] font-bold text-slate-500 mb-1">宽度 (1-24)</label>
                                                  <input type="number" min="1" max="24" value={field.colSpan || 24} onChange={e => updateField(field.id, {colSpan: parseInt(e.target.value)})} className="w-full p-2 border rounded text-xs"/>
                                              </div>
                                          </div>
                                          <div>
                                              <label className="block text-[10px] font-bold text-slate-500 mb-1">默认值</label>
                                              <input value={field.defaultValue || ''} onChange={e => updateField(field.id, {defaultValue: e.target.value})} className="w-full p-2 border rounded text-xs"/>
                                          </div>
                                          <div className="flex flex-col gap-2 pt-2">
                                              <label className="flex items-center gap-2 text-xs">
                                                  <input type="checkbox" checked={field.readOnly} onChange={e => updateField(field.id, {readOnly: e.target.checked})} /> 只读 (固定内容)
                                              </label>
                                              <label className="flex items-center gap-2 text-xs">
                                                  <input type="checkbox" checked={field.hideLabel} onChange={e => updateField(field.id, {hideLabel: e.target.checked})} /> 隐藏标题
                                              </label>
                                          </div>
                                      </>
                                  );
                              })()}
                          </div>
                      ) : (
                          <div className="text-center text-slate-300 text-xs py-10">请选择一个字段进行编辑</div>
                      )}
                  </div>
              </div>
          ) : selectedTemplate ? (
              // Form Filler / Viewer
              <div className="absolute inset-0 bg-slate-100 z-30 flex justify-center overflow-y-auto p-8">
                  <div className="w-[210mm] bg-white shadow-xl min-h-[297mm] flex flex-col animate-slideUp">
                      <div className="p-12 pb-6 border-b border-slate-100 flex justify-between items-start">
                          <div>
                              <h1 className="text-3xl font-black text-slate-900 mb-2">{selectedTemplate.title}</h1>
                              <p className="text-xs text-slate-400">{selectedTemplate.description}</p>
                          </div>
                          <div className="flex gap-2 print:hidden">
                              <button onClick={() => setSelectedTemplate(null)} className="p-2 hover:bg-slate-100 rounded text-slate-400"><X size={20}/></button>
                          </div>
                      </div>
                      
                      <div className="flex-1 p-12">
                          <form onSubmit={handleSubmit} className="grid grid-cols-24 gap-[1px] bg-slate-900 border-2 border-slate-900">
                              {selectedTemplate.fields.map(field => {
                                  const isReadOnly = field.readOnly;
                                  return (
                                      <div 
                                          key={field.id} 
                                          style={{ gridColumn: `span ${field.colSpan || 24}` }} 
                                          className={`bg-white p-3 flex flex-col justify-center min-h-[60px] ${field.type === 'section' ? 'bg-slate-50' : ''}`}
                                      >
                                          {field.type === 'section' ? (
                                              <div className="font-bold text-center text-lg">{field.label}</div>
                                          ) : (
                                              <>
                                                  {!field.hideLabel && <label className="block text-xs font-bold text-slate-700 mb-1">{field.label}</label>}
                                                  {isReadOnly ? (
                                                      <div className="text-sm font-serif-sc font-bold text-slate-900">{field.defaultValue}</div>
                                                  ) : (
                                                      <input 
                                                          type={field.type} 
                                                          required={field.required}
                                                          value={formData[field.id] || ''}
                                                          onChange={e => setFormData({...formData, [field.id]: e.target.value})}
                                                          className={`w-full bg-transparent outline-none text-sm text-slate-900 placeholder-slate-300 font-serif-sc ${isHandwriting ? 'font-hand text-blue-800 text-lg' : ''}`}
                                                          placeholder={field.placeholder || "点击输入..."}
                                                      />
                                                  )}
                                              </>
                                          )}
                                      </div>
                                  );
                              })}
                          </form>
                      </div>

                      <div className="p-8 bg-slate-50 border-t border-slate-200 flex justify-between items-center print:hidden">
                          <div className="flex gap-4 items-center">
                              <label className="flex items-center gap-2 cursor-pointer select-none">
                                  <input type="checkbox" checked={isHandwriting} onChange={e => setIsHandwriting(e.target.checked)} className="rounded text-indigo-600"/>
                                  <span className="text-xs font-bold text-slate-600">模拟手写体</span>
                              </label>
                              <button onClick={handleDownloadBlankDocx} className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1"><FileDown size={14}/> 下载空白Word</button>
                              <button onClick={handleDownloadBlankExcel} className="text-xs font-bold text-green-600 hover:underline flex items-center gap-1"><FileSpreadsheet size={14}/> 下载空白Excel</button>
                          </div>
                          <div className="flex gap-3">
                              <button type="button" onClick={handleSaveDraft} className="px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-50">存草稿</button>
                              <button type="button" onClick={handleSubmit} className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-black shadow-lg">提交申请</button>
                          </div>
                      </div>
                  </div>
              </div>
          ) : (
              // Main List View
              <div className="p-8 h-full overflow-y-auto">
                  {activeTab === 'templates' ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                          {templates.map(template => (
                              <div key={template.id} className="group bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-xl hover:border-indigo-100 transition-all cursor-pointer relative" onClick={() => setSelectedTemplate(template)}>
                                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                      <FileText size={24}/>
                                  </div>
                                  <h3 className="font-bold text-slate-900 mb-1">{template.title}</h3>
                                  <p className="text-xs text-slate-400 line-clamp-2 mb-4 h-8">{template.description}</p>
                                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-50">
                                      <span className="text-[10px] font-bold bg-slate-100 px-2 py-1 rounded text-slate-500 uppercase">{template.category}</span>
                                      <span className="text-xs font-bold text-indigo-600 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">填写 <ArrowRight size={12}/></span>
                                  </div>
                                  <button onClick={(e) => { e.stopPropagation(); setEditingTemplate(template); }} className="absolute top-4 right-4 p-2 text-slate-300 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-all"><Settings size={16}/></button>
                              </div>
                          ))}
                          {templates.length === 0 && (
                              <div className="col-span-full py-20 text-center text-slate-300">
                                  <LayoutGrid size={48} className="mx-auto mb-4 opacity-20"/>
                                  <p>暂无模板，请点击右上角新建</p>
                              </div>
                          )}
                      </div>
                  ) : (
                      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                          <table className="w-full text-left">
                              <thead className="bg-slate-50 text-xs font-black text-slate-500 uppercase tracking-wider">
                                  <tr>
                                      <th className="px-6 py-4">单号</th>
                                      <th className="px-6 py-4">表单名称</th>
                                      <th className="px-6 py-4">提交时间</th>
                                      <th className="px-6 py-4">状态</th>
                                      <th className="px-6 py-4 text-right">操作</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                  {submissions.map(sub => {
                                      const t = templates.find(temp => temp.id === sub.templateId);
                                      return (
                                          <tr key={sub.id} className="hover:bg-slate-50/50">
                                              <td className="px-6 py-4 font-mono text-xs font-bold text-slate-400">{sub.id}</td>
                                              <td className="px-6 py-4 font-bold text-slate-800">{t?.title || 'Unknown'}</td>
                                              <td className="px-6 py-4 text-xs text-slate-500">{new Date(sub.submittedAt).toLocaleString()}</td>
                                              <td className="px-6 py-4">
                                                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${sub.status === 'pending' ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'}`}>
                                                      {sub.status}
                                                  </span>
                                              </td>
                                              <td className="px-6 py-4 text-right flex justify-end gap-2">
                                                  <button onClick={() => exportToDocx(sub)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="导出Word"><FileText size={16}/></button>
                                                  <button onClick={() => exportToExcel(sub)} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="导出Excel"><FileSpreadsheet size={16}/></button>
                                              </td>
                                          </tr>
                                      );
                                  })}
                              </tbody>
                          </table>
                          {submissions.length === 0 && <div className="p-12 text-center text-slate-300 text-xs">暂无申请记录</div>}
                      </div>
                  )}
              </div>
          )}
      </main>
    </div>
  );
};
