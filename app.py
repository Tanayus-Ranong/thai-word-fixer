"""Flask webapp for Thai Word document post-processing."""
import os
import io
import uuid
import tempfile
from flask import Flask, render_template, request, send_file, jsonify, abort
from werkzeug.utils import secure_filename

from thai_processor import process_docx

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 25 * 1024 * 1024  # 25 MB

ALLOWED_EXTENSIONS = {"docx"}


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/process", methods=["POST"])
def process():
    if "file" not in request.files:
        return jsonify({"ok": False, "error": "ไม่พบไฟล์ที่อัปโหลด"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"ok": False, "error": "ไม่ได้เลือกไฟล์"}), 400

    if not allowed_file(file.filename):
        return jsonify({"ok": False, "error": "รองรับเฉพาะไฟล์ .docx เท่านั้น"}), 400

    opts = {
        "force_font": request.form.get("force_font", "true") == "true",
        "force_lang": request.form.get("force_lang", "true") == "true",
        "inject_cs": request.form.get("inject_cs", "true") == "true",
        "convert_justify": request.form.get("convert_justify", "true") == "true",
        "no_proof": request.form.get("no_proof", "false") == "true",
    }

    original_name = secure_filename(file.filename)
    base, ext = os.path.splitext(original_name)
    if not base:
        base = "document"

    tmp_dir = tempfile.mkdtemp(prefix="thaiword_")
    in_path = os.path.join(tmp_dir, original_name)
    out_path = os.path.join(tmp_dir, f"{base}_thai-fixed.docx")

    try:
        file.save(in_path)
        stats = process_docx(in_path, out_path, opts)
    except Exception as e:
        return jsonify({"ok": False, "error": f"เกิดข้อผิดพลาด: {str(e)}"}), 500

    download_id = uuid.uuid4().hex
    app.config.setdefault("DOWNLOADS", {})[download_id] = {
        "path": out_path,
        "name": f"{base}_thai-fixed.docx",
        "tmp_dir": tmp_dir,
    }

    return jsonify({
        "ok": True,
        "download_id": download_id,
        "filename": f"{base}_thai-fixed.docx",
        "stats": stats,
    })


@app.route("/download/<download_id>")
def download(download_id):
    downloads = app.config.get("DOWNLOADS", {})
    info = downloads.get(download_id)
    if not info or not os.path.exists(info["path"]):
        abort(404)
    return send_file(
        info["path"],
        as_attachment=True,
        download_name=info["name"],
        mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )


@app.errorhandler(413)
def too_large(e):
    return jsonify({"ok": False, "error": "ไฟล์ใหญ่เกินไป (จำกัด 25 MB)"}), 413


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
