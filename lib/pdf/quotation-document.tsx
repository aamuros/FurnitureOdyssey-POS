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
import { isPresentPdfText, shouldDisplayPdfAmountRow } from "@/lib/pdf/formatters";
import type { OperationalPdfData, PdfItemRow, PdfSummaryRow } from "@/lib/pdf/types";

const { accent, dark, muted, border } = dreamHomeColors;

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: 42,
    paddingTop: 24,
    paddingBottom: 32,
    backgroundColor: "#ffffff",
    color: dark,
    fontFamily: dreamHomeFonts.body,
    fontSize: 9.2,
    lineHeight: 1.35
  },
  issuedRow: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 20,
    marginBottom: 14
  },
  issuedCell: {
    flexGrow: 1,
    flexBasis: 0,
    display: "flex",
    flexDirection: "row",
    gap: 5,
    fontFamily: dreamHomeFonts.body,
    fontWeight: 400
  },
  dateCell: {
    width: 172,
    display: "flex",
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 5,
    fontFamily: dreamHomeFonts.body,
    fontWeight: 400
  },
  label: {
    fontWeight: 700,
    color: dark
  },
  table: {
    marginTop: 0,
    fontFamily: dreamHomeFonts.body,
    fontWeight: 400
  },
  tableHeader: {
    display: "flex",
    flexDirection: "row",
    backgroundColor: accent,
    color: "#ffffff",
    paddingVertical: 6.5,
    paddingHorizontal: 8,
    fontWeight: 700,
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  tableRow: {
    display: "flex",
    flexDirection: "row",
    borderLeft: `1px solid ${border}`,
    borderRight: `1px solid ${border}`,
    borderBottom: `1px solid ${border}`,
    paddingVertical: 7,
    paddingHorizontal: 8
  },
  qtyCol: {
    width: "10%",
    textAlign: "center"
  },
  descCol: {
    width: "50%",
    paddingHorizontal: 6
  },
  itemDescription: {
    display: "flex",
    flexDirection: "row"
  },
  itemImage: {
    width: 28,
    height: 28,
    objectFit: "cover",
    marginRight: 6,
    border: `1px solid ${border}`
  },
  itemBody: {
    flexGrow: 1,
    flexBasis: 0
  },
  priceCol: {
    width: "20%",
    textAlign: "right"
  },
  totalCol: {
    width: "20%",
    textAlign: "right"
  },
  itemName: {
    fontWeight: 700
  },
  itemDetail: {
    marginTop: 2,
    fontSize: 8,
    color: muted
  },
  totalsBlock: {
    marginTop: 12,
    marginLeft: "auto",
    width: 225,
    fontFamily: dreamHomeFonts.body,
    fontWeight: 400
  },
  totalRow: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottom: `1px solid ${border}`,
    paddingVertical: 4,
    gap: 14
  },
  totalLabel: {
    color: muted
  },
  totalValue: {
    fontWeight: 700,
    textAlign: "right"
  },
  finalTotalRow: {
    borderBottom: `1.4px solid ${accent}`,
    paddingTop: 6,
    paddingBottom: 6
  },
  finalTotalLabel: {
    color: dark,
    fontSize: 10,
    fontWeight: 700
  },
  finalTotalValue: {
    color: dark,
    fontSize: 11,
    fontWeight: 700,
    textAlign: "right"
  },
  policyAndSignatureBlock: {
    marginTop: 0
  }
});

export function QuotationPdfDocument({ data }: { data: OperationalPdfData }) {
  const totalRows = visibleRows(data.totals ?? []);

  return (
    <Document title={data.title} author={dreamHomeBrand.companyName}>
      <Page size="A4" style={styles.page}>
        <DreamHomeHeader title={documentTitleForKind(data.kind)} fixed />

        <View style={styles.issuedRow} wrap={false}>
          <View style={styles.issuedCell}>
            <Text style={styles.label}>ISSUED TO:</Text>
            <Text>{data.customer.displayName}</Text>
          </View>
          <View style={styles.dateCell}>
            <Text style={styles.label}>DATE:</Text>
            <Text>{quotationDate(data)}</Text>
          </View>
        </View>

        {data.items?.length ? (
          <View style={styles.table}>
            <View style={styles.tableHeader} fixed>
              <Text style={styles.qtyCol}>QTY</Text>
              <Text style={styles.descCol}>DESCRIPTION</Text>
              <Text style={styles.priceCol}>UNIT PRICE</Text>
              <Text style={styles.totalCol}>TOTAL</Text>
            </View>
            {data.items.map((item, index) => (
              <QuotationItemRow key={`${item.name}-${index}`} item={item} />
            ))}
          </View>
        ) : null}

        {totalRows.length ? (
          <View style={styles.totalsBlock} wrap={false}>
            {totalRows.map((row) => {
              const isFinalTotal = /final total/i.test(row.label);

              return (
                <View key={`${row.label}-${row.value}`} style={isFinalTotal ? [styles.totalRow, styles.finalTotalRow] : styles.totalRow}>
                  <Text style={isFinalTotal ? styles.finalTotalLabel : styles.totalLabel}>{quotationTotalLabel(row.label)}</Text>
                  <Text style={isFinalTotal ? styles.finalTotalValue : styles.totalValue}>{row.value}</Text>
                </View>
              );
            })}
          </View>
        ) : null}

        <View style={styles.policyAndSignatureBlock} wrap={false}>
          <DreamHomePolicies />
          <DreamHomePreparedBy />
        </View>
      </Page>
    </Document>
  );
}

function QuotationItemRow({ item }: { item: PdfItemRow }) {
  const description = presentValues([item.code, item.name]).join(" - ");
  const detailLines = presentValues([item.description, item.notes]);

  return (
    <View style={styles.tableRow} wrap={false}>
      <Text style={styles.qtyCol}>{item.quantity}</Text>
      <View style={styles.descCol}>
        <View style={styles.itemDescription}>
          {item.imageUrl ? (
            // React-PDF Image does not expose an alt prop in its TypeScript API.
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={item.imageUrl} style={styles.itemImage} />
          ) : null}
          <View style={styles.itemBody}>
            <Text style={styles.itemName}>{description}</Text>
            {detailLines.map((line) => (
              <Text key={line} style={styles.itemDetail}>
                {line}
              </Text>
            ))}
          </View>
        </View>
      </View>
      <Text style={styles.priceCol}>{item.unitPrice ?? ""}</Text>
      <Text style={styles.totalCol}>{item.total ?? ""}</Text>
    </View>
  );
}

function quotationDate(data: OperationalPdfData) {
  return data.summary.find((row) => row.label === "Quotation date" && isPresent(row.value))?.value ?? "";
}

function quotationTotalLabel(label: string) {
  if (/assemble fee/i.test(label)) {
    return "Assembly Fee";
  }

  return label;
}

function visibleRows(rows: PdfSummaryRow[]) {
  return rows.filter((row) =>
    shouldDisplayPdfAmountRow(row, {
      alwaysShowLabels: [/^final total$/i],
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
