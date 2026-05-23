import React from "react";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import {
  documentTitleForKind,
  dreamHomeBrand,
  dreamHomeColors,
  dreamHomeFonts,
  DreamHomeHeader,
  DreamHomePolicies,
  DreamHomePreparedBy
} from "@/lib/pdf/dream-home-layout";
import { formatDate, isPresentPdfText, shouldDisplayPdfAmountRow } from "@/lib/pdf/formatters";
import type { OperationalPdfData, PdfItemRow, PdfSummaryRow } from "@/lib/pdf/types";

const { accent, dark, muted, border, softFill } = dreamHomeColors;

const standardTerms = [
  "Items delivered/pickup will be considered in good condition if no claim has been made within 24 hours.",
  "Warranty covers factory defects only; change of mind is not accepted.",
  "Buyer/receiver must inspect goods immediately upon receipt and note any damages or discrepancies on this document."
];

const paymentReceiptTerms = [
  "This receipt acknowledges the payment recorded for the order shown above.",
  "Please keep this document for your reference."
];

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: 40,
    paddingTop: 24,
    paddingBottom: 32,
    fontSize: 9,
    color: dark,
    fontFamily: dreamHomeFonts.body,
    lineHeight: 1.22,
    display: "flex",
    flexDirection: "column"
  },
  finalSummaryPage: {
    paddingHorizontal: 34,
    paddingVertical: 24,
    fontSize: 7.8,
    lineHeight: 1.08
  },
  metaRow: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 20,
    marginBottom: 14
  },
  finalSummaryMetaRow: {
    marginBottom: 1
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
    color: dark
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
    marginTop: 1,
    marginBottom: 2,
    paddingVertical: 1
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
    paddingVertical: 0.3
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
    marginTop: 2
  },
  sectionTitle: {
    marginBottom: 3,
    fontSize: 8,
    fontWeight: 700,
    color: dark,
    textTransform: "uppercase"
  },
  tableHeader: {
    display: "flex",
    flexDirection: "row",
    backgroundColor: accent,
    paddingVertical: 6.5,
    paddingHorizontal: 8,
    fontWeight: 700,
    color: "#ffffff",
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  finalSummaryTableHeader: {
    paddingVertical: 3
  },
  tableRow: {
    display: "flex",
    flexDirection: "row",
    borderLeft: `1px solid ${border}`,
    borderRight: `1px solid ${border}`,
    borderBottom: `1px solid ${border}`,
    paddingVertical: 6,
    paddingHorizontal: 8
  },
  finalSummaryTableRow: {
    paddingVertical: 2.2
  },
  itemName: {
    width: "50%",
    paddingHorizontal: 6
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
    width: "10%",
    textAlign: "center"
  },
  money: {
    width: "20%",
    textAlign: "right"
  },
  deliveryQty: {
    width: "15%",
    textAlign: "center"
  },
  deliveryDesc: {
    width: "45%",
    paddingHorizontal: 6
  },
  deliveryNotes: {
    width: "25%"
  },
  totalsBlock: {
    marginTop: 12,
    marginLeft: "auto",
    width: 225
  },
  finalSummaryTotalsBlock: {
    marginTop: 2
  },
  totalRow: {
    display: "flex",
    flexDirection: "row",
    borderBottom: `1px solid ${border}`,
    paddingVertical: 4
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
    backgroundColor: softFill,
    padding: 6
  },
  finalSummaryPaymentBox: {
    marginTop: 2,
    padding: 3
  },
  terms: {
    marginTop: 8,
    fontSize: 7.5,
    lineHeight: 1.2
  },
  finalSummaryTerms: {
    marginTop: 2
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
    lineHeight: 1.2
  },
  policyAndSignatureBlock: {
    marginTop: 0
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
    borderTop: `1px solid ${dark}`,
    marginBottom: 4
  },
  signatureLabel: {
    fontSize: 7.5,
    fontWeight: 700,
    color: dark
  },
  signatureAcknowledgement: {
    marginTop: 2,
    fontSize: 7,
    color: muted
  }
});

export function OperationalPdfDocument({ data }: { data: OperationalPdfData }) {
  const isFinalSummary = data.kind === "final-order-summary";
  const isDeliveryReceipt = data.kind === "delivery-receipt";
  const isPaymentReceipt = data.kind === "payment-receipt";
  const isInvoice = data.kind === "invoice";
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
    <Document title={data.title} author={dreamHomeBrand.companyName}>
      <Page size="A4" style={isFinalSummary ? [styles.page, styles.finalSummaryPage] : styles.page}>
        <DreamHomeHeader title={documentTitleForKind(data.kind)} />

        <View style={isFinalSummary ? [styles.metaRow, styles.finalSummaryMetaRow] : styles.metaRow}>
          <View style={styles.billTo}>
            <Text style={styles.smallLabel}>{isDeliveryReceipt ? "Deliver To:" : "Issued To:"}</Text>
            <Text style={styles.customerName}>{data.customer.displayName}</Text>
            {customerLines.map((line) => (
              <Text key={line} style={styles.muted}>
                {line}
              </Text>
            ))}
          </View>
          <View style={styles.dateBox}>
            <Text style={styles.smallLabel}>Date:</Text>
            <Text style={styles.customerName}>{documentDate(data)}</Text>
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
                {isDeliveryReceipt ? (
                  <>
                    <Text style={styles.deliveryQty}>QTY</Text>
                    <Text style={styles.deliveryDesc}>DESCRIPTION</Text>
                    <Text style={styles.deliveryQty}>DELIVERED</Text>
                    <Text style={styles.deliveryNotes}>NOTES</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.qty}>QTY</Text>
                    <Text style={styles.itemName}>DESCRIPTION</Text>
                    <Text style={styles.money}>UNIT PRICE</Text>
                    <Text style={styles.money}>TOTAL</Text>
                  </>
                )}
              </View>
              {data.items.map((item, index) => (
                <ItemRow key={`${item.name}-${index}`} item={item} compact={isFinalSummary} delivery={isDeliveryReceipt} />
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

          {isInvoice ? (
            <View style={styles.policyAndSignatureBlock} wrap={false}>
              <DreamHomePolicies compact />
              <DreamHomePreparedBy />
            </View>
          ) : null}

          {isInvoice ? null : (
            <View style={isFinalSummary ? [styles.terms, styles.finalSummaryTerms] : styles.terms}>
              <Text style={styles.sectionTitle}>{isPaymentReceipt || isDeliveryReceipt ? "Note:" : "Terms:"}</Text>
              {(isPaymentReceipt ? paymentReceiptTerms : standardTerms).map((term) => (
                <View key={term} style={styles.termRow}>
                  <Text style={styles.bullet}>-</Text>
                  <Text>{term}</Text>
                </View>
              ))}
              <View style={styles.footer}>
                <Text>{footerNote(data)}</Text>
              </View>
            </View>
          )}

          {isFinalSummary ? <DreamHomePreparedBy compact /> : null}
        </View>

        {data.signatureRequired && isDeliveryReceipt ? <SignatureBlock /> : null}
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

function ItemRow({ item, compact = false, delivery = false }: { item: PdfItemRow; compact?: boolean; delivery?: boolean }) {
  const descriptionParts = presentValues([item.description, item.discountDetail, item.notes]);

  if (delivery) {
    return (
      <View style={compact ? [styles.tableRow, styles.finalSummaryTableRow] : styles.tableRow} wrap={false}>
        <Text style={styles.deliveryQty}>{item.quantity}</Text>
        <View style={styles.deliveryDesc}>
          <ItemDescription item={item} descriptionParts={presentValues([item.description])} />
        </View>
        <Text style={styles.deliveryQty}>{item.quantityDelivered ?? ""}</Text>
        <Text style={styles.deliveryNotes}>{item.notes ?? ""}</Text>
      </View>
    );
  }

  return (
    <View style={compact ? [styles.tableRow, styles.finalSummaryTableRow] : styles.tableRow} wrap={false}>
      <Text style={styles.qty}>
        {item.quantity}
      </Text>
      <View style={styles.itemName}>
        <ItemDescription item={item} descriptionParts={descriptionParts} />
      </View>
      <Text style={styles.money}>{isPresent(item.unitPrice) ? item.unitPrice : ""}</Text>
      <Text style={styles.money}>{isPresent(item.total) ? item.total : ""}</Text>
    </View>
  );
}

function ItemDescription({ item, descriptionParts }: { item: PdfItemRow; descriptionParts: string[] }) {
  return (
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
  );
}

function documentDate(data: OperationalPdfData) {
  const dateRow = data.summary.find((row) => /\bdate\b/i.test(row.label) && isPresent(row.value));

  return dateRow?.value ?? formatDate(data.generatedAt);
}

function visibleRows(rows: PdfSummaryRow[]) {
  return rows.filter((row) =>
    shouldDisplayPdfAmountRow(row, {
      alwaysShowLabels: [/^(final total|total paid|amount paid|payment amount|balance|balance after)$/i],
      hideZeroMoneyRows: true
    })
  );
}

function visibleAmountRows(rows: PdfSummaryRow[]) {
  return rows.filter((row) =>
    shouldDisplayPdfAmountRow(row, {
      alwaysShowLabels: [/^(final total|total|total paid|paid|balance|amount paid|payment amount|balance after)$/i],
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

  return `This ${documentTitleForKind(data.kind).toLowerCase()} is generated for Furniture Odyssey sales operations.`;
}
