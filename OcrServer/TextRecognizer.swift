//
//  TextRecognizer.swift
//  OcrServer
//
//  Created by Riddle Ling on 2025/8/1.
//

import Foundation
import Vision

class TextRecognizer {
    let recognitionLevel : VNRequestTextRecognitionLevel
    let usesLanguageCorrection : Bool
    let automaticallyDetectsLanguage : Bool
    
    init(recognitionLevel: VNRequestTextRecognitionLevel = .accurate,
         usesLanguageCorrection: Bool = true,
         automaticallyDetectsLanguage: Bool = true) {
        self.recognitionLevel = recognitionLevel
        self.usesLanguageCorrection = usesLanguageCorrection
        self.automaticallyDetectsLanguage = automaticallyDetectsLanguage
    }
    
    func getOcrResult(data: Data) -> String? {
        let request = VNRecognizeTextRequest()
        request.revision = VNRecognizeTextRequestRevision3
        request.recognitionLevel = self.recognitionLevel
        request.usesLanguageCorrection = self.usesLanguageCorrection
        request.automaticallyDetectsLanguage = self.automaticallyDetectsLanguage
        
        let handler = VNImageRequestHandler(data: data, options: [:])
        
        try? handler.perform([request])
        
        guard let observations = request.results else {
            return nil
        }
        
        var result = ""
        for observation in observations {
            if let candidate = observation.topCandidates(1).first {
                result += "\(candidate.string)\n"
            }
        }
        return result
    }
}
