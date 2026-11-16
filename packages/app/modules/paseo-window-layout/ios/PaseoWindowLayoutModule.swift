import ExpoModulesCore
import UIKit

public final class PaseoWindowLayoutModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PaseoWindowLayout")
    OnCreate {
      DispatchQueue.main.async { StatusBarPreference.install() }
      #if compiler(>=6.4)
      if #available(iOS 27.1, *) {
        DispatchQueue.main.async { VerticalBarPreference.install() }
      }
      #endif
    }
    Function("setStatusBarHidden") { (hidden: Bool) in
      DispatchQueue.main.async { StatusBarPreference.setHidden(hidden) }
    }
    View(WindowLayoutView.self) {
      Events("onGeometryChange")
    }
  }
}

/// Fork: hides the status bar (time, signal, Live Activities) the way Safari does, through the
/// view controllers' `prefersStatusBarHidden`. The app-wide `UIApplication` status bar API that
/// React Native's StatusBar uses has no effect in a scene-based app, so Info.plist sets
/// `UIViewControllerBasedStatusBarAppearance` and every controller reports this one flag.
enum StatusBarPreference {
  private static var installed = false
  private static var hidden = false

  static func install() {
    guard !installed else { return }
    installed = true
    replaceGetter(#selector(getter: UIViewController.prefersStatusBarHidden)) {
      (_: UIViewController) -> Bool in StatusBarPreference.hidden
    }
    let animation: @convention(block) (UIViewController) -> UIStatusBarAnimation = { _ in .slide }
    if let method = class_getInstanceMethod(
      UIViewController.self, #selector(getter: UIViewController.preferredStatusBarUpdateAnimation))
    {
      method_setImplementation(method, imp_implementationWithBlock(animation))
    }
  }

  private static func replaceGetter(
    _ selector: Selector, _ block: @escaping @convention(block) (UIViewController) -> Bool
  ) {
    guard let method = class_getInstanceMethod(UIViewController.self, selector) else { return }
    method_setImplementation(method, imp_implementationWithBlock(block))
  }

  static func setHidden(_ value: Bool) {
    install()
    guard value != hidden else { return }
    hidden = value
    UIView.animate(withDuration: 0.25) {
      for scene in UIApplication.shared.connectedScenes {
        guard let windowScene = scene as? UIWindowScene else { continue }
        for window in windowScene.windows {
          var controller = window.rootViewController
          while let current = controller {
            current.setNeedsStatusBarAppearanceUpdate()
            controller = current.presentedViewController
          }
        }
      }
    }
  }
}

#if compiler(>=6.4)
/// Fork: like Safari, give up the vertical bar at regular width (the unfolded iPhone Duo) so the
/// status items return to a horizontal status bar at the top instead of a side column. Compact
/// widths (the folded outer display) keep the bar, which Paseo uses for its workspace actions.
/// The root view controller is created by Expo, so the preference is installed on
/// UIViewController itself rather than in a subclass.
@available(iOS 27.1, *)
enum VerticalBarPreference {
  private static var installed = false

  static func install() {
    guard !installed else { return }
    installed = true
    let selector = #selector(getter: UIViewController.preferredVerticalBarBehavior)
    guard let method = class_getInstanceMethod(UIViewController.self, selector) else { return }
    let behavior: @convention(block) (UIViewController) -> UIVerticalBarBehavior = { controller in
      controller.traitCollection.horizontalSizeClass == .regular ? .disabled : .automatic
    }
    method_setImplementation(method, imp_implementationWithBlock(behavior))
  }

  /// Asks the window's controllers to re-resolve, e.g. after folding or unfolding.
  static func refresh(_ window: UIWindow?) {
    var controller = window?.rootViewController
    while let current = controller {
      current.setNeedsUpdateOfVerticalBarConfiguration()
      controller = current.presentedViewController
    }
  }
}
#endif

final class WindowLayoutView: ExpoView {
  let onGeometryChange = EventDispatcher()
  private var updateScheduled = false
  private var previousPayload: [String: Any]?
  private var divisions: [CGRect] = []
  private var barGuide: UILayoutGuide?
  private var barEdge = "none"
  private var bottomBarGuide: UILayoutGuide?
  private var topBarGuide: UILayoutGuide?
  private var occlusions: [CGRect] = []
  private var measuredBounds = CGRect.zero

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    isUserInteractionEnabled = false
    #if compiler(>=6.4)
    if #available(iOS 27.1, *) {
      registerForTraitChanges(UITraitCollection.systemTraitsAffectingVerticalBarEdge) {
        (view: WindowLayoutView, _) in
        view.setNeedsUpdateConstraints()
        view.scheduleUpdate()
      }
      registerForTraitChanges([UITraitHorizontalSizeClass.self]) { (view: WindowLayoutView, _) in
        VerticalBarPreference.refresh(view.window)
      }
    }
    #endif
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    #if compiler(>=6.4)
    if #available(iOS 27.1, *) {
      VerticalBarPreference.refresh(window)
    }
    #endif
    previousPayload = nil
    bottomBarGuide = nil
    topBarGuide = nil
    setNeedsUpdateConstraints()
    scheduleUpdate()
  }

  override func safeAreaInsetsDidChange() {
    super.safeAreaInsetsDidChange()
    setNeedsUpdateConstraints()
    scheduleUpdate()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    if bounds != measuredBounds {
      measuredBounds = bounds
      setNeedsUpdateConstraints()
    }
    scheduleUpdate()
  }

  override func updateConstraints() {
    #if compiler(>=6.4)
    if #available(iOS 27.1, *) {
      // UIKit tracks these reads and invalidates constraints when regions change.
      divisions = reservedRegions(kind: .division).compactMap { $0.isActive ? $0.frame : nil }
      // Frames already include the system's interactive margins.
      occlusions = reservedRegions(kind: .occlusion).compactMap { $0.isActive ? $0.frame : nil }
      let edge: String
      switch traitCollection.verticalBarEdge {
      case .leading: edge = "leading"
      case .trailing: edge = "trailing"
      default: edge = "none"
      }
      if bottomBarGuide == nil {
        // Where a bottom bar rests: above the home indicator, refined to the
        // screen's corners rather than the rectangular safe area.
        bottomBarGuide = layoutGuide(for: .bar(onEdge: UIRectEdge.bottom, extent: 44))
      }
      if topBarGuide == nil {
        // Where a top bar rests. Beside a partial status region it can start above the
        // rectangular safe area; content still keeps out of the occlusions.
        topBarGuide = layoutGuide(for: .bar(onEdge: UIRectEdge.top, extent: 44))
      }
      if edge != barEdge {
        barEdge = edge
        barGuide = edge == "none" ? nil : layoutGuide(
          for: .bar(onEdge: edge == "trailing" ? .right : .left, extent: 44)
        )
      }
    }
    #endif
    super.updateConstraints()
    scheduleUpdate()
  }

  private func scheduleUpdate() {
    guard !updateScheduled else { return }
    updateScheduled = true
    DispatchQueue.main.async { [weak self] in
      guard let self else { return }
      self.updateScheduled = false
      self.publish()
    }
  }

  private func publish() {
    guard window != nil, bounds.width > 0, bounds.height > 0 else { return }
    let bar = barGuide?.layoutFrame
    var barPayload: Any = NSNull()
    if let bar, bar.width > 0, bar.height > 0 { barPayload = rect(bar) }
    // Before UIKit resolves the guide its frame has no height: publish null (the
    // system inset applies) rather than a false zero clearance.
    var bottomClearance: Any = NSNull()
    if let bottomBar = bottomBarGuide?.layoutFrame, bottomBar.height > 0 {
      bottomClearance = max(0, bounds.maxY - bottomBar.maxY)
    }
    var topBar: Any = NSNull()
    if let frame = topBarGuide?.layoutFrame, frame.width > 0, frame.height > 0 {
      topBar = rect(frame)
    }
    let payload: [String: Any] = [
      "bounds": rect(bounds),
      "verticalBarEdge": barEdge,
      "verticalBar": barPayload,
      "bottomClearance": bottomClearance,
      "topBar": topBar,
      "occlusions": occlusions.map(rect),
      "divisions": divisions.map(rect)
    ]
    guard !NSDictionary(dictionary: payload).isEqual(to: previousPayload ?? [:]) else { return }
    previousPayload = payload
    onGeometryChange(payload)
  }

  private func rect(_ frame: CGRect) -> [String: CGFloat] {
    ["x": frame.minX, "y": frame.minY, "width": frame.width, "height": frame.height]
  }
}
