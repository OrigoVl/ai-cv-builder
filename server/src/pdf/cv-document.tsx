// Server-rendered A4 CV as a real PDF with a selectable text layer — @react-pdf/renderer draws
// actual PDF text objects (not an image of HTML), so the output is both downloadable and
// copy-pasteable/searchable. Deliberately one fixed template (multiple templates explicitly
// out of scope per the task brief).
//
// Uses react-pdf's built-in Helvetica (a standard PDF font, no embedding needed) rather than an
// embedded TTF — see README's "what was simplified" section: this keeps the Docker image free of
// a font asset pipeline at the cost of non-Latin-script support (Helvetica only covers WinAnsi).
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { CvContent } from "../modules/cvs/cv.schemas.js";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10.5, fontFamily: "Helvetica", color: "#1a1a1a" },
  name: { fontSize: 20, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  contactRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14, color: "#444" },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 14,
    marginBottom: 6,
    borderBottom: "1pt solid #ccc",
    paddingBottom: 3,
  },
  summary: { marginBottom: 4, lineHeight: 1.4 },
  entry: { marginBottom: 8 },
  entryHeaderRow: { flexDirection: "row", justifyContent: "space-between" },
  entryTitle: { fontFamily: "Helvetica-Bold", fontSize: 11 },
  entrySubtitle: { color: "#444", marginBottom: 3 },
  dateRange: { color: "#666" },
  bullet: { flexDirection: "row", marginBottom: 2 },
  bulletDot: { width: 10 },
  bulletText: { flex: 1, lineHeight: 1.35 },
  skillsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  skillChip: { backgroundColor: "#f0f0f0", borderRadius: 3, paddingHorizontal: 6, paddingVertical: 2 },
});

function dateRange(start: string, end: string): string {
  if (!start && !end) return "";
  return [start || "?", end || "Present"].join(" – ");
}

export function CvDocument({ content }: { content: CvContent }) {
  const { contact, summary, experience, education, skills } = content;
  const contactParts = [contact.email, contact.phone, contact.location, ...contact.links].filter(Boolean);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.name}>{contact.name || "Untitled CV"}</Text>
        {contactParts.length > 0 && (
          <View style={styles.contactRow}>
            {contactParts.map((part, i) => (
              <Text key={i}>{part}</Text>
            ))}
          </View>
        )}

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
                <View style={styles.entryHeaderRow}>
                  <Text style={styles.entryTitle}>
                    {entry.title}
                    {entry.title && entry.company ? " · " : ""}
                    {entry.company}
                  </Text>
                  <Text style={styles.dateRange}>{dateRange(entry.startDate, entry.endDate)}</Text>
                </View>
                {entry.location && <Text style={styles.entrySubtitle}>{entry.location}</Text>}
                {entry.bullets.map((bullet, j) => (
                  <View key={j} style={styles.bullet}>
                    <Text style={styles.bulletDot}>•</Text>
                    <Text style={styles.bulletText}>{bullet}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {education.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Education</Text>
            {education.map((entry, i) => (
              <View key={i} style={styles.entry} wrap={false}>
                <View style={styles.entryHeaderRow}>
                  <Text style={styles.entryTitle}>
                    {entry.degree}
                    {entry.degree && entry.field ? ", " : ""}
                    {entry.field}
                  </Text>
                  <Text style={styles.dateRange}>{dateRange(entry.startDate, entry.endDate)}</Text>
                </View>
                <Text style={styles.entrySubtitle}>{entry.institution}</Text>
              </View>
            ))}
          </View>
        )}

        {skills.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Skills</Text>
            <View style={styles.skillsRow}>
              {skills.map((skill, i) => (
                <Text key={i} style={styles.skillChip}>
                  {skill}
                </Text>
              ))}
            </View>
          </View>
        )}
      </Page>
    </Document>
  );
}
