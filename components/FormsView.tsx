
import React, { useState, useEffect, useRef } from 'react';
import { FormTemplate, FormField, FormSubmission, AppSettings } from '../types';
import { 
  FileSignature, Plus, Trash2, FileText, Send, ArrowLeft, Download, 
  Microscope, ChevronRight, Sparkles, Upload, 
  Loader2, Save, X, CheckCircle2, LayoutGrid, FileSpreadsheet, Printer,
  Clock, MousePointer2, ListPlus, Search, Info, Settings, AlertCircle, Eye, MonitorPlay,
  RotateCw, Crop, ScanLine, Table as IconTable, Grid, FileJson, Copy, FileDown, BrainCircuit, Ban, PenTool, Crosshair,
  Layers, Zap, Network, FormInput
} from 'lucide-react';
import { parseFormFromDocument, parseFormFromExcelData, getAIProviderLabel } from '../services/aiService';
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
      { id: 0, label: "图像预处理 (去噪/倾斜校正/二值化)", icon: RotateCw, type: 'preprocessing' },
      { id: 1, label: "高精度边界探测 (Canny/Hough)", icon: Crop, type: 'boundary_detection' },
      { id: 2, label: "手写体/印刷体分离识别 (HTR+OCR)", icon: Layers, type: 'ocr' },
      { id: 3, label: "复杂表格拓扑结构分析", icon: IconTable, type: 'table_topology' },
      { id: 4, label: "语义实体映射 (Key-Value Alignment)", icon: Network, type: 'semantic_mapping' },
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
          if (currentSimStep < 4) {
              currentSimStep++;
              setScanStep(currentSimStep);
          }
      }, 1500);

      try {
          if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
              const data = await file.arrayBuffer();
              if (mobileStepTimerRef.current) clearInterval(mobileStepTimerRef.current);
              setScanStep(3); 
              
              const { read, utils } = (window as any).XLSX;
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
                      await new Promise(r => setTimeout(r, 6000)); 
                      if (mobileStepTimerRef.current) clearInterval(mobileStepTimerRef.current);
                      
                      setScanStep(4); // Semantic mapping
                      
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
      // Immediately save for now, or could show editor
      const newTemplate = {
          id: `T${Date.now().toString().slice(-4)}`,
          title: result.title || "数字化导入表单",
          description: result.description || `由 AI 从 ${source} 逆向生成`,
          category: 'Admin',
          fields: (result.fields || []).map((f: any) => ({ ...f, id: f.id || Math.random().toString(36).slice(2, 7) })),
          createdAt: Date.now()
      } as FormTemplate;
      setTemplates([newTemplate, ...templates]);
      alert("AI 表单模版生成成功！");
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

  const generateDocxRowsStrict = (template: FormTemplate, submissionData?: Record<string, string>): TableRow[] => {
      const borderStyle = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
      const rows: TableRow[] = [];
      
      let currentCells: TableCell[] = [];
      let currentWidth = 0;

      template.fields.forEach((field) => {
          const colSpan = field.colSpan || 24;
          const widthPercent = (colSpan / 24) * 100;
          
          let text = field.label;
          if (submissionData && submissionData[field.id]) {
              text += `: ${submissionData[field.id]}`;
          }

          currentCells.push(new TableCell({
              width: { size: widthPercent, type: WidthType.PERCENTAGE },
              children: [new Paragraph({ children: [new TextRun({ text, font: "SimSun" })] })],
              borders: { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle },
          }));
          
          currentWidth += colSpan;
          if (currentWidth >= 24) {
              rows.push(new TableRow({ children: currentCells }));
              currentCells = [];
              currentWidth = 0;
          }
      });
      
      if (currentCells.length > 0) {
          rows.push(new TableRow({ children: currentCells }));
      }
      
      return rows;
  };

  const handleExportDocx = async (template: FormTemplate, submission?: FormSubmission) => {
       try {
           const rows = generateDocxRowsStrict(template, submission?.data);
           const doc = new Document({
               sections: [{
                   children: [
                       new Paragraph({ text: template.title, heading: "Heading1", alignment: AlignmentType.CENTER }),
                       new Paragraph({ text: template.description, alignment: AlignmentType.CENTER }),
                       new Table({
                           rows: rows,
                           width: { size: 100, type: WidthType.PERCENTAGE },
                           layout: TableLayoutType.FIXED
                       })
                   ]
               }]
           });
           const blob = await Packer.toBlob(doc);
           saveAs(blob, `${template.title}.docx`);
       } catch (e) {
           console.error(e);
           alert("导出失败");
       }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-hidden">
        <header className="bg-white border-b px-8 py-4 flex justify-between items-center shrink-0">
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><FormInput/> 电子表单中心</h1>
            <div className="flex gap-2">
                 <button onClick={() => setShowCreateOptions(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg flex items-center gap-2 text-sm font-bold"><Plus size={16}/> 新建表单</button>
            </div>
        </header>

        <div className="flex-1 overflow-auto p-8">
            {/* Template List */}
            {!selectedTemplate && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {templates.map(t => (
                        <div key={t.id} onClick={() => setSelectedTemplate(t)} className="bg-white p-6 rounded-xl shadow-sm border hover:shadow-md cursor-pointer transition-all hover:border-indigo-300">
                             <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center mb-4"><FileText size={20}/></div>
                             <h3 className="font-bold text-gray-900 mb-1">{t.title}</h3>
                             <p className="text-sm text-gray-500 line-clamp-2">{t.description}</p>
                             <div className="mt-4 flex justify-between items-center text-xs text-gray-400">
                                 <span>{t.fields.length} 个字段</span>
                                 <span className="font-mono">{new Date(t.createdAt).toLocaleDateString()}</span>
                             </div>
                        </div>
                    ))}
                    {templates.length === 0 && (
                        <div className="col-span-full py-20 text-center text-gray-400">
                            <FileSignature size={48} className="mx-auto mb-4 opacity-20"/>
                            <p>暂无表单模版，点击右上角新建</p>
                        </div>
                    )}
                </div>
            )}

            {/* Form View / Submission View */}
            {selectedTemplate && (
                <div className="max-w-4xl mx-auto bg-white p-10 rounded-2xl shadow-sm border min-h-full">
                    <button onClick={() => setSelectedTemplate(null)} className="mb-6 flex items-center gap-2 text-gray-500 hover:text-indigo-600"><ArrowLeft size={18}/> 返回列表</button>
                    
                    <div className="text-center mb-10">
                        <h2 className="text-3xl font-bold text-gray-900 mb-2">{selectedTemplate.title}</h2>
                        <p className="text-gray-500">{selectedTemplate.description}</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-24 gap-4">
                            {selectedTemplate.fields.map(field => (
                                <div key={field.id} className="flex flex-col" style={{ gridColumn: `span ${field.colSpan || 24} / span ${field.colSpan || 24}` }}>
                                    {!field.hideLabel && <label className="text-sm font-bold text-gray-700 mb-1.5">{field.label} {field.required && <span className="text-red-500">*</span>}</label>}
                                    {field.type === 'textarea' ? (
                                        <textarea 
                                            value={formData[field.id] || ''} 
                                            onChange={e => setFormData({...formData, [field.id]: e.target.value})} 
                                            className="p-3 border rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none h-24"
                                        />
                                    ) : (
                                        <input 
                                            type={field.type} 
                                            value={formData[field.id] || ''}
                                            onChange={e => setFormData({...formData, [field.id]: e.target.value})}
                                            className="p-3 border rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                        
                        <div className="flex gap-4 pt-8 border-t">
                            <button type="button" onClick={() => handleExportDocx(selectedTemplate)} className="px-6 py-3 bg-white border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-50 flex items-center gap-2"><Download size={18}/> 导出 Word</button>
                            <div className="flex-1"></div>
                            <button type="button" onClick={handleSaveDraft} className="px-6 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200">存为草稿</button>
                            <button type="submit" className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200">提交表单</button>
                        </div>
                    </form>
                </div>
            )}
        </div>

        {/* Create Options Modal */}
        {showCreateOptions && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full relative">
                    <button onClick={() => setShowCreateOptions(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X/></button>
                    <h3 className="text-xl font-bold mb-6">新建表单模版</h3>
                    <div className="space-y-4">
                        <button onClick={() => { setIsManualCreate(true); setShowCreateOptions(false); }} className="w-full p-4 border rounded-xl hover:border-indigo-500 hover:bg-indigo-50 flex items-center gap-4 transition-all">
                             <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center"><PenTool size={20}/></div>
                             <div className="text-left">
                                 <h4 className="font-bold text-gray-900">空白创建</h4>
                                 <p className="text-xs text-gray-500">手动设计表单字段与布局</p>
                             </div>
                        </button>
                        <label className="w-full p-4 border rounded-xl hover:border-indigo-500 hover:bg-indigo-50 flex items-center gap-4 transition-all cursor-pointer">
                             <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center"><ScanLine size={20}/></div>
                             <div className="text-left flex-1">
                                 <h4 className="font-bold text-gray-900">AI 智能识别 (PDF/图片/Excel)</h4>
                                 <p className="text-xs text-gray-500">上传已有文件，自动生成模版</p>
                             </div>
                             <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*,.pdf,.xlsx,.xls"/>
                        </label>
                    </div>
                </div>
            </div>
        )}

        {/* Scanning Overlay */}
        {isScanning && (
            <div className="fixed inset-0 bg-slate-900/95 z-[60] flex flex-col items-center justify-center text-white">
                <div className="mb-8 relative">
                    <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-20 animate-pulse rounded-full"></div>
                    <Loader2 size={64} className="animate-spin text-indigo-500 relative z-10"/>
                </div>
                <h2 className="text-2xl font-bold mb-2">正在进行 AI 结构化分析</h2>
                <div className="text-center mb-8 text-indigo-300 font-mono text-sm">
                    {scanSteps.find(s => s.id === scanStep)?.label || "正在处理..."}
                </div>
                <div className="w-64 h-1 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 animate-progress" style={{ width: `${(scanStep + 1) * 20}%` }}></div>
                </div>
                <button onClick={cancelScanning} className="mt-8 text-sm text-gray-500 hover:text-white underline">取消任务</button>
            </div>
        )}
    </div>
  );
};
