# OCR Server

OCR Server, using Apple's Vision Framework API.

![image](image.jpg)

## How to use

1. Launch the app and the server will start automatically
2. Access the displayed IP address from any device on the same network
3. Upload images to get text recognition results
4. Can also be integrated into your applications via API interface
  ```
  curl -H "Accept: application/json" \
    -X POST http://<YOUR IP>:8000/upload \
    -F "file=@01.png"
  ```


## Features

- Upload images through a web page and return the OCR results
- Provide an upload API that returns OCR results in JSON format


## Use cases

- Building an OCR cluster using iPhones


## License

MIT License
