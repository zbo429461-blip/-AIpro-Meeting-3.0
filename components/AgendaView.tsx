import React, { useState } from 'react';
import { AgendaItem, AppSettings, MeetingBasicInfo, Participant } from '../types';
import { formatNameForAgenda } from '../utils';
import { generateAgenda } from '../services/aiService';
import { Wand2, Calendar, Clock, MapPin, User, Loader2, PlayCircle, Download, FileText, Type, AlignLeft, Eye, Edit2 } from 'lucide-react';

interface AgendaViewProps {
  agenda: AgendaItem[];
  setAgenda: (items: AgendaItem[]) => void;
  settings: AppSettings;
  participants: Participant[]; // Need participants for linking
  meetingInfo: MeetingBasicInfo;
  setMeetingInfo: (info: MeetingBasicInfo) => void;
}

export const AgendaView: React.FC<AgendaViewProps> = ({ agenda, setAgenda, settings, participants, meetingInfo, setMeetingInfo }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  
  // Styling state for export & preview
  const [exportFont, setExportFont] = useState('SimSun');
  const [h1Size, setH1Size] = useState(24); // Topic
  const [h2Size, setH2Size] = useState(16); // Section headers (e.g. "一、会议时间")
  const [h3Size, setH3Size] = useState(14); // Content
  const [bodySize, setBodySize] = useState(14); 

  const handleAiGenerate = async () => {
    if (!meetingInfo.topic) return alert("请输入会议主题");
    setIsGenerating(true);
    try {
        const newItems = await generateAgenda(meetingInfo.topic, meetingInfo.date, settings);
        setAgenda(newItems);
    } catch (e) {
        alert("生成失败，请检查设置中的Key。");
    } finally {
        setIsGenerating(false);
    }
  };

  const updateAgendaItem = (id: string, field: keyof AgendaItem, val: string) => {
      setAgenda(agenda.map(item => item.id === id ? { ...item, [field]: val } : item));
  };

  const getHostDisplay = () => {
     const hostP = participants.find(p => p.id === meetingInfo.hostId || p.nameCN === meetingInfo.hostId);
     if (hostP) {
         // No brackets as requested: "Name Unit" (using ideographic space for separation)
         return `${hostP.nameCN}　${hostP.unitCN}`;
     }
     return meetingInfo.hostId || "待定";
  };

  const handleExportWordTemplate = () => {
     const hostDisplay = getHostDisplay();
     
     const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Agenda</title></head><body style='font-family:${exportFont}'>`;
     
     const content = `
        <div style="text-align:center; font-size:${h1Size}pt; font-weight:bold; margin-bottom:30px;">${meetingInfo.topic || "会议"}议程</div>
        
        <div style="font-size:${h2Size}pt; margin-bottom:10px; font-weight:bold;">一、会议时间</div>
        <div style="font-size:${h3Size}pt; margin-bottom:20px; margin-left:2em;">${meetingInfo.date}</div>
        
        <div style="font-size:${h2Size}pt; margin-bottom:10px; font-weight:bold;">二、会议地点</div>
        <div style="font-size:${h3Size}pt; margin-bottom:20px; margin-left:2em;">${meetingInfo.location}</div>
        
        <div style="font-size:${h2Size}pt; margin-bottom:10px; font-weight:bold;">三、主持人</div>
        <div style="font-size:${h3Size}pt; margin-bottom:20px; margin-left:2em;">${hostDisplay}</div>
        
        <div style="font-size:${h2Size}pt; margin-bottom:10px; font-weight:bold;">四、会议议程</div>
        <div style="margin-left:2em; font-size:${bodySize}pt; margin-bottom:20px;">
           ${agenda.map(item => `<div style="margin-bottom:5px;">${item.time} ${item.title}</div>`).join('')}
        </div>
        
        <div style="font-size:${h2Size}pt; margin-bottom:10px; font-weight:bold;">五、参会人员</div>
        <div style="margin-left:2em; font-size:${bodySize}pt; line-height: 1.5;">
            ${participants.map(p => `
                <div style="margin-bottom:5px;">
                    <span style="display:inline-block; width:120px;">${formatNameForAgenda(p.nameCN)}</span>
                    <span>${p.unitCN}</span>
                </div>
            `).join('')}
        </div>
     `;
     
     const footer = "</body></html>";
     const sourceHTML = header + content + footer;
     const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
     const fileDownload = document.createElement("a");
     document.body.appendChild(fileDownload);
     fileDownload.href = source;
     const fileName = meetingInfo.topic ? `${meetingInfo.topic}议程.doc` : '会议议程.doc';
     fileDownload.download = fileName;
     fileDownload.click();
     document.body.removeChild(fileDownload);
  };

  return (
    <div className="p-6 h-full flex flex-col max-w-7xl mx-auto bg-gray-50/30">
        
        {/* Header & Controls */}
        <div className="flex justify-between items-start mb-6 pb-6 border-b border-gray-200 no-print flex-wrap gap-4">
            <div>
                 <h2 className="text-2xl font-serif-sc font-bold text-gray-900">会议议程 & 信息</h2>
                 <p className="text-gray-500 text-sm mt-1">管理会议基本信息、主持人及流程，支持一键导出登记表。</p>
            </div>
            
            <div className="flex flex-col gap-2 items-end">
                {/* Mode Toggle */}
                <div className="flex p-1 bg-white border border-gray-200 rounded-lg shadow-sm">
                    <button 
                        onClick={() => setViewMode('edit')}
                        className={`px-4 py-1.5 rounded text-sm font-medium flex items-center gap-2 ${viewMode === 'edit' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <Edit2 size={14} /> 编辑模式
                    </button>
                     <button 
                        onClick={() => setViewMode('preview')}
                        className={`px-4 py-1.5 rounded text-sm font-medium flex items-center gap-2 ${viewMode === 'preview' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <Eye size={14} /> 预览模式
                    </button>
                </div>

                <button 
                    onClick={handleExportWordTemplate}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm transition-all text-sm font-medium w-full justify-center"
                >
                    <FileText size={16}/> 导出 Word 文档
                </button>
            </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 h-full overflow-hidden">
            
            {/* Left: Meeting Info Panel */}
            <div className="w-full lg:w-1/3 bg-white p-6 rounded-xl border border-gray-200 shadow-sm overflow-y-auto no-print">
                 <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <User size={18} className="text-indigo-600"/> 基本信息
                 </h3>
                 
                 <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">会议主题 (Topic)</label>
                        <input 
                            type="text" 
                            value={meetingInfo.topic}
                            onChange={e => setMeetingInfo({...meetingInfo, topic: e.target.value})}
                            className="w-full p-2 border border-gray-300 rounded-md text-sm"
                            placeholder="例如: 2025 年会"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">会议时间 (Date)</label>
                        <input 
                            type="date" 
                            value={meetingInfo.date}
                            onChange={e => setMeetingInfo({...meetingInfo, date: e.target.value})}
                            className="w-full p-2 border border-gray-300 rounded-md text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">会议地点 (Location)</label>
                         <input 
                            type="text" 
                            value={meetingInfo.location}
                            onChange={e => setMeetingInfo({...meetingInfo, location: e.target.value})}
                            className="w-full p-2 border border-gray-300 rounded-md text-sm"
                            placeholder="例如: 720 会议室"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">主持人 (Host)</label>
                        <div className="relative">
                             <input 
                                list="host-options"
                                type="text"
                                value={meetingInfo.hostId}
                                onChange={e => setMeetingInfo({...meetingInfo, hostId: e.target.value})}
                                className="w-full p-2 border border-gray-300 rounded-md text-sm"
                                placeholder="输入或选择主持人..."
                             />
                             <datalist id="host-options">
                                {participants.map(p => (
                                    <option key={p.id} value={p.nameCN}>
                                        {p.unitCN}
                                    </option>
                                ))}
                             </datalist>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-gray-100">
                         <button 
                            onClick={handleAiGenerate}
                            disabled={isGenerating}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-900 transition-all disabled:opacity-50"
                        >
                            {isGenerating ? <Loader2 className="animate-spin" size={16}/> : <Wand2 size={16} />}
                            AI 辅助生成议程
                        </button>
                    </div>
                 </div>
            </div>

            {/* Right: Agenda List or Preview */}
            <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-col gap-2 no-print">
                    <div className="flex justify-between items-center">
                        <h3 className="font-bold text-gray-800 text-sm">
                            {viewMode === 'edit' ? '议程编辑 (Edit)' : '文档预览 (Preview)'}
                        </h3>
                    </div>
                    
                    {viewMode === 'preview' && (
                        <div className="flex items-center gap-2 flex-wrap">
                             <select 
                                value={exportFont}
                                onChange={(e) => setExportFont(e.target.value)}
                                className="text-xs p-1 border rounded"
                             >
                                 <option value="SimSun">宋体</option>
                                 <option value="SimHei">黑体</option>
                                 <option value="Microsoft YaHei">微软雅黑</option>
                                 <option value="KaiTi">楷体</option>
                             </select>
                             <div className="flex items-center gap-1 border-l pl-2">
                                <span className="text-xs text-gray-400">标题:</span>
                                <input type="number" value={h1Size} onChange={(e) => setH1Size(Number(e.target.value))} className="w-10 text-xs p-1 border rounded" title="一级标题字号"/>
                             </div>
                             <div className="flex items-center gap-1">
                                <span className="text-xs text-gray-400">小标题:</span>
                                <input type="number" value={h2Size} onChange={(e) => setH2Size(Number(e.target.value))} className="w-10 text-xs p-1 border rounded" title="二级标题字号"/>
                             </div>
                             <div className="flex items-center gap-1">
                                <span className="text-xs text-gray-400">正文:</span>
                                <input type="number" value={h3Size} onChange={(e) => setH3Size(Number(e.target.value))} className="w-10 text-xs p-1 border rounded" title="三级内容字号"/>
                             </div>
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-gray-400">列表:</span>
                                <input type="number" value={bodySize} onChange={(e) => setBodySize(Number(e.target.value))} className="w-10 text-xs p-1 border rounded" title="列表字号"/>
                             </div>
                        </div>
                    )}
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-gray-100/50">
                     {viewMode === 'edit' ? (
                         agenda.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                <Calendar size={48} className="mb-2 opacity-20"/>
                                <p>暂无议程，请使用 AI 生成或手动添加</p>
                            </div>
                         ) : (
                            <div className="space-y-4">
                                {agenda.map((item) => (
                                    <div key={item.id} className="flex gap-4 p-4 border border-gray-100 bg-white rounded-lg hover:shadow-md transition-all">
                                        <input 
                                            value={item.time} 
                                            onChange={(e) => updateAgendaItem(item.id, 'time', e.target.value)}
                                            className="w-24 font-mono text-slate-900 font-bold bg-transparent border-b border-transparent focus:border-indigo-500 outline-none"
                                        />
                                        <div className="flex-1">
                                            <input 
                                                value={item.title} 
                                                onChange={(e) => updateAgendaItem(item.id, 'title', e.target.value)}
                                                className="w-full font-bold text-gray-800 bg-transparent border-b border-transparent focus:border-indigo-500 outline-none mb-1"
                                            />
                                            <div className="flex gap-3 mt-1 text-xs text-gray-500">
                                                <div className="flex items-center gap-1">
                                                    <User size={12}/> 
                                                    <input 
                                                        value={item.speaker} 
                                                        onChange={(e) => updateAgendaItem(item.id, 'speaker', e.target.value)}
                                                        className="bg-transparent w-24 border-b border-transparent focus:border-indigo-500 outline-none"
                                                        placeholder="发言人"
                                                    />
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <MapPin size={12}/> 
                                                    <input 
                                                        value={item.location} 
                                                        onChange={(e) => updateAgendaItem(item.id, 'location', e.target.value)}
                                                        className="bg-transparent w-24 border-b border-transparent focus:border-indigo-500 outline-none"
                                                        placeholder="地点"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                         )
                     ) : (
                         // PREVIEW MODE
                         <div className="mx-auto bg-white shadow-lg p-[20mm] w-[210mm] min-h-[297mm] print:shadow-none" style={{ fontFamily: exportFont }}>
                            <div className="text-center font-bold mb-8" style={{ fontSize: `${h1Size}pt` }} contentEditable suppressContentEditableWarning>
                                {meetingInfo.topic || "会议"}议程
                            </div>

                            <div className="mb-6">
                                <h3 className="font-bold mb-2" style={{ fontSize: `${h2Size}pt` }}>一、会议时间</h3>
                                <div className="ml-8" style={{ fontSize: `${h3Size}pt` }} contentEditable suppressContentEditableWarning>{meetingInfo.date}</div>
                            </div>

                            <div className="mb-6">
                                <h3 className="font-bold mb-2" style={{ fontSize: `${h2Size}pt` }}>二、会议地点</h3>
                                <div className="ml-8" style={{ fontSize: `${h3Size}pt` }} contentEditable suppressContentEditableWarning>{meetingInfo.location}</div>
                            </div>

                            <div className="mb-6">
                                <h3 className="font-bold mb-2" style={{ fontSize: `${h2Size}pt` }}>三、主持人</h3>
                                <div className="ml-8" style={{ fontSize: `${h3Size}pt` }} contentEditable suppressContentEditableWarning>
                                    {getHostDisplay()}
                                </div>
                            </div>

                            <div className="mb-6">
                                <h3 className="font-bold mb-2" style={{ fontSize: `${h2Size}pt` }}>四、会议议程</h3>
                                <div className="ml-8" style={{ fontSize: `${bodySize}pt` }}>
                                    {agenda.map(item => (
                                        <div key={item.id} className="flex mb-2" contentEditable suppressContentEditableWarning>
                                            <span className="w-24 flex-shrink-0">{item.time}</span>
                                            <span>{item.title} {item.speaker ? `(${item.speaker})` : ''}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="mb-6">
                                <h3 className="font-bold mb-2" style={{ fontSize: `${h2Size}pt` }}>五、参会人员</h3>
                                <div className="ml-8" style={{ fontSize: `${bodySize}pt` }}>
                                    {participants.map(p => (
                                        <div key={p.id} className="flex mb-2" contentEditable suppressContentEditableWarning>
                                            <span className="inline-block w-32">{formatNameForAgenda(p.nameCN)}</span>
                                            <span>{p.unitCN}</span>
                                        </div>
                                    ))}
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