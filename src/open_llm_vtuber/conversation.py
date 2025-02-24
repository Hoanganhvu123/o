import asyncio
import json
import uuid
import os
from loguru import logger
import base64
from edge_tts import Communicate

async def conversation_chain(
    user_input: str,
    agent_engine,
    websocket_send,
):
    """Main conversation chain that handles:
    1. Agent response
    2. TTS
    3. Live2D animation
    """
    audio_file = None
    try:
        logger.info(f"Processing input: {user_input}")
        
        # 1. Get response & actions from agent
        async for response in agent_engine.chat(user_input):
            logger.info(f"Got agent response: {response}")
            
            response_text = response.get("text", "")
            if not response_text:
                logger.warning("Empty response from agent")
                continue

            # 2. Generate audio with edge-tts
            try:
                communicate = Communicate(response_text, "vi-VN-HoaiMyNeural")
                audio_file = f"temp_{uuid.uuid4()}.wav"
                logger.info(f"Generating audio to {audio_file}")
                await communicate.save(audio_file)
                
                # 3. Convert audio to base64
                with open(audio_file, "rb") as f:
                    audio_base64 = base64.b64encode(f.read()).decode()
                    logger.info("Audio converted to base64")

                # 4. Send payload to frontend
                payload = {
                    "type": "audio-and-expression",
                    "text": response_text,
                    "audio": audio_base64,
                    "actions": response.get("actions", {
                        "expression": "happy",
                        "motion": "idle"
                    })
                }
                logger.info(f"Sending payload to frontend: {payload['type']}, text length: {len(response_text)}, audio length: {len(audio_base64)}")
                await websocket_send(json.dumps(payload))
                logger.info("Payload sent successfully")

            except Exception as e:
                logger.error(f"Error in audio generation/sending: {e}")
                logger.exception(e)
            finally:
                # Cleanup temp audio file
                if audio_file and os.path.exists(audio_file):
                    os.remove(audio_file)
                    logger.debug(f"Cleaned up temp file: {audio_file}")
 
        return response_text

    except Exception as e:
        logger.error(f"Error in conversation chain: {e}")
        logger.exception(e)
        # Send error message to frontend
        try:
            await websocket_send(json.dumps({
                "type": "audio-and-expression",
                "text": "Sorry, I encountered an error processing your message.",
                "actions": {"expression": "sad"},
                "volumes": [],
                "slice_length": 0
            }))
        except:
            logger.error("Failed to send error message to frontend")
    finally:
        await websocket_send(json.dumps({
            "type": "control",
            "text": "conversation-chain-end"
        }))
        logger.info("Conversation chain completed")

async def handle_youtube_chat(
    youtube_service,
    agent_engine,
    websocket_send,
):
    """Handle YouTube chat messages"""
    logger.info("Starting YouTube chat handler...")
    try:
        async for message in youtube_service.listen():
            if not youtube_service.is_active():
                break
                
            try:
                await websocket_send(json.dumps({
                    "type": "control",
                    "text": "conversation-chain-start"
                }))
                
                await conversation_chain(
                    user_input=message,
                    agent_engine=agent_engine,
                    websocket_send=websocket_send
                )
                
            except Exception as e:
                logger.error(f"Error processing message: {e}")
                continue
                
    except Exception as e:
        logger.error(f"YouTube chat handler error: {e}")
        youtube_service.stop()
