
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AssetItem, AssetStatus, AssetCategory, AppSettings, AssetLog } from '../types';
import { 
  Plus, Trash2, Download, Search, Package, ArrowLeftCircle, X, 
  Sparkles, Loader2, QrCode, 
  ShieldCheck, Wrench, Clock, TrendingUp, AlertTriangle, 
  ArrowUpDown, ArrowUp, ArrowDown, Copy, ListFilter, ScanLine, 
  Sheet, History, MapPin, ArrowRightLeft
} from 'lucide-react';
import { utils, writeFile } from 'xlsx';
import { parseAssetRequest, parseAssetsFromImage, getAIProviderLabel } from '../services/aiService';

interface AssetManagerViewProps {
  onBack: () => void;
  settings?: AppSettings;
}

type SortKey = 'assetTag' | 'name' | 'price' | 'purchaseDate' | 'status' | 'location';

export const AssetManagerView: React.FC<AssetManagerViewProps> = ({ onBack, settings }) => {
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [sheets, setSheets] = useState<string[]>(['资产台账']);
  const [activeSheet, setActiveSheet] = useState<string>('资产台账');
  const [renamingSheet, setRenamingSheet] = useState<string | null>(null);
  const [newSheetName, setNewSheetName] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<AssetStatus | 'All'>('All');
  const [filterCategory, setFilterCategory] = useState<AssetCategory | 'All'>('All');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiText, setAiText] = useState('');
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiModalTab, setAiModalTab] = useState<'text' | 'ocr'>('text');
  const [showLabelModal, setShowLabelModal] = useState<AssetItem | null>(null);
  const ocrFileInputRef = useRef<HTMLInputElement>(null);

  // New Log State
  const [newLogNote, setNewLogNote] = useState('');

  useEffect(() => {
    const savedAssets = localStorage.getItem('app_assets');
    const savedSheets = localStorage.getItem('app_asset_sheets');
    
    if (savedAssets) {
      try { 
        const parsed = JSON.parse(savedAssets);
        // Ensure backward compatibility: assign default sheet if missing
        setAssets(parsed.map((item: any) => ({ 
            ...item, 
            logs: item.logs || [],
            sheet: item.sheet || '资产台账'
        }))); 
      } catch (e) { console.error(e); }
    }

    if (savedSheets) {
        try { setSheets(JSON.parse(savedSheets)); } catch (e) { console.error(e); }
    } else {
        setSheets(['资产台账']);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('app_assets', JSON.stringify(assets));
  }, [assets]);

  useEffect(() => {
    localStorage.setItem('app_asset_sheets', JSON.stringify(sheets));
  }, [sheets]);
  
  // Sheet Management
  const handleAddSheet = () => {
      const newName = `Sheet ${sheets.length + 1}`;
      setSheets([...sheets, newName]);
      setActiveSheet(newName);
  };

  const handleDeleteSheet = (sheetName: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (sheets.length === 1) return alert("至少保留一个工作表");
      if (!confirm(`确定删除工作表 "${sheetName}" 及其所有资产数据吗？`)) return;
      
      const newSheets = sheets.filter(s => s !== sheetName);
      setSheets(newSheets);
      if (activeSheet === sheetName) setActiveSheet(newSheets[0]);
      
      // Delete assets in this sheet
      setAssets(assets.filter(a => a.sheet !== sheetName));
  };

  const handleRenameSheetStart = (sheetName: string) => {
      setRenamingSheet(sheetName);
      setNewSheetName(sheetName);
  };

  const handleRenameSheetConfirm = () => {
      if (!newSheetName.trim() || !renamingSheet) {
          setRenamingSheet(null);
          return;
      }
      if (sheets.includes(newSheetName) && newSheetName !== renamingSheet) {
          alert("工作表名称已存在");
          return;
      }
      
      const oldName = renamingSheet;
      setSheets(sheets.map(s => s === oldName ? newSheetName : s));
      setActiveSheet(newSheetName);
      
      // Update assets
      setAssets(assets.map(a => a.sheet === oldName ? { ...a, sheet: newSheetName } : a));
      
      setRenamingSheet(null);
  };

  const isWarrantyExpiring = (dateStr?: string) => {
      if (!dateStr) return false;
      const warrantyDate = new Date(dateStr);
      const today = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(today.getDate() + 30);
      return warrantyDate > today && warrantyDate <= thirtyDaysFromNow;
  };

  const calculateAge = (dateStr: string) => {
    const start = new Date(dateStr);
    const end = new Date();
    if (isNaN(start.getTime())) return { label: '缺失', color: 'text-slate-300', totalDays: 0 };
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const years = Math.floor(diffDays / 365);
    const months = Math.floor((diffDays % 365) / 30);
    let label = years > 0 ? `${years}年${months}月` : months > 0 ? `${months}月` : `${diffDays}天`;
    let color = years >= 3 ? 'text-rose-500' : years >= 1 ? 'text-amber-500' : 'text-emerald-500';
    return { label, color, totalDays: diffDays };
  };

  const stats = useMemo(() => {
      const sheetAssets = assets.filter(a => a.sheet === activeSheet);
      return {
          total: sheetAssets.length,
          totalValue: sheetAssets.reduce((acc, a) => acc + (parseFloat(a.price) || 0), 0),
          maintenance: sheetAssets.filter(a => a.status === 'maintenance').length,
          expiringSoon: sheetAssets.filter(a => isWarrantyExpiring(a.warrantyUntil)).length,
      };
  }, [assets, activeSheet]);

  const handleAddRow = () => {
    const newAsset: AssetItem = {
      id: Date.now().toString(),
      name: '新录入资产',
      brandModel: '',
      price: '0',
      location: '未分配',
      assetTag: `ZC${new Date().getFullYear()}${Math.floor(Math.random()*9000+1000)}`,
      status: 'idle',
      category: 'Other',
      purchaseDate: new Date().toISOString().split('T')[0],
      sheet: activeSheet, // Bind to current sheet
      logs: [{ id: Date.now().toString(), type: 'Update', date: new Date().toLocaleDateString(), operator: 'System', notes: '初始化入库' }]
    };
    setAssets([newAsset, ...assets]);
    setSelectedAssetId(newAsset.id);
  };
  
  const handleCloneAsset = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const source = assets.find(a => a.id === id);
      if (!source) return;
      const clone: AssetItem = { 
          ...source, 
          id: Date.now().toString(), 
          assetTag: `${source.assetTag}-CL`, 
          serialNumber: '', 
          sheet: activeSheet,
          logs: [{ id: Date.now().toString(), type: 'Update', date: new Date().toLocaleDateString(), operator: 'System', notes: `从 ${source.assetTag} 克隆生成` }] 
      };
      setAssets([clone, ...assets]);
      setSelectedAssetId(clone.id);
  };
  
  const deleteAssets = (ids: string[]) => {
      if (window.confirm(`警告：确定要永久删除这 ${ids.length} 项记录吗？`)) {
          setAssets(prev => prev.filter(a => !ids.includes(a.id)));
          setSelectedIds(new Set());
          if (ids.includes(selectedAssetId || '')) setSelectedAssetId(null);
      }
  };

  const handleBulkTransfer = (ids: string[]) => {
      const newLocation = prompt("请输入新的存放位置 (例如: 主楼205):");
      if (newLocation !== null) {
          const locationVal = newLocation.trim() || '未分配';
          setAssets(prev => prev.map(a => {
              if (ids.includes(a.id)) {
                  const newLog: AssetLog = {
                      id: Date.now().toString() + Math.random().toString(),
                      type: 'Transfer',
                      date: new Date().toLocaleDateString(),
                      operator: 'Admin',
                      notes: `批量转移位置: ${a.location} -> ${locationVal}`
                  };
                  return { ...a, location: locationVal, logs: [newLog, ...(a.logs || [])] };
              }
              return a;
          }));
          setSelectedIds(new Set());
          alert(`已更新 ${ids.length} 项资产的位置。`);
      }
  };

  const handleSort = (key: SortKey) => {
      let direction: 'asc' | 'desc' = 'asc';
      if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
      setSortConfig({ key, direction });
  };
  
  const handleSelect = (id: string) => {
      const newSelection = new Set(selectedIds);
      if (newSelection.has(id)) {
          newSelection.delete(id);
      } else {
          newSelection.add(id);
      }
      setSelectedIds(newSelection);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.checked) {
          setSelectedIds(new Set(processedAssets.map(a => a.id)));
      } else {
          setSelectedIds(new Set());
      }
  };

  const updateAsset = (id: string, field: keyof AssetItem, value: any) => {
    setAssets(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
  };
  
  const handleAiQuickAdd = async () => {
      if (!aiText.trim() || !settings) return;
      setIsAiLoading(true);
      try {
          const parsed = await parseAssetRequest(aiText, settings);
          const newItems: AssetItem[] = parsed.map((p, idx) => ({
              id: (Date.now() + idx).toString(),
              name: p.name || 'AI识别资产',
              brandModel: p.brandModel || '',
              price: p.price || '0',
              location: p.location || '待定',
              assetTag: `AI${Math.floor(Math.random()*100000)}`,
              status: 'idle',
              category: p.category || 'Other',
              purchaseDate: new Date().toISOString().split('T')[0],
              sheet: activeSheet,
              logs: [{ id: (Date.now() + idx).toString(), type: 'Update', date: new Date().toLocaleDateString(), operator: 'AI助手', notes: '智能识别入库' }]
          }));
          setAssets([...newItems, ...assets]);
          setShowAiModal(false);
          setAiText('');
      } catch (e) { alert("AI 解析失败"); } finally { setIsAiLoading(false); }
  };
  
  const handleOcrUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !settings) return;
      setIsAiLoading(true);
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
          try {
              const base64Data = (reader.result as string).split(',')[1];
              const parsed = await parseAssetsFromImage(base64Data, file.type, settings);
              const newItems: AssetItem[] = parsed.map((p, idx) => ({
                  id: (Date.now() + idx).toString(),
                  name: p.name || 'OCR识别资产',
                  brandModel: p.brandModel || '',
                  price: p.price || '0',
                  location: '待入库',
                  assetTag: p.assetTag || `OCR${Math.floor(Math.random()*100000)}`,
                  serialNumber: p.serialNumber || '',
                  purchaseDate: p.purchaseDate || new Date().toISOString().split('T')[0],
                  status: 'idle',
                  category: p.category || 'Other',
                  sheet: activeSheet,
                  logs: [{ id: (Date.now() + idx).toString(), type: 'Update', date: new Date().toLocaleDateString(), operator: 'AI-OCR', notes: `从文件 ${file.name} 扫描入库` }]
              }));
              setAssets([...newItems, ...assets]);
              setShowAiModal(false);
          } catch(err) {
              alert(`OCR 识别失败: ${err}`);
          } finally {
              setIsAiLoading(false);
          }
      };
      e.target.value = '';
  };

  const handleAddLog = (assetId: string) => {
      if (!newLogNote.trim()) return;
      const newLog: AssetLog = { 
          id: Date.now().toString(), 
          type: 'Maintenance', 
          date: new Date().toLocaleDateString(), 
          operator: 'Admin', 
          notes: newLogNote 
      };
      setAssets(prev => prev.map(a => a.id === assetId ? { ...a, logs: [newLog, ...(a.logs || [])], status: 'maintenance' } : a));
      setNewLogNote('');
  };

  const handleExportSheet = () => {
      const sheetData = assets
          .filter(a => a.sheet === activeSheet)
          .map(a => ({
              "资产编号": a.assetTag,
              "名称": a.name,
              "品牌型号": a.brandModel,
              "分类": a.category,
              "状态": a.status,
              "位置": a.location,
              "价格": a.price,
              "购置日期": a.purchaseDate,
              "维保到期": a.warrantyUntil || '-'
          }));
      const ws = utils.json_to_sheet(sheetData);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, activeSheet);
      writeFile(wb, `${activeSheet}_Export.xlsx`);
  };

  const processedAssets = useMemo(() => {
    let result = assets.filter(a => {
        const matchesSearch = (a.name + a.location + a.assetTag + a.brandModel).toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = filterStatus === 'All' || a.status === filterStatus;
        const matchesCat = filterCategory === 'All' || a.category === filterCategory;
        const matchesSheet = a.sheet === activeSheet; // Filter by Sheet
        return matchesSearch && matchesStatus && matchesCat && matchesSheet;
    });
    if (sortConfig) {
        result.sort((a, b) => {
            // Type assertion here prevents build errors
            const aVal = (a as any)[sortConfig.key] || '';
            const bVal = (b as any)[sortConfig.key] || '';
            
            if (sortConfig.key === 'price') {
                return sortConfig.direction === 'asc' 
                    ? parseFloat(a.price) - parseFloat(b.price) 
                    : parseFloat(b.price) - parseFloat(a.price);
            }
            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }
    return result;
  }, [assets, searchTerm, filterStatus, filterCategory, sortConfig, activeSheet]);

  const selectedAsset = assets.find(a => a.id === selectedAssetId);
  const getSortIcon = (key: SortKey) => {
      if (sortConfig?.key !== key) return <ArrowUpDown size={12} className="opacity-20" />;
      return sortConfig.direction === 'asc' ? <ArrowUp size={12} className="text-indigo-600" /> : <ArrowDown size={12} className="text-indigo-600" />;
  };

  return (
    <div className="h-full flex flex-col bg-[#f0f2f5] overflow-hidden font-sans relative">
      <header className="bg-white border-b h-20 flex items-center justify-between px-8 shrink-0 shadow-sm z-30">
           <div className="flex items-center gap-4">
                <button onClick={onBack} className="w-10 h-10 flex items-center justify-center bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all shadow-sm"><ArrowLeftCircle size={24} /></button>
                <div className="flex flex-col">
                    <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
                        <ShieldCheck size={22} className="text-indigo-600"/> 
                        资产智能运维中心 Pro
                    </h1>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Asset Lifecycle OS</p>
                </div>
           </div>
           
           <div className="flex gap-3">
                <div className="relative">
                    <input type="text" placeholder="快速检索..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 pr-4 py-2.5 bg-slate-100 border-none rounded-xl text-xs w-64 focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner" />
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300"/>
                </div>
                <button onClick={() => setShowAiModal(true)} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 text-indigo-700 rounded-xl hover:bg-indigo-100 text-[11px] font-black uppercase border border-indigo-100 transition-all">
                    <Sparkles size={16}/> AI 录入
                </button>
                <button onClick={handleAddRow} className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-black text-[11px] font-black shadow-lg transition-all active:scale-95">
                    <Plus size={18} /> 新增资产
                </button>
           </div>
      </header>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-6 px-8 py-6 shrink-0 bg-slate-50/50 border-b border-slate-100">
          {[
              { label: '本表总数', value: stats.total, unit: '项', icon: Package, color: 'indigo' },
              { label: '资产原值', value: stats.totalValue.toLocaleString(), unit: 'CNY', icon: TrendingUp, color: 'emerald' },
              { label: '维保预警', value: stats.expiringSoon, unit: '项', icon: Clock, color: 'blue' },
              { label: '异常/待修', value: stats.maintenance, unit: '项', icon: Wrench, color: 'amber' }
          ].map((s, idx) => (
              <div key={idx} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4 group hover:shadow-md transition-all">
                  <div className={`w-12 h-12 bg-${s.color}-50 text-${s.color}-600 rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform`}><s.icon size={24}/></div>
                  <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{s.label}</p>
                      <h4 className="text-2xl font-black text-slate-800 tabular-nums">{s.value} <span className="text-[10px] font-bold text-slate-300">{s.unit}</span></h4>
                  </div>
              </div>
          ))}
      </div>

      <main className="flex-1 overflow-hidden px-8 pb-8 flex flex-col gap-4 relative">
          
          {/* Sheet Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-4">
              {sheets.map(sheet => (
                  <div 
                    key={sheet}
                    onClick={() => setActiveSheet(sheet)}
                    onDoubleClick={() => handleRenameSheetStart(sheet)}
                    className={`
                        relative group flex items-center gap-2 px-6 py-3 rounded-t-2xl cursor-pointer text-sm font-bold border-t border-x transition-all select-none
                        ${activeSheet === sheet ? 'bg-white border-slate-200 text-indigo-700 shadow-[0_-5px_15px_-5px_rgba(0,0,0,0.05)] z-10 top-[1px]' : 'bg-slate-100 border-transparent text-slate-500 hover:bg-slate-200'}
                    `}
                  >
                      <Sheet size={14}/>
                      {renamingSheet === sheet ? (
                          <input 
                            autoFocus 
                            value={newSheetName} 
                            onChange={e => setNewSheetName(e.target.value)} 
                            onBlur={handleRenameSheetConfirm} 
                            onKeyDown={e => e.key === 'Enter' && handleRenameSheetConfirm()}
                            className="bg-transparent outline-none w-24 border-b border-indigo-500"
                          />
                      ) : (
                          <span>{sheet}</span>
                      )}
                      {sheets.length > 1 && (
                          <button 
                            onClick={(e) => handleDeleteSheet(sheet, e)}
                            className="w-5 h-5 rounded-full hover:bg-red-100 hover:text-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                              <X size={12}/>
                          </button>
                      )}
                  </div>
              ))}
              <button onClick={handleAddSheet} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 transition-colors"><Plus size={16}/></button>
          </div>

          <div className="flex-1 bg-white rounded-b-2xl rounded-tr-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-row min-w-0 z-0">
                
                {/* Table Container */}
                <div className="flex-1 flex flex-col min-w-0">
                    <div className="px-8 py-4 bg-white border-b flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-lg border border-slate-100">
                                <ListFilter size={14} className="text-slate-400 ml-2" />
                                <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value as any)} className="text-[11px] font-black uppercase bg-transparent rounded-lg text-slate-600 px-3 py-1.5 outline-none cursor-pointer hover:text-indigo-600">
                                    <option value="All">资产分类: 全部</option>
                                    <option value="IT">IT硬件</option>
                                    <option value="Electronic">办公电器</option>
                                    <option value="Furniture">办公家具</option>
                                    <option value="Other">其他</option>
                                </select>
                            </div>
                            <button onClick={handleExportSheet} className="text-xs font-bold text-green-600 hover:text-green-700 flex items-center gap-1 bg-green-50 px-3 py-1.5 rounded-lg border border-green-100">
                                <Download size={14}/> 导出此表
                            </button>
                        </div>
                        {selectedIds.size > 0 && (
                            <div className="flex items-center gap-3 animate-fadeIn">
                                <span className="text-xs font-bold text-indigo-600">{selectedIds.size} 项已选</span>
                                <button onClick={() => handleBulkTransfer(Array.from(selectedIds))} className="flex items-center gap-2 px-3 py-1.5 text-xs bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100">
                                    <ArrowRightLeft size={14}/> 批量转移
                                </button>
                                <button onClick={() => deleteAssets(Array.from(selectedIds))} className="flex items-center gap-2 px-3 py-1.5 text-xs bg-red-50 text-red-600 rounded-lg hover:bg-red-100">
                                    <Trash2 size={14}/> 删除选中
                                </button>
                            </div>
                        )}
                    </div>
                    
                    <div className="overflow-auto flex-1 custom-scrollbar">
                        <table className="w-full text-left border-collapse table-fixed">
                            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-20">
                                <tr className="text-xs font-black text-slate-900 uppercase tracking-wider">
                                    <th className="px-6 py-4 w-16 text-center">
                                        <input type="checkbox" onChange={handleSelectAll} checked={selectedIds.size > 0 && selectedIds.size === processedAssets.length} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                                    </th>
                                    <th className="px-4 py-4 w-32 cursor-pointer group" onClick={() => handleSort('assetTag')}>
                                        <div className="flex items-center gap-2">资产编号 {getSortIcon('assetTag')}</div>
                                    </th>
                                    <th className="px-4 py-4 cursor-pointer group" onClick={() => handleSort('name')}>
                                        <div className="flex items-center gap-2">名称/规格 {getSortIcon('name')}</div>
                                    </th>
                                    <th className="px-4 py-4 w-40 cursor-pointer group" onClick={() => handleSort('location')}>
                                        <div className="flex items-center gap-2">设备位置 {getSortIcon('location')}</div>
                                    </th>
                                    <th className="px-4 py-4 w-28 text-center">状态</th>
                                    <th className="px-4 py-4 w-24 text-center">役龄</th>
                                    <th className="px-4 py-4 w-28 text-right pr-8 cursor-pointer group" onClick={() => handleSort('price')}>
                                        <div className="flex items-center gap-2 justify-end">原值 {getSortIcon('price')}</div>
                                    </th>
                                    <th className="px-6 py-4 w-24 text-center">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {processedAssets.map((asset) => {
                                    const age = calculateAge(asset.purchaseDate);
                                    const expiring = isWarrantyExpiring(asset.warrantyUntil);
                                    return (
                                        <tr key={asset.id} onClick={() => setSelectedAssetId(asset.id)} className={`group hover:bg-indigo-50/20 transition-all cursor-pointer relative ${selectedAssetId === asset.id ? 'bg-indigo-50/50 ring-1 ring-inset ring-indigo-100' : ''}`}>
                                            <td className="px-6 py-4 text-center">
                                                <input type="checkbox" checked={selectedIds.has(asset.id)} onChange={() => handleSelect(asset.id)} onClick={e => e.stopPropagation()} className="w-4 h-4 rounded border-slate-300 text-indigo-600" />
                                            </td>
                                            <td className="px-4 py-4"><span className="text-[11px] font-mono font-black text-slate-500 bg-slate-100 px-2 py-1 rounded tracking-tighter">{asset.assetTag}</span></td>
                                            <td className="px-4 py-4"><div className="flex flex-col"><span className="text-sm font-black text-slate-900 truncate flex items-center gap-2">{asset.name} {expiring && <span title="维保即将到期"><AlertTriangle size={12} className="text-amber-500" /></span>}</span><span className="text-[9px] font-bold text-slate-300 uppercase">{asset.category} | {asset.brandModel || '标准'}</span></div></td>
                                            <td className="px-4 py-4"><div className="flex items-center gap-1.5 text-xs font-bold text-slate-600"><MapPin size={12} className="text-indigo-400"/> {asset.location}</div></td>
                                            <td className="px-4 py-4 text-center">
                                                <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border ${asset.status === 'in_use' ? 'bg-emerald-50 text-emerald-600' : asset.status === 'maintenance' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
                                                    <div className={`w-1.5 h-1.5 rounded-full ${asset.status === 'in_use' ? 'bg-emerald-500' : asset.status === 'maintenance' ? 'bg-amber-500' : 'bg-slate-400'}`}></div>
                                                    <span className="text-[9px] font-black uppercase">{asset.status === 'in_use' ? '在用' : asset.status === 'maintenance' ? '维修' : '闲置'}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-center"><span className={`text-[10px] font-black ${age.color}`}>{age.label}</span></td>
                                            <td className="px-4 py-4 text-right pr-8"><span className="text-xs font-mono font-black text-slate-900">¥{(parseFloat(asset.price) || 0).toLocaleString()}</span></td>
                                            <td className="px-6 py-4 text-center"><div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={(e) => handleCloneAsset(asset.id, e)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg" title="克隆"><Copy size={14}/></button>
                                                <button onClick={(e) => deleteAssets([asset.id])} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg" title="删除"><Trash2 size={14}/></button>
                                            </div></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Right Details Panel */}
                {selectedAsset && (
                    <div className="w-[400px] border-l border-slate-200 bg-slate-50 flex flex-col animate-slideLeft shadow-2xl z-20">
                        <div className="p-6 bg-white border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-black text-slate-900 leading-tight">资产详情</h3>
                                <p className="text-[10px] text-slate-400 font-mono mt-1">{selectedAsset.assetTag}</p>
                            </div>
                            <button onClick={() => setShowLabelModal(selectedAsset)} className="p-2 text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors" title="打印标签">
                                <QrCode size={18}/>
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Main Info */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">资产名称</label>
                                    <input value={selectedAsset.name} onChange={e => updateAsset(selectedAsset.id, 'name', e.target.value)} className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"/>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">品牌型号</label>
                                        <input value={selectedAsset.brandModel} onChange={e => updateAsset(selectedAsset.id, 'brandModel', e.target.value)} className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-medium outline-none"/>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">当前状态</label>
                                        <select value={selectedAsset.status} onChange={e => updateAsset(selectedAsset.id, 'status', e.target.value)} className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-medium outline-none">
                                            <option value="idle">闲置 (Idle)</option>
                                            <option value="in_use">在用 (In Use)</option>
                                            <option value="maintenance">维修中 (Maintenance)</option>
                                            <option value="scrapped">已报废 (Scrapped)</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">购入价格</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-2.5 text-xs text-slate-400">¥</span>
                                            <input value={selectedAsset.price} onChange={e => updateAsset(selectedAsset.id, 'price', e.target.value)} className="w-full pl-6 p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-medium outline-none"/>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">购置日期</label>
                                        <input type="date" value={selectedAsset.purchaseDate} onChange={e => updateAsset(selectedAsset.id, 'purchaseDate', e.target.value)} className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-medium outline-none"/>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">存放位置</label>
                                    <input value={selectedAsset.location} onChange={e => updateAsset(selectedAsset.id, 'location', e.target.value)} className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-medium outline-none" placeholder="例如：主楼 305"/>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">维保到期</label>
                                    <input type="date" value={selectedAsset.warrantyUntil || ''} onChange={e => updateAsset(selectedAsset.id, 'warrantyUntil', e.target.value)} className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-medium outline-none"/>
                                </div>
                            </div>

                            <hr className="border-slate-200"/>

                            {/* Maintenance Logs */}
                            <div>
                                <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <History size={14}/> 运维日志
                                </h4>
                                <div className="space-y-4">
                                    <div className="flex gap-2">
                                        <input value={newLogNote} onChange={e => setNewLogNote(e.target.value)} placeholder="输入维护/变更记录..." className="flex-1 p-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500"/>
                                        <button onClick={() => handleAddLog(selectedAsset.id)} disabled={!newLogNote.trim()} className="px-3 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-black disabled:opacity-50">添加</button>
                                    </div>
                                    <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                        {selectedAsset.logs.map(log => (
                                            <div key={log.id} className="text-xs p-3 bg-white rounded-lg border border-slate-100 shadow-sm">
                                                <div className="flex justify-between items-center mb-1 text-slate-400">
                                                    <span className="font-mono">{log.date}</span>
                                                    <span className="font-bold bg-slate-100 px-1.5 rounded text-[9px] uppercase">{log.type}</span>
                                                </div>
                                                <p className="text-slate-700 leading-relaxed">{log.notes}</p>
                                            </div>
                                        ))}
                                        {selectedAsset.logs.length === 0 && <p className="text-center text-xs text-slate-300 py-4">暂无记录</p>}
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div className="p-4 bg-white border-t border-slate-100 flex gap-3">
                            <button onClick={() => deleteAssets([selectedAsset.id])} className="flex-1 py-3 text-red-600 bg-red-50 rounded-xl font-bold text-xs hover:bg-red-100 transition-colors flex items-center justify-center gap-2">
                                <Trash2 size={16}/> 删除资产
                            </button>
                            <button onClick={() => setSelectedAssetId(null)} className="flex-1 py-3 text-slate-600 bg-slate-100 rounded-xl font-bold text-xs hover:bg-slate-200 transition-colors">
                                关闭面板
                            </button>
                        </div>
                    </div>
                )}
          </div>
      </main>

       {showAiModal && (
            <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-white/20 animate-slideUp">
                    <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                         <h3 className="text-lg font-bold flex items-center gap-3"><Sparkles/> AI 智能录入</h3>
                         <button onClick={() => setShowAiModal(false)} className="text-white/60 hover:text-white"><X/></button>
                    </div>
                    <div className="flex border-b">
                         <button onClick={() => setAiModalTab('text')} className={`flex-1 py-3 text-sm font-medium ${aiModalTab === 'text' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500'}`}>文本快速录入</button>
                         <button onClick={() => setAiModalTab('ocr')} className={`flex-1 py-3 text-sm font-medium ${aiModalTab === 'ocr' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500'}`}>单据/图片扫描 (OCR)</button>
                    </div>
                    <div className="p-8">
                        {aiModalTab === 'text' ? (
                            <div>
                                <textarea value={aiText} onChange={e => setAiText(e.target.value)} placeholder="粘贴文本，例如：3台戴尔显示器U2723QE，每台4000元，IT类" className="w-full h-40 p-4 bg-slate-50 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none text-sm"/>
                                <button onClick={handleAiQuickAdd} disabled={!aiText.trim() || isAiLoading} className="w-full mt-4 py-3 bg-indigo-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                                    {isAiLoading ? <Loader2 className="animate-spin"/> : 'AI 识别并添加'}
                                </button>
                            </div>
                        ) : (
                            <div className="text-center">
                                <p className="text-sm text-slate-500 mb-4">上传资产清单、发票或设备照片进行自动识别</p>
                                <button onClick={() => ocrFileInputRef.current?.click()} disabled={isAiLoading} className="w-full py-12 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center hover:border-indigo-500 hover:bg-indigo-50 transition-colors">
                                    {isAiLoading ? <Loader2 className="animate-spin text-indigo-600" size={32}/> : <><ScanLine size={32} className="text-slate-400 mb-2"/><span className="font-bold text-slate-700">点击上传文件</span></>}
                                </button>
                                <input type="file" ref={ocrFileInputRef} onChange={handleOcrUpload} className="hidden" accept="image/*,.pdf"/>
                            </div>
                        )}
                         <p className="text-center text-xs text-slate-400 mt-4 font-mono">Powered by {getAIProviderLabel(settings || {} as AppSettings)}</p>
                    </div>
                </div>
            </div>
        )}

       {showLabelModal && (
            <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4 print:hidden" onClick={() => setShowLabelModal(null)}>
                <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-lg text-center relative" onClick={e => e.stopPropagation()}>
                    <h3 className="font-bold text-xl mb-6">资产标签预览</h3>
                    <div id="label-to-print" className="p-4 border border-dashed border-slate-300 w-[300px] mx-auto text-left font-sans space-y-2">
                        <div className="flex justify-between items-start">
                             <div>
                                <p className="text-xs text-slate-400">资产名称</p>
                                <p className="font-bold text-lg leading-tight">{showLabelModal.name}</p>
                             </div>
                             <img src={`https://api.qrserver.com/v1/create-qr-code/?size=60x60&data=${encodeURIComponent(showLabelModal.assetTag)}`} alt="QR Code"/>
                        </div>
                        <p className="text-xs text-slate-400">资产编号: <span className="font-mono text-slate-800">{showLabelModal.assetTag}</span></p>
                        <p className="text-xs text-slate-400">启用日期: <span className="font-mono text-slate-800">{showLabelModal.purchaseDate}</span></p>
                    </div>
                    <button onClick={() => window.print()} className="mt-6 w-full py-3 bg-slate-900 text-white rounded-xl font-bold">打印标签</button>
                    <style>{`
                        @media print {
                            body * { visibility: hidden; }
                            #label-to-print, #label-to-print * { visibility: visible; }
                            #label-to-print { position: absolute; left: 0; top: 0; }
                        }
                    `}</style>
                </div>
            </div>
       )}
    </div>
  );
};
