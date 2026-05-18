import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { generatedLabel } from "@/lib/pdf/data";
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
  company: {
    fontSize: 16,
    fontWeight: 700
  },
  title: {
    marginTop: 12,
    fontSize: 20,
    fontWeight: 700
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
    width: "42%",
    paddingRight: 8
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
  }
});

export function OperationalPdfDocument({ data }: { data: OperationalPdfData }) {
  return (
    <Document title={data.title} author={data.company.displayName}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.company}>{data.company.displayName}</Text>
          {data.company.address ? <Text style={styles.muted}>{data.company.address}</Text> : null}
          {data.company.contact ? <Text style={styles.muted}>{data.company.contact}</Text> : null}
          <Text style={styles.title}>{data.title}</Text>
          <Text style={styles.muted}>{generatedLabel(data)}</Text>
        </View>

        <View style={styles.grid}>
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Customer</Text>
            <Text>{data.customer.displayName}</Text>
            {data.customer.detail ? <Text style={styles.muted}>{data.customer.detail}</Text> : null}
            {data.customer.contact ? <Text style={styles.muted}>{data.customer.contact}</Text> : null}
            {data.customer.address ? <Text style={styles.muted}>{data.customer.address}</Text> : null}
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
        <Text>{[item.code, item.name].filter(Boolean).join(" · ")}</Text>
        {item.description ? <Text style={styles.muted}>{item.description}</Text> : null}
        {item.notes ? <Text style={styles.muted}>{item.notes}</Text> : null}
      </View>
      <Text style={styles.qty}>{item.quantity}</Text>
      <Text style={styles.money}>{item.unitPrice ?? ""}</Text>
      <Text style={styles.money}>{item.discount ?? ""}</Text>
      <Text style={styles.money}>{item.total ?? ""}</Text>
    </View>
  );
}

