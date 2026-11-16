import ExpoModulesCore
import UIKit

private let secondaryClickEventName = "onSecondaryClick"

/// Fork: iPadOS sends a trackpad two-finger click or a mouse right-click as a pointer "secondary"
/// button press. React Native's touch handler only listens to the primary button, so JS never
/// sees it. One recognizer per window reports the click's window coordinates; JS finds the
/// context-menu trigger under that point and opens its menu (same as a long-press).
public class PaseoSecondaryClickModule: Module {
  private var recognizers: [ObjectIdentifier: UITapGestureRecognizer] = [:]
  private let delegate = SimultaneousDelegate()

  public func definition() -> ModuleDefinition {
    Name("PaseoSecondaryClick")
    Events(secondaryClickEventName)

    OnStartObserving {
      DispatchQueue.main.async { [weak self] in self?.installOnAllWindows() }
    }
    OnStopObserving {
      DispatchQueue.main.async { [weak self] in self?.uninstallAll() }
    }
    OnAppEntersForeground {
      // A new scene can bring a new window.
      DispatchQueue.main.async { [weak self] in
        guard let self, !self.recognizers.isEmpty else { return }
        self.installOnAllWindows()
      }
    }
  }

  private func installOnAllWindows() {
    guard #available(iOS 13.4, *) else { return }
    for scene in UIApplication.shared.connectedScenes {
      guard let windowScene = scene as? UIWindowScene else { continue }
      for window in windowScene.windows where recognizers[ObjectIdentifier(window)] == nil {
        let recognizer = UITapGestureRecognizer(target: self, action: #selector(handleSecondaryClick(_:)))
        recognizer.buttonMaskRequired = .secondary
        recognizer.cancelsTouchesInView = false
        recognizer.delaysTouchesBegan = false
        recognizer.delaysTouchesEnded = false
        recognizer.delegate = delegate
        window.addGestureRecognizer(recognizer)
        recognizers[ObjectIdentifier(window)] = recognizer
      }
    }
  }

  private func uninstallAll() {
    for recognizer in recognizers.values {
      recognizer.view?.removeGestureRecognizer(recognizer)
    }
    recognizers.removeAll()
  }

  @objc private func handleSecondaryClick(_ recognizer: UITapGestureRecognizer) {
    guard recognizer.state == .ended, let window = recognizer.view else { return }
    let point = recognizer.location(in: window)
    sendEvent(secondaryClickEventName, ["x": point.x, "y": point.y])
  }
}

/// Never block other recognizers (scroll views, React Native's touch handler).
private final class SimultaneousDelegate: NSObject, UIGestureRecognizerDelegate {
  /// `buttonMaskRequired` only applies to indirect pointer input; a finger tap still recognizes.
  /// Only trackpad / mouse clicks may count as secondary clicks.
  func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
    if #available(iOS 13.4, *) {
      return touch.type == .indirectPointer
    }
    return false
  }

  func gestureRecognizer(
    _ gestureRecognizer: UIGestureRecognizer,
    shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
  ) -> Bool {
    true
  }
}
