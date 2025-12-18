import React, { useState } from 'react';
import { MeetingFile } from '../types';
import { FileText, Image as ImageIcon, Presentation, Upload, Trash2, FolderOpen, Download, Search } from 'lucide-react';

interface FilesViewProps {
  files: MeetingFile[];
  setFiles: (files: MeetingFile[]) => void;
}

export const FilesView: React.FC<FilesViewProps> = ({ files, setFiles }) => {
  const [dragActive, setDragActive] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  const handleFiles = (fileList: FileList) => {
    const newFiles: MeetingFile[] = Array.from(fileList).map(file => {
        let cat: MeetingFile['category'] = 'other';
        if (file.type.includes('image')) cat = 'image';
        else if (file.type.includes('pdf') || file.type.includes('word') || file.name.includes('.doc')) cat = 'document';
        else if (file.type.includes('presentation') || file.name.endsWith('.ppt') || file.name.endsWith('.pptx')) cat = 'presentation';

        // Create Object URL for session access
        const objUrl = URL.createObjectURL(file);

        return {
            id: Date.now().toString() + Math.random(),
            name: file.name,
            size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
            type: file.type,
            category: cat,
            uploadDate: new Date().toLocaleDateString(),
            url: objUrl
        };
    });
    setFiles([...files, ...newFiles]);
  };

  const handleDelete = (id: string) => {
      // Revoke URL to free memory if needed, though mostly handled by browser on refresh
      setFiles(files.filter(f => f.id !== id));
  };

  const handleDownload = (file: MeetingFile) => {
      if (!file.url) {
          alert("文件链接已过期或不可用 (仅当前会话有效)");
          return;
      }
      const a = document.createElement('a');
      a.href = file.url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
  };

  const filteredFiles = files.filter(f => {
      const matchesSearch = f.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCat = categoryFilter === 'all' || f.category === categoryFilter;
      return matchesSearch && matchesCat;
  });

  const getIcon = (cat: string) => {
      switch(cat) {
          case 'image': return <ImageIcon className="text-purple-500" />;
          case 'presentation': return <Presentation className="text-orange-500" />;
          default: return <FileText className="text-blue-500" />;
      }
  };

  return (
    <div className="p-6 h-full flex flex-col bg-gray-50/50">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-serif-sc font-bold text-gray-900">会议资料管理</h2>
            <div className="relative">
                <input 
                    type="text" 
                    placeholder="搜索文件..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm w-64 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
            </div>
        </div>

        {/* Categories */}
        <div className="flex gap-2 mb-6">
            {['all', 'document', 'presentation', 'image'].map(cat => (
                <button 
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-4 py-2 rounded-full text-xs font-medium capitalize border transition-all
                        ${categoryFilter === cat 
                            ? 'bg-slate-900 text-white border-slate-900' 
                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                >
                    {cat === 'all' ? 'All Files' : cat + 's'}
                </button>
            ))}
        </div>

        {/* Upload Zone */}
        <div 
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all mb-8
                ${dragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 bg-white hover:border-indigo-400'}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
        >
            <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Upload size={24} />
                </div>
                <h3 className="font-bold text-gray-700">点击或拖拽上传会议资料</h3>
                <p className="text-sm text-gray-400">支持 PPT, PDF, Word, 图片等格式 (仅本次会话有效)</p>
                <label className="mt-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium cursor-pointer hover:bg-gray-50 text-gray-700">
                    选择文件
                    <input type="file" className="hidden" multiple onChange={handleChange} />
                </label>
            </div>
        </div>

        {/* File List */}
        <div className="flex-1 overflow-y-auto">
            {filteredFiles.length === 0 ? (
                <div className="text-center py-20 text-gray-400">
                    <FolderOpen size={48} className="mx-auto mb-3 opacity-20" />
                    <p>暂无文件</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredFiles.map(file => (
                        <div key={file.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow group relative">
                            <div className="flex items-start justify-between mb-3">
                                <div className="p-2 bg-gray-50 rounded-lg">
                                    {getIcon(file.category)}
                                </div>
                                <button 
                                    onClick={() => handleDelete(file.id)}
                                    className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                            <h4 className="font-bold text-gray-800 text-sm truncate mb-1" title={file.name}>{file.name}</h4>
                            <div className="flex justify-between items-center text-xs text-gray-500">
                                <span>{file.size}</span>
                                <span>{file.uploadDate}</span>
                            </div>
                            <div className="mt-3 pt-3 border-t border-gray-50 flex justify-end">
                                <button 
                                    onClick={() => handleDownload(file)}
                                    className="text-xs font-medium text-indigo-600 flex items-center gap-1 hover:underline"
                                >
                                    <Download size={12}/> 下载 / 预览
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    </div>
  );
};