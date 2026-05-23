import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import React from "react";
import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { isPresentPdfText, shouldDisplayPdfAmountRow } from "@/lib/pdf/formatters";
import type { OperationalPdfData, PdfItemRow, PdfSummaryRow } from "@/lib/pdf/types";

const brand = {
  companyName: "DREAM HOME MNL",
  tagline: "D H M  F U R N I T U R E S  O N L I N E  S T O R E",
  address: "129 CALIRAYA DRIVE SMDP MARIAN LAKEVIEW PARANAQUE CITY",
  contact: "CONTACT NUMBER: 09603123335",
  email: "EMAIL ADDRESS: DREAMHOMEMNL01@GMAIL.COM",
  preparedBy: "Arriane Escobia",
  preparedBySubtitle: "DHM Online store"
};

const brandGold = "#a87546";
const accent = "#c28a4f";
const dark = "#222222";
const muted = "#6f6258";
const border = "#d8d0c6";

const fontFiles = {
  aleoRegular: firstExistingPath("Aleo-Regular.ttf"),
  aleoBold: firstExistingPath("Aleo-Bold.ttf"),
  balginRegular: firstExistingPath("Balgin-Regular.ttf", "Balgin-Regular.otf"),
  openSansRegular: firstExistingPath("OpenSans-Regular.ttf"),
  openSansSemiBold: firstExistingPath("OpenSans-SemiBold.ttf"),
  openSansBold: firstExistingPath("OpenSans-Bold.ttf")
};

const fontFamilies = registerQuotationFonts();
const logoSource = imageSource(path.join(process.cwd(), "public", "logo", "dream-home-mnl-logo.png"));
const signatureSource = imageSource(firstExistingAssetPath(
  path.join(process.cwd(), "public", "sign.png"),
  path.join(process.cwd(), "public", "logo", "sign.png")
));

type QuotationPolicy =
  | {
      label: string;
      lines: string[];
    }
  | {
      label: string;
      text: string;
    };

const policies: QuotationPolicy[] = [
  {
    label: "1. Payment Policy and Delivery Options",
    lines: [
      "a. Customers can choose to make full payment at the time of ordering to secure their products, with delivery scheduled for a later date.",
      "b. Cash on delivery applies to orders scheduled for immediate delivery, subject to serviceable areas.",
      "c. Down payments are accepted depending on delivery schedule and agreement.",
      "d. Payment-first policy applies to transactions outside Metro Manila or nearby provinces.",
      "e. Check payments require clearing before delivery."
    ]
  },
  {
    label: "2. Shipping Fees:",
    text: "Shipping fees are not included, and applicable toll fees will be covered by the client."
  },
  {
    label: "3. Delivery Terms:",
    text: "Items will be delivered unassembled, and assembly fees will apply when requested."
  },
  {
    label: "4. Warranty:",
    text: "Warranty covers factory defects only; change of mind is not accepted."
  },
  {
    label: "5. Payment Method:",
    text: "Payments are to be made via bank transfer unless otherwise agreed."
  },
  {
    label: "6. Delivery Instructions:",
    text: "Clients should provide delivery instructions, including if a helper is needed for unloading. Additional charges may apply."
  },
  {
    label: "7. Assembly Policy:",
    text: "Assembled items are considered sold and are not eligible for return or exchange."
  }
];

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: 42,
    paddingTop: 24,
    paddingBottom: 32,
    backgroundColor: "#ffffff",
    color: dark,
    fontFamily: fontFamilies.body,
    fontSize: 9.2,
    lineHeight: 1.35
  },
  header: {
    alignItems: "center",
    textAlign: "center",
    marginBottom: 20
  },
  logo: {
    width: 152,
    height: 118,
    objectFit: "contain",
    marginBottom: 5
  },
  companyName: {
    fontFamily: fontFamilies.aleo,
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: 1,
    color: brandGold
  },
  tagline: {
    marginTop: 10,
    fontFamily: fontFamilies.balgin,
    fontSize: 8.2,
    letterSpacing: 1.45,
    color: brandGold
  },
  brandLine: {
    marginTop: 1.6,
    fontSize: 6.8,
    letterSpacing: 0.35,
    color: muted
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
    flexDirection: "row",
    gap: 5
  },
  dateCell: {
    width: 172,
    display: "flex",
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 5
  },
  label: {
    fontWeight: 700,
    color: dark
  },
  table: {
    marginTop: 0
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
    width: 225
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
  terms: {
    marginTop: 18,
    fontSize: 7.8,
    lineHeight: 1.32
  },
  policyBlock: {
    marginBottom: 4
  },
  policyTitle: {
    fontWeight: 700
  },
  policyLine: {
    marginTop: 1.5
  },
  preparedBy: {
    marginTop: 18,
    width: 220,
    textAlign: "center"
  },
  preparedLabel: {
    marginBottom: 0,
    fontSize: 8,
    fontWeight: 700,
    textAlign: "left"
  },
  signatureArea: {
    alignItems: "center",
    textAlign: "center"
  },
  signature: {
    width: 165,
    height: 92,
    objectFit: "contain",
    marginBottom: -16
  },
  preparedName: {
    fontWeight: 700
  },
  preparedSubtitle: {
    fontSize: 8,
    color: muted
  }
});

export function QuotationPdfDocument({ data }: { data: OperationalPdfData }) {
  const totalRows = visibleRows(data.totals ?? []);

  return (
    <Document title={data.title} author={brand.companyName}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header} fixed>
          {logoSource ? (
            // React-PDF Image does not expose an alt prop in its TypeScript API.
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={logoSource} style={styles.logo} />
          ) : null}
          <Text style={styles.companyName}>{brand.companyName}</Text>
          <Text style={styles.tagline}>{brand.tagline}</Text>
          <Text style={styles.brandLine}>{brand.address}</Text>
          <Text style={styles.brandLine}>{brand.contact}</Text>
          <Text style={styles.brandLine}>{brand.email}</Text>
        </View>

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

        <View style={styles.terms} wrap={false}>
          {policies.map((policy) => (
            <View key={policy.label} style={styles.policyBlock}>
              {"lines" in policy ? (
                <>
                  <Text style={styles.policyTitle}>{policy.label}</Text>
                  {policy.lines.map((line) => (
                    <Text key={line} style={styles.policyLine}>
                      {line}
                    </Text>
                  ))}
                </>
              ) : (
                <Text>
                  <Text style={styles.policyTitle}>{policy.label} </Text>
                  {policy.text}
                </Text>
              )}
            </View>
          ))}
        </View>

        <View style={styles.preparedBy} wrap={false}>
          <Text style={styles.preparedLabel}>PREPARED BY:</Text>
          <View style={styles.signatureArea} wrap={false}>
            {signatureSource ? (
              // React-PDF Image does not expose an alt prop in its TypeScript API.
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={signatureSource} style={styles.signature} />
            ) : null}
            <Text style={styles.preparedName}>{brand.preparedBy}</Text>
          </View>
          <Text style={styles.preparedSubtitle}>{brand.preparedBySubtitle}</Text>
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
        <Text style={styles.itemName}>{description}</Text>
        {detailLines.map((line) => (
          <Text key={line} style={styles.itemDetail}>
            {line}
          </Text>
        ))}
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

function registerQuotationFonts() {
  const openSansSources = [
    fontSource(fontFiles.openSansRegular, 400),
    fontSource(fontFiles.openSansSemiBold, 600),
    fontSource(fontFiles.openSansBold, 700)
  ].filter((source): source is { src: string; fontWeight: number } => Boolean(source));

  if (openSansSources.length) {
    Font.register({ family: "Open Sans", fonts: openSansSources });
  }

  const aleoSources = [
    fontSource(fontFiles.aleoRegular, 400),
    fontSource(fontFiles.aleoBold, 700)
  ].filter((source): source is { src: string; fontWeight: number } => Boolean(source));

  if (aleoSources.length) {
    Font.register({ family: "Aleo", fonts: aleoSources });
  }

  if (fontFiles.balginRegular && existsSync(fontFiles.balginRegular)) {
    Font.register({ family: "Balgin", src: fontFiles.balginRegular });
  }

  return {
    body: openSansSources.length ? "Open Sans" : "Helvetica",
    aleo: aleoSources.length ? "Aleo" : "Helvetica",
    balgin: fontFiles.balginRegular && existsSync(fontFiles.balginRegular) ? "Balgin" : "Helvetica"
  };
}

function fontSource(src: string | null, fontWeight: number) {
  return src && existsSync(src) ? { src, fontWeight } : null;
}

function firstExistingPath(...filenames: string[]) {
  const roots = [
    path.join(process.cwd(), "public", "fonts"),
    path.join(process.cwd(), "public", "logo", "fonts")
  ];

  for (const root of roots) {
    for (const filename of filenames) {
      const candidate = path.join(root, filename);

      if (existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return path.join(roots[0], filenames[0]);
}

function imageSource(src: string) {
  if (!existsSync(src)) {
    return null;
  }

  return `data:image/png;base64,${readFileSync(src).toString("base64")}`;
}

function firstExistingAssetPath(...candidates: string[]) {
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}
