import React, { useState, useEffect } from 'react';
import { AppSettings } from '../types';
import { Save, Server, Cpu, KeyRound, CheckCircle2, XCircle, Loader2, Play, BookOpen, ExternalLink, HelpCircle, FileText, ChevronRight } from 'lucide-react';
import { fetchSiliconFlowModels } from '../services/aiService';

interface SettingsViewProps {
  settings: AppSettings;
  onSave: (newSettings: AppSettings) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ settings, onSave }) => {
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [showSaved, setShowSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'config' | 'tutorial'>('config');
  
  // Test State
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{success: boolean, msg: string} | null>(null);
  const [sfModels, setSfModels] = useState<string[]>([]);

  // Update local state when prop changes
  useEffect(() => {
      setFormData(settings);
  }, [settings]);

  const handleSave = () => {
    onSave(formData);
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 2000);
  };

  const testConnection = async () => {
      setTestingProvider(formData.aiProvider);
      setTestResult(null);
      
      try {
          if (formData.aiProvider === 'ollama') {
               const res = await fetch(`${formData.ollamaUrl}/api/tags`);
               if (res.ok) {
                   setTestResult({ success: true, msg: "Ollama 连接成功！" });
               } else {
                   throw new Error("Status: " + res.status);
               }
          } else if (formData.aiProvider === 'siliconflow') {
               const models = await fetchSiliconFlowModels(formData.siliconFlowKey);
               setSfModels(models);
               if (models.length > 0) {
                   setTestResult({ success: true, msg: `连接成功！已加载 ${models.length} 个可用模型。` });
                   // Update model selection if current is invalid
                   if (!formData.siliconFlowModel || !models.includes(formData.siliconFlowModel)) {
                       setFormData(prev => ({ ...prev, siliconFlowModel: models[0] }));
                   }
               } else {
                   setTestResult({ success: false, msg: "连接成功，但未找到可用的对话模型。" });
               }
          } else {
              setTestResult({ success: true, msg: "Gemini 需通过生成内容测试。" });
          }
      } catch (e: any) {
          setSfModels([]);
          setTestResult({ success: false, msg: `连接失败: ${e.message}` });
      } finally {
          setTestingProvider(null);
      }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto bg-white/50 min-h-full">
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
          <h2 className="text-2xl font-serif-sc font-bold text-gray-900">
            系统设置 / Configuration
          </h2>
          <div className="flex gap-2">
              <button 
                onClick={() => setActiveTab('config')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'config' ? 'bg-slate-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                  参数设置
              </button>
              <button 
                onClick={() => setActiveTab('tutorial')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'tutorial' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                  <BookOpen size={16}/> 使用教程
              </button>
          </div>
      </div>

      {activeTab === 'tutorial' && (
          <div className="space-y-6 animate-fadeIn">
              <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
                  <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                      <HelpCircle className="text-indigo-600"/> 详细使用指南
                  </h3>
                  
                   <div className="space-y-8">
                      {/* Ollama Guide */}
                      <div className="group">
                          <h4 className="font-bold text-lg text-gray-800 mb-2 flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs">1</span> 
                              Ollama (本地私有化模型)
                          </h4>
                          <div className="pl-8 text-sm text-gray-600 space-y-2">
                              <p>无需联网，数据隐私最强。适合在高性能电脑上使用。</p>
                              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                  <p className="font-mono text-xs mb-1">1. 下载安装包: <a href="https://ollama.com" target="_blank" className="text-blue-600 underline">ollama.com</a></p>
                                  <p className="font-mono text-xs mb-1">2. 安装完成后打开终端/命令行</p>
                                  <p className="font-mono text-xs mb-1">3. 运行模型: <code>ollama run llama3</code> (或 qwen2, mistral 等)</p>
                                  <p className="font-mono text-xs mb-1">4. 在本系统设置中填写地址: <code>http://localhost:11434</code></p>
                              </div>
                          </div>
                      </div>

                      {/* SiliconFlow Guide */}
                      <div className="group">
                          <h4 className="font-bold text-lg text-gray-800 mb-2 flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs">2</span> 
                              SiliconFlow (硅基流动)
                          </h4>
                          <div className="pl-8 text-sm text-gray-600 space-y-2">
                              <p>推荐国内用户使用，速度快，支持 DeepSeek-V3/R1、Qwen 等国产强力模型。</p>
                              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                  <p className="font-mono text-xs mb-1">1. 注册账号: <a href="https://cloud.siliconflow.cn" target="_blank" className="text-blue-600 underline">cloud.siliconflow.cn</a></p>
                                  <p className="font-mono text-xs mb-1">2. 进入 "API 密钥" 菜单创建一个新 Key</p>
                                  <p className="font-mono text-xs mb-1">3. 复制 Key (sk-xxxx...) 到本系统设置中</p>
                              </div>
                          </div>
                      </div>

                      {/* Gemini Guide */}
                      <div className="group">
                          <h4 className="font-bold text-lg text-gray-800 mb-2 flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs">3</span> 
                              Google Gemini
                          </h4>
                          <div className="pl-8 text-sm text-gray-600 space-y-2">
                              <p>国际顶尖多模态模型，支持图片识别。需科学上网环境。</p>
                              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                  <p className="font-mono text-xs mb-1">1. 访问: <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-blue-600 underline">Google AI Studio</a></p>
                                  <p className="font-mono text-xs mb-1">2. 点击 "Create API key"</p>
                                  <p className="font-mono text-xs mb-1">3. 确保您的网络环境可以访问 Google API</p>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'config' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Model Selection */}
            <section className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-3">
                <div className="p-2 bg-red-50 rounded-lg text-red-900">
                    <Cpu size={20} />
                </div>
                AI 模型服务商 (AI Provider)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {[
                    { id: 'gemini', label: 'Google Gemini', desc: '推荐: 稳定/快速/绘图' },
                    { id: 'ollama', label: 'Local Ollama', desc: '本地部署模型' },
                    { id: 'siliconflow', label: '硅基流动 SiliconFlow', desc: 'DeepSeek / Qwen' }
                ].map((provider) => (
                <button
                    key={provider.id}
                    onClick={() => {
                        setFormData({ ...formData, aiProvider: provider.id as any });
                        setTestResult(null);
                    }}
                    className={`flex flex-col items-start p-4 rounded-xl border-2 text-left transition-all duration-200
                    ${formData.aiProvider === provider.id 
                        ? 'border-red-800 bg-red-50/50 shadow-sm' 
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
                >
                    <span className={`font-bold text-sm mb-1 ${formData.aiProvider === provider.id ? 'text-red-900' : 'text-gray-700'}`}>
                        {provider.label}
                    </span>
                    <span className="text-xs text-gray-500">{provider.desc}</span>
                </button>
                ))}
            </div>
            </section>

            {/* Gemini Config */}
            {formData.aiProvider === 'gemini' && (
              <section className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                      <Server size={20} />
                  </div>
                  Gemini 参数配置
                </h3>
                <p className="text-sm text-gray-600">
                  Gemini API Key 已通过系统环境变量配置，无需在此处手动输入。
                </p>
              </section>
            )}

            {/* Ollama Config */}
            {formData.aiProvider === 'ollama' && (
            <section className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-3">
                    <div className="p-2 bg-orange-50 rounded-lg text-orange-600">
                        <Server size={20} />
                    </div>
                    本地模型配置 (Ollama)
                    </h3>
                    <button 
                        onClick={testConnection}
                        disabled={!!testingProvider}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors"
                    >
                        {testingProvider === 'ollama' ? <Loader2 className="animate-spin" size={14}/> : <Play size={14}/>}
                        测试连接
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Base URL</label>
                    <input
                    type="text"
                    value={formData.ollamaUrl}
                    onChange={(e) => setFormData({...formData, ollamaUrl: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                </div>
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Model Name</label>
                    <input
                    type="text"
                    value={formData.ollamaModel}
                    onChange={(e) => setFormData({...formData, ollamaModel: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                </div>
                </div>
            </section>
            )}

            {/* SiliconFlow Config */}
            {formData.aiProvider === 'siliconflow' && (
            <section className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-3">
                    <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                        <Server size={20} />
                    </div>
                    硅基流动配置
                </h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">API Key</label>
                        <div className="flex gap-2">
                            <input
                                type="password"
                                value={formData.siliconFlowKey}
                                onChange={(e) => {
                                    setFormData({...formData, siliconFlowKey: e.target.value});
                                    setTestResult(null);
                                    setSfModels([]);
                                }}
                                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                                placeholder="sk-..."
                            />
                            <button 
                                onClick={testConnection}
                                disabled={testingProvider === 'siliconflow' || !formData.siliconFlowKey}
                                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors disabled:opacity-50"
                            >
                                {testingProvider === 'siliconflow' ? <Loader2 className="animate-spin" size={14}/> : <KeyRound size={14}/>}
                                验证Key & 获取模型
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Model Name</label>
                        <select
                            value={formData.siliconFlowModel}
                            onChange={(e) => setFormData({...formData, siliconFlowModel: e.target.value})}
                            disabled={sfModels.length === 0 && !formData.siliconFlowModel}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent disabled:bg-gray-100"
                        >
                            {sfModels.length > 0 ? (
                                sfModels.map(model => <option key={model} value={model}>{model}</option>)
                            ) : (
                                <option>{formData.siliconFlowModel || "请先验证有效的 API Key"}</option>
                            )}
                        </select>
                         <p className="text-xs text-gray-500 mt-1">
                            支持 DeepSeek-V3, DeepSeek-R1, Qwen 等模型。
                        </p>
                    </div>
                </div>
            </section>
            )}
            
            {/* Test Result Feedback */}
            {testResult && (
                <div className={`p-4 rounded-lg flex items-center gap-3 ${testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {testResult.success ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                    <span className="font-medium text-sm">{testResult.msg}</span>
                </div>
            )}

            <div className="flex justify-end pt-6">
            <button
                onClick={handleSave}
                className={`flex items-center gap-2 px-8 py-3 rounded-lg text-white font-medium shadow-md transition-all
                    ${showSaved ? 'bg-green-600 hover:bg-green-700' : 'bg-slate-900 hover:bg-slate-800'}
                `}
            >
                <Save size={20} />
                {showSaved ? '保存成功' : '保存设置'}
            </button>
            </div>
        </div>
      )}
    </div>
  );
};