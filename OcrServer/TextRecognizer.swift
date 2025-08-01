//
//  TextRecognizer.swift
//  OcrServer
//
//  Created by Riddle Ling on 2025/8/1.
//

import Foundation
import Vision

class TextRecognizer {
    func getOcrResult(data: Data) -> String? {
        let request = VNRecognizeTextRequest()
        request.revision = VNRecognizeTextRequestRevision3
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = true
        request.automaticallyDetectsLanguage = true
        
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
