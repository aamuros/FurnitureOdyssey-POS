import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { generatedLabel } from "@/lib/pdf/data";
import { fallbackText } from "@/lib/pdf/formatters";
import type { OperationalPdfData, PdfItemRow, PdfSummaryRow } from "@/lib/pdf/types";

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 9,
    color: "#111827",
    fontFamily: "Helvetica"
  },
  header: {
    marginBottom: 20,
    borderBottom: "1px solid #d1d5db",
    paddingBottom: 12
  },
  headerTop: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 18
  },
  company: {
    fontSize: 18,
    fontWeight: 700
  },
  logo: {
    width: 54,
    height: 54,
    objectFit: "contain",
    marginBottom: 6
  },
  companyDetails: {
    marginTop: 3,
    lineHeight: 1.35
  },
  title: {
    marginTop: 16,
    fontSize: 22,
    fontWeight: 700
  },
  subtitle: {
    marginTop: 3,
    fontSize: 10,
    color: "#4b5563"
  },
  muted: {
    color: "#6b7280"
  },
  section: {
    marginTop: 14
  },
  sectionTitle: {
    marginBottom: 6,
    fontSize: 11,
    fontWeight: 700
  },
  grid: {
    display: "flex",
    flexDirection: "row",
    gap: 18
  },
  column: {
    flexGrow: 1,
    flexBasis: 0
  },
  row: {
    display: "flex",
    flexDirection: "row",
    borderBottom: "1px solid #e5e7eb",
    paddingVertical: 4
  },
  label: {
    width: "38%",
    color: "#6b7280"
  },
  value: {
    width: "62%"
  },
  tableHeader: {
    display: "flex",
    flexDirection: "row",
    borderBottom: "1px solid #9ca3af",
    paddingBottom: 4,
    fontWeight: 700
  },
  tableRow: {
    display: "flex",
    flexDirection: "row",
    borderBottom: "1px solid #e5e7eb",
    paddingVertical: 6
  },
  itemName: {
    width: "34%",
    paddingRight: 8
  },
  itemImage: {
    width: 42,
    height: 42,
    objectFit: "cover",
    marginRight: 6,
    border: "1px solid #e5e7eb"
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
  notes: {
    marginTop: 4,
    lineHeight: 1.35
  },
  paymentBox: {
    marginTop: 14,
    border: "1px solid #d1d5db",
    padding: 8
  },
  signatureGrid: {
    display: "flex",
    flexDirection: "row",
    gap: 24,
    marginTop: 24
  },
  signatureLine: {
    flexGrow: 1,
    borderTop: "1px solid #111827",
    paddingTop: 4,
    textAlign: "center"
  },
  footer: {
    marginTop: 18,
    borderTop: "1px solid #e5e7eb",
    paddingTop: 8,
    fontSize: 8,
    color: "#6b7280",
    lineHeight: 1.35
  }
});

export function OperationalPdfDocument({ data }: { data: OperationalPdfData }) {
  return (
    <Document title={data.title} author={data.company.displayName}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              {data.company.logoUrl ? (
                // React-PDF Image does not expose an alt prop in its TypeScript API.
                // eslint-disable-next-line jsx-a11y/alt-text
                <Image src={data.company.logoUrl} style={styles.logo} />
              ) : null}
              <Text style={styles.company}>{data.company.displayName}</Text>
              <View style={styles.companyDetails}>
                {data.company.registeredName ? (
                  <Text style={styles.muted}>{data.company.registeredName}</Text>
                ) : null}
                <Text style={styles.muted}>{fallbackText(data.company.address)}</Text>
                <Text style={styles.muted}>{fallbackText(data.company.contactNumber)}</Text>
                <Text style={styles.muted}>{fallbackText(data.company.email)}</Text>
                <Text style={styles.muted}>{fallbackText(data.company.facebookPage)}</Text>
                {data.company.websiteUrl ? <Text style={styles.muted}>{data.company.websiteUrl}</Text> : null}
              </View>
            </View>
            <Text style={styles.muted}>{generatedLabel(data)}</Text>
          </View>
          <Text style={styles.title}>{data.title}</Text>
          {data.subtitle ? <Text style={styles.subtitle}>{data.subtitle}</Text> : null}
        </View>

        <View style={styles.grid}>
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Customer</Text>
            <Text>{fallbackText(data.customer.displayName)}</Text>
            <Text style={styles.muted}>{fallbackText(data.customer.detail)}</Text>
            <Text style={styles.muted}>{fallbackText(data.customer.contact)}</Text>
            <Text style={styles.muted}>{fallbackText(data.customer.address)}</Text>
          </View>
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Document Summary</Text>
            <SummaryRows rows={data.summary} />
          </View>
        </View>

        {data.items?.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Items</Text>
            <View style={styles.tableHeader}>
              <Text style={styles.itemName}>Item</Text>
              <Text style={styles.qty}>Qty</Text>
              <Text style={styles.money}>Unit</Text>
              <Text style={styles.money}>Discount</Text>
              <Text style={styles.money}>Total</Text>
            </View>
            {data.items.map((item, index) => (
              <ItemRow key={`${item.name}-${index}`} item={item} />
            ))}
          </View>
        ) : null}

        {data.totals?.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Totals</Text>
            <SummaryRows rows={data.totals} />
          </View>
        ) : null}

        {data.payments?.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payments</Text>
            <SummaryRows rows={data.payments} />
          </View>
        ) : null}

        {data.deliveries?.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Deliveries</Text>
            <SummaryRows rows={data.deliveries} />
          </View>
        ) : null}

        {data.notes ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notes}>{data.notes}</Text>
          </View>
        ) : null}

        {data.paymentInstructions ||
        data.company.paymentInstructions ||
        data.company.bankDetails ||
        data.company.eWalletDetails ||
        data.company.otherPaymentNotes ? (
          <View style={styles.paymentBox}>
            <Text style={styles.sectionTitle}>Payment Instructions</Text>
            <Text style={styles.notes}>{fallbackText(data.paymentInstructions ?? data.company.paymentInstructions)}</Text>
            <Text style={styles.notes}>{fallbackText(data.company.bankDetails)}</Text>
            {data.company.eWalletDetails ? <Text style={styles.notes}>{data.company.eWalletDetails}</Text> : null}
            {data.company.otherPaymentNotes ? <Text style={styles.notes}>{data.company.otherPaymentNotes}</Text> : null}
          </View>
        ) : null}

        {data.signatureRequired ? (
          <View style={styles.signatureGrid}>
            <Text style={styles.signatureLine}>Received by / Signature</Text>
            <Text style={styles.signatureLine}>Date received</Text>
          </View>
        ) : null}

        {data.footerNote || data.company.footer ? (
          <View style={styles.footer}>
            <Text>{data.footerNote ?? data.company.footer}</Text>
            {data.assemblyTodo ? (
              <Text>Assembly required is not yet modeled in the delivery workflow.</Text>
            ) : null}
          </View>
        ) : null}
      </Page>
    </Document>
  );
}

function SummaryRows({ rows }: { rows: PdfSummaryRow[] }) {
  return (
    <View>
      {rows.map((row) => (
        <View key={row.label} style={styles.row}>
          <Text style={styles.label}>{row.label}</Text>
          <Text style={styles.value}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

function ItemRow({ item }: { item: PdfItemRow }) {
  return (
    <View style={styles.tableRow}>
      <View style={styles.itemName}>
        <View style={{ display: "flex", flexDirection: "row" }}>
          {item.imageUrl ? (
            // React-PDF Image does not expose an alt prop in its TypeScript API.
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={item.imageUrl} style={styles.itemImage} />
          ) : null}
          <View style={styles.itemBody}>
            <Text>{[item.code, item.name].filter(Boolean).join(" - ")}</Text>
            {item.description ? <Text style={styles.muted}>{item.description}</Text> : null}
            {item.discountDetail ? <Text style={styles.muted}>{item.discountDetail}</Text> : null}
            {item.notes ? <Text style={styles.muted}>{item.notes}</Text> : null}
          </View>
        </View>
      </View>
      <Text style={styles.qty}>
        {item.quantityDelivered ? `${item.quantity} planned\n${item.quantityDelivered} delivered` : item.quantity}
      </Text>
      <Text style={styles.money}>{item.unitPrice ?? ""}</Text>
      <Text style={styles.money}>{item.discount ?? ""}</Text>
      <Text style={styles.money}>{item.total ?? ""}</Text>
    </View>
  );
}
