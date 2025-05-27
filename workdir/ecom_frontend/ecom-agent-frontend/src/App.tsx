import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ChatContainer } from './components/chat/ChatContainer';
import { useChat } from './hooks/useChat';

const queryClient = new QueryClient();

function AppContent() {
  const { messages, isAgentTyping, sendMessage } = useChat();

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl h-[80vh] md:h-[600px]">
        <ChatContainer 
          messages={messages}
          onSendMessage={sendMessage}
          isAgentTyping={isAgentTyping}
        />
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default App
