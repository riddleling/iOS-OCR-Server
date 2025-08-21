//
//  TextRecognizer.swift
//  OcrServer
//
//  Created by Riddle Ling on 2025/8/1.
//

import Foundation
import Vision

class TextRecognizer {
    let recognitionLevel : RecognizeTextRequest.RecognitionLevel
    let usesLanguageCorrection : Bool
    let automaticallyDetectsLanguage : Bool
    
    init(recognitionLevel: RecognizeTextRequest.RecognitionLevel = .accurate,
         usesLanguageCorrection: Bool = true,
         automaticallyDetectsLanguage: Bool = true) {
        self.recognitionLevel = recognitionLevel
        self.usesLanguageCorrection = usesLanguageCorrection
        self.automaticallyDetectsLanguage = automaticallyDetectsLanguage
    }
    
    func getOcrResult(data: Data) async -> String? {
        var request = RecognizeTextRequest()
        request.recognitionLevel = self.recognitionLevel
        request.usesLanguageCorrection = self.usesLanguageCorrection
        request.automaticallyDetectsLanguage = self.automaticallyDetectsLanguage
        
        let results = try? await request.perform(on: data)
        
        var result = ""
        if let results = results {
            for observation in results {
                if let candidate = observation.topCandidates(1).first {
                    result += "\(candidate.string)\n"
                }
            }
        }
        return result
    }
}
