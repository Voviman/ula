const fileInput = document.getElementById("fileInput");
const startCameraBtn = document.getElementById("startCameraBtn");
const captureBtn = document.getElementById("captureBtn");
const stopCameraBtn = document.getElementById("stopCameraBtn");
const analyzeBtn = document.getElementById("analyzeBtn");
const cameraPreview = document.getElementById("cameraPreview");
const captureCanvas = document.getElementById("captureCanvas");
const imagePreview = document.getElementById("imagePreview");
const statusText = document.getElementById("statusText");
const resultOutput = document.getElementById("resultOutput");

let stream = null;
let selectedImageBlob = null;
let selectedImageName = "image.jpg";
let previewUrl = null;

function setStatus(text) {
  statusText.textContent = text;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function prettyValue(value, fallback = "Unknown") {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  return escapeHtml(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function formatConfidence(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "Unknown";
  }
  return `${Math.round(value * 100)}%`;
}

function renderChips(values, emptyText = "Unknown") {
  const list = asArray(values).filter(Boolean);
  if (list.length === 0) {
    return `<p class="muted">${emptyText}</p>`;
  }
  return `<div class="chips">${list.map((item) => `<span class="chip">${escapeHtml(item)}</span>`).join("")}</div>`;
}

function renderComposition(composition) {
  const list = asArray(composition);
  if (list.length === 0) {
    return "Unknown";
  }

  return list
    .map((part) => {
      const material = prettyValue(part?.material);
      const percent = typeof part?.percent === "number" ? `${part.percent}%` : "n/a";
      return `${material} (${percent})`;
    })
    .join(", ");
}

function renderItems(items) {
  const list = asArray(items);
  if (list.length === 0) {
    return '<p class="muted">No garment items detected.</p>';
  }

  return list
    .map((item, index) => {
      const title = prettyValue(item?.garmentType, `Item ${index + 1}`);
      return `
        <article class="item-card">
          <h4 class="item-header">${index + 1}. ${title}</h4>
          <div class="overview-grid">
            <div class="fact">
              <div class="fact-label">Category</div>
              <div class="fact-value">${prettyValue(item?.category)}</div>
            </div>
            <div class="fact">
              <div class="fact-label">Brand</div>
              <div class="fact-value">${prettyValue(item?.brand?.name)}</div>
            </div>
            <div class="fact">
              <div class="fact-label">Brand confidence</div>
              <div class="fact-value">${formatConfidence(item?.brand?.confidence)}</div>
            </div>
            <div class="fact">
              <div class="fact-label">Item confidence</div>
              <div class="fact-value">${formatConfidence(item?.confidence)}</div>
            </div>
            <div class="fact">
              <div class="fact-label">Pattern</div>
              <div class="fact-value">${prettyValue(item?.pattern)}</div>
            </div>
            <div class="fact">
              <div class="fact-label">Condition</div>
              <div class="fact-value">${prettyValue(item?.condition)}</div>
            </div>
          </div>
          <div class="overview-block">
            <div class="fact-label">Composition</div>
            <div class="fact-value">${renderComposition(item?.composition)}</div>
          </div>
          <div class="overview-block">
            <div class="fact-label">Colors</div>
            ${renderChips(item?.colors)}
          </div>
          <div class="overview-block">
            <div class="fact-label">Style tags</div>
            ${renderChips(item?.styleTags)}
          </div>
          <div class="overview-block">
            <div class="fact-label">Seasons</div>
            ${renderChips(item?.season)}
          </div>
        </article>
      `;
    })
    .join("");
}

function renderOverview(data) {
  const summary = prettyValue(data?.summary, "No summary.");
  const itemsHtml = renderItems(data?.items);
  const metadata = data?.metadata || {};

  resultOutput.innerHTML = `
    <section class="overview-block">
      <h3 class="overview-title">Summary</h3>
      <p>${summary}</p>
    </section>
    <section class="overview-block">
      <h3 class="overview-title">Detected Items</h3>
      ${itemsHtml}
    </section>
    <section class="overview-block">
      <h3 class="overview-title">Metadata</h3>
      <div class="overview-grid">
        <div class="fact">
          <div class="fact-label">Image quality</div>
          <div class="fact-value">${prettyValue(metadata?.imageQuality)}</div>
        </div>
        <div class="fact">
          <div class="fact-label">Shoot type</div>
          <div class="fact-value">${prettyValue(metadata?.shootType)}</div>
        </div>
      </div>
      <div class="overview-block">
        <div class="fact-label">Notes</div>
        ${renderChips(metadata?.notes, "No notes")}
      </div>
    </section>
  `;
}

function setPreview(blob) {
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
  }
  previewUrl = URL.createObjectURL(blob);
  imagePreview.src = previewUrl;
  imagePreview.style.display = "block";
}

function setSelectedImage(blob, fileName) {
  selectedImageBlob = blob;
  selectedImageName = fileName || "image.jpg";
  analyzeBtn.disabled = !selectedImageBlob;
  setPreview(blob);
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.readAsDataURL(blob);
  });
}

async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true });
    cameraPreview.srcObject = stream;
    cameraPreview.style.display = "block";
    captureBtn.disabled = false;
    stopCameraBtn.disabled = false;
    startCameraBtn.disabled = true;
    setStatus("Camera started. Click Capture photo.");
  } catch (error) {
    setStatus(`Cannot access camera: ${error.message}`);
  }
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }
  cameraPreview.srcObject = null;
  cameraPreview.style.display = "none";
  captureBtn.disabled = true;
  stopCameraBtn.disabled = true;
  startCameraBtn.disabled = false;
}

function capturePhoto() {
  if (!stream) return;

  const width = cameraPreview.videoWidth || 1280;
  const height = cameraPreview.videoHeight || 720;
  captureCanvas.width = width;
  captureCanvas.height = height;

  const ctx = captureCanvas.getContext("2d");
  ctx.drawImage(cameraPreview, 0, 0, width, height);

  captureCanvas.toBlob(
    (blob) => {
      if (!blob) {
        setStatus("Failed to capture photo.");
        return;
      }
      setSelectedImage(blob, `captured-${Date.now()}.jpg`);
      setStatus("Photo captured.");
    },
    "image/jpeg",
    0.92
  );
}

async function analyzeImage() {
  if (!selectedImageBlob) {
    setStatus("Select or capture an image first.");
    return;
  }

  setStatus("Analyzing image...");
  analyzeBtn.disabled = true;
  resultOutput.innerHTML = '<p class="muted">Please wait...</p>';

  try {
    const imageDataUrl = await blobToDataUrl(selectedImageBlob);
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        imageDataUrl,
        fileName: selectedImageName
      })
    });

    const rawText = await response.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (_error) {
      throw new Error(`Server returned non-JSON response (${response.status}).`);
    }

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Analysis failed.");
    }

    renderOverview(data.data);
    setStatus("Analysis complete.");
  } catch (error) {
    resultOutput.innerHTML = '<p class="error-text">Failed to load analysis result.</p>';
    setStatus(error.message || "Unexpected error during analysis.");
  } finally {
    analyzeBtn.disabled = false;
  }
}

fileInput.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  setSelectedImage(file, file.name);
  setStatus("Image selected.");
});

startCameraBtn.addEventListener("click", startCamera);
captureBtn.addEventListener("click", capturePhoto);
stopCameraBtn.addEventListener("click", () => {
  stopCamera();
  setStatus("Camera stopped.");
});
analyzeBtn.addEventListener("click", analyzeImage);

window.addEventListener("beforeunload", () => {
  stopCamera();
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
  }
});
