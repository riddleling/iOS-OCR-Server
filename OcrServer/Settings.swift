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
//            let level = UserDefaults.standard.string(forKey: "recognitionLevel") ?? "Accurate"
//            switch level {
//            case "Accurate":
//                return .accurate
//            case "Fast":
//                return .fast
//            default:
//                return .accurate
//            }
            return UserDefaults.standard.string(forKey: "recognitionLevel") ?? "Accurate"
        }
        set {
            UserDefaults.standard.set(newValue, forKey: "recognitionLevel")
//            switch newValue {
//            case .accurate:
//                UserDefaults.standard.set(newValue, forKey: "Accurate")
//            case .fast:
//                UserDefaults.standard.set(newValue, forKey: "Fast")
//            default:
//                UserDefaults.standard.set(newValue, forKey: "Accurate")
//            }
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
