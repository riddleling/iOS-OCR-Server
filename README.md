# OCR Server

Turn your iPhone into a powerful local OCR server using Apple's Vision Framework. 
No cloud dependencies, unlimited usage, complete privacy.

Download from the [App Store](https://apps.apple.com/us/app/ocr-server/id6749533041)

![image](image.jpg)

## How to Use

1. Launch the app and the server will start automatically
2. Access the displayed IP address from any device on the same network
3. Upload images to get text recognition results
4. Integrate the service into your applications via API

- **OCR Test: On your computer, open a web browser and navigate to the IP address displayed by the app to perform an OCR test.**

![image2](image2.png)

- **API Example: Upload an image via `upload` API:**

  ```
  curl -H "Accept: application/json" \
    -X POST http://<YOUR IP>:8000/upload \
    -F "file=@01.png"
  ```

- **Python Upload Example:**

  ```python
  import requests

  url = "http://10.0.1.11:8000/upload"  # Replace with your IP address
  file_path = "01.png"

  with open(file_path, "rb") as f:
      files = {"file": f}
      headers = {"Accept": "application/json"}
      response = requests.post(url, files=files, headers=headers)

  print("status code:", response.status_code)
  print("response:", response.text)
  ```


## Features

- High-precision OCR powered by Apple’s Vision Framework
- Supports multiple languages with automatic detection
- Upload via web interface and receive OCR results within seconds
- JSON API for easy integration into apps
- 100% local processing, no cloud, full privacy


## Use Cases

- Local OCR without cloud services
- Share OCR services across devices in the same network
- Build an OCR processing cluster using multiple iPhones
