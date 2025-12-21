
import React, { useState, useEffect, useMemo } from 'react';
import { Project, ProjectTask } from '../types';
import { 
  Plus, Trash2, Search, KanbanSquare, ArrowLeftCircle, 
  CheckCircle2, Clock, Users, Tag, 
  ChevronRight, Calendar, LayoutGrid, ListTodo, X, ArrowRight, Layers, Target, AlertCircle, BarChart
} from 'lucide-react';

interface ProjectManagerViewProps {
  onBack: () => void;
}

export const ProjectManagerView: React.FC<ProjectManagerViewProps> = ({ onBack }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [newProjectData, setNewProjectData] = useState({ name: '', description: '', manager: '' });

  useEffect(() => {
    const saved = localStorage.getItem('app_projects');
    if (saved) {
      try { setProjects(JSON.parse(saved)); } catch (e) { console.error(e); }
    } else {
        // Initial empty or simplified demo
        setProjects([]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('app_projects', JSON.stringify(projects));
  }, [projects]);

  const handleCreateProject = () => {
    if (!newProjectData.name) return;
    const newProject: Project = {
      id: Date.now().toString(),
      name: newProjectData.name,
      description: newProjectData.description,
      manager: newProjectData.manager || '本人',
      progress: 0,
      status: 'active',
      tasks: []
    };
    setProjects([newProject, ...projects]);
    setSelectedProjectId(newProject.id);
    setShowCreateProject(false);
    setNewProjectData({ name: '', description: '', manager: '' });
  };

  const deleteProject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('确定要彻底删除该项目吗？所有任务数据都将丢失。')) {
      setProjects(projects.filter(p => p.id !== id));
      if (selectedProjectId === id) setSelectedProjectId(null);
    }
  };

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  const addTask = (projectId: string) => {
      const today = new Date().toISOString().split('T')[0];
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const newTask: ProjectTask = {
          id: Date.now().toString(),
          title: '新任务',
          assignee: '未分配',
          startDate: today,
          endDate: nextWeek,
          status: 'todo'
      };
      setProjects(prev => prev.map(p => {
          if (p.id === projectId) {
              const updatedTasks = [...p.tasks, newTask];
              return { ...p, tasks: updatedTasks };
          }
          return p;
      }));
  };

  const updateTask = (projectId: string, taskId: string, updates: Partial<ProjectTask>) => {
      setProjects(prev => prev.map(p => {
          if (p.id === projectId) {
              const updatedTasks = p.tasks.map(t => t.id === taskId ? { ...t, ...updates } : t);
              const doneCount = updatedTasks.filter(t => t.status === 'done').length;
              return { 
                  ...p, 
                  tasks: updatedTasks,
                  progress: updatedTasks.length > 0 ? Math.round((doneCount / updatedTasks.length) * 100) : 0
              };
          }
          return p;
      }));
  };

  const deleteTask = (projectId: string, taskId: string) => {
      setProjects(prev => prev.map(p => {
          if (p.id === projectId) {
              const updatedTasks = p.tasks.filter(t => t.id !== taskId);
              const doneCount = updatedTasks.length > 0 ? updatedTasks.filter(t => t.status === 'done').length : 0;
              return { ...p, tasks: updatedTasks, progress: updatedTasks.length > 0 ? Math.round((doneCount / updatedTasks.length) * 100) : 0 };
          }
          return p;
      }));
  };

  // --- GANTT CALCULATION ---
  const ganttConfig = useMemo(() => {
    if (!selectedProject || selectedProject.tasks.length === 0) return null;
    const dates = selectedProject.tasks.flatMap(t => [new Date(t.startDate), new Date(t.endDate)]);
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
    
    // Buffer days
    minDate.setDate(minDate.getDate() - 2);
    maxDate.setDate(maxDate.getDate() + 5);
    
    const dayDiff = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
    
    return { minDate, maxDate, totalDays: dayDiff };
  }, [selectedProject]);

  const getPosition = (start: string, end: string) => {
    if (!ganttConfig) return { left: 0, width: 0 };
    const s = new Date(start);
    const e = new Date(end);
    const left = ((s.getTime() - ganttConfig.minDate.getTime()) / (1000 * 60 * 60 * 24)) / ganttConfig.totalDays * 100;
    const width = ((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) / ganttConfig.totalDays * 100;
    return { left, width };
  };

  const isOverdue = (task: ProjectTask) => {
      if (task.status === 'done') return false;
      return new Date(task.endDate) < new Date();
  };

  return (
    <div className="h-full flex flex-col bg-[#f3f4f6] font-sans overflow-hidden">
        <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-8 shrink-0 shadow-sm z-10">
            <div className="flex items-center gap-4">
                <button onClick={onBack} className="text-gray-400 hover:text-indigo-600 transition-colors">
                    <ArrowLeftCircle size={28} />
                </button>
                <div className="flex items-center gap-2">
                    <BarChart className="text-blue-600" size={24}/>
                    <h1 className="text-xl font-bold text-slate-900">甘特图项目管理</h1>
                </div>
            </div>
            <div className="flex gap-4">
                <button onClick={() => setShowCreateProject(true)} className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-sm font-bold shadow-md">
                    <Plus size={18} /> 新建项目
                </button>
            </div>
        </header>

        <main className="flex-1 flex overflow-hidden">
            {/* Project List Sidebar */}
            <div className="w-80 border-r border-gray-200 bg-white overflow-y-auto p-6 space-y-4 shadow-inner">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">我的项目 ({projects.length})</h3>
                <div className="space-y-3">
                    {projects.map(p => (
                        <div 
                            key={p.id} onClick={() => setSelectedProjectId(p.id)}
                            className={`p-5 rounded-2xl cursor-pointer border-2 transition-all relative group
                                ${selectedProjectId === p.id ? 'border-blue-600 bg-blue-50/50' : 'border-gray-50 bg-white hover:border-blue-100'}
                            `}
                        >
                            <button onClick={(e) => deleteProject(p.id, e)} className="absolute top-4 right-4 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14}/></button>
                            <h4 className={`font-bold text-sm truncate mb-2 ${selectedProjectId === p.id ? 'text-blue-900' : 'text-slate-800'}`}>{p.name}</h4>
                            <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden">
                                <div className="bg-blue-600 h-full transition-all duration-700" style={{ width: `${p.progress}%` }}></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Gantt Area */}
            <div className="flex-1 flex flex-col bg-white overflow-hidden">
                {selectedProject ? (
                    <div className="flex flex-col h-full overflow-hidden">
                        <div className="p-8 border-b bg-gray-50/50">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h2 className="text-3xl font-black text-slate-900">{selectedProject.name}</h2>
                                    <p className="text-slate-500 text-sm">{selectedProject.description}</p>
                                </div>
                                <button onClick={() => addTask(selectedProject.id)} className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center gap-2">
                                    <Plus size={14}/> 添加任务
                                </button>
                            </div>
                            <div className="flex items-center gap-6">
                                <div className="flex-1">
                                    <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase mb-1">
                                        <span>总体进度</span>
                                        <span>{selectedProject.progress}%</span>
                                    </div>
                                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-600 transition-all" style={{ width: `${selectedProject.progress}%` }}></div>
                                    </div>
                                </div>
                                {selectedProject.tasks.some(isOverdue) && (
                                    <div className="flex items-center gap-2 bg-red-50 text-red-600 px-4 py-2 rounded-lg border border-red-100 animate-pulse">
                                        <AlertCircle size={16}/>
                                        <span className="text-xs font-bold uppercase tracking-wider">逾期预警</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Gantt Table */}
                        <div className="flex-1 overflow-auto bg-white">
                            <div className="min-w-[1000px]">
                                <div className="flex border-b bg-slate-50 sticky top-0 z-20">
                                    <div className="w-64 p-4 font-black text-[10px] text-slate-400 uppercase tracking-widest border-r">任务明细</div>
                                    <div className="flex-1 relative h-12 flex items-center">
                                        {ganttConfig && (
                                            <div className="absolute inset-0 flex justify-between px-4">
                                                <span className="text-[10px] font-bold text-slate-400">{ganttConfig.minDate.toLocaleDateString()}</span>
                                                <span className="text-[10px] font-bold text-slate-400">{ganttConfig.maxDate.toLocaleDateString()}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {selectedProject.tasks.map(task => {
                                    const { left, width } = getPosition(task.startDate, task.endDate);
                                    const overdue = isOverdue(task);
                                    return (
                                        <div key={task.id} className="flex border-b hover:bg-slate-50 group">
                                            <div className="w-64 p-4 border-r flex flex-col gap-2">
                                                <input 
                                                    value={task.title} onChange={e => updateTask(selectedProject.id, task.id, { title: e.target.value })}
                                                    className={`bg-transparent border-none p-0 focus:ring-0 text-sm font-bold ${overdue ? 'text-red-600' : 'text-slate-800'}`}
                                                />
                                                <div className="flex items-center gap-2">
                                                    <select 
                                                        value={task.status} onChange={e => updateTask(selectedProject.id, task.id, { status: e.target.value as any })}
                                                        className="text-[10px] bg-white border rounded px-1 py-0.5 focus:ring-0"
                                                    >
                                                        <option value="todo">待办</option>
                                                        <option value="in_progress">进行中</option>
                                                        <option value="done">已完成</option>
                                                    </select>
                                                    <button onClick={() => deleteTask(selectedProject.id, task.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 size={12}/></button>
                                                </div>
                                            </div>
                                            <div className="flex-1 relative p-4 h-20">
                                                {/* Background Grid approximation */}
                                                <div className="absolute inset-0 flex justify-around pointer-events-none opacity-[0.05]">
                                                    {[1,2,3,4,5,6,7].map(n => <div key={n} className="w-px h-full bg-slate-900"></div>)}
                                                </div>
                                                
                                                {/* The Bar */}
                                                <div 
                                                    className={`absolute h-8 rounded-full flex items-center px-4 text-[10px] font-black uppercase tracking-tighter transition-all shadow-sm
                                                        ${task.status === 'done' ? 'bg-emerald-500 text-white' : overdue ? 'bg-red-500 text-white shadow-lg shadow-red-200' : 'bg-blue-600 text-white'}
                                                    `}
                                                    style={{ left: `${left}%`, width: `${width}%`, top: '1.5rem' }}
                                                >
                                                    <span className="truncate">{task.startDate} → {task.endDate}</span>
                                                </div>

                                                {/* Date Inputs */}
                                                <div className="absolute inset-x-0 bottom-1 flex justify-between px-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                                     <input type="date" value={task.startDate} onChange={e => updateTask(selectedProject.id, task.id, { startDate: e.target.value })} className="text-[9px] border-none p-0 bg-transparent text-slate-400 w-24"/>
                                                     <input type="date" value={task.endDate} onChange={e => updateTask(selectedProject.id, task.id, { endDate: e.target.value })} className="text-[9px] border-none p-0 bg-transparent text-slate-400 w-24 text-right"/>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {selectedProject.tasks.length === 0 && (
                                    <div className="py-32 text-center text-slate-300 flex flex-col items-center">
                                        <Layers size={48} className="opacity-10 mb-4"/>
                                        <p className="font-bold uppercase tracking-widest text-sm">暂无任务进度</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-20 text-slate-300">
                        <Calendar size={64} className="opacity-10 mb-6"/>
                        <h3 className="text-xl font-black uppercase tracking-widest">请从侧边栏选择一个项目</h3>
                    </div>
                )}
            </div>
        </main>

        {showCreateProject && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
                <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl w-full max-w-md">
                    <h3 className="text-2xl font-bold mb-6">新建项目</h3>
                    <div className="space-y-4">
                        <input type="text" placeholder="项目名称" value={newProjectData.name} onChange={e => setNewProjectData({...newProjectData, name: e.target.value})} className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none" />
                        <textarea placeholder="项目描述" value={newProjectData.description} onChange={e => setNewProjectData({...newProjectData, description: e.target.value})} className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none h-32" />
                        <div className="flex gap-4">
                            <button onClick={() => setShowCreateProject(false)} className="flex-1 py-4 bg-gray-100 rounded-2xl font-bold">取消</button>
                            <button onClick={handleCreateProject} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold">创建项目</button>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
