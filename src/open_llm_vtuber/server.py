import os
import shutil
from pathlib import Path

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .routes import create_routes

class CustomStaticFiles(StaticFiles):
    async def get_response(self, path, scope):
        response = await super().get_response(path, scope)
        if path.endswith(".js"):
            response.headers["Content-Type"] = "application/javascript"
        return response


class WebSocketServer:
    def __init__(self):
        self.app = FastAPI()

        # Add CORS
        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

        # Get workspace root directory (where live2d-models is located)
        workspace_root = Path(os.getcwd())
        live2d_models_path = workspace_root / "live2d-models"
        backgrounds_path = workspace_root / "backgrounds"
        frontend_path = workspace_root / "frontend"

        # Include routes
        self.app.include_router(create_routes())

        # Mount static files with absolute paths
        self.app.mount(
            "/live2d-models",
            CustomStaticFiles(directory=str(live2d_models_path)),
            name="live2d-models",
        )
        self.app.mount(
            "/bg",
            StaticFiles(directory=str(backgrounds_path)),
            name="backgrounds",
        )
        self.app.mount(
            "/", CustomStaticFiles(directory=str(frontend_path), html=True), name="frontend"
        )

    def run(self):
        pass

    @staticmethod
    def clean_cache():
        """Clean the cache directory by removing and recreating it."""
        cache_dir = "./cache"
        if os.path.exists(cache_dir):
            shutil.rmtree(cache_dir)
            os.makedirs(cache_dir)
