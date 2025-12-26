
import React, { useState, useEffect } from 'react';
import { Participant, AppSettings } from '../types';
import { formatNameForForm } from '../utils';
import { translateParticipantInfo, parseParticipantsFromImage, parseParticipantsFromText, getAIProviderLabel } from '../services/aiService';
import { read, utils, writeFile } from 'xlsx';
import { Search, Plus, Download, Upload, Trash2, Globe, Sparkles, X, Check, Users, FileSpreadsheet, History, Save, Camera, FileType } from 'lucide-react';

interface ParticipantsViewProps {
  participants: Participant[];
  setParticipants: React.Dispatch<React.SetStateAction<Participant[]>>;
  settings: AppSettings;
}

export const ParticipantsView: React.FC<ParticipantsViewProps> = ({ participants, setParticipants, settings }) => {
  const [historyLibrary, setHistoryLibrary] = useState<Participant[]>([]);
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [showImport, setShowImport] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [textToImport, setTextToImport] = useState(''); // State for text import

  const aiProviderLabel = getAIProviderLabel(settings);

  // Load history on mount
  useEffect(() => {
    const stored = localStorage.getItem('participant_history');
    if (stored) {
        try {
            setHistoryLibrary(JSON.parse(stored));
        } catch(e) { console.error("History parse error", e); }
    }
  }, []);

  // Save history helper
  const saveToLibrary = (p: Participant) => {
    if (!p.nameCN) return;
    
    // Check if entry exists and needs update
    const existingIndex = historyLibrary.findIndex(h => h.nameCN === p.nameCN);
    let newLibrary = [...historyLibrary];

    if (existingIndex >= 0) {
        // Update existing if unit is provided
        if (p.unitCN) {
            newLibrary[existingIndex] = { ...newLibrary[existingIndex], ...p };
        }
    } else {
        // Add new
        newLibrary.push(p);
    }
    
    setHistoryLibrary(newLibrary);
    localStorage.setItem('participant_history', JSON.stringify(newLibrary));
  };

  const handleAddRow = () => {
    const newId = Date.now().toString();
    setParticipants([
      ...participants,
      { id: newId, isExternal: true, workIdOrPhone: '', nameCN: '', nameEN: '', unitCN: '', unitEN: '' }
    ]);
  };

  const updateRow = (id: string, field: keyof Participant, value: any) => {
    setParticipants(prev => prev.map(p => {
      if (p.id === id) {
        let updated = { ...p, [field]: value };
        
        // Auto-fill from history when name changes
        if (field === 'nameCN' && typeof value === 'string' && value.length >= 2) {
           const match = historyLibrary.find(h => h.nameCN === value);
           if (match) {
             updated = { 
                 ...updated, 
                 unitCN: match.unitCN || updated.unitCN,
                 unitEN: match.unitEN || updated.unitEN,
                 workIdOrPhone: match.workIdOrPhone || updated.workIdOrPhone,
                 isExternal: match.isExternal 
             }; 
           }
        }
        
        // Auto-save to history when Unit is filled
        if ((field === 'unitCN' || field === 'nameCN') && updated.nameCN && updated.unitCN) {
             saveToLibrary(updated);
        }

        return updated;
      }
      return p;
    }));
  };

  // Special handler for Name Blur to enforce 2-char spacing
  const handleNameBlur = (id: string, currentValue: string) => {
     // Apply formatter logic
     const formatted = formatNameForForm(currentValue);
     if (formatted !== currentValue) {
         updateRow(id, 'nameCN', formatted);
     }
  };

  const handleTranslate = async (id: string) => {
    const p = participants.find(x => x.id === id);
    if (!p) return;
    
    setLoadingMap(prev => ({ ...prev, [id]: true }));
    try {
        const result = await translateParticipantInfo(p, settings);
        if (result.nameEN || result.unitEN) {
           updateRow(id, 'nameEN', result.nameEN);
           updateRow(id, 'unitEN', result.unitEN);
           saveToLibrary({ ...p, ...result }); 
        }
    } catch (e) {
        alert(`使用 ${aiProviderLabel} 翻译失败，请检查设置。`);
    } finally {
        setLoadingMap(prev => ({ ...prev, [id]: false }));
    }
  };

  // --- Import Handlers ---

  const processImportedItems = (rawItems: Partial<Participant>[], sourcePrefix: string) => {
        const processed = rawItems.map((item, idx) => ({
            id: `${sourcePrefix}-${Date.now()}-${idx}`,
            isExternal: item.isExternal ?? true,
            workIdOrPhone: item.workIdOrPhone || '',
            nameCN: formatNameForForm(item.nameCN || ''), // APPLY FORMATTING HERE
            nameEN: item.nameEN || '',
            unitCN: item.unitCN || '',
            unitEN: item.unitEN || ''
        }));
        
        if (processed.length > 0) {
            setParticipants(prev => [...prev, ...processed]);
            processed.forEach(saveToLibrary);
            setShowImport(false);
        } else {
             alert("未识别到有效数据。");
        }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
        const data = await file.arrayBuffer();
        const workbook = read(data);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = utils.sheet_to_json(sheet, { header: 1 }) as any[][];
        const newItems: Partial<Participant>[] = [];
        jsonData.forEach((row, index) => {
            const firstCell = String(row[0] || "").trim();
            if (firstCell.startsWith("填写提示") || firstCell.includes("校外") || !row[2]) return;
            newItems.push({
                isExternal: String(row[0] || "").trim() !== "否",
                workIdOrPhone: String(row[1] || ""),
                nameCN: String(row[2] || ""),
                nameEN: String(row[3] || ""),
                unitCN: String(row[4] || ""),
                unitEN: String(row[5] || "")
            });
        });
        processImportedItems(newItems, 'excel');
    } catch (error) {
        alert("文件读取失败。");
    } finally {
        setIsImporting(false);
        e.target.value = '';
    }
  };

  const handleImageImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async () => {
            const base64Data = (reader.result as string).split(',')[1];
            // Ensure mimeType is valid, defaulting to jpeg if empty (common issue with some clipboards/systems)
            const mimeType = file.type || 'image/jpeg';
            try {
                const parsedItems = await parseParticipantsFromImage(base64Data, mimeType, settings);
                processImportedItems(parsedItems, 'ocr');
            } catch (err: any) { 
                console.error("AI Error:", err);
                alert(`使用 ${aiProviderLabel} 图片识别失败: ${err.message || '未知错误'}`); 
            } 
            finally { setIsImporting(false); }
        };
    } catch (e) { setIsImporting(false); }
    e.target.value = '';
  };

  const handleTextImport = async () => {
      if(!textToImport.trim()) return;
      setIsImporting(true);
      try {
          const parsedItems = await parseParticipantsFromText(textToImport, settings);
          processImportedItems(parsedItems, 'text');
          setTextToImport('');
      } catch (e) { alert(`使用 ${aiProviderLabel} 文本识别失败`); }
      finally { setIsImporting(false); }
  };

  const handleExportExcel = () => {
     const wb = utils.book_new();
     const wsData = [
         ["填写提示:\n1. 手机号用于接收会议短信提醒\n2. “外文姓名”和“单位外文名称”均用于制作电子桌牌"], 
         ["是否为校外人员", "工号/手机号\n(校外人员填写手机号)", "中文姓名", "外文姓名", "单位中文名称", "单位外文名称"]
     ];
     participants.forEach(p => {
         wsData.push([p.isExternal ? "是" : "否", p.workIdOrPhone, p.nameCN, p.nameEN, p.unitCN, p.unitEN]);
     });
     const ws = utils.aoa_to_sheet(wsData);
     if(!ws['!merges']) ws['!merges'] = [];
     ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } });
     ws['!cols'] = [{ wch: 20 }, { wch: 25 }, { wch: 15 }, { wch: 20 }, { wch: 30 }, { wch: 30 }];
     ws['!rows'] = [{ hpt: 60 }];
     utils.book_append_sheet(wb, ws, "参会名单");
     writeFile(wb, "会议参会人员名单.xlsx");
  };

  return (
    <div className="p-6 h-full flex flex-col bg-gray-50/50">
        <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
            <div>
                <h2 className="text-2xl font-serif-sc font-bold text-gray-900">参会人员管理</h2>
                <div className="flex items-center gap-2 mt-1">
                    <p className="text-gray-500 text-sm">人员库记录: {historyLibrary.length} 条</p>
                    <span className="text-gray-300">|</span>
                    <p className="text-gray-500 text-sm">已自动应用“两字姓名加空格”规则</p>
                     <span className="text-gray-300">|</span>
                    <span className="text-xs text-gray-400 font-mono px-2 py-0.5 bg-white border border-gray-200 rounded" title={`AI 功能由 ${aiProviderLabel} 提供支持`}>
                        AI: {aiProviderLabel}
                    </span>
                </div>
            </div>
            
            <div className="flex gap-3">
                 <button 
                    onClick={() => setShowImport(true)} 
                    className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium shadow-sm transition-all"
                >
                    <Upload size={16} /> 导入数据
                </button>
                <button 
                    onClick={handleExportExcel} 
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium shadow-sm transition-all"
                >
                    <Download size={16} /> 导出 Excel
                </button>
                 <button 
                    onClick={handleAddRow} 
                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 text-sm font-medium shadow-sm transition-all"
                >
                    <Plus size={16} /> 新增人员
                </button>
            </div>
        </div>

        {/* Import Modal */}
        {showImport && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-2xl w-[800px] p-8 transform transition-all">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold font-serif-sc text-gray-900 flex items-center gap-2">
                            <Upload className="text-indigo-600"/> 导入数据
                        </h3>
                        <button onClick={() => setShowImport(false)} className="text-gray-400 hover:text-gray-600">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-6">
                         {/* Excel Import */}
                        <div className="border border-gray-200 rounded-xl p-4 hover:border-green-400 transition-colors bg-gray-50 flex flex-col justify-between">
                            <div>
                                <h4 className="font-bold text-gray-800 flex items-center gap-2">
                                    <FileSpreadsheet size={18} className="text-green-600"/> Excel 导入
                                </h4>
                                <p className="text-xs text-gray-500 mb-2">标准模板导入</p>
                            </div>
                            <label className="block w-full text-center py-2 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-white transition-colors bg-white">
                                <span className="text-xs text-gray-600 font-medium">点击上传 Excel</span>
                                <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileImport} />
                            </label>
                        </div>

                        {/* Image OCR Import */}
                        <div className="border border-gray-200 rounded-xl p-4 hover:border-blue-400 transition-colors bg-gray-50 flex flex-col justify-between">
                             <div>
                                <h4 className="font-bold text-gray-800 flex items-center gap-2">
                                    <Camera size={18} className="text-blue-600"/> 图片识别
                                </h4>
                                <p className="text-xs text-gray-500 mb-2">拍照/截图导入</p>
                             </div>
                            <label className="block w-full text-center py-2 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-white transition-colors bg-white">
                                <span className="text-xs text-gray-600 font-medium">点击上传图片</span>
                                <input type="file" className="hidden" accept="image/*" onChange={handleImageImport} disabled={isImporting} />
                            </label>
                        </div>

                        {/* Text AI Import */}
                         <div className="border border-gray-200 rounded-xl p-4 hover:border-purple-400 transition-colors bg-gray-50 flex flex-col justify-between">
                             <div>
                                <h4 className="font-bold text-gray-800 flex items-center gap-2">
                                    <FileType size={18} className="text-purple-600"/> 文本识别
                                </h4>
                                <p className="text-xs text-gray-500 mb-2">粘贴任意文本</p>
                             </div>
                            <button onClick={() => document.getElementById('text-import-area')?.focus()} className="block w-full text-center py-2 border-2 border-dashed border-gray-300 rounded-lg hover:bg-white transition-colors bg-white">
                                <span className="text-xs text-gray-600 font-medium">在下方粘贴</span>
                            </button>
                        </div>
                    </div>

                    <div className="relative">
                        <textarea 
                             id="text-import-area"
                             value={textToImport}
                             onChange={(e) => setTextToImport(e.target.value)}
                             placeholder="在此粘贴包含名单的文本，例如：张三（法大）、李四（北大）..."
                             className="w-full h-32 p-3 border border-gray-300 rounded-lg text-sm mb-2"
                        />
                        <button 
                            onClick={handleTextImport}
                            disabled={!textToImport.trim() || isImporting}
                            className="absolute right-2 bottom-4 px-3 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700 disabled:opacity-50"
                        >
                            AI 识别文本
                        </button>
                    </div>

                    {isImporting && (
                         <div className="text-center text-indigo-600 text-sm mt-2 flex items-center justify-center gap-2">
                             <div className="animate-spin rounded-full h-4 w-4 border-2 border-indigo-600 border-t-transparent"></div>
                             智能处理中...
                         </div>
                    )}
                    <div className="text-center text-xs text-gray-400 mt-2 font-mono">
                        图片和文本识别由 {aiProviderLabel} 提供支持
                    </div>
                </div>
            </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-hidden bg-white shadow-md border border-gray-300 rounded-lg flex flex-col relative">
            <div className="overflow-x-auto overflow-y-auto flex-1 w-full">
                <table id="participant-table" className="w-full min-w-[1100px] border-collapse">
                    <thead className="bg-gray-100 sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="border border-gray-300 px-2 py-3 text-center text-xs font-bold text-gray-700 w-24 bg-gray-50">是否为校外人员</th>
                            <th className="border border-gray-300 px-2 py-3 text-center text-xs font-bold text-gray-700 w-32 bg-gray-50">工号/手机号</th>
                            <th className="border border-gray-300 px-2 py-3 text-center text-xs font-bold text-gray-700 w-32 bg-gray-50">中文姓名</th>
                            <th className="border border-gray-300 px-2 py-3 text-center text-xs font-bold text-gray-700 w-40 bg-gray-50">外文姓名</th>
                            <th className="border border-gray-300 px-2 py-3 text-center text-xs font-bold text-gray-700 w-48 bg-gray-50">单位中文名称</th>
                            <th className="border border-gray-300 px-2 py-3 text-center text-xs font-bold text-gray-700 w-48 bg-gray-50">单位外文名称</th>
                            <th className="border border-gray-300 px-2 py-3 text-center text-xs font-bold text-gray-700 w-20 bg-gray-50">操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {participants.map((p) => (
                            <tr key={p.id} className="hover:bg-blue-50/30 transition-colors group">
                                <td className="border border-gray-300 p-0 text-center align-middle h-10">
                                    <select 
                                        value={p.isExternal ? 'yes' : 'no'}
                                        onChange={(e) => updateRow(p.id, 'isExternal', e.target.value === 'yes')}
                                        className={`w-full h-full text-center text-sm border-none focus:ring-0 cursor-pointer ${p.isExternal ? 'text-orange-600 font-medium' : 'text-gray-600'}`}
                                    >
                                        <option value="yes">是</option>
                                        <option value="no">否</option>
                                    </select>
                                </td>
                                <td className="border border-gray-300 p-0">
                                    <input 
                                        type="text" 
                                        value={p.workIdOrPhone}
                                        onChange={(e) => updateRow(p.id, 'workIdOrPhone', e.target.value)}
                                        className="w-full h-full px-2 py-2 bg-transparent border-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 text-sm text-center"
                                    />
                                </td>
                                <td className="border border-gray-300 p-0 relative">
                                    <input 
                                        type="text" 
                                        value={p.nameCN}
                                        onChange={(e) => updateRow(p.id, 'nameCN', e.target.value)}
                                        onBlur={(e) => handleNameBlur(p.id, e.target.value)}
                                        className="w-full h-full px-2 py-2 bg-transparent border-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 text-sm font-semibold text-gray-900 text-center"
                                    />
                                     {historyLibrary.some(h => h.nameCN === p.nameCN) && (
                                        <div className="absolute top-1 right-1 text-green-500 pointer-events-none" title="已从库中匹配">
                                            <History size={10} />
                                        </div>
                                    )}
                                </td>
                                <td className="border border-gray-300 p-0">
                                    <input 
                                        type="text" 
                                        value={p.nameEN}
                                        onChange={(e) => updateRow(p.id, 'nameEN', e.target.value)}
                                        className="w-full h-full px-2 py-2 bg-transparent border-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 text-sm text-center font-serif text-gray-600"
                                    />
                                </td>
                                <td className="border border-gray-300 p-0">
                                    <input 
                                        type="text" 
                                        value={p.unitCN}
                                        onChange={(e) => updateRow(p.id, 'unitCN', e.target.value)}
                                        className="w-full h-full px-2 py-2 bg-transparent border-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 text-sm text-center"
                                    />
                                </td>
                                <td className="border border-gray-300 p-0">
                                    <input 
                                        type="text" 
                                        value={p.unitEN}
                                        onChange={(e) => updateRow(p.id, 'unitEN', e.target.value)}
                                        className="w-full h-full px-2 py-2 bg-transparent border-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 text-sm text-center text-gray-600"
                                    />
                                </td>
                                <td className="border border-gray-300 p-0 text-center align-middle">
                                    <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={() => handleTranslate(p.id)}
                                            disabled={loadingMap[p.id]}
                                            className={`p-1.5 rounded hover:bg-indigo-100 transition-colors ${loadingMap[p.id] ? 'animate-spin text-gray-400' : 'text-indigo-600'}`}
                                            title="AI Translate"
                                        >
                                            <Globe size={14} />
                                        </button>
                                        <button 
                                            onClick={() => {
                                                const filtered = participants.filter(x => x.id !== p.id);
                                                setParticipants(filtered);
                                            }}
                                            className="p-1.5 text-red-600 rounded hover:bg-red-100 transition-colors"
                                            title="Delete"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="bg-gray-50 px-4 py-2 border-t border-gray-300 text-xs text-gray-500 flex justify-between">
                <span>共 {participants.length} 人</span>
                <span>AI Meeting v3.1</span>
            </div>
        </div>
    </div>
  );
};
