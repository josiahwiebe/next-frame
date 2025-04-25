(() => {
  const TIMEOUT_DURATION = 2000; // 2 seconds
  const FPS_TARGETS = [60, 120];
  const POPUP_ID = 'nav-timer-feedback-popup';
  const TEXT_CONTAINER_CLASS = 'nav-timer-text-container';
  const LABEL_CLASS = 'nav-timer-label';
  const CLOSE_BUTTON_CLASS = 'nav-timer-close-button';
  const DISABLE_BUTTON_CLASS = 'nav-timer-disable-button';

  let mousedownTime = null;
  let mouseupTime = null;
  let observer = null;
  let timeoutId = null;
  let feedbackElement = null;
  let lastMouseX = 0;
  let lastMouseY = 0;

  function createFeedbackElement() {
    if (feedbackElement) {
      feedbackElement.remove();
    }

    feedbackElement = document.createElement('div');
    feedbackElement.id = POPUP_ID;

    const textContainer = document.createElement('span');
    textContainer.className = TEXT_CONTAINER_CLASS;
    feedbackElement.appendChild(textContainer);

    const closeButton = document.createElement('span');
    closeButton.className = CLOSE_BUTTON_CLASS;
    closeButton.textContent = '×';
    closeButton.addEventListener('click', (e) => {
      e.stopPropagation();
      hideFeedback();
    });
    closeButton.addEventListener('mousedown', (e) => {
        e.stopPropagation();
    });
    feedbackElement.appendChild(closeButton);

    const disableButton = document.createElement('span');
    disableButton.className = DISABLE_BUTTON_CLASS;
    disableButton.textContent = 'Disable Extension';
    disableButton.addEventListener('click', (e) => {
        e.stopPropagation();
        cleanup();
    });
    disableButton.addEventListener('mousedown', (e) => {
        e.stopPropagation();
    });
    feedbackElement.appendChild(disableButton);

    document.body.appendChild(feedbackElement);
  }

  function updateFeedbackPosition(x, y) {
    if (!feedbackElement) return;
    feedbackElement.style.left = `${x + 15}px`;
    feedbackElement.style.top = `${y + 15}px`;

    const rect = feedbackElement.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
        feedbackElement.style.left = `${x - rect.width - 15}px`;
    }
    if (rect.bottom > window.innerHeight) {
        feedbackElement.style.top = `${y - rect.height - 15}px`;
    }
  }

  function displayFeedback(text, x = lastMouseX, y = lastMouseY) {
    if (!feedbackElement) {
      createFeedbackElement();
    }
    const textContainer = feedbackElement.querySelector(`.${TEXT_CONTAINER_CLASS}`);
    if (textContainer) {
        if (text.includes('<span')) {
             textContainer.innerHTML = text;
        } else {
            textContainer.textContent = text;
        }
    }
    updateFeedbackPosition(x, y);
  }

  function hideFeedback() {
    if (feedbackElement) {
      feedbackElement.remove();
      feedbackElement = null;
    }
  }

  function calculateFrames(ms) {
    return FPS_TARGETS.map(fps => ({
      fps,
      frames: Math.round((ms / 1000) * fps)
    }));
  }

  function formatResults(mousedownToDomMs, mouseupToDomMs) {
    let resultHTML = '';
    const formatRow = (label, ms) => {
        const frames = calculateFrames(ms);
        const timeStr = ms.toFixed(1) + 'ms';
        const frameStr = `${frames[0].frames}f / ${frames[1].frames}f`;
        return `<span class="${LABEL_CLASS}">${label}:</span>
                <span class="nav-timer-result-time">${timeStr}</span>
                <span class="nav-timer-result-frames">${frameStr}</span>`;
    };

    if (mousedownToDomMs !== null) {
        resultHTML += formatRow('Mousedown → DOM', mousedownToDomMs);
    }
    if (mouseupToDomMs !== null) {
        resultHTML += formatRow('Mouseup → DOM', mouseupToDomMs);
    } else if (mousedownToDomMs !== null) {
        resultHTML += `<span class="${LABEL_CLASS}" style="grid-column: 1 / -1; text-align: left; margin-top: 4px;">(No mouseup before DOM change)</span>`;
    }
    return resultHTML;
  }

  function handleMousedown(event) {
    if (feedbackElement && feedbackElement.contains(event.target)) {
        return;
    }
    resetState();
    mousedownTime = performance.now();
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
    displayFeedback('Mousedown', lastMouseX, lastMouseY);
    startObserver();
    startTimeout();
  }

  function handleMouseup(event) {
    if (mousedownTime === null) return;
    mouseupTime = performance.now();
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
    displayFeedback('Mouseup', lastMouseX, lastMouseY);
  }

  function handleDomMutation(mutations) {
    const mutationTime = performance.now();
    if (mousedownTime === null) return;
    stopObserver();
    clearTimeout(timeoutId);
    timeoutId = null;
    const mousedownToDomMs = mutationTime - mousedownTime;
    const mouseupToDomMs = mouseupTime !== null ? (mutationTime - mouseupTime) : null;
    const resultText = formatResults(mousedownToDomMs, mouseupToDomMs);
    displayFeedback(resultText);
    mousedownTime = null;
    mouseupTime = null;
  }

  function startObserver() {
    if (observer) observer.disconnect();
    observer = new MutationObserver(handleDomMutation);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true
    });
  }

  function stopObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  function startTimeout() {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      stopObserver();
      displayFeedback('No DOM change detected within 2s');
      mousedownTime = null;
      mouseupTime = null;
    }, TIMEOUT_DURATION);
  }

  function resetState() {
      mousedownTime = null;
      mouseupTime = null;
      clearTimeout(timeoutId);
      timeoutId = null;
      stopObserver();
      hideFeedback();
  }

  function init() {
      document.addEventListener('mousedown', handleMousedown, true);
      document.addEventListener('mouseup', handleMouseup, true);
      window.addEventListener('pagehide', cleanup);
      window.addEventListener('beforeunload', cleanup);
  }

  function cleanup() {
      try {
        chrome.runtime.sendMessage({ type: "scriptInactive" });
      } catch (error) {
        if (!error.message.includes("Extension context invalidated")) {
            console.error("Error sending scriptInactive message:", error);
        }
      }

      document.removeEventListener('mousedown', handleMousedown, true);
      document.removeEventListener('mouseup', handleMouseup, true);
      stopObserver();
      clearTimeout(timeoutId);
      hideFeedback();
      window.navFrameTimerInjected = false;
      delete window.navFrameTimerCleanup;
  }

  if (window.navFrameTimerInjected) {
      if (typeof window.navFrameTimerCleanup === 'function') {
          window.navFrameTimerCleanup();
      }
  }
  init();
  window.navFrameTimerInjected = true;
  window.navFrameTimerCleanup = cleanup;

})();