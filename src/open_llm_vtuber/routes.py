import json
import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from loguru import logger

from .service_context import ServiceContext
from .youtube.youtube_chat_service import YouTubeChatService
from .conversation import conversation_chain, handle_youtube_chat

# Store active connections
active_connections = {}

async def cleanup_connection(websocket: WebSocket):
    """Cleanup connection and associated resources"""
    client_id = id(websocket)
    if client_id in active_connections:
        youtube_service = active_connections[client_id].get('youtube_service')
        if youtube_service:
            youtube_service.stop()
        task = active_connections[client_id].get('task')
        if task:
            task.cancel()
        del active_connections[client_id]
    logger.info(f"Cleaned up connection {client_id}")

async def websocket_endpoint(websocket: WebSocket, service_context: ServiceContext):
    client_id = id(websocket)
    
    # Cleanup any existing connection with same ID
    await cleanup_connection(websocket)
    
    try:
        await websocket.accept()
        logger.info(f"WebSocket connection established (ID: {client_id})")
        
        # Store connection info
        active_connections[client_id] = {
            'websocket': websocket,
            'youtube_service': None,
            'task': None
        }
        
        # Send initial Live2D config
        live2d_config = service_context.get_live2d_config()
        await websocket.send_text(json.dumps({
            "type": "set-model-and-conf",
            "model_info": live2d_config,
            "conf_name": live2d_config["name"],
            "conf_uid": "default"
        }))
        logger.info(f"Sent Live2D config: {live2d_config}")
        
        # Send connection established message
        await websocket.send_text(json.dumps({
            "type": "full-text",
            "text": "Connection established"
        }))

        # Wait for frontend ready signal with timeout
        try:
            logger.info("Waiting for frontend ready signal...")
            message = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
            data = json.loads(message)
            
            if data.get("type") == "frontend-ready":
                logger.info("Frontend is ready, starting YouTube chat monitoring...")
                
                # Start YouTube chat monitoring
                youtube_service = YouTubeChatService(video_id="eETR3Q4ZMB0")
                active_connections[client_id]['youtube_service'] = youtube_service
                
                # Create task for YouTube chat monitoring
                youtube_task = asyncio.create_task(handle_youtube_chat(
                    youtube_service=youtube_service,
                    agent_engine=service_context.agent_engine,
                    websocket_send=websocket.send_text
                ))
                active_connections[client_id]['task'] = youtube_task

                # Keep receiving WebSocket messages while YouTube task runs
                try:
                    while True:
                        if not youtube_service.is_active():
                            logger.info("YouTube service stopped, ending WebSocket connection")
                            break
                            
                        try:
                            message = await asyncio.wait_for(websocket.receive_text(), timeout=1.0)
                            data = json.loads(message)
                            logger.info(f"Received WebSocket message: {data}")
                            
                            # Handle any additional WebSocket messages here
                            
                        except asyncio.TimeoutError:
                            # Timeout is expected, just continue the loop
                            continue
                        except WebSocketDisconnect:
                            logger.info("WebSocket disconnected")
                            break
                        
                finally:
                    # Cleanup if loop breaks
                    if not youtube_task.done():
                        youtube_task.cancel()
                        try:
                            await youtube_task
                        except asyncio.CancelledError:
                            pass
            else:
                logger.warning(f"Received unexpected message type: {data.get('type')}")
                
        except asyncio.TimeoutError:
            logger.warning("Timeout waiting for frontend ready signal")
        except WebSocketDisconnect:
            logger.info("WebSocket disconnected while waiting for frontend ready")
        except Exception as e:
            logger.error(f"Error in WebSocket handling: {e}")
                    
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected during initialization (ID: {client_id})")
    except Exception as e:
        logger.error(f"Failed to establish WebSocket connection: {e}")
    finally:
        # Always cleanup properly
        try:
            await websocket.send_text(json.dumps({
                "type": "control",
                "text": "stop-audio"
            }))
        except:
            pass
        await cleanup_connection(websocket)
        logger.info(f"WebSocket connection closed (ID: {client_id})")

def create_routes() -> APIRouter:
    router = APIRouter()
    service_context = ServiceContext()
    
    @router.websocket("/client-ws")
    async def websocket(websocket: WebSocket):
        await websocket_endpoint(websocket, service_context)
  
    return router
  