#!/usr/bin/env python3
"""
Update Anthropic library to fix Claude API issues
"""

import subprocess
import sys

def update_anthropic():
    """Update Anthropic library to latest version"""
    print("🔧 Updating Anthropic library...")
    
    try:
        # Uninstall old version
        print("Uninstalling old version...")
        result = subprocess.run([
            sys.executable, "-m", "pip", "uninstall", "anthropic", "-y"
        ], capture_output=True, text=True)
        
        if result.returncode == 0:
            print("✅ Old version uninstalled")
        else:
            print("⚠️  No old version to uninstall")
        
        # Install latest version
        print("Installing latest version...")
        result = subprocess.run([
            sys.executable, "-m", "pip", "install", "anthropic>=0.40.0"
        ], capture_output=True, text=True)
        
        if result.returncode == 0:
            print("✅ Latest Anthropic library installed")
            
            # Verify installation
            try:
                import anthropic
                print(f"✅ Verification successful - Version: {anthropic.__version__}")
                
                # Check if messages attribute is available
                client = anthropic.Anthropic(api_key="test")
                if hasattr(client, 'messages'):
                    print("✅ 'messages' attribute available")
                else:
                    print("❌ 'messages' attribute still not available")
                    
            except Exception as e:
                print(f"❌ Verification failed: {e}")
                
        else:
            print(f"❌ Installation failed: {result.stderr}")
            
    except Exception as e:
        print(f"❌ Update failed: {e}")

def main():
    print("🚀 Anthropic Library Update")
    print("=" * 30)
    
    update_anthropic()
    
    print("\n=" * 30)
    print("✅ Update complete!")
    print("\n📝 Next steps:")
    print("1. Run: python quick_test.py")
    print("2. If successful, restart your server")

if __name__ == "__main__":
    main()
