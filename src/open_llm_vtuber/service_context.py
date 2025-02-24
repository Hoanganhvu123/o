import os
import json
from pathlib import Path
from typing import Optional, Dict, Any
import time

from loguru import logger
from fastapi import WebSocket

from .live2d_model import Live2dModel
from .agent.agent_factory import AgentFactory

from .config_manager import (
    Config,
    CharacterConfig,
    SystemConfig,
    TTSConfig,
    read_yaml,
    validate_config,
)


class ServiceContext:
    """Initializes, stores, and updates the tts, and llm instances and other
    configurations for a connected client."""

    def __init__(self):
        self.live2d_model = None
        self.tts_engine = None
        self.agent_engine = None
        self.is_speaking = False
        self.current_audio_end = 0
        self.expressions_config = self._load_expressions_config()
        
        # Initialize components
        self.init_live2d()
        self.init_agent()
        
    def _load_expressions_config(self) -> Dict[str, Any]:
        """Load expressions and animations config from JSON file"""
        try:
            config_path = Path(__file__).parent / "expressions_config.json"
            with open(config_path, "r") as f:
                config = json.load(f)
            logger.info("Loaded expressions config successfully")
            return config
        except Exception as e:
            logger.error(f"Failed to load expressions config: {e}")
            return {}
            
    def init_live2d(self):
        """Initialize Live2D model with hardcoded settings"""
        model_name = "shizuku"
        
        # Verify model path exists
        model_dir = Path(os.getcwd()) / "live2d-models" / model_name
        model_file = model_dir / "shizuku.model.json"
        
        if not model_dir.exists():
            logger.warning(f"Live2D model directory not found at: {model_dir}")
        if not model_file.exists():
            logger.warning(f"Live2D model file not found at: {model_file}")
        else:
            logger.info(f"Found Live2D model at: {model_file}")
            
        # Get model-specific mappings from config
        model_config = self.expressions_config.get(model_name, {})
        expressions = model_config.get("expressions", {})
        animations = model_config.get("animations", {})
            
        # Essential Live2D model settings
        self.live2d_model = {
            "name": model_name,
            "url": f"/live2d-models/{model_name}/shizuku.model.json",
            "scale": 1.2,
            "kScale": 1.2,
            "initialXshift": 0,
            "initialYshift": -0.1,
            "idleMotionGroupName": animations.get("idle", {}).get("group", "idle"),
            "defaultEmotion": "idle",
            "emotionMap": expressions,
            "motionMap": animations,
            "pointerInteractive": True,
            "scrollToResize": True,
            "tapMotions": {
                "tap_body": {"weight": 1},
                "tap_head": {"weight": 1}
            }
        }
        logger.info(f"Initialized Live2D model config: {json.dumps(self.live2d_model, indent=2)}")
        return self.live2d_model

    def get_live2d_config(self):
        """Get Live2D configuration"""
        if not self.live2d_model:
            self.init_live2d()
        return self.live2d_model

    def init_agent(self):
        """Initialize agent with ollama"""
        try:
            self.agent_engine = AgentFactory.create_agent()
            logger.info("Agent initialized with ollama")
        except Exception as e:
            logger.error(f"Failed to initialize agent: {e}")

    def is_audio_playing(self) -> bool:
        """Check if audio is currently playing"""
        return time.time() < self.current_audio_end

    def __str__(self):
        return (
            f"ServiceContext:\n"
            f"  Live2D Model: {json.dumps(self.live2d_model, indent=2) if self.live2d_model else 'Not Loaded'}\n"
            f"  TTS Engine: {type(self.tts_engine).__name__ if self.tts_engine else 'Not Loaded'}\n"
            f"  Agent Engine: {type(self.agent_engine).__name__ if self.agent_engine else 'Not Loaded'}\n"
            f"  Is Speaking: {self.is_speaking}"
        )
    # ==== Initializers

    def load_cache(
        self,
        config: Config,
        system_config: SystemConfig,
        character_config: CharacterConfig,
        live2d_model: Live2dModel,
        agent_engine,
    ) -> None:
        """
        Load the ServiceContext with the reference of the provided instances.
        Pass by reference so no reinitialization will be done.
        """
        if not character_config:
            raise ValueError("character_config cannot be None")
        if not system_config:
            raise ValueError("system_config cannot be None")

        self.config = config
        self.system_config = system_config
        self.character_config = character_config
        self.live2d_model = live2d_model
        self.agent_engine = agent_engine

        logger.debug(f"Loaded service context with cache: {character_config}")

    def load_from_config(self, config: Config) -> None:
        """
        Load the ServiceContext with the config.
        Reinitialize the instances if the config is different.

        Parameters:
        - config (Dict): The configuration dictionary.
        """
        if not self.config:
            self.config = config

        if not self.system_config:
            self.system_config = config.system_config

        if not self.character_config:
            self.character_config = config.character_config

        # update all sub-configs

        # init live2d from character config
        self.init_live2d()



        # init agent from character config
        self.init_agent()

        # store typed config references
        self.config = config
        self.system_config = config.system_config
        self.character_config = config.character_config

    # ==== utils

    async def handle_config_switch(
        self,
        websocket: WebSocket,
        config_file_name: str,
    ) -> None:
        """
        Handle the configuration switch request.
        Change the configuration to a new config and notify the client.

        Parameters:
        - websocket (WebSocket): The WebSocket connection.
        - config_file_name (str): The name of the configuration file.
        """
        try:
            new_character_config_data = None

            if config_file_name == "conf.yaml":
                # Load base config
                new_character_config_data = read_yaml("conf.yaml").get(
                    "character_config"
                )
            else:
                # Load alternative config and merge with base config
                characters_dir = self.system_config.config_alts_dir
                file_path = os.path.normpath(
                    os.path.join(characters_dir, config_file_name)
                )
                if not file_path.startswith(characters_dir):
                    raise ValueError("Invalid configuration file path")

                alt_config_data = read_yaml(file_path).get("character_config")

                # Start with original config data and perform a deep merge
                new_character_config_data = deep_merge(
                    self.config.character_config.model_dump(), alt_config_data
                )

            if new_character_config_data:
                new_config = {
                    "system_config": self.system_config.model_dump(),
                    "character_config": new_character_config_data,
                }
                new_config = validate_config(new_config)
                self.load_from_config(new_config)
                logger.debug(f"New config: {self}")
                logger.debug(
                    f"New character config: {self.character_config.model_dump()}"
                )

                # Send responses to client
                await websocket.send_text(
                    json.dumps(
                        {
                            "type": "set-model-and-conf",
                            "model_info": self.live2d_model.model_info,
                            "conf_name": self.character_config.conf_name,
                            "conf_uid": self.character_config.conf_uid,
                        }
                    )
                )

                await websocket.send_text(
                    json.dumps(
                        {
                            "type": "config-switched",
                            "message": f"Switched to config: {config_file_name}",
                        }
                    )
                )

                logger.info(f"Configuration switched to {config_file_name}")
            else:
                raise ValueError(
                    f"Failed to load configuration from {config_file_name}"
                )

        except Exception as e:
            logger.error(f"Error switching configuration: {e}")
            logger.debug(self)
            await websocket.send_text(
                json.dumps(
                    {
                        "type": "error",
                        "message": f"Error switching configuration: {str(e)}",
                    }
                )
            )
            raise e


def deep_merge(dict1, dict2):
    """
    Recursively merges dict2 into dict1, prioritizing values from dict2.
    """
    result = dict1.copy()
    for key, value in dict2.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = deep_merge(result[key], value)
        else:
            result[key] = value
    return result

