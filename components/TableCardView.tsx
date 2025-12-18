import React, { useState, useRef } from 'react';
import { Participant, CardDesign, AppSettings } from '../types';
import { Printer, Settings2, Image as ImageIcon, Sparkles, Upload, RotateCw, Palette, Type, Move, LayoutTemplate, PenTool, FileText, UserSquare2, Download, Package } from 'lucide-react';
import { generateCardDesign, getAIProviderLabel } from '../services/aiService';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import saveAs from 'file-saver';

interface TableCardViewProps {
  participants: Participant[];
  settings?: AppSettings;
  meetingTopic?: string;
}

export const TableCardView: React.FC<TableCardViewProps> = ({ participants, settings, meetingTopic }) => {
  const [design, setDesign] = useState<CardDesign>({
    templateId: 'classic',
    bgType: 'solid',
    bgColor: '#ffffff',
    gradientStart: '#ffffff',
    gradientEnd: '#f0f0f0',
    gradientDir: 'to bottom',
    fontColor: '#000000',
    fontFamily: 'font-serif-sc',
    fontSizeScale: 1.0,
    logo: '',
    logoX: 10,
    logoY: 10,
    logoSize: 100,
    nameY: 0,
    unitY: 0,
    nameScale: 1.0,
    unitScale: 1.0,
    showLine: false,
    lineColor: '#000000',
    contentMode: 'name_unit'
  });
  const [showSettings, setShowSettings] = useState(true);
  const [activeTab, setActiveTab] = useState<'style' | 'layout'>('style');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Drag State - Use Refs to avoid stale closures in event listeners
  const dragTargetRef = useRef<'name' | 'unit' | 'logo' | null>(null);
  const dragStartPos = useRef<{x: number, y: number} | null>(null);
  const initialDesignValues = useRef<{nameY: number, unitY: number, logoX: number, logoY: number} | null>(null);

  const aiProviderLabel = getAIProviderLabel(settings || {} as AppSettings);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadAllImages = async () => {
      if (!printAreaRef.current) return;
      setIsCapturing(true);
      
      try {
          // Select ALL card containers
          const cards = Array.from(printAreaRef.current.querySelectorAll('.card-container'));
          
          if (cards.length === 0) {
              alert("未找到可供生成的预览内容");
              setIsCapturing(false);
              return;
          }

          const zip = new JSZip();
          const imgFolder = zip.folder(`桌牌_Images`);

          // Sequential Processing to avoid browser choking
          for (let i = 0; i < cards.length; i++) {
              const cardElement = cards[i] as HTMLElement;
              const participantName = participants[i]?.nameCN || `participant_${i}`;
              
              const canvas = await html2canvas(cardElement, {
                  scale: 2, // High resolution
                  useCORS: true,
                  backgroundColor: null
              });
              
              // Add to ZIP
              const base64Data = canvas.toDataURL('image/png').split(',')[1];
              imgFolder?.file(`${participantName}.png`, base64Data, {base64: true});
              
              // Small delay to prevent freeze
              await new Promise(resolve => setTimeout(resolve, 50));
          }
          
          const content = await zip.generateAsync({type:"blob"});
          saveAs(content, `电子桌牌打包_${meetingTopic || 'export'}.zip`);
          
      } catch (err) {
          console.error(err);
          alert("打包下载失败，请重试");
      } finally {
          setIsCapturing(false);
      }
  };

  const handleAiDesign = async () => {
      if (!settings || !meetingTopic) return alert("需要API Key和会议主题才能使用AI设计");
      setIsAiLoading(true);
      try {
          const result = await generateCardDesign(meetingTopic, settings);
          setDesign(prev => ({
              ...prev,
              bgColor: result.bgColor || prev.bgColor,
              fontColor: result.fontColor || prev.fontColor,
              fontFamily: result.fontFamily === 'SimHei' ? 'font-sans-sc' : 'font-serif-sc',
              bgType: 'solid'
          }));
      } catch (e) { alert(`使用 ${aiProviderLabel} 生成设计失败。`); } 
      finally { setIsAiLoading(false); }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = () => setDesign(prev => ({ ...prev, logo: reader.result as string }));
          reader.readAsDataURL(file);
      }
  };

  const getFontSize = (name: string) => {
      const cleanLen = name.length;
      let baseSize = 120; // px
      if (cleanLen > 2) baseSize = 100;
      if (cleanLen > 3) baseSize = 80;
      if (cleanLen > 4) baseSize = 60;
      return `${baseSize * design.fontSizeScale * (design.nameScale || 1)}px`;
  };

  const getBackgroundStyle = () => {
      if (design.bgImage) return { backgroundImage: `url(${design.bgImage})`, backgroundSize: 'cover' };
      if (design.bgType === 'gradient') return { backgroundImage: `linear-gradient(${design.gradientDir}, ${design.gradientStart}, ${design.gradientEnd})` };
      return { backgroundColor: design.bgColor };
  };

  // --- DRAG HANDLERS ---
  const handleMouseDown = (e: React.MouseEvent, target: 'name' | 'unit' | 'logo') => {
    // Only allow drag in Layout mode. In Style mode, allow text selection/editing.
    if (activeTab !== 'layout') return;

    e.preventDefault(); 
    e.stopPropagation();
    
    dragTargetRef.current = target;
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    initialDesignValues.current = {
        nameY: design.nameY,
        unitY: design.unitY,
        logoX: design.logoX,
        logoY: design.logoY
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!dragTargetRef.current || !dragStartPos.current || !initialDesignValues.current) return;
    
    const deltaY = e.clientY - dragStartPos.current.y;
    const deltaX = e.clientX - dragStartPos.current.x;

    const target = dragTargetRef.current;

    // Apply updates
    setDesign(prev => {
        const next = { ...prev };
        if (target === 'name') {
            // Only allow vertical for text to keep centering
            next.nameY = initialDesignValues.current!.nameY + deltaY;
        } else if (target === 'unit') {
            next.unitY = initialDesignValues.current!.unitY + deltaY;
        } else if (target === 'logo') {
            // Convert px delta to approx percentage. 
            // Assuming Card Width ~ 210mm (~793px), Height ~ 297mm (~1122px)
            // 1% X ~ 8px, 1% Y ~ 11px
            const percentDeltaX = deltaX / 8; 
            const percentDeltaY = deltaY / 11;
            
            next.logoX = Math.min(100, Math.max(0, initialDesignValues.current!.logoX + percentDeltaX));
            next.logoY = Math.min(100, Math.max(0, initialDesignValues.current!.logoY + percentDeltaY));
        }
        return next;
    });
  };

  const handleMouseUp = () => {
    dragTargetRef.current = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  return (
    <div className="flex h-full bg-gray-100/50">
       {/* Sidebar Controls */}
       <div className={`w-80 bg-white border-r border-gray-200 flex flex-col transition-all duration-300 no-print overflow-y-auto ${showSettings ? '' : '-ml-80'}`}>
           <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-serif-sc font-bold text-gray-900 flex items-center gap-2">
                    <Settings2 size={20}/> 桌牌设计工坊
                </h2>
           </div>
           
           <div className="flex border-b border-gray-200">
               <button onClick={() => setActiveTab('style')} className={`flex-1 py-3 text-sm font-medium ${activeTab === 'style' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500'}`}>样式风格</button>
               <button onClick={() => setActiveTab('layout')} className={`flex-1 py-3 text-sm font-medium ${activeTab === 'layout' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500'}`}>布局微调</button>
           </div>
           
           <div className="p-6 space-y-8 pb-20">
                {activeTab === 'style' && (
                    <>
                        {/* Templates */}
                        <div>
                             <label className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2"><LayoutTemplate size={14}/> 模版选择</label>
                             <div className="grid grid-cols-2 gap-2">
                                 {['classic', 'modern', 'bordered', 'minimal'].map(t => (
                                     <button 
                                        key={t}
                                        onClick={() => setDesign({...design, templateId: t as any})}
                                        className={`p-2 text-xs border rounded capitalize ${design.templateId === t ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600'}`}
                                     >
                                         {t}
                                     </button>
                                 ))}
                             </div>
                        </div>

                         {/* Content Mode */}
                        <div>
                             <label className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2"><UserSquare2 size={14}/> 显示内容</label>
                             <div className="flex gap-2">
                                <button 
                                    onClick={() => setDesign({...design, contentMode: 'name_unit'})} 
                                    className={`flex-1 py-2 text-xs rounded border ${design.contentMode === 'name_unit' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600'}`}
                                >
                                    姓名 + 单位
                                </button>
                                <button 
                                    onClick={() => setDesign({...design, contentMode: 'name_only'})} 
                                    className={`flex-1 py-2 text-xs rounded border ${design.contentMode === 'name_only' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600'}`}
                                >
                                    仅姓名
                                </button>
                             </div>
                        </div>

                         {/* Background */}
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2"><Palette size={14}/> 背景设置</label>
                            <div className="flex gap-2 mb-3">
                                <button onClick={() => setDesign({...design, bgType: 'solid'})} className={`flex-1 text-xs py-1 rounded border ${design.bgType === 'solid' ? 'bg-gray-800 text-white' : 'bg-white'}`}>纯色</button>
                                <button onClick={() => setDesign({...design, bgType: 'gradient'})} className={`flex-1 text-xs py-1 rounded border ${design.bgType === 'gradient' ? 'bg-gray-800 text-white' : 'bg-white'}`}>渐变</button>
                            </div>
                            
                            {design.bgType === 'solid' ? (
                                <div className="flex items-center gap-2">
                                    <input type="color" value={design.bgColor} onChange={e => setDesign({...design, bgColor: e.target.value})} className="w-8 h-8 rounded cursor-pointer border-none"/>
                                    <span className="text-xs text-gray-500">{design.bgColor}</span>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <input type="color" value={design.gradientStart} onChange={e => setDesign({...design, gradientStart: e.target.value})} className="w-8 h-8 rounded"/>
                                        <span className="text-xs text-gray-400 self-center">to</span>
                                        <input type="color" value={design.gradientEnd} onChange={e => setDesign({...design, gradientEnd: e.target.value})} className="w-8 h-8 rounded"/>
                                    </div>
                                    <select value={design.gradientDir} onChange={e => setDesign({...design, gradientDir: e.target.value})} className="w-full text-xs p-1 border rounded">
                                        <option value="to bottom">To Bottom ↓</option>
                                        <option value="to right">To Right →</option>
                                        <option value="to bottom right">Diagonal ↘</option>
                                    </select>
                                </div>
                            )}
                        </div>

                         {/* Font Library */}
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2"><Type size={14}/> 字体库</label>
                            <select 
                                value={design.fontFamily}
                                onChange={e => setDesign({...design, fontFamily: e.target.value})}
                                className="w-full p-2 border border-gray-300 rounded text-sm mb-3"
                            >
                                <option value="font-serif-sc">宋体 (Serif SC)</option>
                                <option value="font-sans-sc">黑体 (Sans SC)</option>
                                <option value="font-calligraphy">马善政毛笔 (Calligraphy)</option>
                                <option value="font-art">站酷小薇 (Artistic)</option>
                                <option value="font-hand">龙苍手书 (Handwriting)</option>
                            </select>
                            <div className="flex items-center gap-2">
                                <label className="text-xs text-gray-500">颜色:</label>
                                <input type="color" value={design.fontColor} onChange={e => setDesign({...design, fontColor: e.target.value})} className="w-6 h-6 rounded cursor-pointer border-none"/>
                            </div>
                        </div>

                        {/* Lines */}
                        <div>
                             <label className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2"><PenTool size={14}/> 装饰线条</label>
                             <div className="flex items-center gap-2 mb-2">
                                 <input type="checkbox" checked={design.showLine} onChange={e => setDesign({...design, showLine: e.target.checked})} />
                                 <span className="text-sm">启用装饰线</span>
                             </div>
                             {design.showLine && (
                                 <input type="color" value={design.lineColor} onChange={e => setDesign({...design, lineColor: e.target.value})} className="w-full h-8 rounded"/>
                             )}
                        </div>
                    </>
                )}

                {activeTab === 'layout' && (
                    <>
                         {/* Name & Unit Positioning */}
                         <div className="space-y-6">
                            <div className="bg-indigo-50 p-3 rounded text-xs text-indigo-700 mb-2">
                                ✨ 提示：您可以直接在右侧预览区【下半部分】拖动文字或Logo来调整位置。
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-2">姓名排版</label>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs text-gray-600"><span>上下位置</span><span>{design.nameY}px</span></div>
                                    <input type="range" min="-200" max="200" value={design.nameY} onChange={e => setDesign({...design, nameY: Number(e.target.value)})} className="w-full"/>
                                    
                                    <div className="flex justify-between text-xs text-gray-600"><span>大小缩放</span><span>{design.nameScale || 1}x</span></div>
                                    <input type="range" min="0.5" max="2.0" step="0.1" value={design.nameScale || 1} onChange={e => setDesign({...design, nameScale: Number(e.target.value)})} className="w-full"/>
                                </div>
                            </div>
                            
                            {design.contentMode === 'name_unit' && (
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-2">单位排版</label>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs text-gray-600"><span>上下位置</span><span>{design.unitY}px</span></div>
                                        <input type="range" min="-200" max="200" value={design.unitY} onChange={e => setDesign({...design, unitY: Number(e.target.value)})} className="w-full"/>
                                        
                                        <div className="flex justify-between text-xs text-gray-600"><span>大小缩放</span><span>{design.unitScale || 1}x</span></div>
                                        <input type="range" min="0.5" max="2.0" step="0.1" value={design.unitScale || 1} onChange={e => setDesign({...design, unitScale: Number(e.target.value)})} className="w-full"/>
                                    </div>
                                </div>
                            )}
                         </div>

                         <div className="w-full h-px bg-gray-200 my-4"></div>

                        {/* Logo Position */}
                        <div>
                             <label className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2"><Move size={14}/> Logo 位置</label>
                             <div className="space-y-3">
                                 <label className="flex items-center gap-2 p-2 border border-gray-300 border-dashed rounded cursor-pointer hover:bg-gray-50">
                                     <Upload size={14} className="text-gray-400"/>
                                     <span className="text-xs text-gray-600">上传 Logo...</span>
                                     <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload}/>
                                 </label>
                                 <div className="flex justify-between text-xs"><span>X 轴</span><span>{design.logoX.toFixed(1)}%</span></div>
                                 <input type="range" min="0" max="100" value={design.logoX} onChange={e => setDesign({...design, logoX: Number(e.target.value)})} className="w-full"/>
                                 
                                 <div className="flex justify-between text-xs"><span>Y 轴</span><span>{design.logoY.toFixed(1)}%</span></div>
                                 <input type="range" min="0" max="100" value={design.logoY} onChange={e => setDesign({...design, logoY: Number(e.target.value)})} className="w-full"/>
                                 
                                 <div className="flex justify-between text-xs"><span>大小</span><span>{design.logoSize}px</span></div>
                                 <input type="range" min="20" max="300" value={design.logoSize} onChange={e => setDesign({...design, logoSize: Number(e.target.value)})} className="w-full"/>
                             </div>
                        </div>
                    </>
                )}

                <div className="text-center">
                    <button onClick={handleAiDesign} disabled={isAiLoading} className="w-full py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded text-sm flex justify-center items-center gap-2">
                         {isAiLoading ? <RotateCw className="animate-spin" size={14}/> : <Sparkles size={14}/>} AI 配色建议
                    </button>
                    {settings && (
                        <p className="text-xs text-gray-400 mt-2 font-mono">
                            由 {aiProviderLabel} 驱动
                        </p>
                    )}
                </div>
           </div>
       </div>

       {/* Main Preview Area */}
       <div className="flex-1 flex flex-col min-w-0">
           {/* Add a specific style block for printing that forces the print area to scale correctly */}
            <style>{`
                @media print {
                    @page { size: A4; margin: 0; }
                    body { -webkit-print-color-adjust: exact; margin: 0; padding: 0; }
                    /* Make the container full width/height */
                    #print-area { 
                        transform: none !important; 
                        width: 210mm !important; 
                        margin: 0 auto !important;
                    }
                    /* Ensure individual cards take up a full page and break after */
                    .card-container {
                        break-after: page;
                        page-break-after: always;
                        border: none !important;
                        margin: 0 !important;
                        box-shadow: none !important;
                        height: 297mm !important;
                        width: 210mm !important;
                    }
                    /* Hide everything else */
                    .no-print, header, aside { display: none !important; }
                }
            `}</style>
           <div className="p-4 border-b border-gray-200 bg-white flex justify-between items-center no-print shadow-sm z-10">
                <button onClick={() => setShowSettings(!showSettings)} className="p-2 hover:bg-gray-100 rounded">
                    <Settings2 size={20} className={showSettings ? 'text-indigo-600' : 'text-gray-400'}/>
                </button>
                <div className="flex gap-4">
                     <div className="text-xs text-gray-400 flex items-center">
                        {activeTab === 'layout' 
                            ? "✨ 布局模式：可直接拖动预览区元素" 
                            : "🎨 样式模式：可点击文字直接编辑"}
                     </div>
                     <button 
                        onClick={handleDownloadAllImages}
                        disabled={isCapturing}
                        className="flex items-center gap-2 px-6 py-2 bg-indigo-600 border border-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all shadow-sm"
                    >
                        {isCapturing ? <RotateCw className="animate-spin" size={18}/> : <Package size={18}/>}
                        打包下载 (ZIP)
                    </button>
                    <button 
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition-all shadow-md"
                    >
                        <Printer size={18} /> 网页打印
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto bg-gray-200/50 p-8 print:p-0 print:bg-white print:overflow-visible">
                <div ref={printAreaRef} id="print-area" className="grid grid-cols-1 gap-12 print:block print:gap-0 max-w-[210mm] mx-auto origin-top transform scale-75 md:scale-100 print:scale-100 transition-transform">
                    {participants.map((p) => {
                        const fontSize = getFontSize(p.nameCN.replace(/\s/g, ''));
                        const unitFontSize = `${24 * (design.unitScale || 1)}pt`;
                        const bgStyle = getBackgroundStyle();
                        
                        // Template Classes
                        let containerClass = "";
                        let textClass = "";
                        if (design.templateId === 'bordered') containerClass = "border-[16px] border-double";
                        if (design.templateId === 'minimal') textClass = "font-thin tracking-[0.2em]";
                        if (design.templateId === 'modern') containerClass = "shadow-inner";

                        const nameStyle = { 
                            fontSize: fontSize, 
                            transform: `translateY(${design.nameY}px)`,
                            transition: 'transform 0.1s'
                        };
                        const unitStyle = { 
                            fontSize: unitFontSize, 
                            transform: `translateY(${design.unitY}px)`,
                            transition: 'transform 0.1s'
                        };
                        
                        // Interactive Classes based on mode
                        const nameCursor = activeTab === 'layout' ? 'cursor-ns-resize hover:opacity-80' : 'cursor-text';
                        const unitCursor = activeTab === 'layout' ? 'cursor-ns-resize hover:opacity-80' : 'cursor-text';
                        const logoCursor = activeTab === 'layout' ? 'cursor-move' : 'cursor-default';

                        return (
                        <div 
                            key={p.id} 
                            style={{ ...bgStyle, borderColor: design.fontColor, color: design.fontColor }} 
                            className={`card-container w-[210mm] h-[297mm] shadow-2xl relative flex flex-col print:shadow-none print:mb-0 print:break-after-page overflow-hidden ${design.fontFamily} ${containerClass}`}
                        >
                            
                            {/* Moveable Logo (Draggable in bottom half only technically, but here we absolute position it over everything. We'll enable drag on it) */}
                            {design.logo && (
                                <div 
                                    className={`absolute z-20 opacity-90 ${logoCursor}`}
                                    onMouseDown={(e) => handleMouseDown(e, 'logo')}
                                    style={{ 
                                        left: `${design.logoX}%`, 
                                        top: `${design.logoY}%`, 
                                        width: `${design.logoSize}px` 
                                    }}
                                >
                                    <img src={design.logo} alt="Logo" className="w-full object-contain pointer-events-none" />
                                </div>
                            )}

                            {/* Decorative Line Top (Upside Down part) */}
                            {design.showLine && (
                                <div className="absolute top-[48%] left-10 right-10 h-1 z-10" style={{ backgroundColor: design.lineColor }}></div>
                            )}

                            {/* Top Half (Upside down) - No Dragging here to avoid confusion with inversion */}
                            <div className="h-1/2 flex flex-col justify-center items-center p-12 border-b border-white/20 border-dashed print:border-none transform rotate-180 relative opacity-90 pointer-events-none">
                                <h1 style={nameStyle} className={`leading-tight font-bold whitespace-nowrap text-center ${textClass}`}>
                                    {p.nameCN}
                                </h1>
                                {design.contentMode === 'name_unit' && (
                                    <>
                                        {p.nameEN && (
                                            <p className="text-4xl mt-6 font-bold uppercase tracking-widest opacity-80 text-center">
                                                {p.nameEN}
                                            </p>
                                        )}
                                        <p style={unitStyle} className="mt-8 font-bold opacity-70 text-center">{p.unitCN}</p>
                                    </>
                                )}
                            </div>

                            {/* Bottom Half (Interactive) */}
                            <div className="h-1/2 flex flex-col justify-center items-center p-12 relative">
                                <h1 
                                    style={nameStyle} 
                                    className={`leading-tight font-bold whitespace-nowrap text-center ${textClass} ${nameCursor} transition-opacity`} 
                                    onMouseDown={(e) => handleMouseDown(e, 'name')}
                                    title={activeTab === 'layout' ? "拖动调整上下位置" : "点击编辑"}
                                    contentEditable={activeTab === 'style'}
                                    suppressContentEditableWarning
                                >
                                    {p.nameCN}
                                </h1>
                                {design.contentMode === 'name_unit' && (
                                    <>
                                        {p.nameEN && (
                                            <p 
                                                className={`text-4xl mt-6 font-bold uppercase tracking-widest opacity-80 text-center`} 
                                                contentEditable={activeTab === 'style'}
                                                suppressContentEditableWarning
                                            >
                                                {p.nameEN}
                                            </p>
                                        )}
                                        <p 
                                            style={unitStyle} 
                                            className={`mt-8 font-bold opacity-70 text-center ${unitCursor} transition-opacity`} 
                                            onMouseDown={(e) => handleMouseDown(e, 'unit')}
                                            title={activeTab === 'layout' ? "拖动调整上下位置" : "点击编辑"}
                                            contentEditable={activeTab === 'style'}
                                            suppressContentEditableWarning
                                        >
                                            {p.unitCN}
                                        </p>
                                    </>
                                )}
                            </div>
                        </div>
                    )})}
                </div>
            </div>
       </div>
    </div>
  );
};