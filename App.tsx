
import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { View, Participant, AppSettings, MeetingBasicInfo, Meeting, ChatMessage } from './types';
import { ParticipantsView } from './components/ParticipantsView';
import { AgendaView } from './components/AgendaView';
import { TableCardView } from './components/TableCardView';
import { SettingsView } from './components/SettingsView';
import { AssistantView } from './components/AssistantView';
import { SignInView } from './components/SignInView';
import { FilesView } from './components/FilesView'; 
import { PPTCreatorView } from './components/PPTCreatorView';
import { AssetManagerView } from './components/AssetManagerView';
import { ProjectManagerView } from './components/ProjectManagerView';
import { FormsView } from './components/FormsView';
import { DailyScheduleView } from './components/DailyScheduleView';
import { 
  Plus, Trash2, Mic, Cpu, CheckCircle2, 
  Code, Play, Keyboard, MousePointerClick, Sparkles, 
  AlertTriangle, Presentation, Briefcase, FormInput, 
  ArrowLeftCircle, Clock, Users, X, Loader2, 
  CalendarDays, KanbanSquare, ClipboardCheck, ArrowRight, Settings, Grid, Calendar
} from 'lucide-react';
import { parseMeetingRequest, generateChatResponse } from './services/aiService';

// Speech Recognition Types
declare global {
  interface Window {
    webkitSpeechRecognition: any;
  }
}

const WorkflowOverlay = ({ step, data, onClose, onExecute, inputMode, setInputMode, onTextSubmit }: { 
    step: number, 
    data: any, 
    onClose: () => void, 
    onExecute: () => void,
    inputMode: 'voice' | 'text',
    setInputMode: (m: 'voice' | 'text') => void,
    onTextSubmit: (text: string) => void
}) => {
    const [textInput, setTextInput] = useState('');
    const isTopicMissing = step === 4 && (!data?.topic || data.topic === '未指定');
    const steps = [
        { id: 1, label: inputMode === 'voice' ? '语音采集' : '文本输入', icon: inputMode === 'voice' ? Mic : Keyboard, desc: inputMode === 'voice' ? 'Listening...' : 'Awaiting Input...' },
        { id: 2, label: '意图识别', icon: Cpu, desc: 'Parsing Date, Location, Topic...' },
        { id: 3, label: '脚本生成', icon: Code, desc: 'Generating Auto-Booking Script...' },
        { id: 4, label: '执行预约', icon: Play, desc: 'Ready to Launch' },
    ];

    return (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[100] flex items-center justify-center font-sans">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-gray-700/50">
                <div className="bg-slate-950 p-6 flex justify-between items-center border-b border-gray-800">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        AI 智能预约工作台
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={24}/></button>
                </div>
                
                <div className="p-8 bg-slate-50">
                    <div className="flex justify-between relative mb-12 px-4">
                        <div className="absolute top-1/2 left-4 right-4 h-1 bg-gray-200 -z-0 -translate-y-1/2"></div>
                        <div className="absolute top-1/2 left-4 h-1 bg-indigo-600 -z-0 -translate-y-1/2 transition-all duration-700 ease-out" style={{ width: `${((step - 1) / 3) * 100}%` }}></div>
                        {steps.map((s) => (
                            <div key={s.id} className="relative z-10 flex flex-col items-center">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center border-4 transition-all duration-500
                                    ${step >= s.id ? 'bg-indigo-600 border-indigo-100 text-white shadow-xl scale-110' : 'bg-white border-gray-200 text-gray-300'}
                                `}>
                                    <s.icon size={18} />
                                </div>
                                <span className={`mt-3 text-xs font-bold uppercase tracking-wider ${step >= s.id ? 'text-indigo-900' : 'text-gray-400'}`}>{s.label}</span>
                            </div>
                        ))}
                    </div>

                    <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm min-h-[250px] flex flex-col items-center justify-center text-center relative overflow-hidden">
                        {step === 1 ? (
                             <div className="w-full max-w-lg animate-fadeIn">
                                 {inputMode === 'voice' ? (
                                     <div className="flex flex-col items-center">
                                         <div className="relative mb-6">
                                            <div className="absolute inset-0 bg-red-500 blur-xl opacity-20 animate-pulse rounded-full"></div>
                                            <Mic size={48} className="text-red-500 animate-pulse relative z-10" />
                                         </div>
                                         <h4 className="text-xl font-bold text-slate-800 mb-2">正在聆听...</h4>
                                         <p className="text-slate-400 text-sm mb-6">请说出会议主题、时间、地点</p>
                                         <button onClick={() => setInputMode('text')} className="text-indigo-600 text-sm underline hover:text-indigo-800">
                                             切换到文本输入
                                         </button>
                                     </div>
                                 ) : (
                                     <div className="flex flex-col items-center w-full">
                                         <h4 className="text-xl font-bold text-slate-800 mb-4">请输入会议需求</h4>
                                         <textarea 
                                            value={textInput}
                                            onChange={(e) => setTextInput(e.target.value)}
                                            placeholder="例如：下周三下午两点在主楼会议室召开学术研讨会"
                                            className="w-full p-4 border border-gray-300 rounded-xl mb-4 focus:ring-2 focus:ring-indigo-500 outline-none resize-none h-32"
                                            autoFocus
                                         />
                                         <div className="flex gap-3 w-full">
                                             <button onClick={() => setInputMode('voice')} className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50">
                                                 切换语音
                                             </button>
                                             <button 
                                                onClick={() => onTextSubmit(textInput)}
                                                disabled={!textInput.trim()}
                                                className="flex-1 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 font-bold"
                                             >
                                                 开始解析
                                             </button>
                                         </div>
                                     </div>
                                 )}
                             </div>
                        ) : step < 4 ? (
                            <div className="animate-fadeIn flex flex-col items-center">
                                <div className="relative mb-6">
                                    <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-20 animate-pulse rounded-full"></div>
                                    <Loader2 size={48} className="text-indigo-600 animate-spin relative z-10" />
                                </div>
                                <h4 className="text-xl font-bold text-slate-800 mb-2">{steps[step-1].desc}</h4>
                                <p className="text-slate-400 text-sm font-mono">Processing node: {Math.random().toString(36).substring(7).toUpperCase()}</p>
                            </div>
                        ) : (
                            <div className="w-full text-left animate-slideUp">
                                {isTopicMissing && (
                                    <div className="flex items-center gap-2 text-amber-700 mb-4 bg-amber-50 p-3 rounded-lg border border-amber-200">
                                        <AlertTriangle size={20} />
                                        <div>
                                            <p className="font-bold text-sm">注意：未能识别会议主题</p>
                                            <p className="text-xs opacity-80">系统将自动跳转，请手动补充主题信息。</p>
                                        </div>
                                    </div>
                                )}
                                <div className="flex items-center gap-2 text-green-700 mb-6 bg-green-50 p-4 rounded-xl border border-green-100">
                                    <CheckCircle2 size={24} />
                                    <div>
                                        <p className="font-bold">解析完成 | Ready</p>
                                        <p className="text-xs text-green-600">已生成模拟操作脚本，点击执行</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                        <span className="text-xs text-gray-500 block mb-1">会议主题</span>
                                        <span className={`font-bold block truncate ${!data?.topic ? 'text-red-500' : 'text-gray-900'}`}>
                                            {data?.topic || "未识别"}
                                        </span>
                                    </div>
                                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                        <span className="text-xs text-gray-500 block mb-1">时间</span>
                                        <span className="font-bold text-gray-900 block truncate">{data?.date} {data?.time}</span>
                                    </div>
                                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 col-span-2">
                                        <span className="text-xs text-gray-500 block mb-1">地点</span>
                                        <span className="font-bold text-gray-900 block truncate">{data?.campus} {data?.location}</span>
                                    </div>
                                </div>
                                <button 
                                    onClick={onExecute}
                                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-3 transition-all shadow-lg hover:shadow-indigo-500/30 transform hover:-translate-y-0.5 active:translate-y-0"
                                >
                                    复制脚本并跳转系统 <MousePointerClick size={20} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>(View.HOME);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [currentMeetingId, setCurrentMeetingId] = useState<string | null>(null);
  const [assistantThinking, setAssistantThinking] = useState(false);
  const [workflowState, setWorkflowState] = useState<{show: boolean, step: number, data: any, inputMode: 'voice' | 'text'}>({ 
      show: false, step: 1, data: null, inputMode: 'voice' 
  });
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newMeetingName, setNewMeetingName] = useState('');
  
  const [settings, setSettings] = useState<AppSettings>({
    aiProvider: 'gemini',
    geminiKey: '',
    ollamaUrl: 'http://localhost:11434',
    ollamaModel: 'llama3',
    siliconFlowKey: '',
    siliconFlowModel: 'deepseek-ai/DeepSeek-V3',
    knowledgeBase: ''
  });

  useEffect(() => {
    const savedSettings = localStorage.getItem('app_settings');
    if (savedSettings) setSettings(JSON.parse(savedSettings));
    const savedMeetings = localStorage.getItem('app_meetings');
    if (savedMeetings) setMeetings(JSON.parse(savedMeetings));
  }, []);

  useEffect(() => {
    localStorage.setItem('app_meetings', JSON.stringify(meetings));
  }, [meetings]);

  const handleSaveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    localStorage.setItem('app_settings', JSON.stringify(newSettings));
  };

  const createMeeting = (topic: string, extraInfo: Partial<MeetingBasicInfo> = {}) => {
      const newMeeting: Meeting = {
          id: Date.now().toString(),
          info: { 
              date: new Date().toISOString().split('T')[0], 
              location: '', 
              hostId: '', 
              topic: topic,
              ...extraInfo
          },
          participants: [],
          agenda: [],
          files: [],
          chatHistory: [], 
          createdAt: Date.now()
      };
      setMeetings(prev => [newMeeting, ...prev]);
      setCurrentMeetingId(newMeeting.id);
      setCurrentView(View.DASHBOARD);
  };

  const activeMeeting = meetings.find(m => m.id === currentMeetingId);

  const updateActiveMeeting = (updater: (m: Meeting) => Meeting) => {
      if (!activeMeeting) return;
      const updated = updater({ ...activeMeeting });
      setMeetings(prev => prev.map(m => m.id === updated.id ? updated : m));
  };

  const handleAssistantSend = async (text: string) => {
      if (!activeMeeting || !text.trim()) return;
      
      const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: text, timestamp: Date.now() };
      updateActiveMeeting(m => ({ ...m, chatHistory: [...(m.chatHistory || []), userMsg] }));
      setAssistantThinking(true);
      
      try {
          // Optimized Summarization & Context Injection
          let userQuery = text;
          const summarizationKeywords = ["会议纪要", "总结", "summarize", "整理", "记录", "整理", "纪要", "归纳", "笔记", "minutes", "highlights"];
          
          if (summarizationKeywords.some(k => text.toLowerCase().includes(k))) {
              let summaryContext = `\n\n--- [系统自动同步: 当前会议核心数据] ---\n`;
              summaryContext += `【会议概况】\n- 主题: ${activeMeeting.info.topic}\n- 时间: ${activeMeeting.info.date}\n- 地点: ${activeMeeting.info.location || '待定'}\n`;
              
              if (activeMeeting.participants.length > 0) {
                  const signedIn = activeMeeting.participants.filter(p => p.isSignedIn).length;
                  summaryContext += `【参会情况】\n- 参会人数: ${activeMeeting.participants.length} 人 (已签到 ${signedIn} 人)\n- 名单: ${activeMeeting.participants.map(p => `${p.nameCN} (${p.unitCN})`).join(', ')}\n`;
              }
              
              if (activeMeeting.agenda.length > 0) {
                  summaryContext += `【议程安排】\n${activeMeeting.agenda.map(a => `- [${a.time}] ${a.title} (负责人/发言人: ${a.speaker || '未指定'})`).join('\n')}\n`;
              }
              
              if (activeMeeting.files && activeMeeting.files.length > 0) {
                  summaryContext += `【参考资料】\n- 附件列表: ${activeMeeting.files.map(f => f.name).join(', ')}\n`;
              }
              
              userQuery = `${text}\n\n${summaryContext}\n\n[指令]: 请结合以上结构化会议数据，按照专业、条理清晰的行政格式生成回复。`;
          }

          let systemInstruction = `You are "xiaoxiaobo AIpro", a world-class smart conference assistant.`;
          if (settings.knowledgeBase) {
              systemInstruction += `\n\nUSER PREFERENCES / BACKGROUND:\n${settings.knowledgeBase}`;
          }

          const reply = await generateChatResponse(settings, userQuery, systemInstruction);
          const aiMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'assistant', content: reply, timestamp: Date.now() };
          
          setMeetings(prev => prev.map(m => m.id === activeMeeting.id ? { ...m, chatHistory: [...(m.chatHistory || []), aiMsg] } : m));
      } catch (e) {
          console.error(e);
      } finally {
          setAssistantThinking(false);
      }
  };

  const startSmartBooking = () => {
    setWorkflowState({ show: true, step: 1, data: null, inputMode: 'voice' });
    if ('webkitSpeechRecognition' in window) {
      const rec = new window.webkitSpeechRecognition();
      rec.lang = 'zh-CN';
      rec.onresult = (e: any) => processBookingInput(e.results[0][0].transcript);
      rec.start();
    }
  };

  const processBookingInput = async (text: string) => {
    setWorkflowState(prev => ({ ...prev, step: 2 }));
    const data = await parseMeetingRequest(text, settings);
    if (data) {
        setWorkflowState(prev => ({ ...prev, step: 4, data }));
        createMeeting(data.topic || text, { date: data.date, location: data.location });
    }
  };

  const executeWorkflow = () => {
    window.open("https://emeet.cupl.edu.cn", "_blank");
    setWorkflowState(prev => ({ ...prev, show: false }));
  };

  const deleteMeeting = (id: string) => {
    if (confirm("确定删除？")) setMeetings(prev => prev.filter(m => m.id !== id));
  };

  const handlePortalClick = (view: View) => {
      if (view === View.MEETING_LIST) {
          setCurrentMeetingId(null); 
      }
      setCurrentView(view);
  };

  if (currentView === View.HOME) {
    const portalItems = [
        { id: View.MEETING_LIST, label: '智能会议', icon: CalendarDays, color: 'bg-indigo-600', desc: '全流程会议管理与 AI 辅助' },
        { id: View.PROJECT_MANAGER, label: '项目管理', icon: KanbanSquare, color: 'bg-blue-600', desc: '甘特图看板、项目进度与任务预警' },
        { id: View.ASSET_MANAGER, label: '资产管理', icon: Briefcase, color: 'bg-emerald-600', desc: '资产台账、Spreadsheet 运维与备注' },
        { id: View.DAILY_SCHEDULE, label: '工作排期', icon: Clock, color: 'bg-orange-500', desc: '专业日历视图、分屏任务处理' },
        { id: View.FORMS, label: '电子表单', icon: ClipboardCheck, color: 'bg-purple-600', desc: 'AI 扫描生单、在线字段维护' }
    ];

    return (
        <div className="min-h-screen bg-[#f3f4f6] font-sans flex flex-col">
            <header className="py-16 px-10 flex flex-col items-center">
                <div className="w-20 h-20 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl mx-auto flex items-center justify-center text-white text-4xl font-bold shadow-2xl shadow-indigo-500/30 mb-6 border border-white/20">X</div>
                <h1 className="text-4xl font-bold text-slate-900 mb-2 tracking-tight">小小博 AIpro 工作助手</h1>
                <p className="text-slate-500 text-lg font-medium">高效 · 智能 · 极简全能数字化工作门户</p>
                <div className="mt-6 flex gap-4">
                    <button onClick={() => setCurrentView(View.SETTINGS)} className="px-4 py-2 bg-white border border-gray-200 rounded-full text-gray-600 text-sm font-bold flex items-center gap-2 hover:bg-gray-50 transition-colors shadow-sm"><Settings size={14}/> AI 设置</button>
                </div>
            </header>
            <main className="flex-1 max-w-7xl mx-auto w-full px-10 pb-24">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {portalItems.map((item) => (
                        <div key={item.id} onClick={() => handlePortalClick(item.id)} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-200/50 hover:shadow-2xl hover:border-indigo-100 transition-all cursor-pointer group transform hover:-translate-y-2 flex flex-col min-h-[280px]">
                            <div className={`w-16 h-16 ${item.color} rounded-2xl flex items-center justify-center text-white mb-8 group-hover:scale-110 transition-transform shadow-lg border border-white/20`}><item.icon size={32}/></div>
                            <h3 className="text-2xl font-bold text-slate-900 mb-3">{item.label}</h3>
                            <p className="text-slate-500 text-sm mb-8 leading-relaxed font-medium">{item.desc}</p>
                            <div className="mt-auto flex items-center gap-2 text-indigo-600 font-bold text-sm">立即进入 <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform"/></div>
                        </div>
                    ))}
                    <div className="bg-white/40 p-8 rounded-[2.5rem] border-2 border-dashed border-gray-300 hover:border-indigo-300 hover:bg-white/60 transition-all flex flex-col items-center justify-center text-center group">
                        <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center text-gray-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 mb-4 transition-colors"><Grid size={24}/></div>
                        <h3 className="font-bold text-gray-600">更多数字化应用</h3>
                        <p className="text-xs text-gray-400 mt-1">持续更新中...</p>
                    </div>
                </div>
            </main>
            <footer className="py-10 text-center text-slate-400 text-xs border-t border-gray-200/50 bg-white/50 backdrop-blur-sm">&copy; 小小博 AIpro | 多模态智能工作底座 v3.6</footer>
        </div>
    );
  }

  if (currentView === View.ASSET_MANAGER) return <AssetManagerView onBack={() => setCurrentView(View.HOME)} settings={settings} />;
  if (currentView === View.PROJECT_MANAGER) return <ProjectManagerView onBack={() => setCurrentView(View.HOME)} />;
  if (currentView === View.DAILY_SCHEDULE) return (
      <div className="h-screen flex flex-col bg-white">
          <div className="bg-white border-b px-8 py-4 flex items-center gap-4 sticky top-0 z-50">
              <button onClick={() => setCurrentView(View.HOME)} className="text-gray-400 hover:text-indigo-600 transition-colors"><ArrowLeftCircle size={28}/></button>
              <h1 className="text-xl font-bold text-slate-900">智能日历排期</h1>
          </div>
          <div className="flex-1 overflow-auto"><DailyScheduleView settings={settings} /></div>
      </div>
  );
  if (currentView === View.FORMS) return (
      <div className="h-screen flex flex-col bg-white">
          <div className="bg-white border-b px-8 py-4 flex items-center gap-4 sticky top-0 z-50">
              <button onClick={() => setCurrentView(View.HOME)} className="text-gray-400 hover:text-indigo-600 transition-colors"><ArrowLeftCircle size={28}/></button>
              <h1 className="text-xl font-bold text-slate-900">电子表单中心</h1>
          </div>
          <div className="flex-1 overflow-auto"><FormsView settings={settings} /></div>
      </div>
  );
  if (currentView === View.SETTINGS) return (
    <div className="h-screen flex flex-col bg-white">
        <div className="bg-white border-b px-8 py-4 flex items-center gap-4 sticky top-0 z-50">
            <button onClick={() => setCurrentView(View.HOME)} className="text-gray-400 hover:text-indigo-600 transition-colors"><ArrowLeftCircle size={28}/></button>
            <h1 className="text-xl font-bold text-slate-900">系统全局设置</h1>
        </div>
        <div className="flex-1 overflow-auto"><SettingsView settings={settings} onSave={handleSaveSettings} /></div>
    </div>
  );

  return (
    <div className="flex h-screen w-full bg-[#f8f9fa] overflow-hidden">
      {workflowState.show && <WorkflowOverlay {...workflowState} setInputMode={m => setWorkflowState(prev => ({...prev, inputMode: m}))} onTextSubmit={processBookingInput} onExecute={executeWorkflow} onClose={() => setWorkflowState(prev => ({...prev, show: false}))} />}
      {currentView !== View.MEETING_LIST && activeMeeting && (
        <Sidebar currentView={currentView} onViewChange={setCurrentView} collapsed={sidebarCollapsed} toggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)} onBackToHome={() => { setCurrentMeetingId(null); setCurrentView(View.MEETING_LIST); }} />
      )}
      <main className="flex-1 flex flex-col overflow-hidden">
        {(currentView === View.MEETING_LIST || !activeMeeting) ? (
            <div className="p-10 overflow-y-auto h-full bg-[#f3f4f6]">
                <header className="flex justify-between items-center mb-10 max-w-6xl mx-auto">
                    <div>
                        <button onClick={() => setCurrentView(View.HOME)} className="text-indigo-600 mb-3 flex items-center gap-2 font-bold group"><ArrowLeftCircle size={20} className="group-hover:-translate-x-1 transition-transform"/> 返回门户</button>
                        <h1 className="text-3xl font-bold text-slate-900">智能会议室功能</h1>
                    </div>
                    <div className="flex gap-4">
                        <button onClick={startSmartBooking} className="px-6 py-2.5 bg-white border border-indigo-200 text-indigo-600 rounded-xl shadow-sm flex items-center gap-2 font-bold hover:bg-indigo-50 transition-colors"><Sparkles size={18}/> 智能预约</button>
                        <button onClick={() => { setNewMeetingName(''); setShowCreateModal(true); }} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl shadow-md flex items-center gap-2 font-bold hover:bg-indigo-700 transition-colors"><Plus size={18}/> 创建新会议</button>
                    </div>
                </header>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
                    {meetings.map(m => (
                        <div key={m.id} onClick={() => { setCurrentMeetingId(m.id); setCurrentView(View.DASHBOARD); }} className="p-8 bg-white rounded-[2rem] border border-gray-200 shadow-sm hover:shadow-xl hover:border-indigo-200 cursor-pointer relative group transition-all transform hover:-translate-y-1">
                            <button onClick={e => { e.stopPropagation(); deleteMeeting(m.id); }} className="absolute -top-3 -right-3 p-2.5 bg-white shadow-lg rounded-full text-red-500 opacity-0 group-hover:opacity-100 transition-all hover:scale-110 border border-gray-100"><Trash2 size={16}/></button>
                            <span className="text-xs font-bold text-indigo-500 uppercase tracking-wider">{m.info.date}</span>
                            <h3 className="text-2xl font-bold mt-2 text-slate-900 group-hover:text-indigo-700 transition-colors">{m.info.topic}</h3>
                            <div className="mt-4 flex gap-4 text-xs text-gray-400 font-bold uppercase tracking-widest">
                                <span className="flex items-center gap-1"><Users size={14}/> {m.participants.length} 人</span>
                                <span className="flex items-center gap-1"><Presentation size={14}/> {m.pptSlides?.length || 0} 页</span>
                            </div>
                        </div>
                    ))}
                    {meetings.length === 0 && (
                        <div className="col-span-full py-32 flex flex-col items-center justify-center text-center bg-white/40 border-2 border-dashed border-gray-300 rounded-[3rem]">
                            <CalendarDays size={64} className="text-gray-300 mb-4 opacity-50"/>
                            <h3 className="text-xl font-bold text-gray-400">还没有任何会议记录</h3>
                            <p className="text-sm text-gray-300 mt-1">点击右上角“创建新会议”开启智能管理</p>
                        </div>
                    )}
                </div>
            </div>
        ) : (
            <>
                <header className="h-16 border-b bg-white flex items-center px-8 justify-between shrink-0 shadow-sm">
                    <div className="flex items-center gap-4">
                        <button onClick={() => { setCurrentMeetingId(null); setCurrentView(View.MEETING_LIST); }} className="text-gray-400 hover:text-indigo-600 transition-colors"><ArrowLeftCircle size={24}/></button>
                        <h2 className="font-bold text-slate-900">{activeMeeting.info.topic}</h2>
                    </div>
                </header>
                <div className="flex-1 overflow-auto p-8 bg-[#f8f9fa]">
                    {currentView === View.DASHBOARD && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                            <div className="p-10 bg-white rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                                <h4 className="text-gray-400 text-xs font-bold mb-2 uppercase tracking-widest">参会总人数</h4>
                                <p className="text-5xl font-black text-slate-900">{activeMeeting.participants.length}</p>
                            </div>
                            <div className="p-10 bg-white rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                                <h4 className="text-gray-400 text-xs font-bold mb-2 uppercase tracking-widest">实时已签到</h4>
                                <p className="text-5xl font-black text-green-600">{activeMeeting.participants.filter(p => p.isSignedIn).length}</p>
                            </div>
                            <div className="p-10 bg-white rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                                <h4 className="text-gray-400 text-xs font-bold mb-2 uppercase tracking-widest">会议议程数</h4>
                                <p className="text-5xl font-black text-indigo-600">{activeMeeting.agenda.length}</p>
                            </div>
                        </div>
                    )}
                    {currentView === View.PARTICIPANTS && <ParticipantsView participants={activeMeeting.participants} setParticipants={p => updateActiveMeeting(m => ({...m, participants: typeof p === 'function' ? p(m.participants) : p}))} settings={settings} />}
                    {currentView === View.AGENDA && <AgendaView agenda={activeMeeting.agenda} setAgenda={a => updateActiveMeeting(m => ({...m, agenda: a}))} settings={settings} participants={activeMeeting.participants} setParticipants={p => updateActiveMeeting(m => ({...m, participants: typeof p === 'function' ? p(m.participants) : p}))} meetingInfo={activeMeeting.info} setMeetingInfo={i => updateActiveMeeting(m => ({...m, info: i}))} />}
                    {currentView === View.TABLE_CARDS && <TableCardView participants={activeMeeting.participants} settings={settings} meetingTopic={activeMeeting.info.topic} />}
                    {currentView === View.PPT_CREATOR && <PPTCreatorView slides={activeMeeting.pptSlides} setSlides={s => updateActiveMeeting(m => ({...m, pptSlides: s}))} settings={settings} topic={activeMeeting.info.topic} />}
                    {currentView === View.SIGN_IN && <SignInView participants={activeMeeting.participants} setParticipants={p => updateActiveMeeting(m => ({...m, participants: typeof p === 'function' ? p(m.participants) : p}))} meetingTopic={activeMeeting.info.topic} />}
                    {currentView === View.FILES && <FilesView files={activeMeeting.files} setFiles={f => updateActiveMeeting(m => ({...m, files: f}))} />}
                    {currentView === View.ASSISTANT && <AssistantView settings={settings} messages={activeMeeting.chatHistory || []} onSendMessage={handleAssistantSend} isThinking={assistantThinking} onSaveSettings={handleSaveSettings} participants={activeMeeting.participants} agenda={activeMeeting.agenda} files={activeMeeting.files} />}
                </div>
            </>
        )}
      </main>

      {showCreateModal && (
          <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-6 backdrop-blur-sm">
              <div className="bg-white p-10 rounded-[2rem] shadow-2xl w-full max-w-md animate-slideUp">
                  <div className="flex justify-between items-center mb-8">
                      <h3 className="text-2xl font-bold text-slate-900">创建新会议</h3>
                      <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-slate-900 transition-colors"><X size={28}/></button>
                  </div>
                  <div className="space-y-6">
                      <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">会议标题</label>
                          <input type="text" value={newMeetingName} onChange={e => setNewMeetingName(e.target.value)} placeholder="输入会议主题..." className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-lg font-bold" autoFocus />
                      </div>
                      <div className="flex gap-4">
                          <button onClick={() => setShowCreateModal(false)} className="flex-1 py-4 bg-gray-100 rounded-2xl text-slate-600 font-bold hover:bg-gray-200 transition-colors">取消</button>
                          <button onClick={() => { createMeeting(newMeetingName); setShowCreateModal(false); }} disabled={!newMeetingName.trim()} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-lg shadow-indigo-200">开始创建</button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default App;
