import { renderToBuffer } from "@react-pdf/renderer";
import { OperationalPdfDocument } from "@/lib/pdf/operational-document";
import type { OperationalPdfData } from "@/lib/pdf/types";

export async function renderOperationalPdf(data: OperationalPdfData) {
  return renderToBuffer(<OperationalPdfDocument data={data} />);
}

