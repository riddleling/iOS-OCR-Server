# OCR Server

Apple の Vision Framework を使用して iPhone を強力なローカル OCR サーバーに変身させます。
クラウドへの依存なし、無制限利用、完全なプライバシー保護。

[App Store からダウンロード](https://apps.apple.com/us/app/ocr-server/id6749533041)

[English](README.md) | **日本語** | [繁體中文](README.zh-TW.md) | [简体中文](README.zh-CN.md)

![image](image.jpg)

## 使用方法

1. アプリを起動すると、サーバーが自動的に開始されます
2. 同じネットワーク上の任意のデバイスから表示された IP アドレスにアクセス
3. 画像をアップロードしてテキスト認識結果を取得
4. API 経由でサービスをアプリケーションに統合

- **OCR テスト：コンピューターでウェブブラウザーを開き、アプリに表示された IP アドレスにアクセスして OCR テストを実行します。**

![image2](image2.png)

- **API の例：`upload` API 経由で画像をアップロード：**

  ```
  curl -H "Accept: application/json" \
    -X POST http://<あなたのIP>:8000/upload \
    -F "file=@01.png"
  ```

- **Python アップロードの例：**

  ```python
  import requests

  url = "http://10.0.1.11:8000/upload"  # あなたの IP アドレスに置き換えてください
  file_path = "01.png"

  with open(file_path, "rb") as f:
      files = {"file": f}
      headers = {"Accept": "application/json"}
      response = requests.post(url, files=files, headers=headers)

  print("status code:", response.status_code)
  print("response:", response.text)
  ```


## 機能

- Apple の Vision Framework による高精度 OCR
- 自動検出による多言語サポート
- ウェブインターフェース経由でアップロードし、数秒で OCR 結果を取得
- アプリへの簡単統合のための JSON API
- 100% ローカル処理、クラウドなし、完全なプライバシー保護


## 使用シーン

- クラウドサービスなしのローカル OCR
- 同じネットワーク内のデバイス間での OCR サービス共有
- 複数の iPhone を使用した OCR 処理クラスターの構築
