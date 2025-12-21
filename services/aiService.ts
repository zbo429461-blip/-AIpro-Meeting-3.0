
import { GoogleGenAI, Type } from "@google/genai";
import { AppSettings, Participant, AgendaItem, CardDesign, PPTSlide, FormField, AssetItem } from "../types";

export const getAIProviderLabel = (settings: AppSettings): string => {
  switch (settings.aiProvider) {
    case 'ollama':
      return `Ollama (${settings.ollamaModel || 'default'})`;
    case 'siliconflow':
      const modelName = settings.siliconFlowModel 
        ? settings.siliconFlowModel.split('/')[1] || 'Model' 
        : 'DeepSeek/Qwen';
      return `SiliconFlow (${modelName.replace('-instruct', '')})`;
    case 'gemini':
    default:
      return `Gemini (Flash)`;
  }
};

export const fetchSiliconFlowModels = async (apiKey: string): Promise<string[]> => {
  if (!apiKey) {
    throw new Error("API Key is required.");
  }
  const response = await fetch('https://api.siliconflow.cn/v1/models', {
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  });

  if (!response.ok) {
    const errBody = await response.json();
    throw new Error(errBody.message || `Failed to fetch models (Status: ${response.status})`);
  }

  const data = await response.json();
  return (data.data || []).map((model: any) => model.id).filter((id: string) => 
    (id.toLowerCase().includes('deepseek') || id.includes('instruct') || id.includes('chat') || id.includes('Qwen')) 
    && !id.includes('vision')
  );
};

const generateContentWithProvider = async (
  settings: AppSettings,
  contents: any,
  config?: any,
  systemInstruction?: string,
): Promise<string> => {
  const isJsonMode = config?.responseMimeType === 'application/json';

  switch (settings.aiProvider) {
    case 'ollama': {
      if (!settings.ollamaUrl || !settings.ollamaModel) throw new Error("Ollama URL or model not configured.");
      const promptText = typeof contents === 'string' ? contents : contents.parts?.find((p: any) => p.text)?.text || '';
      const body: any = { model: settings.ollamaModel, prompt: promptText, system: systemInstruction, stream: false };
      if (isJsonMode) body.format = 'json';
      const imagePart = typeof contents === 'object' ? contents.parts?.find((p: any) => p.inlineData) : null;
      if (imagePart) body.images = [imagePart.inlineData.data];
      const response = await fetch(`${settings.ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!response.ok) throw new Error(`Ollama API error: ${response.statusText}`);
      const data = await response.json();
      return data.response;
    }

    case 'siliconflow': {
      if (!settings.siliconFlowKey) throw new Error("SiliconFlow API Key not configured.");
      const messages: any[] = [];
      if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });
      let userContent: any;
      if (typeof contents === 'string') userContent = contents;
      else {
        userContent = contents.parts.map((part: any) => {
          if (part.text) return { type: 'text', text: part.text };
          if (part.inlineData) {
              // Note: SiliconFlow Vision API might have different requirements for data format
              return { type: 'image_url', image_url: { url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` } };
          }
          return null;
        }).filter(Boolean);
      }
      messages.push({ role: 'user', content: userContent });
      const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${settings.siliconFlowKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            model: settings.siliconFlowModel || 'deepseek-ai/DeepSeek-V3', 
            messages, 
            stream: false, 
            response_format: isJsonMode ? { type: 'json_object' } : undefined 
        })
      });
      const data = await response.json();
      const textResponse = data.choices[0].message.content;
      return isJsonMode ? textResponse.replace(/```json\n|```/g, '').trim() : textResponse;
    }

    default:
    case 'gemini': {
        const apiKey = process.env.API_KEY;
        if (!apiKey) throw new Error("Gemini API Key is not configured.");
        const ai = new GoogleGenAI({ apiKey });
        
        // Safety: Filter unsupported binary types if they reach here
        if (typeof contents === 'object' && contents.parts) {
            contents.parts = contents.parts.map((part: any) => {
                if (part.inlineData) {
                    const mime = part.inlineData.mimeType;
                    const supported = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];
                    if (!supported.includes(mime)) {
                        throw new Error(`AI 暂时不支持直接解析 ${mime} 格式。请将其另存为 PDF 或图片后再试。`);
                    }
                }
                return part;
            });
        }

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents,
            config: { ...config, systemInstruction },
        });
        const textResponse = response.text || '';
        return isJsonMode ? textResponse.replace(/```json\n|```/g, '').trim() : textResponse;
    }
  }
};

export const parseFormFromDocument = async (base64Data: string, mimeType: string, settings: AppSettings): Promise<{title: string, description: string, fields: FormField[]}> => {
    const systemInstruction = `You are a world-class form engineer specializing in "Reverse Engineering" documents into structured grid forms.
    
    ALGORITHM RULES:
    1. Grid System (24 units): Assign a colSpan (1-24) to each field based on its visual width. 
       - Full row = 24. 
       - Two side-by-side = 12 each.
       - Logic: Label width + Input width.
    2. Deep Field Detection:
       - Text inside boxes/lines -> FormField.
       - "Amount", "CNY", "$" -> type: "number".
       - "Date", "Year", "Month" -> type: "date".
       - Large empty blocks -> type: "textarea".
    3. Hierarchy: Identify the largest header as "title".
    4. Sequence: Output fields in top-to-bottom, left-to-right reading order.`;

    const prompt = `Analyze this document. Extract the form structure into a JSON object.
    
    JSON Schema:
    {
      "title": "Document Title",
      "description": "Brief purpose",
      "fields": [
        { "id": "f1", "label": "Field Name", "type": "text|textarea|date|number", "colSpan": 1-24, "required": true|false }
      ]
    }`;

    const contents = {
        parts: [
            { inlineData: { mimeType, data: base64Data } },
            { text: prompt }
        ]
    };

    const responseText = await generateContentWithProvider(settings, contents, { responseMimeType: "application/json" }, systemInstruction);
    return JSON.parse(responseText);
};

export const parseFormFromExcelData = async (data: any[][], settings: AppSettings): Promise<{title: string, description: string, fields: FormField[]}> => {
    const systemInstruction = `You are an Excel-to-Form conversion expert. Analyze the provided 2D array data to find form labels and input placeholders.
    Return a 24-unit grid JSON structure.`;

    const prompt = `Convert this Excel grid data to a structured form: ${JSON.stringify(data.slice(0, 50))}`;
    const responseText = await generateContentWithProvider(settings, prompt, { responseMimeType: "application/json" }, systemInstruction);
    return JSON.parse(responseText);
};

export const parseAssetRequest = async (text: string, settings: AppSettings): Promise<Partial<AssetItem>[]> => {
    const systemInstruction = `你是一位专业的资产管理员。请从用户输入的非结构化文本中提取资产信息。
    支持批量提取。返回 JSON 数组格式: [{"name": "...", "brandModel": "...", "price": "...", "location": "...", "category": "IT|Furniture|Electronic|Consumables|Other"}]`;
    
    const responseText = await generateContentWithProvider(settings, text, { responseMimeType: "application/json" }, systemInstruction);
    try { return JSON.parse(responseText); } catch(e) { return []; }
};

export const generateChatResponse = async (settings: AppSettings, prompt: string, systemInstruction?: string): Promise<string> => {
    return generateContentWithProvider(settings, prompt, {}, systemInstruction);
};

export const parseMeetingRequest = async (text: string, settings: AppSettings): Promise<any> => {
    const systemInstruction = `你是一个会议信息解析专家。请从用户输入的文本中提取：会议主题 (topic)、日期 (date, YYYY-MM-DD)、时间 (time, HH:MM)、地点 (location)、校区 (campus)。
    输出格式必须是纯 JSON。`;
    
    const responseText = await generateContentWithProvider(settings, text, { responseMimeType: "application/json" }, systemInstruction);
    try { return JSON.parse(responseText); } catch(e) { return null; }
};

export const translateParticipantInfo = async (p: Participant, settings: AppSettings): Promise<any> => {
    const prompt = `Translate to English. Return JSON: { "nameEN": "...", "unitEN": "..." }. 
    Source Name: ${p.nameCN}, Source Unit: ${p.unitCN}`;
    const responseText = await generateContentWithProvider(settings, prompt, { responseMimeType: "application/json" });
    try { return JSON.parse(responseText); } catch(e) { return {}; }
};

export const parseParticipantsFromImage = async (base64Data: string, settings: AppSettings): Promise<Partial<Participant>[]> => {
    const systemInstruction = `你是一个 OCR 专家。从名单图片中提取：中文姓名 (nameCN)、单位名称 (unitCN)、手机号/工号 (workIdOrPhone)。
    返回 JSON 数组格式: [{"nameCN": "...", "unitCN": "...", "workIdOrPhone": "..."}]`;
    const responseText = await generateContentWithProvider(settings, { parts: [{ inlineData: { mimeType: "image/jpeg", data: base64Data } }, { text: "提取名单内容" }] }, { responseMimeType: "application/json" }, systemInstruction);
    try { return JSON.parse(responseText); } catch(e) { return []; }
};

export const parseParticipantsFromText = async (text: string, settings: AppSettings): Promise<Partial<Participant>[]> => {
    const prompt = `从以下非结构化文本中提取参会人员名单。返回 JSON 数组: [{"nameCN": "...", "unitCN": "..."}]. 文本内容：${text}`;
    const responseText = await generateContentWithProvider(settings, prompt, { responseMimeType: "application/json" });
    try { return JSON.parse(responseText); } catch(e) { return []; }
};

export const generateAgenda = async (topic: string, date: string, settings: AppSettings): Promise<AgendaItem[]> => {
    const prompt = `为主题为 "${topic}" 的会议生成 3-5 个议程。日期: ${date}。返回 JSON 数组: [{"time": "HH:MM", "title": "...", "speaker": "...", "location": "..."}]`;
    const responseText = await generateContentWithProvider(settings, prompt, { responseMimeType: "application/json" });
    try { return JSON.parse(responseText); } catch(e) { return []; }
};

export const generateCardDesign = async (topic: string, settings: AppSettings): Promise<Partial<CardDesign>> => {
    const prompt = `根据会议主题 "${topic}"，推荐配色方案。返回 JSON: {"bgColor": "#hex", "fontColor": "#hex", "fontFamily": "SimHei|SimSun"}`;
    const responseText = await generateContentWithProvider(settings, prompt, { responseMimeType: "application/json" });
    try { return JSON.parse(responseText); } catch(e) { return {}; }
};

export const generatePPTStructure = async (prompt: string, settings: AppSettings, example?: string): Promise<PPTSlide[]> => {
    const systemInstruction = `你是一位专业的 PPT 结构设计师。返回 JSON 数组: [{"title": "...", "content": ["点1", "点2"], "layout": "title|content|image_left", "speakerNotes": "..."}]`;
    const userPrompt = `主题: ${prompt} ${example ? `\n参考内容: ${example}` : ''}`;
    const responseText = await generateContentWithProvider(settings, userPrompt, { responseMimeType: "application/json" }, systemInstruction);
    try { return JSON.parse(responseText); } catch(e) { return []; }
};

export const generateSlideImage = async (prompt: string, settings: AppSettings): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: prompt }] },
        config: { imageConfig: { aspectRatio: "16:9" } },
    });
    const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    return part?.inlineData?.data || '';
};
