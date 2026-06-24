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
import { hasMoney, isPresentPdfText, shouldDisplayPdfAmountRow } from "@/lib/pdf/formatters";
import { PdfPaymentTermsBlockView } from "@/lib/pdf/payment-terms-block";
import type { OperationalPdfData, PdfItemRow, PdfSummaryRow } from "@/lib/pdf/types";

const { accent, background, dark, muted, border } = dreamHomeColors;

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: 42,
    paddingTop: 24,
    paddingBottom: 32,
    backgroundColor: background,
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
    marginBottom: 6
  },
  issuedCell: {
    flexGrow: 1,
    flexBasis: 0,
    display: "flex",
    flexDirection: "column",
    gap: 2,
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
  issuedCustomerName: {
    fontFamily: dreamHomeFonts.body,
    fontWeight: 400,
    letterSpacing: 1,
    lineHeight: 1.2
  },
  addressBlock: {
    marginBottom: 12,
    maxWidth: 340
  },
  addressText: {
    color: muted,
    fontSize: 8.4,
    lineHeight: 1.28
  },
  table: {
    marginTop: 0,
    fontFamily: dreamHomeFonts.body,
    fontWeight: 400
  },
  tableCurrencyNote: {
    marginBottom: 3,
    color: muted,
    fontSize: 7.6,
    textAlign: "right"
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
  qtyColWithDiscount: {
    width: "8%"
  },
  descCol: {
    width: "50%",
    paddingHorizontal: 6
  },
  descColWithDiscount: {
    width: "44%"
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
  priceColWithDiscount: {
    width: "18%"
  },
  discountCol: {
    width: "14%",
    textAlign: "right"
  },
  totalCol: {
    width: "20%",
    textAlign: "right"
  },
  totalColWithDiscount: {
    width: "16%"
  },
  tableMoney: {
    fontSize: 8.2,
    lineHeight: 1
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
  const customerAddress = data.customer.address?.trim();
  const hasAnyItemDiscount = hasDiscountedItems(data.items);
  const tableCurrency = tableCurrencyLabel(data);

  return (
    <Document title={data.title} author={dreamHomeBrand.companyName}>
      <Page size="A4" style={styles.page}>
        <DreamHomeHeader title={documentTitleForKind(data.kind)} fixed />

        <View style={styles.issuedRow} wrap={false}>
          <View style={styles.issuedCell}>
            <Text style={styles.label}>ISSUED TO:</Text>
            <Text style={styles.issuedCustomerName}>{data.customer.displayName.toUpperCase()}</Text>
          </View>
          <View style={styles.dateCell}>
            <Text style={styles.label}>DATE:</Text>
            <Text>{quotationDate(data)}</Text>
          </View>
        </View>

        {customerAddress ? (
          <View style={styles.addressBlock} wrap={false}>
            <Text style={styles.addressText}>{customerAddress}</Text>
          </View>
        ) : null}

        {data.items?.length ? (
          <View style={styles.table}>
            {tableCurrency ? <Text style={styles.tableCurrencyNote}>Amounts in {tableCurrency}</Text> : null}
            <View style={styles.tableHeader} fixed>
              <Text style={hasAnyItemDiscount ? [styles.qtyCol, styles.qtyColWithDiscount] : styles.qtyCol}>QTY</Text>
              <Text style={hasAnyItemDiscount ? [styles.descCol, styles.descColWithDiscount] : styles.descCol}>
                DESCRIPTION
              </Text>
              <Text style={hasAnyItemDiscount ? [styles.priceCol, styles.priceColWithDiscount] : styles.priceCol}>
                UNIT PRICE
              </Text>
              {hasAnyItemDiscount ? <Text style={styles.discountCol}>DISCOUNT</Text> : null}
              <Text style={hasAnyItemDiscount ? [styles.totalCol, styles.totalColWithDiscount] : styles.totalCol}>
                TOTAL
              </Text>
            </View>
            {data.items.map((item, index) => (
              <QuotationItemRow key={`${item.name}-${index}`} item={item} showItemDiscount={hasAnyItemDiscount} />
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

        <View style={styles.policyAndSignatureBlock} wrap={!data.paymentTermsBlock ? false : undefined}>
          {data.paymentTermsBlock ? <PdfPaymentTermsBlockView terms={data.paymentTermsBlock} /> : <DreamHomePolicies />}
          <DreamHomePreparedBy />
        </View>
      </Page>
    </Document>
  );
}

function QuotationItemRow({ item, showItemDiscount }: { item: PdfItemRow; showItemDiscount: boolean }) {
  const description = presentValues([item.code, item.name]).join(" - ");
  const detailLines = presentValues([item.description, item.notes]);

  return (
    <View style={styles.tableRow} wrap={false}>
      <Text style={showItemDiscount ? [styles.qtyCol, styles.qtyColWithDiscount] : styles.qtyCol}>{item.quantity}</Text>
      <View style={showItemDiscount ? [styles.descCol, styles.descColWithDiscount] : styles.descCol}>
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
      <Text
        style={
          showItemDiscount
            ? [styles.priceCol, styles.priceColWithDiscount, styles.tableMoney]
            : [styles.priceCol, styles.tableMoney]
        }
        wrap={false}
      >
        {compactMoneyText(item.unitPriceCompact, item.unitPrice)}
      </Text>
      {showItemDiscount ? (
        <Text style={[styles.discountCol, styles.tableMoney]} wrap={false}>
          {itemDiscountText(item)}
        </Text>
      ) : null}
      <Text
        style={
          showItemDiscount
            ? [styles.totalCol, styles.totalColWithDiscount, styles.tableMoney]
            : [styles.totalCol, styles.tableMoney]
        }
        wrap={false}
      >
        {compactMoneyText(item.totalCompact, item.total)}
      </Text>
    </View>
  );
}

function hasDiscountedItems(items: PdfItemRow[] | undefined) {
  return Boolean(items?.some((item) => hasMoney(item.discountAmount)));
}

function itemDiscountText(item: PdfItemRow) {
  if (!hasMoney(item.discountAmount)) {
    return "—";
  }

  return item.discountCompact ?? (item.discount ? `-${stripCurrencyPrefix(item.discount)}` : "—");
}

function compactMoneyText(compactValue: string | undefined, fullValue: string | null | undefined) {
  return compactValue ?? stripCurrencyPrefix(fullValue);
}

function stripCurrencyPrefix(value: string | null | undefined) {
  return value?.trim().replace(/^[A-Z]{3}\s+/, "") ?? "";
}

function tableCurrencyLabel(data: OperationalPdfData) {
  return data.tableCurrency ?? data.items?.map((item) => item.unitPrice ?? item.total).find(currencyFromMoneyText)?.match(/^[A-Z]{3}/)?.[0] ?? null;
}

function currencyFromMoneyText(value: string | null | undefined) {
  return /^[A-Z]{3}\s+/.test(value?.trim() ?? "");
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
      alwaysShowLabels: [/^(subtotal for items|final subtotal|final total)$/i],
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
