// Mirrors server/src/pdf/templates/modern.tsx EXACTLY — see classic.tsx in this same directory
// for why (the live preview renders this literal component tree, not an approximation of it).
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { CvContent } from "../../../shared/types.js";

const SIDEBAR_WIDTH = 170;
const BRAND = "#5B4FD9";

const styles = StyleSheet.create({
  page: { flexDirection: "row", fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a" },
  sidebar: { width: SIDEBAR_WIDTH, backgroundColor: BRAND, color: "#ffffff", padding: 24 },
  main: { flex: 1, padding: "28 28 28 24" },
  name: { fontSize: 17, fontFamily: "Helvetica-Bold", marginBottom: 14, lineHeight: 1.25 },
  sidebarLabel: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#D9D4FA",
    marginTop: 14,
    marginBottom: 6,
  },
  sidebarLine: { marginBottom: 4, lineHeight: 1.35, color: "#F1EFFE" },
  skillPill: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginBottom: 4,
    fontSize: 9,
  },
  sectionTitle: {
    fontSize: 10.5,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: BRAND,
    marginTop: 12,
    marginBottom: 6,
  },
  summary: { marginBottom: 4, lineHeight: 1.45 },
  entry: { marginBottom: 9 },
  entryTitle: { fontFamily: "Helvetica-Bold", fontSize: 10.5 },
  entrySubtitle: { color: "#555", marginTop: 1, marginBottom: 3 },
  dateRange: { color: "#888", fontSize: 9, marginTop: 1 },
  bullet: { flexDirection: "row", marginBottom: 2 },
  bulletDot: { width: 9, color: BRAND },
  bulletText: { flex: 1, lineHeight: 1.4 },
});

function dateRange(start: string, end: string): string {
  if (!start && !end) return "";
  return [start || "?", end || "Present"].join(" – ");
}

export function ModernTemplate({ content }: { content: CvContent }) {
  const { contact, summary, experience, education, skills } = content;
  const sidebarContact = [contact.email, contact.phone, contact.location, ...contact.links].filter(Boolean);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.sidebar}>
          <Text style={styles.name}>{contact.name || "Untitled CV"}</Text>

          {sidebarContact.length > 0 && (
            <View>
              <Text style={styles.sidebarLabel}>Contact</Text>
              {sidebarContact.map((line, i) => (
                <Text key={i} style={styles.sidebarLine}>
                  {line}
                </Text>
              ))}
            </View>
          )}

          {skills.length > 0 && (
            <View>
              <Text style={styles.sidebarLabel}>Skills</Text>
              {skills.map((skill, i) => (
                <Text key={i} style={styles.skillPill}>
                  {skill}
                </Text>
              ))}
            </View>
          )}

          {education.length > 0 && (
            <View>
              <Text style={styles.sidebarLabel}>Education</Text>
              {education.map((entry, i) => (
                <View key={i} style={{ marginBottom: 8 }} wrap={false}>
                  <Text style={[styles.sidebarLine, { fontFamily: "Helvetica-Bold" }]}>
                    {entry.degree}
                    {entry.degree && entry.field ? ", " : ""}
                    {entry.field}
                  </Text>
                  <Text style={styles.sidebarLine}>{entry.institution}</Text>
                  <Text style={[styles.sidebarLine, { fontSize: 8.5, color: "#D9D4FA" }]}>
                    {dateRange(entry.startDate, entry.endDate)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.main}>
          {summary && (
            <View>
              <Text style={styles.sectionTitle}>Summary</Text>
              <Text style={styles.summary}>{summary}</Text>
            </View>
          )}

          {experience.length > 0 && (
            <View>
              <Text style={styles.sectionTitle}>Experience</Text>
              {experience.map((entry, i) => (
                <View key={i} style={styles.entry} wrap={false}>
                  <Text style={styles.entryTitle}>{entry.title}</Text>
                  <Text style={styles.entrySubtitle}>
                    {entry.company}
                    {entry.company && entry.location ? " · " : ""}
                    {entry.location}
                  </Text>
                  <Text style={styles.dateRange}>{dateRange(entry.startDate, entry.endDate)}</Text>
                  {entry.bullets.map((bullet, j) => (
                    <View key={j} style={[styles.bullet, { marginTop: j === 0 ? 4 : 0 }]}>
                      <Text style={styles.bulletDot}>•</Text>
                      <Text style={styles.bulletText}>{bullet}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          )}
        </View>
      </Page>
    </Document>
  );
}
