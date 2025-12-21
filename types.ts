
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
  url?: string; 
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface CustomElement {
  id: string;
  type: 'text' | 'line';
  x: number;
  y: number;
  color: string;
  content?: string;
  fontSize?: number;
  isBold?: boolean;
  width?: number;
  length?: number;
}

export interface CardDesign {
  templateId: 'classic' | 'modern' | 'bordered' | 'minimal';
  bgType: 'solid' | 'gradient';
  bgColor: string;
  gradientStart: string;
  gradientEnd: string;
  gradientDir: string;
  fontColor: string;
  fontFamily: string;
  fontSizeScale: number;
  logo: string;
  logoX: number;
  logoY: number;
  logoSize: number;
  nameY: number;
  unitY: number;
  nameScale: number;
  unitScale: number;
  showLine: boolean;
  lineColor: string;
  contentMode: 'name_unit' | 'name_only';
  customElements: CustomElement[];
  bgImage?: string;
}

export interface PPTSlide {
  id: string;
  title: string;
  content: string[];
  layout: 'title' | 'content' | 'image_left';
  speakerNotes?: string;
  backgroundImage?: string;
}

export interface Meeting {
  id: string;
  info: MeetingBasicInfo;
  participants: Participant[];
  agenda: AgendaItem[];
  files: MeetingFile[];
  pptSlides?: PPTSlide[]; 
  chatHistory?: ChatMessage[]; 
  createdAt: number;
}

export interface AppSettings {
  aiProvider: 'gemini' | 'ollama' | 'siliconflow';
  geminiKey: string;
  ollamaUrl: string;
  ollamaModel: string;
  siliconFlowKey: string;
  siliconFlowModel: string;
  knowledgeBase?: string; 
}

export type AssetStatus = 'idle' | 'in_use' | 'maintenance' | 'scrapped';
export type AssetCategory = 'IT' | 'Furniture' | 'Electronic' | 'Consumables' | 'Other';

export interface AssetLog {
  id: string;
  type: 'Maintenance' | 'Borrow' | 'Return' | 'Transfer' | 'Update';
  date: string;
  operator: string;
  notes: string;
}

export interface AssetItem {
  id: string;
  name: string;
  brandModel: string;
  price: string;
  location: string;
  assetTag: string;
  serialNumber?: string;
  status: AssetStatus;
  category: AssetCategory;
  purchaseDate: string;
  warrantyUntil?: string;
  remarks?: string;
  logs: AssetLog[];
}

export type TaskPriority = 'high' | 'medium' | 'low';
export type TaskStatus = 'todo' | 'doing' | 'done';

export interface DailyTask {
  id: string;
  title: string;
  time: string;
  priority: TaskPriority;
  status: TaskStatus;
  notes?: string;
}

export interface ProjectTask {
  id: string;
  title: string;
  assignee: string;
  startDate: string;
  endDate: string;
  status: 'todo' | 'in_progress' | 'review' | 'done';
}

export interface Project {
  id: string;
  name: string;
  description: string;
  manager: string;
  progress: number;
  status: 'active' | 'on_hold' | 'completed';
  tasks: ProjectTask[];
}

export interface FormField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'date' | 'select' | 'number';
  placeholder?: string;
  options?: string[];
  required?: boolean;
  colSpan?: number; // 1-24
}

export interface FormTemplate {
  id: string;
  title: string;
  description: string;
  category: 'HR' | 'Finance' | 'Admin' | 'Meeting' | 'Research';
  fields: FormField[];
  createdAt: number;
}

export interface FormSubmission {
  id: string;
  templateId: string;
  data: Record<string, string>;
  submittedAt: number;
  status: 'pending' | 'reviewing' | 'approved' | 'rejected';
  history: { status: string; time: number; note: string }[];
}

export enum View {
  HOME = 'HOME', 
  DAILY_SCHEDULE = 'DAILY_SCHEDULE',
  PROJECT_MANAGER = 'PROJECT_MANAGER',
  ASSET_MANAGER = 'ASSET_MANAGER', 
  FORMS = 'FORMS', 
  MEETING_LIST = 'MEETING_LIST',
  DASHBOARD = 'DASHBOARD',
  ASSISTANT = 'ASSISTANT', 
  PARTICIPANTS = 'PARTICIPANTS',
  AGENDA = 'AGENDA',
  TABLE_CARDS = 'TABLE_CARDS',
  PPT_CREATOR = 'PPT_CREATOR',
  SIGN_IN = 'SIGN_IN', 
  FILES = 'FILES',
  SETTINGS = 'SETTINGS',
}
