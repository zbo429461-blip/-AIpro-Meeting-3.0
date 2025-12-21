
import React, { useState, useEffect, useRef } from 'react';
import { FormTemplate, FormField, FormSubmission, AppSettings } from '../types';
import { 
  FileSignature, Plus, Trash2, FileText, Send, ArrowLeft, Download, 
  ShieldCheck, Microscope, ChevronRight, Sparkles, Upload, 
  Loader2, Save, MoreHorizontal, AlertCircle, Edit3, X, 
  CheckCircle2, LayoutGrid, Rows, GripHorizontal, FileSpreadsheet, Eye, Printer, Copy,
  Clock, FileType, MousePointer2, Settings, ListPlus, CheckSquare, Search
} from 'lucide-react';
import { parseFormFromDocument, parseFormFromExcelData } from '../services/aiService';
import { utils, read, writeFile } from 'https://esm.sh/xlsx@0.18.5';

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
  const [searchTerm, setSearchTerm] = useState('');
  
  // Builder State
  const [showCreateOptions, setShowCreateOptions] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<FormTemplate | null>(null);
  const [isManualCreate, setIsManualCreate] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedSubs = localStorage.getItem('app_form_submissions');
    if (savedSubs) try { setSubmissions(JSON.parse(savedSubs)); } catch (e) {}
    
    const savedTemps = localStorage.getItem('app_form_templates');
    if (savedTemps) {
        try { setTemplates(JSON.parse(savedTemps)); } catch (e) {}
    } else {
        setTemplates([]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('app_form_submissions', JSON.stringify(submissions));
    localStorage.setItem('app_form_templates', JSON.stringify(templates));
  }, [submissions, templates]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      setIsScanning(true);
      setShowCreateOptions(false);

      try {
          if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
              const data = await file.arrayBuffer();
              const workbook = read(data);
              const sheetName = workbook.SheetNames[0];
              const jsonData = utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 }) as any[][];
              const result = await parseFormFromExcelData(jsonData, settings);
              openEditorWithResult(result, "EXCEL_FILE");
          } else if (file.name.endsWith('.docx') || file.name.endsWith('.doc')) {
              // Word docs are binary and Gemini doesn't support them in inlineData
              alert("AI 暂时无法直接扫描 Word 文件的排版结构。请将文件“另存为 PDF”或截图后再上传，以获得最佳识别效果。");
              setIsScanning(false);
          } else {
              // PDF, Images handled multimodal by AI
              const reader = new FileReader();
              reader.readAsDataURL(file);
              reader.onload = async () => {
                  try {
                      const base64Content = (reader.result as string).split(',')[1];
                      const result = await parseFormFromDocument(base64Content, file.type, settings);
                      openEditorWithResult(result, file.name.toUpperCase());
                  } catch (parseError: any) {
                      console.error(parseError);
                      alert(parseError.message || "AI 识别失败，请尝试使用更清晰的文件或手动创建。");
                  } finally {
                      setIsScanning(false);
                  }
              };
              reader.onerror = () => {
                  alert("文件读取失败");
                  setIsScanning(false);
              };
          }
      } catch (err: any) { 
          console.error(err);
          alert(err.message || "处理文件时出错"); 
          setIsScanning(false);
      }
      e.target.value = '';
  };

  const openEditorWithResult = (result: any, source: string) => {
      setEditingTemplate({
          id: `T${Date.now().toString().slice(-4)}`,
          title: result.title || "未命名导入表单",
          description: result.description || `从 ${source} 智能识别生成`,
          category: 'Admin',
          fields: (result.fields || []).map((f: any) => ({ 
              ...f, 
              id: f.id || Math.random().toString(36).slice(2, 7),
              colSpan: f.colSpan || 24 
          })),
          createdAt: Date.now()
      });
      setIsScanning(false);
  };

  const handleStartManualCreate = () => {
      setEditingTemplate({
          id: `M${Date.now().toString().slice(-4)}`,
          title: "新业务审批单",
          description: "自定义业务流程表单",
          category: 'Admin',
          fields: [
              { id: 'f1', label: '经办人', type: 'text', colSpan: 12, required: true },
              { id: 'f2', label: '申请日期', type: 'date', colSpan: 12, required: true },
              { id: 'f3', label: '申请事由', type: 'textarea', colSpan: 24, required: true }
          ],
          createdAt: Date.now()
      });
      setIsManualCreate(true);
      setShowCreateOptions(false);
  };

  const addField = () => {
      if (!editingTemplate) return;
      const newField: FormField = {
          id: Math.random().toString(36).slice(2, 7),
          label: '新字段',
          type: 'text',
          colSpan: 24,
          required: false
      };
      setEditingTemplate({ ...editingTemplate, fields: [...editingTemplate.fields, newField] });
  };

  const removeField = (id: string) => {
      if (!editingTemplate) return;
      setEditingTemplate({ ...editingTemplate, fields: editingTemplate.fields.filter(f => f.id !== id) });
  };

  const updateField = (id: string, updates: Partial<FormField>) => {
      if (!editingTemplate) return;
      setEditingTemplate({
          ...editingTemplate,
          fields: editingTemplate.fields.map(f => f.id === id ? { ...f, ...updates } : f)
      });
  };

  const saveTemplate = () => {
      if (!editingTemplate) return;
      setTemplates([editingTemplate, ...templates]);
      setEditingTemplate(null);
      setIsManualCreate(false);
      alert("业务模板已保存入库！");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate) return;
    const newSubmission: FormSubmission = {
      id: `S${Date.now().toString().slice(-6)}`,
      templateId: selectedTemplate.id,
      data: { ...formData },
      submittedAt: Date.now(),
      status: 'pending',
      history: [{ status: '已发起', time: Date.now(), note: '业务人员提交申请' }]
    };
    setSubmissions([newSubmission, ...submissions]);
    setSelectedTemplate(null);
    setFormData({});
    alert("申请已成功提交！");
  };

  const exportToExcel = (submission: FormSubmission) => {
      const template = templates.find(t => t.id === submission.templateId);
      if (!template) return;
      const data = [
          ["字段名称", "填写内容"],
          ...template.fields.map(f => [f.label, submission.data[f.id] || ""])
      ];
      const ws = utils.aoa_to_sheet(data);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, "申请详情");
      writeFile(wb, `${template.title}_${submission.id}.xlsx`);
  };

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] overflow-hidden font-sans">
      <header className="bg-white border-b h-16 flex items-center justify-between px-8 shrink-0 shadow-sm z-50">
           <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600 rounded-lg text-white">
                    <FileSignature size={20}/>
                </div>
                <h1 className="text-lg font-black text-slate-900 tracking-tight">电子表单中心 Pro</h1>
           </div>
           <div className="flex items-center gap-6">
                <nav className="flex p-1 bg-slate-100 rounded-xl">
                    <button onClick={() => { setActiveTab('templates'); setSelectedTemplate(null); setSelectedSubmission(null); }} className={`px-5 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'templates' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>业务模板库</button>
                    <button onClick={() => { setActiveTab('submissions'); setSelectedTemplate(null); setSelectedSubmission(null); }} className={`px-5 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'submissions' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>我的申请单</button>
                </nav>
                <div className="h-6 w-px bg-slate-200"></div>
                <button 
                    onClick={() => setShowCreateOptions(true)}
                    className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-95"
                >
                    <Plus size={16}/> 定义业务模板
                </button>
           </div>
      </header>

      <main className="flex-1 overflow-y-auto custom-scrollbar relative">
          
          {/* Create Modal */}
          {showCreateOptions && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-fadeIn">
                  <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-slideUp">
                      <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
                          <h3 className="text-xl font-bold flex items-center gap-2"><Sparkles className="text-indigo-400"/> 选择创建方式</h3>
                          <button onClick={() => setShowCreateOptions(false)} className="text-slate-400 hover:text-white"><X/></button>
                      </div>
                      <div className="p-10 grid grid-cols-2 gap-8">
                          <div 
                            onClick={handleStartManualCreate}
                            className="p-8 border-2 border-slate-100 rounded-3xl hover:border-indigo-500 hover:bg-indigo-50 transition-all cursor-pointer group"
                          >
                              <div className="w-14 h-14 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"><Edit3/></div>
                              <h4 className="text-lg font-bold text-slate-800 mb-2">手动可视化设计</h4>
                              <p className="text-xs text-slate-400 leading-relaxed">自由编排字段，完全自定义业务表单结构。</p>
                          </div>
                          <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="p-8 border-2 border-slate-100 rounded-3xl hover:border-purple-500 hover:bg-purple-50 transition-all cursor-pointer group"
                          >
                              <div className="w-14 h-14 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"><Microscope/></div>
                              <h4 className="text-lg font-bold text-slate-800 mb-2">AI 智能导入生单</h4>
                              <p className="text-xs text-slate-400 leading-relaxed">支持 Excel, Word, PDF 或照片，AI 自动还原表单栅格。</p>
                          </div>
                      </div>
                      <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.xls,.pdf,.doc,.docx,image/*" onChange={handleFileUpload}/>
                  </div>
              </div>
          )}

          {/* Template Builder / Editor */}
          {editingTemplate && (
              <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-[150] flex items-center justify-center p-6">
                   <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-7xl h-[90vh] overflow-hidden flex flex-col border border-white/20">
                      <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                          <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center"><LayoutGrid size={24}/></div>
                              <div>
                                  <h3 className="text-2xl font-black">{isManualCreate ? '手动定义模板' : 'AI 扫描生单预览'}</h3>
                                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">请核对 24 栅格字段布局及类型</p>
                              </div>
                          </div>
                          <button onClick={() => { setEditingTemplate(null); setIsManualCreate(false); }} className="text-white/40 hover:text-white transition-colors"><X size={28}/></button>
                      </div>

                      <div className="flex-1 overflow-hidden flex bg-[#f8fafc]">
                          {/* Left: Inspector */}
                          <div className="w-80 border-r p-6 space-y-8 bg-white overflow-y-auto shrink-0 custom-scrollbar">
                               <div className="space-y-4">
                                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">模板基础信息</label>
                                   <input value={editingTemplate.title} onChange={e => setEditingTemplate({...editingTemplate, title: e.target.value})} className="w-full p-4 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 font-bold text-sm" placeholder="表单名称"/>
                                   <textarea value={editingTemplate.description} onChange={e => setEditingTemplate({...editingTemplate, description: e.target.value})} className="w-full p-4 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 text-xs h-20 resize-none" placeholder="描述信息"/>
                               </div>
                               <div className="space-y-4">
                                   <div className="flex justify-between items-center">
                                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">字段控制面板</label>
                                       <button onClick={addField} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><ListPlus size={18}/></button>
                                   </div>
                                   <div className="space-y-3">
                                       {editingTemplate.fields.map(f => (
                                           <div key={f.id} className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-3 relative group">
                                                <button onClick={() => removeField(f.id)} className="absolute top-2 right-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14}/></button>
                                                <input value={f.label} onChange={e => updateField(f.id, {label: e.target.value})} className="text-xs font-bold bg-transparent border-none p-0 focus:ring-0 w-full mb-1" />
                                                <div className="flex items-center gap-3">
                                                    <select value={f.type} onChange={e => updateField(f.id, {type: e.target.value as any})} className="text-[10px] p-1.5 border rounded bg-slate-50 border-transparent w-24">
                                                        <option value="text">单行</option>
                                                        <option value="textarea">多行</option>
                                                        <option value="date">日期</option>
                                                        <option value="number">金额</option>
                                                    </select>
                                                    <div className="flex-1 flex items-center gap-2">
                                                        <span className="text-[9px] text-slate-400">宽:{f.colSpan}</span>
                                                        <input type="range" min="1" max="24" value={f.colSpan} onChange={e => updateField(f.id, {colSpan: parseInt(e.target.value)})} className="flex-1 h-1 bg-slate-100 appearance-none rounded-full" />
                                                    </div>
                                                </div>
                                           </div>
                                       ))}
                                   </div>
                               </div>
                          </div>

                          {/* Right: A4 Canvas Preview */}
                          <div className="flex-1 p-12 overflow-y-auto flex flex-col items-center bg-slate-200/50 custom-scrollbar">
                                <div className="bg-white border shadow-2xl p-16 min-h-[1122px] w-full max-w-[850px] rounded relative flex flex-col transition-all">
                                    <div className="text-center mb-16 relative z-10 border-b-4 border-slate-900 pb-8">
                                        <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter">{editingTemplate.title}</h2>
                                        <p className="mt-4 text-xs font-bold text-slate-400 uppercase tracking-[0.3em]">{editingTemplate.description}</p>
                                    </div>
                                    <div className="grid grid-cols-24 border-t-2 border-l-2 border-slate-900 relative z-10">
                                        {editingTemplate.fields.map(f => (
                                            <div key={f.id} style={{ gridColumn: `span ${f.colSpan}` }} className="border-r-2 border-b-2 border-slate-900 p-5 min-h-[100px] flex flex-col justify-between bg-white hover:bg-indigo-50/20 transition-all cursor-default">
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{f.label}</label>
                                                <div className="text-[11px] text-slate-300 font-mono italic flex items-center gap-2">
                                                    <MousePointer2 size={12}/> {f.type === 'date' ? '选择日期' : f.type === 'number' ? '0.00' : '等待输入...'}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-auto pt-16 flex justify-between items-center text-[10px] font-black text-slate-200 border-t border-slate-50 uppercase tracking-[0.5em]">
                                        <span>Electronic Form Digitized System</span>
                                        <span>Template: {editingTemplate.id}</span>
                                    </div>
                                </div>
                          </div>
                      </div>

                      <div className="p-8 bg-white border-t flex justify-end gap-4 shrink-0">
                          <button onClick={() => { setEditingTemplate(null); setIsManualCreate(false); }} className="px-8 py-4 bg-slate-100 text-slate-500 rounded-2xl font-bold hover:bg-slate-200 transition-all">放弃修改</button>
                          <button onClick={saveTemplate} className="px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-100 flex items-center gap-2 active:scale-95 transition-all">
                              <CheckCircle2 size={20}/> 保存并入库
                          </button>
                      </div>
                   </div>
              </div>
          )}

          {isScanning && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center">
                  <div className="bg-white p-12 rounded-[3rem] shadow-2xl flex flex-col items-center gap-6 animate-pulse">
                      <div className="relative">
                          <Loader2 className="animate-spin text-indigo-600" size={64}/>
                          <Sparkles className="absolute -top-2 -right-2 text-purple-500" size={24}/>
                      </div>
                      <div className="text-center">
                          <h3 className="text-2xl font-black text-slate-900">AI 智能引擎深度解析中</h3>
                          <p className="text-slate-400 mt-2 font-medium">识别表格栅格、提取标题、推断输入项属性...</p>
                      </div>
                  </div>
              </div>
          )}

          {/* Submission Detail Modal */}
          {selectedSubmission && (
              <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-6 overflow-y-auto">
                   <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-5xl my-auto animate-slideUp overflow-hidden flex flex-col max-h-[95vh]">
                        <div className="p-8 border-b bg-white flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900">申请详情: {selectedSubmission.id}</h3>
                                <p className="text-sm text-slate-400">提交于 {new Date(selectedSubmission.submittedAt).toLocaleString()}</p>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => exportToExcel(selectedSubmission)} className="p-3 text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50"><FileSpreadsheet size={20}/></button>
                                <button onClick={() => setSelectedSubmission(null)} className="p-3 text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50"><X size={20}/></button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-12 custom-scrollbar bg-slate-50">
                             <div className="bg-white border shadow-xl p-16 max-w-[800px] mx-auto min-h-[800px] rounded">
                                 <div className="text-center mb-12 border-b-2 border-slate-200 pb-6">
                                     <h2 className="text-3xl font-black text-slate-800">{templates.find(t => t.id === selectedSubmission.templateId)?.title}</h2>
                                 </div>
                                 <div className="grid grid-cols-24 border-t-2 border-l-2 border-slate-800">
                                     {templates.find(t => t.id === selectedSubmission.templateId)?.fields.map(f => (
                                         <div key={f.id} style={{ gridColumn: `span ${f.colSpan}` }} className="border-r-2 border-b-2 border-slate-800 p-4 min-h-[80px]">
                                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">{f.label}</label>
                                             <div className="text-sm font-bold text-slate-900">{selectedSubmission.data[f.id] || " (未填写) "}</div>
                                         </div>
                                     ))}
                                 </div>
                                 <div className="mt-16 flex justify-around">
                                      <div className="text-center">
                                          <div className="h-1 bg-slate-100 w-32 mx-auto mb-2"></div>
                                          <p className="text-[10px] font-bold text-slate-300">签字/签章</p>
                                      </div>
                                      <div className="text-center">
                                          <div className="h-1 bg-slate-100 w-32 mx-auto mb-2"></div>
                                          <p className="text-[10px] font-bold text-slate-300">审批意见</p>
                                      </div>
                                 </div>
                             </div>
                        </div>
                   </div>
              </div>
          )}

          {/* Form Filling View */}
          {selectedTemplate ? (
              <div className="min-h-full py-12 px-6 bg-slate-200/50 flex flex-col items-center">
                  <div className="w-full max-w-5xl flex justify-between items-center mb-8 no-print">
                      <button onClick={() => setSelectedTemplate(null)} className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-black text-xs uppercase tracking-widest transition-all">
                          <ArrowLeft size={18}/> 返回列表
                      </button>
                      <div className="flex gap-3">
                          <button onClick={() => window.print()} className="p-3 bg-white text-slate-600 rounded-2xl border border-slate-200 shadow-sm hover:text-indigo-600 hover:border-indigo-100 transition-all"><Printer size={20}/></button>
                      </div>
                  </div>

                  <form onSubmit={handleSubmit} className="bg-white border shadow-2xl p-[30mm] min-h-[1122px] w-full max-w-[850px] mx-auto rounded-sm relative flex flex-col animate-slideUp">
                       <div className="text-center mb-16 relative z-10 border-b-4 border-slate-900 pb-6">
                            <h2 className="text-4xl font-black text-slate-900 tracking-tight mb-4">{selectedTemplate.title}</h2>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.3em]">{selectedTemplate.description}</p>
                       </div>

                       <div className="grid grid-cols-24 border-t-2 border-l-2 border-slate-900 relative z-10 mb-20 shadow-lg">
                           {selectedTemplate.fields.map(field => (
                               <div 
                                    key={field.id} 
                                    style={{ gridColumn: `span ${field.colSpan || 24}` }}
                                    className="border-r-2 border-b-2 border-slate-900 p-5 flex flex-col min-h-[100px] hover:bg-slate-50 transition-colors"
                                >
                                   <label className="block text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest">
                                       {field.label} {field.required && <span className="text-red-500">*</span>}
                                   </label>
                                   {field.type === 'textarea' ? (
                                       <textarea 
                                          required={field.required} 
                                          value={formData[field.id] || ''} 
                                          onChange={e => setFormData({...formData, [field.id]: e.target.value})} 
                                          className="w-full bg-transparent border-none p-0 focus:ring-0 text-sm font-bold text-slate-800 placeholder:text-slate-200 resize-none h-24"
                                          placeholder="点击填写详情..."
                                       />
                                   ) : (
                                       <input 
                                          type={field.type} 
                                          required={field.required} 
                                          value={formData[field.id] || ''} 
                                          onChange={e => setFormData({...formData, [field.id]: e.target.value})} 
                                          className="w-full bg-transparent border-none p-0 focus:ring-0 text-sm font-bold text-slate-800 placeholder:text-slate-200"
                                          placeholder="点击填写..."
                                       />
                                   )}
                               </div>
                           ))}
                       </div>

                       <div className="mt-20 flex justify-center no-print">
                            <button type="submit" className="px-20 py-5 bg-slate-900 text-white rounded-3xl font-black uppercase tracking-[0.2em] hover:bg-indigo-600 transition-all shadow-2xl flex items-center gap-4 active:scale-95">
                                <Send size={24}/> 发起数字化审批
                            </button>
                       </div>
                  </form>
              </div>
          ) : activeTab === 'templates' ? (
              <div className="max-w-7xl mx-auto p-12">
                   <div className="relative mb-12">
                        <input 
                            type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                            placeholder="搜索业务模板..."
                            className="w-full max-w-md pl-12 pr-4 py-4 bg-white rounded-2xl border-none shadow-sm focus:ring-2 focus:ring-indigo-500"
                        />
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20}/>
                   </div>
                   
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {templates.filter(t => t.title.includes(searchTerm)).map(t => (
                            <div key={t.id} onClick={() => setSelectedTemplate(t)} className="group bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm hover:shadow-2xl transition-all cursor-pointer flex flex-col min-h-[360px] relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-2 h-full bg-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                                    <FileText size={32}/>
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 mb-3">{t.title}</h3>
                                <p className="text-xs text-slate-400 font-medium leading-relaxed mb-10 flex-1 line-clamp-3">{t.description}</p>
                                <div className="flex items-center justify-between mt-auto">
                                    <span className="text-[10px] font-black bg-slate-50 px-3 py-1.5 rounded-full text-slate-400 uppercase tracking-widest border border-slate-100">{t.category}</span>
                                    <button onClick={(e) => { e.stopPropagation(); setTemplates(templates.filter(x => x.id !== t.id)); }} className="p-2 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={16}/></button>
                                </div>
                            </div>
                        ))}
                        <div 
                            onClick={() => setShowCreateOptions(true)}
                            className="border-2 border-dashed border-slate-200 rounded-[3rem] p-10 flex flex-col items-center justify-center text-center group hover:border-indigo-500 hover:bg-white transition-all cursor-pointer min-h-[360px]"
                        >
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-6 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors"><Plus size={32}/></div>
                            <p className="font-black text-slate-300 group-hover:text-indigo-600 uppercase tracking-[0.2em] text-xs">定义新业务模板</p>
                        </div>
                   </div>
              </div>
          ) : (
              <div className="max-w-5xl mx-auto py-16 space-y-6 px-6">
                  <div className="flex justify-between items-center mb-8">
                       <h2 className="text-2xl font-black text-slate-900">流程记录 ({submissions.length})</h2>
                  </div>
                  {submissions.map(s => (
                      <div key={s.id} onClick={() => setSelectedSubmission(s)} className="bg-white rounded-3xl border border-slate-100 p-8 flex items-center justify-between hover:shadow-xl transition-all group cursor-pointer">
                          <div className="flex items-center gap-6">
                              <div className="w-14 h-14 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all">
                                  <FileText size={24}/>
                              </div>
                              <div>
                                  <h4 className="font-bold text-slate-900 text-lg">{templates.find(t => t.id === s.templateId)?.title}</h4>
                                  <div className="flex items-center gap-4 mt-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                      <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-emerald-500"/> ID: {s.id}</span>
                                      <span className="flex items-center gap-1"><Clock size={12}/> {new Date(s.submittedAt).toLocaleString()}</span>
                                  </div>
                              </div>
                          </div>
                          <div className="flex items-center gap-4">
                              <span className={`px-5 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${s.status === 'pending' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                                  {s.status === 'pending' ? '待审核' : '已归档'}
                              </span>
                              <ChevronRight className="text-slate-300 group-hover:text-indigo-600 transition-all"/>
                          </div>
                      </div>
                  ))}
                  {submissions.length === 0 && (
                      <div className="py-48 text-center flex flex-col items-center opacity-20">
                          <Send size={64} className="mb-6"/>
                          <p className="font-black text-xs uppercase tracking-[0.5em]">暂无业务申请记录</p>
                      </div>
                  )}
              </div>
          )}
      </main>
    </div>
  );
};
