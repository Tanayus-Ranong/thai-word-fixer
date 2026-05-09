// Thai Word document post-processor — browser version.
// Ports thai_processor.py to JS. Operates on document.xml strings.

const THAI_RE = /[฀-๿]/;
const THAI_RE_G = /[฀-๿]/;
const THAI_FONT = "TH Sarabun New";

const RUN_RE = /<w:r(\s[^>]*)?>([\s\S]*?)<\/w:r>/g;
const RPR_RE = /<w:rPr>([\s\S]*?)<\/w:rPr>/;
const RPR_FULL_RE = /<w:rPr>[\s\S]*?<\/w:rPr>/;
const WT_RE = /<w:t(\s+xml:space="preserve")?>([^<]*)<\/w:t>/;
const WT_RE_G = /<w:t(\s+xml:space="preserve")?>([^<]*)<\/w:t>/g;
const PARAGRAPH_RE = /<w:p(\s[^>]*)?>([\s\S]*?)<\/w:p>/g;
const PPR_RE = /<w:pPr>([\s\S]*?)<\/w:pPr>/;
const PPR_FULL_RE = /<w:pPr>[\s\S]*?<\/w:pPr>/;
const RFONTS_RE = /<w:rFonts\s[^/]*\/>/;
const LANG_RE = /<w:lang\s[^/]*\/>/;
const JC_RE = /<w:jc\s+w:val="([^"]*)"\s*\/>/;

function hasThai(s) {
  return THAI_RE.test(s);
}

function isThaiChar(c) {
  return THAI_RE.test(c);
}

function splitTextByScript(text) {
  if (!text) return [];
  const segments = [];
  let current = "";
  let currentThai = null;
  for (const ch of text) {
    const chThai = isThaiChar(ch);
    if (currentThai === null) {
      currentThai = chThai;
      current = ch;
    } else if (chThai === currentThai) {
      current += ch;
    } else {
      segments.push([current, currentThai]);
      current = ch;
      currentThai = chThai;
    }
  }
  if (current) segments.push([current, currentThai]);
  return segments;
}

function normalizeRFonts(rprInner, force) {
  if (!force) return rprInner;
  const newFonts =
    `<w:rFonts w:ascii="${THAI_FONT}" w:hAnsi="${THAI_FONT}" ` +
    `w:cs="${THAI_FONT}" w:eastAsia="${THAI_FONT}"/>`;
  if (RFONTS_RE.test(rprInner)) {
    return rprInner.replace(RFONTS_RE, newFonts);
  }
  return newFonts + rprInner;
}

function normalizeLang(rprInner, force) {
  if (!force) return rprInner;
  const newLang = '<w:lang w:val="th-TH" w:eastAsia="th-TH" w:bidi="th-TH"/>';
  if (LANG_RE.test(rprInner)) {
    return rprInner.replace(LANG_RE, newLang);
  }
  return rprInner + newLang;
}

function addCs(rprInner) {
  if (rprInner.indexOf("<w:cs/>") !== -1) return rprInner;
  return rprInner + "<w:cs/>";
}

function addNoProof(rprInner) {
  if (rprInner.indexOf("<w:noProof/>") !== -1) return rprInner;
  return rprInner + "<w:noProof/>";
}

function buildRpr(inner) {
  if (!inner) return "";
  return `<w:rPr>${inner}</w:rPr>`;
}

function transformRprInner(rprInner, isThaiRun, opts) {
  let out = rprInner || "";
  if (opts.forceFont !== false) out = normalizeRFonts(out, true);
  if (opts.forceLang !== false) out = normalizeLang(out, true);
  if (isThaiRun && opts.injectCs !== false) out = addCs(out);
  if (opts.noProof) out = addNoProof(out);
  return out;
}

function processRun(match, attrs, inner, opts, stats) {
  attrs = attrs || "";
  const rprMatch = inner.match(RPR_FULL_RE);
  const rprFull = rprMatch ? rprMatch[0] : "";
  const rprInnerMatch = inner.match(RPR_RE);
  const rprInner = rprInnerMatch ? rprInnerMatch[1] : "";

  const wtMatch = inner.match(WT_RE);
  if (!wtMatch) {
    const newRprInner = transformRprInner(rprInner, false, opts);
    const newRpr = buildRpr(newRprInner);
    let innerNew;
    if (rprFull) innerNew = inner.replace(rprFull, newRpr);
    else innerNew = newRpr + inner;
    return `<w:r${attrs}>${innerNew}</w:r>`;
  }

  const spaceAttr = wtMatch[1] || "";
  const text = wtMatch[2];

  let cleaned = inner;
  if (rprFull) cleaned = cleaned.replace(rprFull, "");
  cleaned = cleaned.replace(WT_RE, "").trim();

  if (cleaned) {
    const newRprInner = transformRprInner(rprInner, hasThai(text), opts);
    const newRpr = buildRpr(newRprInner);
    let innerNew;
    if (rprFull) innerNew = inner.replace(rprFull, newRpr);
    else innerNew = newRpr + inner;
    return `<w:r${attrs}>${innerNew}</w:r>`;
  }

  if (!text) {
    const newRprInner = transformRprInner(rprInner, false, opts);
    const newRpr = buildRpr(newRprInner);
    return `<w:r${attrs}>${newRpr}<w:t${spaceAttr}>${text}</w:t></w:r>`;
  }

  if (!hasThai(text)) {
    const newRprInner = transformRprInner(rprInner, false, opts);
    const newRpr = buildRpr(newRprInner);
    return `<w:r${attrs}>${newRpr}<w:t${spaceAttr}>${text}</w:t></w:r>`;
  }

  const segments = splitTextByScript(text);
  if (segments.length === 1) {
    const newRprInner = transformRprInner(rprInner, true, opts);
    const newRpr = buildRpr(newRprInner);
    return `<w:r${attrs}>${newRpr}<w:t${spaceAttr}>${text}</w:t></w:r>`;
  }

  const out = [];
  for (const [segText, segThai] of segments) {
    const segRprInner = transformRprInner(rprInner, segThai, opts);
    const segRpr = buildRpr(segRprInner);
    out.push(`<w:r${attrs}>${segRpr}<w:t xml:space="preserve">${segText}</w:t></w:r>`);
  }
  stats.runsAfter += segments.length - 1;
  return out.join("");
}

function processParagraphAlignment(match, attrs, inner, opts, stats) {
  if (opts.convertJustify === false) return match;
  attrs = attrs || "";

  // Check if any run inside contains Thai text
  let paragraphHasThai = false;
  let m;
  RUN_RE.lastIndex = 0;
  while ((m = RUN_RE.exec(inner)) !== null) {
    const runInner = m[2];
    const wt = runInner.match(WT_RE);
    if (wt && hasThai(wt[2])) {
      paragraphHasThai = true;
      break;
    }
  }
  RUN_RE.lastIndex = 0;
  if (!paragraphHasThai) return match;

  const pprMatch = inner.match(PPR_RE);
  const pprFullMatch = inner.match(PPR_FULL_RE);
  if (!pprMatch || !pprFullMatch) return match;

  const pprInner = pprMatch[1];
  const jcMatch = pprInner.match(JC_RE);
  if (!jcMatch) return match;

  if (jcMatch[1] === "both") {
    const newJc = '<w:jc w:val="thaiDistribute"/>';
    const newPprInner = pprInner.replace(JC_RE, newJc);
    const newPpr = `<w:pPr>${newPprInner}</w:pPr>`;
    const newInner = inner.replace(pprFullMatch[0], newPpr);
    stats.justifyConverted += 1;
    return `<w:p${attrs}>${newInner}</w:p>`;
  }
  return match;
}

function countMatches(s, sub) {
  let count = 0;
  let pos = 0;
  while ((pos = s.indexOf(sub, pos)) !== -1) {
    count++;
    pos += sub.length;
  }
  return count;
}

function processXml(xml, opts, stats) {
  stats.runsBefore = countMatches(xml, "<w:r>") + countMatches(xml, "<w:r ");
  stats.csBefore = countMatches(xml, "<w:cs/>");
  stats.thaiDistributeBefore = countMatches(xml, 'w:val="thaiDistribute"');

  RUN_RE.lastIndex = 0;
  let newXml = xml.replace(RUN_RE, (m, attrs, inner) =>
    processRun(m, attrs, inner, opts, stats)
  );
  PARAGRAPH_RE.lastIndex = 0;
  newXml = newXml.replace(PARAGRAPH_RE, (m, attrs, inner) =>
    processParagraphAlignment(m, attrs, inner, opts, stats)
  );

  stats.runsAfter = countMatches(newXml, "<w:r>") + countMatches(newXml, "<w:r ");
  stats.csAfter = countMatches(newXml, "<w:cs/>");
  stats.thaiDistributeAfter = countMatches(newXml, 'w:val="thaiDistribute"');
  stats.fontsNormalized = countMatches(newXml, `w:cs="${THAI_FONT}"`);
  stats.langsNormalized = countMatches(newXml, 'w:bidi="th-TH"');
  return newXml;
}

const SKIP_FILES = new Set([
  "settings.xml",
  "styles.xml",
  "fontTable.xml",
  "webSettings.xml",
  "theme1.xml",
  "numbering.xml",
]);

/**
 * Process a .docx ArrayBuffer.
 * @param {ArrayBuffer} buffer  raw docx bytes
 * @param {object} opts  { forceFont, forceLang, injectCs, convertJustify, noProof }
 * @returns {Promise<{ blob: Blob, stats: object }>}
 */
async function processDocx(buffer, opts = {}) {
  const stats = {
    runsBefore: 0,
    runsAfter: 0,
    csBefore: 0,
    csAfter: 0,
    thaiDistributeBefore: 0,
    thaiDistributeAfter: 0,
    justifyConverted: 0,
    fontsNormalized: 0,
    langsNormalized: 0,
  };

  const zip = await JSZip.loadAsync(buffer);
  const wordFolder = zip.folder("word");
  if (!wordFolder) {
    throw new Error("ไฟล์ไม่ใช่ .docx ที่ถูกต้อง (ไม่พบโฟลเดอร์ word/)");
  }

  // Collect target files inside word/
  const targets = [];
  zip.forEach((relativePath, file) => {
    if (file.dir) return;
    if (!relativePath.startsWith("word/")) return;
    const name = relativePath.substring(5);
    if (name.includes("/")) return; // skip subfolders like word/media
    if (!name.endsWith(".xml")) return;
    if (SKIP_FILES.has(name)) return;
    targets.push(relativePath);
  });

  for (const path of targets) {
    const xml = await zip.file(path).async("string");
    if (xml.indexOf("<w:r") === -1) continue;
    const newXml = processXml(xml, opts, stats);
    zip.file(path, newXml);
  }

  const blob = await zip.generateAsync({
    type: "blob",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    compression: "DEFLATE",
  });

  return {
    blob,
    stats: {
      runs_before: stats.runsBefore,
      runs_after: stats.runsAfter,
      runs_added: stats.runsAfter - stats.runsBefore,
      cs_before: stats.csBefore,
      cs_after: stats.csAfter,
      cs_added: stats.csAfter - stats.csBefore,
      thai_distribute_before: stats.thaiDistributeBefore,
      thai_distribute_after: stats.thaiDistributeAfter,
      justify_converted: stats.justifyConverted,
      fonts_normalized: stats.fontsNormalized,
      langs_normalized: stats.langsNormalized,
    },
  };
}

window.thaiProcessor = { processDocx };
