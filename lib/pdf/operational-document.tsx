import React from "react";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { generatedLabel } from "@/lib/pdf/data";
import { formatDate, isPresentPdfText, shouldDisplayPdfAmountRow } from "@/lib/pdf/formatters";
import type { OperationalPdfData, PdfItemRow, PdfSummaryRow } from "@/lib/pdf/types";

const accent = "#b66a3c";
const ink = "#3f2b22";
const muted = "#7b6658";
const border = "#d6c4b2";

const standardTerms = [
  "Items delivered/pickup will be considered in good condition if no claim has been made within 24 hours.",
  "Warranty covers factory defects only; change of mind is not accepted.",
  "Buyer/receiver must inspect goods immediately upon receipt and note any damages or discrepancies on this document."
];

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: 40,
    paddingVertical: 32,
    fontSize: 9,
    color: ink,
    fontFamily: "Helvetica",
    lineHeight: 1.22,
    display: "flex",
    flexDirection: "column"
  },
  finalSummaryPage: {
    paddingHorizontal: 34,
    paddingVertical: 24
  },
  header: {
    alignItems: "center",
    textAlign: "center",
    paddingBottom: 8,
    borderBottom: `1.2px solid ${accent}`,
    marginBottom: 10
  },
  finalSummaryHeader: {
    paddingBottom: 5,
    marginBottom: 10
  },
  logo: {
    width: 92,
    height: 80,
    objectFit: "contain",
    marginBottom: 2
  },
  finalSummaryLogo: {
    width: 74,
    height: 58
  },
  company: {
    fontSize: 19,
    fontWeight: 700,
    color: ink
  },
  finalSummaryCompany: {
    fontSize: 17
  },
  tagline: {
    marginTop: 1,
    fontSize: 7.5,
    letterSpacing: 1.2,
    color: muted,
    textTransform: "uppercase"
  },
  companyDetails: {
    marginTop: 3,
    fontSize: 7.5,
    color: muted,
    lineHeight: 1.18,
    textAlign: "center"
  },
  documentLabel: {
    marginTop: 0,
    marginBottom: 9,
    textAlign: "center",
    fontSize: 15,
    fontWeight: 700,
    color: accent,
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  finalSummaryDocumentLabel: {
    marginTop: 0,
    marginBottom: 5,
    fontSize: 14
  },
  metaRow: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 20,
    marginBottom: 6
  },
  finalSummaryMetaRow: {
    marginBottom: 3
  },
  billTo: {
    flexGrow: 1,
    flexBasis: 0
  },
  dateBox: {
    width: 170,
    textAlign: "right"
  },
  smallLabel: {
    fontSize: 7.5,
    fontWeight: 700,
    color: muted,
    textTransform: "uppercase"
  },
  customerName: {
    marginTop: 2,
    fontSize: 10.5,
    fontWeight: 700,
    color: ink
  },
  muted: {
    color: muted
  },
  generated: {
    marginTop: 2,
    fontSize: 7.5,
    color: muted
  },
  content: {
    flexGrow: 1
  },
  referenceBlock: {
    marginTop: 4,
    marginBottom: 7,
    paddingVertical: 3,
    borderTop: `1px solid ${border}`,
    borderBottom: `1px solid ${border}`
  },
  finalSummaryReferenceBlock: {
    marginTop: 2,
    marginBottom: 4,
    paddingVertical: 2
  },
  compactRow: {
    display: "flex",
    flexDirection: "row",
    paddingVertical: 1.5
  },
  pairedRow: {
    display: "flex",
    flexDirection: "row",
    gap: 10,
    paddingVertical: 1.2
  },
  pairedCell: {
    display: "flex",
    flexDirection: "row",
    flexGrow: 1,
    flexBasis: 0
  },
  compactLabel: {
    width: "31%",
    paddingRight: 6,
    color: muted,
    fontSize: 7.5
  },
  compactValue: {
    width: "69%",
    fontSize: 7.5
  },
  section: {
    marginTop: 7
  },
  finalSummarySection: {
    marginTop: 4
  },
  sectionTitle: {
    marginBottom: 3,
    fontSize: 8,
    fontWeight: 700,
    color: ink,
    textTransform: "uppercase"
  },
  tableHeader: {
    display: "flex",
    flexDirection: "row",
    backgroundColor: "#b66a3c",
    paddingVertical: 4,
    paddingHorizontal: 5,
    fontWeight: 700,
    color: "#ffffff"
  },
  finalSummaryTableHeader: {
    paddingVertical: 3
  },
  tableRow: {
    display: "flex",
    flexDirection: "row",
    borderBottom: `1px solid ${border}`,
    paddingVertical: 3,
    paddingHorizontal: 5
  },
  finalSummaryTableRow: {
    paddingVertical: 2
  },
  itemName: {
    width: "43%",
    paddingRight: 8
  },
  itemImage: {
    width: 24,
    height: 24,
    objectFit: "cover",
    marginRight: 5,
    border: `1px solid ${border}`
  },
  itemBody: {
    flexGrow: 1,
    flexBasis: 0
  },
  qty: {
    width: "12%",
    textAlign: "right"
  },
  money: {
    width: "15%",
    textAlign: "right"
  },
  totalsBlock: {
    marginTop: 4,
    marginLeft: "auto",
    width: 210
  },
  finalSummaryTotalsBlock: {
    marginTop: 2
  },
  totalRow: {
    display: "flex",
    flexDirection: "row",
    borderBottom: `1px solid ${border}`,
    paddingVertical: 2
  },
  finalSummaryTotalRow: {
    paddingVertical: 1.4
  },
  totalLabel: {
    width: "58%",
    color: muted
  },
  totalValue: {
    width: "42%",
    textAlign: "right",
    fontWeight: 700
  },
  notes: {
    marginTop: 2,
    lineHeight: 1.22
  },
  paymentBox: {
    marginTop: 7,
    border: `1px solid ${border}`,
    backgroundColor: "#f8f3ec",
    padding: 6
  },
  finalSummaryPaymentBox: {
    marginTop: 4,
    padding: 4
  },
  terms: {
    marginTop: 8,
    fontSize: 7.5,
    lineHeight: 1.2
  },
  finalSummaryTerms: {
    marginTop: 5
  },
  termRow: {
    display: "flex",
    flexDirection: "row",
    gap: 4,
    marginTop: 2
  },
  bullet: {
    width: 8
  },
  footer: {
    marginTop: 5,
    fontSize: 7.5,
    color: muted,
    fontStyle: "italic",
    lineHeight: 1.2
  },
  signatureBlock: {
    marginTop: "auto",
    paddingTop: 14,
    alignItems: "center",
    textAlign: "center"
  },
  finalSummarySignatureBlock: {
    paddingTop: 6
  },
  signatureRule: {
    width: 245,
    borderTop: `1px solid ${ink}`,
    marginBottom: 4
  },
  signatureLabel: {
    fontSize: 7.5,
    fontWeight: 700,
    color: ink
  },
  signatureAcknowledgement: {
    marginTop: 2,
    fontSize: 7,
    color: muted
  }
});

export function OperationalPdfDocument({ data }: { data: OperationalPdfData }) {
  const isFinalSummary = data.kind === "final-order-summary";
  const companyDetailLines = companyLines(data);
  const customerLines = presentValues([data.customer.detail, data.customer.contact, data.customer.address]);
  const referenceRows = visibleRows(data.summary);
  const totalRows = visibleAmountRows(data.totals ?? []);
  const paymentInstructionLines = presentValues([
    data.paymentInstructions ?? data.company.paymentInstructions,
    data.company.bankDetails,
    data.company.eWalletDetails,
    data.company.otherPaymentNotes
  ]);

  return (
    <Document title={data.title} author={data.company.displayName}>
      <Page size="A4" style={isFinalSummary ? [styles.page, styles.finalSummaryPage] : styles.page}>
        <View style={isFinalSummary ? [styles.header, styles.finalSummaryHeader] : styles.header}>
          {data.company.logoUrl ? (
            // React-PDF Image does not expose an alt prop in its TypeScript API.
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={data.company.logoUrl} style={isFinalSummary ? [styles.logo, styles.finalSummaryLogo] : styles.logo} />
          ) : null}
          <Text style={isFinalSummary ? [styles.company, styles.finalSummaryCompany] : styles.company}>
            {data.company.displayName}
          </Text>
          {data.company.registeredName ? <Text style={styles.tagline}>{data.company.registeredName}</Text> : null}
          {companyDetailLines.length ? (
            <View style={styles.companyDetails}>
              {companyDetailLines.map((line) => (
                <Text key={line}>{line}</Text>
              ))}
            </View>
          ) : null}
        </View>

        <Text style={isFinalSummary ? [styles.documentLabel, styles.finalSummaryDocumentLabel] : styles.documentLabel}>
          {documentLabelForKind(data.kind)}
        </Text>

        <View style={isFinalSummary ? [styles.metaRow, styles.finalSummaryMetaRow] : styles.metaRow}>
          <View style={styles.billTo}>
            <Text style={styles.smallLabel}>Bill To:</Text>
            <Text style={styles.customerName}>{data.customer.displayName}</Text>
            {customerLines.map((line) => (
              <Text key={line} style={styles.muted}>
                {line}
              </Text>
            ))}
          </View>
          <View style={styles.dateBox}>
            <Text style={styles.smallLabel}>Date</Text>
            <Text style={styles.customerName}>{documentDate(data)}</Text>
            <Text style={styles.generated}>{generatedLabel(data)}</Text>
          </View>
        </View>

        <View style={styles.content}>
          {referenceRows.length ? (
            <View style={isFinalSummary ? [styles.referenceBlock, styles.finalSummaryReferenceBlock] : styles.referenceBlock}>
              {isFinalSummary ? (
                <PairedCompactRows rows={referenceRows} />
              ) : (
                referenceRows.map((row) => <CompactRow key={`${row.label}-${row.value}`} row={row} />)
              )}
            </View>
          ) : null}

          {data.items?.length ? (
            <View style={isFinalSummary ? [styles.section, styles.finalSummarySection] : styles.section}>
              <View style={isFinalSummary ? [styles.tableHeader, styles.finalSummaryTableHeader] : styles.tableHeader}>
                <Text style={styles.qty}>Qty</Text>
                <Text style={styles.itemName}>Description</Text>
                <Text style={styles.money}>Unit Price</Text>
                <Text style={styles.money}>Discount</Text>
                <Text style={styles.money}>Amount</Text>
              </View>
              {data.items.map((item, index) => (
                <ItemRow key={`${item.name}-${index}`} item={item} compact={isFinalSummary} />
              ))}
            </View>
          ) : null}

          {totalRows.length ? (
            <View style={isFinalSummary ? [styles.totalsBlock, styles.finalSummaryTotalsBlock] : styles.totalsBlock}>
              {totalRows.map((row) => (
                <View
                  key={`${row.label}-${row.value}`}
                  style={isFinalSummary ? [styles.totalRow, styles.finalSummaryTotalRow] : styles.totalRow}
                  wrap={false}
                >
                  <Text style={styles.totalLabel}>{row.label}</Text>
                  <Text style={styles.totalValue}>{row.value}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {visibleRows(data.payments ?? []).length ? (
            <View style={isFinalSummary ? [styles.section, styles.finalSummarySection] : styles.section}>
              <Text style={styles.sectionTitle}>Payments</Text>
              {visibleRows(data.payments ?? []).map((row) => (
                <CompactRow key={`${row.label}-${row.value}`} row={row} />
              ))}
            </View>
          ) : null}

          {visibleRows(data.deliveries ?? []).length ? (
            <View style={isFinalSummary ? [styles.section, styles.finalSummarySection] : styles.section}>
              <Text style={styles.sectionTitle}>Deliveries</Text>
              {visibleRows(data.deliveries ?? []).map((row) => (
                <CompactRow key={`${row.label}-${row.value}`} row={row} />
              ))}
            </View>
          ) : null}

          {isPresent(data.notes) ? (
            <View style={isFinalSummary ? [styles.section, styles.finalSummarySection] : styles.section}>
              <Text style={styles.sectionTitle}>Notes</Text>
              <Text style={styles.notes}>{data.notes}</Text>
            </View>
          ) : null}

          {paymentInstructionLines.length ? (
            <View style={isFinalSummary ? [styles.paymentBox, styles.finalSummaryPaymentBox] : styles.paymentBox}>
              <Text style={styles.sectionTitle}>Payment Instructions</Text>
              {paymentInstructionLines.map((line) => (
                <Text key={line} style={styles.notes}>
                  {line}
                </Text>
              ))}
            </View>
          ) : null}

          <View style={isFinalSummary ? [styles.terms, styles.finalSummaryTerms] : styles.terms}>
            <Text style={styles.sectionTitle}>TERMS & CONDITION:</Text>
            {standardTerms.map((term) => (
              <View key={term} style={styles.termRow}>
                <Text style={styles.bullet}>-</Text>
                <Text>{term}</Text>
              </View>
            ))}
            <View style={styles.footer}>
              <Text>{footerNote(data)}</Text>
            </View>
          </View>

          {isFinalSummary ? <SignatureBlock compact /> : null}
        </View>

        {isFinalSummary ? null : <SignatureBlock />}
      </Page>
    </Document>
  );
}

function CompactRow({ row }: { row: PdfSummaryRow }) {
  return (
    <View style={styles.compactRow} wrap={false}>
      <Text style={styles.compactLabel}>{row.label}</Text>
      <Text style={styles.compactValue}>{row.value}</Text>
    </View>
  );
}

function PairedCompactRows({ rows }: { rows: PdfSummaryRow[] }) {
  const pairs: Array<[PdfSummaryRow, PdfSummaryRow | undefined]> = [];

  for (let index = 0; index < rows.length; index += 2) {
    const left = rows[index];

    if (left) {
      pairs.push([left, rows[index + 1]]);
    }
  }

  return (
    <View>
      {pairs.map(([left, right]) => (
        <View key={`${left.label}-${left.value}`} style={styles.pairedRow} wrap={false}>
          <View style={styles.pairedCell}>
            <Text style={styles.compactLabel}>{left.label}</Text>
            <Text style={styles.compactValue}>{left.value}</Text>
          </View>
          <View style={styles.pairedCell}>
            {right ? (
              <>
                <Text style={styles.compactLabel}>{right.label}</Text>
                <Text style={styles.compactValue}>{right.value}</Text>
              </>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

function SignatureBlock({ compact = false }: { compact?: boolean }) {
  return (
    <View style={compact ? [styles.signatureBlock, styles.finalSummarySignatureBlock] : styles.signatureBlock} wrap={false}>
      <View style={styles.signatureRule} />
      <Text style={styles.signatureLabel}>BUYER/RECEIVER SIGNATURE AND DATE</Text>
      <Text style={styles.signatureAcknowledgement}>
        I HEREBY ACKNOWLEDGE RECEIPT AND ACCEPTANCE OF THE ITEMS LISTED ABOVE.
      </Text>
    </View>
  );
}

function ItemRow({ item, compact = false }: { item: PdfItemRow; compact?: boolean }) {
  const descriptionParts = presentValues([item.description, item.discountDetail, item.notes]);

  return (
    <View style={compact ? [styles.tableRow, styles.finalSummaryTableRow] : styles.tableRow} wrap={false}>
      <Text style={styles.qty}>
        {item.quantityDelivered ? `${item.quantity} planned\n${item.quantityDelivered} delivered` : item.quantity}
      </Text>
      <View style={styles.itemName}>
        <View style={{ display: "flex", flexDirection: "row" }}>
          {item.imageUrl ? (
            // React-PDF Image does not expose an alt prop in its TypeScript API.
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={item.imageUrl} style={styles.itemImage} />
          ) : null}
          <View style={styles.itemBody}>
            <Text>{presentValues([item.code, item.name]).join(" - ")}</Text>
            {descriptionParts.map((line) => (
              <Text key={line} style={styles.muted}>
                {line}
              </Text>
            ))}
          </View>
        </View>
      </View>
      <Text style={styles.money}>{isPresent(item.unitPrice) ? item.unitPrice : ""}</Text>
      <Text style={styles.money}>{isPresent(item.discount) ? item.discount : ""}</Text>
      <Text style={styles.money}>{isPresent(item.total) ? item.total : ""}</Text>
    </View>
  );
}

function documentLabelForKind(kind: OperationalPdfData["kind"]) {
  switch (kind) {
    case "quotation":
      return "QUOTATION";
    case "invoice":
      return "INVOICE";
    case "payment-receipt":
      return "RECEIPT";
    case "delivery-receipt":
      return "DELIVERY COPY";
    case "final-order-summary":
      return "FINAL ORDER SUMMARY";
    default:
      return "DOCUMENT";
  }
}

function documentDate(data: OperationalPdfData) {
  const dateRow = data.summary.find((row) => /\bdate\b/i.test(row.label) && isPresent(row.value));

  return dateRow?.value ?? formatDate(data.generatedAt);
}

function companyLines(data: OperationalPdfData) {
  const contactLine = presentValues([
    data.company.contactNumber,
    data.company.facebookPage,
    data.company.websiteUrl
  ]).join(" | ");

  return presentValues([data.company.address, contactLine, data.company.email]);
}

function visibleRows(rows: PdfSummaryRow[]) {
  return rows.filter((row) => shouldDisplayPdfAmountRow(row));
}

function visibleAmountRows(rows: PdfSummaryRow[]) {
  return rows.filter((row) =>
    shouldDisplayPdfAmountRow(row, {
      alwaysShowLabels: [/^(final total|total|paid|balance)$/i],
      hideZeroMoneyRows: true
    })
  );
}

function presentValues(values: Array<string | null | undefined>) {
  return values.filter(isPresent);
}

function isPresent(value: string | null | undefined): value is string {
  return isPresentPdfText(value);
}

function footerNote(data: OperationalPdfData) {
  if (isPresent(data.footerNote)) {
    return data.footerNote;
  }

  if (isPresent(data.company.footer)) {
    return data.company.footer;
  }

  return `This ${documentLabelForKind(data.kind).toLowerCase()} is generated for Furniture Odyssey sales operations and does not claim tax or accounting compliance.`;
}
