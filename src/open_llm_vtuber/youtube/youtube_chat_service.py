import pytchat
import asyncio
from loguru import logger

class YouTubeChatService:
    def __init__(self, video_id: str):
        """
        Initialize YouTube chat service with video ID
        """
        self.video_id = video_id
        self.chat = None
        self.is_running = True
        self.batch_size = 3  # Luôn lấy 3 tin nhắn gần nhất
        self.connect()
        logger.info(f"Created YouTube chat service for video: {video_id}")

    def connect(self):
        """Create new chat connection"""
        try:
            self.chat = pytchat.create(video_id=self.video_id)
            if not self.chat.is_alive():
                logger.error(f"Failed to initialize chat for video {self.video_id}")
            else:
                logger.info("YouTube chat connection is alive")
        except Exception as e:
            logger.error(f"Error creating chat connection: {e}")

    async def listen(self):
        """
        Listen for chat messages and return 3 most recent messages
        """
        logger.info("Starting YouTube chat listener...")
        
        while self.is_running:
            try:
                if not self.chat or not self.chat.is_alive():
                    logger.warning("Chat connection dead, attempting to reconnect...")
                    self.connect()
                    await asyncio.sleep(1)
                    continue

                chat_data = self.chat.get()
                if chat_data:
                    # Lấy tin nhắn từ pytchat
                    messages = []
                    for chat_item in chat_data.sync_items():
                        messages.append(f"{chat_item.author.name}: {chat_item.message}")
                    
                    if messages:
                        # Chỉ lấy 3 tin nhắn mới nhất
                        latest_messages = messages[-self.batch_size:]
                        grouped_message = "\n".join(latest_messages)
                        logger.info(f"Processing {len(latest_messages)} latest messages")
                        yield grouped_message

                await asyncio.sleep(0.1)
                
            except Exception as e:
                logger.error(f"Error in chat listener: {e}")
                if self.is_running:
                    self.connect()
                    await asyncio.sleep(1)
                    continue

    def is_active(self):
        """Check if chat is still active"""
        return self.is_running and (self.chat and self.chat.is_alive())

    def stop(self):
        """Stop the chat listener"""
        self.is_running = False
        if self.chat:
            self.chat.terminate()
            logger.info("YouTube chat listener stopped") 