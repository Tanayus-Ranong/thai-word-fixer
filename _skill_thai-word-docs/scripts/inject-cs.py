#!/usr/bin/env python3
"""
Post-process .docx for Thai-language line-breaking.

Two operations:
  1) Split each <w:r>...</w:r> whose text contains a mix of Thai and non-Thai
     into separate runs by script transition. All split runs share the original rPr.
  2) For runs whose text contains Thai characters, inject <w:cs/> into <w:rPr>.
     This flag tells Word to use complex-script line-break rules (Thai dictionary)
     so wrapping happens at word boundaries — not just at spaces.
"""
import re
import sys
import zipfile
import os
import tempfile

THAI_RANGE_RE = re.compile(r"[฀-๿]")

def is_thai_char(c):
    return bool(THAI_RANGE_RE.match(c))

def has_thai(s):
    return bool(THAI_RANGE_RE.search(s))

def split_text_by_script(text):
    """Split a string into runs of [(text, is_thai), ...].
    Whitespace and punctuation attach to the run before them."""
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
            # Script transition — flush current segment
            segments.append((current, current_thai))
            current = ch
            current_thai = ch_thai
    if current:
        segments.append((current, current_thai))
    return segments

def add_cs_to_rpr(rpr_xml):
    """Insert <w:cs/> into <w:rPr> (or create if no rPr)."""
    if rpr_xml is None or rpr_xml == "":
        return "<w:rPr><w:cs/></w:rPr>"
    if "<w:cs/>" in rpr_xml:
        return rpr_xml  # already there
    # Insert before </w:rPr>
    return re.sub(r"</w:rPr>", "<w:cs/></w:rPr>", rpr_xml, count=1)

# Match a complete <w:r ...>...</w:r> block (non-greedy)
RUN_RE = re.compile(r"<w:r(\s[^>]*)?>(.*?)</w:r>", re.DOTALL)
# Inside a run: <w:rPr>...</w:rPr>
RPR_RE = re.compile(r"<w:rPr>(.*?)</w:rPr>", re.DOTALL)
# Inside a run: <w:t>...</w:t> (capture xml:space attr)
WT_RE = re.compile(r'<w:t(\s+xml:space="preserve")?>([^<]*)</w:t>', re.DOTALL)

def process_run(match):
    full = match.group(0)
    attrs = match.group(1) or ""
    inner = match.group(2)

    # Extract rPr block (full element)
    rpr_match = re.search(r"<w:rPr>.*?</w:rPr>", inner, re.DOTALL)
    rpr_full = rpr_match.group(0) if rpr_match else ""

    # Extract text element
    wt_match = WT_RE.search(inner)
    if not wt_match:
        # No text element — leave as is (could be break, tab, etc.)
        # But if Thai-related markers, still process — for now just return
        return full

    space_attr = wt_match.group(1) or ""
    text = wt_match.group(2)

    if not text:
        return full

    # Capture non-text inner content (other elements like <w:tab/>, <w:br/>)
    # For simplicity, we only handle runs that have only rPr + text. Skip otherwise.
    # Test: inner stripped of rPr and text should be empty/whitespace
    cleaned = inner
    if rpr_full:
        cleaned = cleaned.replace(rpr_full, "", 1)
    cleaned = WT_RE.sub("", cleaned, count=1).strip()
    if cleaned:
        # Run has additional elements — only inject cs if Thai, don't split
        if has_thai(text):
            new_rpr = add_cs_to_rpr(rpr_full)
            inner_new = inner
            if rpr_full:
                inner_new = inner.replace(rpr_full, new_rpr, 1)
            else:
                inner_new = new_rpr + inner
            return f"<w:r{attrs}>{inner_new}</w:r>"
        return full

    # Now: run has rPr (or none) + single <w:t>. Process it.
    if not has_thai(text):
        # No Thai — leave run unchanged
        return full

    # Check if mixed
    segments = split_text_by_script(text)
    if len(segments) == 1:
        # Pure Thai (or pure non-Thai but we already checked has_thai)
        # Just inject cs flag
        new_rpr = add_cs_to_rpr(rpr_full)
        return f"<w:r{attrs}>{new_rpr}<w:t{space_attr}>{text}</w:t></w:r>"

    # Mixed — generate multiple runs
    out = []
    for seg_text, seg_thai in segments:
        seg_rpr = add_cs_to_rpr(rpr_full) if seg_thai else (rpr_full or "")
        # Always preserve whitespace
        seg_space = ' xml:space="preserve"'
        out.append(f"<w:r{attrs}>{seg_rpr}<w:t{seg_space}>{seg_text}</w:t></w:r>")
    return "".join(out)

def process_xml(xml):
    return RUN_RE.sub(process_run, xml)

def main(input_docx, output_docx):
    with tempfile.TemporaryDirectory() as tmp:
        # Extract
        with zipfile.ZipFile(input_docx, "r") as z:
            z.extractall(tmp)
        # Patch document.xml
        doc_path = os.path.join(tmp, "word", "document.xml")
        with open(doc_path, "r", encoding="utf-8") as f:
            xml = f.read()
        new_xml = process_xml(xml)
        with open(doc_path, "w", encoding="utf-8") as f:
            f.write(new_xml)
        # Repack
        if os.path.exists(output_docx):
            os.remove(output_docx)
        with zipfile.ZipFile(output_docx, "w", zipfile.ZIP_DEFLATED) as z:
            for root, dirs, files in os.walk(tmp):
                for file in files:
                    full_path = os.path.join(root, file)
                    arc = os.path.relpath(full_path, tmp)
                    z.write(full_path, arc)
        before_runs = xml.count("<w:r>") + xml.count("<w:r ")
        after_runs = new_xml.count("<w:r>") + new_xml.count("<w:r ")
        before_cs = xml.count("<w:cs/>")
        after_cs = new_xml.count("<w:cs/>")
        print(f"  runs: {before_runs} → {after_runs} (+{after_runs - before_runs})  "
              f"cs flags: {before_cs} → {after_cs} (+{after_cs - before_cs})")

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
