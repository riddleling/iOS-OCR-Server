# OCR Server

將您的 iPhone 變成強大的本機 OCR 伺服器，採用 Apple 的 Vision Framework 技術。
無需雲端依賴，無限制使用，完全隱私保護。

[從 App Store 下載](https://apps.apple.com/us/app/ocr-server/id6749533041)

[English](README.md) | [日本語](README.ja.md) | **繁體中文** | [简体中文](README.zh-CN.md)

![image](image.jpg)

## 使用方法

1. 啟動應用程式，伺服器將自動啟動
2. 從同一網路上的任何裝置存取顯示的 IP 位址
3. 上傳圖像即可獲得文字辨識結果
4. 透過 API 將服務整合到您的應用程式中

- **OCR 測試：在您的電腦上開啟網頁瀏覽器，瀏覽應用程式顯示的 IP 位址來執行 OCR 測試。**

![image2](image2.png)

- **API 範例 - 透過 `upload` API 上傳圖像：**

  ```
  curl -H "Accept: application/json" \
    -X POST http://<您的IP>:8000/upload \
    -F "file=@01.png"
  ```

- **Python 上傳範例：**

  ```python
  import requests

  url = "http://10.0.1.11:8000/upload"  # 替換為您的 IP 位址
  file_path = "01.png"

  with open(file_path, "rb") as f:
      files = {"file": f}
      headers = {"Accept": "application/json"}
      response = requests.post(url, files=files, headers=headers)

  print("status code:", response.status_code)
  print("response:", response.text)
  ```


## 功能特色

- 採用 Apple Vision Framework 的高精度 OCR
- 支援多語言自動偵測
- 透過網頁介面上傳並在數秒內獲得 OCR 結果
- JSON API 便於整合到應用程式中
- 100% 本機處理，無雲端依賴，完全隱私保護


## 使用場景

- 無需雲端服務的本機 OCR
- 在同一網路內的裝置間共享 OCR 服務
- 使用多台 iPhone 建構 OCR 處理叢集
