//
//  ShareViewController.swift
//  FitFoShareExtension
//
//  Grabs the shared URL (TikTok / Instagram / any web URL or text that
//  contains one) and forwards it to the main FitFo app via the custom
//  `fitfo://ingest?url=...` scheme. The main app's `useSharedIngestUrl`
//  hook listens for that deep link and auto-fills the import modal.
//

import UIKit
import UniformTypeIdentifiers

class ShareViewController: UIViewController {

    override func viewDidLoad() {
        super.viewDidLoad()
        // Keep the share sheet visually empty — we dismiss as soon as we have
        // the URL in hand, no compose UI needed.
        view.backgroundColor = .clear
        extractSharedURL()
    }

    // MARK: - Extraction

    private func extractSharedURL() {
        guard
            let inputItem = (extensionContext?.inputItems as? [NSExtensionItem])?.first,
            let providers = inputItem.attachments
        else {
            complete()
            return
        }

        for provider in providers {
            if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { item, _ in
                    if let url = item as? URL {
                        self.forward(url.absoluteString)
                    } else if let urlString = item as? String {
                        self.forward(urlString)
                    } else {
                        self.complete()
                    }
                }
                return
            }

            if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                provider.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { item, _ in
                    if let text = item as? String,
                       let match = text.range(of: #"https?://\S+"#, options: .regularExpression) {
                        self.forward(String(text[match]))
                    } else {
                        self.complete()
                    }
                }
                return
            }
        }

        complete()
    }

    // MARK: - Forwarding

    private func forward(_ rawURL: String) {
        let trimmed = rawURL.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty,
              let encoded = trimmed.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
              let deepLink = URL(string: "fitfo://ingest?url=\(encoded)") else {
            complete()
            return
        }

        // Extensions can't call UIApplication.shared.open directly, so we walk
        // the responder chain to find the host UIApplication instance.
        var responder: UIResponder? = self
        while let current = responder {
            if let application = current as? UIApplication {
                application.perform(
                    #selector(UIApplication.open(_:options:completionHandler:)),
                    with: deepLink,
                    with: [:]
                )
                break
            }
            responder = current.next
        }

        complete()
    }

    // MARK: - Completion

    private func complete() {
        DispatchQueue.main.async {
            self.extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
        }
    }
}