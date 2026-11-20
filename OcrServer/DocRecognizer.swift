//
//  DocRecognizer.swift
//  OcrServer
//
//  Created by Riddle Ling on 2026/5/24.
//

import Foundation
import Vision

@available(iOS 26.0, *)
class DocRecognizer {
    let usesLanguageCorrection : Bool
    let automaticallyDetectsLanguage : Bool
    let recognitionLanguages : [Locale.Language]
    
    init(usesLanguageCorrection: Bool = true, automaticallyDetectsLanguage: Bool = true,
         recognitionLanguages: [Locale.Language] = []) {
        self.usesLanguageCorrection = usesLanguageCorrection
        self.automaticallyDetectsLanguage = automaticallyDetectsLanguage
        self.recognitionLanguages = recognitionLanguages
    }
    
    func recognizeParagraphText(from imageData: Data) async -> String {
            var request = RecognizeDocumentsRequest()
            request.textRecognitionOptions.automaticallyDetectLanguage = automaticallyDetectsLanguage
            request.textRecognitionOptions.useLanguageCorrection = usesLanguageCorrection
            request.textRecognitionOptions.maximumCandidateCount = 1
            if !recognitionLanguages.isEmpty {
                request.textRecognitionOptions.recognitionLanguages = recognitionLanguages
            }

            let observations = try? await request.perform(on: imageData)

            guard let document = observations?.first?.document else {
                return ""
            }

            let blocks = documentBlocks(from: document)

            return mergeParagraphBlocksSplitByOCR(blocks)
                .map(\.text)
                .joined(separator: "\n\n")
        }

        private func documentBlocks(from document: DocumentObservation.Container) -> [DocumentBlock] {
            let tableBlocks = document.tables
                .map { table in
                    DocumentBlock(
                        kind: .table,
                        text: markdownTable(from: table),
                        boundingBox: table.boundingRegion.boundingBox
                    )
                }
                .filter { !$0.text.isEmpty }

            let listBlocks = document.lists
                .map { list in
                    DocumentBlock(
                        kind: .list,
                        text: markdownList(from: list),
                        boundingBox: list.boundingRegion.boundingBox
                    )
                }
                .filter { !$0.text.isEmpty }
                .filter { list in
                    return !tableBlocks.contains { table in
                        list.boundingBox.isMostlyInside(table.boundingBox)
                    }
                }

            let structuredBlocks = tableBlocks + listBlocks
            let paragraphBlocks = document.paragraphs
                .map { paragraph in
                    DocumentBlock(
                        kind: .paragraph,
                        text: normalizeTextBlock(paragraph),
                        boundingBox: paragraph.boundingRegion.boundingBox
                    )
                }
                .filter { !$0.text.isEmpty }
                .filter { paragraph in
                    !structuredBlocks.contains { structuredBlock in
                        paragraph.boundingBox.isMostlyInside(structuredBlock.boundingBox)
                    }
                }

            return sortBlocksInReadingOrder(paragraphBlocks + structuredBlocks)
        }

        private func sortBlocksInReadingOrder(_ blocks: [DocumentBlock]) -> [DocumentBlock] {
            blocks.sorted { lhs, rhs in
                let lhsRect = lhs.boundingBox.cgRect
                let rhsRect = rhs.boundingBox.cgRect

                if lhsRect.verticallyOverlaps(rhsRect, minimumRatio: 0.5) {
                    return lhsRect.minX < rhsRect.minX
                }

                return lhsRect.maxY > rhsRect.maxY
            }
        }

        private func normalizeTextBlock(_ textBlock: DocumentObservation.Container.Text) -> String {
            let lines = textBlock.lines
                .map(\.transcript)
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }

            if lines.isEmpty {
                return normalizeTranscript(textBlock.transcript)
            }

            return joinLinesInSameParagraph(lines)
        }

        private func markdownTable(from table: DocumentObservation.Container.Table) -> String {
            let columnCount = table.columns.count
            guard columnCount > 0 else {
                return ""
            }

            let rows = table.rows.indices.map { rowIndex in
                markdownRow(from: table.rows[rowIndex], columnCount: columnCount)
            }

            guard let header = rows.first else {
                return ""
            }

            let separator = Array(repeating: "---", count: header.count)
            return ([header, separator] + rows.dropFirst())
                .map { "| " + $0.joined(separator: " | ") + " |" }
                .joined(separator: "\n")
        }

        private func markdownRow(
            from cells: [DocumentObservation.Container.Table.Cell],
            columnCount: Int
        ) -> [String] {
            var row = Array(repeating: "", count: columnCount)

            for cell in cells {
                let columnIndex = cell.columnRange.lowerBound
                guard row.indices.contains(columnIndex) else {
                    continue
                }

                row[columnIndex] = markdownCellText(from: cell)
            }

            return row
        }

        private func markdownCellText(from cell: DocumentObservation.Container.Table.Cell) -> String {
            normalizeTextBlock(cell.content.text)
                .components(separatedBy: .newlines)
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }
                .joined(separator: "<br>")
                .replacingOccurrences(of: "|", with: "\\|")
        }

        private func markdownList(from list: DocumentObservation.Container.List) -> String {
            list.items
                .map(markdownListItem)
                .filter { !$0.isEmpty }
                .joined(separator: "\n")
        }

        private func markdownListItem(from item: DocumentObservation.Container.List.Item) -> String {
            let marker = markdownMarker(from: item)
            let text = normalizeListItemText(item)
            guard !text.isEmpty else {
                return ""
            }

            return "\(marker) \(text)"
        }

        private func markdownMarker(from item: DocumentObservation.Container.List.Item) -> String {
            switch item.markerType {
            case .bullet, .hyphen:
                return "-"
            case .decimal, .decorativeDecimal, .compositeDecimal:
                return markdownNumberMarker(from: item.markerString)
            case .lowercaseLatin:
                return markdownLatinMarker(from: item.markerString, fallback: "a.")
            case .uppercaseLatin:
                return markdownLatinMarker(from: item.markerString, fallback: "A.")
            case nil:
                return normalizedMarkdownMarker(item.markerString)
            case .some:
                return normalizedMarkdownMarker(item.markerString)
            }
        }

        private func markdownNumberMarker(from markerString: String) -> String {
            let marker = markerString.trimmingCharacters(in: .whitespacesAndNewlines)
            let number = marker.prefix { $0.isNumber }
            return number.isEmpty ? "1." : "\(number)."
        }

        private func markdownLatinMarker(from markerString: String, fallback: String) -> String {
            let marker = markerString.trimmingCharacters(in: .whitespacesAndNewlines)
            guard let firstLetter = marker.first, firstLetter.isLetter else {
                return fallback
            }

            return "\(firstLetter)."
        }

        private func normalizedMarkdownMarker(_ markerString: String) -> String {
            let marker = markerString.trimmingCharacters(in: .whitespacesAndNewlines)
            guard let firstCharacter = marker.first else {
                return "-"
            }

            if firstCharacter.isNumber {
                return markdownNumberMarker(from: marker)
            }

            if "•●◦○▪▫-–—*".contains(firstCharacter) {
                return "-"
            }

            if firstCharacter.isLetter {
                return "\(firstCharacter)."
            }

            return marker
        }

        private func normalizeListItemText(_ item: DocumentObservation.Container.List.Item) -> String {
            stripExistingListMarker(
                from: normalizeTextBlock(item.content.text),
                item: item
            )
        }

        private func stripExistingListMarker(
            from text: String,
            item: DocumentObservation.Container.List.Item
        ) -> String {
            let trimmedText = text.trimmingCharacters(in: .whitespacesAndNewlines)
            let trimmedMarker = item.markerString.trimmingCharacters(in: .whitespacesAndNewlines)

            if !trimmedMarker.isEmpty,
               let textAfterMarker = stripKnownMarker(trimmedMarker, from: trimmedText) {
                return textAfterMarker
            }

            switch item.markerType {
            case .bullet, .hyphen, nil:
                return stripLeadingBulletMarker(from: trimmedText)
            case .decimal, .decorativeDecimal, .compositeDecimal:
                return stripLeadingNumberMarker(from: trimmedText)
            case .lowercaseLatin, .uppercaseLatin:
                return stripLeadingLatinMarker(from: trimmedText)
            case .some:
                return trimmedText
            }
        }

        private func stripKnownMarker(_ marker: String, from text: String) -> String? {
            guard text.hasPrefix(marker) else {
                return nil
            }

            return removeLeadingListMarkerSeparators(String(text.dropFirst(marker.count)))
        }

        private func stripLeadingBulletMarker(from text: String) -> String {
            guard let firstCharacter = text.first,
                  "•●◦○▪▫-–—*".contains(firstCharacter) else {
                return text
            }

            return removeLeadingListMarkerSeparators(String(text.dropFirst()))
        }

        private func stripLeadingNumberMarker(from text: String) -> String {
            let numberPrefix = text.prefix { $0.isNumber }
            let remainingText = String(text.dropFirst(numberPrefix.count))
            guard !numberPrefix.isEmpty, startsWithListMarkerSeparator(remainingText) else {
                return text
            }

            return removeLeadingListMarkerSeparators(remainingText)
        }

        private func stripLeadingLatinMarker(from text: String) -> String {
            guard let firstCharacter = text.first, firstCharacter.isLetter else {
                return text
            }

            let remainingText = String(text.dropFirst())
            guard startsWithListMarkerSeparator(remainingText) else {
                return text
            }

            return removeLeadingListMarkerSeparators(remainingText)
        }

        private func startsWithListMarkerSeparator(_ text: String) -> Bool {
            guard let firstCharacter = text.first else {
                return false
            }

            return CharacterSet.listMarkerSeparators.contains(firstCharacter)
        }

        private func removeLeadingListMarkerSeparators(_ text: String) -> String {
            String(text.drop { CharacterSet.listMarkerSeparators.contains($0) })
        }

        private func mergeParagraphBlocksSplitByOCR(_ blocks: [DocumentBlock]) -> [DocumentBlock] {
            blocks.reduce(into: []) { result, block in
                guard block.kind == .paragraph,
                      let previousBlock = result.last,
                      previousBlock.kind == .paragraph,
                      shouldMergeParagraph(previousBlock.text, with: block.text) else {
                    result.append(block)
                    return
                }

                let mergedText = previousBlock.text
                    + (shouldInsertSpace(between: previousBlock.text, and: block.text) ? " " : "")
                    + block.text
                result[result.count - 1] = previousBlock.replacingText(with: mergedText)
            }
        }

        private func shouldMergeParagraph(_ previousParagraph: String, with nextParagraph: String) -> Bool {
            guard let previousLastScalar = previousParagraph.trimmingCharacters(in: .whitespacesAndNewlines).unicodeScalars.last,
                  let nextFirstScalar = nextParagraph.trimmingCharacters(in: .whitespacesAndNewlines).unicodeScalars.first else {
                return false
            }

            guard !previousLastScalar.isStrongParagraphEnding else {
                return false
            }

            return nextFirstScalar.isLowercaseLatin || nextFirstScalar.isContinuationPunctuation
        }

        private func normalizeTranscript(_ text: String) -> String {
            let lines = text
                .components(separatedBy: .newlines)
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }

            return joinLinesInSameParagraph(lines)
        }

        private func joinLinesInSameParagraph(_ lines: [String]) -> String {
            lines.reduce(into: "") { result, line in
                guard !result.isEmpty else {
                    result = line
                    return
                }

                result += shouldInsertSpace(between: result, and: line) ? " \(line)" : line
            }
        }

        private func shouldInsertSpace(between previousText: String, and nextText: String) -> Bool {
            guard let previousScalar = previousText.unicodeScalars.last,
                  let nextScalar = nextText.unicodeScalars.first else {
                return false
            }

            return !previousScalar.isCJK && !nextScalar.isCJK
        }
}

private struct DocumentBlock {
    enum Kind {
        case paragraph
        case list
        case table
    }

    let kind: Kind
    let text: String
    let boundingBox: NormalizedRect

    func replacingText(with text: String) -> DocumentBlock {
        DocumentBlock(kind: kind, text: text, boundingBox: boundingBox)
    }
}

private extension Unicode.Scalar {
    var isLowercaseLatin: Bool {
        (0x0061...0x007A).contains(value)
    }

    var isStrongParagraphEnding: Bool {
        ".!?。！？:：;；".unicodeScalars.contains(self)
    }

    var isCJK: Bool {
        (0x4E00...0x9FFF).contains(value) ||
        (0x3400...0x4DBF).contains(value) ||
        (0xF900...0xFAFF).contains(value) ||
        (0x3040...0x30FF).contains(value) ||
        (0xAC00...0xD7AF).contains(value)
    }

    var isContinuationPunctuation: Bool {
        ",，、)）]］}｝」』》〉".unicodeScalars.contains(self)
    }
}

private extension CharacterSet {
    static let listMarkerSeparators = CharacterSet(charactersIn: ".．、)）:： \t\n\r")

    func contains(_ character: Character) -> Bool {
        character.unicodeScalars.allSatisfy { contains($0) }
    }
}

private extension NormalizedRect {
    func isMostlyInside(_ other: NormalizedRect) -> Bool {
        let intersection = cgRect.intersection(other.cgRect)
        guard !intersection.isNull, area > 0 else {
            return false
        }

        return intersection.area / area > 0.6
    }

    private var area: CGFloat {
        width * height
    }
}

private extension CGRect {
    var area: CGFloat {
        width * height
    }

    func verticallyOverlaps(_ other: CGRect, minimumRatio: CGFloat) -> Bool {
        let overlap = min(maxY, other.maxY) - max(minY, other.minY)
        guard overlap > 0 else {
            return false
        }

        let shorterHeight = min(height, other.height)
        guard shorterHeight > 0 else {
            return false
        }

        return overlap / shorterHeight >= minimumRatio
    }
}
