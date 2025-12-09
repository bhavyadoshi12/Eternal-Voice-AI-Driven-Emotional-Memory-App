#!/usr/bin/env python3
"""
Eternal Voice - Desktop Application Entry Point
Robust version: auto-kills port, safe threading
"""

import webview
import threading
import time
import sys
import os
from pathlib import Path
import uvicorn
import signal
import requests
import traceback
from backend.settings import settings


class EternalVoiceApp:
    def __init__(self):
        self.server_started = False
        self.url = f"http://{settings.HOST}:{settings.PORT}"
        self.server_thread = None

        # Ensure port is free before starting
        self.free_port(settings.PORT)

    # -----------------------------------------------------------
    # FREE PORT IF IN USE
    # -----------------------------------------------------------
    @staticmethod
    def free_port(port):
        """Kill any process currently using the given port (Windows only)"""
        try:
            import subprocess
            result = subprocess.run(
                f"netstat -ano | findstr :{port}",
                shell=True,
                capture_output=True,
                text=True
            )
            lines = result.stdout.strip().splitlines()
            for line in lines:
                parts = line.split()
                if len(parts) >= 5 and parts[1].endswith(f":{port}"):
                    pid = parts[-1]
                    print(f"⚠️  Killing process {pid} on port {port}")
                    os.system(f"taskkill /F /PID {pid}")
        except Exception as e:
            print(f"⚠️  Failed to free port {port}: {e}")

    # -----------------------------------------------------------
    # RUN FASTAPI SERVER
    # -----------------------------------------------------------
    def run_server(self):
        """Run the FastAPI server in a separate thread (no reload)"""
        try:
            print(f"🌐 Starting server on {self.url}")
            uvicorn.run(
                "backend.server:app",
                host=settings.HOST,
                port=settings.PORT,
                log_level="info" if settings.DEBUG else "warning",
                access_log=True,
                reload=False  # 🔹 Must be False in a thread
            )
            self.server_started = True
        except Exception as e:
            print(f"❌ Server error: {e}")
            traceback.print_exc()  # <--- ADD THIS LINE HERE
            self.server_started = False
    # -----------------------------------------------------------
    # CHECK SERVER HEALTH
    # -----------------------------------------------------------
    def check_server_health(self, max_retries: int = 30) -> bool:
        print("🔄 Waiting for server to start...", end="")
        for i in range(max_retries):
            try:
                response = requests.get(f"{self.url}/api/health", timeout=2)
                if response.status_code == 200:
                    print(" ✅ Server is healthy!")
                    return True
            except:
                pass
            if i < max_retries - 1:
                time.sleep(1)
                print(".", end="", flush=True)
        print(" ❌")
        return False

    # -----------------------------------------------------------
    # INITIALIZATION
    # -----------------------------------------------------------
    def initialize_application(self):
        try:
            self.create_directories()
            self.initialize_database()
            self.preload_models()
            print("✅ Application initialization complete!")
        except Exception as e:
            print(f"❌ Initialization failed: {e}")
            return False
        return True

    def create_directories(self):
        directories = [
            settings.UPLOAD_DIR,
            settings.PROCESSED_DIR,
            settings.GENERATED_DIR,
            settings.UPLOAD_DIR / "audio",
            settings.UPLOAD_DIR / "images",
            settings.UPLOAD_DIR / "text",
            settings.GENERATED_DIR / "tts",
            settings.GENERATED_DIR / "chats",
            Path("data/logs")
        ]
        for directory in directories:
            directory.mkdir(parents=True, exist_ok=True)
            print(f"📁 Created directory: {directory}")

    def initialize_database(self):
        try:
            from backend.database import init_db
            init_db()
            print("✅ Database initialized successfully!")
        except Exception as e:
            print(f"❌ Database initialization failed: {e}")
            raise

    def preload_models(self):
        try:
            if not settings.OPENAI_API_KEY:
                print("🔶 OpenAI API key not set - AI features limited")
            else:
                print("🔶 OpenAI API key detected - AI features enabled")
            if hasattr(settings, 'WHISPER_MODEL') and settings.WHISPER_MODEL:
                print("🔶 Whisper model will load on first use")
        except Exception as e:
            print(f"⚠️  Model preloading failed: {e}")

    # -----------------------------------------------------------
    # START DESKTOP APPLICATION
    # -----------------------------------------------------------
    def start_desktop_app(self):
        print("🚀 Starting Eternal Voice Desktop Application...")
        print(f"📁 Project root: {Path(__file__).parent}")
        print(f"🔧 Mode: {'Development' if settings.DEBUG else 'Production'}")

        if not self.initialize_application():
            print("❌ Startup aborted due to initialization failure")
            return

        # Start server thread
        self.server_thread = threading.Thread(target=self.run_server, daemon=True)
        self.server_thread.start()

        # Wait for server health
        if not self.check_server_health():
            print("❌ Server failed to start")
            return

        self.launch_desktop_window()

    # -----------------------------------------------------------
    # LAUNCH DESKTOP WINDOW
    # -----------------------------------------------------------
    def launch_desktop_window(self):
        try:
            print("🎉 Server running successfully!")
            window = webview.create_window(
                title=f"Eternal Voice - {settings.APP_VERSION}",
                url=self.url,
                width=1400,
                height=900,
                min_size=(1024, 768),
                resizable=True,
                text_select=True,
                background_color='#FFFFFF'
            )

            # Load icon if exists
            icon_path = Path("web/static/assets/images/logo.png")
            if icon_path.exists():
                try:
                    window.set_icon(str(icon_path))
                except:
                    pass

            webview.start(debug=settings.DEBUG, http_server=False)

        except Exception as e:
            print(f"❌ Failed to launch window: {e}")
            print("💡 You can still access the app in browser:")
            print(self.url)

    # -----------------------------------------------------------
    # SHUTDOWN
    # -----------------------------------------------------------
    def shutdown(self):
        print("\n👋 Shutting down Eternal Voice...")
        # Cleanup tasks here


# -----------------------------------------------------------
# MAIN ENTRY POINT
# -----------------------------------------------------------
def main():
    app = None
    try:
        app = EternalVoiceApp()
        app.start_desktop_app()

    except KeyboardInterrupt:
        print("\n👋 Application closed by user")

    except Exception as e:
        import traceback
        print(f"❌ Fatal error: {e}")
        traceback.print_exc()

    finally:
        if app:
            app.shutdown()

    sys.exit(0)


if __name__ == "__main__":
    main()
