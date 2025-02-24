/* eslint-disable react/require-default-props */
import { Box, Text } from '@chakra-ui/react';
import {
  memo, useEffect, useRef, useCallback,
} from 'react';
import ChatBubble from './chat-bubble';
import { sidebarStyles } from './sidebar-styles';
import { useChatHistoryPanel } from '@/hooks/sidebar/use-chat-history-panel';
import { Message } from '@/services/websocket-service';

// Type definitions
interface MessageListProps {
  messages: Message[]
  messageListRef: React.RefObject<HTMLDivElement>
  onMessageUpdate?: (message: Message) => void
}

interface EmptyStateProps {
  message: string
}

// Reusable components
function EmptyState({ message }: EmptyStateProps): JSX.Element {
  return (
    <Box
      height="100%"
      display="flex"
      alignItems="center"
      justifyContent="center"
      color="whiteAlpha.500"
    >
      <Text fontSize="sm">{message}</Text>
    </Box>
  );
}

// Memoized message list component with scroll handling
const MessageList = memo(({ messages, messageListRef, onMessageUpdate }: MessageListProps): JSX.Element => {
  const lastMessageRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (messageListRef.current) {
      const { scrollHeight } = messageListRef.current;
      const height = messageListRef.current.clientHeight;
      const maxScrollTop = scrollHeight - height;

      messageListRef.current.scrollTo({
        top: maxScrollTop + 100,
        behavior: 'smooth',
      });
    }
  }, [messageListRef]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  return (
    <Box {...sidebarStyles.chatHistoryPanel.messageList} ref={messageListRef}>
      {messages.map((message, index) => (
        <Box
          key={`${message.role}-${message.timestamp}-${message.id}`}
          ref={index === messages.length - 1 ? lastMessageRef : null}
        >
          <ChatBubble
            message={message}
            onUpdate={() => {
              if (onMessageUpdate) onMessageUpdate(message);
              scrollToBottom();
            }}
          />
        </Box>
      ))}
    </Box>
  );
});

MessageList.displayName = 'MessageList';

// Main component
function ChatHistoryPanel(): JSX.Element {
  const { messages, messageListRef, handleMessageUpdate } = useChatHistoryPanel();

  return (
    <Box {...sidebarStyles.chatHistoryPanel.container}>
      <Text {...sidebarStyles.chatHistoryPanel.title}>Chat History</Text>
      {messages.length === 0 ? (
        <EmptyState message="No messages yet. Start a conversation!" />
      ) : (
        <MessageList
          messages={messages}
          messageListRef={messageListRef}
          onMessageUpdate={handleMessageUpdate}
        />
      )}
    </Box>
  );
}

export default ChatHistoryPanel;
