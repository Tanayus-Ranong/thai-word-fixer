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
  const downloadLink = document.getElementById("download-link");
  const retryBtn = document.getElementById("retry-btn");

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

  // Drag and drop
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
  });

  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  });

  retryBtn.addEventListener("click", () => {
    hideResults();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!fileInput.files[0]) return;

    hideResults();
    setLoading(true);

    const fd = new FormData();
    fd.append("file", fileInput.files[0]);
    fd.append(
      "force_font",
      form.querySelector('[name="force_font"]').checked ? "true" : "false"
    );
    fd.append(
      "force_lang",
      form.querySelector('[name="force_lang"]').checked ? "true" : "false"
    );
    fd.append(
      "inject_cs",
      form.querySelector('[name="inject_cs"]').checked ? "true" : "false"
    );
    fd.append(
      "convert_justify",
      form.querySelector('[name="convert_justify"]').checked ? "true" : "false"
    );
    fd.append(
      "no_proof",
      form.querySelector('[name="no_proof"]').checked ? "true" : "false"
    );

    try {
      const resp = await fetch("/process", { method: "POST", body: fd });
      const data = await resp.json();
      if (!data.ok) {
        showError(data.error || "ไม่ทราบสาเหตุ");
        return;
      }
      renderStats(data.stats);
      downloadLink.href = "/download/" + data.download_id;
      downloadLink.setAttribute("download", data.filename);
      resultCard.hidden = false;
      // Auto-trigger download
      const a = document.createElement("a");
      a.href = "/download/" + data.download_id;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      showError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้: " + err.message);
    } finally {
      setLoading(false);
    }
  });
})();
