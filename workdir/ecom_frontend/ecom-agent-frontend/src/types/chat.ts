export interface Message {
  id: string;
  content: string;
  sender: 'user' | 'agent';
  timestamp: Date;
  status?: 'sending' | 'sent' | 'error';
  executionSteps?: ExecutionStep[];
}

export interface ExecutionStep {
  id: string;
  action: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  details?: string;
  timestamp: Date;
}

export interface ChatState {
  messages: Message[];
  isAgentTyping: boolean;
  currentCommand?: string;
}