
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { AppSettings, Participant, AgendaItem, CardDesign, PPTSlide, FormField, AssetItem } from "../types";
// @ts-ignore
import * as gradio from "@gradio/client";

export const getAIProviderLabel = (settings: AppSettings): string => {
  switch (settings.aiProvider) {
    case 'ollama':
      return `Ollama (${settings.ollamaModel || 'default'})`;
    case 'siliconflow':
      const modelName = settings.siliconFlowModel 
        ? settings.siliconFlowModel.split('/')[1] || settings.siliconFlowModel 
        : 'DeepSeek';
      return `SiliconFlow (${modelName.replace('-instruct', '')})`;
    case 'gemini':
    default:
      return `Gemini (Pro/Flash)`;
  }
};

export const fetchSiliconFlowModels = async (apiKey: string): Promise<string[]> => {
  if (!apiKey) throw new Error("API Key is required.");
  
  // Sanitize Key: Remove whitespace and check for non-ASCII characters
  const safeKey = apiKey.trim();
  if (/[^\x00-\x7F]/.test(safeKey)) {
      throw new Error("API Key 包含非法字符（如中文或全角符号），请检查输入。");
  }

  try {
    const response = await fetch('https://api.siliconflow.cn/v1/models', {
      headers: { 'Authorization': `Bearer ${safeKey}` }
    });
    if (!response.ok) throw new Error(`Failed to fetch models: ${response.status}`);
    const data = await response.json();
    
    // Filter logic improved: Case-insensitive and broader keyword match
    return (data.data || []).map((model: any) => model.id).filter((id: string) => {
        const lowerId = id.toLowerCase();
        // Allow DeepSeek, Qwen, Llama, GLM, Yi
        const isSupportedFamily = lowerId.includes('deepseek') || lowerId.includes('qwen') || lowerId.includes('llama') || lowerId.includes('glm') || lowerId.includes('yi');
        // Ensure it's a chat/instruct/VL model (not just embeddings)
        const isChatModel = lowerId.includes('instruct') || lowerId.includes('chat') || lowerId.includes('vl');
        // Exclude raw vision encoders if explicitly marked (usually not an issue if we check for chat/instruct)
        return isSupportedFamily && isChatModel;
    });
  } catch (e) {
    console.error(e);
    throw e;
  }
};

const extractJson = (text: string): string => {
  // Try to find markdown json block
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (match && match[1]) {
    return match[1].trim();
  }
  // Try to find the first { or [ and the last } or ]
  const firstBrace = text.search(/[{[]/);
  
  if (firstBrace !== -1) {
     // Naive extraction if no code blocks
     // Find the last closing brace
     let lastIndex = text.lastIndexOf('}');
     const lastBracket = text.lastIndexOf(']');
     if (lastBracket > lastIndex) lastIndex = lastBracket;
     
     if (lastIndex > firstBrace) {
         return text.substring(firstBrace, lastIndex + 1);
     }
  }
  
  return text.trim();
};

const base64ToBlob = (base64: string, mimeType: string) => {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
};

// Perform OCR using Gradio (erow/OCR-DEMO)
const performGradioOCR = async (base64Data: string, mimeType: string): Promise<string> => {
    try {
        console.log("Connecting to Gradio OCR...");
        
        // Handle ESM/CJS interop for CDN imports where named exports might be hidden on default
        // @ts-ignore
        const ClientConstructor = gradio.Client || (gradio.default && gradio.default.Client) || gradio.default;
        
        if (!ClientConstructor) {
            throw new Error("Gradio Client not found in module");
        }

        const client = await ClientConstructor.connect("erow/OCR-DEMO");
        const blob = base64ToBlob(base64Data, mimeType);
        
        // Use array for positional arguments [image, model_size]
        const result = await client.predict("/partial", [ 
            blob, 
            "Base" 
        ]);
        
        // The API returns [html_string, ...]
        const output = result.data?.[0];
        console.log("OCR Success");
        return typeof output === 'string' ? output : JSON.stringify(output);
    } catch (e: any) {
        console.warn("Gradio OCR failed:", e);
        throw new Error(`OCR Service Error: ${e.message || 'Unknown error'}`);
    }
};

// Helper: Retry operation for transient network errors (RPC/Fetch)
async function retryWithBackoff<T>(operation: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
    try {
        return await operation();
    } catch (error: any) {
        const msg = error.toString().toLowerCase();
        // Check for common transient errors: RPC failed, Fetch failed, or 503/504/429 status codes
        if (retries > 0 && (msg.includes("rpc") || msg.includes("fetch") || msg.includes("503") || msg.includes("504") || msg.includes("429") || msg.includes("network") || msg.includes("aborted"))) {
            console.warn(`Transient API Error (${msg}), retrying in ${delay}ms... Attempts left: ${retries}`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return retryWithBackoff(operation, retries - 1, delay * 2); // Exponential backoff
        }
        throw error;
    }
}

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
      
      let promptText = '';
      const images: string[] = [];

      if (typeof contents === 'string') {
        promptText = contents;
      } else if (contents.parts) {
        contents.parts.forEach((p: any) => {
          if (p.text) promptText += p.text + "\n";
          if (p.inlineData) images.push(p.inlineData.data);
        });
      }

      const body: any = { 
        model: settings.ollamaModel, 
        prompt: promptText, 
        system: systemInstruction, 
        stream: false 
      };

      if (images.length > 0) {
        body.images = images;
      }
      
      if (isJsonMode) body.format = 'json';
      
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
      const safeKey = settings.siliconFlowKey.trim();
      if (/[^\x00-\x7F]/.test(safeKey)) {
          throw new Error("SiliconFlow API Key contains invalid characters (non-ASCII).");
      }
      
      const messages: any[] = [];
      if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });
      
      let userContent: any;
      if (typeof contents === 'string') {
        userContent = contents;
      } else {
        // Convert Gemini parts to OpenAI/SiliconFlow Content Array
        userContent = contents.parts.map((part: any) => {
          if (part.text) return { type: 'text', text: part.text };
          if (part.inlineData) {
            return { 
                type: 'image_url', 
                image_url: { 
                    // SiliconFlow expects Data URL
                    url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` 
                } 
            };
          }
          return null;
        }).filter(Boolean);
      }
      messages.push({ role: 'user', content: userContent });

      // Auto-switch to Vision Model if images detected
      let modelToUse = settings.siliconFlowModel || 'deepseek-ai/DeepSeek-V3';
      const hasImage = Array.isArray(userContent) && userContent.some((c:any) => c.type === 'image_url');
      
      // If we have images, SiliconFlow requires a VL model (like Qwen-VL). DeepSeek-V3 is text only.
      if (hasImage) {
          // Check if current model is already VL capable (simple check for 'VL' in name)
          // Use the latest Qwen2.5-VL-72B if available or requested
          if (!modelToUse.includes('VL') || modelToUse.includes('DeepSeek')) {
               modelToUse = 'Qwen/Qwen2.5-VL-72B-Instruct'; 
               console.log("Auto-switched to High-Performance Vision Model (vLLM):", modelToUse);
          }
      }

      // NOTE: We DO NOT use response_format: { type: 'json_object' } here because many SiliconFlow models 
      // (like DeepSeek V3/R1) do not support it and return 400.
      // We rely on the prompts (which ask for JSON) and extractJson() to handle parsing.

      const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${safeKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          model: modelToUse, 
          messages, 
          stream: false, 
          // response_format: isJsonMode ? { type: 'json_object' } : undefined, // Removed to prevent 400 Error
          max_tokens: 4096 
        })
      });
      if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(`SiliconFlow API error: ${response.status} ${errData.message || ''}`);
      }
      const data = await response.json();
      const textResponse = data.choices[0].message.content;
      return isJsonMode ? extractJson(textResponse) : textResponse;
    }

    default:
    case 'gemini': {
      const apiKey = process.env.API_KEY || '';
      if (!apiKey) throw new Error("Gemini API Key missing (Environment Variable).");
      
      const ai = new GoogleGenAI({ apiKey });
      // Support model override for higher accuracy tasks
      const model = config?.model || 'gemini-3-flash-preview';
      const { model: _, ...genConfig } = config || {};
      
      try {
        // Use retryWithBackoff for robust network handling
        const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
          model: model,
          contents,
          config: { ...genConfig, systemInstruction },
        }));
        
        const textResponse = response.text || '';
        return isJsonMode ? extractJson(textResponse) : textResponse;
      } catch (e: any) {
        if (e.toString().includes("Rpc failed") || e.toString().includes("fetch failed") || e.toString().includes("NetworkError")) {
           throw new Error("Connection failed (RPC). If you are in a restricted region, please use VPN or switch to SiliconFlow/Ollama provider.");
        }
        throw e;
      }
    }
  }
};

export const parseFormFromDocument = async (base64Data: string, mimeType: string, settings: AppSettings): Promise<{title: string, description: string, fields: FormField[]}> => {
  const systemInstruction = `You are an Advanced Visual Document Intelligence Engine (vLLM).
  **CORE TASKS**:
  1. **Preprocessing Analysis**: Mentally perform binarization and deskewing to read the layout accurately.
  2. **Coordinate & Topology**: Analyze the spatial coordinates of text blocks to understand form structure (columns, rows, sections). Preserver the logical reading order.
  3. **Schema Extraction**: Reconstruct the form's logical schema into JSON.
  
  **OUTPUT JSON SCHEMA**:
  {
    "title": "Form Main Title",
    "description": "Brief description",
    "fields": [
      {
        "id": "gen_id_1",
        "label": "Field Label",
        "type": "text|textarea|date|number|section",
        "colSpan": 1-24 (width relative to a 24-col grid),
        "rowSpan": 1-10,
        "defaultValue": "Handwritten content or empty",
        "required": boolean,
        "readOnly": boolean,
        "hideLabel": boolean
      }
    ]
  }
  **RULES**: Sort fields by reading order (Top-Left to Bottom-Right). Return ONLY JSON.`;

  // --- SPECIAL HANDLING FOR OLLAMA (Text-Only) ---
  const isOllama = settings.aiProvider === 'ollama'; 
  // NOTE: SiliconFlow will auto-switch to Qwen-VL inside generateContentWithProvider, so we skip manual OCR for it.

  if (isOllama) {
      try {
          // Attempt OCR First
          const ocrText = await performGradioOCR(base64Data, mimeType);
          if (ocrText && ocrText.length > 50) {
              // OCR Successful, pass text to LLM
              const prompt = `Analyze this OCR result representing a form and convert it to the specified JSON schema. 
              
              OCR CONTENT:
              ${ocrText}
              
              ${systemInstruction}`;
              
              return JSON.parse(await generateContentWithProvider(settings, prompt, { responseMimeType: "application/json" }));
          }
      } catch (e) {
          console.warn("OCR Pre-processing failed, falling back...", e);
      }
  }

  // Standard VLM Logic (Gemini / Qwen-VL / SiliconFlow)
  const contents = { parts: [{ inlineData: { mimeType, data: base64Data } }, { text: "Extract form structure to JSON with high spatial accuracy." }] };
  const config = { responseMimeType: "application/json", model: 'gemini-3-pro-preview' };
  
  const res = await generateContentWithProvider(settings, contents, config, systemInstruction);
  try {
      return JSON.parse(res);
  } catch (e) {
      const cleanRes = extractJson(res);
      try { return JSON.parse(cleanRes); } catch (e2) { throw new Error("AI returned invalid JSON."); }
  }
};

export const parseFormFromExcelData = async (data: any[][], settings: AppSettings): Promise<{title: string, description: string, fields: FormField[]}> => {
  const prompt = `Execute Table Structure Analysis on this raw Excel data. 
  1. [Structure Prediction]: Identify headers vs data cells.
  2. [Cell Matching]: Map columns to field definitions.
  3. [Topology]: Detect logical row/column spans.
  4. [Output]: Convert to Form Template JSON with colSpan (1-24) and rowSpan.
  Data: ${JSON.stringify(data.slice(0, 10))}`;
  const res = await generateContentWithProvider(settings, prompt, { responseMimeType: "application/json" });
  try {
      return JSON.parse(res);
  } catch (e) {
      return { title: "New Form", description: "Parsed from Excel", fields: [] };
  }
};

export const parseAssetsFromImage = async (base64Data: string, mimeType: string, settings: AppSettings): Promise<Partial<AssetItem>[]> => {
  const systemInstruction = `You are an advanced document OCR and information extraction engine.
  Your task is to analyze the provided image, which could be an invoice, a list, or a photo of assets, and extract asset information into a structured JSON format.
  
  **Required Output Format**:
  Return a JSON array of objects. Each object represents one asset.
  
  **JSON Schema per Asset**:
  {
    "name": "string // The primary name of the asset",
    "brandModel": "string // Brand and model, if available",
    "price": "string // Price as a string, extract numbers only",
    "assetTag": "string // Asset tag/ID, if visible",
    "serialNumber": "string // Serial number, if visible",
    "purchaseDate": "string // Purchase date in YYYY-MM-DD format",
    "category": "IT | Furniture | Electronic | Consumables | Other"
  }

  **Extraction Rules**:
  1.  **High Accuracy**: Prioritize accuracy. If a field is not clearly visible, omit it or leave it as an empty string. Do not invent data.
  2.  **Table Recognition**: If the image contains a table, correctly associate columns with the corresponding fields.
  3.  **Date Formatting**: Normalize all extracted dates to 'YYYY-MM-DD' format.
  4.  **Price Cleaning**: Extract only the numerical value for the price, removing currency symbols or commas.
  5.  **Categorization**: Use your knowledge to assign the most appropriate category from the provided list.
  
  Return ONLY the JSON array. Do not include any other text, explanations, or markdown formatting.`;

  // Use a more powerful model for document analysis
  const config = { responseMimeType: "application/json", model: 'gemini-3-pro-preview' };
  const contents = {
    parts: [
      { inlineData: { mimeType: mimeType, data: base64Data } },
      { text: "Extract asset information from this document into the specified JSON format." }
    ]
  };

  const res = await generateContentWithProvider(settings, contents, config, systemInstruction);
  try {
    const parsed = JSON.parse(res);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("Failed to parse JSON from asset OCR:", res);
    throw new Error("AI returned invalid JSON for asset data.");
  }
};

export const parseAssetRequest = async (text: string, settings: AppSettings): Promise<Partial<AssetItem>[]> => {
    const systemInstruction = `You are a logistics assistant. Your task is to extract asset information from unstructured text.
  Return a JSON array of objects. Each object represents one asset.
  
  **JSON Schema per Asset**:
  {
    "name": "string // The primary name of the asset",
    "brandModel": "string // Brand and model, if available",
    "price": "string // Price as a string, extract numbers only",
    "category": "IT | Furniture | Electronic | Consumables | Other"
  }
  
  Analyze the user's request and structure the data accordingly. For example, "3台戴尔OptiPlex 7000台式机，每台5000元" should result in three separate items.
  
  Return ONLY the JSON array.`;
  const res = await generateContentWithProvider(settings, text, { responseMimeType: "application/json" }, systemInstruction);
  try { return JSON.parse(res); } catch { return []; }
};

export const generateChatResponse = async (
    settings: AppSettings, 
    prompt: string | { text: string, images: string[] }, 
    systemInstruction?: string
): Promise<string> => {
  let contents;
  
  if (typeof prompt === 'string') {
      contents = prompt;
  } else {
      // Structure it for generateContentWithProvider
      contents = {
          parts: [
              ...prompt.images.map(img => ({
                  inlineData: { mimeType: 'image/jpeg', data: img } // Assuming JPEG for simplicity, or we can pass mimeType
              })),
              { text: prompt.text }
          ]
      };
  }

  return generateContentWithProvider(settings, contents, {}, systemInstruction);
};

export const parseMeetingRequest = async (text: string, settings: AppSettings): Promise<any> => {
  const systemInstruction = `Extract meeting details. Return JSON: {"topic": "...", "date": "YYYY-MM-DD", "time": "HH:MM", "location": "...", "campus": "..."}`;
  const res = await generateContentWithProvider(settings, text, { responseMimeType: "application/json" }, systemInstruction);
  try { return JSON.parse(res); } catch { return null; }
};

export const translateParticipantInfo = async (p: Participant, settings: AppSettings): Promise<any> => {
  const prompt = `Translate to English JSON: {"nameEN": "...", "unitEN": "..."}. Source: ${p.nameCN} at ${p.unitCN}`;
  const res = await generateContentWithProvider(settings, prompt, { responseMimeType: "application/json" });
  try { return JSON.parse(res); } catch { return {}; }
};

export const parseParticipantsFromImage = async (base64Data: string, mimeType: string, settings: AppSettings): Promise<Partial<Participant>[]> => {
  const systemInstruction = `Advanced OCR & Table Extraction Engine.
  Task: Convert image of participant list to JSON.
  Output: [{"nameCN": "...", "nameEN": "...", "unitCN": "...", "unitEN": "...", "workIdOrPhone": "...", "isExternal": boolean}]`;
  
  const isOllama = settings.aiProvider === 'ollama'; 
  
  if (isOllama) {
      try {
          const ocrText = await performGradioOCR(base64Data, mimeType);
          if (ocrText) {
              const prompt = `Extract participants from OCR text: ${ocrText}. ${systemInstruction}`;
              return JSON.parse(await generateContentWithProvider(settings, prompt, { responseMimeType: "application/json" }));
          }
      } catch (e) {}
  }

  const res = await generateContentWithProvider(
      settings, 
      { parts: [{ inlineData: { mimeType: mimeType, data: base64Data } }, { text: "Extract names and units from this list." }] }, 
      { responseMimeType: "application/json", model: 'gemini-3-flash-preview' }, // Changed to Flash for better stability on OCR
      systemInstruction
  );
  try { return JSON.parse(res); } catch { return []; }
};

export const parseParticipantsFromText = async (text: string, settings: AppSettings): Promise<Partial<Participant>[]> => {
  const prompt = `Convert to JSON array: [{"nameCN": "...", "unitCN": "..."}]. Text: ${text}`;
  const res = await generateContentWithProvider(settings, prompt, { responseMimeType: "application/json" });
  try { return JSON.parse(res); } catch { return []; }
};

export const generateAgenda = async (topic: string, date: string, settings: AppSettings): Promise<AgendaItem[]> => {
  const prompt = `Generate meeting agenda for "${topic}" on ${date}. JSON array: [{"id": "1", "time": "09:00", "title": "Opening", "speaker": "Admin", "location": "Room 1"}]`;
  const res = await generateContentWithProvider(settings, prompt, { responseMimeType: "application/json" });
  try { return JSON.parse(res); } catch { return []; }
};

export const generateCardDesign = async (topic: string, settings: AppSettings): Promise<Partial<CardDesign>> => {
  const prompt = `Recommend colors for "${topic}". JSON: {"bgColor": "#hex", "fontColor": "#hex", "fontFamily": "font-serif-sc|font-sans-sc"}`;
  const res = await generateContentWithProvider(settings, prompt, { responseMimeType: "application/json" });
  try { return JSON.parse(res); } catch { return {}; }
};

export const generatePPTStructure = async (prompt: string, settings: AppSettings, example?: string): Promise<PPTSlide[]> => {
  const systemInstruction = `PPT designer. Return JSON array: [{"id": "1", "title": "...", "content": ["..."], "layout": "title|content|image_left"}]`;
  const userPrompt = `Topic: ${prompt}${example ? ` Context: ${example}` : ''}`;
  const res = await generateContentWithProvider(settings, userPrompt, { responseMimeType: "application/json" }, systemInstruction);
  try { return JSON.parse(res); } catch { return []; }
};

export const generateSlideImage = async (prompt: string, settings: AppSettings): Promise<string> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("Image generation requires Gemini API Key.");
  
  const ai = new GoogleGenAI({ apiKey });
  
  // Wrap image generation in retry block as well
  const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: prompt }] },
    config: { imageConfig: { aspectRatio: "16:9" } },
  }));
  
  const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
  return part?.inlineData?.data || '';
};
