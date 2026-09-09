import { useEffect, useMemo, useState } from "react";

const DISMISSED_UNTIL_KEY = "3color-install-prompt-dismissed-until";
const INSTALLED_KEY = "3color-installed";
const SNOOZE_DAYS = 14;

function isStandaloneApp() {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function isIOSDevice() {
  if (typeof window === "undefined") {
    return false;
  }

  const userAgent = window.navigator.userAgent.toLowerCase();

  return (
    /iphone|ipad|ipod/.test(userAgent) ||
    (window.navigator.platform === "MacIntel" &&
      window.navigator.maxTouchPoints > 1)
  );
}

function isDismissed() {
  if (typeof window === "undefined") {
    return true;
  }

  const dismissedUntil = Number(
    window.localStorage.getItem(DISMISSED_UNTIL_KEY)
  );

  return dismissedUntil > Date.now();
}

function snoozePrompt() {
  const dismissedUntil =
    Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000;

  window.localStorage.setItem(DISMISSED_UNTIL_KEY, String(dismissedUntil));
}

function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);

  const isIOS = useMemo(() => isIOSDevice(), []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (
      isStandaloneApp() ||
      isDismissed() ||
      window.localStorage.getItem(INSTALLED_KEY) === "true"
    ) {
      return;
    }

    if (isIOSDevice()) {
      const timerId = window.setTimeout(() => {
        setShowPrompt(true);
      }, 1800);

      return () => window.clearTimeout(timerId);
    }

    function handleBeforeInstallPrompt(event) {
      event.preventDefault();
      setDeferredPrompt(event);
      setShowPrompt(true);
    }

    function handleAppInstalled() {
      window.localStorage.setItem(INSTALLED_KEY, "true");
      setDeferredPrompt(null);
      setShowPrompt(false);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  async function handleInstallClick() {
    if (!deferredPrompt) {
      return;
    }

    deferredPrompt.prompt();

    const choice = await deferredPrompt.userChoice;

    setDeferredPrompt(null);

    if (choice.outcome === "accepted") {
      window.localStorage.setItem(INSTALLED_KEY, "true");
    } else {
      snoozePrompt();
    }

    setShowPrompt(false);
  }

  function handleDismiss() {
    snoozePrompt();
    setShowPrompt(false);
  }

  if (!showPrompt) {
    return null;
  }

  return (
    <section className="installPrompt">
      <button
        type="button"
        className="installPromptClose"
        onClick={handleDismiss}
        aria-label="Dismiss install prompt"
      >
        ×
      </button>

      <div className="installPromptText">
        <p className="eyebrow">Play like an app</p>

        <h3>Add 3Color to your Home Screen</h3>

        {isIOS ? (
          <p>
            On iPhone, tap the Share button in Safari, then choose Add to Home
            Screen.
          </p>
        ) : (
          <p>
            Install 3Color so it opens from your device like a small puzzle app.
          </p>
        )}
      </div>

      <div className="installPromptActions">
        {deferredPrompt && (
          <button type="button" onClick={handleInstallClick}>
            Install
          </button>
        )}

        <button
          type="button"
          className="secondaryButton"
          onClick={handleDismiss}
        >
          Maybe later
        </button>
      </div>
    </section>
  );
}

export default InstallPrompt;