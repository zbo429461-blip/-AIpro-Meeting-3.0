
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

export interface CustomElement {
  id: string;
  type: 'text' | 'line';
  content?: string;
  x: number; // percentage
  y: number; // percentage
  color: string;
  fontSize?: number; // px
  width?: number; // px (for line thickness)
  length?: number; // px (for line length)
  rotation?: number;
  isBold?: boolean;
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
  
  customElements?: CustomElement[]; // New: Custom elements for free design
}

// PPT Slide Structure
export interface PPTSlide {
  id: string;
  title: string;
  content: string[]; // Bullet points
  speakerNotes?: string;
  backgroundImage?: string; // Base64 or URL
  layout: 'title' | 'content' | 'image_left' | 'image_right';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

// The master object for a single meeting
export interface Meeting {
  id: string;
  info: MeetingBasicInfo;
  participants: Participant[];
  agenda: AgendaItem[];
  files: MeetingFile[];
  cardDesign?: CardDesign; // Each meeting can have its own design
  pptSlides?: PPTSlide[]; // New: PPT Slides
  chatHistory?: ChatMessage[]; // New: Persist chat history per meeting
  createdAt: number;
}

export interface AppSettings {
  aiProvider: 'gemini' | 'ollama' | 'siliconflow';
  geminiKey: string;
  ollamaUrl: string;
  ollamaModel: string;
  siliconFlowKey: string;
  siliconFlowModel: string;
  knowledgeBase?: string; // New: Personal style/knowledge base
}

export enum View {
  MEETING_LIST = 'MEETING_LIST', // New Home View
  DASHBOARD = 'DASHBOARD',
  ASSISTANT = 'ASSISTANT', 
  PARTICIPANTS = 'PARTICIPANTS',
  AGENDA = 'AGENDA',
  TABLE_CARDS = 'TABLE_CARDS',
  PPT_CREATOR = 'PPT_CREATOR', // New View
  SIGN_IN = 'SIGN_IN', 
  FILES = 'FILES',
  SETTINGS = 'SETTINGS',
}