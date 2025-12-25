
// ... existing imports ...
import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { View, Participant, AgendaItem, AppSettings, MeetingBasicInfo, Meeting, MeetingFile, PPTSlide, ChatMessage } from './types';
import { ParticipantsView } from './components/ParticipantsView';
import { AgendaView } from './components/AgendaView';
import { TableCardView } from './components/TableCardView';
import { SettingsView } from './components/SettingsView';
import { AssistantView } from './components/AssistantView';
import { SignInView } from './components/SignInView';
import { FilesView } from './components/FilesView'; 
import { PPTCreatorView } from './components/PPTCreatorView';
import { AssetManagerView } from './components/AssetManagerView';
import { FileText, LayoutDashboard, UserCircle2, ClipboardCheck, Plus, Calendar, ArrowRight, Trash2, Mic, Mic2, BarChart3, Clock, Users, X, Edit, MoreVertical, ExternalLink, LogIn, Loader2, Cpu, CheckCircle2, ArrowRightCircle, Code, Lock, Play, Keyboard, MousePointerClick, MessageSquare, Sparkles, AlertTriangle, Presentation, Briefcase, FormInput, LayoutGrid, ArrowLeftCircle } from 'lucide-react';
import { parseMeetingRequest, generateChatResponse } from './services/aiService';

// Speech Recognition Types
declare global {
  interface Window {
    webkitSpeechRecognition: any;
  }
}

// ... WorkflowOverlay component (unchanged) ...
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
                                <p className="text-xs text-center text-gray-400 mt-4">
                                    *脚本将尝试点击“申请会议”按钮并填入信息。
                                </p>
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
  const [showEditModal, setShowEditModal] = useState(false);
  const [newMeetingName, setNewMeetingName] = useState('');
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  
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

  const handleCreateClick = () => {
      setNewMeetingName('');
      setShowCreateModal(true);
  };

  const confirmCreateMeeting = () => {
      const name = newMeetingName.trim() || '新会议 ' + new Date().toLocaleDateString();
      createMeeting(name, { topic: name });
      setShowCreateModal(false);
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

  const handleEditClick = (meeting: Meeting, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setEditingMeeting(meeting);
      setShowEditModal(true);
  };

  const saveMeetingEdit = () => {
      if (!editingMeeting) return;
      setMeetings(prev => prev.map(m => m.id === editingMeeting.id ? editingMeeting : m));
      setShowEditModal(false);
      setEditingMeeting(null);
  };

  // Helper to update active meeting
  const activeMeeting = meetings.find(m => m.id === currentMeetingId);
  const updateActiveMeeting = (updater: (m: Meeting) => Meeting) => {
      if (!activeMeeting) return;
      const updated = updater({ ...activeMeeting });
      setMeetings(meetings.map(m => m.id === updated.id ? updated : m));
  };

  const handleAssistantSend = async (text: string, image?: string) => {
      if (!activeMeeting || (!text.trim() && !image)) return;

      const userMsg: ChatMessage = {
          id: Date.now().toString(),
          role: 'user',
          content: text,
          image: image, // Store image data URL for display
          timestamp: Date.now()
      };

      // Optimistic update
      const newHistory = [...(activeMeeting.chatHistory || []), userMsg];
      updateActiveMeeting(m => ({ ...m, chatHistory: newHistory }));
      
      setAssistantThinking(true);

      // Build context
      let systemInstruction = `You are an expert academic conference organizer assistant.`;
      if (settings.knowledgeBase) {
          systemInstruction += `\n\nUSER PERSONAL STYLE / KNOWLEDGE BASE:\n${settings.knowledgeBase}`;
      }
      
      let userQuery: string | { text: string, images: string[] } = text;
      
      // If image is present, construct payload with image data (stripping prefix for API if needed, 
      // but aiService handles base64 stripping if passed correctly)
      if (image) {
          // aiService expects array of base64 strings without prefix usually, or handles them.
          // let's strip prefix here to be safe if we pass it as "images" array
          const base64Data = image.split(',')[1] || image;
          userQuery = {
              text: text || "Please analyze this image.",
              images: [base64Data]
          };
      } else {
          // Pure text context injection
          if (text.includes("会议纪要") || text.includes("summarize") || text.includes("总结")) {
              let summaryContext = `\n\n--- MEETING DATA FOR SUMMARY ---\n`;
              if (activeMeeting.participants.length > 0) summaryContext += `Participants (${activeMeeting.participants.length}): ${activeMeeting.participants.map(p => p.nameCN).join(', ')}\n`;
              if (activeMeeting.agenda.length > 0) summaryContext += `Agenda:\n${activeMeeting.agenda.map(a => `- ${a.time} ${a.title} (${a.speaker})`).join('\n')}\n`;
              userQuery = `${text}\n\n${summaryContext}`;
          }
      }

      try {
          const reply = await generateChatResponse(settings, userQuery, systemInstruction);
          
          const aiMsg: ChatMessage = {
              id: (Date.now() + 1).toString(),
              role: 'assistant',
              content: reply,
              timestamp: Date.now()
          };
          
          setMeetings(prevMeetings => prevMeetings.map(m => 
              m.id === activeMeeting.id ? { ...m, chatHistory: [...(m.chatHistory || []), userMsg, aiMsg] } : m
          ));

      } catch (e: any) {
          console.error("Assistant Error", e);
          const errorMsg: ChatMessage = {
              id: (Date.now() + 1).toString(),
              role: 'assistant',
              content: `Error: ${e.message || "Something went wrong."}`,
              timestamp: Date.now()
          };
           setMeetings(prevMeetings => prevMeetings.map(m => 
              m.id === activeMeeting.id ? { ...m, chatHistory: [...(m.chatHistory || []), userMsg, errorMsg] } : m
          ));
      } finally {
          setAssistantThinking(false);
      }
  };

  const startSmartBooking = () => {
    setWorkflowState({ show: true, step: 1, data: null, inputMode: 'voice' });
    setTimeout(() => startVoiceRec(), 500);
  };

  const startVoiceRec = () => {
      if (!('webkitSpeechRecognition' in window)) {
        alert("您的浏览器不支持语音识别，请使用文本输入。");
        setWorkflowState(prev => ({ ...prev, inputMode: 'text' }));
        return;
      }
      const recognition = new window.webkitSpeechRecognition();
      recognition.lang = 'zh-CN';
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.onresult = async (event: any) => {
          const transcript = event.results[0][0].transcript;
          if (transcript) processBookingInput(transcript);
      };
      recognition.start();
  };

  const processBookingInput = async (text: string) => {
    setWorkflowState(prev => ({ ...prev, step: 2 }));
    const extracted = await parseMeetingRequest(text, settings);
    if (extracted) {
        setTimeout(() => setWorkflowState(prev => ({ ...prev, step: 3 })), 1000);
        setTimeout(() => {
            setWorkflowState(prev => ({ ...prev, show: true, step: 4, data: extracted }));
            createMeeting(extracted.topic || text, { date: extracted.date, location: extracted.location });
        }, 2000);
    } else {
        alert("未能识别会议信息，请重试。");
        setWorkflowState(prev => ({ ...prev, show: false, step: 1 }));
    }
  };

  const executeWorkflow = () => {
      const script = `(function(){ console.log("Auto-filling..."); const data = ${JSON.stringify(workflowState.data)}; 
      /* ... (Shortened script for brevity, same logic as before) ... */
      })();`;
      navigator.clipboard.writeText(script).then(() => {
          window.open("https://emeet.cupl.edu.cn/app.DTManage/?m=dtmanage&c=AMeetScreen&a=initMain", "_blank");
          setWorkflowState(prev => ({ ...prev, show: false }));
          alert("自动化脚本已复制！跳转后请按 F12 -> Console -> Ctrl+V 执行。");
      });
  };

  const deleteMeeting = (id: string) => {
    if (window.confirm('确定要删除这个会议吗？')) {
      setMeetings(prev => prev.filter(m => m.id !== id));
      if (currentMeetingId === id) {
        setCurrentMeetingId(null);
        setCurrentView(View.MEETING_LIST);
      }
    }
  };

  const selectMeeting = (id: string) => {
      setCurrentMeetingId(id);
      setCurrentView(View.DASHBOARD);
  };

  if (currentView === View.HOME) {
      return (
          <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center font-sans">
              {/* ... Home View Content (Same as before) ... */}
              <div className="max-w-4xl w-full px-6 text-center">
                  <div className="mb-12">
                      <div className="w-20 h-20 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl mx-auto flex items-center justify-center text-white text-4xl font-bold shadow-2xl shadow-indigo-500/30 mb-6">X</div>
                      <h1 className="text-4xl font-serif-sc font-bold text-slate-900 mb-4">xiaoxiaobo 工作智能助手</h1>
                      <p className="text-xl text-slate-500">智能工作全流程管理 · 高效 · 便捷 · 智能</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      <div onClick={() => setCurrentView(View.MEETING_LIST)} className="bg-white p-8 rounded-3xl shadow-lg border border-gray-100 hover:shadow-2xl hover:border-indigo-100 transition-all cursor-pointer group transform hover:-translate-y-2">
                          <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"><LayoutDashboard size={28}/></div>
                          <h3 className="text-xl font-bold text-gray-900 mb-2">智能会议功能</h3>
                          <p className="text-sm text-gray-500">会议创建、议程安排、桌牌制作、AI 辅助全流程管理</p>
                      </div>
                      <div onClick={() => setCurrentView(View.ASSET_MANAGER)} className="bg-white p-8 rounded-3xl shadow-lg border border-gray-100 hover:shadow-2xl hover:border-green-100 transition-all cursor-pointer group transform hover:-translate-y-2">
                          <div className="w-14 h-14 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"><Briefcase size={28}/></div>
                          <h3 className="text-xl font-bold text-gray-900 mb-2">资产管理功能</h3>
                          <p className="text-sm text-gray-500">固定资产登记、位置管理、在线编辑与Excel导出</p>
                      </div>
                      <div onClick={() => alert("电子表单功能开发中...")} className="bg-white p-8 rounded-3xl shadow-lg border border-gray-100 hover:shadow-2xl hover:border-orange-100 transition-all cursor-pointer group transform hover:-translate-y-2 relative overflow-hidden">
                           <div className="absolute top-0 right-0 bg-orange-500 text-white text-[10px] px-2 py-1 rounded-bl-lg font-bold">Coming Soon</div>
                          <div className="w-14 h-14 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"><FormInput size={28}/></div>
                          <h3 className="text-xl font-bold text-gray-900 mb-2">电子表单功能</h3>
                          <p className="text-sm text-gray-500">自定义表单、数据收集、智能统计与分析</p>
                      </div>
                  </div>
                  <div className="mt-16 text-center text-slate-400 text-xs font-mono">copyright xiaoxiaobo</div>
              </div>
          </div>
      );
  }

  if (currentView === View.ASSET_MANAGER) return <AssetManagerView onBack={() => setCurrentView(View.HOME)} />;

  return (
    <div className="flex h-screen w-full bg-[#f8f9fa] text-gray-800 font-sans">
      {workflowState.show && <WorkflowOverlay {...workflowState} setInputMode={m => setWorkflowState(prev => ({...prev, inputMode: m}))} onTextSubmit={processBookingInput} onExecute={executeWorkflow} onClose={() => setWorkflowState(prev => ({...prev, show: false}))} />}
      
      {currentView !== View.MEETING_LIST && activeMeeting && (
        <Sidebar currentView={currentView} onViewChange={setCurrentView} collapsed={sidebarCollapsed} toggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)} onBackToHome={() => { setCurrentMeetingId(null); setCurrentView(View.MEETING_LIST); }} />
      )}

      <main className="flex-1 overflow-hidden relative flex flex-col transition-all duration-300">
        {(currentView === View.MEETING_LIST || !activeMeeting) ? (
             // ... Meeting List View (Same as before) ...
             <div className="min-h-screen bg-slate-50 p-8 md:p-16 font-sans relative overflow-y-auto flex flex-col">
              <div className="max-w-6xl mx-auto w-full flex-1">
                  <header className="mb-12 flex justify-between items-end">
                      <div>
                           <div className="flex items-center gap-2 mb-2">
                               <button onClick={() => setCurrentView(View.HOME)} className="text-gray-400 hover:text-indigo-600 flex items-center gap-1 text-sm font-medium transition-colors">
                                   <ArrowLeftCircle size={16}/> 返回主页
                               </button>
                           </div>
                          <h1 className="text-4xl font-serif-sc font-bold text-slate-900 mb-3 flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center text-white text-xl shadow-lg">M</div>
                              智能会议功能
                          </h1>
                          <div className="flex items-center gap-4">
                              <p className="text-slate-500 text-lg">智能工作全流程管理</p>
                              <a href="https://emeet.cupl.edu.cn/app.DTManage/?m=dtmanage&c=AMeetScreen&a=initMain" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-1.5 bg-white border border-indigo-100 rounded-lg text-indigo-700 hover:bg-indigo-50 transition-all font-serif-sc text-sm"><LogIn size={14}/> 登录法大会议系统</a>
                          </div>
                      </div>
                      <div className="flex gap-3">
                          <button onClick={startSmartBooking} className="px-6 py-3 bg-white text-indigo-600 rounded-xl font-medium shadow-lg hover:shadow-xl transition-all flex items-center gap-2 hover:bg-gray-50"><Sparkles size={20} className="text-purple-500" /> 智能预约</button>
                          <button onClick={handleCreateClick} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all flex items-center gap-2 hover:bg-indigo-700"><Plus size={20} /> 创建新会议</button>
                      </div>
                  </header>
                  {/* ... Dashboard Stats & List (Same as before) ... */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4"><div className="p-3 bg-blue-50 rounded-full text-blue-600"><BarChart3 size={24} /></div><div><p className="text-sm text-gray-500 font-medium">累计会议</p><p className="text-2xl font-bold text-gray-900">{meetings.length} <span className="text-xs font-normal text-gray-400">场</span></p></div></div>
                      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4"><div className="p-3 bg-green-50 rounded-full text-green-600"><Clock size={24} /></div><div><p className="text-sm text-gray-500 font-medium">即将开始</p><p className="text-2xl font-bold text-gray-900">{meetings.filter(m => new Date(m.info.date) >= new Date()).length} <span className="text-xs font-normal text-gray-400">场</span></p></div></div>
                      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4"><div className="p-3 bg-purple-50 rounded-full text-purple-600"><Users size={24} /></div><div><p className="text-sm text-gray-500 font-medium">累计参会</p><p className="text-2xl font-bold text-gray-900">{meetings.reduce((acc, m) => acc + m.participants.length, 0)} <span className="text-xs font-normal text-gray-400">人次</span></p></div></div>
                  </div>
                  {meetings.length === 0 ? (
                      <div className="text-center py-24 bg-white rounded-3xl shadow-sm border border-gray-100"><div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6"><Calendar size={40} className="text-indigo-300" /></div><h3 className="text-2xl font-bold text-gray-800 mb-2">暂无会议</h3><p className="text-gray-400 mb-8">点击右上角创建您的第一个智能会议</p></div>
                  ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
                          {meetings.map(meeting => (
                              <div key={meeting.id} onClick={() => selectMeeting(meeting.id)} className="group bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-indigo-100 transition-all cursor-pointer relative overflow-visible flex flex-col">
                                  <button onClick={(e) => { e.stopPropagation(); deleteMeeting(meeting.id); }} className="absolute -top-3 -right-3 p-2 bg-white text-gray-400 hover:text-red-600 rounded-full shadow-md border border-gray-200 z-50 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16} /></button>
                                  <div className="p-6 flex-1">
                                      <div className="flex justify-between items-start mb-4">
                                          <div className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold uppercase tracking-wide">{meeting.info.date}</div>
                                          <button onClick={(e) => handleEditClick(meeting, e)} className="text-gray-300 hover:text-indigo-600 z-20"><Edit size={16} /></button>
                                      </div>
                                      <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-indigo-700 transition-colors line-clamp-1">{meeting.info.topic}</h3>
                                      <p className="text-gray-500 text-sm mb-6 flex items-center gap-2"><UserCircle2 size={14} /> {meeting.participants.length} 人参会</p>
                                      <div className="flex items-center text-sm font-medium text-indigo-600 gap-1 opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all">进入管理 <ArrowRight size={14} /></div>
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
              <div className="py-6 text-center text-slate-400 text-xs font-mono mt-auto border-t border-slate-100">copyright xiaoxiaobo</div>
             </div>
        ) : (
            <>
                <header className="bg-white border-b border-gray-200 h-16 flex items-center px-8 justify-between shadow-sm z-10 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setCurrentView(View.MEETING_LIST)} className="text-gray-400 hover:text-indigo-600 mr-2 transition-colors"><ArrowLeftCircle size={20}/></button>
                        <h1 className="text-xl font-serif-sc font-bold text-slate-800 tracking-tight">智能会议助手 <span className="text-indigo-600">AI Meeting</span></h1>
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded border border-gray-200 uppercase tracking-wide">{activeMeeting.info.topic}</span>
                        {assistantThinking && <span className="flex items-center gap-1 text-xs text-indigo-500 animate-pulse bg-indigo-50 px-2 py-0.5 rounded"><Sparkles size={10} /> 助手思考中...</span>}
                    </div>
                    <div className="text-sm text-gray-400 italic">{activeMeeting.info.date}</div>
                </header>

                <div className="flex-1 overflow-auto bg-[#f8f9fa]">
                    {currentView === View.PARTICIPANTS && <ParticipantsView participants={activeMeeting.participants} setParticipants={(p) => updateActiveMeeting(m => ({...m, participants: typeof p === 'function' ? p(m.participants) : p}))} settings={settings} />}
                    {currentView === View.AGENDA && <AgendaView agenda={activeMeeting.agenda} setAgenda={(a) => updateActiveMeeting(m => ({...m, agenda: a}))} settings={settings} participants={activeMeeting.participants} setParticipants={(p) => updateActiveMeeting(m => ({...m, participants: typeof p === 'function' ? p(m.participants) : p}))} meetingInfo={activeMeeting.info} setMeetingInfo={(i) => updateActiveMeeting(m => ({...m, info: i}))} />}
                    {currentView === View.TABLE_CARDS && <TableCardView participants={activeMeeting.participants} settings={settings} meetingTopic={activeMeeting.info.topic} />}
                    {currentView === View.PPT_CREATOR && <PPTCreatorView slides={activeMeeting.pptSlides} setSlides={(s) => updateActiveMeeting(m => ({...m, pptSlides: s}))} settings={settings} topic={activeMeeting.info.topic} />}
                    {currentView === View.SIGN_IN && <SignInView participants={activeMeeting.participants} setParticipants={(p) => updateActiveMeeting(m => ({...m, participants: typeof p === 'function' ? p(m.participants) : p}))} meetingTopic={activeMeeting.info.topic} />}
                    {currentView === View.FILES && <FilesView files={activeMeeting.files} setFiles={(f) => updateActiveMeeting(m => ({...m, files: f}))} />}
                    {currentView === View.SETTINGS && <SettingsView settings={settings} onSave={handleSaveSettings} />}
                    {currentView === View.ASSISTANT && <AssistantView
                        settings={settings}
                        files={activeMeeting.files}
                        participants={activeMeeting.participants}
                        agenda={activeMeeting.agenda}
                        onSaveSettings={handleSaveSettings}
                        messages={activeMeeting.chatHistory || []}
                        onSendMessage={handleAssistantSend}
                        isThinking={assistantThinking}
                    />}
                    {/* ... Dashboard (Same as before) ... */}
                    {currentView === View.DASHBOARD && (
                        <div className="p-10 max-w-7xl mx-auto">
                           <div className="mb-10"><h1 className="text-4xl font-serif-sc font-bold text-slate-900 mb-2">{activeMeeting.info.topic}</h1><p className="text-slate-500">会议日期: {activeMeeting.info.date} | 地点: {activeMeeting.info.location || '待定'}</p></div>
                           <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
                               <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all relative overflow-hidden group"><div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><UserCircle2 size={100} className="text-indigo-900"/></div><h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">参会人数</h3><p className="text-5xl font-black text-slate-900">{activeMeeting.participants.length}</p></div>
                               <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all relative overflow-hidden group"><div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><ClipboardCheck size={100} className="text-green-900"/></div><h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">已签到</h3><p className="text-5xl font-black text-green-600">{activeMeeting.participants.filter(p => p.isSignedIn).length}</p></div>
                               <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all relative overflow-hidden group"><div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Presentation size={100} className="text-orange-900"/></div><h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">PPT 页面</h3><p className="text-5xl font-black text-slate-900">{activeMeeting.pptSlides?.length || 0}</p></div>
                               <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-8 rounded-2xl shadow-lg text-white relative overflow-hidden"><h3 className="text-lg font-bold mb-4 z-10 relative">快速操作</h3><div className="grid grid-cols-2 gap-3 z-10 relative"><button onClick={() => setCurrentView(View.PARTICIPANTS)} className="p-2 bg-white/10 rounded hover:bg-white/20 text-xs">管理人员</button><button onClick={() => setCurrentView(View.TABLE_CARDS)} className="p-2 bg-white/10 rounded hover:bg-white/20 text-xs">打印桌牌</button><button onClick={() => setCurrentView(View.PPT_CREATOR)} className="p-2 bg-white/10 rounded hover:bg-white/20 text-xs">PPT 制作</button></div></div>
                           </div>
                        </div>
                    )}
                </div>
            </>
        )}
      </main>
      
      {/* ... Modals (Create/Edit) ... */}
      {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md transform transition-all scale-100">
                  <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold text-gray-900">创建新会议</h3><button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button></div>
                  <div className="mb-6"><label className="block text-sm font-medium text-gray-700 mb-2">会议名称</label><input type="text" value={newMeetingName} onChange={(e) => setNewMeetingName(e.target.value)} placeholder="例如：2025年度学术研讨会" className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent" autoFocus/></div>
                  <div className="flex gap-3"><button onClick={() => setShowCreateModal(false)} className="flex-1 py-3 text-gray-700 font-medium bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">取消</button><button onClick={confirmCreateMeeting} disabled={!newMeetingName.trim()} className="flex-1 py-3 text-white font-medium bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors disabled:opacity-50">创建</button></div>
              </div>
          </div>
      )}
       {showEditModal && editingMeeting && (
          <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md transform transition-all scale-100">
                  <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold text-gray-900">编辑会议信息</h3><button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button></div>
                  <div className="space-y-4 mb-6">
                      <div><label className="block text-sm font-medium text-gray-700 mb-2">会议名称</label><input type="text" value={editingMeeting.info.topic} onChange={(e) => setEditingMeeting({...editingMeeting, info: {...editingMeeting.info, topic: e.target.value}})} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500"/></div>
                      <div><label className="block text-sm font-medium text-gray-700 mb-2">日期</label><input type="date" value={editingMeeting.info.date} onChange={(e) => setEditingMeeting({...editingMeeting, info: {...editingMeeting.info, date: e.target.value}})} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500"/></div>
                      <div><label className="block text-sm font-medium text-gray-700 mb-2">地点</label><input type="text" value={editingMeeting.info.location} onChange={(e) => setEditingMeeting({...editingMeeting, info: {...editingMeeting.info, location: e.target.value}})} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500"/></div>
                  </div>
                  <div className="flex gap-3"><button onClick={() => setShowEditModal(false)} className="flex-1 py-3 text-gray-700 font-medium bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">取消</button><button onClick={saveMeetingEdit} className="flex-1 py-3 text-white font-medium bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors">保存修改</button></div>
              </div>
          </div>
      )}
    </div>
  );
};
