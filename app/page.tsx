"use client";

import React, { useState, useEffect, useRef } from "react";

interface ExtractedData {
  documentType: string;
  category: string;
  detectedOriginalLanguage: string;
  urgency: "Low" | "Medium" | "High" | "Urgent" | string;
  urgencyReason?: string;
  summary: string;
  fullTranslatedDocument: string;
  issuingAuthority: {
    name: string;
    department?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
  };
  recipient?: {
    name?: string | null;
    referenceNumber?: string | null;
  };
  financials?: {
    hasFinancialImpact: boolean;
    amount?: string | null;
    nature?: string | null;
    paymentDeadline?: string | null;
    bankDetails?: {
      iban?: string | null;
      bic?: string | null;
      reference?: string | null;
    };
  };
  deadlines: Array<{
    date: string;
    label: string;
    consequence?: string;
    severity?: string;
  }>;
  requiredActions: Array<{
    step: number;
    title: string;
    action: string;
    deadline?: string | null;
    method?: string | null;
  }>;
  appealOptions?: {
    allowed: boolean;
    deadline?: string | null;
    body?: string | null;
    instructions?: string | null;
  };
  draftResponseLetter?: string;
}

const LANGUAGES = [
  { code: "English", label: "English" },
  { code: "Spanish", label: "Español (Spanish)" },
  { code: "German", label: "Deutsch (German)" },
  { code: "French", label: "Français (French)" },
  { code: "Hindi", label: "हिन्दी (Hindi)" },
  { code: "Italian", label: "Italiano (Italian)" },
  { code: "Polish", label: "Polski (Polish)" },
  { code: "Arabic", label: "العربية (Arabic)" },
];

const RESPONSE_TONES = [
  { id: "submission", label: "📄 Document Submission / Compliance" },
  { id: "extension", label: "⏳ Request Deadline Extension" },
  { id: "appeal", label: "⚖️ Formal Legal Appeal / Objection" },
];

export default function BuroAIApp() {
  const [file, setFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState("English");
  const [responseTone, setResponseTone] = useState("submission");
  const [activeTab, setActiveTab] = useState<"actions" | "reply" | "translation" | "original">("actions");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusStage, setStatusStage] = useState("");
  const [result, setResult] = useState<ExtractedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  // Global Clipboard Screenshot Paste Handler
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData && e.clipboardData.files && e.clipboardData.files[0]) {
        const pastedFile = e.clipboardData.files[0];
        if (pastedFile.type.startsWith("image/")) {
          setFile(pastedFile);
          setError(null);
          showToast("Pasted image from clipboard!");
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  // Update image preview URL
  useEffect(() => {
    if (!file) {
      setFilePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setFilePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Stepped progress animation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading) {
      setProgress(10);
      setStatusStage(`Processing buffer & initializing ${selectedLanguage} pipeline...`);

      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev < 35) {
            setStatusStage("Analyzing typography, seal markers & agency identity...");
            return prev + 5;
          } else if (prev < 70) {
            setStatusStage("Extracting deadlines, financial liabilities & reference codes...");
            return prev + 4;
          } else if (prev < 90) {
            setStatusStage(`Drafting formal ${responseTone} response & executive translation...`);
            return prev + 2;
          }
          return prev;
        });
      }, 230);
    } else {
      setProgress(0);
    }
    return () => clearInterval(interval);
  }, [loading, selectedLanguage, responseTone]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const executeAnalysis = async (customTone?: string, customLang?: string) => {
    if (!file) return;

    const tone = customTone || responseTone;
    const lang = customLang || selectedLanguage;

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("targetLanguage", lang);
      formData.append("responseTone", tone);

      const res = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        throw new Error(json.error || "Analysis failed.");
      }

      setProgress(100);
      setStatusStage("Complete!");
      setTimeout(() => {
        setResult(json.data);
        setActiveTab("actions");
        setLoading(false);
      }, 300);
    } catch (err: any) {
      setError(err.message || "An error occurred.");
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`Copied ${label} to clipboard`);
  };

  const downloadResponseLetter = () => {
    if (!result?.draftResponseLetter) return;
    const blob = new Blob([result.draftResponseLetter], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `buroai-response-letter.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast("Downloaded response letter (.txt)");
  };

  const downloadCalendarReminder = (dateStr: string, summary: string, desc: string) => {
    try {
      const cleanDate = dateStr.replace(/[^0-9]/g, "");
      const startDate = cleanDate.length >= 8 ? cleanDate.slice(0, 8) : "20261015";
      
      const icsContent = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//BuroAI//Document Deadline//EN",
        "BEGIN:VEVENT",
        `SUMMARY:⚠️ DEADLINE: ${summary}`,
        `DESCRIPTION:${desc.replace(/\n/g, "\\n")}`,
        `DTSTART;VALUE=DATE:${startDate}`,
        `DTEND;VALUE=DATE:${startDate}`,
        "STATUS:CONFIRMED",
        "END:VEVENT",
        "END:VCALENDAR",
      ].join("\r\n");

      const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `deadline-${startDate}.ics`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast("Calendar event (.ics) saved");
    } catch (e) {
      showToast("Could not generate calendar file");
    }
  };

  const getUrgencyTheme = (urgency: string) => {
    const u = urgency.toLowerCase();
    if (u.includes("urgent") || u.includes("high")) {
      return { bg: "#fee2e2", border: "#fca5a5", text: "#991b1b", dot: "#dc2626" };
    }
    if (u.includes("medium")) {
      return { bg: "#fef3c7", border: "#fde68a", text: "#92400e", dot: "#d97706" };
    }
    return { bg: "#dcfce7", border: "#bbf7d0", text: "#166534", dot: "#16a34a" };
  };

  const completedCount = Object.values(completedSteps).filter(Boolean).length;
  const totalSteps = result?.requiredActions?.length || 0;
  const urgencyTheme = result ? getUrgencyTheme(result.urgency) : null;

  return (
    <div style={styles.container}>
      {toastMessage && <div style={styles.toast}>{toastMessage}</div>}

      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.logoRow}>
            <div style={styles.logoIcon}>B</div>
            <div>
              <span style={styles.logoText}>BuroAI</span>
              <span style={styles.badge}>European Administrative Intelligence</span>
            </div>
          </div>
          <div style={styles.securityIndicator}>
            <span style={styles.statusDot}></span>
            Zero Data Retention • In-Memory Processing
          </div>
        </div>
      </header>

      <main style={styles.main}>
        {/* Upload State */}
        {!result && (
          <div style={styles.uploadContainer}>
            <div style={styles.heroText}>
              <div style={styles.pillBadge}>✨ Universal Document Analysis & Reply Engine</div>
              <h1 style={styles.mainTitle}>Demystify Bureaucratic Documents</h1>
              <p style={styles.subtitle}>
                Upload or snap official notices. Extract deadlines, financial liability, translated actions, and pre-drafted legal response letters.
              </p>
            </div>

            {/* Language & Tone Preferences */}
            <div style={styles.configGrid}>
              <div style={styles.configCard}>
                <span style={styles.cardMiniHeading}>OUTPUT TRANSLATION LANGUAGE</span>
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  style={styles.selectInput}
                  disabled={loading}
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.configCard}>
                <span style={styles.cardMiniHeading}>RESPONSE LETTER GOAL</span>
                <select
                  value={responseTone}
                  onChange={(e) => setResponseTone(e.target.value)}
                  style={styles.selectInput}
                  disabled={loading}
                >
                  {RESPONSE_TONES.map((tone) => (
                    <option key={tone.id} value={tone.id}>
                      {tone.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Dropzone & Quick Capture */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0]);
              }}
              onClick={() => fileInputRef.current?.click()}
              style={{
                ...styles.dropzone,
                borderColor: file ? "#2563eb" : "#cbd5e1",
                backgroundColor: file ? "#f8faff" : "#ffffff",
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handleFileSelect}
                style={{ display: "none" }}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                style={{ display: "none" }}
              />

              <div style={styles.dropzoneContent}>
                <div style={styles.fileIconWrapper}>{file ? "📑" : "📤"}</div>
                {file ? (
                  <div>
                    <p style={styles.fileName}>{file.name}</p>
                    <p style={styles.fileSize}>
                      {(file.size / 1024).toFixed(1)} KB • Target: {selectedLanguage}
                    </p>
                  </div>
                ) : (
                  <div>
                    <p style={styles.dropPrompt}>Click to choose file, drag & drop, or paste screenshot (Cmd+V)</p>
                    <p style={styles.dropSubtext}>PDF, PNG, JPG (Scanned paperwork up to 20MB)</p>
                  </div>
                )}
              </div>
            </div>

            {/* Camera Quick Action for Mobile */}
            <div style={styles.mobileCaptureRow}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  cameraInputRef.current?.click();
                }}
                style={styles.cameraButton}
              >
                📸 Take Photo with Camera
              </button>
            </div>

            {/* Analyze CTA */}
            {file && !loading && (
              <button onClick={() => executeAnalysis()} style={styles.primaryButton}>
                Analyze & Translate Document ({selectedLanguage}) ➔
              </button>
            )}

            {/* Stepped Progress Indicator */}
            {loading && (
              <div style={styles.progressCard}>
                <div style={styles.progressHeader}>
                  <span style={styles.progressStageText}>{statusStage}</span>
                  <span style={styles.progressPercentage}>{progress}%</span>
                </div>

                <div style={styles.progressBarTrack}>
                  <div style={{ ...styles.progressBarFill, width: `${progress}%` }} />
                </div>

                <div style={styles.progressFooter}>
                  <span>🔒 In-Memory Buffer</span>
                  <span>⚡ Gemini Engine</span>
                </div>
              </div>
            )}

            {error && (
              <div style={styles.errorBox}>
                <strong>Analysis Error: </strong> {error}
              </div>
            )}
          </div>
        )}

        {/* Results Workspace */}
        {result && (
          <div style={styles.workspace}>
            {/* Header Controls */}
            <div style={styles.workspaceHeader}>
              <div style={styles.headerMetaBlock}>
                <div style={styles.tagRow}>
                  <span style={styles.categoryBadge}>{result.category || "Official Document"}</span>
                  <span style={styles.metaLabel}>
                    {result.detectedOriginalLanguage || "Original"} ➔ {selectedLanguage}
                  </span>
                </div>
                <h2 style={styles.docTitle}>{result.documentType}</h2>
              </div>

              <div style={styles.actionGroup}>
                <select
                  value={selectedLanguage}
                  onChange={(e) => {
                    const newLang = e.target.value;
                    setSelectedLanguage(newLang);
                    executeAnalysis(undefined, newLang);
                  }}
                  style={styles.retranslateSelect}
                  disabled={loading}
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      Translate to {lang.label}
                    </option>
                  ))}
                </select>

                {urgencyTheme && (
                  <span
                    style={{
                      ...styles.urgencyBadge,
                      backgroundColor: urgencyTheme.bg,
                      color: urgencyTheme.text,
                      border: `1px solid ${urgencyTheme.border}`,
                    }}
                  >
                    <span style={{ ...styles.statusDot, backgroundColor: urgencyTheme.dot }}></span>
                    {result.urgency} Urgency
                  </span>
                )}

                <button onClick={() => window.print()} style={styles.secondaryButton}>
                  🖨️ Print Summary
                </button>

                <button
                  onClick={() => {
                    setResult(null);
                    setFile(null);
                  }}
                  style={styles.secondaryButton}
                >
                  Upload New
                </button>
              </div>
            </div>

            {/* Tab Navigation */}
            <div style={styles.tabContainer}>
              <button
                onClick={() => setActiveTab("actions")}
                style={{
                  ...styles.tabButton,
                  ...(activeTab === "actions" ? styles.tabButtonActive : {}),
                }}
              >
                📋 Action Intelligence & Deadlines
              </button>
              <button
                onClick={() => setActiveTab("reply")}
                style={{
                  ...styles.tabButton,
                  ...(activeTab === "reply" ? styles.tabButtonActive : {}),
                }}
              >
                ✉️ Auto-Drafted Response Letter
              </button>
              <button
                onClick={() => setActiveTab("translation")}
                style={{
                  ...styles.tabButton,
                  ...(activeTab === "translation" ? styles.tabButtonActive : {}),
                }}
              >
                🌐 Full Translation ({selectedLanguage})
              </button>
              {filePreviewUrl && (
                <button
                  onClick={() => setActiveTab("original")}
                  style={{
                    ...styles.tabButton,
                    ...(activeTab === "original" ? styles.tabButtonActive : {}),
                  }}
                >
                  📄 Original Document Source
                </button>
              )}
            </div>

            {/* TAB 1: Structured Intelligence */}
            {activeTab === "actions" && (
              <div style={styles.grid}>
                <div style={styles.mainCol}>
                  {/* Executive Summary */}
                  <div style={styles.card}>
                    <div style={styles.cardHeaderRow}>
                      <h3 style={styles.cardTitle}>Executive Plain-Language Summary</h3>
                      <button
                        onClick={() => copyToClipboard(result.summary, "Summary")}
                        style={styles.ghostButton}
                      >
                        Copy
                      </button>
                    </div>
                    <p style={styles.summaryText}>{result.summary}</p>
                    {result.urgencyReason && (
                      <div style={styles.urgencyReasonBox}>
                        <strong>Urgency Factor: </strong> {result.urgencyReason}
                      </div>
                    )}
                  </div>

                  {/* Required Checklist */}
                  {result.requiredActions && result.requiredActions.length > 0 && (
                    <div style={styles.card}>
                      <div style={styles.cardHeaderRow}>
                        <div>
                          <h3 style={styles.cardTitle}>Required Action Checklist</h3>
                          <p style={styles.subtitleSmall}>
                            {completedCount} of {totalSteps} items completed
                          </p>
                        </div>
                        <span style={styles.badgeSmall}>
                          {completedCount === totalSteps && totalSteps > 0
                            ? "✅ All Completed"
                            : `${totalSteps - completedCount} Actions Pending`}
                        </span>
                      </div>

                      <div style={styles.miniProgressTrack}>
                        <div
                          style={{
                            ...styles.miniProgressFill,
                            width: `${(completedCount / totalSteps) * 100}%`,
                          }}
                        />
                      </div>

                      <div style={styles.actionList}>
                        {result.requiredActions.map((item, idx) => {
                          const isDone = !!completedSteps[idx];
                          return (
                            <div
                              key={idx}
                              onClick={() =>
                                setCompletedSteps((prev) => ({ ...prev, [idx]: !prev[idx] }))
                              }
                              style={{
                                ...styles.actionItem,
                                backgroundColor: isDone ? "#f1f5f9" : "#ffffff",
                                opacity: isDone ? 0.75 : 1,
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isDone}
                                onChange={() => {}}
                                style={styles.checkbox}
                              />
                              <div style={{ flex: 1 }}>
                                <div style={styles.actionHeaderRow}>
                                  <strong
                                    style={{
                                      ...styles.actionHeading,
                                      textDecoration: isDone ? "line-through" : "none",
                                      color: isDone ? "#64748b" : "#0f172a",
                                    }}
                                  >
                                    {item.title || `Step ${idx + 1}`}
                                  </strong>
                                  {item.method && (
                                    <span style={styles.methodTag}>{item.method}</span>
                                  )}
                                </div>
                                <p
                                  style={{
                                    ...styles.actionText,
                                    textDecoration: isDone ? "line-through" : "none",
                                    color: isDone ? "#64748b" : "#334155",
                                  }}
                                >
                                  {item.action}
                                </p>
                                {item.deadline && (
                                  <p style={styles.deadlineTag}>Due by: {item.deadline}</p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Appeal Rights */}
                  {result.appealOptions?.instructions && (
                    <div style={styles.card}>
                      <h3 style={styles.cardTitle}>Legal Remedy / Appeal Rights</h3>
                      <p style={styles.summaryText}>{result.appealOptions.instructions}</p>
                      {result.appealOptions.deadline && (
                        <p style={styles.deadlineTag}>
                          Appeal Window Closes: {result.appealOptions.deadline}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div style={styles.sidebarCol}>
                  {/* Deadlines Card */}
                  {result.deadlines && result.deadlines.length > 0 && (
                    <div style={styles.deadlinesCard}>
                      <h3 style={styles.deadlinesTitle}>Critical Deadlines</h3>
                      <div style={styles.deadlineList}>
                        {result.deadlines.map((dl, idx) => (
                          <div key={idx} style={styles.deadlineEntry}>
                            <div style={styles.deadlineTopRow}>
                              <p style={styles.deadlineDate}>{dl.date}</p>
                              <button
                                onClick={() =>
                                  downloadCalendarReminder(
                                    dl.date,
                                    result.documentType,
                                    dl.consequence || dl.label
                                  )
                                }
                                style={styles.calendarButton}
                              >
                                📅 Add (.ics)
                              </button>
                            </div>
                            <p style={styles.deadlineDesc}>{dl.label}</p>
                            {dl.consequence && (
                              <p style={styles.deadlineRisk}>⚠️ {dl.consequence}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Financials */}
                  {result.financials?.amount && (
                    <div style={styles.card}>
                      <span style={styles.metaLabel}>FINANCIAL IMPACT</span>
                      <div style={styles.financialAmount}>{result.financials.amount}</div>
                      {result.financials.nature && (
                        <p style={styles.financialType}>{result.financials.nature}</p>
                      )}
                      {result.financials.bankDetails?.iban && (
                        <div style={styles.ibanBox}>
                          <span style={styles.ibanLabel}>IBAN:</span>
                          <span style={styles.ibanValue}>{result.financials.bankDetails.iban}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Authority Info */}
                  <div style={styles.card}>
                    <span style={styles.metaLabel}>ISSUING AUTHORITY</span>
                    <h4 style={styles.authorityName}>{result.issuingAuthority.name}</h4>
                    {result.recipient?.referenceNumber && (
                      <div style={styles.referenceSection}>
                        <span style={styles.metaLabel}>CASE REFERENCE</span>
                        <div style={styles.referenceBox}>
                          <span style={styles.refCode}>{result.recipient.referenceNumber}</span>
                          <button
                            onClick={() =>
                              copyToClipboard(result.recipient?.referenceNumber || "", "Reference ID")
                            }
                            style={styles.copyButton}
                          >
                            Copy ID
                          </button>
                        </div>
                      </div>
                    )}
                    {result.issuingAuthority.contact && (
                      <div style={styles.contactSection}>
                        {result.issuingAuthority.contact.phone && (
                          <p style={styles.contactLine}>📞 {result.issuingAuthority.contact.phone}</p>
                        )}
                        {result.issuingAuthority.contact.email && (
                          <p style={styles.contactLine}>✉️ {result.issuingAuthority.contact.email}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Draft Response Letter */}
            {activeTab === "reply" && (
              <div style={styles.card}>
                <div style={styles.cardHeaderRow}>
                  <div>
                    <h3 style={styles.cardTitle}>Formal Response Letter Generator</h3>
                    <p style={styles.subtitleSmall}>
                      Pre-filled with reference IDs and legal clauses in {selectedLanguage}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={downloadResponseLetter} style={styles.secondaryButton}>
                      💾 Download (.txt)
                    </button>
                    <button
                      onClick={() =>
                        copyToClipboard(result.draftResponseLetter || "", "Response Letter")
                      }
                      style={styles.primaryButtonSmall}
                    >
                      Copy Letter
                    </button>
                  </div>
                </div>

                <div style={styles.toneSelectorBar}>
                  <span style={styles.metaLabel}>RE-DRAFT INTENT:</span>
                  <div style={{ display: "flex", gap: "6px" }}>
                    {RESPONSE_TONES.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => {
                          setResponseTone(t.id);
                          executeAnalysis(t.id);
                        }}
                        style={{
                          ...styles.tonePill,
                          ...(responseTone === t.id ? styles.tonePillActive : {}),
                        }}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={styles.letterPaper}>
                  {(result.draftResponseLetter || "Generating letter...").split("\n").map((para, idx) => (
                    <p key={idx} style={styles.letterParagraph}>
                      {para}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: Full Translation */}
            {activeTab === "translation" && (
              <div style={styles.card}>
                <div style={styles.cardHeaderRow}>
                  <div>
                    <h3 style={styles.cardTitle}>Complete Translated Letter</h3>
                    <p style={styles.subtitleSmall}>Faithfully rendered in {selectedLanguage}</p>
                  </div>
                  <button
                    onClick={() =>
                      copyToClipboard(result.fullTranslatedDocument, "Full Translation")
                    }
                    style={styles.secondaryButton}
                  >
                    Copy Translation
                  </button>
                </div>
                <div style={styles.translationContainer}>
                  {result.fullTranslatedDocument.split("\n").map((para, idx) => (
                    <p key={idx} style={styles.translationParagraph}>
                      {para}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 4: Original Preview */}
            {activeTab === "original" && filePreviewUrl && (
              <div style={styles.card}>
                <div style={styles.cardHeaderRow}>
                  <h3 style={styles.cardTitle}>Original Document Preview</h3>
                  <span style={styles.badgeSmall}>{file?.name}</span>
                </div>
                <div style={styles.previewFrameWrapper}>
                  {file?.type === "application/pdf" ? (
                    <iframe src={filePreviewUrl} style={styles.previewIframe} title="Preview" />
                  ) : (
                    <img src={filePreviewUrl} alt="Preview" style={styles.previewImage} />
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// Crisp UI Stylesheet
const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#f8fafc",
    color: "#0f172a",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    paddingBottom: "60px",
  },
  toast: {
    position: "fixed",
    bottom: "24px",
    right: "24px",
    backgroundColor: "#0f172a",
    color: "#ffffff",
    padding: "12px 20px",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: 500,
    boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
    zIndex: 100,
  },
  header: {
    backgroundColor: "#ffffff",
    borderBottom: "1px solid #e2e8f0",
    padding: "16px 24px",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  headerInner: {
    maxWidth: "1160px",
    margin: "0 auto",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logoRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  logoIcon: {
    width: "32px",
    height: "32px",
    backgroundColor: "#2563eb",
    color: "#ffffff",
    borderRadius: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "bold",
    fontSize: "16px",
    boxShadow: "0 2px 4px rgba(37,99,235,0.2)",
  },
  logoText: {
    fontSize: "18px",
    fontWeight: 700,
    color: "#0f172a",
    letterSpacing: "-0.5px",
  },
  badge: {
    marginLeft: "10px",
    fontSize: "11px",
    backgroundColor: "#f1f5f9",
    color: "#475569",
    padding: "3px 8px",
    borderRadius: "12px",
    fontWeight: 600,
    border: "1px solid #e2e8f0",
  },
  securityIndicator: {
    fontSize: "12px",
    color: "#475569",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontWeight: 500,
  },
  statusDot: {
    width: "8px",
    height: "8px",
    backgroundColor: "#10b981",
    borderRadius: "50%",
    display: "inline-block",
  },
  main: {
    maxWidth: "1160px",
    margin: "0 auto",
    padding: "36px 20px 0 20px",
  },
  uploadContainer: {
    maxWidth: "680px",
    margin: "0 auto",
    textAlign: "center",
  },
  heroText: {
    marginBottom: "24px",
  },
  pillBadge: {
    display: "inline-block",
    fontSize: "11px",
    fontWeight: 700,
    color: "#2563eb",
    backgroundColor: "#eff6ff",
    border: "1px solid #bfdbfe",
    borderRadius: "20px",
    padding: "4px 12px",
    marginBottom: "12px",
  },
  mainTitle: {
    fontSize: "32px",
    fontWeight: 800,
    color: "#0f172a",
    letterSpacing: "-0.8px",
    marginBottom: "10px",
  },
  subtitle: {
    fontSize: "15px",
    color: "#64748b",
    lineHeight: "1.5",
  },
  configGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "14px",
    marginBottom: "18px",
    textAlign: "left",
  },
  configCard: {
    backgroundColor: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    padding: "12px 16px",
  },
  cardMiniHeading: {
    fontSize: "10px",
    fontWeight: 700,
    color: "#64748b",
    letterSpacing: "0.5px",
    display: "block",
    marginBottom: "4px",
  },
  selectInput: {
    width: "100%",
    padding: "8px 10px",
    fontSize: "13px",
    fontWeight: 600,
    color: "#0f172a",
    backgroundColor: "#f8fafc",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    cursor: "pointer",
    outline: "none",
  },
  dropzone: {
    border: "2px dashed #cbd5e1",
    borderRadius: "16px",
    padding: "36px 24px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    marginBottom: "14px",
  },
  dropzoneContent: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "10px",
  },
  fileIconWrapper: {
    fontSize: "38px",
  },
  fileName: {
    fontSize: "15px",
    fontWeight: 600,
    color: "#0f172a",
    margin: 0,
  },
  fileSize: {
    fontSize: "12px",
    color: "#64748b",
    marginTop: "4px",
  },
  dropPrompt: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#334155",
    margin: 0,
  },
  dropSubtext: {
    fontSize: "12px",
    color: "#94a3b8",
    marginTop: "4px",
  },
  mobileCaptureRow: {
    marginBottom: "18px",
  },
  cameraButton: {
    backgroundColor: "#ffffff",
    border: "1px solid #cbd5e1",
    color: "#334155",
    borderRadius: "8px",
    padding: "8px 16px",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
  },
  primaryButton: {
    width: "100%",
    backgroundColor: "#2563eb",
    color: "#ffffff",
    border: "none",
    borderRadius: "12px",
    padding: "16px 20px",
    fontSize: "15px",
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: "0 4px 14px rgba(37, 99, 235, 0.25)",
  },
  primaryButtonSmall: {
    backgroundColor: "#2563eb",
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
    padding: "8px 14px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
  },
  progressCard: {
    backgroundColor: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "14px",
    padding: "20px",
    boxShadow: "0 4px 10px rgba(0, 0, 0, 0.04)",
    textAlign: "left",
  },
  progressHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "10px",
  },
  progressStageText: {
    fontSize: "13px",
    color: "#334155",
    fontWeight: 500,
  },
  progressPercentage: {
    fontSize: "14px",
    fontWeight: 700,
    color: "#2563eb",
    fontFamily: "monospace",
  },
  progressBarTrack: {
    width: "100%",
    height: "8px",
    backgroundColor: "#e2e8f0",
    borderRadius: "999px",
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#2563eb",
    borderRadius: "999px",
    transition: "width 0.3s ease",
  },
  progressFooter: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: "12px",
    fontSize: "11px",
    color: "#94a3b8",
  },
  errorBox: {
    marginTop: "16px",
    padding: "14px",
    backgroundColor: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: "10px",
    color: "#b91c1c",
    fontSize: "13px",
    textAlign: "left",
  },
  workspace: {
    display: "flex",
    flexDirection: "column",
    gap: "22px",
  },
  workspaceHeader: {
    backgroundColor: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "16px",
    padding: "20px 24px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "14px",
  },
  headerMetaBlock: {
    display: "flex",
    flexDirection: "column",
  },
  tagRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "4px",
  },
  categoryBadge: {
    fontSize: "11px",
    fontWeight: 700,
    color: "#2563eb",
    backgroundColor: "#eff6ff",
    border: "1px solid #bfdbfe",
    borderRadius: "6px",
    padding: "2px 8px",
    textTransform: "uppercase",
  },
  metaLabel: {
    fontSize: "11px",
    fontWeight: 700,
    color: "#64748b",
    letterSpacing: "0.5px",
  },
  docTitle: {
    fontSize: "22px",
    fontWeight: 800,
    color: "#0f172a",
    margin: 0,
    letterSpacing: "-0.5px",
  },
  actionGroup: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  urgencyBadge: {
    fontSize: "12px",
    fontWeight: 700,
    padding: "6px 14px",
    borderRadius: "20px",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    textTransform: "uppercase",
  },
  secondaryButton: {
    backgroundColor: "#f8fafc",
    border: "1px solid #cbd5e1",
    color: "#334155",
    padding: "8px 14px",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
  },
  ghostButton: {
    backgroundColor: "transparent",
    border: "none",
    color: "#2563eb",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
  },
  tabContainer: {
    display: "flex",
    gap: "6px",
    borderBottom: "1px solid #e2e8f0",
  },
  tabButton: {
    backgroundColor: "transparent",
    border: "none",
    padding: "10px 18px",
    fontSize: "14px",
    fontWeight: 600,
    color: "#64748b",
    cursor: "pointer",
    borderRadius: "8px 8px 0 0",
    borderBottom: "2px solid transparent",
  },
  tabButtonActive: {
    color: "#2563eb",
    borderBottom: "2px solid #2563eb",
    backgroundColor: "#ffffff",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
    gap: "22px",
    alignItems: "start",
  },
  mainCol: {
    display: "flex",
    flexDirection: "column",
    gap: "22px",
  },
  sidebarCol: {
    display: "flex",
    flexDirection: "column",
    gap: "22px",
  },
  card: {
    backgroundColor: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "16px",
    padding: "24px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
  },
  cardTitle: {
    fontSize: "16px",
    fontWeight: 700,
    color: "#0f172a",
    margin: 0,
  },
  subtitleSmall: {
    fontSize: "12px",
    color: "#64748b",
    margin: "3px 0 0 0",
  },
  summaryText: {
    fontSize: "14px",
    color: "#334155",
    lineHeight: "1.65",
    margin: "12px 0 0 0",
  },
  urgencyReasonBox: {
    marginTop: "12px",
    padding: "10px 14px",
    backgroundColor: "#fef3c7",
    border: "1px solid #fde68a",
    borderRadius: "8px",
    fontSize: "12px",
    color: "#92400e",
  },
  cardHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
  },
  badgeSmall: {
    fontSize: "11px",
    backgroundColor: "#f1f5f9",
    color: "#475569",
    padding: "3px 10px",
    borderRadius: "12px",
    fontWeight: 600,
  },
  miniProgressTrack: {
    width: "100%",
    height: "4px",
    backgroundColor: "#f1f5f9",
    borderRadius: "999px",
    overflow: "hidden",
    marginBottom: "14px",
  },
  miniProgressFill: {
    height: "100%",
    backgroundColor: "#10b981",
    transition: "width 0.2s ease",
  },
  actionList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  actionItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: "14px",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    padding: "14px",
    cursor: "pointer",
  },
  actionHeaderRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "2px",
  },
  actionHeading: {
    fontSize: "13px",
    fontWeight: 700,
  },
  methodTag: {
    fontSize: "10px",
    fontWeight: 600,
    backgroundColor: "#e0f2fe",
    color: "#0369a1",
    borderRadius: "4px",
    padding: "2px 6px",
  },
  checkbox: {
    marginTop: "3px",
    width: "16px",
    height: "16px",
    cursor: "pointer",
    accentColor: "#2563eb",
  },
  actionText: {
    fontSize: "13px",
    fontWeight: 500,
    margin: 0,
    lineHeight: "1.4",
  },
  deadlineTag: {
    fontSize: "11px",
    fontWeight: 600,
    color: "#b45309",
    margin: "4px 0 0 0",
  },
  deadlinesCard: {
    backgroundColor: "#fff1f2",
    border: "1px solid #fecdd3",
    borderRadius: "16px",
    padding: "22px",
  },
  deadlinesTitle: {
    fontSize: "12px",
    fontWeight: 700,
    color: "#be123c",
    letterSpacing: "0.5px",
    margin: "0 0 14px 0",
    textTransform: "uppercase",
  },
  deadlineList: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  deadlineEntry: {
    borderLeft: "3px solid #e11d48",
    paddingLeft: "12px",
  },
  deadlineTopRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  deadlineDate: {
    fontSize: "15px",
    fontWeight: 700,
    color: "#9f1239",
    margin: 0,
    fontFamily: "monospace",
  },
  calendarButton: {
    backgroundColor: "#ffffff",
    border: "1px solid #fca5a5",
    color: "#9f1239",
    fontSize: "11px",
    fontWeight: 600,
    borderRadius: "6px",
    padding: "3px 8px",
    cursor: "pointer",
  },
  deadlineDesc: {
    fontSize: "12px",
    color: "#334155",
    margin: "4px 0 0 0",
  },
  deadlineRisk: {
    fontSize: "11px",
    color: "#be123c",
    margin: "4px 0 0 0",
    fontWeight: 500,
  },
  financialAmount: {
    fontSize: "26px",
    fontWeight: 800,
    color: "#059669",
    fontFamily: "monospace",
    margin: "4px 0",
  },
  financialType: {
    fontSize: "13px",
    color: "#64748b",
    margin: 0,
  },
  ibanBox: {
    backgroundColor: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    padding: "8px 10px",
    marginTop: "10px",
  },
  ibanLabel: {
    fontSize: "10px",
    fontWeight: 700,
    color: "#64748b",
    display: "block",
  },
  ibanValue: {
    fontSize: "11px",
    fontFamily: "monospace",
    color: "#0f172a",
    wordBreak: "break-all",
  },
  authorityName: {
    fontSize: "15px",
    fontWeight: 700,
    color: "#0f172a",
    margin: "2px 0 0 0",
  },
  referenceSection: {
    marginTop: "14px",
    paddingTop: "14px",
    borderTop: "1px solid #f1f5f9",
  },
  referenceBox: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    padding: "8px 10px",
    marginTop: "6px",
  },
  refCode: {
    fontSize: "12px",
    fontFamily: "monospace",
    color: "#0f172a",
    fontWeight: 600,
  },
  copyButton: {
    backgroundColor: "#ffffff",
    border: "1px solid #cbd5e1",
    color: "#2563eb",
    fontSize: "11px",
    fontWeight: 600,
    borderRadius: "4px",
    padding: "3px 8px",
    cursor: "pointer",
  },
  contactSection: {
    marginTop: "14px",
    paddingTop: "14px",
    borderTop: "1px solid #f1f5f9",
    fontSize: "12px",
    color: "#64748b",
  },
  contactLine: {
    margin: "4px 0",
  },
  toneSelectorBar: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "16px",
    backgroundColor: "#f8fafc",
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid #e2e8f0",
    flexWrap: "wrap",
  },
  tonePill: {
    backgroundColor: "#ffffff",
    border: "1px solid #cbd5e1",
    borderRadius: "6px",
    padding: "4px 10px",
    fontSize: "12px",
    fontWeight: 600,
    color: "#475569",
    cursor: "pointer",
  },
  tonePillActive: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
    color: "#ffffff",
  },
  letterPaper: {
    backgroundColor: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    padding: "26px",
    fontFamily: "Georgia, Cambria, serif",
    color: "#1e293b",
    maxHeight: "550px",
    overflowY: "auto",
  },
  letterParagraph: {
    fontSize: "15px",
    lineHeight: "1.8",
    marginBottom: "14px",
  },
  translationContainer: {
    backgroundColor: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    padding: "24px",
    maxHeight: "550px",
    overflowY: "auto",
  },
  translationParagraph: {
    fontSize: "14px",
    lineHeight: "1.7",
    color: "#1e293b",
    marginBottom: "12px",
  },
  previewFrameWrapper: {
    backgroundColor: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    overflow: "hidden",
    height: "600px",
  },
  previewIframe: {
    width: "100%",
    height: "100%",
    border: "none",
  },
  previewImage: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
  },
  retranslateSelect: {
    padding: "6px 12px",
    fontSize: "12px",
    fontWeight: 600,
    color: "#1e293b",
    backgroundColor: "#f8fafc",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    cursor: "pointer",
    outline: "none",
  },
};