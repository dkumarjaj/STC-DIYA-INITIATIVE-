
"use strict";

const rows = document.getElementById("rows");
const count = document.getElementById("count");
const empty = document.getElementById("empty");

const modal = document.getElementById("mediaModal");
const mediaContent = document.getElementById("mediaContent");
const modalInfo = document.getElementById("modalInfo");

let loading = false;

function createCell(value, className = "") {
  const td = document.createElement("td");
  td.textContent = value || "—";
  if (className) td.className = className;
  return td;
}

function createMediaElement(item, large = false) {
  const isVideo = item.mimeType.startsWith("video/");

  const element = document.createElement(
    isVideo ? "video" : "img"
  );

  element.src = item.previewUrl;

  if (isVideo) {
    element.controls = large;
    element.muted = !large;
    element.playsInline = true;
    element.preload = "metadata";
  } else {
    element.alt = "Student submission";
  }

  if (large) {
    element.style.maxWidth = "95vw";
    element.style.maxHeight = "82vh";
  } else {
    element.className = "media-thumb";
  }

  return element;
}

function openPreview(item) {
  mediaContent.replaceChildren();

  const element = createMediaElement(item, true);

  mediaContent.appendChild(element);

  modalInfo.textContent =
    `${item.studentName} · ${item.className}`;

  modal.classList.add("active");
}

function closePreview() {
  modal.classList.remove("active");
  mediaContent.replaceChildren();
  modalInfo.textContent = "";
}

function createMediaCell(item) {
  const td = document.createElement("td");

  const wrapper = document.createElement("div");
  wrapper.className = "media-preview";
  wrapper.tabIndex = 0;
  wrapper.setAttribute("role", "button");
  wrapper.setAttribute(
    "aria-label",
    `Preview media submitted by ${item.studentName}`
  );

  const isVideo = item.mimeType.startsWith("video/");

  const thumbnail = createMediaElement(item);

  wrapper.appendChild(thumbnail);

  // Video indicator
  if (isVideo) {
    const badge = document.createElement("span");
    badge.textContent = "VIDEO";
    badge.style.cssText =
      "position:absolute;bottom:4px;left:4px;background:#000b;color:white;padding:3px 5px;font-size:8px;pointer-events:none;";
    wrapper.appendChild(badge);
  }

  // Hover preview
  const hover = document.createElement("div");
  hover.className = "hover-preview";

  const largePreview = createMediaElement(item);

  if (isVideo) {
    largePreview.controls = true;
    largePreview.muted = true;
  }

  hover.appendChild(largePreview);
  wrapper.appendChild(hover);

  wrapper.addEventListener("click", () => {
    openPreview(item);
  });

  wrapper.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPreview(item);
    }
  });

  td.appendChild(wrapper);

  return td;
}

function createDownloadCell(item) {
  const td = document.createElement("td");

  const link = document.createElement("a");

  link.href = item.downloadUrl;
  link.className = "download";
  link.textContent = "Download";
  link.setAttribute("download", "");

  td.appendChild(link);

  return td;
}

function renderSubmissions(data) {
  rows.replaceChildren();

  empty.hidden = data.length !== 0;

  count.textContent =
    `${data.length} submission${data.length === 1 ? "" : "s"} received`;

  data.forEach(item => {
    const tr = document.createElement("tr");

    const date = new Date(item.submittedAt);

    tr.appendChild(
      createCell(
        isNaN(date.getTime())
          ? "Unknown date"
          : date.toLocaleString("en-IN"),
        "date"
      )
    );

    tr.appendChild(
      createCell(item.studentName, "student-name")
    );

    tr.appendChild(
      createCell(item.className)
    );

    tr.appendChild(
      createCell(item.message, "message")
    );

    tr.appendChild(
      createMediaCell(item)
    );

    tr.appendChild(
      createDownloadCell(item)
    );

    rows.appendChild(tr);
  });
}

async function loadSubmissions() {
  if (loading) return;

  loading = true;

  count.textContent = "Loading submissions...";
  rows.replaceChildren();
  empty.hidden = true;

  try {
    const response = await fetch(
      "/api/admin/submissions",
      { cache: "no-store" }
    );

    if (response.status === 401) {
      throw new Error("Admin authentication required. Refresh and log in again.");
    }

    if (!response.ok) {
      throw new Error("Could not load submissions.");
    }

    const data = await response.json();

    renderSubmissions(data);

  } catch (error) {
    count.textContent = error.message;
    empty.hidden = false;

  } finally {
    loading = false;
  }
}

document
  .getElementById("refresh")
  .addEventListener("click", loadSubmissions);

document
  .getElementById("closeMedia")
  .addEventListener("click", closePreview);

modal.addEventListener("click", event => {
  if (event.target === modal) {
    closePreview();
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closePreview();
  }
});

loadSubmissions();
