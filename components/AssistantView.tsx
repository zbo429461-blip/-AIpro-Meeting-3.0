
import React, { useState, useRef, useEffect } from 'react';
import { AppSettings, ChatMessage, MeetingBasicInfo, MeetingFile, Participant, AgendaItem } from '../types';
import { getAIProviderLabel } from '../services/aiService';
import { Send, Bot, User, Trash2, Loader2, Sparkles, FileEdit, CheckSquare, Mic2, Mail, FileText, Megaphone, BookOpen, Save, X, MessageSquare, Code, Languages, PenTool, Layout } from 'lucide-react';

interface AssistantViewProps {
  settings: AppSettings;
  meetingInfo?: MeetingBasicInfo; 
  files?: MeetingFile[];
  participants?: Participant[];
  agenda?: AgendaItem[];
  onSaveSettings: (settings: AppSettings) => void;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  isThinking: boolean;
  setMessages?: (messages: ChatMessage[]) => void; 
}

export const AssistantView: React.FC<AssistantViewProps> = ({ 
    settings, 
    meetingInfo, 
    onSaveSettings,
    messages,
    onSendMessage,
    isThinking,
    setMessages
}) => {
  const [input, setInput] = useState('');
  const [showKnowledgeBase, setShowKnowledgeBase] = useState(false);
  const [localKnowledge, setLocalKnowledge] = useState(settings.knowledgeBase || '');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const aiProviderLabel = getAIProviderLabel(settings);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking]);

  useEffect(() => {
    setLocalKnowledge(settings.knowledgeBase || '');
  }, [settings.knowledgeBase]);

  const handleSaveKnowledge = () => {
      onSaveSettings({
          ...settings,
          knowledgeBase: localKnowledge
      });
      setShowKnowledgeBase(false);
  };

  const handleSend = async (textOverride?: string) => {
    const textToSend = textOverride || input;
    if (!textToSend.trim()) return;
    
    setInput('');
    onSendMessage(textToSend);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const taskGroups = [
    {
      title: "行政/会议任务",
      items: [
        {label: "起草通知", icon: FileEdit, color: "indigo", prompt: "帮我起草一份正式的会议通知，包含会议主题、时间、地点，并按要求提供人员名单占位符"},
        {label: "筹备清单", icon: CheckSquare, color: "green", prompt: "请生成一份详细的会议筹备工作检查清单(To-Do List)"},
        {label: "总结纪要", icon: MessageSquare, color: "teal", prompt: "请根据本次会议的全部信息，生成一份完整的会议纪要。"},
      ]
    },
    {
      title: "日常办公辅助",
      items: [
        {label: "翻译助手", icon: Languages, color: "orange", prompt: "请帮我把下面这段话翻译成地道的英文："},
        {label: "代码片段", icon: Code, color: "slate", prompt: "请帮我写一段 Python 脚本，功能是："},
        {label: "周报润色", icon: PenTool, color: "blue", prompt: "这是我本周的工作要点，请帮我润色成一份专业规范的周报："},
      ]
    },
    {
      title: "创意与写作",
      items: [
        {label: "方案策划", icon: Layout, color: "purple", prompt: "我需要策划一个团建活动方案，参与人数50人，预算人均300元，请给出建议。"},
        {label: "致辞撰写", icon: Mic2, color: "rose", prompt: "请帮我写一段在行业研讨会上的开幕致辞，基调要专业且充满活力。"},
      ]
    }
  ];

  return (
    <div className="flex h-full bg-slate-50 relative overflow-hidden">
      <div className="flex-1 flex flex-col h-full min-w-0">
        <div className="flex-none p-6 bg-white border-b border-gray-200 flex justify-between items-center shadow-sm z-10">
            <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <Sparkles className="text-indigo-600" size={24}/>
                    小小博 AIpro 助手
                </h2>
                <p className="text-sm text-gray-500">
                    底层支持: {aiProviderLabel} | 全能办公辅助
                </p>
            </div>
            <div className="flex gap-2">
                <button 
                    onClick={() => setShowKnowledgeBase(!showKnowledgeBase)}
                    className={`p-2 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium
                        ${showKnowledgeBase ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-gray-100 text-gray-600'}`} 
                >
                    <BookOpen size={20} /> <span className="hidden md:inline">工作背景/风格设定</span>
                </button>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                     <div className="w-16 h-16 rounded-3xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-sm">
                        <Bot size={32} />
                     </div>
                     <div className="max-w-md">
                         <h3 className="text-lg font-bold text-slate-800">您好！我是您的 AI 全能办公助手</h3>
                         <p className="text-gray-500 text-sm mt-2">我可以帮您处理会议、写作、翻译、代码编写等各种办公任务。请直接在下方输入您的需求。</p>
                     </div>
                </div>
            )}
            
            {messages.map((msg) => (
            <div 
                key={msg.id} 
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
                <div className={`flex max-w-[85%] md:max-w-[75%] gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm
                        ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 border border-gray-100'}`}>
                        {msg.role === 'user' ? <User size={20} /> : <Bot size={20} />}
                    </div>
                    
                    <div className={`p-4 rounded-2xl shadow-sm text-sm leading-relaxed whitespace-pre-wrap
                        ${msg.role === 'user' 
                            ? 'bg-indigo-600 text-white rounded-tr-none' 
                            : 'bg-white text-slate-800 border border-gray-100 rounded-tl-none shadow-md'
                        }`}>
                        {msg.content}
                    </div>
                </div>
            </div>
            ))}
            {isThinking && (
                <div className="flex justify-start">
                    <div className="flex gap-3">
                        <div className="w-10 h-10 rounded-full bg-white text-indigo-600 border border-gray-100 flex items-center justify-center shadow-sm">
                            <Bot size={20} />
                        </div>
                        <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-gray-100 shadow-sm flex items-center gap-2 text-gray-500 text-sm">
                            <Loader2 className="animate-spin" size={16} />
                            AI 正在思考中...
                        </div>
                    </div>
                </div>
            )}
            <div ref={messagesEndRef} />
        </div>

        <div className="flex-none p-4 bg-white border-t border-gray-200">
            <div className="max-w-5xl mx-auto">
                <div className="flex gap-6 mb-4 overflow-x-auto pb-2">
                    {taskGroups.map((group, gIdx) => (
                        <div key={gIdx} className="flex-shrink-0">
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">{group.title}</div>
                            <div className="flex gap-2">
                                {group.items.map((action, idx) => (
                                    <button 
                                        key={idx}
                                        onClick={() => handleSend(action.prompt)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors border border-gray-200 shadow-sm whitespace-nowrap`}
                                    >
                                        <action.icon size={12} className={`text-${action.color}-600`}/> {action.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="relative">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={`在此输入您的任何办公需求...`}
                        className="w-full pl-4 pr-12 py-3 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none h-[80px] shadow-lg bg-white transition-all text-sm"
                    />
                    <button 
                        onClick={() => handleSend()}
                        disabled={isThinking || !input.trim()}
                        className="absolute right-3 bottom-3 p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-md"
                    >
                        <Send size={20} />
                    </button>
                </div>
            </div>
        </div>
      </div>

      <div className={`fixed inset-y-0 right-0 w-80 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out border-l border-gray-200 z-50 flex flex-col ${showKnowledgeBase ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <BookOpen size={18} className="text-indigo-600"/> 风格与背景设定
              </h3>
              <button onClick={() => setShowKnowledgeBase(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
              </button>
          </div>
          <div className="flex-1 p-4 overflow-y-auto">
               <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                   告诉 AI 您的个人行文风格、常用专业术语、所在单位背景。AI 将据此为您提供更定制化的响应。
               </p>
               <textarea 
                   value={localKnowledge}
                   onChange={(e) => setLocalKnowledge(e.target.value)}
                   className="w-full h-2/3 p-3 border border-gray-300 rounded-lg text-sm leading-relaxed resize-none focus:ring-2 focus:ring-indigo-500"
                   placeholder="示例：我的回复风格要专业严谨；常用缩写 CUPL 表示中国政法大学；主要负责学术研讨会的策划..."
               />
          </div>
          <div className="p-4 border-t border-gray-200 bg-gray-50">
              <button 
                onClick={handleSaveKnowledge}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-md"
              >
                  <Save size={18} /> 保存配置
              </button>
          </div>
      </div>
    </div>
  );
};
