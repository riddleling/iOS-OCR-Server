# iOS OCR Server

## How to use

After launching the app, you can upload images from the home page or upload them via the `upload` API

```
curl -H "Accept: application/json" \
  -X POST http://<YOUR IP>:8000/upload \
  -F "file=@01.png"
```


## Features

- Upload images through a web page and return the OCR results
- Provide an upload API that returns OCR results in JSON format


## Use cases

- Build an OCR cluster using iPhones


## License

MIT License
