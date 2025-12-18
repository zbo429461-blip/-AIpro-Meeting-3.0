import { GoogleGenAI } from "@google/genai";
import { AppSettings, Participant, AgendaItem, CardDesign } from "../types";

export const getAIProviderLabel = (settings: AppSettings): string => {
  switch (settings.aiProvider) {
    case 'ollama':
      return `Ollama (${settings.ollamaModel || 'default'})`;
    case 'siliconflow':
      return `SiliconFlow (DeepSeek)`;
    case 'gemini':
    default:
      return `Gemini (Flash)`;
  }
};

// The new core function to handle different AI providers
const generateContentWithProvider = async (
  settings: AppSettings,
  contents: any, // string or { parts: [{text:..}, {inlineData:{data:..}}] }
  config?: any,
  systemInstruction?: string,
): Promise<string> => {
  const isJsonMode = config?.responseMimeType === 'application/json';

  switch (settings.aiProvider) {
    case 'ollama': {
      if (!settings.ollamaUrl || !settings.ollamaModel) {
        throw new Error("Ollama URL or model not configured.");
      }
      const promptText = typeof contents === 'string' ? contents : contents.parts?.find((p: any) => p.text)?.text || '';
      const imagePart = typeof contents === 'object' ? contents.parts?.find((p: any) => p.inlineData) : null;
      const images = imagePart ? [imagePart.inlineData.data] : undefined;

      const response = await fetch(`${settings.ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: settings.ollamaModel,
          prompt: promptText,
          system: systemInstruction,
          images: images,
          stream: false,
          format: isJsonMode ? 'json' : undefined,
        })
      });
      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Ollama API error: ${response.statusText} - ${errBody}`);
      }
      const data = await response.json();
      return data.response;
    }

    case 'siliconflow': {
      if (!settings.siliconFlowKey) {
        throw new Error("SiliconFlow API Key not configured.");
      }
      const messages: any[] = [];
      if (systemInstruction) {
        messages.push({ role: 'system', content: systemInstruction });
      }

      let userContent: any;
      if (typeof contents === 'string') {
        userContent = contents;
      } else { // Multimodal
        userContent = contents.parts.map((part: any) => {
          if (part.text) return { type: 'text', text: part.text };
          if (part.inlineData) return { type: 'image_url', image_url: { url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` } };
          return null;
        }).filter(Boolean);
      }
      messages.push({ role: 'user', content: userContent });
      
      const model = 'deepseek-ai/deepseek-v2-chat';
      const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${settings.siliconFlowKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
          stream: false,
          response_format: isJsonMode ? { type: 'json_object' } : undefined,
        })
      });
      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`SiliconFlow API error: ${response.statusText} - ${errBody}`);
      }
      const data = await response.json();
      const textResponse = data.choices[0].message.content;
      if (isJsonMode && textResponse.startsWith('```json')) {
          return textResponse.replace(/```json\n|```/g, '');
      }
      return textResponse;
    }

    default: // Fallback to Gemini
    case 'gemini': {
        const apiKey = settings.geminiKey || process.env.API_KEY;
        if (!apiKey) {
            throw new Error("Gemini API Key not found.");
        }
        const ai = new GoogleGenAI({ apiKey });
        // NOTE: The new SDK does not use model instances.
        const model = 'gemini-2.5-flash';
        const response = await ai.models.generateContent({
            model,
            contents,
            config: {
                ...config,
                systemInstruction: systemInstruction,
            },
        });
        return response.text || '';
    }
  }
};


export const translateParticipantInfo = async (
  participant: Participant,
  settings: AppSettings
): Promise<{ nameEN: string; unitEN: string }> => {
  try {
    const prompt = `Translate Chinese name and Unit to English. Name CN: ${participant.nameCN}, Unit CN: ${participant.unitCN}. Return ONLY a valid JSON object with keys "nameEN" and "unitEN".`;
    const jsonString = await generateContentWithProvider(
        settings,
        prompt,
        { responseMimeType: 'application/json' }
    );
    return JSON.parse(jsonString || '{}');
  } catch (error) { 
    console.error("Translate Error:", error);
    return { nameEN: '', unitEN: '' }; 
  }
};

export const parseParticipantsFromText = async (rawText: string, settings: AppSettings): Promise<Partial<Participant>[]> => {
  try {
    const prompt = `Extract participants from the following text. The text is: "${rawText}". Return ONLY a valid JSON array of objects. Each object should have keys: "nameCN", "unitCN", and "workIdOrPhone".`;
    const jsonString = await generateContentWithProvider(
        settings,
        prompt,
        { responseMimeType: 'application/json' }
    );
    return JSON.parse(jsonString || '[]');
  } catch (error) { 
    console.error("Parse Text Error:", error);
    throw error; 
  }
};

export const parseParticipantsFromImage = async (base64Image: string, settings: AppSettings): Promise<Partial<Participant>[]> => {
  try {
    const contents = {
        parts: [
            { inlineData: { mimeType: 'image/png', data: base64Image } },
            { text: "Extract participant information from the image list. Return ONLY a valid JSON array of objects. Each object should have keys: 'nameCN', 'unitCN', 'workIdOrPhone'." }
        ]
    };
    const jsonString = await generateContentWithProvider(
        settings,
        contents,
        { responseMimeType: 'application/json' }
    );
    return JSON.parse(jsonString || '[]');
  } catch (error) { 
    console.error("Parse Image Error:", error);
    throw error; 
  }
};

export const parseMeetingRequest = async (transcript: string, settings: AppSettings) => {
    try {
        const prompt = `
            Analyze this voice command for booking a meeting room at China University of Political Science and Law (CUPL).
            Command: "${transcript}"
            
            Extract the following details and return ONLY a valid JSON object:
            - campus: (e.g., "昌平校区" or "海淀校区")
            - location: (e.g., "主楼", "会议室名")
            - date: (YYYY-MM-DD format, assume current year is 2025 if not specified)
            - time: (HH:MM format)
            - topic: (Meeting title)
        `;
        const jsonString = await generateContentWithProvider(
            settings,
            prompt,
            { responseMimeType: 'application/json' }
        );
        return JSON.parse(jsonString || '{}');
    } catch (e) {
        console.error("Voice Parse Error", e);
        return null;
    }
};

export const generateAgenda = async (
  topic: string, 
  date: string,
  settings: AppSettings
): Promise<AgendaItem[]> => {
  try {
    const prompt = `Create a plausible academic conference agenda for a meeting titled "${topic}" scheduled on ${date}. Generate 5 to 8 agenda items. Return ONLY a valid JSON array of objects, where each object has keys: "time", "title", "speaker", and "location".`;
    const jsonString = await generateContentWithProvider(
        settings,
        prompt,
        { responseMimeType: 'application/json' }
    );
    const items = JSON.parse(jsonString || '[]');
    return items.map((item: any, i: number) => ({ id: `gen-${Date.now()}-${i}`, ...item }));
  } catch (error) { 
      console.error("Generate Agenda Error:", error);
      throw error; 
  }
};

export const generateCardDesign = async (topic: string, settings: AppSettings): Promise<Partial<CardDesign>> => {
    try {
        const prompt = `Suggest a simple and elegant color scheme for a conference table card. The conference topic is "${topic}". Return ONLY a valid JSON object with keys: "bgColor" (a hex code), "fontColor" (a hex code), and "fontFamily" (either 'SimHei' for sans-serif or 'SimSun' for serif).`;
        const jsonString = await generateContentWithProvider(
            settings,
            prompt,
            { responseMimeType: 'application/json' }
        );
        return JSON.parse(jsonString || '{}');
    } catch (e) { 
        console.error("Generate Card Design Error:", e);
        return {}; 
    }
}

// New function for AssistantView
export const generateChatResponse = async (settings: AppSettings, userQuery: string, systemInstruction: string): Promise<string> => {
    try {
        const reply = await generateContentWithProvider(settings, userQuery, {}, systemInstruction);
        return reply || "抱歉，我现在无法回答。请检查网络或Key配置。";
    } catch (error: any) {
        console.error("Chat Response Error:", error);
        const providerLabel = getAIProviderLabel(settings);
        return `连接 ${providerLabel} 服务失败: ${error.message}. 请确保您已在设置中为选定的服务商配置了有效的 URL 或 API Key。`;
    }
};