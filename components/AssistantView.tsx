import React, { useState, useRef, useEffect } from 'react';
import { AppSettings, ChatMessage, MeetingBasicInfo, MeetingFile, Participant, AgendaItem } from '../types';
import { getAIProviderLabel } from '../services/aiService';
import { Send, Bot, User, Trash2, Loader2, Sparkles, FileEdit, CheckSquare, Mic2, Mail, FileText, Megaphone, BookOpen, Save, X, MessageSquare } from 'lucide-react';

interface AssistantViewProps {
  settings: AppSettings;
  meetingInfo?: MeetingBasicInfo; 
  files?: MeetingFile[];
  participants?: Participant[];
  agenda?: AgendaItem[];
  onSaveSettings: (settings: AppSettings) => void;
  // State from parent
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  isThinking: boolean;
  setMessages?: (messages: ChatMessage[]) => void; // Optional local reset
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

  return (
    <div className="flex h-full bg-slate-50 relative overflow-hidden">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        <div className="flex-none p-6 bg-white border-b border-gray-200 flex justify-between items-center shadow-sm z-10">
            <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <Sparkles className="text-indigo-600" size={24}/>
                    智能会议助手
                </h2>
                <p className="text-sm text-gray-500">
                    {meetingInfo?.topic || "Conference AI Assistant"}
                     <span className="font-mono text-xs ml-2 px-1.5 py-0.5 bg-slate-100 rounded border border-gray-200">
                        {aiProviderLabel}
                    </span>
                </p>
            </div>
            <div className="flex gap-2">
                <button 
                    onClick={() => setShowKnowledgeBase(!showKnowledgeBase)}
                    className={`p-2 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium
                        ${showKnowledgeBase ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-gray-100 text-gray-600'}`} 
                    title="设置个人知识库"
                >
                    <BookOpen size={20} /> <span className="hidden md:inline">知识库</span>
                </button>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.length === 0 && (
                <div className="flex justify-start">
                     <div className="flex max-w-[85%] md:max-w-[75%] gap-3 flex-row">
                        <div className="w-10 h-10 rounded-full bg-white text-indigo-600 border border-gray-100 flex items-center justify-center flex-shrink-0 shadow-sm">
                            <Bot size={20} />
                        </div>
                        <div className="p-4 rounded-2xl shadow-sm text-sm leading-relaxed bg-white text-slate-800 border border-gray-100 rounded-tl-none">
                            你好！我是您的智能会议助手。我可以帮您撰写通知、策划议程、生成致辞稿或邀请函。
                        </div>
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
                            : 'bg-white text-slate-800 border border-gray-100 rounded-tl-none'
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
                            正在思考...
                        </div>
                    </div>
                </div>
            )}
            <div ref={messagesEndRef} />
        </div>

        <div className="flex-none p-4 bg-white border-t border-gray-200">
            {/* Quick Actions */}
            <div className="flex gap-2 mb-3 overflow-x-auto pb-2 scrollbar-hide">
                {[
                    {label: "起草通知", icon: FileEdit, color: "indigo", prompt: "帮我起草一份正式的会议通知，包含会议主题、时间、地点，并按要求提供人员名单占位符"},
                    {label: "筹备清单", icon: CheckSquare, color: "green", prompt: "请生成一份详细的会议筹备工作检查清单(To-Do List)"},
                    {label: "开幕致辞", icon: Mic2, color: "purple", prompt: "帮我写一段热情洋溢的会议开幕致辞"},
                    {label: "邀请邮件", icon: Mail, color: "blue", prompt: "帮我写一封邀请专家做主题报告的邮件"},
                    {label: "纪要模板", icon: FileText, color: "orange", prompt: "帮我生成一个标准的会议纪要模板"},
                    {label: "总结纪要", icon: MessageSquare, color: "teal", prompt: "请根据本次会议的全部信息，生成一份完整的会议纪要。"},
                    {label: "新闻通稿", icon: Megaphone, color: "rose", prompt: "帮我写一篇关于本次会议的新闻通稿"}
                ].map((action, idx) => (
                    <button 
                        key={idx}
                        onClick={() => handleSend(action.prompt)}
                        className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-${action.color}-50 text-${action.color}-700 rounded-full text-xs font-medium hover:bg-${action.color}-100 transition-colors border border-${action.color}-100`}
                    >
                        <action.icon size={12}/> {action.label}
                    </button>
                ))}
            </div>

            <div className="max-w-4xl mx-auto relative">
                <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`关于 "${meetingInfo?.topic || '会议'}" 的任何问题...`}
                    className="w-full pl-4 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none h-[60px] shadow-sm bg-gray-50 focus:bg-white transition-all"
                />
                <button 
                    onClick={() => handleSend()}
                    disabled={isThinking || !input.trim()}
                    className="absolute right-2 top-2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-colors"
                >
                    <Send size={18} />
                </button>
            </div>
        </div>
      </div>

      {/* Knowledge Base Sidebar */}
      <div className={`fixed inset-y-0 right-0 w-80 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out border-l border-gray-200 z-50 flex flex-col ${showKnowledgeBase ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <BookOpen size={18} className="text-indigo-600"/> 个人知识库
              </h3>
              <button onClick={() => setShowKnowledgeBase(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
              </button>
          </div>
          <div className="flex-1 p-4 overflow-y-auto">
               <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                   在此定义您的行文风格、常用术语或背景信息。AI 助手在生成内容时会优先参考这些设定。
               </p>
               <textarea 
                   value={localKnowledge}
                   onChange={(e) => setLocalKnowledge(e.target.value)}
                   className="w-full h-[calc(100%-2rem)] p-3 border border-gray-300 rounded-lg text-sm leading-relaxed resize-none focus:ring-2 focus:ring-indigo-500"
                   placeholder="例如：我的致辞风格比较务实；常用缩写 CUPL..."
               />
          </div>
          <div className="p-4 border-t border-gray-200 bg-gray-50">
              <button 
                onClick={handleSaveKnowledge}
                className="w-full flex items-center justify-center gap-2 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
              >
                  <Save size={18} /> 保存并应用
              </button>
          </div>
      </div>
    </div>
  );
};