import { useState, useCallback } from 'react';
import { Message, ExecutionStep } from '../types/chat';
import { mockAgentResponses } from '../utils/mockResponses';

export const useChat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isAgentTyping, setIsAgentTyping] = useState(false);

  const generateMessageId = () => Date.now().toString();

  const sendMessage = useCallback(async (content: string) => {
    // Add user message
    const userMessage: Message = {
      id: generateMessageId(),
      content,
      sender: 'user',
      timestamp: new Date(),
      status: 'sent'
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsAgentTyping(true);

    // Simulate agent response delay
    setTimeout(async () => {
      const agentResponse = await mockAgentResponses.getResponse(content);
      
      const agentMessage: Message = {
        id: generateMessageId(),
        content: agentResponse.message,
        sender: 'agent',
        timestamp: new Date(),
        status: 'sent',
        executionSteps: agentResponse.steps
      };

      setMessages(prev => [...prev, agentMessage]);
      setIsAgentTyping(false);

      // Simulate execution steps
      if (agentResponse.steps && agentResponse.steps.length > 0) {
        simulateExecutionSteps(agentMessage.id, agentResponse.steps);
      }
    }, 1000 + Math.random() * 1000);
  }, []);

  const simulateExecutionSteps = (messageId: string, steps: ExecutionStep[]) => {
    steps.forEach((step, index) => {
      // Start step
      setTimeout(() => {
        setMessages(prev => prev.map(msg => {
          if (msg.id === messageId && msg.executionSteps) {
            const updatedSteps = [...msg.executionSteps];
            updatedSteps[index] = { ...updatedSteps[index], status: 'in-progress' };
            return { ...msg, executionSteps: updatedSteps };
          }
          return msg;
        }));
      }, 2000 + (index * 1500));

      // Complete step
      setTimeout(() => {
        setMessages(prev => prev.map(msg => {
          if (msg.id === messageId && msg.executionSteps) {
            const updatedSteps = [...msg.executionSteps];
            updatedSteps[index] = { ...updatedSteps[index], status: 'completed' };
            return { ...msg, executionSteps: updatedSteps };
          }
          return msg;
        }));
      }, 3000 + (index * 1500));
    });
  };

  return {
    messages,
    isAgentTyping,
    sendMessage
  };
};