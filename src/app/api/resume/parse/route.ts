import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import mammoth from "mammoth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

// POST /api/resume/parse  (multipart/form-data, field "file")
// Extracts plain text from a PDF or DOCX and (optionally) keeps the original
// in Supabase Storage. Returns { text, filePath }.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 413 });
  }

  const name = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  let text = "";
  try {
    if (name.endsWith(".pdf") || file.type === "application/pdf") {
      // Import lazily: pdf-parse touches the filesystem at module load.
      const pdfParse = (await import("pdf-parse")).default;
      const parsed = await pdfParse(buffer);
      text = parsed.text;
    } else if (
      name.endsWith(".docx") ||
      file.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else {
      return NextResponse.json(
        { error: "Unsupported file type. Upload a PDF or DOCX." },
        { status: 415 }
      );
    }
  } catch (err) {
    console.error("[resume/parse] extraction failed:", err);
    return NextResponse.json(
      { error: "Could not read that file. Try pasting the text instead." },
      { status: 422 }
    );
  }

  text = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) {
    return NextResponse.json(
      { error: "No text found in the file." },
      { status: 422 }
    );
  }

  // Optionally keep the original file for reference. Failure here is non-fatal.
  let filePath: string | null = null;
  try {
    const ext = name.endsWith(".pdf") ? "pdf" : "docx";
    const path = `${user.id}/resume.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("resumes")
      .upload(path, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: true,
      });
    if (!uploadError) filePath = path;
  } catch (err) {
    console.warn("[resume/parse] storage upload skipped:", err);
  }

  return NextResponse.json({ ok: true, text, filePath });
}
