//
//  Settings.swift
//  OcrServer
//
//  Created by Riddle Ling on 2025/8/8.
//

import Foundation
import Vision

class Settings {
    static let shared = Settings()
    
    private init() {
        
    }
    
    var httpPort: Int {
        get {
            return UserDefaults.standard.object(forKey: "httpPort") as? Int ?? 8000
        }
        set {
            UserDefaults.standard.set(newValue, forKey: "httpPort")
        }
    }
    
    var recognitionLevel: String {
        get {
            return UserDefaults.standard.string(forKey: "recognitionLevel") ?? "Accurate"
        }
        set {
            UserDefaults.standard.set(newValue, forKey: "recognitionLevel")
        }
    }
    
    var languageCorrection: Bool {
        get {
            return UserDefaults.standard.object(forKey: "languageCorrection") as? Bool ?? true
        }
        set {
            UserDefaults.standard.set(newValue, forKey: "languageCorrection")
        }
    }
    
    var automaticallyDetectsLanguage: Bool {
        get {
            return UserDefaults.standard.object(forKey: "automaticallyDetectsLanguage") as? Bool ?? true
        }
        set {
            UserDefaults.standard.set(newValue, forKey: "automaticallyDetectsLanguage")
        }
    }
}
