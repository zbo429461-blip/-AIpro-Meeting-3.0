import React from 'react';
import { View } from '../types';
import { Users, Calendar, FileText, Settings, Home, CreditCard, Sparkles, ChevronLeft, ChevronRight, ClipboardCheck, ArrowLeftCircle } from 'lucide-react';

interface SidebarProps {
  currentView: View;
  onViewChange: (view: View) => void;
  collapsed: boolean;
  toggleCollapse: () => void;
  onBackToHome: () => void; // New Prop
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange, collapsed, toggleCollapse, onBackToHome }) => {
  const menuItems = [
    { id: View.DASHBOARD, label: '系统概览 Dashboard', icon: Home },
    { id: View.ASSISTANT, label: '智能会议助手 Assistant', icon: Sparkles },
    { id: View.PARTICIPANTS, label: '参会人员管理 Participants', icon: Users },
    { id: View.AGENDA, label: '会议议程安排 Agenda', icon: Calendar },
    { id: View.SIGN_IN, label: '会议签到 Sign In', icon: ClipboardCheck },
    { id: View.TABLE_CARDS, label: '桌牌生成 Cards', icon: CreditCard },
    { id: View.FILES, label: '会议资料管理 Files', icon: FileText },
    { id: View.SETTINGS, label: '系统设置 Settings', icon: Settings },
  ];

  return (
    <div 
      className={`bg-slate-900 text-gray-300 border-r border-slate-800 min-h-screen shadow-xl flex flex-col transition-all duration-300 z-20 no-print
      ${collapsed ? 'w-20' : 'w-72'}`}
    >
      {/* Header */}
      <div className="h-16 flex items-center justify-center border-b border-slate-800 relative bg-slate-950">
        <div className={`flex items-center gap-2 transition-opacity duration-200 ${collapsed ? 'opacity-0 absolute' : 'opacity-100'}`}>
           <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/30">
             M
           </div>
           <span className="text-lg font-bold text-white tracking-wide">AI Meeting</span>
        </div>
        {collapsed && (
           <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold">
             M
           </div>
        )}
      </div>

      {/* Back to Home */}
      <button 
        onClick={onBackToHome}
        className={`mx-3 mt-4 mb-2 flex items-center gap-3 px-3 py-3 bg-slate-800/50 hover:bg-slate-800 text-indigo-300 rounded-xl transition-all border border-slate-700/50 ${collapsed ? 'justify-center' : ''}`}
        title="返回会议列表"
      >
        <ArrowLeftCircle size={20} />
        {!collapsed && <span className="font-medium text-sm">切换会议</span>}
      </button>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-3 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`w-full flex items-center gap-4 px-3 py-3.5 rounded-xl text-sm font-medium transition-all duration-200 group relative
                ${isActive 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' 
                  : 'hover:bg-slate-800 hover:text-white'
                }
                ${collapsed ? 'justify-center' : ''}
              `}
              title={collapsed ? item.label : ''}
            >
              <Icon size={20} className={`${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'} transition-colors flex-shrink-0`} />
              
              {!collapsed && (
                <div className="flex flex-col items-start overflow-hidden whitespace-nowrap">
                    <span className="leading-none mb-1 text-[13px]">{item.label.split(' ')[0]}</span>
                    <span className="text-[10px] opacity-50 uppercase tracking-wider font-sans">
                        {item.label.split(' ').slice(1).join(' ')}
                    </span>
                </div>
              )}
            </button>
          );
        })}
      </nav>
      
      {/* Toggle Button */}
      <div className="p-4 border-t border-slate-800 flex justify-end">
        <button 
            onClick={toggleCollapse}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
        >
            {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>
    </div>
  );
};