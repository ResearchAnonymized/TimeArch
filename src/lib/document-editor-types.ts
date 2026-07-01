// Structured document model for the human-in-the-loop editor

export interface DocumentSection {
  id: string;
  number: string;
  title: string;
  content: string;
  order: number;
  subsections?: DocumentSection[];
  table?: { headers: string[]; rows: string[][] };
  diagram_description?: string;
  mermaid_code?: string;
}

export interface DocumentFigure {
  id: string;
  sectionId: string;
  caption: string;
  mermaidCode: string;
  order: number;
  included: boolean;
  renderedImage?: string; // data URL
}

export interface DocumentDraft {
  id: string; // artifact id
  document_title: string;
  document_type: string;
  standard_reference: string;
  version: string;
  date: string;
  project_name: string;
  executive_summary: string;
  sections: DocumentSection[];
  figures: DocumentFigure[];
  metadata: {
    generatedAt: string;
    lastEditedAt: string;
    status: "draft" | "reviewed" | "finalized";
  };
}

export function generateId(): string {
  return crypto.randomUUID();
}

/** Convert raw AI-generated document data into an editable DocumentDraft */
export function rawDocumentToDraft(
  artifactId: string,
  raw: any,
  projectName: string,
): DocumentDraft {
  const figures: DocumentFigure[] = [];
  let figOrder = 0;

  const convertSections = (rawSections: any[], parentOrder = 0): DocumentSection[] => {
    return (rawSections || []).map((s: any, i: number) => {
      const id = generateId();
      // Extract figures from mermaid_code
      if (s.mermaid_code) {
        figures.push({
          id: generateId(),
          sectionId: id,
          caption: s.diagram_description || `Diagram for ${s.title}`,
          mermaidCode: s.mermaid_code,
          order: figOrder++,
          included: true,
        });
      }
      return {
        id,
        number: s.number || `${parentOrder + i + 1}`,
        title: s.title || "Untitled Section",
        content: s.content || "",
        order: i,
        subsections: s.subsections ? convertSections(s.subsections, 0) : undefined,
        table: s.table,
        diagram_description: s.diagram_description,
        mermaid_code: s.mermaid_code,
      };
    });
  };

  const sections = convertSections(raw.sections || []);

  return {
    id: artifactId,
    document_title: raw.document_title || `${projectName} Architecture Document`,
    document_type: raw.document_type || "architecture",
    standard_reference: raw.standard_reference || "",
    version: raw.version || "1.0",
    date: raw.date || new Date().toISOString().split("T")[0],
    project_name: projectName,
    executive_summary: raw.executive_summary || "",
    sections,
    figures,
    metadata: {
      generatedAt: new Date().toISOString(),
      lastEditedAt: new Date().toISOString(),
      status: "draft",
    },
  };
}
