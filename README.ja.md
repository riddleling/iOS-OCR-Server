# OCR Server

Apple の Vision Framework を使用して iPhone を強力なローカル OCR サーバーに変身させます。
クラウドへの依存なし、無制限利用、完全なプライバシー保護。

[App Store からダウンロード](https://apps.apple.com/us/app/ocr-server/id6749533041)

[English](README.md) | **日本語** | [繁體中文](README.zh-TW.md) | [简体中文](README.zh-CN.md) | [한국어](README.ko.md) | [Français](README.fr.md)

![image](image.jpg)

## 使用方法

1. アプリを起動すると、サーバーが自動的に開始されます
2. 同じネットワーク上の任意のデバイスから表示された IP アドレスにアクセス
3. 画像をアップロードしてテキスト認識結果を取得
4. API 経由でサービスをアプリケーションに統合
5. アプリが中断されることなく継続的に実行されるように、iOS [アクセスガイド](https://support.apple.com/ja-jp/111795)を有効にし、画面をオンに保ってください

- **OCR テスト：コンピューターでウェブブラウザーを開き、アプリに表示された IP アドレスにアクセスして OCR テストを実行します。**

![image2](image2.png)

- **API の例 - `upload` API 経由で画像をアップロード：**

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

- **JSON レスポンスは次のようになります：**

  ```json
  {
    "success": true,
    "message": "File uploaded successfully",
    "ocr_result": "Hello\nWorld",
    "image_height": 648,
    "image_width": 1247,
    "ocr_boxes": [
      {
        "text": "Hello",
        "x": 429.6554479416482,
        "y": 268.0000001076923,
        "w": 201.83814102564105,
        "h": 72,
        "rect": {
          "topLeft_x": 429.6554479416482,
          "topLeft_y": 268.0000001076923,
          "topRight_x": 631.4935889672893,
          "topRight_y": 268.0000001076923,
          "bottomRight_x": 631.4935889672893,
          "bottomRight_y": 340.0000001076923,
          "bottomLeft_x": 429.6554479416482,
          "bottomLeft_y": 340.0000001076923
        }
      },
      {
        "text": "World",
        "x": 421.6618595738782,
        "y": 417.99999971428576,
        "w": 251.79807692307696,
        "h": 80,
        "rect": {
          "topLeft_x": 421.6618595738782,
          "topLeft_y": 417.99999971428576,
          "topRight_x": 673.4599364969552,
          "topRight_y": 417.99999971428576,
          "bottomRight_x": 673.4599364969552,
          "bottomRight_y": 497.99999971428576,
          "bottomLeft_x": 421.6618595738782,
          "bottomLeft_y": 497.99999971428576
        }
      }
    ]
  }
  ```

  `image_width` と `image_height` は画像の幅と高さを表します（ピクセル単位）、
  `x` と `y` はテキストバウンディングボックスの左上角の原点を表します（ピクセル単位）、
  `w` と `h` はテキストバウンディングボックスの幅と高さを表します（ピクセル単位）、
  `rect` は、検出されたテキスト領域の4つの角の座標を提供し、元の向き（軸に整列していない状態）を保持します。

- **Python の例 – `ocr_boxes` 情報を使用してテキストバウンディングボックスを描画：**

  ```python
  #
  # pip3 install requests pillow opencv-python numpy
  #

  import os
  import sys
  import requests
  from PIL import Image, ImageDraw, ImageFont, ImageOps
  import numpy as np
  import cv2

  url = "http://10.0.1.11:8000/upload"  # Replace with your IP address
  file_path = "01.png"

  # ===== Select font (supports Chinese and English), font size auto-scales with box height =====
  def pick_font(box_h_px: float):
      font_candidates = [
          # macOS
          "/System/Library/Fonts/PingFang.ttc",
          "/System/Library/Fonts/STHeiti Light.ttc",
          # Windows
          r"C:\Windows\Fonts\msyh.ttc",
          r"C:\Windows\Fonts\msjh.ttc",
          r"C:\Windows\Fonts\arialuni.ttf",
          # Noto
          "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
          "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
      ]
      size = max(10, int(box_h_px * 0.25))  # Small font size = 25% of box height (minimum 10pt)
      for path in font_candidates:
          if os.path.exists(path):
              try:
                  return ImageFont.truetype(path, size=size)
              except Exception:
                  pass
      return ImageFont.load_default()

  # ===== Draw box and small text =====
  def draw_boxes(img_pil: Image.Image, boxes, line_thickness: int = 5) -> Image.Image:
      draw = ImageDraw.Draw(img_pil)
      for b in boxes:
          try:
              x = float(b["x"]); y = float(b["y"])
              w = float(b["w"]); h = float(b["h"])
              text = str(b.get("text", ""))
          except Exception:
              continue

          # Red bounding box
          x2, y2 = x + w, y + h
          draw.rectangle([x, y, x2, y2], outline=(255, 0, 0), width=line_thickness)

          # Top-right label
          font = pick_font(h)
          # Text size
          # textbbox returns (l, t, r, b)
          l, t, r, b = draw.textbbox((0, 0), text, font=font)
          tw, th = (r - l), (b - t)
          pad = max(2, int(h * 0.06))

          # Align label to top-right, not exceeding box or image edge
          tx = int(max(0, min(x2 - tw - pad, img_pil.width - tw - pad)))
          ty = int(max(0, min(y + pad, img_pil.height - th - pad)))

          # White background
          draw.rectangle([tx - pad, ty - pad, tx + tw + pad, ty + th + pad], fill=(255, 255, 255))
          draw.text((tx, ty), text, font=font, fill=(20, 20, 20))
      return img_pil

  def main():
      if not os.path.exists(file_path):
          print(f"[ERROR] Image not found: {file_path}", file=sys.stderr)
          sys.exit(1)

      # 1) Upload
      with open(file_path, "rb") as f:
          files = {"file": f}
          headers = {"Accept": "application/json"}
          try:
              response = requests.post(url, files=files, headers=headers, timeout=60)
          except requests.RequestException as e:
              print(f"[ERROR] Request failed: {e}", file=sys.stderr)
              sys.exit(2)

      print("status code:", response.status_code)

      # 2) Check HTTP and JSON
      if response.status_code != 200:
          print("response:", response.text[:500])
          sys.exit(3)

      try:
          data = response.json()
      except ValueError:
          print("[ERROR] Not JSON response")
          print("response:", response.text[:500])
          sys.exit(4)

      if not data.get("success", False):
          print("[ERROR] Server returned failure:", data)
          sys.exit(5)

      print("response ok")

      # 3) Load original image (using PIL)
      img_pil = Image.open(file_path)
      img_pil = ImageOps.exif_transpose(img_pil).convert("RGB")

      # If server returns different dimensions (should usually match), use server dimensions
      W = int(data.get("image_width", img_pil.width))
      H = int(data.get("image_height", img_pil.height))
      if (W, H) != (img_pil.width, img_pil.height):
          img_pil = img_pil.resize((W, H), Image.BICUBIC)

      boxes = data.get("ocr_boxes", [])
      img_pil = draw_boxes(img_pil, boxes)

      # 4) Display
      img_cv = cv2.cvtColor(np.array(img_pil), cv2.COLOR_RGB2BGR)
      cv2.imshow("OCR Preview", img_cv)
      print("Press any key on the image window to exit...")
      cv2.waitKey(0)
      cv2.destroyAllWindows()

  if __name__ == "__main__":
      main()
  ```

  サンプル出力：

  ![image3](image3.png)


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
