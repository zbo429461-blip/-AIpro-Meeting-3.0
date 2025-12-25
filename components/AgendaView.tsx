
import React, { useState, useRef, useEffect } from 'react';
import { AgendaItem, AppSettings, MeetingBasicInfo, Participant } from '../types';
import { formatNameForAgenda } from '../utils';
import { generateAgenda, getAIProviderLabel } from '../services/aiService';
import { Wand2, Calendar, Clock, MapPin, User, Loader2, FileText, Eye, Edit2, Plus, Trash2, Settings2, PanelLeftClose, PanelLeftOpen, ChevronLeft, ChevronRight, ArrowLeftRight, Ruler, Download, Printer, LayoutTemplate, AlignJustify, ZoomIn, ZoomOut } from 'lucide-react';
import { Document, Packer, Paragraph, Table, TableCell, TableRow, WidthType, TextRun, AlignmentType, BorderStyle, TableLayoutType } from 'docx';
import saveAs from 'file-saver';

interface AgendaViewProps {
  agenda: AgendaItem[];
  setAgenda: (items: AgendaItem[]) => void;
  settings: AppSettings;
  participants: Participant[]; 
  setParticipants: React.Dispatch<React.SetStateAction<Participant[]>>;
  meetingInfo: MeetingBasicInfo;
  setMeetingInfo: (info: MeetingBasicInfo) => void;
}

// Helper Component for ContentEditable Div
const EditableDiv = ({ value, onChange, style, className, placeholder }: { value: string, onChange: (val: string) => void, style?: React.CSSProperties, className?: string, placeholder?: string }) => {
    const ref = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        if (ref.current && ref.current.innerText !== value && document.activeElement !== ref.current) {
            ref.current.innerText = value || '';
        }
    }, [value]);

    return (
        <div
            ref={ref}
            contentEditable
            className={`outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-gray-300 ${className}`}
            style={{ 
                whiteSpace: 'pre-wrap', 
                wordBreak: 'break-word', 
                minHeight: '1.5em',
                cursor: 'text',
                ...style 
            }}
            data-placeholder={placeholder}
            onBlur={(e) => onChange(e.currentTarget.innerText)}
            suppressContentEditableWarning
        >
            {value}
        </div>
    );
};

export const AgendaView: React.FC<AgendaViewProps> = ({ agenda, setAgenda, settings, participants, setParticipants, meetingInfo, setMeetingInfo }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('preview');
  const [showConfig, setShowConfig] = useState(true); 
  const aiProviderLabel = getAIProviderLabel(settings);
  
  // Layout Config (mm) - Ensure numbers
  const nameTabStop = Number(meetingInfo.nameTabStop ?? 15);
  const unitTabStop = Number(meetingInfo.unitTabStop ?? 20); 
  
  // Calculate Gap for 3-column layout
  const gapMM = Math.max(0, unitTabStop - nameTabStop);

  const meetingInfoRef = useRef(meetingInfo);
  useEffect(() => {
      meetingInfoRef.current = meetingInfo;
  }, [meetingInfo]);

  const [exportFont, setExportFont] = useState('SimSun');
  const [h1Size, setH1Size] = useState(22);
  const [h2Size, setH2Size] = useState(16);
  const [bodySize, setBodySize] = useState(12);
  const [lineHeight, setLineHeight] = useState(1.6); // New state for line spacing
  
  // Scale State for Preview
  const [scale, setScale] = useState(0.85);

  const rulerRef = useRef<HTMLDivElement>(null);
  const dragTarget = useRef<'name' | 'unit' | null>(null);

  // A4 Print Width reference
  const PRINT_WIDTH_MM = 170; // 210mm - margins (20mm * 2)

  const handleAiGenerate = async () => {
    if (!meetingInfo.topic) return alert("请输入会议主题");
    setIsGenerating(true);
    try {
        const newItems = await generateAgenda(meetingInfo.topic, meetingInfo.date, settings);
        setAgenda(newItems);
    } catch (e) {
        alert(`使用 ${aiProviderLabel} 生成失败，请检查设置。`);
    } finally {
        setIsGenerating(false);
    }
  };

  const updateAgendaItem = (id: string, field: keyof AgendaItem, val: string) => {
      setAgenda(agenda.map(item => item.id === id ? { ...item, [field]: val } : item));
  };

  const removeAgendaItem = (id: string) => {
    setAgenda(agenda.filter(item => item.id !== id));
  };

  const addAgendaItem = () => {
    const newItem: AgendaItem = {
      id: Date.now().toString(),
      time: '09:00',
      title: '新议程',
      speaker: '',
      location: ''
    };
    setAgenda([...agenda, newItem]);
  };

  const updateParticipant = (id: string, field: keyof Participant, val: string) => {
      setParticipants(prev => prev.map(p => p.id === id ? { ...p, [field]: val } : p));
  };

  // --- NATIVE DOCX GENERATION ---
  const handleExportDocx = async () => {
     try {
         const currentInfo = meetingInfoRef.current;
         const hostP = participants.find(p => p.id === currentInfo.hostId || p.nameCN === currentInfo.hostId);
         const hostDisplay = hostP ? `${hostP.nameCN}　${hostP.unitCN}` : currentInfo.hostId || "待定";

         // Helper for text styles with multiline support - FIX: Explicit String conversion and break handling
         const createMultiLineText = (text: string, bold = false, sizePt = bodySize) => {
            const safeText = String(text || '');
            const lines = safeText.split('\n');
            return lines.map((line, i) => 
                new TextRun({
                    text: line, 
                    bold: bold,
                    size: sizePt * 2, 
                    font: exportFont,
                    break: i > 0 ? 1 : 0 // 1 means explicit break
                })
            );
         };

         const noBorder = { style: BorderStyle.NONE, size: 0, color: "auto" };
         // FIX: Separate border definitions to prevent file corruption
         // TableBorders supports insideHorizontal/insideVertical
         const tableBorders = { 
             top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, 
             insideHorizontal: noBorder, insideVertical: noBorder 
         };
         // CellBorders ONLY supports top/bottom/left/right
         const cellBorders = { 
             top: noBorder, bottom: noBorder, left: noBorder, right: noBorder 
         };
         
         // Helper for Paragraph Spacing
         const paraSpacing = { line: Math.round(lineHeight * 240), lineRule: "auto", after: 0 }; 

         // Calculate Total Page Width in DXA (170mm approx)
         const mmToDxa = (mm: number) => Math.floor(mm * 56.6929);
         const pageWidthDxa = mmToDxa(170); // Printable width

         // 1. Agenda Table Rows
         const timeWidth = Math.floor(pageWidthDxa * 0.25);
         const contentWidth = pageWidthDxa - timeWidth;

         let agendaTableRows = agenda.map(item => 
            new TableRow({
                children: [
                    new TableCell({
                        width: { size: timeWidth, type: WidthType.DXA },
                        children: [new Paragraph({ children: createMultiLineText(item.time, true), alignment: AlignmentType.LEFT, spacing: paraSpacing })],
                        borders: cellBorders,
                    }),
                    new TableCell({
                        width: { size: contentWidth, type: WidthType.DXA },
                        children: [new Paragraph({ children: [
                            ...createMultiLineText(item.title, true),
                            new TextRun({ text: item.speaker ? ` (${item.speaker})` : "", size: bodySize * 2, font: exportFont })
                        ], spacing: paraSpacing })],
                        borders: cellBorders,
                    }),
                ],
            })
         );

         if (agendaTableRows.length === 0) {
             agendaTableRows = [new TableRow({
                children: [
                    new TableCell({ width: { size: timeWidth, type: WidthType.DXA }, children: [new Paragraph("")], borders: cellBorders }),
                    new TableCell({ width: { size: contentWidth, type: WidthType.DXA }, children: [new Paragraph({ children: createMultiLineText("（暂无议程）") })], borders: cellBorders }),
                ]
             })];
         }

         // 2. Participants Table Rows
         const rawNameTab = Number(currentInfo.nameTabStop);
         const rawUnitTab = Number(currentInfo.unitTabStop);
         // Safe checks for NaN
         const safeNameTab = isNaN(rawNameTab) ? 15 : rawNameTab;
         const safeUnitTab = isNaN(rawUnitTab) ? 20 : rawUnitTab;
         const safeGapMM = Math.max(0, safeUnitTab - safeNameTab);
         
         const nameColWidthDxa = mmToDxa(safeNameTab);
         const gapColWidthDxa = mmToDxa(safeGapMM);
         // Ensure width is not negative
         const unitColWidthDxa = Math.max(0, pageWidthDxa - nameColWidthDxa - gapColWidthDxa);
         
         let participantTableRows = participants.map(p => 
            new TableRow({
                children: [
                    new TableCell({
                        width: { size: nameColWidthDxa, type: WidthType.DXA },
                        children: [new Paragraph({ 
                            children: createMultiLineText(formatNameForAgenda(p.nameCN)),
                            alignment: AlignmentType.RIGHT,
                            spacing: paraSpacing
                        })],
                        borders: cellBorders,
                    }),
                    new TableCell({
                        width: { size: gapColWidthDxa, type: WidthType.DXA },
                        children: [new Paragraph({})], 
                        borders: cellBorders,
                    }),
                    new TableCell({
                        width: { size: unitColWidthDxa, type: WidthType.DXA },
                        children: [new Paragraph({ children: createMultiLineText(p.unitCN), spacing: paraSpacing })],
                        borders: cellBorders,
                    }),
                ],
            })
         );

         if (participantTableRows.length === 0) {
             participantTableRows = [new TableRow({
                children: [
                    new TableCell({ width: { size: nameColWidthDxa, type: WidthType.DXA }, children: [new Paragraph({ children: createMultiLineText("（暂无）") })], borders: cellBorders }),
                    new TableCell({ width: { size: gapColWidthDxa, type: WidthType.DXA }, children: [new Paragraph("")], borders: cellBorders }),
                    new TableCell({ width: { size: unitColWidthDxa, type: WidthType.DXA }, children: [new Paragraph("")], borders: cellBorders }),
                ]
             })];
         }

         const doc = new Document({
            sections: [{
                properties: {
                    page: {
                        margin: {
                            top: mmToDxa(25.4),
                            bottom: mmToDxa(25.4),
                            left: mmToDxa(20),
                            right: mmToDxa(20),
                        }
                    }
                },
                children: [
                    new Paragraph({
                        children: createMultiLineText(`${currentInfo.topic || "会议"}议程`, true, h1Size),
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 400, line: Math.round(lineHeight * 240), lineRule: "auto" },
                    }),
                    new Paragraph({ children: createMultiLineText(`一、会议时间：${currentInfo.date || '待定'}`, true, h2Size), spacing: { after: 200, line: Math.round(lineHeight * 240), lineRule: "auto" } }),
                    new Paragraph({ children: createMultiLineText(`二、会议地点：${currentInfo.location || '待定'}`, true, h2Size), spacing: { after: 200, line: Math.round(lineHeight * 240), lineRule: "auto" } }),
                    new Paragraph({ children: createMultiLineText(`三、主持人：${hostDisplay}`, true, h2Size), spacing: { after: 400, line: Math.round(lineHeight * 240), lineRule: "auto" } }),
                    new Paragraph({ children: createMultiLineText(`四、会议议程`, true, h2Size), spacing: { after: 200, line: Math.round(lineHeight * 240), lineRule: "auto" } }),
                    new Table({
                        rows: agendaTableRows,
                        width: { size: pageWidthDxa, type: WidthType.DXA },
                        borders: tableBorders,
                    }),
                    new Paragraph({ text: "", spacing: { after: 400 } }), 
                    new Paragraph({ children: createMultiLineText(`五、参会人员`, true, h2Size), spacing: { after: 200, line: Math.round(lineHeight * 240), lineRule: "auto" } }),
                    new Table({
                        rows: participantTableRows,
                        width: { size: pageWidthDxa, type: WidthType.DXA },
                        borders: tableBorders,
                    }),
                ],
            }],
         });

         const blob = await Packer.toBlob(doc);
         saveAs(blob, `${currentInfo.topic || '会议'}议程.docx`);
     } catch (err: any) {
         console.error(err);
         alert("导出失败: " + (err.message || "未知错误，请检查议程/人员数据"));
     }
  };

  const handleRulerMouseDown = (e: React.MouseEvent, type: 'name' | 'unit') => {
      e.preventDefault();
      dragTarget.current = type;
      window.addEventListener('mousemove', handleRulerMouseMove);
      window.addEventListener('mouseup', handleRulerMouseUp);
  };

  const handleRulerMouseMove = (e: MouseEvent) => {
      if (!rulerRef.current || !dragTarget.current) return;
      const rect = rulerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const clampedX = Math.max(0, Math.min(x, rect.width));
      const mm = Math.round((clampedX / rect.width) * PRINT_WIDTH_MM);
      
      const currentInfo = meetingInfoRef.current;
      const safeUnit = Number(currentInfo.unitTabStop ?? 20);
      const safeName = Number(currentInfo.nameTabStop ?? 15);

      if (dragTarget.current === 'name') {
          const newName = Math.min(mm, safeUnit - 5);
          if (newName !== safeName) {
              setMeetingInfo({ ...currentInfo, nameTabStop: Math.max(5, newName) });
          }
      } else {
          const newUnit = Math.max(mm, safeName + 5);
          if (newUnit !== safeUnit) {
              setMeetingInfo({ ...currentInfo, unitTabStop: Math.min(PRINT_WIDTH_MM, newUnit) });
          }
      }
  };

  const handleRulerMouseUp = () => {
      dragTarget.current = null;
      window.removeEventListener('mousemove', handleRulerMouseMove);
      window.removeEventListener('mouseup', handleRulerMouseUp);
  };

  const handlePrint = () => {
      window.print();
  };

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] overflow-hidden">
        {/* Optimized Header Toolbar */}
        <div className="bg-white border-b px-6 py-3 flex items-center justify-between shadow-sm z-20 shrink-0 h-16 no-print">
            <div className="flex items-center gap-4">
                 <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                    <Calendar size={20}/>
                 </div>
                 <div>
                     <h2 className="text-lg font-bold text-slate-900 leading-tight">会议议程排版</h2>
                     <p className="text-[10px] text-slate-400 font-medium">Layout & Print Studio</p>
                 </div>
            </div>

            {/* Center: View Switcher */}
            <div className="bg-slate-100 p-1 rounded-lg flex items-center">
                <button 
                    onClick={() => setViewMode('edit')} 
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'edit' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <Edit2 size={14}/> 数据录入
                </button>
                <button 
                    onClick={() => setViewMode('preview')} 
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'preview' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <LayoutTemplate size={14}/> 预览/排版
                </button>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-3">
                {/* Scale Controls */}
                {viewMode === 'preview' && (
                    <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-lg mr-4 border border-slate-200">
                        <button onClick={() => setScale(s => Math.max(0.3, s - 0.1))} className="p-1 hover:bg-white rounded text-gray-500"><ZoomOut size={14}/></button>
                        <span className="text-xs font-mono w-8 text-center text-gray-600 select-none">{Math.round(scale * 100)}%</span>
                        <button onClick={() => setScale(s => Math.min(2.0, s + 0.1))} className="p-1 hover:bg-white rounded text-gray-500"><ZoomIn size={14}/></button>
                    </div>
                )}

                <button 
                    onClick={() => setShowConfig(!showConfig)} 
                    className={`p-2 rounded-lg transition-all border ${showConfig ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                    title={showConfig ? "收起配置" : "展开配置"}
                >
                    {showConfig ? <PanelLeftClose size={18}/> : <Settings2 size={18}/>}
                </button>
                
                <div className="h-6 w-px bg-slate-200 mx-1"></div>

                <button 
                    onClick={handlePrint} 
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all text-xs font-bold shadow-sm"
                >
                    <Printer size={16}/> 打印
                </button>
                <button 
                    onClick={handleExportDocx} 
                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white border border-slate-900 rounded-lg hover:bg-black hover:border-black transition-all text-xs font-bold shadow-md active:scale-95"
                >
                    <Download size={16}/> 导出 Word
                </button>
            </div>
        </div>

        <div className="flex-1 flex overflow-hidden relative">
            {/* Left Config Panel */}
            <div className={`bg-white border-r border-slate-200 overflow-y-auto no-print transition-all duration-300 ease-in-out flex flex-col ${showConfig ? 'w-80 opacity-100' : 'w-0 opacity-0 overflow-hidden'}`}>
                 <div className="p-6 space-y-8">
                     <div>
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Settings2 size={14}/> 基础信息</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1.5">会议主题</label>
                                <input type="text" value={meetingInfo.topic} onChange={e => setMeetingInfo({...meetingInfo, topic: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-bold text-slate-700" placeholder="输入主题..."/>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1.5">日期</label>
                                    <input type="date" value={meetingInfo.date} onChange={e => setMeetingInfo({...meetingInfo, date: e.target.value})} className="w-full px-2 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"/>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1.5">主持人</label>
                                    <input list="host-list" value={meetingInfo.hostId} onChange={e => setMeetingInfo({...meetingInfo, hostId: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="选择..."/>
                                    <datalist id="host-list">{participants.map(p => <option key={p.id} value={p.nameCN}>{p.unitCN}</option>)}</datalist>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1.5">地点</label>
                                <input type="text" value={meetingInfo.location} onChange={e => setMeetingInfo({...meetingInfo, location: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="输入地点..."/>
                            </div>
                        </div>
                     </div>
                     
                     <div className="pt-6 border-t border-slate-100">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><FileText size={14}/> 排版样式</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1.5">中文字体 (Font)</label>
                                <select value={exportFont} onChange={e => setExportFont(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer">
                                    <option value="SimSun">宋体 (标准公文)</option>
                                    <option value="SimHei">黑体 (醒目)</option>
                                    <option value="KaiTi">楷体 (柔和)</option>
                                    <option value="Microsoft YaHei">微软雅黑</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1.5">标题字号 (pt)</label>
                                    <input type="number" value={h1Size} onChange={e => setH1Size(Number(e.target.value))} className="w-full px-2 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs text-center focus:ring-2 focus:ring-indigo-500 outline-none"/>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1.5">正文字号 (pt)</label>
                                    <input type="number" value={bodySize} onChange={e => setBodySize(Number(e.target.value))} className="w-full px-2 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs text-center focus:ring-2 focus:ring-indigo-500 outline-none"/>
                                </div>
                            </div>
                            {/* Line Height Control */}
                            <div>
                                <div className="flex justify-between items-center mb-1.5">
                                    <label className="block text-[10px] font-bold text-slate-500">行间距 (Line Height)</label>
                                    <span className="text-[10px] font-mono text-slate-400">{lineHeight}x</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="1.0" 
                                    max="3.0" 
                                    step="0.1" 
                                    value={lineHeight} 
                                    onChange={e => setLineHeight(Number(e.target.value))} 
                                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                />
                            </div>
                        </div>
                     </div>

                     <button onClick={handleAiGenerate} disabled={isGenerating} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl text-xs font-bold hover:shadow-lg transition-all disabled:opacity-50 active:scale-95 mt-auto">
                        {isGenerating ? <Loader2 className="animate-spin" size={16}/> : <Wand2 size={16} />}
                        AI 智能生成议程
                     </button>
                </div>
            </div>

            {/* Right Preview Area */}
            <div className="flex-1 bg-gray-500/90 overflow-hidden flex flex-col relative">
                
                {/* Ruler Bar - Only visible in preview */}
                {viewMode === 'preview' && (
                    <div className="h-12 bg-white border-b border-slate-200 shrink-0 no-print flex items-center justify-center relative shadow-[0_2px_10px_rgba(0,0,0,0.05)] z-10">
                        <div className="absolute left-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <Ruler size={14} className="text-indigo-400"/> Alignment Guide
                        </div>
                        
                        {/* Ruler Container */}
                        <div ref={rulerRef} className="w-[170mm] h-8 relative bg-slate-50 rounded border border-slate-200 overflow-visible select-none shadow-inner cursor-crosshair">
                            {/* Ticks */}
                            {Array.from({length: 18}).map((_, i) => (
                                <div key={i} className="absolute top-0 bottom-0 border-l border-slate-300" style={{ left: `${(i * 10) / PRINT_WIDTH_MM * 100}%` }}>
                                    <span className="absolute top-1 left-1 text-[8px] text-slate-400 font-mono">{i * 10}</span>
                                </div>
                            ))}
                            
                            {/* Handle: Name End */}
                            <div 
                                onMouseDown={(e) => handleRulerMouseDown(e, 'name')} 
                                className="absolute top-0 bottom-0 w-0 border-l-2 border-dashed border-red-400 cursor-ew-resize group z-20 hover:border-red-600 transition-colors"
                                style={{ left: `${nameTabStop / PRINT_WIDTH_MM * 100}%` }}
                            >
                                <div className="absolute -top-7 -translate-x-1/2 bg-red-500 text-white text-[9px] px-2 py-0.5 rounded-md font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all shadow-md">
                                    姓名列: {nameTabStop}mm
                                </div>
                                <div className="absolute -bottom-1 -translate-x-1/2 w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-b-4 border-b-red-500"></div>
                            </div>

                            {/* Handle: Unit Start */}
                            <div 
                                onMouseDown={(e) => handleRulerMouseDown(e, 'unit')} 
                                className="absolute top-0 bottom-0 w-0 border-l-2 border-indigo-500 cursor-ew-resize group z-30 hover:border-indigo-700 transition-colors"
                                style={{ left: `${unitTabStop / PRINT_WIDTH_MM * 100}%` }}
                            >
                                <div className="absolute -top-7 -translate-x-1/2 bg-indigo-600 text-white text-[9px] px-2 py-0.5 rounded-md font-bold whitespace-nowrap scale-90 group-hover:scale-100 transition-all shadow-md">
                                    单位对齐: {unitTabStop}mm
                                </div>
                                <div className="absolute -bottom-1 -translate-x-1/2 w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-b-4 border-b-indigo-600"></div>
                            </div>
                        </div>
                    </div>
                )}
                
                {/* Content Canvas */}
                <div className="flex-1 overflow-y-auto p-12 flex justify-center items-start custom-scrollbar print:p-0 print:overflow-visible print:block print:w-full">
                    {viewMode === 'edit' ? (
                        <div className="space-y-4 max-w-3xl w-full animate-fadeIn bg-white p-8 rounded-2xl shadow-sm border border-slate-200 mt-4">
                            {agenda.map((item) => (
                                <div key={item.id} className="flex gap-4 p-5 border border-slate-200 bg-white rounded-2xl shadow-sm group items-center hover:shadow-md transition-all hover:border-indigo-100">
                                    <div className="w-24 shrink-0">
                                        <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block pl-1">Time</label>
                                        <input value={item.time} onChange={e => updateAgendaItem(item.id, 'time', e.target.value)} className="w-full font-mono font-bold text-center border bg-slate-50 rounded-lg py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700"/>
                                    </div>
                                    <div className="flex-1 flex flex-col gap-2">
                                        <div>
                                            <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block pl-1">Item Title</label>
                                            <input value={item.title} onChange={e => updateAgendaItem(item.id, 'title', e.target.value)} className="w-full font-bold border bg-slate-50 rounded-lg py-1.5 px-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800" placeholder="事项名称"/>
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block pl-1">Speaker (Optional)</label>
                                            <input value={item.speaker} onChange={e => updateAgendaItem(item.id, 'speaker', e.target.value)} className="w-full text-xs text-slate-600 border bg-slate-50 rounded-lg py-1.5 px-3 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="发言人..."/>
                                        </div>
                                    </div>
                                    <button onClick={() => removeAgendaItem(item.id)} className="text-slate-300 hover:text-red-500 transition-colors p-3 hover:bg-red-50 rounded-xl"><Trash2 size={18}/></button>
                                </div>
                            ))}
                            <button onClick={addAgendaItem} className="w-full py-5 border-2 border-dashed border-slate-300 rounded-2xl text-slate-400 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all flex items-center justify-center gap-2 font-bold text-sm">
                                <Plus size={18}/> 添加新议程项
                            </button>
                        </div>
                    ) : (
                        <div 
                            className="bg-white shadow-2xl print:shadow-none transition-transform duration-300 origin-top print:scale-100 print:transform-none relative" 
                            style={{ 
                                width: '210mm', 
                                minHeight: '297mm', 
                                padding: '25.4mm 20mm',
                                fontFamily: `"${exportFont}", "Songti SC", "Noto Serif SC", serif`, 
                                fontSize: `${bodySize}pt`,
                                lineHeight: lineHeight,
                                transform: `scale(${scale})`,
                                transformOrigin: 'top center'
                            }}
                        >
                            {/* Page Break Visual Indicator */}
                            <div className="absolute top-[297mm] left-0 w-full border-b-2 border-dashed border-red-300 opacity-50 pointer-events-none print:hidden flex items-center justify-end">
                                <span className="bg-red-400 text-white text-[9px] px-1 font-bold">Page Break (A4)</span>
                            </div>

                            <div className="text-slate-900 font-serif text-justify h-full flex flex-col">
                                {/* Title */}
                                <div className="text-center font-bold mb-12" style={{ fontSize: `${h1Size}pt` }}>
                                    <EditableDiv 
                                        value={meetingInfo.topic || "会议"} 
                                        onChange={val => setMeetingInfo({...meetingInfo, topic: val})}
                                        className="text-center w-full"
                                    />
                                    <div style={{ fontSize: '0.6em', marginTop: '0.5em', fontWeight: 'normal' }}>议程</div>
                                </div>
                                
                                {/* Info Block */}
                                <div className="space-y-6 mb-12" style={{ fontSize: `${h2Size}pt` }}>
                                    <div className="flex"><span className="font-bold shrink-0">一、会议时间：</span>
                                        <EditableDiv 
                                            value={meetingInfo.date} 
                                            onChange={val => setMeetingInfo({...meetingInfo, date: val})}
                                            className="flex-1 ml-2"
                                        />
                                    </div>
                                    <div className="flex"><span className="font-bold shrink-0">二、会议地点：</span>
                                        <EditableDiv 
                                            value={meetingInfo.location} 
                                            onChange={val => setMeetingInfo({...meetingInfo, location: val})}
                                            className="flex-1 ml-2"
                                        />
                                    </div>
                                    <div className="flex"><span className="font-bold shrink-0">三、主持人：</span>
                                        <span className="ml-2">{participants.find(p => p.id === meetingInfo.hostId || p.nameCN === meetingInfo.hostId)?.nameCN || meetingInfo.hostId || "待定"}</span>
                                    </div>
                                </div>
                                
                                {/* Agenda Block */}
                                <div className="mb-12">
                                    <p className="font-bold mb-6" style={{ fontSize: `${h2Size}pt` }}>四、会议议程</p>
                                    <div className="space-y-4">
                                        {agenda.map(item => (
                                            <div key={item.id} className="flex gap-4 items-baseline">
                                                <EditableDiv 
                                                    value={item.time} 
                                                    onChange={val => updateAgendaItem(item.id, 'time', val)}
                                                    className="shrink-0 font-bold"
                                                    style={{ width: '22%' }}
                                                />
                                                <div className="flex-1 font-bold flex flex-wrap">
                                                    <EditableDiv 
                                                        value={item.title} 
                                                        onChange={val => updateAgendaItem(item.id, 'title', val)}
                                                        className="flex-1 min-w-[200px]"
                                                    />
                                                    {item.speaker && (
                                                        <>
                                                            <span className="font-normal mx-1">（</span>
                                                            <EditableDiv 
                                                                value={item.speaker} 
                                                                onChange={val => updateAgendaItem(item.id, 'speaker', val)}
                                                                className="font-normal min-w-[50px] text-center"
                                                                placeholder="发言人"
                                                                style={{ fontSize: '0.9em' }}
                                                            />
                                                            <span className="font-normal">）</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Participants Block */}
                                <div className="flex-1">
                                    <p className="font-bold mb-6" style={{ fontSize: `${h2Size}pt` }}>五、参会人员</p>
                                    <div className="relative">
                                        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                                            <tbody>
                                                {participants.map(p => (
                                                    <tr key={p.id} className="break-inside-avoid">
                                                        <td style={{ 
                                                            width: `${nameTabStop}mm`, 
                                                            verticalAlign: 'top', 
                                                            paddingBottom: `${Math.max(0, (lineHeight - 1.2) * 0.5)}em`, 
                                                            textAlign: 'right', 
                                                        }}>
                                                            <EditableDiv 
                                                                value={formatNameForAgenda(p.nameCN)} 
                                                                onChange={val => updateParticipant(p.id, 'nameCN', val)}
                                                                className="text-right"
                                                            />
                                                        </td>
                                                        <td style={{ width: `${gapMM}mm` }}></td>
                                                        <td style={{ verticalAlign: 'top', paddingBottom: `${Math.max(0, (lineHeight - 1.2) * 0.5)}em` }}>
                                                            {/* Changed to EditableDiv for correct wrapping */}
                                                            <EditableDiv 
                                                                value={p.unitCN} 
                                                                onChange={val => updateParticipant(p.id, 'unitCN', val)}
                                                            />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        
                                        {/* Visual Guides (Only in Preview when dragging) */}
                                        {dragTarget.current && (
                                            <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-0">
                                                <div className="absolute top-0 bottom-0 border-l border-dashed border-red-300 opacity-50" style={{ left: `${nameTabStop}mm` }}></div>
                                                <div className="absolute top-0 bottom-0 border-l border-dashed border-indigo-300 opacity-50" style={{ left: `${unitTabStop}mm` }}></div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};
