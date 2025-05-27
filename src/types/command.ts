export interface Command {
  id: string;
  text: string;
  timestamp: Date;
  type: CommandType;
  intent: CommandIntent;
  entities: CommandEntity[];
  context?: CommandContext;
  response?: CommandResponse;
  status: CommandStatus;
}

export interface CommandEntity {
  type: EntityType;
  value: string;
  confidence: number;
  metadata?: Record<string, any>;
}

export interface CommandContext {
  previousCommands: string[];
  currentView?: string;
  selectedItems?: string[];
  filters?: Record<string, any>;
  timeRange?: {
    start: Date;
    end: Date;
  };
}

export interface CommandResponse {
  type: ResponseType;
  data: any;
  message?: string;
  suggestions?: string[];
  actions?: CommandAction[];
  visualization?: VisualizationType;
}

export interface CommandAction {
  id: string;
  label: string;
  type: ActionType;
  params?: Record<string, any>;
  confirmation?: boolean;
}

export type CommandType = 
  | 'query'
  | 'action'
  | 'navigation'
  | 'configuration'
  | 'help';

export type CommandIntent = 
  | 'show_metrics'
  | 'list_products'
  | 'find_customers'
  | 'update_inventory'
  | 'create_campaign'
  | 'analyze_sales'
  | 'generate_report'
  | 'check_integrations'
  | 'configure_settings'
  | 'get_help';

export type EntityType = 
  | 'date_range'
  | 'metric_type'
  | 'product_name'
  | 'product_category'
  | 'customer_segment'
  | 'integration_platform'
  | 'number'
  | 'currency'
  | 'percentage'
  | 'location';

export type ResponseType = 
  | 'data'
  | 'chart'
  | 'table'
  | 'list'
  | 'confirmation'
  | 'error'
  | 'help';

export type ActionType = 
  | 'navigate'
  | 'filter'
  | 'sort'
  | 'export'
  | 'update'
  | 'create'
  | 'delete'
  | 'sync';

export type VisualizationType = 
  | 'line_chart'
  | 'bar_chart'
  | 'pie_chart'
  | 'table'
  | 'metric_cards'
  | 'heatmap'
  | 'timeline';

export type CommandStatus = 
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed';

export interface CommandSuggestion {
  text: string;
  category: CommandIntent;
  examples: string[];
}

export interface CommandHistory {
  commands: Command[];
  favorites: string[];
  recentContexts: CommandContext[];
}