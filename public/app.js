(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  const form = $("submissionForm");
  if (!form) return;

  // ==========================================
  // ELEMENTS & CONFIGURATION
  // ==========================================

  const mediaInput = $("media");
  const dropzone = document.querySelector(".dropzone");
  const statusBox = $("formStatus");
  const submitButton = form.querySelector('button[type="submit"]');
  const submitText = $("submitText");

  const previewWrap = $("previewWrap");
  const imagePreview = $("imagePreview");
  const videoPreview = $("videoPreview");
  const fileActions = $("fileActions");

  const modal = $("certificateModal");
  const canvas = $("certificateCanvas");
  const ctx = canvas.getContext("2d");

  const logo = new Image();
  logo.src = "/assets/school-emblem.png";

  const principalSignature = new Image();
  principalSignature.src = "/assets/principal-signature.png";

  let maxFileSizeMb = 100;
  let previewUrl = null;

  let certificateData = {
    name: "",
    message: "",
    className: ""
  };

  const allowedTypes = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
    "video/mp4",
    "video/quicktime",
    "video/webm",
    "video/3gpp"
  ]);

  // ==========================================
  // STATUS
  // ==========================================

  function setStatus(message, isError = false) {
    statusBox.textContent = message;
    statusBox.classList.toggle("error", isError);
    statusBox.classList.toggle("success", !isError && !!message);
  }

  // ==========================================
  // WEBSITE CONFIGURATION
  // ==========================================

  fetch("/api/config")
    .then(response => {
      if (!response.ok) throw new Error("Configuration unavailable");
      return response.json();
    })
    .then(config => {
      maxFileSizeMb = Number(config.maxFileSizeMb) || 100;

      $("maxSize").textContent = `${maxFileSizeMb} MB`;

      const whatsappLink = $("whatsappLink");

      if (config.whatsappGroupLink) {
        whatsappLink.href = config.whatsappGroupLink;
      } else {
        whatsappLink.hidden = true;
      }

      const officialLink = $("officialLink");

      const websiteUrl =
        config.officialWebsiteUrl || config.schoolWebsiteUrl;

      if (websiteUrl) {
        officialLink.href = websiteUrl;
        officialLink.hidden = false;

        const footerLink = $("officialLinkFooter");

        if (footerLink) {
          footerLink.href = websiteUrl;
          footerLink.hidden = false;
        }
      } else {
        officialLink.hidden = true;
      }
    })
    .catch(() => {
      setStatus(
        "Some page settings could not be loaded. You can still submit your entry."
      );
    });

  // ==========================================
  // FILE PREVIEW
  // ==========================================

  function revokePreview() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    previewUrl = null;

    imagePreview.removeAttribute("src");
    videoPreview.removeAttribute("src");
    videoPreview.load();

    imagePreview.hidden = true;
    videoPreview.hidden = true;
    previewWrap.hidden = true;
    fileActions.hidden = true;
  }

  function showFile(file) {
    revokePreview();

    if (!file) {
      $("fileTitle").textContent = "Choose a photo or video";

      $("fileSub").innerHTML =
        `JPG, PNG, WEBP, HEIC, MP4, MOV, WEBM · Maximum <b>${maxFileSizeMb} MB</b>`;

      $("filePreview").textContent = "";
      return;
    }

    $("fileTitle").textContent = file.name;

    $("fileSub").textContent =
      `${(file.size / 1048576).toFixed(1)} MB · ${
        file.type.startsWith("video/") ? "Video" : "Image"
      }`;

    $("filePreview").textContent = "Selected and ready to submit";

    if (
      file.type.startsWith("image/") &&
      !["image/heic", "image/heif"].includes(file.type)
    ) {
      previewUrl = URL.createObjectURL(file);

      imagePreview.src = previewUrl;
      imagePreview.hidden = false;
      previewWrap.hidden = false;

    } else if (file.type.startsWith("video/")) {
      previewUrl = URL.createObjectURL(file);

      videoPreview.src = previewUrl;
      videoPreview.hidden = false;
      previewWrap.hidden = false;
    }

    fileActions.hidden = false;
  }

  mediaInput.addEventListener("change", () => {
    showFile(mediaInput.files[0]);
  });

  $("removeFile").addEventListener("click", event => {
    event.preventDefault();

    mediaInput.value = "";
    showFile(null);
  });

  ["dragenter", "dragover"].forEach(type => {
    dropzone.addEventListener(type, event => {
      event.preventDefault();
      dropzone.classList.add("dragover");
    });
  });

  ["dragleave", "drop"].forEach(type => {
    dropzone.addEventListener(type, event => {
      event.preventDefault();
      dropzone.classList.remove("dragover");
    });
  });

  dropzone.addEventListener("drop", event => {
    const file = event.dataTransfer.files?.[0];
    if (!file) return;

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);

    mediaInput.files = dataTransfer.files;

    showFile(file);
  });

  // ==========================================
  // UPLOAD WITH PROGRESS
  // ==========================================

  function uploadWithProgress(payload) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.open("POST", "/api/submissions");
      xhr.responseType = "json";

      xhr.upload.addEventListener("progress", event => {
        if (!event.lengthComputable) return;

        const percent = Math.round(
          (event.loaded / event.total) * 100
        );

        submitText.textContent = `Uploading… ${percent}%`;

        submitButton.style.setProperty(
          "--upload-progress",
          `${percent}%`
        );
      });

      xhr.onload = () => {
        const result = xhr.response || {};

        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(result);
        } else {
          reject(
            new Error(
              result.error ||
              `Upload failed (${xhr.status}). Please try again.`
            )
          );
        }
      };

      xhr.onerror = () => {
        reject(new Error("Network error. Check your connection."));
      };

      xhr.ontimeout = () => {
        reject(new Error("Upload timed out. Please try again."));
      };

      xhr.timeout = 600000;
      xhr.send(payload);
    });
  }

  // ==========================================
  // SUBMISSION
  // ==========================================

  form.addEventListener("submit", async event => {
    event.preventDefault();

    setStatus("");

    const file = mediaInput.files[0];

    if (!file) {
      return setStatus(
        "Please choose a photo or video before submitting.",
        true
      );
    }

    if (!allowedTypes.has(file.type)) {
      return setStatus(
        "Unsupported file type. Choose JPG, PNG, WEBP, HEIC, MP4, MOV, WEBM or 3GP.",
        true
      );
    }

    if (file.size > maxFileSizeMb * 1048576) {
      return setStatus(
        `Your file is larger than ${maxFileSizeMb} MB.`,
        true
      );
    }

    if (!form.elements.consent.checked) {
      return setStatus(
        "Please confirm parent/guardian permission before submitting.",
        true
      );
    }

    submitButton.disabled = true;
    submitButton.classList.add("is-uploading");

    submitText.textContent = "Preparing upload…";

    try {
      const result = await uploadWithProgress(new FormData(form));

      certificateData = result.certificate || {
        name: form.elements.studentName.value,
        message:
          form.elements.message.value ||
          "A light for learning, compassion, and our collective tomorrow"
      };

      form.reset();
      showFile(null);

      setStatus(
        "Your entry has been submitted successfully. Your certificate is ready."
      );

      openCertificate(certificateData);

    } catch (error) {
      setStatus(
        error.message || "Submission failed. Please try again.",
        true
      );

    } finally {
      submitButton.disabled = false;
      submitButton.classList.remove("is-uploading");

      submitButton.style.removeProperty("--upload-progress");

      submitText.textContent = "Submit your diya story";
    }
  });

  // ==========================================
  // DIGITAL DIYA
  // ==========================================

  const digitalName = $("digitalName");
  const digitalThought = $("digitalThought");
  const digitalStage = $("digitalStage");
  const matchstick = $("matchstick");
  const digitalWick = $("digitalWick");
  const lightStatus = $("lightStatus");
  const digitalResult = $("digitalResult");

  let matchReady = false;

  matchstick.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      matchstick.click();
    }
  });

  matchstick.addEventListener("click", () => {
    if (!digitalName.value.trim()) {
      digitalName.focus();
      lightStatus.textContent = "Enter your name to begin.";
      return;
    }

    matchReady = true;
    matchstick.classList.add("ready");

    lightStatus.textContent =
      "The match is lit. Now touch the diya wick.";
  });

  function lightDigitalDiya() {
    if (!matchReady || digitalStage.classList.contains("lit")) {
      return;
    }

    digitalStage.classList.add("lit");

    matchReady = false;
    matchstick.classList.remove("ready");

    const name = digitalName.value.trim().slice(0, 60);
    const thought = digitalThought.value;

    lightStatus.textContent =
      "Your diya is glowing. Your promise matters.";

    $("digitalResultName").textContent = name;
    $("digitalResultThought").textContent = thought;

    digitalResult.hidden = false;

    certificateData = {
      name,
      message: thought
    };
  }

  digitalWick.addEventListener("click", lightDigitalDiya);

  digitalWick.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      lightDigitalDiya();
    }
  });

  $("digitalCertificate").addEventListener("click", () => {
    openCertificate(certificateData);
  });

  // ==========================================
  // CERTIFICATE OF HONOR
  // ==========================================


function drawCertificate(data) {
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;

  if (!w || !h) return;

  ctx.clearRect(0, 0, w, h);

  // Premium dark certificate background
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, "#090a11");
  bg.addColorStop(0.52, "#11121b");
  bg.addColorStop(1, "#080910");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Frame: keep a safe margin around every footer element
  ctx.strokeStyle = "#e7b900";
  ctx.lineWidth = Math.max(3, w * 0.0028);
  ctx.strokeRect(w * 0.025, h * 0.035, w * 0.95, h * 0.94);

  ctx.strokeStyle = "rgba(231,185,0,0.42)";
  ctx.lineWidth = Math.max(1, w * 0.0011);
  ctx.strokeRect(w * 0.041, h * 0.055, w * 0.918, h * 0.90);

  // Corner ornaments
  ctx.strokeStyle = "#e7b900";
  ctx.fillStyle = "#e7b900";
  ctx.lineWidth = 2;

  for (const x of [w * 0.041, w * 0.959]) {
    for (const y of [h * 0.055, h * 0.945]) {
      ctx.beginPath();
      ctx.arc(x, y, w * 0.0085, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(x, y, w * 0.0032, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Subtle watermark
  ctx.strokeStyle = "rgba(231,185,0,0.11)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, h * 0.535, h * 0.155, 0, Math.PI * 2);
  ctx.stroke();

  function drawTextAt(value, x, y, size, color, weight = "400", font = "Arial") {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.font = `${weight} ${size}px "${font}", sans-serif`;
    ctx.fillStyle = color;
    ctx.fillText(String(value), x, y);
    ctx.restore();
  }

  function fitText(value, y, maxWidth, initialSize, color,
    style = "normal", weight = "600", font = "Georgia", minSize = 18) {
    const text = String(value || "");
    let size = initialSize;

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";

    while (size > minSize) {
      ctx.font = `${style} ${weight} ${size}px "${font}", serif`;
      if (ctx.measureText(text).width <= maxWidth) break;
      size -= 1;
    }

    let output = text;
    ctx.font = `${style} ${weight} ${size}px "${font}", serif`;

    if (ctx.measureText(output).width > maxWidth) {
      while (output.length > 3 && ctx.measureText(`${output}…`).width > maxWidth) {
        output = output.slice(0, -1);
      }
      output += "…";
    }

    ctx.fillStyle = color;
    ctx.fillText(output, cx, y);
    ctx.restore();
  }

  function drawWrappedText(value, y, maxWidth, fontSize, color, lineHeight) {
    const words = String(value || "").trim().split(/\s+/).filter(Boolean);
    if (!words.length) return;

    ctx.save();
    ctx.font = `italic 500 ${fontSize}px Georgia, serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = color;

    const lines = [];
    let line = "";

    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth || !line) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);

    const visible = lines.slice(0, 2);
    if (lines.length > 2) {
      let last = visible[1];
      while (last.length > 3 && ctx.measureText(`${last}…`).width > maxWidth) {
        last = last.slice(0, -1);
      }
      visible[1] = `${last}…`;
    }

    const firstY = y - ((visible.length - 1) * lineHeight) / 2;
    visible.forEach((text, index) => {
      ctx.fillText(text, cx, firstY + index * lineHeight);
    });
    ctx.restore();
  }

  // School emblem
  if (logo.complete && logo.naturalWidth > 0) {
    const size = Math.min(w * 0.10, h * 0.145);
    ctx.drawImage(logo, cx - size / 2, h * 0.082, size, size);
  }

  // School identity
  drawTextAt("ST. COLUMBUS PUBLIC SCHOOL", cx, h * 0.285,
    w * 0.026, "#fff0a6", "bold", "Georgia");
  drawTextAt("EKDARA · JHAJHA", cx, h * 0.315,
    w * 0.009, "#d5b95c", "500");

  // Certificate heading
  fitText("CERTIFICATE OF HONOR", h * 0.415, w * 0.84,
    w * 0.052, "#fff8e9", "normal", "bold", "Georgia", w * 0.026);

  ctx.strokeStyle = "#e7b900";
  ctx.lineWidth = Math.max(2, w * 0.0022);
  ctx.beginPath();
  ctx.moveTo(w * 0.36, h * 0.44);
  ctx.lineTo(w * 0.64, h * 0.44);
  ctx.stroke();

  // Event and award details
  drawTextAt("DIYA PRAJWALAN INITIATIVE · DIWALI 2026",
    cx, h * 0.48, w * 0.014, "#c5c5cf", "500");
  drawTextAt("This certificate is proudly and honorably awarded to",
    cx, h * 0.55, w * 0.014, "#e8e6df");

  const studentName = String(data.name || "Student Participant")
    .trim().slice(0, 60);
  fitText(studentName, h * 0.635, w * 0.78, w * 0.044,
    "#ffe28c", "italic", "600", "Georgia", w * 0.025);

  drawTextAt("for kindling the divine flame of wisdom, good values,",
    cx, h * 0.705, w * 0.014, "#efede8");
  drawTextAt("and environmental responsibility.",
    cx, h * 0.735, w * 0.014, "#efede8");

  const promise = String(
    data.message ||
    "A light for learning, compassion, and our collective tomorrow"
  ).trim().slice(0, 120);

  drawWrappedText(`“${promise}”`, h * 0.795, w * 0.78,
    w * 0.018, "#ffdc4c", h * 0.027);

  // Footer divider
  ctx.strokeStyle = "rgba(231,185,0,0.32)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(w * 0.12, h * 0.845);
  ctx.lineTo(w * 0.88, h * 0.845);
  ctx.stroke();

  // Principal signature and details — aligned as one left-side block
  if (principalSignature.complete && principalSignature.naturalWidth > 0) {
    const signatureWidth = w * 0.15;
    const signatureHeight = signatureWidth *
      principalSignature.naturalHeight / principalSignature.naturalWidth;
    const maxHeight = h * 0.045;
    const scale = Math.min(1, maxHeight / signatureHeight);
    const drawWidth = signatureWidth * scale;
    const drawHeight = signatureHeight * scale;

    ctx.drawImage(
      principalSignature,
      w * 0.25 - drawWidth / 2,
      h * 0.855,
      drawWidth,
      drawHeight
    );
  }

  drawTextAt("PRINCIPAL", w * 0.25, h * 0.922,
    w * 0.010, "#f4d46e", "bold", "Georgia");
  drawTextAt("St. Columbus Public School", w * 0.25, h * 0.941,
    w * 0.0085, "#aaa9b3");

  // Bharat Tech Force partner block — balanced with the principal block
  drawTextAt("BHARAT TECH FORCE", w * 0.75, h * 0.922,
    w * 0.012, "#f4d46e", "bold", "Georgia");
  drawTextAt("PARTNER", w * 0.75, h * 0.941,
    w * 0.009, "#d1c5a7");

  // Date sits centrally below both footer blocks, safely inside the frame
  drawTextAt(`DATE: ${new Date().toLocaleDateString("en-IN")}`,
    cx, h * 0.958, w * 0.0075, "#858795");
}


  // ==========================================
  // OPEN CERTIFICATE
  // ==========================================

  function openCertificate(data) {
    certificateData = data || certificateData;

    drawCertificate(certificateData);

    modal.hidden = false;

    // Redraw after assets load
    if (!logo.complete) {
      logo.onload = () => drawCertificate(certificateData);
    }

    if (!principalSignature.complete) {
      principalSignature.onload = () => drawCertificate(certificateData);
    }
  }

  $("closeCertificate").addEventListener("click", () => {
    modal.hidden = true;
  });

  modal.addEventListener("click", event => {
    if (event.target === modal) {
      modal.hidden = true;
    }
  });

  // ==========================================
  // PNG GENERATOR
  // ==========================================

  function getPng() {
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (!blob) {
          reject(new Error("Could not generate certificate PNG."));
          return;
        }

        resolve(blob);
      }, "image/png");
    });
  }

  function getSafeFilename() {
    const name = String(
      certificateData.name || "participant"
    )
      .trim()
      .replace(/[^a-z0-9-]/gi, "-")
      .replace(/-+/g, "-");

    return `St-Columbus-Certificate-${name || "participant"}.png`;
  }

  // ==========================================
  // DOWNLOAD CERTIFICATE
  // ==========================================

  $("downloadCertificate").addEventListener("click", async () => {
    try {
      const blob = await getPng();

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download = getSafeFilename();

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      setTimeout(() => URL.revokeObjectURL(url), 3000);

      setStatus("Your certificate PNG has been downloaded.");

    } catch (error) {
      setStatus(error.message, true);
    }
  });

  // ==========================================
  // SHARE CERTIFICATE IMAGE
  // ==========================================

  async function shareCertificate() {
    try {
      const blob = await getPng();

      const file = new File(
        [blob],
        getSafeFilename(),
        { type: "image/png" }
      );

      const message =
        `I am honoured to be part of the Diya Prajwalan Initiative at St. Columbus Public School.\n\n` +
        `My promise: ${certificateData.message || "A light for learning"}.\n\n` +
        `#DiyaPrajwalan #StColumbusPublicSchool #BharatTechForce`;

      // Native file sharing
      if (
        navigator.share &&
        navigator.canShare &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          files: [file],
          title: "Certificate of Honor",
          text: message
        });

        setStatus(
          "Sharing completed. Select your WhatsApp Community and its Announcements destination if available."
        );

        return;
      }

      // Fallback: download image
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download = getSafeFilename();

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      setTimeout(() => URL.revokeObjectURL(url), 5000);

      // Open WhatsApp with message
      window.open(
        `https://wa.me/?text=${encodeURIComponent(message)}`,
        "_blank",
        "noopener,noreferrer"
      );

      setStatus(
        "Certificate downloaded. Attach the PNG image in WhatsApp before sending. Choose your Community's Announcements group."
      );

    } catch (error) {
      if (error.name === "AbortError") {
        return;
      }

      setStatus(
        error.message ||
        "Unable to share. Please download the PNG and share manually.",
        true
      );
    }
  }

  // Both share buttons use actual PNG sharing
  $("shareCertificate").addEventListener(
    "click",
    shareCertificate
  );

  $("whatsappCertificate").addEventListener(
    "click",
    shareCertificate
  );

  // ==========================================
  // REVEAL ANIMATIONS
  // ==========================================

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );

  document.querySelectorAll(".reveal").forEach(element => {
    observer.observe(element);
  });

})();