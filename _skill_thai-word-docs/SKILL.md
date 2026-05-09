---
name: thai-word-docs
description: จัดการเอกสาร Word ภาษาไทยให้ถูกต้องตามมาตรฐาน — ฟอนต์ TH Sarabun New ครบ 4 slot, lang ครบ 3 ค่า, complex script flag (<w:cs/>) ใน run ภาษาไทย เพื่อให้ Word ตัดบรรทัดที่ขอบเขตคำไทยได้ถูกต้อง และใช้ thaiDistribute alignment สำหรับเนื้อหายาว ใช้ Skill นี้ทุกครั้งที่สร้างหรือแก้ไขเอกสาร Word ที่มีเนื้อหาภาษาไทย โดยเฉพาะ "เอกสารราชการ", "แผนการสอน", "บันทึกข้อความ", "รายงาน", "หนังสือราชการ", หรือเมื่อผู้ใช้พูดถึงปัญหา "ตัวอักษรไทยยืด", "ตัดบรรทัดผิด", "ฟอนต์เพี้ยน", "เส้นใต้สีแดง", "ขยายตัวอักษร" ในเอกสาร .docx ใช้ Skill นี้ทันทีก่อนเริ่มสร้างหรือแก้ไขเอกสาร — ไม่ใช่หลังจากสร้างเสร็จแล้ว
---

# thai-word-docs — มาตรฐานเอกสาร Word ภาษาไทย

## เป้าหมายของ Skill

เอกสาร Word ภาษาไทยมี 5 ปัญหาที่พบบ่อย ถ้าตั้งค่า OOXML ไม่ครบ:

1. **ฟอนต์เพี้ยน** — ตัวอักษรไทยแสดงเป็นฟอนต์สำรอง (เช่น Tahoma, Browallia) แทน TH Sarabun New
2. **ตัดคำผิดเวลา copy/paste** — ขาด `w:cs` ใน `<w:rFonts>` ทำให้ Word ใช้ฟอนต์ ASCII กับ complex script
3. **เส้นใต้สีแดง spell-check** — ภาษาไทยถูก spell-check เป็นภาษาอื่นเพราะขาด `<w:lang>`
4. **ตัดบรรทัดผิดธรรมชาติ** — Word ตัดบรรทัดที่ space เท่านั้น ไม่ตัดที่ขอบเขตคำไทย ทำให้บรรทัดยาว/กระจายตัวอักษรเป็นรายตัวเมื่อ justify
5. **Justify ขยายตัวอักษรเป็นรายตัว** — เกิดจากปัญหาข้อ 4 รวมกับ alignment ผิด

Skill นี้ครอบคลุมการสร้างเอกสาร .docx ที่ถูกต้องครบทุกข้อ และ post-process ไฟล์ที่มีอยู่ให้ใช้งานได้

## Inputs ที่ต้องการ

ก่อนเริ่ม ขอ input เหล่านี้ (ถ้ายังไม่มีให้ถาม):

1. **เนื้อหาเอกสาร** — ข้อความ/โครงสร้างที่ต้องการ
2. **ประเภทเอกสาร** — บันทึกข้อความ, แผนการสอน, รายงาน, หนังสือราชการ ฯลฯ (มีผลต่อรูปแบบ)
3. **ขนาดฟอนต์ที่ต้องการ** — default 18pt bold (หัวข้อ) / 16pt (เนื้อหา) — ปรับตามที่ผู้ใช้ขอ

## หลักการที่ต้องทำให้ครบ

### 1. ฟอนต์ — ต้องตั้งทั้ง 4 slot ใน `<w:rFonts>`

```xml
<w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New"
          w:cs="TH Sarabun New" w:eastAsia="TH Sarabun New"/>
```

**เหตุผล:** Word เลือกฟอนต์ตาม script ของตัวอักษร — ASCII ใช้ ascii, ไทย/อาหรับ/ฮีบรู (complex script) ใช้ cs, จีน/ญี่ปุ่น/เกาหลี ใช้ eastAsia ขาด **`w:cs`** ตัวเดียว → ตัวอักษรไทยแสดงเป็นฟอนต์สำรองที่ Word เลือกให้เอง (มักไม่สวย)

### 2. Language — ตั้งครบ 3 ค่าใน `<w:lang>`

```xml
<w:lang w:val="th-TH" w:eastAsia="th-TH" w:bidi="th-TH"/>
```

**เหตุผล:**
- `w:val` = locale ของ ASCII (เพื่อ spell-check ภาษาอังกฤษถูก)
- `w:eastAsia` = locale ของ East Asian text
- `w:bidi` = locale ของ complex script (ไทย/อาหรับ/ฮีบรู) — **สำคัญสำหรับการตัดคำไทย**

### 3. Complex Script flag `<w:cs/>` — ในทุก run ที่มีตัวอักษรไทย

```xml
<w:r>
  <w:rPr>
    <w:rFonts .../>
    <w:lang .../>
    <w:cs/>  <!-- บอก Word ว่า run นี้เป็น complex script -->
  </w:rPr>
  <w:t>เนื้อหาภาษาไทย</w:t>
</w:r>
```

**เหตุผล:** flag นี้เป็นกุญแจสำคัญที่หลายคนข้าม — เมื่อมี `<w:cs/>` Word จะใช้ **Thai dictionary line breaker** ตัดบรรทัดที่ **ขอบเขตคำ** ภาษาไทย ขาด flag นี้ Word จะใช้กฎตัดบรรทัดของอังกฤษ (ตัดที่ space เท่านั้น) ทำให้ข้อความไทยยาวเกินบรรทัดหรือเมื่อ justify ก็จะกระจายตัวอักษรเป็นรายตัวอักษร

### 4. แยก run ตามภาษา (ไทย vs ไม่ใช่ไทย)

Run ที่ผสมไทย+อังกฤษใน `<w:t>` เดียวจะใช้ flag `<w:cs/>` ไม่ได้ผล เพราะ flag เปิดทั้ง run ทำให้ภาษาอังกฤษถูกประมวลผลด้วยกฎ complex script

**ต้องแยก run** เช่น "เวลา 2 ชั่วโมง (Active Learning) ใช้กระบวนการ":
```xml
<w:r><w:rPr><...><w:cs/></w:rPr><w:t>เวลา</w:t></w:r>
<w:r><w:rPr>...</w:rPr><w:t xml:space="preserve"> 2 </w:t></w:r>
<w:r><w:rPr><...><w:cs/></w:rPr><w:t>ชั่วโมง</w:t></w:r>
<w:r><w:rPr>...</w:rPr><w:t xml:space="preserve"> (Active Learning) </w:t></w:r>
<w:r><w:rPr><...><w:cs/></w:rPr><w:t>ใช้กระบวนการ</w:t></w:r>
```

### 5. Alignment — ใช้ thaiDistribute สำหรับเนื้อหายาว

```xml
<w:pPr>
  <w:jc w:val="thaiDistribute"/>
</w:pPr>
```

**เหตุผล:** เมื่อ run ภาษาไทยมี `<w:cs/>` แล้ว Word จะตัดบรรทัดที่ขอบเขตคำ — `thaiDistribute` จะกระจาย **ช่องว่างระหว่างคำ** ให้พอดีบรรทัด (สวย ไม่มีช่องว่างใหญ่ท้ายบรรทัด)

ใช้ `thaiDistribute` กับ:
- ย่อหน้าเนื้อหายาว (essence, รายละเอียดกิจกรรม, คำอธิบาย)

ใช้ `LEFT` (default) กับ:
- หัวข้อ (heading)
- รายการ bullet/numbered list
- เซลล์ตารางที่แคบ
- บรรทัดลายเซ็น
- ข้อความสั้น 1 บรรทัด

**ห้ามใช้** `<w:jc w:val="both"/>` (justify ปกติ) กับเนื้อหาไทย — ภาษาไทยไม่มีช่องว่างระหว่างคำให้ขยาย Word จะขยาย space แค่ที่มี ทำให้ช่องว่างใหญ่ผิดธรรมชาติ

### 6. noProof — ปิด spell-check แบบเลือกใช้

ใส่ `<w:noProof/>` ใน rPr ของ run เพื่อปิดเส้นใต้สีแดง spell-check
- ใส่กับ run ภาษาอังกฤษเทคนิคที่ Word ไม่รู้จัก (เช่น cout, scanf)
- หรือทุก run ถ้าไม่ต้องการเส้นแดงเลย

หมายเหตุ: noProof ไม่ส่งผลต่อการตัดบรรทัด — กฎข้างบนยังต้องครบ

## Workflow แนะนำ

### กรณีสร้างเอกสารใหม่ด้วย docx-js

```javascript
const FONT_OBJ = {
  ascii: "TH Sarabun New",
  hAnsi: "TH Sarabun New",
  cs: "TH Sarabun New",
  eastAsia: "TH Sarabun New"
};
const LANG_OBJ = {
  value: "th-TH",
  eastAsia: "th-TH",
  bidirectional: "th-TH"  // ← docx-js ใช้ "bidirectional" map เป็น w:bidi
};

const T = (text, opts = {}) => new TextRun({
  text,
  font: FONT_OBJ,
  size: opts.size || 32,  // 16pt
  language: LANG_OBJ,
  noProof: true,
  bold: opts.bold,
});

const P = (runs, opts = {}) => new Paragraph({
  children: Array.isArray(runs) ? runs : [runs],
  alignment: opts.alignment === "JUSTIFIED"
    ? AlignmentType.THAI_DISTRIBUTE   // ← map JUSTIFIED ไป thaiDistribute
    : opts.alignment,
  ...
});
```

หลัง generate ไฟล์ → **ต้อง post-process** เพราะ docx-js ไม่มี API ตรงสำหรับ:
- `<w:cs/>` flag
- การ split run by script

### กรณี post-process ไฟล์ .docx ที่มีอยู่

ใช้ script `scripts/inject-cs.py` ที่มาในแพ็กเกจนี้

```bash
python3 inject-cs.py input.docx output.docx
```

Script จะทำ 2 อย่าง:
1. **แยก `<w:r>` ที่ผสมไทย+อังกฤษ** ออกเป็นหลาย runs ตามภาษา (clone rPr ครบ)
2. **inject `<w:cs/>`** ใน rPr ของ run ที่มีตัวอักษรไทย

### ตรวจสอบผลลัพธ์ (verify)

หลัง process แล้ว ให้ตรวจ OOXML:

```bash
python3 unpack.py output.docx /tmp/check
grep -c '<w:cs/>' /tmp/check/word/document.xml      # ควรมีหลายร้อย run
grep -c 'thaiDistribute' /tmp/check/word/document.xml  # ตามจำนวนย่อหน้าเนื้อหา
grep -c 'TH Sarabun New' /tmp/check/word/document.xml  # ทุก run ควรมี
```

เปิดในไฟล์ Word จริงเพื่อยืนยัน:
- ฟอนต์ TH Sarabun New
- ไม่มีเส้นใต้แดง
- บรรทัดตัดที่ขอบเขตคำไทย (ไม่ใช่ที่ space เท่านั้น)
- เนื้อหายาวกระจายช่องว่างสวย ไม่มีตัวอักษรยืด

## ข้อห้าม

1. **อย่าใช้ฟอนต์ default** ของ docx-js (Calibri/Aptos) — ภาษาไทยจะแสดงเป็นฟอนต์สำรองที่ไม่สวย
2. **อย่าตั้ง `body.font.*` แบบ global** — จะ stamp เฉพาะย่อหน้าที่มีอยู่ตอนเรียก ย่อหน้าใหม่จะไม่ได้รับ
3. **อย่าขาด `w:cs` ใน `<w:rFonts>`** — ทำให้ตัดคำผิดเวลา copy/paste ไป app อื่น
4. **อย่าขาด `<w:cs/>` flag ใน Thai run** — ทำให้ Word ตัดบรรทัดผิด
5. **อย่ารวมไทย+อังกฤษใน run เดียว** — ต้องแยก run ก่อนใส่ flag
6. **อย่าใช้ Justify (w:val="both")** กับเนื้อหาไทยล้วน — ทำให้ space ขยายผิดธรรมชาติ
7. **อย่าใช้ thaiDistribute โดยไม่มี `<w:cs/>` flag** — จะกระจาย**ตัวอักษรเป็นรายตัว** (ดูยืดผิดธรรมชาติ) ไม่ใช่กระจายช่องว่างระหว่างคำ

## หมายเหตุเทคนิค

### docx-js property mapping

| OOXML | docx-js TextRun property |
|---|---|
| `<w:rFonts>` 4 slots | `font: { ascii, hAnsi, cs, eastAsia }` (object form) |
| `<w:lang w:val/eastAsia/bidi>` | `language: { value, eastAsia, bidirectional }` |
| `<w:noProof/>` | `noProof: true` |
| `<w:cs/>` flag | **ไม่มี API** — ต้อง post-process |
| `<w:jc w:val="thaiDistribute"/>` | `alignment: AlignmentType.THAI_DISTRIBUTE` |

### Style names ใน Word locale ไทย

เอกสารที่สร้างจาก Word locale ไทย ชื่อ style เป็นภาษาไทย: Normal = "ปกติ" — ใช้ `styleBuiltIn` เปรียบเทียบ ไม่ใช่ `style`

### Output

หลังเสร็จงาน — ส่งมอบไฟล์ .docx ที่ post-process แล้ว พร้อมรายงานผลตรวจ OOXML สั้น ๆ:
- จำนวน runs ก่อน/หลัง
- จำนวน `<w:cs/>` ที่ inject
- จำนวนย่อหน้า thaiDistribute

หากผู้ใช้รายงานว่ายังเห็นปัญหาเดิม ให้ unpack ไฟล์ตรวจ OOXML จริง — อย่าเดา
