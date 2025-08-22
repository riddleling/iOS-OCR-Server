# OCR Server

Apple의 Vision Framework를 사용하여 iPhone을 강력한 로컬 OCR 서버로 변환합니다.
클라우드 의존성 없음, 무제한 사용, 완전한 개인정보 보호.

[App Store에서 다운로드](https://apps.apple.com/us/app/ocr-server/id6749533041)

[English](README.md) | [日本語](README.ja.md) | [繁體中文](README.zh-TW.md) | [简体中文](README.zh-CN.md) | **한국어** | [Français](README.fr.md)

![image](image.jpg)

## 사용 방법

1. 앱을 실행하면 서버가 자동으로 시작됩니다
2. 같은 네트워크의 모든 기기에서 표시된 IP 주소에 접근
3. 이미지를 업로드하여 텍스트 인식 결과 얻기
4. API를 통해 서비스를 애플리케이션에 통합
5. 앱이 중단 없이 지속적으로 실행되도록 iOS [사용법 유도](https://support.apple.com/ko-kr/111795) 모드를 활성화하고 화면을 켜둡니다

- **OCR 테스트: 컴퓨터에서 웹 브라우저를 열고 앱에 표시된 IP 주소로 이동하여 OCR 테스트를 수행합니다.**

![image2](image2.png)

- **API 예제 - `upload` API를 통한 이미지 업로드:**

  ```
  curl -H "Accept: application/json" \
    -X POST http://<당신의IP>:8000/upload \
    -F "file=@01.png"
  ```

- **Python 업로드 예제:**

  ```python
  import requests

  url = "http://10.0.1.11:8000/upload"  # 당신의 IP 주소로 교체하세요
  file_path = "01.png"

  with open(file_path, "rb") as f:
      files = {"file": f}
      headers = {"Accept": "application/json"}
      response = requests.post(url, files=files, headers=headers)

  print("status code:", response.status_code)
  print("response:", response.text)
  
  # response: {"message":"File uploaded successfully", "ocr_result":"Hello World!", "success":true}
  ```


## 기능

- Apple Vision Framework 기반 고정밀 OCR
- 자동 감지를 통한 다국어 지원
- 웹 인터페이스를 통한 업로드 및 수초 내 OCR 결과 제공
- 앱 통합을 위한 JSON API
- 100% 로컬 처리, 클라우드 없음, 완전한 개인정보 보호


## 사용 사례

- 클라우드 서비스 없는 로컬 OCR
- 같은 네트워크 내 기기 간 OCR 서비스 공유
- 여러 iPhone을 사용한 OCR 처리 클러스터 구축