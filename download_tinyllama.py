import os
import time
import urllib.request
import ssl

url = "https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf"
file_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models", "tinyllama", "tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf")

EXPECTED_SIZE = 668788096

def download():
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    
    # Delete if exists and wrong size
    if os.path.exists(file_path):
        current_size = os.path.getsize(file_path)
        if current_size == EXPECTED_SIZE:
            print(f"File already complete ({current_size} bytes)")
            return True
        else:
            print(f"Existing file is {current_size} bytes, expected {EXPECTED_SIZE}. Deleting...")
            os.remove(file_path)
    
    ctx = ssl.create_default_context()
    
    for attempt in range(5):
        try:
            file_size = 0
            if os.path.exists(file_path):
                file_size = os.path.getsize(file_path)
                if file_size >= EXPECTED_SIZE:
                    print("Download complete!")
                    return True
            
            req = urllib.request.Request(url)
            if file_size > 0:
                req.add_header("Range", f"bytes={file_size}-")
                print(f"Attempt {attempt+1}: Resuming from {file_size / (1024*1024):.1f} MB...")
            else:
                print(f"Attempt {attempt+1}: Starting fresh download...")
            
            with urllib.request.urlopen(req, context=ctx, timeout=60) as response:
                mode = 'ab' if file_size > 0 else 'wb'
                with open(file_path, mode) as f:
                    downloaded = file_size
                    last_print = time.time()
                    while True:
                        chunk = response.read(65536)
                        if not chunk:
                            break
                        f.write(chunk)
                        downloaded += len(chunk)
                        
                        now = time.time()
                        if now - last_print > 5:
                            pct = (downloaded / EXPECTED_SIZE) * 100
                            print(f"  {pct:.1f}% ({downloaded / (1024*1024):.1f} MB / {EXPECTED_SIZE / (1024*1024):.1f} MB)")
                            last_print = now
            
            final_size = os.path.getsize(file_path)
            if final_size >= EXPECTED_SIZE:
                print(f"Download complete! Final size: {final_size} bytes")
                return True
            else:
                print(f"Download incomplete ({final_size} bytes), retrying...")
                
        except Exception as e:
            print(f"Error: {e}")
        
        print("Waiting 3 seconds before retry...")
        time.sleep(3)
    
    print("Failed after 5 attempts")
    return False

if __name__ == "__main__":
    download()
