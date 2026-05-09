# วิธีติดตั้ง Skill `thai-word-docs`

## ขั้นตอนติดตั้ง (Windows)

1. เปิด File Explorer
2. ไปที่โฟลเดอร์ `%USERPROFILE%\.claude\skills\` (ปกติคือ `C:\Users\<ชื่อผู้ใช้>\.claude\skills\`)
   - ถ้ายังไม่มีโฟลเดอร์ `skills` ให้สร้างขึ้น
3. คัดลอกโฟลเดอร์ `_skill_thai-word-docs` ทั้งโฟลเดอร์ไปวางไว้ใน `skills`
4. **เปลี่ยนชื่อโฟลเดอร์** จาก `_skill_thai-word-docs` เป็น `thai-word-docs` (ลบ `_skill_` ที่ขึ้นต้น)
5. โครงสร้างสุดท้ายควรเป็น:
   ```
   C:\Users\<ชื่อผู้ใช้>\.claude\skills\thai-word-docs\
   ├── SKILL.md
   ├── INSTALL.md
   └── scripts\
       └── inject-cs.py
   ```
6. รีสตาร์ต Cowork (ปิด-เปิดแอปใหม่)
7. ทดสอบ: ถามว่า "อะไรคือ skill thai-word-docs" หรือ "skill ไหนช่วยแก้ปัญหาตัวอักษรไทยยืด" — Claude ควรเห็น skill นี้

## ขั้นตอนติดตั้ง (macOS / Linux)

1. เปิด Terminal
2. รัน:
   ```bash
   mkdir -p ~/.claude/skills
   cp -r "/path/to/_skill_thai-word-docs" ~/.claude/skills/thai-word-docs
   ```
3. รีสตาร์ต Cowork

## วิธีใช้งาน

Skill นี้จะ trigger อัตโนมัติเมื่อ:
- ผู้ใช้ขอสร้างเอกสาร Word ภาษาไทย (แผนการสอน เอกสารราชการ บันทึกข้อความ รายงาน)
- ผู้ใช้รายงานปัญหาในเอกสาร Word: ตัวอักษรยืด, ตัดบรรทัดผิด, ฟอนต์เพี้ยน, เส้นใต้แดง

ถ้าอยากเรียกใช้ตรง ๆ พิมพ์ `/thai-word-docs` ในแชต

## ทดสอบสคริปต์ inject-cs.py

```bash
# Post-process เอกสาร .docx ใด ๆ
python3 ~/.claude/skills/thai-word-docs/scripts/inject-cs.py input.docx output.docx
```

จะแสดงผลเช่น:
```
runs: 145 → 627 (+482)  cs flags: 0 → 302 (+302)
```
