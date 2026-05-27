import React from "react";
import { StyleSheet, Text, View } from "@react-pdf/renderer";
import { dreamHomeColors, dreamHomeFonts } from "@/lib/pdf/dream-home-layout";
import type { PdfDocumentTermsBlock, PdfPaymentTermsBlock } from "@/lib/pdf/types";

const { dark, muted } = dreamHomeColors;

const styles = StyleSheet.create({
  block: {
    marginTop: 10,
    fontFamily: dreamHomeFonts.body,
    fontSize: 7.8,
    lineHeight: 1.28,
    color: dark
  },
  compactBlock: {
    marginTop: 4,
    fontSize: 6.8,
    lineHeight: 1.15
  },
  section: {
    marginBottom: 4
  },
  compactSection: {
    marginBottom: 2
  },
  title: {
    fontWeight: 700
  },
  bulletRow: {
    display: "flex",
    flexDirection: "row",
    gap: 4,
    marginTop: 1.5
  },
  bullet: {
    width: 8
  },
  lineText: {
    flexGrow: 1,
    flexBasis: 0
  },
  highlight: {
    marginTop: 3,
    color: "#ff2d2d",
    fontWeight: 700,
    letterSpacing: 0.8
  },
  bankTitle: {
    marginTop: 2,
    fontWeight: 700,
    textTransform: "uppercase"
  },
  bankLine: {
    marginTop: 1.5
  },
  mutedLine: {
    color: muted
  }
});

export function PdfPaymentTermsBlockView({
  terms,
  compact = false
}: {
  terms?: PdfPaymentTermsBlock | null;
  compact?: boolean;
}) {
  if (!hasPaymentTerms(terms)) {
    return null;
  }

  return (
    <View style={compact ? [styles.block, styles.compactBlock] : styles.block}>
      {terms.policyTitle || terms.policyBullets.length ? (
        <View style={compact ? [styles.section, styles.compactSection] : styles.section}>
          {terms.policyTitle ? <Text style={styles.title}>{terms.policyTitle}</Text> : null}
          {terms.policyBullets.map((line) => (
            <View key={line} style={styles.bulletRow}>
              <Text style={styles.bullet}>-</Text>
              <Text style={styles.lineText}>{line}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {terms.highlightNote ? <Text style={styles.highlight}>{terms.highlightNote}</Text> : null}

      {terms.bankDetailsTitle || terms.bankDetailsLines.length ? (
        <View style={compact ? [styles.section, styles.compactSection] : styles.section}>
          {terms.bankDetailsTitle ? <Text style={styles.bankTitle}>{terms.bankDetailsTitle}</Text> : null}
          {terms.bankDetailsLines.map((line) => (
            <Text key={line} style={styles.bankLine}>
              {line}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function PdfDocumentTermsBlockView({
  terms,
  fallbackTitle,
  fallbackLines,
  compact = false
}: {
  terms?: PdfDocumentTermsBlock | null;
  fallbackTitle?: string;
  fallbackLines?: string[];
  compact?: boolean;
}) {
  const title = terms?.title?.trim() || fallbackTitle || "";
  const lines = terms?.lines?.length ? terms.lines : fallbackLines ?? [];

  if (!title && !lines.length) {
    return null;
  }

  return (
    <View style={compact ? [styles.block, styles.compactBlock] : styles.block}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {lines.map((line) => (
        <View key={line} style={styles.bulletRow}>
          <Text style={styles.bullet}>-</Text>
          <Text style={[styles.lineText, styles.mutedLine]}>{line}</Text>
        </View>
      ))}
    </View>
  );
}

function hasPaymentTerms(terms: PdfPaymentTermsBlock | null | undefined): terms is PdfPaymentTermsBlock {
  return Boolean(
    terms &&
      (terms.policyTitle ||
        terms.policyBullets.length ||
        terms.highlightNote ||
        terms.bankDetailsTitle ||
        terms.bankDetailsLines.length)
  );
}
