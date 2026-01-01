
import React, { useState, useRef, useEffect } from 'react';
import { AppSettings, KnowledgeFile, KnowledgeGraphData, ChatMessage, KnowledgeNode } from '../types';
import { analyzeKnowledgeGraph, queryKnowledgeBase, getAIProviderLabel } from '../services/aiService';
import { 
    Upload, FileText, Image as ImageIcon, FileType, Trash2, 
    Network, MessageSquare, Send, Loader2, RefreshCw, X, Plus, 
    Database, Search, PlayCircle
} from 'lucide-react';
// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
// @ts-ignore
import mammoth from 'mammoth';

// Initialize PDF.js worker
try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@3.11.174/build/pdf.worker.js`;
} catch (e) { console.warn("PDF Worker setup warning", e); }

interface KnowledgeBaseViewProps {
    settings: AppSettings;
    onBack: () => void;
}

export const KnowledgeBaseView: React.FC<KnowledgeBaseViewProps> = ({ settings, onBack }) => {
    const [files, setFiles] = useState<KnowledgeFile[]>([]);
    const [graphData, setGraphData] = useState<KnowledgeGraphData>({ nodes: [], links: [] });
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isChatting, setIsChatting] = useState(false);
    const [activeTab, setActiveTab] = useState<'files' | 'graph'>('files');
    const [uploading, setUploading] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const graphContainerRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Initial Load
    useEffect(() => {
        const savedFiles = localStorage.getItem('kb_files');
        const savedGraph = localStorage.getItem('kb_graph');
        if (savedFiles) try { setFiles(JSON.parse(savedFiles)); } catch {}
        if (savedGraph) try { setGraphData(JSON.parse(savedGraph)); } catch {}
    }, []);

    // Persist
    useEffect(() => { localStorage.setItem('kb_files', JSON.stringify(files)); }, [files]);
    useEffect(() => { localStorage.setItem('kb_graph', JSON.stringify(graphData)); }, [graphData]);
    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatHistory, isChatting]);

    // --- File Handling ---

    const readFileContent = async (file: File): Promise<string> => {
        if (file.type === 'application/pdf') {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            let fullText = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map((item: any) => item.str).join(' ');
                fullText += pageText + '\n';
            }
            return fullText;
        } else if (file.type.includes('word') || file.name.endsWith('.docx')) {
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer });
            return result.value;
        } else if (file.type.startsWith('text/')) {
            return await file.text();
        } else {
            return ""; // Image support via OCR needs separate handling if desired, currently focusing on Text RAG
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = e.target.files;
        if (!selectedFiles) return;
        setUploading(true);

        const newFiles: KnowledgeFile[] = [];
        
        for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];
            try {
                const text = await readFileContent(file);
                newFiles.push({
                    id: Date.now() + i + '',
                    name: file.name,
                    type: file.type.includes('pdf') ? 'pdf' : file.type.includes('word') ? 'word' : 'text',
                    content: text,
                    tokenCount: text.length,
                    uploadDate: Date.now(),
                    status: text ? 'ready' : 'error'
                });
            } catch (err) {
                console.error("File parse error", err);
                newFiles.push({
                    id: Date.now() + i + '',
                    name: file.name,
                    type: 'text',
                    content: '',
                    uploadDate: Date.now(),
                    status: 'error'
                });
            }
        }

        setFiles(prev => [...prev, ...newFiles]);
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleDeleteFile = (id: string) => {
        setFiles(prev => prev.filter(f => f.id !== id));
    };

    // --- Knowledge Graph ---

    const handleAnalyze = async () => {
        if (files.length === 0) return alert("请先上传文件");
        setIsAnalyzing(true);
        setActiveTab('graph');
        
        try {
            // Combine all file contents
            const fullContext = files.filter(f => f.status === 'ready').map(f => `--- Document: ${f.name} ---\n${f.content}`).join('\n\n');
            const data = await analyzeKnowledgeGraph(fullContext, settings);
            setGraphData(data);
        } catch (e) {
            alert("分析失败，请检查 AI 配置");
        } finally {
            setIsAnalyzing(false);
        }
    };

    // --- RAG Chat ---

    const handleSendChat = async () => {
        if (!chatInput.trim()) return;
        
        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: chatInput,
            timestamp: Date.now()
        };
        setChatHistory(prev => [...prev, userMsg]);
        setChatInput('');
        setIsChatting(true);

        try {
            const fullContext = files.filter(f => f.status === 'ready').map(f => `--- Document: ${f.name} ---\n${f.content}`).join('\n\n');
            const response = await queryKnowledgeBase(userMsg.content, fullContext, settings);
            
            const aiMsg: ChatMessage = {
                id: (Date.now()+1).toString(),
                role: 'assistant',
                content: response,
                timestamp: Date.now()
            };
            setChatHistory(prev => [...prev, aiMsg]);
        } catch (e) {
            const errorMsg: ChatMessage = {
                id: (Date.now()+1).toString(),
                role: 'assistant',
                content: "抱歉，知识库查询失败。请检查网络或 API Key。",
                timestamp: Date.now()
            };
            setChatHistory(prev => [...prev, errorMsg]);
        } finally {
            setIsChatting(false);
        }
    };

    // --- Visualization ---
    const renderGraph = () => {
        if (graphData.nodes.length === 0) return (
            <div className="h-full flex flex-col items-center justify-center text-slate-300">
                <Network size={64} className="mb-4 opacity-20"/>
                <p>暂无知识图谱数据</p>
                <button onClick={handleAnalyze} className="mt-4 text-indigo-500 hover:underline">点击开始分析</button>
            </div>
        );

        const width = 600;
        const height = 400;
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) / 2 - 40;

        type NodeWithPos = KnowledgeNode & { x: number; y: number };

        // Simple Layout: Circular
        const nodesWithPos: NodeWithPos[] = graphData.nodes.map((node, i) => {
            const angle = (i / graphData.nodes.length) * 2 * Math.PI;
            return {
                ...node,
                x: centerX + radius * Math.cos(angle),
                y: centerY + radius * Math.sin(angle)
            };
        });

        const nodeMap = new Map<string, NodeWithPos>(nodesWithPos.map(n => [n.id, n]));

        return (
            <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
                <defs>
                    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="28" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill="#cbd5e1" />
                    </marker>
                </defs>
                {graphData.links.map((link, i) => {
                    const source = nodeMap.get(link.source);
                    const target = nodeMap.get(link.target);
                    if (!source || !target) return null;
                    return (
                        <g key={i}>
                            <line 
                                x1={source.x} y1={source.y} 
                                x2={target.x} y2={target.y} 
                                stroke="#cbd5e1" strokeWidth="1"
                                markerEnd="url(#arrowhead)"
                            />
                            <text 
                                x={(source.x + target.x)/2} y={(source.y + target.y)/2} 
                                className="text-[8px] fill-slate-400" textAnchor="middle"
                            >
                                {link.relation}
                            </text>
                        </g>
                    );
                })}
                {nodesWithPos.map((node, i) => (
                    <g key={node.id} className="cursor-pointer hover:opacity-80 transition-opacity">
                        <circle 
                            cx={node.x} cy={node.y} 
                            r={15 + (node.val || 1) * 2} 
                            fill={getNodeColor(node.category)}
                            stroke="white" strokeWidth="2"
                            className="shadow-sm"
                        />
                        <text 
                            x={node.x} y={node.y + 4} 
                            textAnchor="middle" 
                            className="text-[10px] font-bold fill-white pointer-events-none"
                            style={{ textShadow: '0px 1px 2px rgba(0,0,0,0.5)' }}
                        >
                            {node.label.length > 5 ? node.label.slice(0,4)+'..' : node.label}
                        </text>
                        <title>{node.label} ({node.category})</title>
                    </g>
                ))}
            </svg>
        );
    };

    const getNodeColor = (category: string) => {
        switch (category?.toLowerCase()) {
            case 'person': return '#3b82f6'; 
            case 'location': return '#10b981'; 
            case 'event': return '#f59e0b'; 
            case 'document': return '#6366f1'; 
            default: return '#ef4444'; 
        }
    };

    return (
        <div className="h-full flex flex-col bg-slate-50">
            <header className="h-16 bg-white border-b px-6 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
                    <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Database className="text-indigo-600"/> 本地知识库 RAG
                    </h1>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
                    <span>AI Model: {getAIProviderLabel(settings)}</span>
                </div>
            </header>

            <div className="flex-1 overflow-hidden flex">
                {/* Left Panel: Files & Graph */}
                <div className="w-1/2 flex flex-col border-r border-slate-200 bg-white">
                    <div className="flex border-b">
                        <button 
                            onClick={() => setActiveTab('files')} 
                            className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 ${activeTab === 'files' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500'}`}
                        >
                            <FileText size={16}/> 文件列表 ({files.length})
                        </button>
                        <button 
                            onClick={() => setActiveTab('graph')} 
                            className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 ${activeTab === 'graph' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500'}`}
                        >
                            <Network size={16}/> 知识图谱
                        </button>
                    </div>

                    <div className="flex-1 overflow-hidden relative">
                        {activeTab === 'files' && (
                            <div className="absolute inset-0 overflow-y-auto p-6">
                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <button onClick={() => fileInputRef.current?.click()} className="h-32 border-2 border-dashed border-indigo-200 bg-indigo-50 rounded-xl flex flex-col items-center justify-center text-indigo-600 hover:bg-indigo-100 transition-colors">
                                        {uploading ? <Loader2 className="animate-spin" size={24}/> : <Upload size={24}/>}
                                        <span className="text-xs font-bold mt-2">上传 PDF / Word / TXT</span>
                                    </button>
                                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" multiple accept=".pdf,.docx,.doc,.txt" />
                                    
                                    <button onClick={handleAnalyze} disabled={files.length === 0 || isAnalyzing} className="h-32 border border-slate-200 bg-slate-50 rounded-xl flex flex-col items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
                                        {isAnalyzing ? <Loader2 className="animate-spin" size={24}/> : <PlayCircle size={24}/>}
                                        <span className="text-xs font-bold mt-2">执行全库分析</span>
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {files.map(f => (
                                        <div key={f.id} className="flex items-center justify-between p-3 border border-slate-100 rounded-lg hover:shadow-sm transition-shadow">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className={`w-8 h-8 rounded flex items-center justify-center text-white font-bold text-xs ${f.type === 'pdf' ? 'bg-red-500' : f.type === 'word' ? 'bg-blue-500' : 'bg-gray-500'}`}>
                                                    {f.type.toUpperCase().slice(0,3)}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold text-slate-700 truncate">{f.name}</p>
                                                    <p className="text-[10px] text-slate-400">{new Date(f.uploadDate).toLocaleDateString()} • {f.tokenCount || 0} chars</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {f.status === 'error' && <span className="text-xs text-red-500">解析失败</span>}
                                                {f.status === 'ready' && <span className="text-xs text-green-500">已就绪</span>}
                                                <button onClick={() => handleDeleteFile(f.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'graph' && (
                            <div className="absolute inset-0 bg-slate-900 overflow-hidden" ref={graphContainerRef}>
                                {isAnalyzing && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 z-10 text-white">
                                        <Loader2 size={48} className="animate-spin mb-4"/>
                                        <p>正在构建知识图谱...</p>
                                    </div>
                                )}
                                {renderGraph()}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel: Chat */}
                <div className="w-1/2 flex flex-col bg-slate-50">
                    <div className="p-4 border-b bg-white/50 backdrop-blur-sm">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2"><MessageSquare size={18}/> 知识库问答 (RAG)</h3>
                        <p className="text-xs text-slate-400">基于 {files.length} 个本地文件 | LangGraph Pipeline</p>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {chatHistory.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50">
                                <Search size={48} className="mb-2"/>
                                <p className="text-sm">请提问，我将检索知识图谱和文档回答</p>
                            </div>
                        )}
                        {chatHistory.map(msg => (
                            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] p-3 rounded-2xl text-sm leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-slate-700 rounded-tl-none border border-slate-100'}`}>
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                        {isChatting && (
                            <div className="flex justify-start">
                                <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-slate-100 shadow-sm flex items-center gap-2 text-xs text-slate-500">
                                    <Loader2 size={14} className="animate-spin"/> 正在检索 (Graph Retrieval)...
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef}/>
                    </div>

                    <div className="p-4 bg-white border-t">
                        <div className="relative">
                            <textarea 
                                value={chatInput} 
                                onChange={e => setChatInput(e.target.value)} 
                                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendChat())}
                                placeholder="输入问题..." 
                                className="w-full pl-4 pr-12 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none h-14 text-sm bg-slate-50"
                            />
                            <button 
                                onClick={handleSendChat} 
                                disabled={!chatInput.trim() || isChatting}
                                className="absolute right-2 top-2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                            >
                                <Send size={16}/>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
