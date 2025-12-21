
import React, { useState, useEffect, useMemo } from 'react';
import { AssetItem, AssetStatus, AssetCategory, AppSettings, AssetLog } from '../types';
import { 
  Plus, Trash2, Download, Search, Package, ArrowLeftCircle, Edit3, Save, X, 
  Filter, AlertCircle, Sparkles, Loader2, Info, History, QrCode, ClipboardCheck, 
  ShieldCheck, Wrench, FileX, MousePointerClick, Calendar, CheckCircle2,
  Clock, TrendingUp, AlertTriangle, ShieldAlert, BadgeCheck, MoreVertical,
  Layers, Settings2, Trash, RotateCw, ChevronRight, UserCircle2, ExternalLink,
  ArrowUpDown, ArrowUp, ArrowDown, Copy, ListFilter
} from 'lucide-react';
import { utils, writeFile } from 'https://esm.sh/xlsx@0.18.5';
import { parseAssetRequest, getAIProviderLabel } from '../services/aiService';

interface AssetManagerViewProps {
  onBack: () => void;
  settings?: AppSettings;
}

type SortKey = 'assetTag' | 'name' | 'price' | 'purchaseDate' | 'status';

export const AssetManagerView: React.FC<AssetManagerViewProps> = ({ onBack, settings }) => {
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<AssetStatus | 'All'>('All');
  const [filterCategory, setFilterCategory] = useState<AssetCategory | 'All'>('All');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Sort State
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null);

  // Detail & Modal States
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiText, setAiText] = useState('');
  const [showAiInput, setShowAiInput] = useState(false);
  const [showLabelModal, setShowLabelModal] = useState<AssetItem | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('app_assets');
    if (saved) {
      try { 
        const parsed = JSON.parse(saved);
        // Data migration: ensure logs exist
        const validated = parsed.map((item: any) => ({ ...item, logs: item.logs || [] }));
        setAssets(validated); 
      } catch (e) { console.error(e); }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('app_assets', JSON.stringify(assets));
  }, [assets]);

  const calculateAge = (dateStr: string) => {
    const start = new Date(dateStr);
    const end = new Date();
    if (isNaN(start.getTime())) return { label: '日期缺失', color: 'text-slate-300', totalDays: 0 };
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const years = Math.floor(diffDays / 365);
    const months = Math.floor((diffDays % 365) / 30);
    let label = years > 0 ? `${years}年${months > 0 ? months + '个月' : ''}` : months > 0 ? `${months}个月` : `${diffDays}天`;
    let color = years >= 3 ? 'text-rose-500' : years >= 1 ? 'text-amber-500' : 'text-emerald-500';
    return { label, color, totalDays: diffDays };
  };

  const stats = useMemo(() => ({
      total: assets.length,
      totalValue: assets.reduce((acc, a) => acc + (parseFloat(a.price) || 0), 0),
      maintenance: assets.filter(a => a.status === 'maintenance').length,
      avgAge: assets.length > 0 ? Math.round(assets.reduce((acc, a) => acc + calculateAge(a.purchaseDate).totalDays, 0) / assets.length / 365 * 10) / 10 : 0
  }), [assets]);

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
      logs: [{ id: Date.now().toString(), type: 'Update', date: new Date().toLocaleDateString(), operator: 'System', notes: '资产初始化入库' }]
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
          logs: [{ id: Date.now().toString(), type: 'Update', date: new Date().toLocaleDateString(), operator: 'System', notes: '从模板资产克隆生成' }]
      };
      setAssets([clone, ...assets]);
      alert("资产已克隆成功");
  };

  const deleteSingleAsset = (id: string, e?: React.MouseEvent) => {
      if (e) {
          e.preventDefault();
          e.stopPropagation();
      }
      if (window.confirm('警告：确定要永久删除该项资产记录吗？对应的运维流水也将被销毁。')) {
          setAssets(prev => prev.filter(a => a.id !== id));
          if (selectedAssetId === id) setSelectedAssetId(null);
          setSelectedIds(prev => prev.filter(i => i !== id));
      }
  };

  const handleSort = (key: SortKey) => {
      let direction: 'asc' | 'desc' = 'asc';
      if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
          direction = 'desc';
      }
      setSortConfig({ key, direction });
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
              logs: [{ id: (Date.now() + idx).toString(), type: 'Update', date: new Date().toLocaleDateString(), operator: 'AI助手', notes: '自然语言智能识别入库' }]
          }));
          setAssets([...newItems, ...assets]);
          setShowAiInput(false);
          setAiText('');
      } catch (e) { alert("AI 解析失败，请尝试更清晰的描述。"); } finally { setIsAiLoading(false); }
  };

  const handleAddLog = (assetId: string, type: AssetLog['type'], notes: string) => {
      const newLog: AssetLog = {
          id: Date.now().toString(),
          type,
          date: new Date().toLocaleDateString(),
          operator: '管理员',
          notes
      };
      setAssets(prev => prev.map(a => a.id === assetId ? { 
          ...a, 
          logs: [newLog, ...(a.logs || [])],
          status: type === 'Maintenance' ? 'maintenance' : (type === 'Return' ? 'idle' : a.status)
      } : a));
  };

  const handleExportExcel = () => {
    const data = assets.map((a) => ({
      "资产编号": a.assetTag,
      "名称": a.name,
      "类别": a.category,
      "品牌型号": a.brandModel,
      "资产原值": a.price,
      "存放位置": a.location,
      "当前状态": a.status,
      "采购日期": a.purchaseDate
    }));
    const ws = utils.json_to_sheet(data);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "AssetMasterData");
    writeFile(wb, `资产台账报表_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const processedAssets = useMemo(() => {
    let result = assets.filter(a => {
        const matchesSearch = (a.name + a.location + a.assetTag + a.brandModel).toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = filterStatus === 'All' || a.status === filterStatus;
        const matchesCat = filterCategory === 'All' || a.category === filterCategory;
        return matchesSearch && matchesStatus && matchesCat;
    });

    if (sortConfig) {
        result.sort((a, b) => {
            const aVal = a[sortConfig.key] || '';
            const bVal = b[sortConfig.key] || '';
            
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
  }, [assets, searchTerm, filterStatus, filterCategory, sortConfig]);

  const selectedAsset = assets.find(a => a.id === selectedAssetId);

  const toggleSelect = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const getSortIcon = (key: SortKey) => {
      if (sortConfig?.key !== key) return <ArrowUpDown size={12} className="opacity-20 group-hover:opacity-50 transition-opacity" />;
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
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Digital Asset Lifecycle Management</p>
                </div>
           </div>
           
           <div className="flex gap-3">
                <div className="relative">
                    <input 
                        type="text" placeholder="多关键字快速检索..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2.5 bg-slate-100 border-none rounded-xl text-xs w-64 focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner"
                    />
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300"/>
                </div>
                <button onClick={() => setShowAiInput(true)} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 text-indigo-700 rounded-xl hover:bg-indigo-100 text-[11px] font-black uppercase border border-indigo-100 transition-all">
                    <Sparkles size={16}/> AI 扫码入库
                </button>
                <button onClick={handleExportExcel} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 text-[11px] font-black shadow-sm transition-all">
                    <Download size={16} /> 导出报表
                </button>
                <button onClick={handleAddRow} className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-black text-[11px] font-black shadow-lg transition-all active:scale-95">
                    <Plus size={18} /> 新增资产
                </button>
           </div>
      </header>

      <div className="grid grid-cols-4 gap-6 px-8 py-6 shrink-0 bg-slate-50/50">
          {[
              { label: '在册总数', value: stats.total, unit: '项', icon: Package, color: 'indigo' },
              { label: '资产原值', value: stats.totalValue.toLocaleString(), unit: 'CNY', icon: TrendingUp, color: 'emerald' },
              { label: '平均役龄', value: stats.avgAge, unit: 'Years', icon: Clock, color: 'blue' },
              { label: '异常/待修', value: stats.maintenance, unit: '项', icon: Wrench, color: 'amber' }
          ].map((s, idx) => (
              <div key={idx} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4 group hover:shadow-md transition-all">
                  <div className={`w-12 h-12 bg-${s.color}-50 text-${s.color}-600 rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform`}><s.icon size={24}/></div>
                  <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{s.label}</p>
                      <h4 className={`text-2xl font-black text-slate-800 tabular-nums`}>{s.value} <span className="text-[10px] font-bold text-slate-300">{s.unit}</span></h4>
                  </div>
              </div>
          ))}
      </div>

      <main className="flex-1 overflow-hidden px-8 pb-8 flex gap-6 relative">
          <div className="flex-1 bg-white rounded-[2rem] shadow-xl border border-slate-200 overflow-hidden flex flex-col min-w-0">
                <div className="px-8 py-4 bg-white border-b flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-lg border border-slate-100">
                            <ListFilter size={14} className="text-slate-400 ml-2" />
                            <select 
                                value={filterCategory} onChange={(e) => setFilterCategory(e.target.value as any)}
                                className="text-[11px] font-black uppercase tracking-wider bg-transparent rounded-lg text-slate-600 px-3 py-1.5 outline-none cursor-pointer hover:text-indigo-600 transition-colors"
                            >
                                <option value="All">资产分类: 全部</option>
                                <option value="IT">IT硬件</option>
                                <option value="Electronic">办公电器</option>
                                <option value="Furniture">办公家具</option>
                                <option value="Consumables">行政耗材</option>
                                <option value="Other">其他</option>
                            </select>
                        </div>
                        <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-lg border border-slate-100">
                            <select 
                                value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)}
                                className="text-[11px] font-black uppercase tracking-wider bg-transparent rounded-lg text-slate-600 px-3 py-1.5 outline-none cursor-pointer hover:text-indigo-600 transition-colors"
                            >
                                <option value="All">所有状态</option>
                                <option value="idle">闲置</option>
                                <option value="in_use">在用</option>
                                <option value="maintenance">待修</option>
                                <option value="scrapped">报废</option>
                            </select>
                        </div>
                    </div>

                    {selectedIds.length > 0 && (
                        <div className="flex items-center gap-2 animate-slideLeft">
                             <span className="text-[10px] font-black text-indigo-600 mr-2">已选中 {selectedIds.length} 项:</span>
                             <button onClick={() => { if(confirm('确定永久删除选中记录？')) { setAssets(assets.filter(a => !selectedIds.includes(a.id))); setSelectedIds([]); } }} className="px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-[10px] font-black hover:bg-rose-600 hover:text-white transition-all flex items-center gap-1">
                                 <Trash size={12}/> 批量删除
                             </button>
                             <button onClick={() => setSelectedIds([])} className="p-1.5 text-slate-400 hover:text-slate-600"><X size={14}/></button>
                        </div>
                    )}
                </div>
                
                <div className="overflow-auto flex-1 custom-scrollbar">
                    <table className="w-full text-left border-collapse table-fixed">
                        <thead className="bg-slate-100 border-b-2 border-slate-200 sticky top-0 z-20">
                            <tr className="text-xs font-black text-slate-900 uppercase tracking-wider">
                                <th className="px-6 py-5 w-16 text-center">
                                    <input type="checkbox" checked={selectedIds.length === processedAssets.length && processedAssets.length > 0} onChange={() => setSelectedIds(selectedIds.length === processedAssets.length ? [] : processedAssets.map(a => a.id))} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                                </th>
                                <th className="px-4 py-5 w-40 cursor-pointer group" onClick={() => handleSort('assetTag')}>
                                    <div className="flex items-center gap-2">资产编号 {getSortIcon('assetTag')}</div>
                                </th>
                                <th className="px-4 py-5 cursor-pointer group" onClick={() => handleSort('name')}>
                                    <div className="flex items-center gap-2">资产名称 / 类别 {getSortIcon('name')}</div>
                                </th>
                                <th className="px-4 py-5 w-32 cursor-pointer group" onClick={() => handleSort('status')}>
                                    <div className="flex items-center gap-2 text-center justify-center">状态 {getSortIcon('status')}</div>
                                </th>
                                <th className="px-4 py-5 w-28 cursor-pointer group" onClick={() => handleSort('purchaseDate')}>
                                    <div className="flex items-center gap-2 text-center justify-center">役龄 {getSortIcon('purchaseDate')}</div>
                                </th>
                                <th className="px-4 py-5 w-28 cursor-pointer group text-right pr-8" onClick={() => handleSort('price')}>
                                    <div className="flex items-center gap-2 justify-end">原值 {getSortIcon('price')}</div>
                                </th>
                                <th className="px-6 py-5 w-32 text-center">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {processedAssets.map((asset) => {
                                const age = calculateAge(asset.purchaseDate);
                                return (
                                    <tr 
                                        key={asset.id} 
                                        onClick={() => setSelectedAssetId(asset.id)}
                                        className={`group hover:bg-white hover:shadow-lg transition-all cursor-pointer relative ${selectedAssetId === asset.id ? 'bg-indigo-50/50 ring-1 ring-inset ring-indigo-100' : ''}`}
                                    >
                                        <td className="px-6 py-4 text-center">
                                            <input 
                                                type="checkbox" 
                                                checked={selectedIds.includes(asset.id)} 
                                                onClick={e => toggleSelect(asset.id, e)}
                                                className="w-4 h-4 rounded border-slate-300 text-indigo-600"
                                            />
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className="text-[11px] font-mono font-black text-slate-500 bg-slate-100 px-2 py-1 rounded tracking-tighter">{asset.assetTag}</span>
                                        </td>
                                        <td className="px-4 py-4 overflow-hidden">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-black text-slate-800 truncate group-hover:text-indigo-700 transition-colors">{asset.name}</span>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-[9px] font-bold text-slate-300 uppercase">{asset.category}</span>
                                                    <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                                                    <span className="text-[9px] font-bold text-slate-300 truncate max-w-[120px]">{asset.brandModel || '标准规格'}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border ${asset.status === 'in_use' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : asset.status === 'maintenance' ? 'bg-amber-50 text-amber-600 border-amber-100' : asset.status === 'idle' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                                                <div className={`w-1 h-1 rounded-full ${asset.status === 'in_use' ? 'bg-emerald-500' : asset.status === 'maintenance' ? 'bg-amber-500' : asset.status === 'idle' ? 'bg-indigo-500' : 'bg-slate-400'}`}></div>
                                                <span className="text-[9px] font-black uppercase">{asset.status}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <span className={`text-[10px] font-black ${age.color}`}>{age.label}</span>
                                        </td>
                                        <td className="px-4 py-4 text-right pr-8">
                                            <span className="text-xs font-mono font-black text-slate-700">¥{(parseFloat(asset.price) || 0).toLocaleString()}</span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={(e) => handleCloneAsset(asset.id, e)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="克隆资产"><Copy size={14}/></button>
                                                <button onClick={(e) => { e.stopPropagation(); setShowLabelModal(asset); }} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="数字标签"><QrCode size={14}/></button>
                                                <button onClick={(e) => deleteSingleAsset(asset.id, e)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all" title="注销销毁"><Trash2 size={14}/></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {processedAssets.length === 0 && (
                    <div className="py-32 text-center opacity-30 flex flex-col items-center">
                        <Package size={64} className="mb-4 text-slate-300"/>
                        <p className="font-black text-xs uppercase tracking-widest">未检索到匹配的资产档案</p>
                    </div>
                )}
          </div>

          {selectedAsset && (
              <div className="w-[450px] bg-white rounded-[2rem] shadow-2xl border border-slate-200 flex flex-col animate-slideLeft overflow-hidden">
                    <div className="p-8 bg-slate-900 text-white shrink-0 relative">
                        <div className="flex justify-between items-start relative z-10">
                            <button onClick={() => setSelectedAssetId(null)} className="p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-colors"><X size={20}/></button>
                            <div className="flex gap-2">
                                <button onClick={() => handleCloneAsset(selectedAsset.id, { stopPropagation: () => {} } as any)} className="p-2 bg-white/10 rounded-xl hover:bg-indigo-600 transition-colors"><Copy size={20}/></button>
                                <button onClick={() => setShowLabelModal(selectedAsset)} className="p-2 bg-white/10 rounded-xl hover:bg-indigo-600 transition-colors"><QrCode size={20}/></button>
                                <button onClick={() => handleAddLog(selectedAsset.id, 'Maintenance', '一键触发故障报修流程')} className="p-2 bg-amber-500/20 text-amber-400 rounded-xl hover:bg-amber-500 hover:text-white transition-colors"><Wrench size={20}/></button>
                            </div>
                        </div>
                        <div className="mt-8">
                            <span className="text-[9px] font-black uppercase text-white/40 tracking-[0.3em]">Asset Master Detail</span>
                            <h3 className="text-2xl font-black truncate mt-1">{selectedAsset.name}</h3>
                            <div className="mt-4 flex items-center gap-3">
                                <span className="text-[10px] font-mono bg-white/10 px-2 py-1 rounded text-indigo-300 border border-indigo-500/30">{selectedAsset.assetTag}</span>
                                <select 
                                    value={selectedAsset.status} 
                                    onChange={e => updateAsset(selectedAsset.id, 'status', e.target.value)}
                                    className="bg-white/10 border-none rounded text-[10px] font-black uppercase text-white focus:ring-0 px-2 py-1 cursor-pointer hover:bg-white/20 transition-colors"
                                >
                                    <option value="idle" className="bg-slate-800">Idle / 闲置</option>
                                    <option value="in_use" className="bg-slate-800">Active / 在用</option>
                                    <option value="maintenance" className="bg-slate-800">Service / 待修</option>
                                    <option value="scrapped" className="bg-slate-800">EOL / 报废</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar bg-slate-50/50">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-slate-400 uppercase ml-1">品牌型号</label>
                                <input value={selectedAsset.brandModel} onChange={e => updateAsset(selectedAsset.id, 'brandModel', e.target.value)} className="w-full text-xs font-bold p-3 bg-white border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-100 outline-none shadow-sm transition-all" placeholder="如：戴尔 U2723QE"/>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-slate-400 uppercase ml-1">物理位置</label>
                                <input value={selectedAsset.location} onChange={e => updateAsset(selectedAsset.id, 'location', e.target.value)} className="w-full text-xs font-bold p-3 bg-white border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-100 outline-none shadow-sm transition-all" placeholder="如：501 会议室"/>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-slate-400 uppercase ml-1">采购日期</label>
                                <input type="date" value={selectedAsset.purchaseDate} onChange={e => updateAsset(selectedAsset.id, 'purchaseDate', e.target.value)} className="w-full text-xs font-bold p-3 bg-white border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-100 outline-none shadow-sm transition-all"/>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-slate-400 uppercase ml-1">资产原值 (CNY)</label>
                                <input type="number" value={selectedAsset.price} onChange={e => updateAsset(selectedAsset.id, 'price', e.target.value)} className="w-full text-xs font-bold p-3 bg-white border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-100 outline-none shadow-sm transition-all" placeholder="0.00"/>
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <h5 className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2"><History size={14}/> 运维/全生命周期流水</h5>
                                <button onClick={() => {
                                    const note = prompt("请输入变动/维保说明：");
                                    if(note) handleAddLog(selectedAsset.id, 'Update', note);
                                }} className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg hover:bg-indigo-100 transition-colors">+ 手动增补</button>
                            </div>
                            <div className="space-y-4">
                                {selectedAsset.logs?.map((log) => (
                                    <div key={log.id} className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm relative group hover:border-indigo-200 transition-colors">
                                        <div className="flex justify-between mb-2">
                                            <span className="text-[10px] font-black text-slate-300">{log.date}</span>
                                            <span className={`text-[8px] font-black px-2 py-0.5 rounded shadow-inner ${log.type === 'Maintenance' ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-500'}`}>{log.type}</span>
                                        </div>
                                        <p className="text-xs font-bold text-slate-600 leading-relaxed">{log.notes}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    
                    <div className="p-6 bg-white border-t flex gap-3 shrink-0">
                         <button onClick={() => deleteSingleAsset(selectedAsset.id)} className="p-4 bg-rose-50 text-rose-500 rounded-2xl hover:bg-rose-500 hover:text-white transition-all shadow-sm" title="永久删除"><Trash2 size={20}/></button>
                         <button onClick={() => setSelectedAssetId(null)} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-black shadow-lg transition-all flex items-center justify-center gap-2 active:scale-[0.98]">
                             <CheckCircle2 size={18}/> 完成变更并保存
                         </button>
                    </div>
              </div>
          )}
      </main>

      {/* QR Label Modal */}
      {showLabelModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4" onClick={() => setShowLabelModal(null)}>
              <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl max-w-sm w-full text-center relative animate-slideUp" onClick={e => e.stopPropagation()}>
                    <h3 className="text-xl font-black mb-6 text-slate-900">资产数字通行证预览</h3>
                    <div className="bg-slate-50 p-8 rounded-[3rem] border-2 border-dashed border-slate-200 inline-block mb-6 shadow-inner w-full">
                        <div className="bg-white p-6 rounded-[2rem] shadow-sm mb-6 flex justify-center">
                            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent('AssetID:'+showLabelModal.id)}`} alt="QR" className="w-40 h-40" />
                        </div>
                        <div className="text-center space-y-2">
                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Asset Integrity Tag</p>
                            <p className="text-lg font-black text-slate-800 truncate">{showLabelModal.name}</p>
                            <div className="h-px bg-slate-200 w-1/2 mx-auto my-3"></div>
                            <p className="text-[12px] font-mono text-indigo-600 font-black tracking-widest uppercase">{showLabelModal.assetTag}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => setShowLabelModal(null)} className="py-3 bg-slate-100 text-slate-500 rounded-2xl font-bold text-xs hover:bg-slate-200 transition-colors">关闭</button>
                        <button onClick={() => window.print()} className="py-3 bg-indigo-600 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-md"><Download size={14}/> 下载标签图片</button>
                    </div>
              </div>
          </div>
      )}

      {/* AI Input Modal */}
      {showAiInput && (
          <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-[200] flex items-center justify-center p-8 animate-fadeIn">
              <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-3xl overflow-hidden animate-slideUp">
                  <div className="p-10 bg-indigo-600 text-white relative">
                       <div className="flex justify-between items-center mb-4">
                           <div className="flex items-center gap-3"><Sparkles size={24}/><h3 className="text-3xl font-black">AI 智能入库引擎</h3></div>
                           <button onClick={() => setShowAiInput(false)} className="text-white/60 hover:text-white transition-colors"><X size={32}/></button>
                       </div>
                       <p className="text-indigo-100 font-medium text-lg leading-relaxed">粘贴任何采购清单或资产描述，AI 将自动结构化属性并批量创建档案。</p>
                  </div>
                  <div className="p-10">
                      <textarea 
                          value={aiText} onChange={e => setAiText(e.target.value)}
                          placeholder="示例：采购了5台ThinkPad E14，单价5800元，存放在研发中心2楼；另外还有3张人体工学椅..."
                          className="w-full h-[250px] p-6 bg-slate-50 border-none rounded-[2rem] focus:ring-4 focus:ring-indigo-100 outline-none text-slate-800 font-bold text-lg placeholder:text-slate-200 transition-all resize-none shadow-inner"
                      />
                      <div className="mt-8 flex gap-4">
                          <button onClick={() => setShowAiInput(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black hover:bg-slate-200 transition-colors">取消</button>
                          <button 
                             onClick={handleAiQuickAdd}
                             disabled={!aiText.trim() || isAiLoading}
                             className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-200 flex items-center justify-center gap-2 hover:bg-indigo-700 disabled:opacity-50 transition-all"
                          >
                              {isAiLoading ? <Loader2 size={24} className="animate-spin"/> : <MousePointerClick size={24}/>}
                              立即识别并结构化入库 (AI Parsing)
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
