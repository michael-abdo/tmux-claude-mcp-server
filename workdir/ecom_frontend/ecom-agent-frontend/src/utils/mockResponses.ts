import { ExecutionStep } from '../types/chat';

interface AgentResponse {
  message: string;
  steps?: ExecutionStep[];
}

const generateStepId = () => `step-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const commandPatterns = {
  flashSale: /flash sale|discount|sale|offer/i,
  pauseAds: /pause.*ads|stop.*ads|suspend.*ads/i,
  emailCustomers: /email|send.*message|notify.*customers/i,
  updatePrices: /update.*price|change.*price|adjust.*price/i,
  analytics: /show.*analytics|sales.*report|performance/i,
  inventory: /inventory|stock|product.*count/i,
  integration: /connect|integrate|setup.*shopify|setup.*amazon/i,
};

const responses: Record<string, () => AgentResponse> = {
  flashSale: () => ({
    message: "I'll set up a flash sale with 20% off across your store. Let me configure this for you.",
    steps: [
      {
        id: generateStepId(),
        action: "Analyzing current product catalog",
        status: 'pending',
        timestamp: new Date()
      },
      {
        id: generateStepId(),
        action: "Creating discount code FLASH20",
        status: 'pending',
        timestamp: new Date()
      },
      {
        id: generateStepId(),
        action: "Updating product prices in Shopify",
        status: 'pending',
        timestamp: new Date()
      },
      {
        id: generateStepId(),
        action: "Scheduling promotional email to 5,234 customers",
        status: 'pending',
        timestamp: new Date()
      },
      {
        id: generateStepId(),
        action: "Activating sale banner on website",
        status: 'pending',
        timestamp: new Date()
      }
    ]
  }),
  
  pauseAds: () => ({
    message: "I'll pause the underperforming ad campaigns based on ROAS thresholds.",
    steps: [
      {
        id: generateStepId(),
        action: "Fetching ad performance data from Meta Ads",
        status: 'pending',
        timestamp: new Date()
      },
      {
        id: generateStepId(),
        action: "Analyzing 23 active campaigns",
        status: 'pending',
        timestamp: new Date()
      },
      {
        id: generateStepId(),
        action: "Identified 5 campaigns with ROAS < 1.5",
        status: 'pending',
        timestamp: new Date()
      },
      {
        id: generateStepId(),
        action: "Pausing low-performing campaigns",
        status: 'pending',
        timestamp: new Date()
      },
      {
        id: generateStepId(),
        action: "Generating performance report",
        status: 'pending',
        timestamp: new Date()
      }
    ]
  }),
  
  emailCustomers: () => ({
    message: "I'll prepare and send an email campaign to your customer segments.",
    steps: [
      {
        id: generateStepId(),
        action: "Segmenting customer database",
        status: 'pending',
        timestamp: new Date()
      },
      {
        id: generateStepId(),
        action: "Creating email template with Klaviyo",
        status: 'pending',
        timestamp: new Date()
      },
      {
        id: generateStepId(),
        action: "A/B testing subject lines",
        status: 'pending',
        timestamp: new Date()
      },
      {
        id: generateStepId(),
        action: "Scheduling email for optimal send time",
        status: 'pending',
        timestamp: new Date()
      }
    ]
  }),
  
  updatePrices: () => ({
    message: "I'll update product prices based on your requirements.",
    steps: [
      {
        id: generateStepId(),
        action: "Fetching current pricing data",
        status: 'pending',
        timestamp: new Date()
      },
      {
        id: generateStepId(),
        action: "Calculating new price points",
        status: 'pending',
        timestamp: new Date()
      },
      {
        id: generateStepId(),
        action: "Updating prices in Shopify",
        status: 'pending',
        timestamp: new Date()
      },
      {
        id: generateStepId(),
        action: "Syncing with Amazon listings",
        status: 'pending',
        timestamp: new Date()
      }
    ]
  }),
  
  analytics: () => ({
    message: "Here's your current sales performance overview:",
    steps: [
      {
        id: generateStepId(),
        action: "Fetching sales data from all channels",
        status: 'pending',
        timestamp: new Date()
      },
      {
        id: generateStepId(),
        action: "Calculating key metrics",
        status: 'pending',
        timestamp: new Date()
      },
      {
        id: generateStepId(),
        action: "Generating visual reports",
        status: 'pending',
        timestamp: new Date()
      }
    ]
  }),
  
  default: () => ({
    message: "I understand your request. Let me process that for you.",
    steps: [
      {
        id: generateStepId(),
        action: "Analyzing request",
        status: 'pending',
        timestamp: new Date()
      },
      {
        id: generateStepId(),
        action: "Preparing execution plan",
        status: 'pending',
        timestamp: new Date()
      },
      {
        id: generateStepId(),
        action: "Executing task",
        status: 'pending',
        timestamp: new Date()
      }
    ]
  })
};

export const mockAgentResponses = {
  getResponse: async (userMessage: string): Promise<AgentResponse> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Find matching pattern
    for (const [key, pattern] of Object.entries(commandPatterns)) {
      if (pattern.test(userMessage)) {
        return responses[key]();
      }
    }
    
    // Default response
    return responses.default();
  }
};