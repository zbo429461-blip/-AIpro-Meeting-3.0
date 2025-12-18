
import { GoogleGenAI, Type } from "@google/genai";
import { AppSettings, Participant, AgendaItem, CardDesign } from "../types";

// Helper to get client instance safely
const getClient = (settingsKey?: string) => {
    const key = process.env.API_KEY || settingsKey;
    if (!key) {
        throw new Error("API Key not found. Please configure it in settings or environment.");
    }
    return new GoogleGenAI({ apiKey: key });
};

// ... (keep translateParticipantInfo, parseParticipantsFromText, parseParticipantsFromImage as they were) ...
export const translateParticipantInfo = async (
  participant: Participant,
  settings: AppSettings
): Promise<{ nameEN: string; unitEN: string }> => {
  try {
    const ai = getClient(settings.geminiKey);
    const prompt = `Translate Chinese name and Unit to English. Name CN: ${participant.nameCN}, Unit CN: ${participant.unitCN}. Return JSON { "nameEN": "...", "unitEN": "..." }`;
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json', responseSchema: { type: Type.OBJECT, properties: { nameEN: { type: Type.STRING }, unitEN: { type: Type.STRING } } } }
    });
    return JSON.parse(response.text || '{}');
  } catch (error) { return { nameEN: '', unitEN: '' }; }
};

export const parseParticipantsFromText = async (rawText: string, settings: AppSettings): Promise<Partial<Participant>[]> => {
  try {
    const ai = getClient(settings.geminiKey);
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Extract participants from text: "${rawText}". Return JSON array with keys: nameCN, unitCN, workIdOrPhone.`,
      config: { responseMimeType: 'application/json', responseSchema: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { nameCN: { type: Type.STRING }, unitCN: { type: Type.STRING }, workIdOrPhone: { type: Type.STRING } } } } }
    });
    return JSON.parse(response.text || '[]');
  } catch (error) { throw error; }
};

export const parseParticipantsFromImage = async (base64Image: string, settings: AppSettings): Promise<Partial<Participant>[]> => {
  try {
    const ai = getClient(settings.geminiKey);
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [{ inlineData: { mimeType: 'image/png', data: base64Image } }, { text: "Extract nameCN, unitCN, workIdOrPhone from image list. Return JSON array." }] },
      config: { responseMimeType: 'application/json', responseSchema: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { nameCN: { type: Type.STRING }, unitCN: { type: Type.STRING }, workIdOrPhone: { type: Type.STRING } } } } }
    });
    return JSON.parse(response.text || '[]');
  } catch (error) { throw error; }
};

// NEW: Parse Voice Command for Meeting Booking
export const parseMeetingRequest = async (transcript: string, settings: AppSettings) => {
    try {
        const ai = getClient(settings.geminiKey);
        const prompt = `
            Analyze this voice command for booking a meeting room at China University of Political Science and Law (CUPL).
            Command: "${transcript}"
            
            Extract:
            - campus: (e.g., "昌平校区" or "海淀校区")
            - location: (e.g., "主楼", "会议室名")
            - date: (YYYY-MM-DD format, assume current year 2025 if not specified)
            - time: (HH:MM format)
            - topic: (Meeting title)
            
            Return JSON.
        `;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        campus: { type: Type.STRING },
                        location: { type: Type.STRING },
                        date: { type: Type.STRING },
                        time: { type: Type.STRING },
                        topic: { type: Type.STRING }
                    }
                }
            }
        });
        
        return JSON.parse(response.text || '{}');
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
    const ai = getClient(settings.geminiKey);
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Create academic agenda for "${topic}" on ${date}. 5-8 items. Return JSON array {time, title, speaker, location}.`,
      config: { responseMimeType: 'application/json', responseSchema: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { time: { type: Type.STRING }, title: { type: Type.STRING }, speaker: { type: Type.STRING }, location: { type: Type.STRING } } } } }
    });
    const items = JSON.parse(response.text || '[]');
    return items.map((item: any, i: number) => ({ id: `gen-${Date.now()}-${i}`, ...item }));
  } catch (error) { throw error; }
};

export const generateCardDesign = async (topic: string, settings: AppSettings): Promise<Partial<CardDesign>> => {
    try {
        const ai = getClient(settings.geminiKey);
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Suggest color scheme for table card for topic "${topic}". Return JSON {bgColor, fontColor, fontFamily}.`,
            config: { responseMimeType: 'application/json', responseSchema: { type: Type.OBJECT, properties: { bgColor: { type: Type.STRING }, fontColor: { type: Type.STRING }, fontFamily: { type: Type.STRING } } } }
        });
        return JSON.parse(response.text || '{}');
    } catch (e) { return {}; }
}
