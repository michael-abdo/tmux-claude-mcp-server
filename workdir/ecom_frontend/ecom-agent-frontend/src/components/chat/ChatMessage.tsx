import React from 'react';
import { Message } from '../../types/chat';
import { Bot, User } from 'lucide-react';
import { clsx } from 'clsx';

interface ChatMessageProps {
  message: Message;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isAgent = message.sender === 'agent';
  
  return (
    <div className={clsx('flex gap-3 p-4', isAgent ? 'bg-gray-50' : 'bg-white')}>
      <div className={clsx(
        'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
        isAgent ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-700'
      )}>
        {isAgent ? <Bot size={18} /> : <User size={18} />}
      </div>
      
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm">
            {isAgent ? 'EcomAgent' : 'You'}
          </span>
          <span className="text-xs text-gray-500">
            {message.timestamp.toLocaleTimeString()}
          </span>
        </div>
        
        <div className="text-gray-800">{message.content}</div>
        
        {message.executionSteps && message.executionSteps.length > 0 && (
          <div className="mt-3 space-y-2">
            {message.executionSteps.map((step) => (
              <div key={step.id} className="flex items-center gap-2 text-sm">
                <div className={clsx(
                  'w-2 h-2 rounded-full',
                  {
                    'bg-gray-400': step.status === 'pending',
                    'bg-blue-500 animate-pulse': step.status === 'in-progress',
                    'bg-green-500': step.status === 'completed',
                    'bg-red-500': step.status === 'error',
                  }
                )} />
                <span className="text-gray-700">{step.action}</span>
                {step.details && (
                  <span className="text-gray-500">- {step.details}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};