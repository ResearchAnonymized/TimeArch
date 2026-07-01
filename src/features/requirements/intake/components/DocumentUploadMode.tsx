import { useState } from "react";
import { ChevronDown, Loader2, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export function DocumentUploadMode({
  onProcess,
  processing,
  onBack,
}: {
  onProcess: (text: string, mode: string) => void;
  processing: boolean;
  onBack: () => void;
}) {
  const [pastedText, setPastedText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileLoading(true);
    setFileName(file.name);
    try {
      if (file.type === "text/plain" || file.name.endsWith(".md") || file.name.endsWith(".csv")) {
        const text = await file.text();
        setPastedText(text);
      } else if (file.type === "application/json") {
        const text = await file.text();
        setPastedText(text);
      } else if (
        file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        file.name.endsWith(".docx")
      ) {
        const JSZip = (await import("jszip")).default;
        const zip = await JSZip.loadAsync(file);
        const docXml = await zip.file("word/document.xml")?.async("string");
        if (docXml) {
          const text = docXml
            .replace(/<w:p[^>]*>/g, "\n")
            .replace(/<w:tab\/>/g, "\t")
            .replace(/<[^>]+>/g, "")
            .replace(/\n{3,}/g, "\n\n")
            .trim();
          setPastedText(text);
        } else {
          toast.error("Could not read DOCX content");
        }
      } else if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
        // Use unpdf — works in the browser, handles compressed content
        // streams (the naive BT/ET regex fails on virtually every modern PDF).
        const { extractText, getDocumentProxy, renderPageAsImage } = await import("unpdf");
        const buf = new Uint8Array(await file.arrayBuffer());
        const pdf = await getDocumentProxy(buf);
        const { text, totalPages } = await extractText(pdf, { mergePages: true });
        const extracted = (Array.isArray(text) ? text.join("\n\n") : text).trim();
        if (extracted.length > 50) {
          setPastedText(extracted);
          toast.success(`Extracted ${extracted.length.toLocaleString()} chars from ${totalPages} page${totalPages === 1 ? "" : "s"}`);
        } else {
          // OCR fallback for scanned / image-only PDFs.
          const maxPages = Math.min(totalPages, 20);
          const toastId = toast.loading(
            `No embedded text found. Running OCR on ${maxPages} page${maxPages === 1 ? "" : "s"}…${totalPages > maxPages ? ` (first ${maxPages} of ${totalPages})` : ""}`,
          );
          try {
            const Tesseract = (await import("tesseract.js")).default;
            // Reuse a single worker across pages for speed.
            const worker = await Tesseract.createWorker("eng", 1, {
              logger: (m: { status: string; progress: number }) => {
                if (m.status === "recognizing text") {
                  toast.loading(
                    `OCR: ${Math.round(m.progress * 100)}%`,
                    { id: toastId },
                  );
                }
              },
            });
            const pageTexts: string[] = [];
            // Re-open the proxy because extractText may have consumed it.
            const pdfForRender = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
            for (let i = 1; i <= maxPages; i++) {
              toast.loading(`OCR page ${i} / ${maxPages}…`, { id: toastId });
              const dataUrl = (await renderPageAsImage(pdfForRender, i, {
                scale: 2,
                toDataURL: true,
              })) as string;
              const { data } = await worker.recognize(dataUrl);
              if (data.text?.trim()) pageTexts.push(data.text.trim());
            }
            await worker.terminate();
            const ocrText = pageTexts.join("\n\n").trim();
            if (ocrText.length > 50) {
              setPastedText(ocrText);
              toast.success(
                `OCR extracted ${ocrText.length.toLocaleString()} chars from ${maxPages} page${maxPages === 1 ? "" : "s"}${totalPages > maxPages ? ` (of ${totalPages})` : ""}. Review before extracting.`,
                { id: toastId },
              );
            } else {
              toast.error(
                "OCR could not read any text. Try a higher-quality scan or paste the content manually.",
                { id: toastId },
              );
              setFileName(null);
            }
          } catch (ocrErr) {
            console.error("OCR error:", ocrErr);
            toast.error("OCR failed. Please paste the content manually.", { id: toastId });
            setFileName(null);
          }
        }
      } else if (file.type.startsWith("image/")) {
        // OCR on image uploads (screenshots, photos of documents, whiteboards).
        const toastId = toast.loading(`Running OCR on ${file.name}…`);
        try {
          const Tesseract = (await import("tesseract.js")).default;
          const worker = await Tesseract.createWorker("eng", 1, {
            logger: (m: { status: string; progress: number }) => {
              if (m.status === "recognizing text") {
                toast.loading(`OCR: ${Math.round(m.progress * 100)}%`, { id: toastId });
              }
            },
          });
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          });
          const { data } = await worker.recognize(dataUrl);
          await worker.terminate();
          const ocrText = (data.text || "").trim();
          if (ocrText.length > 20) {
            setPastedText(ocrText);
            toast.success(
              `OCR extracted ${ocrText.length.toLocaleString()} chars. Review before extracting.`,
              { id: toastId },
            );
          } else {
            toast.error("OCR could not read any text. Try a higher-resolution image.", { id: toastId });
            setFileName(null);
          }
        } catch (ocrErr) {
          console.error("Image OCR error:", ocrErr);
          toast.error("OCR failed on image. Please paste the content manually.", { id: toastId });
          setFileName(null);
        }
      } else {
        try {
          const text = await file.text();
          if (text.trim()) {
            setPastedText(text);
          } else {
            toast.error("Unsupported file format. Use .txt, .md, .docx, .pdf, image, .csv, or .json files.");
            setFileName(null);
          }
        } catch {
          toast.error("Could not read file. Try .txt, .md, .docx, .pdf, image, .csv, or .json.");
          setFileName(null);
        }
      }
    } catch (err) {
      console.error("File read error:", err);
      toast.error("Failed to read file");
      setFileName(null);
    } finally {
      setFileLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
      >
        <ChevronDown className="h-3 w-3 rotate-90" /> Back to methods
      </button>

      <label className="block cursor-pointer rounded-xl border-2 border-dashed border-primary/20 bg-gradient-to-b from-primary/5 to-transparent p-8 text-center hover:border-primary/40 transition-colors">
        <input
          type="file"
          className="hidden"
          accept=".txt,.md,.csv,.json,.docx,.pdf,image/*"
          onChange={handleFileChange}
          disabled={processing || fileLoading}
        />
        <div className="h-12 w-12 rounded-xl bg-primary/15 flex items-center justify-center mx-auto mb-4">
          {fileLoading ? (
            <Loader2 className="h-6 w-6 text-primary animate-spin" />
          ) : (
            <Upload className="h-6 w-6 text-primary" />
          )}
        </div>
        {fileName ? (
          <>
            <p className="font-display font-bold text-base mb-1 text-primary">{fileName}</p>
            <p className="text-xs text-muted-foreground">
              File loaded successfully. Click to choose a different file.
            </p>
          </>
        ) : (
          <>
            <p className="font-display font-bold text-base mb-1">Upload or Drop a Document</p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Supports <span className="font-semibold">.txt</span>,{" "}
              <span className="font-semibold">.md</span>,{" "}
              <span className="font-semibold">.docx</span>,{" "}
              <span className="font-semibold">.pdf</span>,{" "}
              <span className="font-semibold">.csv</span>,{" "}
              <span className="font-semibold">.json</span>,{" "}
              <span className="font-semibold">images (OCR)</span>
            </p>
          </>
        )}
      </label>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground font-medium">or paste content</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <Textarea
        value={pastedText}
        onChange={(e) => {
          setPastedText(e.target.value);
          if (!e.target.value) setFileName(null);
        }}
        placeholder="Paste your document content here... (SRS, BRD, product brief, RFP, proposal, etc.)"
        className="min-h-[180px] text-sm bg-card"
      />

      <Button
        onClick={() => onProcess(pastedText, "document")}
        disabled={!pastedText.trim() || processing}
        className="w-full gap-2 h-11"
      >
        {processing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        {processing ? "Extracting Requirements..." : "Extract & Analyze Requirements"}
      </Button>
    </div>
  );
}
