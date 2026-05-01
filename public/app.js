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

  const formData = new FormData();
  formData.append("image", selectedImageBlob, selectedImageName);

  setStatus("Analyzing image...");
  analyzeBtn.disabled = true;
  resultOutput.textContent = "Please wait...";

  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      body: formData
    });

    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Analysis failed.");
    }

    resultOutput.textContent = JSON.stringify(data.data, null, 2);
    setStatus("Analysis complete.");
  } catch (error) {
    resultOutput.textContent = "Error";
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
