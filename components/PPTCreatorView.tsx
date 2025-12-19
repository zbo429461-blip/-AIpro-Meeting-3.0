import React, { useState } from 'react';
import { PPTSlide, AppSettings } from '../types';
import { getAIProviderLabel, generatePPTStructure, generateSlideImage } from '../services/aiService';
import { Presentation, Wand2, Plus, Image as ImageIcon, Trash2, Layout, FileText, Loader2, Upload, PlayCircle, Download, Book, Sparkles } from 'lucide-react';
// @ts-ignore
import PptxGenJS from "pptxgenjs";

interface PPTCreatorViewProps {
  slides: PPTSlide[] | undefined;
  setSlides: (slides: PPTSlide[]) => void;
  settings: AppSettings;
  topic: string;
}

export const PPTCreatorView: React.FC<PPTCreatorViewProps> = ({ slides = [], setSlides, settings, topic }) => {
  const [activeSlideId, setActiveSlideId] = useState<string | null>(slides.length > 0 ? slides[0].id : null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isImgGenerating, setIsImgGenerating] = useState(false);
  const [imgPromptInput, setImgPromptInput] = useState('');
  const [structurePrompt, setStructurePrompt] = useState(topic || '');
  const [exampleContent, setExampleContent] = useState('');
  const [showStructureModal, setShowStructureModal] = useState(false);
  
  const aiProviderLabel = getAIProviderLabel(settings);
  const activeSlide = slides.find(s => s.id === activeSlideId);

  const handleAiGenerateStructure = async () => {
      if (!structurePrompt.trim()) return alert("请输入生成主题或需求");
      setIsGenerating(true);
      setShowStructureModal(false);
      try {
          const newSlides = await generatePPTStructure(structurePrompt, settings, exampleContent);
          setSlides(newSlides);
          if(newSlides.length > 0) setActiveSlideId(newSlides[0].id);
      } catch (e: any) {
          alert(`生成失败 (${aiProviderLabel}): ${e.message}`);
      } finally {
          setIsGenerating(false);
      }
  };

  const handleGenerateImage = async () => {
      if (!activeSlide) return;
      
      const prompt = imgPromptInput || `Professional presentation background for "${activeSlide.title}", minimalist, abstract corporate style, high quality 4k.`;
      
      setIsImgGenerating(true);
      try {
          const base64 = await generateSlideImage(prompt, settings);
          if (base64) {
              updateSlide(activeSlide.id, 'backgroundImage', base64);
              setImgPromptInput('');
          } else {
              alert("未能生成图片，请检查 API Key 权限或网络。");
          }
      } catch (e) {
          console.error(e);
          alert("图片生成出错");
      } finally {
          setIsImgGenerating(false);
      }
  };

  const updateSlide = (id: string, field: keyof PPTSlide, value: any) => {
      setSlides(slides.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const addNewSlide = () => {
      const newSlide: PPTSlide = {
          id: Date.now().toString(),
          title: "新页面",
          content: ["点击编辑内容"],
          layout: 'content'
      };
      setSlides([...slides, newSlide]);
      setActiveSlideId(newSlide.id);
  };

  const handleDownloadPPT = () => {
      const pres = new PptxGenJS();
      pres.layout = "LAYOUT_16x9";
      pres.title = topic || "Presentation";

      slides.forEach(s => {
          const slide = pres.addSlide();
          
          if (s.backgroundImage) {
              // Ensure base64 prefix if missing
              let data = s.backgroundImage;
              if(!data.startsWith('data:')) data = 'data:image/png;base64,' + data;
              // Use cover to fill slide
              slide.background = { data: data };
          }
          
          // Notebook Style Handling
          if (s.layout === 'image_left') { 
               slide.background = { color: 'F5F5F7' }; 
               slide.addText(s.title, { x: 0.5, y: 0.5, w: '30%', fontSize: 24, fontFace: 'Georgia', bold: true, color: '333333' });
               if (s.speakerNotes) {
                   slide.addText(s.speakerNotes, { x: 0.5, y: 2.0, w: '30%', fontSize: 12, fontFace: 'Arial', color: '666666' });
               }
               const bullets = s.content.map(c => ({ text: c, options: { fontSize: 14, color: '333333', breakLine: true } }));
               slide.addText(bullets, { x: 4.0, y: 0.5, w: '60%', h: 6, fontFace: 'Arial', fill: { color: 'FFFFFF' }, margin: 10 });
          } 
          else if (s.layout === 'title') {
              // Add shadow/stroke for readability if background exists
              const textColor = s.backgroundImage ? 'FFFFFF' : '000000';
              
              slide.addText(s.title, { x: 0.5, y: 2.5, w: '90%', fontSize: 44, bold: true, align: 'center', color: textColor });
              if (s.content.length > 0) {
                  slide.addText(s.content.join('\n'), { x: 1, y: 4, w: '80%', fontSize: 24, align: 'center', color: s.backgroundImage ? 'EEEEEE' : '333333' });
              }
          } else {
              const textColor = s.backgroundImage ? 'FFFFFF' : '000000';
              slide.addText(s.title, { x: 0.5, y: 0.5, w: '90%', fontSize: 32, bold: true, color: textColor });
              const bullets = s.content.map(c => ({ text: c, options: { fontSize: 18, color: s.backgroundImage ? 'EEEEEE' : '333333', breakLine: true } }));
              slide.addText(bullets, { x: 0.5, y: 1.5, w: '90%', h: 4 });
          }

          if (s.speakerNotes) {
              slide.addNotes(s.speakerNotes);
          }
      });

      pres.writeFile({ fileName: `${topic || 'presentation'}.pptx` });
  };

  return (
    <div className="flex h-full bg-gray-50 relative">
        
        {/* Structure Generation Modal */}
        {showStructureModal && (
            <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center backdrop-blur-sm">
                <div className="bg-white p-6 rounded-xl shadow-2xl w-[500px]">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <Wand2 className="text-indigo-600"/> AI 生成 PPT 大纲
                    </h3>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">主题 / 需求</label>
                            <textarea 
                                value={structurePrompt}
                                onChange={(e) => setStructurePrompt(e.target.value)}
                                placeholder="请输入演讲主题 (例如：人工智能在教育领域的应用，包含5页)..."
                                className="w-full h-24 p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                        
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                                参考范例 / 内容 (可选) 
                                <span className="text-xs font-normal text-gray-400 ml-2">粘贴文稿或大纲供 AI 模仿</span>
                            </label>
                            <textarea 
                                value={exampleContent}
                                onChange={(e) => setExampleContent(e.target.value)}
                                placeholder="在此粘贴参考文本，AI 将根据此内容生成..."
                                className="w-full h-24 p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                    </div>

                    <div className="flex gap-2 mt-6">
                        <button onClick={() => setShowStructureModal(false)} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">取消</button>
                        <button 
                            onClick={handleAiGenerateStructure} 
                            disabled={!structurePrompt.trim()}
                            className="flex-1 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                        >
                            开始生成
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Left Sidebar: Outline */}
        <div className="w-72 bg-white border-r border-gray-200 flex flex-col h-full">
            <div className="p-4 border-b border-gray-200">
                <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
                    <Presentation size={18} className="text-indigo-600"/> 演示文稿大纲
                </h3>
                <div className="grid grid-cols-2 gap-2">
                    <button 
                        onClick={() => setShowStructureModal(true)}
                        disabled={isGenerating}
                        className="flex flex-col items-center justify-center p-3 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors text-xs font-medium"
                    >
                        {isGenerating ? <Loader2 className="animate-spin mb-1" size={16}/> : <Wand2 className="mb-1" size={16}/>}
                        AI 生成/重置
                    </button>
                    <button 
                        onClick={handleDownloadPPT}
                        className="flex flex-col items-center justify-center p-3 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors text-xs font-medium"
                    >
                        <Download className="mb-1" size={16}/>
                        导出 PPTX
                    </button>
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {slides.map((slide, index) => (
                    <div 
                        key={slide.id}
                        onClick={() => setActiveSlideId(slide.id)}
                        className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer border transition-all
                            ${activeSlideId === slide.id ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'bg-white border-transparent hover:bg-gray-50 hover:border-gray-200'}`}
                    >
                        <div className="text-xs font-mono text-gray-400 mt-1 w-4 text-right">{index + 1}</div>
                        <div className="flex-1 min-w-0">
                            <div className={`text-sm font-bold truncate ${activeSlideId === slide.id ? 'text-indigo-900' : 'text-gray-700'}`}>
                                {slide.title || "未命名幻灯片"}
                            </div>
                            <div className="text-xs text-gray-400 mt-1 truncate">
                                {slide.layout === 'image_left' ? 'Notebook Style' : slide.layout === 'title' ? 'Title Slide' : 'Content Slide'}
                            </div>
                        </div>
                        <button 
                            onClick={(e) => { e.stopPropagation(); setSlides(slides.filter(s => s.id !== slide.id)); }}
                            className="text-gray-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <Trash2 size={14}/>
                        </button>
                    </div>
                ))}
                <button onClick={addNewSlide} className="w-full py-3 border-2 border-dashed border-gray-200 rounded-lg text-gray-400 hover:border-indigo-300 hover:text-indigo-500 transition-colors flex items-center justify-center gap-2 text-sm mt-2">
                    <Plus size={16}/> 添加页面
                </button>
            </div>
        </div>

        {/* Center: Canvas */}
        <div className="flex-1 bg-gray-100 flex flex-col h-full relative overflow-hidden">
             {activeSlide ? (
                 <>
                    {/* Top Toolbar */}
                    <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm z-10">
                        <div className="flex items-center gap-4">
                            <div className="flex bg-gray-100 p-1 rounded-lg">
                                <button onClick={() => updateSlide(activeSlide.id, 'layout', 'title')} className={`p-1.5 rounded ${activeSlide.layout === 'title' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`} title="Title Slide"><Layout size={16}/></button>
                                <button onClick={() => updateSlide(activeSlide.id, 'layout', 'content')} className={`p-1.5 rounded ${activeSlide.layout === 'content' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`} title="Standard Content"><FileText size={16}/></button>
                                <button onClick={() => updateSlide(activeSlide.id, 'layout', 'image_left')} className={`p-1.5 rounded ${activeSlide.layout === 'image_left' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`} title="Notebook Style"><Book size={16}/></button>
                            </div>
                            <div className="h-4 w-px bg-gray-300"></div>
                            {/* Image Gen */}
                            <div className="flex items-center gap-2">
                                <input 
                                    value={imgPromptInput}
                                    onChange={(e) => setImgPromptInput(e.target.value)}
                                    placeholder="输入图片描述 (Nano Banana)..."
                                    className="text-xs p-2 border border-gray-200 rounded-md w-64 focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                                <button 
                                    onClick={handleGenerateImage}
                                    disabled={isImgGenerating}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-md text-xs font-bold shadow-sm hover:shadow-md transition-all disabled:opacity-50"
                                >
                                    {isImgGenerating ? (
                                        <>
                                            <Loader2 className="animate-spin" size={14}/> 生成中...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles size={14}/> 生成配图
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Canvas Area */}
                    <div className="flex-1 overflow-auto p-8 flex items-center justify-center">
                        <div 
                            className={`aspect-video w-full max-w-5xl bg-white shadow-2xl relative overflow-hidden transition-all duration-300 group
                                ${activeSlide.layout === 'image_left' ? 'bg-[#f5f5f7]' : 'bg-white'}
                            `}
                        >
                            {/* Background Image Logic - INCREASED OPACITY to 0.9 for better visibility as per feedback */}
                            {activeSlide.backgroundImage && activeSlide.layout !== 'image_left' && (
                                <div className="absolute inset-0 z-0">
                                    <img src={activeSlide.backgroundImage} className="w-full h-full object-cover opacity-90 pointer-events-none" />
                                    {/* Overlay to ensure text readability */}
                                    <div className="absolute inset-0 bg-black/30 pointer-events-none"></div>
                                    <button onClick={() => updateSlide(activeSlide.id, 'backgroundImage', '')} className="absolute top-2 right-2 p-1 bg-black/50 hover:bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity z-20"><Trash2 size={12}/></button>
                                </div>
                            )}

                            {/* --- Layouts --- */}
                            
                            {/* 1. Title Layout */}
                            {activeSlide.layout === 'title' && (
                                <div className="relative z-10 flex flex-col items-center justify-center h-full p-20 text-center">
                                    <input 
                                        value={activeSlide.title}
                                        onChange={(e) => updateSlide(activeSlide.id, 'title', e.target.value)}
                                        className={`bg-transparent border-none outline-none font-bold text-6xl text-center w-full mb-8 placeholder-gray-300 ${activeSlide.backgroundImage ? 'text-white placeholder-white/50 drop-shadow-md' : 'text-slate-900'}`}
                                        placeholder="输入标题..."
                                    />
                                    <textarea 
                                        value={activeSlide.content.join('\n')}
                                        onChange={(e) => updateSlide(activeSlide.id, 'content', e.target.value.split('\n'))}
                                        className={`bg-transparent border-none outline-none text-2xl text-center w-full resize-none h-32 ${activeSlide.backgroundImage ? 'text-white/90 drop-shadow-md' : 'text-gray-600'}`}
                                        placeholder="副标题 / 演讲人..."
                                    />
                                </div>
                            )}

                            {/* 2. Standard Content Layout */}
                            {activeSlide.layout === 'content' && (
                                <div className="relative z-10 flex flex-col h-full p-16">
                                    <input 
                                        value={activeSlide.title}
                                        onChange={(e) => updateSlide(activeSlide.id, 'title', e.target.value)}
                                        className={`bg-transparent border-b-2 border-indigo-600 outline-none font-bold text-4xl w-full mb-8 pb-4 placeholder-gray-300 ${activeSlide.backgroundImage ? 'text-white border-white/50' : 'text-slate-900'}`}
                                        placeholder="页面标题"
                                    />
                                    <textarea 
                                        value={activeSlide.content.join('\n')}
                                        onChange={(e) => updateSlide(activeSlide.id, 'content', e.target.value.split('\n'))}
                                        className={`flex-1 bg-transparent border-none outline-none text-xl leading-relaxed resize-none list-disc pl-4 ${activeSlide.backgroundImage ? 'text-white/90 drop-shadow-sm' : 'text-gray-700'}`}
                                        placeholder="• 内容要点 1&#10;• 内容要点 2..."
                                    />
                                </div>
                            )}

                            {/* 3. NotebookLM Style Layout */}
                            {activeSlide.layout === 'image_left' && (
                                <div className="relative z-10 h-full flex p-12 gap-12 font-serif">
                                    {/* Left Column: Metadata & Notes */}
                                    <div className="w-1/3 flex flex-col border-r border-gray-300 pr-8">
                                        <input 
                                            value={activeSlide.title}
                                            onChange={(e) => updateSlide(activeSlide.id, 'title', e.target.value)}
                                            className="bg-transparent border-none outline-none font-bold text-3xl text-gray-900 mb-8 font-serif leading-tight placeholder-gray-400"
                                            placeholder="Source / Header"
                                        />
                                        <div className="flex-1">
                                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">Key Insights / Notes</label>
                                            <textarea 
                                                value={activeSlide.speakerNotes || ''}
                                                onChange={(e) => updateSlide(activeSlide.id, 'speakerNotes', e.target.value)}
                                                className="w-full h-full bg-transparent border-none outline-none text-sm text-gray-500 leading-relaxed resize-none font-sans"
                                                placeholder="Add margin notes here..."
                                            />
                                        </div>
                                    </div>
                                    
                                    {/* Right Column: Main Content */}
                                    <div className="w-2/3 bg-white shadow-sm p-8 rounded-sm">
                                        <textarea 
                                            value={activeSlide.content.join('\n')}
                                            onChange={(e) => updateSlide(activeSlide.id, 'content', e.target.value.split('\n'))}
                                            className="w-full h-full bg-transparent border-none outline-none text-lg leading-loose resize-none text-gray-800 font-serif"
                                            placeholder="Main content goes here..."
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    {/* Bottom: Notes (Only for non-Notebook layouts mostly) */}
                    {activeSlide.layout !== 'image_left' && (
                        <div className="h-32 bg-white border-t border-gray-200 p-4">
                            <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">演讲者备注</label>
                            <textarea 
                                value={activeSlide.speakerNotes || ''}
                                onChange={(e) => updateSlide(activeSlide.id, 'speakerNotes', e.target.value)}
                                className="w-full h-full bg-transparent border-none outline-none text-sm text-gray-600 resize-none"
                                placeholder="在此输入演讲提示..."
                            />
                        </div>
                    )}
                 </>
             ) : (
                 <div className="flex-1 flex flex-col items-center justify-center text-gray-300">
                     <Presentation size={64} className="mb-4 opacity-50"/>
                     <p className="text-xl font-medium">选择或创建一个幻灯片</p>
                 </div>
             )}
        </div>
    </div>
  );
};