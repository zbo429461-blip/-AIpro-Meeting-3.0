
// ... (imports remain the same)
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { AppSettings, Participant, AgendaItem, CardDesign, PPTSlide, FormField, AssetItem, KnowledgeGraphData } from "../types";
// @ts-ignore
import * as gradio from "@gradio/client";

// --- Helper Functions ---

export const extractJson = (text: string): any => {
  try {
    // 1. Try direct parse
    return JSON.parse(text);
  } catch (e) {
    // 2. Try markdown block
    const match = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (match) {
      try { return JSON.parse(match[1]); } catch (e2) {}
    }
    // 3. Try finding array or object boundaries
    const startObj = text.indexOf('{');
    const endObj = text.lastIndexOf('}');
    if (startObj !== -1 && endObj !== -1) {
        try { return JSON.parse(text.substring(startObj, endObj + 1)); } catch (e3) {}
    }
    const startArr = text.indexOf('[');
    const endArr = text.lastIndexOf(']');
    if (startArr !== -1 && endArr !== -1) {
        try { return JSON.parse(text.substring(startArr, endArr + 1)); } catch (e4) {}
    }
    // Return raw text if strict JSON parsing fails, or empty object/array depending on context? 
    // Throwing error is safer so caller handles it.
    throw new Error("Could not extract JSON from response");
  }
};

export const base64ToBlob = (base64: string, mimeType: string) => {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
};

export const fetchSiliconFlowModels = async (apiKey: string): Promise<string[]> => {
    if (!apiKey) return [];
    try {
        const response = await fetch('https://api.siliconflow.cn/v1/models', {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        if (!response.ok) return [];
        const data = await response.json();
        // Filter for chat/instruct models
        return data.data
            .filter((m: any) => m.id.toLowerCase().includes('chat') || m.id.toLowerCase().includes('instruct'))
            .map((m: any) => m.id);
    } catch (e) {
        console.warn("Failed to fetch SiliconFlow models", e);
        return [];
    }
};

export const performGradioOCR = async (base64Data: string, mimeType: string): Promise<string> => {
    try {
        // @ts-ignore
        const ClientConstructor = gradio.Client || (gradio.default && gradio.default.Client) || gradio.default;
        if (!ClientConstructor) return "";
        const client = await ClientConstructor.connect("erow/OCR-DEMO");
        const blob = base64ToBlob(base64Data, mimeType);
        const result = await client.predict("/partial", [blob, "Base"]);
        return result.data?.[0] || "";
    } catch (e) {
        console.warn("Gradio OCR Error:", e);
        return "";
    }
};

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

// Helper: Retry operation for transient network errors (RPC/Fetch)
async function retryWithBackoff<T>(operation: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
    try {
        return await operation();
    } catch (error: any) {
        const msg = (error.message || error.toString()).toLowerCase();
        if (retries > 0 && (
            msg.includes("rpc") || 
            msg.includes("fetch") || 
            msg.includes("network") || 
            msg.includes("aborted") ||
            msg.includes("load failed") ||
            msg.includes("503") || 
            msg.includes("504") || 
            msg.includes("429") ||
            error instanceof TypeError 
        )) {
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
        userContent = contents.parts.map((part: any) => {
          if (part.text) return { type: 'text', text: part.text };
          if (part.inlineData) {
            return { 
                type: 'image_url', 
                image_url: { 
                    url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` 
                } 
            };
          }
          return null;
        }).filter(Boolean);
      }
      messages.push({ role: 'user', content: userContent });

      let modelToUse = settings.siliconFlowModel || 'deepseek-ai/DeepSeek-V3';
      const hasImage = Array.isArray(userContent) && userContent.some((c:any) => c.type === 'image_url');
      
      if (hasImage) {
          if (!modelToUse.includes('VL') || modelToUse.includes('DeepSeek')) {
               modelToUse = 'Qwen/Qwen2.5-VL-72B-Instruct'; 
          }
      }

      const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${safeKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          model: modelToUse, 
          messages, 
          stream: false, 
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
      const model = config?.model || 'gemini-3-flash-preview';
      const { model: _, ...genConfig } = config || {};
      
      try {
        const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
          model: model,
          contents,
          config: { ...genConfig, systemInstruction },
        }));
        
        const textResponse = response.text || '';
        return isJsonMode ? extractJson(textResponse) : textResponse;
      } catch (e: any) {
        const msg = (e.message || e.toString()).toLowerCase();
        if (msg.includes("rpc") || msg.includes("fetch failed") || msg.includes("networkerror") || msg.includes("failed to fetch")) {
           throw new Error("Google Gemini Connection Failed (RPC/Network). Please ensure you have a valid VPN/Proxy connected if you are in a restricted region, or check your internet connection.");
        }
        if (msg.includes("403") || msg.includes("permission denied")) {
            throw new Error("Gemini API Key Permission Denied. Please check your API Key status in Google AI Studio.");
        }
        if (msg.includes("400") || msg.includes("invalid argument")) {
            throw new Error("Gemini API Invalid Request. Please check your inputs.");
        }
        throw e;
      }
    }
  }
};

// ... (Existing export functions) ...
export const parseFormFromDocument = async (base64Data: string, mimeType: string, settings: AppSettings): Promise<{title: string, description: string, fields: FormField[]}> => {
  const systemInstruction = `You are an Expert Visual Document Understanding (VDU) Engine specializing in Form Digitization.
  **MISSION**: Analyze the document image and reconstruct its exact logical structure into a JSON schema.`;

  const isOllama = settings.aiProvider === 'ollama'; 

  if (isOllama) {
      try {
          const ocrText = await performGradioOCR(base64Data, mimeType);
          if (ocrText && ocrText.length > 50) {
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

  const contents = { 
      parts: [
          { inlineData: { mimeType, data: base64Data } }, 
          { text: "Analyze the document image. Extract fields, detect tables, and recognize handwriting. Map to the 24-column grid as specified." }
      ] 
  };
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
  Data: ${JSON.stringify(data.slice(0, 10))}`;
  const res = await generateContentWithProvider(settings, prompt, { responseMimeType: "application/json" });
  try {
      return JSON.parse(res);
  } catch (e) {
      return { title: "New Form", description: "Parsed from Excel", fields: [] };
  }
};

export const parseAssetsFromImage = async (base64Data: string, mimeType: string, settings: AppSettings): Promise<Partial<AssetItem>[]> => {
  const systemInstruction = `You are an advanced document OCR and information extraction engine. Return JSON array.`;
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
    throw new Error("AI returned invalid JSON for asset data.");
  }
};

export const parseAssetRequest = async (text: string, settings: AppSettings): Promise<Partial<AssetItem>[]> => {
    const systemInstruction = `You are a logistics assistant. Extract asset information. Return JSON array.`;
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
      contents = {
          parts: [
              ...prompt.images.map(img => ({
                  inlineData: { mimeType: 'image/jpeg', data: img }
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
  const systemInstruction = `Advanced OCR & Table Extraction Engine. Return JSON array of participants.`;
  
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
      { responseMimeType: "application/json", model: 'gemini-3-flash-preview' }, 
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
  
  const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: prompt }] },
    config: { imageConfig: { aspectRatio: "16:9" } },
  }));
  
  const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
  return part?.inlineData?.data || '';
};

// --- RAG & Knowledge Graph Implementation (LangGraph-inspired) ---

/**
 * Text Splitter Logic (Recursive Character Splitter Approximation)
 */
const splitTextIntoChunks = (text: string, chunkSize: number = 1000, chunkOverlap: number = 200): string[] => {
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
        const end = Math.min(start + chunkSize, text.length);
        chunks.push(text.slice(start, end));
        start += chunkSize - chunkOverlap;
    }
    return chunks;
};

/**
 * Graph RAG Engine: Simulates LangGraph nodes and edges for Knowledge Base
 */
export class GraphRAGEngine {
    private settings: AppSettings;
    private state: {
        documents: string[];
        chunks: string[];
        graph: KnowledgeGraphData;
        query: string;
        context: string;
        answer: string;
    };

    constructor(settings: AppSettings) {
        this.settings = settings;
        this.state = { documents: [], chunks: [], graph: { nodes: [], links: [] }, query: "", context: "", answer: "" };
    }

    // Node 1: Document Loader & Splitter
    public processDocuments(rawTexts: string[]) {
        this.state.documents = rawTexts;
        // Simple chunking strategy
        this.state.chunks = rawTexts.flatMap(text => splitTextIntoChunks(text));
        return this.state.chunks;
    }

    // Node 2: Knowledge Graph Builder (LLM Extractor)
    public async buildGraph(): Promise<KnowledgeGraphData> {
        const context = this.state.chunks.slice(0, 10).join("\n\n"); // Limit context for graph building to avoid overload
        const systemInstruction = `You are a Knowledge Graph extraction system.
        Analyze the text and extract core entities and relationships.
        Return JSON format: { "nodes": [{"id": "...", "label": "...", "category": "..."}], "links": [{"source": "...", "target": "...", "relation": "..."}] }
        Limit to top 30 most important nodes.`;
        
        try {
            const res = await generateContentWithProvider(this.settings, `Context:\n${context}`, { responseMimeType: "application/json" }, systemInstruction);
            this.state.graph = JSON.parse(res);
            return this.state.graph;
        } catch (e) {
            console.error("Graph build error", e);
            return { nodes: [], links: [] };
        }
    }

    // Node 3: Retriever (Hybrid: Keyword + Graph)
    public async retrieve(query: string): Promise<string> {
        this.state.query = query;
        // Simple keyword match from chunks
        const keywords = query.split(' ').filter(w => w.length > 1);
        const relevantChunks = this.state.chunks.filter(chunk => 
            keywords.some(kw => chunk.includes(kw))
        ).slice(0, 5); // Top 5 chunks

        // Graph retrieval (Simulated: find nodes mentioned in query)
        const relevantNodes = this.state.graph.nodes.filter(n => query.includes(n.label));
        const graphContext = relevantNodes.map(n => 
            `Entity: ${n.label} (${n.category}) is related to: ` + 
            this.state.graph.links.filter(l => l.source === n.id).map(l => `${l.target} via ${l.relation}`).join(", ")
        ).join("\n");

        this.state.context = `Graph Insights:\n${graphContext}\n\nDocument Excerpts:\n${relevantChunks.join("\n---\n")}`;
        return this.state.context;
    }

    // Node 4: Generator
    public async generateAnswer(): Promise<string> {
        const systemInstruction = `You are a RAG Assistant. Answer based on the provided Context. If unknown, say "I don't know".`;
        const prompt = `Context:\n${this.state.context}\n\nQuestion: ${this.state.query}`;
        this.state.answer = await generateContentWithProvider(this.settings, prompt, {}, systemInstruction);
        return this.state.answer;
    }
}

// Wrappers for component consumption
export const analyzeKnowledgeGraph = async (textContext: string, settings: AppSettings): Promise<KnowledgeGraphData> => {
    const engine = new GraphRAGEngine(settings);
    engine.processDocuments([textContext]);
    return await engine.buildGraph();
};

export const queryKnowledgeBase = async (query: string, context: string, settings: AppSettings): Promise<string> => {
    // We treat 'context' here as the raw text corpus passed from the view
    const engine = new GraphRAGEngine(settings);
    engine.processDocuments([context]);
    await engine.retrieve(query);
    return await engine.generateAnswer();
};
