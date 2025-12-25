
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
import { utils, read, writeFile } from 'https://esm.sh/xlsx@0.18.5';
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
      <header className="bg-white border-b h-20 flex items-center justify-between px-10 shrink-0 shadow-sm z-50">
           <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-lg">
                    <FileSignature size={24}/>
                </div>
                <div>
                    <h1 className="text-xl font-black text-slate-900 tracking-tight">电子表单中心 Pro</h1>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Digitization Studio v4.5</p>
                </div>
           </div>
           <div className="flex items-center gap-6">
                <nav className="flex p-1.5 bg-slate-100 rounded-2xl">
                    <button onClick={() => { setActiveTab('templates'); setSelectedTemplate(null); }} className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${activeTab === 'templates' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>数字化模板库</button>
                    <button onClick={() => { setActiveTab('submissions'); setSelectedTemplate(null); }} className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${activeTab === 'submissions' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>我的申请单</button>
                </nav>
                <button 
                    onClick={() => setShowCreateOptions(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-95"
                >
                    <Plus size={18}/> 定义业务模板
                </button>
           </div>
      </header>

      <main className="flex-1 overflow-y-auto relative custom-scrollbar">
          
          {/* Enhanced Scanning Progress Overlay */}
          {isScanning && (
            <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-[200] flex flex-col items-center justify-center text-white overflow-hidden">
                {scanImagePreview && (
                    <div className="absolute inset-0 z-0 opacity-40">
                        {/* Dynamic Styles based on Step */}
                        <img 
                            src={scanImagePreview} 
                            className={`w-full h-full object-contain transition-all duration-1000 ${
                                scanStep === 0 ? 'grayscale-[100%] contrast-[150%] scale-[0.98]' : 
                                scanStep === 1 ? 'scale-100' : 'scale-100'
                            }`} 
                            style={{ 
                                transform: scanStep === 0 ? 'skew(1deg, 1deg)' : 'skew(0deg, 0deg)' // Deskew animation
                            }}
                            alt="Scanning..." 
                        />
                        <div className="absolute inset-0 bg-slate-900/60"></div>
                        
                        {/* Scanning Line Animation */}
                        <div className="absolute left-0 w-full h-1 bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,1)] transition-all duration-1000" 
                             style={{ top: `${(scanStep / 5) * 100}%` }}></div>
                        
                        {/* CNN Grid Overlay (Step 1) */}
                        {scanStep === 1 && (
                            <div className="absolute inset-0 grid grid-cols-12 grid-rows-12 pointer-events-none">
                                {Array.from({length: 20}).map((_, i) => (
                                    <div key={i} 
                                        className="bg-green-500/20 border border-green-500/30 animate-pulse"
                                        style={{ 
                                            gridColumn: Math.floor(Math.random() * 12) + 1,
                                            gridRow: Math.floor(Math.random() * 12) + 1,
                                            animationDuration: `${Math.random() * 0.5 + 0.5}s`
                                        }}
                                    ></div>
                                ))}
                            </div>
                        )}

                        {/* Classification Badges (Step 2) */}
                        {scanStep === 2 && (
                            <div className="absolute inset-0 pointer-events-none">
                                <div className="absolute top-[30%] left-[20%] bg-indigo-600/80 px-2 py-1 rounded text-xs animate-bounce">Text: 98%</div>
                                <div className="absolute top-[50%] right-[30%] bg-purple-600/80 px-2 py-1 rounded text-xs animate-bounce delay-100">Checkbox: 99%</div>
                                <div className="absolute bottom-[20%] left-[40%] bg-blue-600/80 px-2 py-1 rounded text-xs animate-bounce delay-200">Table Grid</div>
                            </div>
                        )}

                        {/* Attention Lines (Step 3) */}
                        {scanStep === 3 && (
                            <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-50">
                                <line x1="20%" y1="20%" x2="80%" y2="80%" stroke="#6366f1" strokeWidth="2" strokeDasharray="5,5" className="animate-pulse"/>
                                <line x1="80%" y1="20%" x2="20%" y2="80%" stroke="#6366f1" strokeWidth="2" strokeDasharray="5,5" className="animate-pulse"/>
                                <circle cx="20%" cy="20%" r="4" fill="#6366f1"/>
                                <circle cx="80%" cy="80%" r="4" fill="#6366f1"/>
                            </svg>
                        )}
                        
                        {/* Overlay Info */}
                        <div className="absolute inset-0 pointer-events-none">
                            <div className="absolute bottom-10 left-10 text-white/50 font-mono text-xs">
                                <div>vLLM Inference Engine Active</div>
                                <div>Model: Qwen-VL-Max / DeepSeek-V3</div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="w-full max-w-lg space-y-8 animate-fadeIn relative p-8 z-10 bg-black/40 rounded-3xl border border-white/10 backdrop-blur-md shadow-2xl">
                    <button onClick={cancelScanning} className="absolute top-4 right-4 p-2 text-white/50 hover:text-white transition-colors bg-white/10 hover:bg-white/20 rounded-full"><X size={24}/></button>
                    
                    <div className="text-center">
                        <Loader2 size={48} className="animate-spin text-indigo-500 mx-auto mb-4"/>
                        <h3 className="text-2xl font-black tracking-tight">AI 智能逆向引擎启动中</h3>
                        <p className="text-slate-400 text-sm mt-2 font-mono">Powered by {getAIProviderLabel(settings)}</p>
                    </div>
                    <div className="space-y-4">
                        {scanSteps.map((step, idx) => (
                            <div key={step.id} className={`flex items-center gap-4 transition-all duration-500 ${idx <= scanStep ? 'opacity-100 translate-x-0' : 'opacity-30 translate-x-4'}`}>
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${idx < scanStep ? 'bg-green-500 border-green-500 text-white' : idx === scanStep ? 'border-indigo-500 text-indigo-400 animate-pulse' : 'border-slate-700 text-slate-700'}`}>
                                    {idx < scanStep ? <CheckCircle2 size={20}/> : <step.icon size={20}/>}
                                </div>
                                <div>
                                    <p className={`font-bold text-sm ${idx === scanStep ? 'text-indigo-400' : 'text-slate-300'}`}>{step.label}</p>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-widest">{step.type}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    <div className="text-center mt-8">
                        <button onClick={cancelScanning} className="text-xs text-rose-400 hover:text-rose-300 underline flex items-center justify-center gap-1 mx-auto">
                            <Ban size={12}/> 如果长时间无响应，点击此处中止
                        </button>
                    </div>
                </div>
            </div>
          )}

          {/* ... (Rest of the component remains unchanged: Create Options, Editor, Submission View, etc.) ... */}
          {showCreateOptions && (
              <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-fadeIn">
                  <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-2xl overflow-hidden">
                      <div className="p-10 bg-slate-900 text-white flex justify-between items-center">
                          <div>
                              <h3 className="text-2xl font-black flex items-center gap-3"><MonitorPlay className="text-indigo-400"/> 选择创建逻辑</h3>
                              <p className="text-slate-400 text-xs mt-1 uppercase font-bold tracking-widest">Select Creation Logic</p>
                          </div>
                          <button onClick={() => setShowCreateOptions(false)} className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"><X/></button>
                      </div>
                      <div className="p-12 grid grid-cols-2 gap-8">
                          <div 
                            onClick={() => { setEditingTemplate({ id: 'M'+Date.now(), title: '新业务表单', description: '手动创建的业务流程', category: 'Admin', fields: [], createdAt: Date.now() }); setIsManualCreate(true); setShowCreateOptions(false); }}
                            className="p-10 border-2 border-slate-100 rounded-[2.5rem] hover:border-indigo-600 hover:bg-indigo-50/30 transition-all cursor-pointer group text-center"
                          >
                              <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-[2rem] flex items-center justify-center mb-8 mx-auto group-hover:scale-110 transition-transform shadow-inner"><Plus size={32}/></div>
                              <h4 className="text-lg font-black text-slate-800">可视化设计</h4>
                              <p className="text-xs text-slate-400 mt-2 font-medium">从零开始编排字段与逻辑</p>
                          </div>
                          <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="p-10 border-2 border-slate-100 rounded-[2.5rem] hover:border-emerald-600 hover:bg-emerald-50/30 transition-all cursor-pointer group text-center"
                          >
                              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-[2rem] flex items-center justify-center mb-8 mx-auto group-hover:scale-110 transition-transform shadow-inner"><Microscope size={32}/></div>
                              <h4 className="text-lg font-black text-slate-800">AI 智能逆向</h4>
                              <p className="text-xs text-slate-400 mt-2 font-medium">从 PDF/图片/Excel 自动转换</p>
                          </div>
                      </div>
                      <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.xls,.pdf,image/*" onChange={handleFileUpload}/>
                  </div>
              </div>
          )}

          {editingTemplate && (
              <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-[150] flex items-center justify-center p-6">
                   <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-7xl h-[92vh] overflow-hidden flex flex-col border border-white/20">
                      <div className="p-8 bg-white border-b flex justify-between items-center shrink-0">
                          <div className="flex items-center gap-5">
                              <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg"><LayoutGrid size={28}/></div>
                              <div>
                                  <h3 className="text-2xl font-black text-slate-900">{isManualCreate ? '手动定义表单' : 'AI 逆向生单工作台'}</h3>
                                  <div className="flex items-center gap-2 mt-1">
                                      <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase tracking-wider">Draft Mode</span>
                                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">请核对栅格布局与验证规则</p>
                                  </div>
                              </div>
                          </div>
                          <button onClick={() => setEditingTemplate(null)} className="p-3 text-slate-300 hover:text-slate-900 transition-colors"><X size={32}/></button>
                      </div>

                      <div className="flex-1 overflow-hidden flex bg-[#f1f5f9]">
                          {/* Inspector Panel */}
                          <div className="w-96 border-r p-8 space-y-10 bg-white overflow-y-auto shrink-0 custom-scrollbar shadow-2xl relative z-10">
                               <div className="space-y-4">
                                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">基础配置 General</label>
                                   <input value={editingTemplate.title} onChange={e => setEditingTemplate({...editingTemplate, title: e.target.value})} className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold text-sm" placeholder="表单名称"/>
                                   <textarea value={editingTemplate.description} onChange={e => setEditingTemplate({...editingTemplate, description: e.target.value})} className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 text-xs h-20 resize-none font-medium text-slate-500" placeholder="用途描述..."/>
                               </div>

                               <div className="space-y-4">
                                   <div className="flex justify-between items-center px-1">
                                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">字段清单 Fields ({editingTemplate.fields.length})</label>
                                       <button onClick={addField} className="w-8 h-8 flex items-center justify-center bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl transition-all shadow-sm"><ListPlus size={18}/></button>
                                   </div>
                                   <div className="space-y-3">
                                       {editingTemplate.fields.map(f => (
                                           <div 
                                                key={f.id} 
                                                onClick={() => setActiveFieldId(f.id)}
                                                className={`p-5 bg-white border-2 rounded-2xl transition-all relative group cursor-pointer
                                                    ${activeFieldId === f.id ? 'border-indigo-600 shadow-lg' : 'border-slate-50 hover:border-slate-200'}`}
                                            >
                                                <button onClick={(e) => { e.stopPropagation(); setEditingTemplate({...editingTemplate, fields: editingTemplate.fields.filter(x => x.id !== f.id)}); }} className="absolute -top-2 -right-2 w-6 h-6 bg-white shadow-md border rounded-full flex items-center justify-center text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={12}/></button>
                                                <div className="flex items-center gap-3 mb-3">
                                                    <div className="w-6 h-6 bg-slate-100 rounded flex items-center justify-center text-[10px] font-black text-slate-400 uppercase">{f.type.slice(0,1)}</div>
                                                    <input value={f.label} onChange={e => updateField(f.id, {label: e.target.value})} className="text-xs font-bold bg-transparent border-none p-0 focus:ring-0 w-full" placeholder="未命名标题"/>
                                                </div>
                                                
                                                {activeFieldId === f.id && (
                                                    <div className="space-y-3 pt-3 border-t animate-fadeIn">
                                                        <div className="flex gap-2">
                                                            <select value={f.type} onChange={e => updateField(f.id, {type: e.target.value as any})} className="flex-1 text-[10px] p-2 bg-slate-50 border-none rounded-lg font-bold">
                                                                <option value="text">单行文本</option>
                                                                <option value="textarea">多行说明</option>
                                                                <option value="number">数字/金额</option>
                                                                <option value="date">日期选择</option>
                                                                <option value="section">区域标题</option>
                                                            </select>
                                                            <div className="flex items-center gap-2 bg-slate-50 px-3 rounded-lg">
                                                                <span className="text-[10px] font-black text-slate-400">必填</span>
                                                                <input type="checkbox" checked={f.required} onChange={e => updateField(f.id, {required: e.target.checked})} className="rounded text-indigo-600"/>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <div>
                                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">横向跨度 (ColSpan): {f.colSpan} / 24</span>
                                                                <input type="range" min="1" max="24" value={f.colSpan} onChange={e => updateField(f.id, {colSpan: parseInt(e.target.value)})} className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"/>
                                                            </div>
                                                            <div>
                                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">纵向跨度 (RowSpan): {f.rowSpan || 1}</span>
                                                                <input type="range" min="1" max="10" value={f.rowSpan || 1} onChange={e => updateField(f.id, {rowSpan: parseInt(e.target.value)})} className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-emerald-600"/>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <label className="text-[9px] font-black text-slate-400 flex items-center gap-1">
                                                                <input type="checkbox" checked={f.hideLabel} onChange={e => updateField(f.id, {hideLabel: e.target.checked})}/> 隐藏标题
                                                            </label>
                                                            <label className="text-[9px] font-black text-slate-400 flex items-center gap-1">
                                                                <input type="checkbox" checked={f.readOnly} onChange={e => updateField(f.id, {readOnly: e.target.checked})}/> 只读
                                                            </label>
                                                        </div>
                                                        <input value={f.defaultValue || ''} onChange={e => updateField(f.id, {defaultValue: e.target.value})} placeholder="默认值 (Default)" className="w-full text-[10px] p-2 bg-slate-50 border-none rounded-lg font-medium"/>
                                                        <input value={f.helpText || ''} onChange={e => updateField(f.id, {helpText: e.target.value})} placeholder="提示文本 (Help text)" className="w-full text-[10px] p-2 bg-slate-50 border-none rounded-lg font-medium"/>
                                                    </div>
                                                )}
                                           </div>
                                       ))}
                                   </div>
                               </div>
                          </div>

                          {/* Canvas Area */}
                          <div className="flex-1 p-12 overflow-y-auto flex flex-col items-center bg-slate-200/50 custom-scrollbar">
                                <div className="bg-white shadow-2xl p-[20mm] min-h-[1122px] w-full max-w-[850px] rounded relative flex flex-col animate-slideUp">
                                    <div className="text-center mb-16 relative border-b-4 border-slate-900 pb-10">
                                        <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tight">{editingTemplate.title}</h2>
                                        <p className="mt-4 text-[10px] font-bold text-slate-400 uppercase tracking-[0.5em]">{editingTemplate.description}</p>
                                    </div>
                                    {/* CSS Grid for Preview - Supports dense packing for rowspan */}
                                    <div className="grid grid-cols-24 border-t-2 border-l-2 border-slate-900 relative auto-rows-fr" style={{ gridAutoFlow: 'dense' }}>
                                        {editingTemplate.fields.map(f => (
                                            <div 
                                                key={f.id} 
                                                style={{ 
                                                    gridColumn: `span ${f.colSpan || 24}`,
                                                    gridRow: `span ${f.rowSpan || 1}`
                                                }} 
                                                onClick={() => setActiveFieldId(f.id)}
                                                className={`border-r-2 border-b-2 border-slate-900 flex flex-col justify-center transition-all group cursor-pointer
                                                    ${f.type === 'section' ? 'bg-slate-100 py-3' : 'p-4 min-h-[80px] bg-white'}
                                                    ${activeFieldId === f.id ? 'ring-2 ring-inset ring-indigo-600' : 'hover:bg-slate-50'}
                                                `}
                                            >
                                                {f.type === 'section' ? (
                                                    <div className="text-center font-bold text-slate-800 text-sm tracking-widest">{f.label}</div>
                                                ) : (
                                                    <>
                                                        {!f.hideLabel && (
                                                            <div className="flex justify-between items-start mb-2">
                                                                <label className="text-[11px] font-black text-slate-600 uppercase tracking-widest">{f.label} {f.required && <span className="text-red-500">*</span>}</label>
                                                                <span className="text-[9px] font-black text-slate-300 opacity-0 group-hover:opacity-100">EDIT</span>
                                                            </div>
                                                        )}
                                                        <div className={`text-[11px] font-mono italic flex items-center gap-2 ${f.readOnly ? 'text-slate-400' : 'text-slate-300'}`}>
                                                            {f.readOnly ? (
                                                                <span className="font-bold text-slate-800 not-italic">{f.defaultValue || '—'}</span>
                                                            ) : (
                                                                <>
                                                                    <MousePointer2 size={12}/> {f.placeholder || (f.type === 'date' ? 'YYYY-MM-DD' : f.type === 'number' ? '0.00' : 'Awaiting input...')}
                                                                </>
                                                            )}
                                                        </div>
                                                        {f.helpText && <p className="mt-1 text-[9px] text-indigo-400 font-bold">{f.helpText}</p>}
                                                    </>
                                                )}
                                            </div>
                                        ))}
                                        {editingTemplate.fields.length === 0 && (
                                            <div className="col-span-24 py-32 flex flex-col items-center justify-center text-slate-200 border-r-2 border-b-2 border-slate-900">
                                                <MonitorPlay size={64} className="mb-4 opacity-10"/>
                                                <p className="font-black uppercase tracking-widest text-sm">左侧添加字段或开始 AI 逆向</p>
                                            </div>
                                        )}
                                    </div>
                                    <div className="mt-auto pt-16 flex justify-between items-center text-[10px] font-black text-slate-200 border-t border-slate-50 uppercase tracking-[0.5em]">
                                        <span>System Generated Template</span>
                                        <span>FID: {editingTemplate.id}</span>
                                    </div>
                                </div>
                          </div>
                      </div>

                      <div className="p-8 bg-white border-t flex justify-end gap-5 shrink-0">
                          <button onClick={() => setEditingTemplate(null)} className="px-10 py-4 bg-slate-100 text-slate-500 rounded-2xl font-bold hover:bg-slate-200 transition-all">放弃变更</button>
                          <button onClick={saveTemplate} className="px-16 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] hover:bg-indigo-700 shadow-2xl shadow-indigo-100 flex items-center gap-3 active:scale-95 transition-all">
                              <CheckCircle2 size={24}/> 保存并入库
                          </button>
                      </div>
                   </div>
              </div>
          )}

          {selectedTemplate ? (
              <div className="min-h-full py-20 px-6 bg-slate-200/50 flex flex-col items-center">
                  <div className="w-full max-w-[850px] flex justify-between items-center mb-10 no-print">
                      <button onClick={() => setSelectedTemplate(null)} className="flex items-center gap-3 text-slate-900 hover:text-indigo-600 font-black text-xs uppercase tracking-widest transition-all group">
                          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform"/> 返回业务中心
                      </button>
                      <div className="flex gap-2">
                          <button 
                            onClick={() => setIsHandwriting(!isHandwriting)} 
                            className={`p-4 rounded-[2rem] shadow-lg hover:shadow-xl transition-all flex items-center gap-2 font-black text-xs uppercase tracking-widest border ${isHandwriting ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-900 border-slate-100'}`}
                          >
                              <PenTool size={18}/> 模拟手写 {isHandwriting ? 'ON' : 'OFF'}
                          </button>
                          <button onClick={handleDownloadBlankDocx} className="p-4 bg-white text-slate-900 rounded-[2rem] shadow-lg hover:shadow-xl transition-all flex items-center gap-2 font-black text-xs uppercase tracking-widest border border-slate-100">
                              <Download size={18}/> 下载空表 (Word)
                          </button>
                          <button onClick={handleDownloadBlankExcel} className="p-4 bg-white text-slate-900 rounded-[2rem] shadow-lg hover:shadow-xl transition-all flex items-center gap-2 font-black text-xs uppercase tracking-widest border border-slate-100">
                              <FileSpreadsheet size={18}/> 下载空表 (Excel)
                          </button>
                      </div>
                  </div>

                  <form onSubmit={handleSubmit} className="bg-white border shadow-2xl p-[20mm] min-h-[1122px] w-full max-w-[850px] mx-auto rounded relative flex flex-col animate-slideUp">
                       <div className="text-center mb-10 relative pb-6 border-b-2 border-slate-900">
                            <h2 className="text-3xl font-serif font-bold text-slate-900 tracking-wide mb-2">{selectedTemplate.title}</h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.5em]">{selectedTemplate.description}</p>
                       </div>

                       <div className="grid grid-cols-24 border-t border-l border-slate-400 relative z-10 mb-24 shadow-sm bg-white auto-rows-fr" style={{ gridAutoFlow: 'dense' }}>
                           {selectedTemplate.fields.map(field => (
                               <div 
                                    key={field.id} 
                                    style={{ 
                                        gridColumn: `span ${field.colSpan || 24}`,
                                        gridRow: `span ${field.rowSpan || 1}`
                                    }}
                                    className={`border-r border-b border-slate-400 flex flex-col justify-center
                                        ${field.type === 'section' ? 'bg-gray-100 py-3 text-center font-bold text-sm' : 'p-3 min-h-[50px] hover:bg-slate-50 transition-colors'}
                                    `}
                                >
                                   {field.type === 'section' ? (
                                       field.label
                                   ) : (
                                       <>
                                           {!field.hideLabel && (
                                               <label className="block text-[10px] font-bold text-slate-500 mb-1">
                                                   {field.label} {field.required && <span className="text-rose-600 ml-1">*</span>}
                                               </label>
                                           )}
                                           
                                           {field.readOnly ? (
                                               <div className="text-sm font-bold text-slate-800 text-center w-full">{field.defaultValue}</div>
                                           ) : field.type === 'textarea' ? (
                                               <textarea 
                                                  required={field.required} 
                                                  value={formData[field.id] || field.defaultValue || ''} 
                                                  onChange={e => setFormData({...formData, [field.id]: e.target.value})} 
                                                  className={`w-full bg-transparent border-none p-0 focus:ring-0 text-sm text-slate-900 placeholder:text-slate-300 resize-none flex-1 leading-relaxed ${isHandwriting ? 'font-hand text-lg' : 'font-serif'}`}
                                                  placeholder={field.placeholder || "请输入..."}
                                               />
                                           ) : (
                                               <input 
                                                  type={field.type} 
                                                  required={field.required} 
                                                  value={formData[field.id] || field.defaultValue || ''} 
                                                  onChange={e => setFormData({...formData, [field.id]: e.target.value})} 
                                                  className={`w-full bg-transparent border-none p-0 focus:ring-0 text-sm text-slate-900 placeholder:text-slate-300 ${isHandwriting ? 'font-hand text-lg' : 'font-serif'}`}
                                                  placeholder={field.placeholder || "请输入..."}
                                               />
                                           )}
                                       </>
                                   )}
                               </div>
                           ))}
                       </div>

                       <div className="mt-auto flex flex-col items-center gap-6 no-print">
                            <div className="flex items-center gap-3 text-slate-300 font-black text-[10px] uppercase tracking-[0.5em]">
                                <div className="h-px w-10 bg-slate-100"></div>
                                Digital Signature Protocol
                                <div className="h-px w-10 bg-slate-100"></div>
                            </div>
                            <div className="flex gap-4">
                                <button type="button" onClick={handleSaveDraft} className="px-12 py-4 bg-slate-100 text-slate-600 rounded-[2.5rem] font-black uppercase tracking-[0.2em] hover:bg-slate-200 transition-all flex items-center gap-3">
                                    <Save size={20}/> 暂存草稿
                                </button>
                                <button type="submit" className="px-24 py-4 bg-slate-900 text-white rounded-[2.5rem] font-black uppercase tracking-[0.3em] hover:bg-indigo-600 transition-all shadow-[0_20px_50px_rgba(79,70,229,0.3)] flex items-center gap-5 active:scale-95">
                                    <Send size={24}/> 发起审批
                                </button>
                            </div>
                       </div>
                  </form>
              </div>
          ) : activeTab === 'templates' ? (
              <div className="max-w-7xl mx-auto p-16">
                   <div className="flex justify-between items-end mb-16">
                        <div>
                            <h2 className="text-4xl font-black text-slate-900 tracking-tight">业务模板库</h2>
                            <p className="text-slate-400 font-bold text-sm mt-1 uppercase tracking-widest">Form Template Registry</p>
                        </div>
                        <div className="relative">
                            <input 
                                type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                placeholder="检索业务模板..."
                                className="w-80 pl-12 pr-6 py-4 bg-white rounded-3xl border-none shadow-sm focus:ring-2 focus:ring-indigo-500 font-bold text-sm"
                            />
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20}/>
                        </div>
                   </div>
                   
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                        {templates.filter(t => t.title.includes(searchTerm)).map(t => (
                            <div key={t.id} onClick={() => setSelectedTemplate(t)} className="group bg-white p-12 rounded-[4rem] border border-slate-100 shadow-sm hover:shadow-2xl transition-all cursor-pointer flex flex-col min-h-[420px] relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-3 h-full bg-slate-900 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <div className="w-20 h-20 bg-slate-50 text-slate-900 rounded-[2.5rem] flex items-center justify-center mb-10 group-hover:bg-slate-900 group-hover:text-white transition-all shadow-inner">
                                    <FileText size={36}/>
                                </div>
                                <h3 className="text-2xl font-black text-slate-900 mb-4 group-hover:text-indigo-600 transition-colors">{t.title}</h3>
                                <p className="text-xs text-slate-400 font-bold leading-relaxed mb-10 flex-1 line-clamp-3 uppercase tracking-wider">{t.description}</p>
                                <div className="flex items-center justify-between mt-auto">
                                    <span className="text-[10px] font-black bg-slate-100 px-4 py-2 rounded-full text-slate-400 uppercase tracking-widest">{t.category}</span>
                                    <div className="flex gap-2">
                                        {/* Duplicate Button */}
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const copy = { ...t, id: Date.now().toString(), title: t.title + ' (Copy)' };
                                                setTemplates([...templates, copy]);
                                            }}
                                            className="p-3 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all"
                                            title="复制模板"
                                        >
                                            <Copy size={20}/>
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); if(confirm('删除此模板？')) setTemplates(templates.filter(x => x.id !== t.id)); }} className="p-3 text-slate-200 hover:text-rose-600 hover:bg-rose-50 rounded-2xl transition-all"><Trash2 size={20}/></button>
                                    </div>
                                </div>
                            </div>
                        ))}
                        <div 
                            onClick={() => setShowCreateOptions(true)}
                            className="border-4 border-dashed border-slate-100 rounded-[4rem] p-12 flex flex-col items-center justify-center text-center group hover:border-indigo-600 hover:bg-white transition-all cursor-pointer min-h-[420px]"
                        >
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-8 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all"><Plus size={48}/></div>
                            <p className="font-black text-slate-200 group-hover:text-indigo-600 uppercase tracking-[0.3em] text-sm">定义数字化模板</p>
                        </div>
                   </div>
              </div>
          ) : (
              <div className="max-w-6xl mx-auto py-20 px-10 space-y-8">
                  <div className="flex justify-between items-end mb-10">
                       <div>
                           <h2 className="text-4xl font-black text-slate-900 tracking-tight">流水记录 ({submissions.length})</h2>
                           <p className="text-slate-400 font-bold text-sm mt-1 uppercase tracking-widest">Submission History Log</p>
                       </div>
                  </div>
                  {submissions.map(s => (
                      <div key={s.id} onClick={() => setSelectedSubmission(s)} className="bg-white rounded-[3rem] border border-slate-100 p-10 flex items-center justify-between hover:shadow-2xl transition-all group cursor-pointer">
                          <div className="flex items-center gap-10">
                              <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-[2rem] flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition-all">
                                  <FileSignature size={32}/>
                              </div>
                              <div>
                                  <h4 className="font-black text-slate-900 text-2xl group-hover:text-indigo-600 transition-colors">{templates.find(t => t.id === s.templateId)?.title}</h4>
                                  <div className="flex items-center gap-8 mt-3 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                      <span className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-500"/> ID: {s.id}</span>
                                      <span className="flex items-center gap-2"><Clock size={14}/> {new Date(s.submittedAt).toLocaleString()}</span>
                                  </div>
                              </div>
                          </div>
                          <div className="flex items-center gap-10">
                              <span className={`px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-widest border-2 ${s.status === 'pending' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                                  {s.status === 'pending' ? '审批中 Review' : '已归档 Arch'}
                              </span>
                              <ChevronRight className="text-slate-200 group-hover:text-indigo-600 transition-all" size={32}/>
                          </div>
                      </div>
                  ))}
                  {submissions.length === 0 && (
                      <div className="py-64 text-center flex flex-col items-center opacity-10">
                          <MonitorPlay size={100} className="mb-8"/>
                          <p className="font-black text-2xl uppercase tracking-[0.5em]">暂无数字化流程申请</p>
                      </div>
                  )}
              </div>
          )}
      </main>
    </div>
  );
};
