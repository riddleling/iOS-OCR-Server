# OCR Server

Turn your iPhone into a powerful local OCR server using Apple's Vision Framework. 
No cloud dependencies, unlimited usage, complete privacy.

Download from the [App Store](https://apps.apple.com/us/app/ocr-server/id6749533041)

![image](image.jpg)

## How to use

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

- Upload images through a web interface to instantly get OCR results
- Provide an upload API that returns OCR results in JSON format


## Use cases

- Build an OCR processing cluster using multiple iPhones
