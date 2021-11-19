const MUTE_BUTTON = '[role="button"][aria-label*="mic"][data-is-muted]';

const waitUntilElementExists = (DOMSelector, MAX_TIME = 5000) => {
  let timeout = 0;

  const waitForContainerElement = (resolve, reject) => {
    const container = document.querySelector(DOMSelector);
    timeout += 100;

    if (timeout >= MAX_TIME) reject("Element not found");

    if (!container || container.length === 0) {
      setTimeout(waitForContainerElement.bind(this, resolve, reject), 100);
    } else {
      resolve(container);
    }
  };

  return new Promise((resolve, reject) => {
    waitForContainerElement(resolve, reject);
  });
};

var waitingForMuteButton = false;

function waitForMuteButton() {
  if (waitingForMuteButton) {
    return;
  }
  waitingForMuteButton = true;
  waitUntilElementExists(MUTE_BUTTON)
    .then((el) => {
      waitingForMuteButton = false;
      updateMuted();
      watchIsMuted(el);
    })
    .catch((error) => {
      chrome.extension.sendMessage({ message: "disconnected" });
    });
}

var muted = false;

function isMuted() {
  let dataIsMuted = document
    .querySelector(MUTE_BUTTON)
    .getAttribute("data-is-muted");
  return dataIsMuted == "true";
}

function updateMuted(newValue) {
  muted = newValue || isMuted();
  chrome.extension.sendMessage({ message: muted ? "muted" : "unmuted" });
}

var isMutedObserver;

function watchIsMuted(el) {
  if (isMutedObserver) {
    isMutedObserver.disconnect();
  }
  isMutedObserver = new MutationObserver((mutations) => {
    let newValue = mutations[0].target.getAttribute("data-is-muted") == "true";

    if (newValue != muted) {
      updateMuted(newValue);
    }
  });
  isMutedObserver.observe(el, {
    attributes: true,
    attributeFilter: ["data-is-muted"],
  });
}

function watchBodyClass() {
  const bodyClassObserver = new MutationObserver((mutations) => {
    let newClass = mutations[0].target.getAttribute("class");
    if (mutations[0].oldValue != newClass) {
      waitForMuteButton();
    }
  });
  bodyClassObserver.observe(document.querySelector("body"), {
    attributes: true,
    attributeFilter: ["class"],
    attributeOldValue: true,
  });
}

watchBodyClass();

window.onbeforeunload = (event) => {
  chrome.extension.sendMessage({ message: "disconnected" });
};

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request == null || request.command == null || request.isMac) {
    console.error("request or request.command or request.isMac were not set", request);
    return;
  }

  console.log("received request:", request);

  muted = isMuted();
  let changed = false;

  switch (request.command) {
    case "toggle_mute":
      changed = true;
      break;
    case "mute":
      if (!muted) {
        changed = true;
      }
      break;
    case "unmute":
      if (muted) {
        changed = true;
      }
      break;
  }

  console.log("mute changed?", changed);
  if (changed) {
    sendKeyboardCommand(request.isMac);
    sendResponse({ message: muted ? "muted" : "unmuted" });
  }
});

function sendKeyboardCommand(isMac) {
  document.dispatchEvent(new KeyboardEvent("keydown", {
    key: "d",
    code: "KeyD",
    // use either ctrl or meta key depending on platform os
    ctrlKey: !isMac,
    metaKey: isMac,
    charCode: 100,
    keyCode: 100,
    which: 100,
  }));
}
