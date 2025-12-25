
import React, { useState, useRef, useEffect } from 'react';
import { AppSettings, ChatMessage, MeetingFile, Participant, AgendaItem } from '../types';
import { getAIProviderLabel } from '../services/aiService';
import { Send, Bot, User, Loader2, Sparkles, FileEdit, CheckSquare, MessageSquare, BookOpen, Save, X, Activity, Image as ImageIcon, Trash2 } from 'lucide-react';

interface AssistantViewProps {
  settings: AppSettings;
  files?: MeetingFile[];
  participants?: Participant[];
  agenda?: AgendaItem[];
  onSaveSettings: (settings: AppSettings) => void;
  messages: ChatMessage[];
  onSendMessage: (text: string, image?: string) => void;
  isThinking: boolean;
}

export const AssistantView: React.FC<AssistantViewProps> = ({ 
    settings, 
    files = [],
    participants = [],
    agenda = [],
    onSaveSettings,
    messages,
    onSendMessage,
    isThinking
}) => {
  const [input, setInput] = useState('');
  const [showKnowledgeBase, setShowKnowledgeBase] = useState(false);
  const [localKnowledge, setLocalKnowledge] = useState(settings.knowledgeBase || '');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const aiProviderLabel = getAIProviderLabel(settings);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(() => { scrollToBottom(); }, [messages, isThinking]);

  const handleSend = (textOverride?: string) => {
    const textToSend = textOverride || input;
    if (!textToSend.trim() && !attachedImage) return;
    
    onSendMessage(textToSend, attachedImage || undefined);
    
    setInput('');
    setAttachedImage(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (e) => {
          const result = e.target?.result as string;
          // Store raw base64 data without prefix if needed, but for display we need full
          // For API, we usually strip prefix. Let's store full dataUrl for preview and strip later
          setAttachedImage(result);
      };
      reader.readAsDataURL(file);
      // Reset input so same file can be selected again if needed
      e.target.value = '';
  };

  const quickPrompts = [
    { label: "整理纪要", icon: FileEdit, prompt: "请根据当前会议的议程、文件和大纲，整理一份正式的会议纪要。" },
    { label: "待办清单", icon: CheckSquare, prompt: "请帮我提取会议中的行动项，生成一份 To-Do List。" },
    { label: "扩充议程", icon: MessageSquare, prompt: "目前的议程比较简单，请帮我扩充一些细节讨论环节。" },
  ];

  return (
    <div className="flex h-full bg-slate-50 relative overflow-hidden flex-col">
        <div className="flex-none p-6 bg-white border-b flex justify-between items-center shadow-sm z-10">
            <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Sparkles className="text-indigo-600" size={24}/> 小小博 AIpro 助手</h2>
                <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-gray-400 font-bold uppercase">{aiProviderLabel}</span>
                    <span className="text-gray-200">|</span>
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px] font-bold">
                        <Activity size={10} /> 数据已同步 ({participants.length}人 / {agenda.length}议程)
                    </div>
                </div>
            </div>
            <button onClick={() => setShowKnowledgeBase(!showKnowledgeBase)} className={`p-2 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium ${showKnowledgeBase ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-gray-100 text-gray-600'}`}>
                <BookOpen size={20} /> <span className="hidden md:inline">风格设定</span>
            </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-40">
                     <Bot size={64} className="text-indigo-300" />
                     <h3 className="text-lg font-bold">我是您的 AI 办公助手</h3>
                     <p className="max-w-xs text-sm">您可以直接问我关于本次会议的任何问题，或上传图片进行识别。</p>
                </div>
            )}
            {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`flex max-w-[85%] gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 border'}`}>
                            {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                        </div>
                        <div className={`flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                            {msg.image && (
                                <img 
                                    src={msg.image.startsWith('data:') ? msg.image : `data:image/jpeg;base64,${msg.image}`} 
                                    alt="User Upload" 
                                    className="max-w-[200px] rounded-lg border border-gray-200 shadow-sm"
                                />
                            )}
                            <div className={`p-4 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-slate-800 border rounded-tl-none shadow-sm'}`}>
                                {msg.content}
                            </div>
                        </div>
                    </div>
                </div>
            ))}
            {isThinking && (
                <div className="flex justify-start">
                    <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-white text-indigo-600 border flex items-center justify-center shadow-sm"><Bot size={16} /></div>
                        <div className="bg-white p-4 rounded-2xl rounded-tl-none border shadow-sm flex items-center gap-2 text-gray-500 text-xs">
                            <Loader2 className="animate-spin" size={14} /> 思考中...
                        </div>
                    </div>
                </div>
            )}
            <div ref={messagesEndRef} />
        </div>

        <div className="p-4 bg-white border-t">
            <div className="max-w-4xl mx-auto">
                <div className="flex gap-2 mb-3 overflow-x-auto pb-2 no-scrollbar">
                    {quickPrompts.map((p, idx) => (
                        <button key={idx} onClick={() => handleSend(p.prompt)} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-xs font-bold whitespace-nowrap border border-slate-100 hover:bg-indigo-50 hover:text-indigo-600 transition-all">
                            <p.icon size={12}/> {p.label}
                        </button>
                    ))}
                </div>
                
                {attachedImage && (
                    <div className="mb-2 relative inline-block">
                        <img src={attachedImage} alt="Preview" className="h-20 rounded-lg border shadow-sm" />
                        <button 
                            onClick={() => setAttachedImage(null)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600"
                        >
                            <X size={12} />
                        </button>
                    </div>
                )}

                <div className="relative">
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute left-3 top-3 text-gray-400 hover:text-indigo-600 transition-colors"
                        title="上传图片 (OCR/识图)"
                    >
                        <ImageIcon size={20} />
                    </button>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*" 
                        onChange={handleImageUpload}
                    />
                    
                    <textarea 
                        value={input} 
                        onChange={e => setInput(e.target.value)} 
                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())} 
                        placeholder={attachedImage ? "请输入关于这张图片的指令..." : "在此输入指令..."}
                        className="w-full pl-10 pr-12 py-3 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none h-20 text-sm shadow-sm" 
                    />
                    <button onClick={() => handleSend()} disabled={isThinking || (!input.trim() && !attachedImage)} className="absolute right-3 bottom-3 p-2 bg-indigo-600 text-white rounded-xl disabled:opacity-50 transition-colors shadow-md">
                        <Send size={18} />
                    </button>
                </div>
            </div>
        </div>

        {showKnowledgeBase && (
            <div className="absolute inset-y-0 right-0 w-80 bg-white shadow-2xl z-50 flex flex-col border-l border-gray-200 animate-slideLeft">
                <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2"><BookOpen size={18} className="text-indigo-600"/> 风格设定</h3>
                    <button onClick={() => setShowKnowledgeBase(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                </div>
                <div className="flex-1 p-4 space-y-4">
                     <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-relaxed">告知 AI 您的偏好，回复将更加精准。</p>
                     <textarea value={localKnowledge} onChange={e => setLocalKnowledge(e.target.value)} className="w-full h-1/2 p-3 border rounded-xl text-sm leading-relaxed resize-none focus:ring-2 focus:ring-indigo-500" placeholder="例如：我的语言风格比较正式严谨；我习惯使用法大作为中国政法大学的简称..."/>
                </div>
                <div className="p-4 border-t bg-gray-50">
                    <button onClick={() => { onSaveSettings({...settings, knowledgeBase: localKnowledge}); setShowKnowledgeBase(false); }} className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all">
                        <Save size={18} /> 保存配置
                    </button>
                </div>
            </div>
        )}
    </div>
  );
};
