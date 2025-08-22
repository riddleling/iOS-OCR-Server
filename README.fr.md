# OCR Server

Transformez votre iPhone en un puissant serveur OCR local utilisant le Vision Framework d'Apple.
Aucune dépendance cloud, utilisation illimitée, confidentialité complète.

[Télécharger depuis l'App Store](https://apps.apple.com/us/app/ocr-server/id6749533041)

[English](README.md) | [日本語](README.ja.md) | [繁體中文](README.zh-TW.md) | [简体中文](README.zh-CN.md) | [한국어](README.ko.md) | **Français**

![image](image.jpg)

## Comment utiliser

1. Lancez l'application et le serveur démarrera automatiquement
2. Accédez à l'adresse IP affichée depuis n'importe quel appareil sur le même réseau
3. Téléchargez des images pour obtenir des résultats de reconnaissance de texte
4. Intégrez le service dans vos applications via l'API
5. Pour garantir que l'application fonctionne en continu sans interruption, veuillez activer le mode [Accès guidé](https://support.apple.com/fr-fr/111795) iOS et maintenir l'écran allumé

- **Test OCR : Sur votre ordinateur, ouvrez un navigateur web et naviguez vers l'adresse IP affichée par l'application pour effectuer un test OCR.**

![image2](image2.png)

- **Exemple d'API - Télécharger une image via l'API `upload` :**

  ```
  curl -H "Accept: application/json" \
    -X POST http://<VOTRE IP>:8000/upload \
    -F "file=@01.png"
  ```

- **Exemple de téléchargement Python :**

  ```python
  import requests

  url = "http://10.0.1.11:8000/upload"  # Remplacez par votre adresse IP
  file_path = "01.png"

  with open(file_path, "rb") as f:
      files = {"file": f}
      headers = {"Accept": "application/json"}
      response = requests.post(url, files=files, headers=headers)

  print("status code:", response.status_code)
  print("response:", response.text)
  
  # response: {"message":"File uploaded successfully", "ocr_result":"Hello World!", "success":true}
  ```


## Fonctionnalités

- OCR haute précision alimenté par le Vision Framework d'Apple
- Prend en charge plusieurs langues avec détection automatique
- Téléchargement via l'interface web et réception des résultats OCR en quelques secondes
- API JSON pour une intégration facile dans les applications
- Traitement 100% local, sans cloud, confidentialité totale


## Cas d'usage

- OCR local sans services cloud
- Partager les services OCR entre appareils sur le même réseau
- Construire un cluster de traitement OCR utilisant plusieurs iPhones