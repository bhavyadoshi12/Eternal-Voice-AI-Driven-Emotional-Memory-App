#!/usr/bin/env python3
"""
Environment Setup Script for Eternal Voice
Run this script to set up the development environment
"""

import os
import sys
import subprocess
import platform
from pathlib import Path

def print_step(step, message):
    """Print a step with nice formatting"""
    print(f"\n{'='*50}")
    print(f"STEP {step}: {message}")
    print(f"{'='*50}")

def run_command(command, check=True):
    """Run a shell command and handle errors"""
    try:
        result = subprocess.run(command, shell=True, check=check, capture_output=True, text=True)
        return result
    except subprocess.CalledProcessError as e:
        print(f"❌ Command failed: {command}")
        print(f"Error: {e.stderr}")
        return None

def check_python_version():
    """Check if Python version is compatible"""
    print_step(1, "Checking Python Version")
    
    version = platform.python_version()
    print(f"Python version: {version}")
    
    major, minor, _ = version.split('.')
    if int(major) < 3 or (int(major) == 3 and int(minor) < 8):
        print("❌ Python 3.8 or higher is required")
        sys.exit(1)
    
    print("✅ Python version is compatible")

def install_dependencies():
    """Install required Python packages"""
    print_step(2, "Installing Dependencies")
    
    # Check if requirements.txt exists
    requirements_file = Path("requirements.txt")
    if not requirements_file.exists():
        print("❌ requirements.txt not found")
        sys.exit(1)
    
    print("Installing Python packages...")
    result = run_command("pip install -r requirements.txt")
    
    if result and result.returncode == 0:
        print("✅ Dependencies installed successfully")
    else:
        print("❌ Failed to install dependencies")
        sys.exit(1)

def create_directories():
    """Create necessary directories"""
    print_step(3, "Creating Directory Structure")
    
    directories = [
        "data/uploads/raw",
        "data/uploads/audio", 
        "data/uploads/text",
        "data/uploads/images",
        "data/processed/transcripts",
        "data/processed/personas",
        "data/processed/temp",
        "data/generated/tts",
        "data/generated/chats",
        "data/logs",
        "research/evaluation/test_data",
        "research/evaluation/results",
        "research/documentation/workflow_diagrams",
        "research/documentation/api_docs"
    ]
    
    for directory in directories:
        path = Path(directory)
        path.mkdir(parents=True, exist_ok=True)
        print(f"📁 Created: {directory}")

def setup_environment_file():
    """Create environment configuration file"""
    print_step(4, "Setting Up Environment Configuration")
    
    env_sample = Path("config.env.sample")
    env_file = Path(".env")
    
    if not env_sample.exists():
        print("❌ config.env.sample not found")
        sys.exit(1)
    
    if env_file.exists():
        print("ℹ️  .env file already exists")
        return
    
    # Copy sample to .env
    with open(env_sample, 'r') as sample:
        content = sample.read()
    
    with open(env_file, 'w') as env:
        env.write(content)
    
    print("✅ Created .env file from template")
    print("📝 Please edit .env file with your configuration values")

def initialize_database():
    """Initialize the SQLite database"""
    print_step(5, "Initializing Database")
    
    try:
        # Add project root to Python path
        project_root = Path(__file__).parent.parent
        sys.path.insert(0, str(project_root))
        
        from backend.database import init_db
        init_db()
        print("✅ Database initialized successfully")
        
    except Exception as e:
        print(f"❌ Database initialization failed: {e}")
        sys.exit(1)

def download_ai_models():
    """Download required AI models"""
    print_step(6, "Downloading AI Models")
    
    try:
        # This would download Whisper models and other required AI models
        print("🔶 AI models will be downloaded on first use")
        print("💡 For offline use, run: python scripts/download_models.py")
        
    except Exception as e:
        print(f"⚠️  Model download note: {e}")

def verify_setup():
    """Verify the setup is complete"""
    print_step(7, "Verifying Setup")
    
    checks = [
        ("Python Dependencies", Path("venv").exists() or check_pip_packages()),
        ("Directory Structure", Path("data/uploads").exists()),
        ("Environment File", Path(".env").exists()),
        ("Database", Path("data/db.sqlite3").exists()),
        ("Configuration", check_configuration())
    ]
    
    all_passed = True
    
    for check_name, check_result in checks:
        if check_result:
            print(f"✅ {check_name}")
        else:
            print(f"❌ {check_name}")
            all_passed = False
    
    if all_passed:
        print("\n🎉 Setup completed successfully!")
        print("\nNext steps:")
        print("1. Edit .env file with your OpenAI API key and other settings")
        print("2. Run: python app.py")
        print("3. Open your browser to http://localhost:8000")
    else:
        print("\n⚠️  Setup completed with warnings")
        print("Some features might not work properly")

def check_pip_packages():
    """Check if required packages are installed"""
    try:
        import fastapi
        import sqlalchemy
        import openai
        return True
    except ImportError:
        return False

def check_configuration():
    """Check basic configuration"""
    try:
        from backend.settings import settings
        return True
    except Exception:
        return False

def main():
    """Main setup function"""
    print("🚀 Eternal Voice - Environment Setup")
    print("This script will set up your development environment\n")
    
    try:
        check_python_version()
        install_dependencies()
        create_directories()
        setup_environment_file()
        initialize_database()
        download_ai_models()
        verify_setup()
        
    except KeyboardInterrupt:
        print("\n\n❌ Setup interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Setup failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()