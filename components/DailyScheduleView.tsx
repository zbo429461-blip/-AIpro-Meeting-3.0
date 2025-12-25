
import React, { useState, useEffect } from 'react';
import { DailyTask, TaskPriority, TaskStatus, AppSettings } from '../types';
import { 
  Plus, Trash2, Clock, Calendar as CalendarIcon, Sparkles, 
  Loader2, ListTodo, X, ChevronLeft, ChevronRight, CheckCircle2, 
  Flag, TrendingUp, LayoutGrid, CalendarDays
} from 'lucide-react';
import { generateChatResponse, getAIProviderLabel } from '../services/aiService';

interface DailyScheduleViewProps {
  settings: AppSettings;
}

export const DailyScheduleView: React.FC<DailyScheduleViewProps> = ({ settings }) => {
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [showAiInput, setShowAiInput] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDate());

  useEffect(() => {
    const saved = localStorage.getItem('app_daily_tasks');
    if (saved) {
      try { setTasks(JSON.parse(saved)); } catch (e) { console.error(e); }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('app_daily_tasks', JSON.stringify(tasks));
  }, [tasks]);

  const addTask = (dateStr: string) => {
    const newTask: DailyTask = {
      id: Date.now().toString(),
      title: '新工作项',
      time: dateStr,
      priority: 'medium',
      status: 'todo'
    };
    setTasks([...tasks, newTask]);
  };

  const updateTask = (id: string, updates: Partial<DailyTask>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const handleAiOrganize = async () => {
      if (!aiInput.trim()) return;
      setIsAiLoading(true);
      try {
          const prompt = `Convert these tasks into JSON array [{title, time, priority, status:"todo"}]. Input: "${aiInput}". Time format YYYY-MM-DD. Priority: high, medium, low.`;
          const response = await generateChatResponse(settings, prompt, "Schedule Assistant");
          const cleanJson = response.replace(/```json\n?|```/g, '').trim();
          const parsed = JSON.parse(cleanJson);
          if (Array.isArray(parsed)) {
              setTasks([...tasks, ...parsed.map((t: any) => ({ ...t, id: Math.random().toString(36) }))]);
              setShowAiInput(false);
              setAiInput('');
          }
      } catch (e) { alert("AI 解析失败，请检查输入或配置"); } finally { setIsAiLoading(false); }
  };

  // Calendar Logic
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  // Robust calendar generation to prevent "Invalid array length"
  const calendarDays = React.useMemo(() => {
      try {
          if (isNaN(year) || isNaN(month)) throw new Error("Invalid Date");

          const daysInMonth = new Date(year, month + 1, 0).getDate();
          const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0-6
          
          // Ensure valid positive integers for array lengths
          const safePadding = Math.max(0, isNaN(firstDayOfMonth) ? 0 : firstDayOfMonth); 
          const safeDays = Math.max(1, isNaN(daysInMonth) ? 30 : daysInMonth);

          const padding = Array(safePadding).fill(null);
          const days = Array.from({ length: safeDays }, (_, i) => i + 1);
          return [...padding, ...days];
      } catch (e) {
          console.error("Calendar generation error:", e);
          // Fallback calendar
          return Array.from({ length: 30 }, (_, i) => i + 1);
      }
  }, [year, month]);

  const getTasksForDay = (day: number | null) => {
      if (!day) return [];
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return tasks.filter(t => t.time.startsWith(dateStr));
  };

  const selectedDayTasks = getTasksForDay(selectedDay);

  return (
    <div className="h-full flex bg-[#f8fafc] overflow-hidden font-sans">
      {/* Sidebar: Day Detail View */}
      <div className="w-96 bg-white border-r border-slate-200 flex flex-col shadow-xl z-10">
          <div className="p-8 bg-slate-900 text-white relative overflow-hidden">
                <TrendingUp size={120} className="absolute -bottom-8 -right-8 opacity-10"/>
                <div className="relative z-10">
                    <h2 className="text-4xl font-black mb-2">{selectedDay} <span className="text-sm font-bold opacity-40 uppercase tracking-widest">{year}年{month + 1}月</span></h2>
                    <div className="flex items-center gap-2">
                        <div className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                            <ListTodo size={10}/> {selectedDayTasks.length} 个任务
                        </div>
                        {selectedDayTasks.some(t => t.status === 'done') && (
                             <div className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-[10px] font-bold uppercase tracking-widest">
                                已完成 {selectedDayTasks.filter(t => t.status === 'done').length}
                             </div>
                        )}
                    </div>
                </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
                {selectedDayTasks.map(task => (
                    <div key={task.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group">
                        <div className="flex items-start justify-between mb-3">
                             <input 
                                value={task.title} onChange={e => updateTask(task.id, { title: e.target.value })}
                                className={`w-full bg-transparent border-none p-0 focus:ring-0 font-bold text-sm ${task.status === 'done' ? 'line-through text-slate-300' : 'text-slate-800'}`}
                             />
                             <button onClick={() => setTasks(tasks.filter(t => t.id !== task.id))} className="text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100"><X size={14}/></button>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => updateTask(task.id, { priority: task.priority === 'high' ? 'medium' : task.priority === 'medium' ? 'low' : 'high' })}
                                    className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border
                                        ${task.priority === 'high' ? 'bg-red-50 text-red-600 border-red-100' : task.priority === 'medium' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-blue-50 text-blue-600 border-blue-100'}
                                    `}
                                >
                                    {task.priority === 'high' ? '!!! 紧急' : task.priority === 'medium' ? '! 中等' : '普通'}
                                </button>
                            </div>
                            <button 
                                onClick={() => updateTask(task.id, { status: task.status === 'done' ? 'todo' : 'done' })}
                                className={`w-6 h-6 rounded-full flex items-center justify-center transition-all
                                    ${task.status === 'done' ? 'bg-green-500 text-white' : 'border-2 border-slate-200 text-transparent hover:border-indigo-500'}
                                `}
                            >
                                <CheckCircle2 size={14}/>
                            </button>
                        </div>
                    </div>
                ))}
                {selectedDayTasks.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center py-20 text-slate-300 opacity-30">
                        <ListTodo size={48} className="mb-4"/>
                        <p className="font-bold text-xs uppercase tracking-widest">今日无排期</p>
                    </div>
                )}
          </div>
          
          <div className="p-4 border-t">
               <button 
                onClick={() => addTask(`${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`)}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
               >
                   <Plus size={20}/> 新增安排
               </button>
          </div>
      </div>

      {/* Main: Calendar Grid */}
      <div className="flex-1 flex flex-col overflow-hidden">
          <header className="px-10 h-20 flex items-center justify-between bg-white border-b shrink-0">
               <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <CalendarIcon className="text-indigo-600" size={24}/>
                        <h1 className="text-xl font-black text-slate-900">数字化排期看板</h1>
                    </div>
                    <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                        <button onClick={() => setCurrentDate(new Date(year, month - 1))} className="p-2 hover:bg-white rounded-lg transition-all shadow-sm"><ChevronLeft size={16}/></button>
                        <span className="px-6 font-black text-xs text-slate-700 uppercase tracking-widest min-w-[150px] text-center">{year}年 {month + 1}月</span>
                        <button onClick={() => setCurrentDate(new Date(year, month + 1))} className="p-2 hover:bg-white rounded-lg transition-all shadow-sm"><ChevronRight size={16}/></button>
                    </div>
               </div>
               <div className="flex gap-3">
                    <button onClick={() => setShowAiInput(true)} className="px-6 py-2 bg-indigo-50 text-indigo-700 rounded-xl hover:bg-indigo-100 font-black text-[11px] uppercase tracking-widest flex items-center gap-2 border border-indigo-100 shadow-sm transition-all">
                        <Sparkles size={16} className="text-purple-500" /> AI 智能识别
                    </button>
               </div>
          </header>

          <main className="flex-1 overflow-auto p-10 bg-slate-100/50">
                <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-200 overflow-hidden flex flex-col h-full max-w-6xl mx-auto">
                    <div className="grid grid-cols-7 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest text-center">
                        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <div key={d} className="py-4 opacity-50">{d}</div>)}
                    </div>
                    <div className="flex-1 grid grid-cols-7 border-l">
                        {calendarDays.map((day, idx) => {
                            const dayTasks = getTasksForDay(day);
                            const isToday = day && new Date().getDate() === day && new Date().getMonth() === month && new Date().getFullYear() === year;
                            const isSelected = selectedDay === day;
                            
                            return (
                                <div 
                                    key={idx} onClick={() => day && setSelectedDay(day)}
                                    className={`min-h-[120px] border-r border-b p-3 transition-all cursor-pointer relative flex flex-col
                                        ${day ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/50'}
                                        ${isSelected ? 'shadow-[inset_0_0_0_2px_rgba(79,70,229,1)] bg-indigo-50/10 z-10' : ''}
                                    `}
                                >
                                    {day && (
                                        <>
                                            <span className={`text-xs font-black mb-2 ${isToday ? 'w-6 h-6 flex items-center justify-center bg-indigo-600 text-white rounded-full' : 'text-slate-300'}`}>{day}</span>
                                            <div className="space-y-1 overflow-hidden">
                                                {dayTasks.slice(0, 3).map(task => (
                                                    <div key={task.id} className={`h-1.5 rounded-full ${task.priority === 'high' ? 'bg-red-500' : task.priority === 'medium' ? 'bg-amber-500' : 'bg-blue-500'} ${task.status === 'done' ? 'opacity-20' : ''}`}></div>
                                                ))}
                                                {dayTasks.length > 3 && <div className="text-[8px] font-black text-slate-300 text-center">+{dayTasks.length - 3}</div>}
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
          </main>
      </div>

      {showAiInput && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
              <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-xl overflow-hidden border border-white/20 animate-slideUp">
                  <div className="p-8 bg-indigo-600 text-white flex justify-between items-center relative">
                      <TrendingUp size={100} className="absolute -bottom-8 -left-8 opacity-20"/>
                      <div className="flex items-center gap-3 relative z-10"><Sparkles size={28}/><h3 className="text-2xl font-black">AI 智能规划</h3></div>
                      <button onClick={() => setShowAiInput(false)} className="text-white/60 hover:text-white transition-colors relative z-10"><X size={28}/></button>
                  </div>
                  <div className="p-10">
                      <p className="text-sm font-medium text-slate-500 mb-6 leading-relaxed">请在此粘贴您的聊天记录、项目计划或随手笔记。AI 将提取关键日期和任务并自动填充到您的排期表。</p>
                      <textarea 
                          value={aiInput} onChange={e => setAiInput(e.target.value)}
                          placeholder="例如：周五下午3点和研发部开会；下周一之前要完成项目报告初稿..."
                          className="w-full h-48 p-6 bg-slate-50 border-none rounded-3xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none text-slate-800 font-medium"
                      />
                      <div className="mt-8 flex gap-4">
                          <button onClick={() => setShowAiInput(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-bold hover:bg-slate-200 transition-colors">取消</button>
                          <button 
                            onClick={handleAiOrganize} disabled={!aiInput.trim() || isAiLoading}
                            className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-xl shadow-indigo-100 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                          >
                              {isAiLoading ? <Loader2 size={22} className="animate-spin"/> : <CheckCircle2 size={22}/>}
                              确认并智能填充
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
