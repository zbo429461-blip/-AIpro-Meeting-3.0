
import React, { useState } from 'react';
import { Participant } from '../types';
import { CheckCircle2, Circle, Search, Clock, Download, QrCode, X } from 'lucide-react';
import { utils, writeFile } from 'https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs';

interface SignInViewProps {
  participants: Participant[];
  setParticipants: React.Dispatch<React.SetStateAction<Participant[]>>;
  meetingTopic?: string;
}

export const SignInView: React.FC<SignInViewProps> = ({ participants, setParticipants, meetingTopic }) => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [showQr, setShowQr] = useState(false);

  const handleSignIn = (id: string) => {
      setParticipants(prev => prev.map(p => {
          if (p.id === id) {
              return { ...p, isSignedIn: !p.isSignedIn, signInTime: !p.isSignedIn ? Date.now() : undefined };
          }
          return p;
      }));
  };

  const handleExportSignInSheet = () => {
      const data = participants.map(p => ({
          "姓名": p.nameCN,
          "单位": p.unitCN,
          "签到状态": p.isSignedIn ? "已签到" : "未签到",
          "签到时间": p.isSignedIn && p.signInTime ? new Date(p.signInTime).toLocaleString() : "-"
      }));

      const ws = utils.json_to_sheet(data);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, "签到表");
      writeFile(wb, "会议签到表.xlsx");
  };

  const filteredParticipants = participants.filter(p => 
      p.nameCN.includes(searchTerm) || p.unitCN.includes(searchTerm)
  );

  const signedInCount = participants.filter(p => p.isSignedIn).length;

  return (
    <div className="p-8 h-full flex flex-col bg-gray-50">
       <div className="flex justify-between items-end mb-8 flex-wrap gap-4">
            <div>
                 <h2 className="text-3xl font-serif-sc font-bold text-gray-900">会议签到</h2>
                 <p className="text-gray-500 mt-2">实时管理参会人员报到状态</p>
            </div>
            
            <div className="flex items-center gap-4">
                 <button 
                    onClick={() => setShowQr(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm transition-all"
                >
                    <QrCode size={18} /> 会议二维码
                </button>
                <button 
                    onClick={handleExportSignInSheet}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 shadow-sm transition-all"
                >
                    <Download size={18} /> 下载签到表
                </button>
            </div>
       </div>

       {/* Stats Cards */}
       <div className="flex gap-4 mb-6">
            <div className="bg-white px-6 py-4 rounded-xl shadow-sm border border-gray-200 flex-1 flex flex-col items-center justify-center">
                <div className="text-xs text-gray-500 uppercase font-bold mb-1">已签到</div>
                <div className="text-4xl font-black text-green-600">{signedInCount}</div>
            </div>
            <div className="bg-white px-6 py-4 rounded-xl shadow-sm border border-gray-200 flex-1 flex flex-col items-center justify-center">
                <div className="text-xs text-gray-500 uppercase font-bold mb-1">未签到</div>
                <div className="text-4xl font-black text-red-500">{participants.length - signedInCount}</div>
            </div>
            <div className="bg-white px-6 py-4 rounded-xl shadow-sm border border-gray-200 flex-1 flex flex-col items-center justify-center">
                <div className="text-xs text-gray-500 uppercase font-bold mb-1">总人数</div>
                <div className="text-4xl font-black text-gray-800">{participants.length}</div>
            </div>
       </div>

       <div className="mb-6 relative">
            <input 
                type="text" 
                placeholder="搜索姓名或单位..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-4 rounded-xl border border-gray-200 shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none text-lg"
            />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={24}/>
       </div>

       <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-10">
           {filteredParticipants.map(p => (
               <div 
                  key={p.id} 
                  onClick={() => handleSignIn(p.id)}
                  className={`relative p-5 rounded-xl border-2 cursor-pointer transition-all duration-200 flex items-center justify-between group
                    ${p.isSignedIn 
                        ? 'bg-green-50 border-green-500 shadow-md' 
                        : 'bg-white border-gray-100 hover:border-indigo-300 hover:shadow-md'
                    }`}
               >
                   <div>
                       <h3 className={`text-xl font-bold font-serif-sc mb-1 ${p.isSignedIn ? 'text-green-900' : 'text-gray-900'}`}>{p.nameCN}</h3>
                       <p className={`text-sm ${p.isSignedIn ? 'text-green-700' : 'text-gray-500'}`}>{p.unitCN}</p>
                       {p.isSignedIn && (
                           <div className="mt-2 text-xs text-green-600 flex items-center gap-1">
                               <Clock size={12}/> {new Date(p.signInTime!).toLocaleTimeString()}
                           </div>
                       )}
                   </div>
                   <div>
                       {p.isSignedIn ? (
                           <CheckCircle2 size={32} className="text-green-500 fill-green-100"/>
                       ) : (
                           <Circle size={32} className="text-gray-200 group-hover:text-indigo-300"/>
                       )}
                   </div>
               </div>
           ))}
       </div>

       {/* QR Code Modal */}
       {showQr && (
           <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowQr(false)}>
               <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-sm w-full text-center relative" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setShowQr(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                        <X size={24}/>
                    </button>
                    <h3 className="text-xl font-bold font-serif-sc mb-6 text-gray-900">
                        {meetingTopic || "会议签到"}
                    </h3>
                    <div className="bg-white p-2 rounded-lg inline-block border border-gray-100 shadow-inner">
                        <img 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(meetingTopic || "Sign In")}`} 
                            alt="Meeting QR Code"
                            className="w-64 h-64" 
                        />
                    </div>
                    <p className="text-sm text-gray-500 mt-6">
                        请使用手机扫码签到 (示例)
                    </p>
               </div>
           </div>
       )}
    </div>
  );
};
