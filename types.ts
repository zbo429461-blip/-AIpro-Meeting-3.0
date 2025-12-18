
export interface Participant {
  id: string;
  isExternal: boolean;
  workIdOrPhone: string;
  nameCN: string;
  nameEN: string;
  unitCN: string;
  unitEN: string;
  isSignedIn?: boolean; 
  signInTime?: number;
}

export interface AgendaItem {
  id: string;
  time: string;
  title: string;
  speaker: string;
  location: string;
}

export interface MeetingBasicInfo {
  date: string;
  location: string;
  hostId: string; 
  topic: string;
}

export interface MeetingFile {
  id: string;
  name: string;
  size: string;
  type: string;
  category: 'presentation' | 'document' | 'image' | 'other';
  uploadDate: string;
  url?: string; // Added for Object URL
}

export interface CardDesign {
  templateId: 'classic' | 'modern' | 'bordered' | 'minimal';
  bgType: 'solid' | 'gradient';
  bgColor: string;
  gradientStart?: string;
  gradientEnd?: string;
  gradientDir?: string;
  bgImage?: string;
  
  fontColor: string;
  fontFamily: string;
  fontSizeScale: number; 
  
  // Logo
  logo?: string; 
  logoX: number; // Percentage 0-100
  logoY: number; // Percentage 0-100
  logoSize: number; // px width

  // New: Independent Positioning
  nameY: number; // Offset in px
  unitY: number; // Offset in px
  nameScale: number;
  unitScale: number;

  showLine?: boolean;
  lineColor?: string;
  
  contentMode: 'name_unit' | 'name_only';
}

// The master object for a single meeting
export interface Meeting {
  id: string;
  info: MeetingBasicInfo;
  participants: Participant[];
  agenda: AgendaItem[];
  files: MeetingFile[];
  cardDesign?: CardDesign; // Each meeting can have its own design
  createdAt: number;
}

export interface AppSettings {
  aiProvider: 'gemini' | 'ollama' | 'siliconflow';
  geminiKey: string;
  ollamaUrl: string;
  ollamaModel: string;
  siliconFlowKey: string;
  knowledgeBase?: string; // New: Personal style/knowledge base
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export enum View {
  MEETING_LIST = 'MEETING_LIST', // New Home View
  DASHBOARD = 'DASHBOARD',
  ASSISTANT = 'ASSISTANT', 
  PARTICIPANTS = 'PARTICIPANTS',
  AGENDA = 'AGENDA',
  TABLE_CARDS = 'TABLE_CARDS',
  SIGN_IN = 'SIGN_IN', 
  FILES = 'FILES',
  SETTINGS = 'SETTINGS',
}