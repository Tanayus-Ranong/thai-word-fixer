"""
Thai Word document post-processor.

Applies all 6 standards from the thai-word-docs skill:
  1. Font TH Sarabun New on all 4 rFonts slots
  2. Language tag with 3 values (val/eastAsia/bidi = th-TH)
  3. Complex Script flag <w:cs/> in every Thai run
  4. Split mixed runs by script (Thai vs non-Thai)
  5. Convert Justify (w:val="both") to thaiDistribute for paragraphs with Thai
  6. Optional noProof to disable red spell-check underlines
"""
import re
import zipfile
import os
import tempfile
import shutil

THAI_RANGE_RE = re.compile(r"[฀-๿]")
THAI_FONT = "TH Sarabun New"

RUN_RE = re.compile(r"<w:r(\s[^>]*)?>(.*?)</w:r>", re.DOTALL)
RPR_RE = re.compile(r"<w:rPr>(.*?)</w:rPr>", re.DOTALL)
WT_RE = re.compile(r'<w:t(\s+xml:space="preserve")?>([^<]*)</w:t>', re.DOTALL)
PARAGRAPH_RE = re.compile(r"<w:p(\s[^>]*)?>(.*?)</w:p>", re.DOTALL)
PPR_RE = re.compile(r"<w:pPr>(.*?)</w:pPr>", re.DOTALL)
RFONTS_RE = re.compile(r"<w:rFonts\s[^/]*/>")
LANG_RE = re.compile(r"<w:lang\s[^/]*/>")
JC_RE = re.compile(r'<w:jc\s+w:val="([^"]*)"\s*/>')


def has_thai(s):
    return bool(THAI_RANGE_RE.search(s))


def is_thai_char(c):
    return bool(THAI_RANGE_RE.match(c))


def split_text_by_script(text):
    """Split text into segments of [(text, is_thai), ...]."""
    if not text:
        return []
    segments = []
    current = ""
    current_thai = None
    for ch in text:
        ch_thai = is_thai_char(ch)
        if current_thai is None:
            current_thai = ch_thai
            current = ch
        elif ch_thai == current_thai:
            current += ch
        else:
            segments.append((current, current_thai))
            current = ch
            current_thai = ch_thai
    if current:
        segments.append((current, current_thai))
    return segments


def normalize_rfonts(rpr_xml, force_font=True):
    """Ensure <w:rFonts> uses TH Sarabun New on all 4 slots."""
    if not force_font:
        return rpr_xml
    new_rfonts = (
        f'<w:rFonts w:ascii="{THAI_FONT}" w:hAnsi="{THAI_FONT}" '
        f'w:cs="{THAI_FONT}" w:eastAsia="{THAI_FONT}"/>'
    )
    if RFONTS_RE.search(rpr_xml):
        return RFONTS_RE.sub(new_rfonts, rpr_xml, count=1)
    return new_rfonts + rpr_xml


def normalize_lang(rpr_xml, force_lang=True):
    """Ensure <w:lang> has all 3 values set to th-TH."""
    if not force_lang:
        return rpr_xml
    new_lang = '<w:lang w:val="th-TH" w:eastAsia="th-TH" w:bidi="th-TH"/>'
    if LANG_RE.search(rpr_xml):
        return LANG_RE.sub(new_lang, rpr_xml, count=1)
    return rpr_xml + new_lang


def add_cs(rpr_xml):
    """Insert <w:cs/> if not present."""
    if "<w:cs/>" in rpr_xml:
        return rpr_xml
    return rpr_xml + "<w:cs/>"


def add_no_proof(rpr_xml):
    """Insert <w:noProof/> if not present."""
    if "<w:noProof/>" in rpr_xml:
        return rpr_xml
    return rpr_xml + "<w:noProof/>"


def build_rpr(inner_xml):
    """Wrap inner xml in <w:rPr> tags (or empty if no inner)."""
    if not inner_xml:
        return ""
    return f"<w:rPr>{inner_xml}</w:rPr>"


def transform_rpr_inner(rpr_inner, is_thai_run, opts):
    """Apply font, language, cs flag, noProof transforms to rPr inner xml."""
    out = rpr_inner or ""
    if opts.get("force_font", True):
        out = normalize_rfonts(out, True)
    if opts.get("force_lang", True):
        out = normalize_lang(out, True)
    if is_thai_run and opts.get("inject_cs", True):
        out = add_cs(out)
    if opts.get("no_proof", False):
        out = add_no_proof(out)
    return out


class Stats:
    def __init__(self):
        self.runs_before = 0
        self.runs_after = 0
        self.cs_before = 0
        self.cs_after = 0
        self.thai_distribute_before = 0
        self.thai_distribute_after = 0
        self.justify_converted = 0
        self.fonts_normalized = 0
        self.langs_normalized = 0


def process_run(match, opts, stats):
    full = match.group(0)
    attrs = match.group(1) or ""
    inner = match.group(2)

    rpr_match = RPR_RE.search(inner)
    rpr_full = rpr_match.group(0) if rpr_match else ""
    rpr_inner = rpr_match.group(1) if rpr_match else ""

    wt_match = WT_RE.search(inner)
    if not wt_match:
        # No <w:t> — could be break/tab/etc. Apply font/lang to rPr if Thai run not applicable, but still normalize.
        new_rpr_inner = transform_rpr_inner(rpr_inner, False, opts)
        new_rpr = build_rpr(new_rpr_inner)
        if rpr_full:
            inner_new = inner.replace(rpr_full, new_rpr, 1)
        else:
            inner_new = new_rpr + inner
        return f"<w:r{attrs}>{inner_new}</w:r>"

    space_attr = wt_match.group(1) or ""
    text = wt_match.group(2)

    cleaned = inner
    if rpr_full:
        cleaned = cleaned.replace(rpr_full, "", 1)
    cleaned = WT_RE.sub("", cleaned, count=1).strip()

    if cleaned:
        # Run has additional elements — don't split, just normalize rPr
        new_rpr_inner = transform_rpr_inner(rpr_inner, has_thai(text), opts)
        new_rpr = build_rpr(new_rpr_inner)
        if rpr_full:
            inner_new = inner.replace(rpr_full, new_rpr, 1)
        else:
            inner_new = new_rpr + inner
        return f"<w:r{attrs}>{inner_new}</w:r>"

    if not text:
        new_rpr_inner = transform_rpr_inner(rpr_inner, False, opts)
        new_rpr = build_rpr(new_rpr_inner)
        return f"<w:r{attrs}>{new_rpr}<w:t{space_attr}>{text}</w:t></w:r>"

    if not has_thai(text):
        # Non-Thai run — normalize font/lang only
        new_rpr_inner = transform_rpr_inner(rpr_inner, False, opts)
        new_rpr = build_rpr(new_rpr_inner)
        return f"<w:r{attrs}>{new_rpr}<w:t{space_attr}>{text}</w:t></w:r>"

    segments = split_text_by_script(text)
    if len(segments) == 1:
        new_rpr_inner = transform_rpr_inner(rpr_inner, True, opts)
        new_rpr = build_rpr(new_rpr_inner)
        return f"<w:r{attrs}>{new_rpr}<w:t{space_attr}>{text}</w:t></w:r>"

    # Mixed — split into multiple runs
    out = []
    for seg_text, seg_thai in segments:
        seg_rpr_inner = transform_rpr_inner(rpr_inner, seg_thai, opts)
        seg_rpr = build_rpr(seg_rpr_inner)
        seg_space = ' xml:space="preserve"'
        out.append(f"<w:r{attrs}>{seg_rpr}<w:t{seg_space}>{seg_text}</w:t></w:r>")
    stats.runs_after += len(segments) - 1
    return "".join(out)


def process_paragraph_alignment(match, opts, stats):
    """Convert Justify to thaiDistribute for paragraphs containing Thai text."""
    if not opts.get("convert_justify", True):
        return match.group(0)

    full = match.group(0)
    attrs = match.group(1) or ""
    inner = match.group(2)

    # Check if paragraph contains Thai text
    paragraph_has_thai = False
    for run_match in RUN_RE.finditer(inner):
        run_inner = run_match.group(2)
        wt = WT_RE.search(run_inner)
        if wt and has_thai(wt.group(2)):
            paragraph_has_thai = True
            break

    if not paragraph_has_thai:
        return full

    ppr_match = PPR_RE.search(inner)
    if not ppr_match:
        return full

    ppr_inner = ppr_match.group(1)
    jc_match = JC_RE.search(ppr_inner)
    if not jc_match:
        return full

    val = jc_match.group(1)
    if val == "both":
        new_jc = '<w:jc w:val="thaiDistribute"/>'
        new_ppr_inner = JC_RE.sub(new_jc, ppr_inner, count=1)
        new_ppr = f"<w:pPr>{new_ppr_inner}</w:pPr>"
        new_inner = inner.replace(ppr_match.group(0), new_ppr, 1)
        stats.justify_converted += 1
        return f"<w:p{attrs}>{new_inner}</w:p>"

    return full


def process_xml(xml, opts, stats):
    stats.runs_before = xml.count("<w:r>") + xml.count("<w:r ")
    stats.cs_before = xml.count("<w:cs/>")
    stats.thai_distribute_before = xml.count('w:val="thaiDistribute"')

    new_xml = RUN_RE.sub(lambda m: process_run(m, opts, stats), xml)
    new_xml = PARAGRAPH_RE.sub(lambda m: process_paragraph_alignment(m, opts, stats), new_xml)

    stats.runs_after = new_xml.count("<w:r>") + new_xml.count("<w:r ")
    stats.cs_after = new_xml.count("<w:cs/>")
    stats.thai_distribute_after = new_xml.count('w:val="thaiDistribute"')
    stats.fonts_normalized = new_xml.count(f'w:cs="{THAI_FONT}"')
    stats.langs_normalized = new_xml.count('w:bidi="th-TH"')
    return new_xml


def process_docx(input_path, output_path, opts=None):
    """Process a .docx file. opts is a dict with toggles."""
    if opts is None:
        opts = {}
    opts.setdefault("force_font", True)
    opts.setdefault("force_lang", True)
    opts.setdefault("inject_cs", True)
    opts.setdefault("convert_justify", True)
    opts.setdefault("no_proof", False)

    stats = Stats()

    with tempfile.TemporaryDirectory() as tmp:
        with zipfile.ZipFile(input_path, "r") as z:
            z.extractall(tmp)

        # Process all xml files under word/ that contain runs
        word_dir = os.path.join(tmp, "word")
        targets = ["document.xml", "header1.xml", "header2.xml", "header3.xml",
                   "footer1.xml", "footer2.xml", "footer3.xml", "footnotes.xml",
                   "endnotes.xml"]
        for filename in os.listdir(word_dir):
            full_path = os.path.join(word_dir, filename)
            if not os.path.isfile(full_path):
                continue
            if not filename.endswith(".xml"):
                continue
            if filename in ("settings.xml", "styles.xml", "fontTable.xml",
                            "webSettings.xml", "theme1.xml", "numbering.xml"):
                continue
            try:
                with open(full_path, "r", encoding="utf-8") as f:
                    xml = f.read()
                if "<w:r" not in xml:
                    continue
                new_xml = process_xml(xml, opts, stats)
                with open(full_path, "w", encoding="utf-8") as f:
                    f.write(new_xml)
            except (UnicodeDecodeError, OSError):
                continue

        if os.path.exists(output_path):
            os.remove(output_path)
        with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as z:
            for root, _, files in os.walk(tmp):
                for file in files:
                    full_path = os.path.join(root, file)
                    arc = os.path.relpath(full_path, tmp)
                    z.write(full_path, arc)

    return {
        "runs_before": stats.runs_before,
        "runs_after": stats.runs_after,
        "runs_added": stats.runs_after - stats.runs_before,
        "cs_before": stats.cs_before,
        "cs_after": stats.cs_after,
        "cs_added": stats.cs_after - stats.cs_before,
        "thai_distribute_before": stats.thai_distribute_before,
        "thai_distribute_after": stats.thai_distribute_after,
        "justify_converted": stats.justify_converted,
        "fonts_normalized": stats.fonts_normalized,
        "langs_normalized": stats.langs_normalized,
    }
