import { GoogleGenAI } from "@google/genai";
import { AppSettings, Participant, AgendaItem, CardDesign, PPTSlide } from "../types";

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
  const allModels = (data.data || []).map((model: any) => model.id);
  
  // Filter relevant models (chat/instruct)
  const chatModels = allModels.filter((id: string) => 
    (id.toLowerCase().includes('deepseek') || id.includes('instruct') || id.includes('chat') || id.includes('Qwen')) 
    && !id.includes('vision')
  );
  
  // Custom Sort: Prioritize DeepSeek V3/R1, then Qwen
  const prioritized = chatModels.sort((a: string, b: string) => {
      const isDeepSeekA = a.toLowerCase().includes('deepseek');
      const isDeepSeekB = b.toLowerCase().includes('deepseek');
      if (isDeepSeekA && !isDeepSeekB) return -1;
      if (!isDeepSeekA && isDeepSeekB) return 1;
      
      const isQwenA = a.toLowerCase().includes('qwen');
      const isQwenB = b.toLowerCase().includes('qwen');
      if (isQwenA && !isQwenB) return -1;
      if (!isQwenA && isQwenB) return 1;
      
      return 0;
  });
  
  return prioritized.length > 0 ? prioritized : chatModels;
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
      
      // Ollama 'generate' API expects 'prompt' and 'system', not 'messages' like OpenAI
      const body: any = {
        model: settings.ollamaModel,
        prompt: promptText,
        system: systemInstruction,
        stream: false,
        options: {
             temperature: 0.7
        }
      };

      if (isJsonMode) {
          body.format = 'json';
      }

      // Handle Images for Ollama (if supported by model like llava)
      const imagePart = typeof contents === 'object' ? contents.parts?.find((p: any) => p.inlineData) : null;
      if (imagePart) {
          body.images = [imagePart.inlineData.data];
      }

      const response = await fetch(`${settings.ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      if (!response.ok) {
        // Handle common CORS error hint
        if (response.status === 0) {
             throw new Error("Connection failed. Check if Ollama is running and OLLAMA_ORIGINS='*' is set.");
        }
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
      
      // SiliconFlow uses OpenAI-compatible /chat/completions
      const messages: any[] = [];
      if (systemInstruction) {
        messages.push({ role: 'system', content: systemInstruction });
      }

      let userContent: any;
      if (typeof contents === 'string') {
        userContent = contents;
      } else { // Multimodal
        // SiliconFlow/OpenAI format for images
        userContent = contents.parts.map((part: any) => {
          if (part.text) return { type: 'text', text: part.text };
          if (part.inlineData) return { type: 'image_url', image_url: { url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` } };
          return null;
        }).filter(Boolean);
      }
      messages.push({ role: 'user', content: userContent });
      
      const model = settings.siliconFlowModel || 'deepseek-ai/DeepSeek-V3';
      
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
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`SiliconFlow API error: ${response.statusText} - ${errBody}`);
      }
      const data = await response.json();
      const textResponse = data.choices[0].message.content;
      
      // Clean markdown code blocks if present in JSON mode
      if (isJsonMode && textResponse.includes('```')) {
          return textResponse.replace(/```json\n|```/g, '').trim();
      }
      return textResponse;
    }

    default: // Fallback to Gemini
    case 'gemini': {
        const apiKey = process.env.API_KEY;
        if (!apiKey) {
            throw new Error("Gemini API Key is not configured in environment variables.");
        }
        const ai = new GoogleGenAI({ apiKey });
        
        // Use Pro model if available/requested, otherwise Flash
        const model = 'gemini-3-flash-preview'; 
        
        const response = await ai.models.generateContent({
            model,
            contents,
            config: {
                ...config,
                systemInstruction: systemInstruction,
            },
        });
        
        const textResponse = response.text || '';
        
        // Clean markdown code blocks if present in JSON mode for Gemini as well
        if (isJsonMode && textResponse.includes('```')) {
             return textResponse.replace(/```json\n|```/g, '').trim();
        }
        
        return textResponse;
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
    const parsed = JSON.parse(jsonString || '[]');
    // Handle wrapped array response
    if (!Array.isArray(parsed) && typeof parsed === 'object') {
        const arr = Object.values(parsed).find(v => Array.isArray(v));
        return (arr as Partial<Participant>[]) || [];
    }
    return Array.isArray(parsed) ? parsed : [];
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
    const parsed = JSON.parse(jsonString || '[]');
    // Handle wrapped array response
    if (!Array.isArray(parsed) && typeof parsed === 'object') {
        const arr = Object.values(parsed).find(v => Array.isArray(v));
        return (arr as Partial<Participant>[]) || [];
    }
    return Array.isArray(parsed) ? parsed : [];
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
    let jsonString = await generateContentWithProvider(
        settings,
        prompt,
        { responseMimeType: 'application/json' }
    );
    
    // Ensure clean string
    jsonString = jsonString.replace(/```json\n?|```/g, '').trim();

    let items = JSON.parse(jsonString || '[]');
    
    // Handle case where AI wraps array in an object
    if (!Array.isArray(items) && typeof items === 'object' && items !== null) {
        // Try to find an array property
        const possibleArray = Object.values(items).find(val => Array.isArray(val));
        if (possibleArray) {
            items = possibleArray;
        }
    }

    if (!Array.isArray(items)) {
        console.warn("AI returned non-array structure:", items);
        return [];
    }

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

// --- PPT Generation Functions ---

export const generatePPTStructure = async (topic: string, settings: AppSettings, example?: string): Promise<PPTSlide[]> => {
    try {
        // Build prompt with optional example
        let promptText = `Create a detailed presentation outline for: "${topic}". 
        Generate 5-8 slides. 
        Return ONLY a valid JSON array of objects. 
        Structure each object as: { 
          "title": "Slide Title", 
          "content": ["bullet point 1", "bullet point 2"], 
          "layout": "content" (or "title" for the first slide),
          "speakerNotes": "Brief speaker notes"
        }.`;

        if (example && example.trim()) {
            promptText += `\n\nIMPORTANT: STRICTLY FOLLOW the structure/style of the following example content provided by the user:\n${example}\n\n`;
        }

        // Use more capable model if available for complex structural tasks
        // If provider is Gemini, we try to force 'gemini-3-pro-preview' for better reasoning if default is flash
        if (settings.aiProvider === 'gemini') {
             const apiKey = process.env.API_KEY;
             if (apiKey) {
                 const ai = new GoogleGenAI({ apiKey });
                 const response = await ai.models.generateContent({
                     model: 'gemini-3-pro-preview', // Use Pro for better structure generation
                     contents: promptText,
                     config: { responseMimeType: 'application/json' }
                 });
                 
                 let jsonString = response.text || '[]';
                 jsonString = jsonString.replace(/```json\n?|```/g, '').trim();
                 let rawSlides = JSON.parse(jsonString);
                 
                 if (!Array.isArray(rawSlides) && typeof rawSlides === 'object') {
                    const possibleArray = Object.values(rawSlides).find(val => Array.isArray(val));
                    if (possibleArray) rawSlides = possibleArray;
                 }
                 return Array.isArray(rawSlides) ? rawSlides.map((s: any, i: number) => ({
                    id: `slide-${Date.now()}-${i}`,
                    title: s.title,
                    content: s.content || [],
                    layout: i === 0 ? 'title' : 'content',
                    speakerNotes: s.speakerNotes
                })) : [];
             }
        }

        // Fallback to standard provider logic for other providers
        let jsonString = await generateContentWithProvider(
            settings, 
            promptText, 
            { responseMimeType: 'application/json' }
        );

        // Ensure clean string
        jsonString = jsonString.replace(/```json\n?|```/g, '').trim();
        
        let rawSlides = JSON.parse(jsonString || '[]');
        
         // Handle wrapped array response
        if (!Array.isArray(rawSlides) && typeof rawSlides === 'object' && rawSlides !== null) {
            const possibleArray = Object.values(rawSlides).find(val => Array.isArray(val));
            if (possibleArray) {
                rawSlides = possibleArray;
            }
        }
        
        if (!Array.isArray(rawSlides)) return [];

        return rawSlides.map((s: any, i: number) => ({
            id: `slide-${Date.now()}-${i}`,
            title: s.title,
            content: s.content || [],
            layout: i === 0 ? 'title' : 'content',
            speakerNotes: s.speakerNotes
        }));
    } catch (error) {
        console.error("PPT Structure Error:", error);
        throw error;
    }
};

export const generateSlideImage = async (prompt: string, settings: AppSettings): Promise<string> => {
    // Specifically use 'gemini-2.5-flash-image' (Nano Banana) for image generation if provider is Gemini
    // If SiliconFlow/Ollama, we might need a fallback or they might not support image gen nicely via this interface
    
    // For this specific request "nano banana", we try to force Gemini Image model if available
    try {
        if (settings.aiProvider === 'gemini') {
             const apiKey = process.env.API_KEY;
             if (!apiKey) throw new Error("No Gemini API Key");
             
             const ai = new GoogleGenAI({ apiKey });
             const response = await ai.models.generateContent({
                 model: 'gemini-2.5-flash-image',
                 contents: { parts: [{ text: prompt }] },
                 config: {
                    imageConfig: { aspectRatio: "16:9" }
                 }
             });
             
             // Extract Image
             for (const part of response.candidates?.[0]?.content?.parts || []) {
                 if (part.inlineData) {
                     return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                 }
             }
             return '';
        } else {
            // Fallback for other providers if they don't support image gen easily
            // Or return a placeholder
            return '';
        }
    } catch (e) {
        console.error("Image Gen Error", e);
        return '';
    }
};