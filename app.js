const frequencies = [250, 500, 1000, 2000, 4000, 8000];
const results = Object.fromEntries(
  frequencies.map((freq) => [freq, { left: null, right: null }])
);

let selectedEar = "left";
let selectedFrequency = 250;
let testMode = "manual";
let isPlaying = false;
let audioContext;
let masterGain;
let panner;
let currentOscillator = null;
let currentToneGain = null;
let autoRampTimer = null;
const AUTO_STEP = 1;
const AUTO_INTERVAL_MS = 180;

const earButtons = document.querySelectorAll("[data-ear]");
const modeButtons = document.querySelectorAll("[data-mode]");
const frequencyButtons = document.querySelectorAll("[data-frequency]");
const levelSlider = document.getElementById("level-slider");
const levelValue = document.getElementById("level-value");
const playButton = document.getElementById("play-tone");
const saveButton = document.getElementById("save-threshold");
const resetButton = document.getElementById("reset-results");
const currentEarLabel = document.getElementById("current-ear-label");
const currentFrequencyLabel = document.getElementById("current-frequency-label");
const lastSavedLabel = document.getElementById("last-saved-label");
const resultsBody = document.getElementById("results-body");
const copyOutput = document.getElementById("copy-output");
const copyResultsButton = document.getElementById("copy-results");

function ensureAudio() {
  if (audioContext) {
    return;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  audioContext = new AudioContextClass();

  // Ganancia maestra para controlar la salida global.
  masterGain = audioContext.createGain();
  masterGain.gain.value = 0.9;

  // El paneo estereo envia el tono al oido izquierdo o derecho.
  panner = typeof audioContext.createStereoPanner === "function"
    ? audioContext.createStereoPanner()
    : null;

  if (panner) {
    panner.pan.value = -1;
    panner.connect(masterGain);
  }

  if (panner) {
    masterGain.connect(audioContext.destination);
  } else {
    masterGain.connect(audioContext.destination);
  }
}

function getLinearGainFromSlider(value) {
  if (value <= 0) {
    return 0;
  }

  // Convierte la escala 0-100 a una curva logaritmica similar a dB relativos.
  return Math.pow(10, (value - 100) / 20);
}

function updateEarUI() {
  earButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.ear === selectedEar);
  });
  currentEarLabel.textContent = selectedEar === "left" ? "Izquierdo" : "Derecho";
  if (panner) {
    panner.pan.value = selectedEar === "left" ? -1 : 1;
  }
}

function updateFrequencyUI() {
  frequencyButtons.forEach((button) => {
    button.classList.toggle("is-active", Number(button.dataset.frequency) === selectedFrequency);
  });
  currentFrequencyLabel.textContent = selectedFrequency + " Hz";
}

function updateLevelUI() {
  levelValue.textContent = levelSlider.value;
}

function updateModeUI() {
  modeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mode === testMode);
  });

  levelSlider.disabled = testMode === "auto";
  levelSlider.setAttribute("aria-disabled", testMode === "auto" ? "true" : "false");
  saveButton.disabled = testMode === "auto";
  saveButton.textContent = testMode === "auto" ? "Registro automático activo" : "Registrar umbral";

  if (!isPlaying) {
    playButton.textContent = testMode === "auto"
      ? "Mantén pulsado para búsqueda automática"
      : "Mantén pulsado para reproducir el tono";
  }
}

function applyCurrentSliderGain(rampSeconds = 0.05) {
  if (!isPlaying || !currentToneGain || !audioContext) {
    return;
  }

  const now = audioContext.currentTime;
  const nextGain = Math.max(getLinearGainFromSlider(Number(levelSlider.value)), 0.0001);
  currentToneGain.gain.cancelScheduledValues(now);
  currentToneGain.gain.setValueAtTime(Math.max(currentToneGain.gain.value, 0.0001), now);
  currentToneGain.gain.linearRampToValueAtTime(nextGain, now + rampSeconds);
}

function stopAutoRamp() {
  if (autoRampTimer) {
    clearInterval(autoRampTimer);
    autoRampTimer = null;
  }
}

function startAutoRamp() {
  stopAutoRamp();
  autoRampTimer = setInterval(() => {
    if (!isPlaying) {
      stopAutoRamp();
      return;
    }

    const current = Number(levelSlider.value);
    const next = Math.min(100, current + AUTO_STEP);

    if (next !== current) {
      levelSlider.value = String(next);
      updateLevelUI();
      applyCurrentSliderGain(0.04);
    }

    if (next >= 100) {
      stopAutoRamp();
    }
  }, AUTO_INTERVAL_MS);
}

function registerThreshold(source = "Manual") {
  const value = Number(levelSlider.value);
  results[selectedFrequency][selectedEar] = value;
  lastSavedLabel.textContent = `${selectedFrequency} Hz · ${selectedEar === "left" ? "Izquierdo" : "Derecho"} · ${value}/100 · ${source}`;
  renderResults();
}

function buildCopyText() {
  const header = "Frecuencia\tOído izquierdo\tOído derecho";
  const rows = frequencies.map((freq) => {
    const row = results[freq];
    const left = row.left === null ? "-" : row.left;
    const right = row.right === null ? "-" : row.right;
    return `${freq} Hz\t${left}\t${right}`;
  });

  return [
    "Resultados de audiometría casera (niveles relativos 0-100)",
    header,
    ...rows
  ].join("\n");
}

function renderResults() {
  resultsBody.innerHTML = "";

  frequencies.forEach((freq) => {
    const row = results[freq];
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${freq} Hz</strong></td>
      <td>${row.left === null ? "Pendiente" : row.left + " / 100"}</td>
      <td>${row.right === null ? "Pendiente" : row.right + " / 100"}</td>
    `;
    resultsBody.appendChild(tr);
  });

  copyOutput.value = buildCopyText();
}

async function resumeAudioContext() {
  ensureAudio();
  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }
}

async function startTone() {
  if (isPlaying) {
    return;
  }

  await resumeAudioContext();
  ensureAudio();

  // El oscilador genera el tono puro de la frecuencia seleccionada.
  currentOscillator = audioContext.createOscillator();
  currentOscillator.type = "sine";
  currentOscillator.frequency.value = selectedFrequency;

  // Esta ganancia local permite aplicar fade-in/fade-out sin clics.
  currentToneGain = audioContext.createGain();
  if (testMode === "auto") {
    levelSlider.value = "0";
    updateLevelUI();
  }
  const targetGain = getLinearGainFromSlider(Number(levelSlider.value));
  const now = audioContext.currentTime;

  currentToneGain.gain.cancelScheduledValues(now);
  currentToneGain.gain.setValueAtTime(0.0001, now);
  currentToneGain.gain.linearRampToValueAtTime(Math.max(targetGain, 0.0001), now + 0.1);

  if (panner) {
    panner.pan.value = selectedEar === "left" ? -1 : 1;
    currentOscillator.connect(currentToneGain);
    currentToneGain.connect(panner);
  } else {
    currentOscillator.connect(currentToneGain);
    currentToneGain.connect(masterGain);
  }

  currentOscillator.start();
  isPlaying = true;
  playButton.classList.add("is-playing");
  playButton.textContent = testMode === "auto"
    ? "Suelta cuando empieces a oírlo"
    : "Soltar para detener el tono";

  if (testMode === "auto") {
    startAutoRamp();
  }
}

function stopTone({ registerAuto = true } = {}) {
  if (!isPlaying || !currentOscillator || !currentToneGain || !audioContext) {
    return;
  }

  const shouldRegisterAuto = testMode === "auto" && registerAuto;
  stopAutoRamp();

  const now = audioContext.currentTime;
  const stopAt = now + 0.1;
  currentToneGain.gain.cancelScheduledValues(now);
  currentToneGain.gain.setValueAtTime(Math.max(currentToneGain.gain.value, 0.0001), now);
  currentToneGain.gain.linearRampToValueAtTime(0.0001, stopAt);

  currentOscillator.stop(stopAt + 0.02);
  currentOscillator.onended = () => {
    currentOscillator.disconnect();
    currentToneGain.disconnect();
    currentOscillator = null;
    currentToneGain = null;
  };

  isPlaying = false;
  playButton.classList.remove("is-playing");
  playButton.textContent = testMode === "auto"
    ? "Mantén pulsado para búsqueda automática"
    : "Mantén pulsado para reproducir el tono";

  if (shouldRegisterAuto) {
    registerThreshold("Auto");
  }
}

earButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectedEar = button.dataset.ear;
    updateEarUI();
  });
});

frequencyButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectedFrequency = Number(button.dataset.frequency);
    updateFrequencyUI();

    if (isPlaying && currentOscillator) {
      currentOscillator.frequency.setValueAtTime(selectedFrequency, audioContext.currentTime);
    }
  });
});

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (isPlaying) {
      return;
    }
    testMode = button.dataset.mode;
    updateModeUI();
  });
});

levelSlider.addEventListener("input", () => {
  updateLevelUI();
  applyCurrentSliderGain(0.05);
});

["pointerup", "pointercancel", "pointerleave"].forEach((eventName) => {
  playButton.addEventListener(eventName, stopTone);
});

playButton.addEventListener("pointerdown", async (event) => {
  event.preventDefault();
  playButton.setPointerCapture(event.pointerId);
  await startTone();
});

playButton.addEventListener("keydown", async (event) => {
  if ((event.code === "Space" || event.code === "Enter") && !event.repeat) {
    event.preventDefault();
    await startTone();
  }
});

playButton.addEventListener("keyup", (event) => {
  if (event.code === "Space" || event.code === "Enter") {
    event.preventDefault();
    stopTone();
  }
});

saveButton.addEventListener("click", () => {
  registerThreshold("Manual");
});

resetButton.addEventListener("click", () => {
  frequencies.forEach((freq) => {
    results[freq].left = null;
    results[freq].right = null;
  });
  lastSavedLabel.textContent = "Sin registrar";
  renderResults();
});

copyResultsButton.addEventListener("click", async () => {
  const text = buildCopyText();
  copyOutput.value = text;

  try {
    await navigator.clipboard.writeText(text);
    copyResultsButton.textContent = "Resultados copiados";
    setTimeout(() => {
      copyResultsButton.textContent = "Copiar resultados";
    }, 1800);
  } catch (error) {
    copyOutput.focus();
    copyOutput.select();
    copyResultsButton.textContent = "Copia manual: Ctrl+C";
    setTimeout(() => {
      copyResultsButton.textContent = "Copiar resultados";
    }, 2200);
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopTone({ registerAuto: false });
  }
});

updateEarUI();
updateModeUI();
updateFrequencyUI();
updateLevelUI();
renderResults();
