import json
import asyncio
from concurrent.futures import ThreadPoolExecutor
from loguru import logger
from openai import OpenAI

class SimpleAgent:
    """Simple agent that handles chat with OpenAI"""
    def __init__(self):
        """Initialize OpenAI client"""
        self.executor = ThreadPoolExecutor(max_workers=1)
        # API key should be loaded from environment variable or config file
        self.client = OpenAI()
        logger.info("Initialized SimpleAgent")

    def _call_openai(self, messages):
        """Call OpenAI API"""
        try:
            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=messages,
                temperature=0.7,
                max_tokens=800,
                top_p=0.95,
                frequency_penalty=0,
                presence_penalty=0
            )
            return response
        except Exception as e:
            logger.error(f"OpenAI API error: {e}")
            raise

    async def chat(self, user_input: str):
        """Chat with OpenAI and return response with actions"""
        try:
            logger.info(f"Processing chat input: {user_input}")

            # Split username and message
            try:
                username, message = user_input.split(":", 1)
                formatted_input = f"Người xem '{username.strip()}' nhắn: {message.strip()}"
            except ValueError:
                formatted_input = user_input
                logger.warning("Input not in username:message format, using as is")

            response = await asyncio.get_event_loop().run_in_executor(
                self.executor,
                self._call_openai,
                [
                    {
                        "role": "system", 
                        "content": """You are a cute and friendly VTuber. Your responses should be:
                        1. Natural and conversational
                        2. Show personality and emotion
                        3. Engage with viewers
                        4. Keep responses concise (1-2 sentences)
                        5. Use appropriate expressions and motions
                        
                        Response format:
                        {
                            "text": "What you want to say",
                            "expression": "happy/sad/angry/surprised",
                            "motion": "idle/wave/nod/shake"
                        }
                        """
                    },
                    {"role": "user", "content": formatted_input}
                ]
            )
            
            # Parse OpenAI response
            content = json.loads(response.choices[0].message.content)
            logger.info(f"Got response: {content}")

            # Format response for frontend
            response_payload = {
                "type": "audio-and-expression",
                "text": content["text"],
                "actions": {
                    "expression": content["expression"],
                    "motion": content["motion"]
                }
            }
            logger.debug(f"Formatted response payload: {response_payload}")

            yield response_payload

        except Exception as e:
            logger.error(f"Error in chat: {e}")
            yield {
                "type": "audio-and-expression", 
                "text": "Xin lỗi, có lỗi xảy ra rồi ạ",
                "actions": {
                    "expression": "sad",
                    "motion": "shake"
                }
            }

    def set_memory_from_history(self, **kwargs):
        """Required by interface"""
        pass 