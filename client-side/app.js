// Browser app — wires UI to thai-processor.js (which exposes window.thaiProcessor).
(function () {
  const form = document.getElementById("upload-form");
  const fileInput = document.getElementById("file-input");
  const dropzone = document.getElementById("dropzone");
  const dropzoneContent = dropzone.querySelector(".dropzone-content");
  const dropzoneSelected = document.getElementById("dropzone-selected");
  const fileNameEl = document.getElementById("file-name");
  const browseBtn = document.getElementById("browse-btn");
  const clearBtn = document.getElementById("clear-file");
  const submitBtn = document.getElementById("submit-btn");
  const btnText = submitBtn.querySelector(".btn-text");
  const spinner = submitBtn.querySelector(".spinner");
  const resultCard = document.getElementById("result-card");
  const errorCard = document.getElementById("error-card");
  const errorMsg = document.getElementById("error-message");
  const statsEl = document.getElementById("stats");
  const downloadBtn = document.getElementById("download-btn");
  const retryBtn = document.getElementById("retry-btn");

  let lastResult = null; // { blob, filename }

  function setFile(file) {
    if (!file) {
      fileInput.value = "";
      dropzoneContent.hidden = false;
      dropzoneSelected.hidden = true;
      submitBtn.disabled = true;
      return;
    }
    if (!file.name.toLowerCase().endsWith(".docx")) {
      showError("รองรับเฉพาะไฟล์ .docx เท่านั้น");
      return;
    }
    fileNameEl.textContent = file.name;
    dropzoneContent.hidden = true;
    dropzoneSelected.hidden = false;
    submitBtn.disabled = false;
    hideResults();
  }

  function showError(message) {
    errorMsg.textContent = message;
    errorCard.hidden = false;
    resultCard.hidden = true;
  }

  function hideResults() {
    resultCard.hidden = true;
    errorCard.hidden = true;
  }

  function setLoading(loading) {
    submitBtn.disabled = loading;
    btnText.textContent = loading ? "กำลังประมวลผล..." : "ประมวลผลและดาวน์โหลด";
    spinner.hidden = !loading;
  }

  function renderStats(stats) {
    const items = [
      { label: "Runs ก่อน", value: stats.runs_before },
      { label: "Runs หลัง", value: stats.runs_after },
      { label: "<w:cs/> ที่เพิ่ม", value: "+" + stats.cs_added },
      { label: "ฟอนต์ที่ปรับ", value: stats.fonts_normalized },
      { label: "Lang ที่ปรับ", value: stats.langs_normalized },
      { label: "Justify → thaiDist.", value: stats.justify_converted },
    ];
    statsEl.innerHTML = items
      .map(
        (s) =>
          `<div class="stat"><div class="stat-label">${s.label}</div><div class="stat-value">${s.value}</div></div>`
      )
      .join("");
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function deriveOutputName(originalName) {
    const dotIdx = originalName.lastIndexOf(".");
    const base = dotIdx > 0 ? originalName.substring(0, dotIdx) : originalName;
    return `${base}_thai-fixed.docx`;
  }

  // Drag-and-drop
  ["dragenter", "dragover"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add("dragover");
    })
  );
  ["dragleave", "drop"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove("dragover");
    })
  );
  dropzone.addEventListener("drop", (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const dt = new DataTransfer();
      dt.items.add(files[0]);
      fileInput.files = dt.files;
      setFile(files[0]);
    }
  });

  dropzone.addEventListener("click", (e) => {
    if (e.target.closest("button")) return;
    fileInput.click();
  });
  browseBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    fileInput.click();
  });
  clearBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    setFile(null);
    lastResult = null;
  });

  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) setFile(e.target.files[0]);
  });

  retryBtn.addEventListener("click", () => hideResults());

  downloadBtn.addEventListener("click", () => {
    if (lastResult) triggerDownload(lastResult.blob, lastResult.filename);
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const file = fileInput.files[0];
    if (!file) return;
    if (typeof JSZip === "undefined") {
      showError("โหลดไลบรารี JSZip ไม่สำเร็จ — ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต");
      return;
    }

    hideResults();
    setLoading(true);

    const opts = {
      forceFont: form.querySelector('[name="forceFont"]').checked,
      forceLang: form.querySelector('[name="forceLang"]').checked,
      injectCs: form.querySelector('[name="injectCs"]').checked,
      convertJustify: form.querySelector('[name="convertJustify"]').checked,
      noProof: form.querySelector('[name="noProof"]').checked,
    };

    try {
      const buffer = await file.arrayBuffer();
      const { blob, stats } = await window.thaiProcessor.processDocx(buffer, opts);
      const outName = deriveOutputName(file.name);
      lastResult = { blob, filename: outName };
      renderStats(stats);
      resultCard.hidden = false;
      triggerDownload(blob, outName);
    } catch (err) {
      console.error(err);
      showError("เกิดข้อผิดพลาด: " + (err.message || String(err)));
    } finally {
      setLoading(false);
    }
  });
})();
