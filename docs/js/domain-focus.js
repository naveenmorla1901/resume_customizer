/**
 * Domain focus areas bridge a job description's vocabulary and the evidence
 * already in the master resume. A focus area is only "supported" when the
 * resume contains real evidence for it; unsupported areas are reported as
 * gaps and are never added to the document.
 *
 * Keep the labels noun phrases so they can be dropped into a summary sentence.
 */
import { compactTitle, joinNatural } from './util.js';

const FOCUS_AREAS = [
  {
    id: 'generative-ai',
    label: 'LLM/GenAI applications',
    kind: 'practice',
    weight: 3,
    jd: /\b(?:llms?|large language models?|genai|generative ai|gpt|claude|prompt engineering)\b/i,
    evidence: /\b(?:llms?|genai|generative ai|rag|prompt|agentic|langchain|openai|anthropic|claude|gpt)\b/i,
  },
  {
    id: 'rag-systems',
    label: 'RAG pipelines',
    kind: 'practice',
    weight: 2.5,
    jd: /\b(?:rag|retrieval[ -]augmented|vector databases?|embeddings?|semantic search)\b/i,
    evidence: /\b(?:rag|retrieval|vector|embedding|chromadb|faiss|pinecone|llamaindex)\b/i,
  },
  {
    id: 'agentic-workflows',
    label: 'agentic workflows',
    kind: 'practice',
    weight: 2,
    jd: /\b(?:agentic|multi[ -]?agent|tool use|orchestration)\b/i,
    evidence: /\b(?:agentic|agents?|langgraph|crewai|autogen|dspy|orchestration)\b/i,
  },
  {
    id: 'mlops-deployment',
    label: 'MLOps',
    kind: 'practice',
    weight: 1.5,
    jd: /\b(?:mlops|model deployment|model monitoring|drift|production ml)\b/i,
    evidence: /\b(?:mlops|deployment|mlflow|monitoring|drift|kubernetes|docker)\b/i,
  },
  {
    id: 'data-engineering',
    label: 'data pipelines',
    kind: 'practice',
    weight: 1.5,
    jd: /\b(?:data pipelines?|etl|elt|data warehouse|ingestion|spark|airflow)\b/i,
    evidence: /\b(?:etl|pipeline|spark|airflow|kafka|warehouse|snowflake|databricks)\b/i,
  },
  {
    id: 'analytics-bi',
    label: 'business intelligence',
    kind: 'practice',
    weight: 1.25,
    jd: /\b(?:business intelligence|analytics|dashboards?|reporting|kpis?)\b/i,
    evidence: /\b(?:power bi|tableau|dashboard|kpi|report|business intelligence|analytics)\b/i,
  },
  {
    id: 'predictive-maintenance',
    label: 'predictive maintenance',
    kind: 'practice',
    weight: 2.5,
    jd: /\b(?:predictive maintenance|condition monitoring|equipment reliability|asset reliability|failure prediction|preventive maintenance)\b/i,
    evidence: /\b(?:predictive maintenance|anomaly detection|sensor(?:s| data| datasets)?|industrial iot|predictive models?|condition monitoring)\b/i,
  },
  {
    id: 'reliability-uptime',
    label: 'reliability engineering',
    kind: 'practice',
    weight: 1.75,
    jd: /\b(?:reliability|uptime|availability|high availability|incident response|failure reduction|downtime)\b/i,
    evidence: /\b(?:reliability|reliable|anomaly detection|predictive models?|monitoring|uptime|downtime|failure)\b/i,
  },
  {
    id: 'capacity-planning',
    label: 'capacity planning',
    kind: 'practice',
    weight: 3,
    jd: /\b(?:capacity planning|demand planning|demand forecasting|inventory planning|workload planning|resource planning)\b/i,
    evidence: /\b(?:forecast|forecasting|inventory|demand|capacity|planning)\b/i,
  },
  {
    id: 'real-time-monitoring',
    label: 'real-time monitoring',
    kind: 'practice',
    weight: 1.5,
    jd: /\b(?:real[ -]?time|monitoring|observability|telemetry|alerting|operational visibility)\b/i,
    evidence: /\b(?:real[ -]?time|streaming|monitoring|sensor|telemetry|dashboard)\b/i,
  },
  {
    id: 'operational-efficiency',
    label: 'operational efficiency',
    kind: 'practice',
    weight: 1,
    jd: /\b(?:operational efficiency|process improvement|throughput|cost reduction|productivity|manual effort|automation)\b/i,
    evidence: /\b(?:reduc|optimiz|automat|efficien|streamlin|accelerat)\w*/i,
  },
  {
    id: 'root-cause-analysis',
    label: 'root-cause analysis',
    kind: 'practice',
    weight: 1.5,
    jd: /\b(?:root[ -]?cause|rca|diagnos|troubleshoot|failure analysis)\b/i,
    evidence: /\b(?:anomaly detection|hypothesis|data mining|diagnos|root cause)\b/i,
  },
  {
    id: 'workflow-automation',
    label: 'workflow automation',
    kind: 'practice',
    weight: 1,
    jd: /\b(?:workflow automation|automate|automated workflows|orchestration|ci\/cd)\b/i,
    evidence: /\b(?:automat|ci\/cd|pipeline|workflow)\w*/i,
  },
  {
    id: 'stakeholder-reporting',
    label: 'stakeholder reporting',
    kind: 'practice',
    weight: 0.75,
    jd: /\b(?:stakeholder|executive reporting|leadership reporting|kpi reporting|business reporting)\b/i,
    evidence: /\b(?:stakeholder|dashboard|kpi|report)\w*/i,
  },
  {
    id: 'data-governance',
    label: 'data governance',
    kind: 'practice',
    weight: 0.75,
    jd: /\b(?:data governance|data quality|data lineage|data stewardship|metadata management)\b/i,
    evidence: /\b(?:data governance|data quality|normalized|schema|redundancy|reliability)\b/i,
  },
  {
    id: 'cloud-infrastructure',
    label: 'cloud infrastructure',
    kind: 'practice',
    weight: 0.75,
    jd: /\b(?:cloud infrastructure|aws|azure|gcp|google cloud|kubernetes|containers?)\b/i,
    evidence: /\b(?:aws|azure|gcp|cloud|kubernetes|docker)\b/i,
  },
  {
    id: 'data-center-operations',
    label: 'data center operations',
    kind: 'domain',
    weight: 1.5,
    jd: /\b(?:data cent(?:er|re)|datacent(?:er|re)|critical facilities|colocation|hyperscale|server farm)\b/i,
    evidence: /\b(?:industrial iot|manufacturing|sensor|critical facilities|data cent(?:er|re))\b/i,
  },
  {
    id: 'facilities-infrastructure',
    label: 'facilities infrastructure (HVAC, BMS, power, cooling)',
    kind: 'domain',
    weight: 1.5,
    jd: /\b(?:hvac|bms|scada|pue|power distribution|electrical distribution|cooling|commissioning|critical facilities)\b/i,
    evidence: /\b(?:hvac|bms|scada|pue|power distribution|electrical distribution|cooling|commissioning)\b/i,
  },
];

export function extractFocusAreas(jd = '', resumeText = '') {
  const jdText = String(jd || '');
  const evidenceText = String(resumeText || '');
  const supported = [];
  const unsupported = [];

  for (const area of FOCUS_AREAS) {
    if (!area.jd.test(jdText)) continue;
    if (evidenceText && area.evidence.test(evidenceText)) supported.push(area);
    else unsupported.push(area);
  }

  return { supported, unsupported };
}

export function focusCoverage(analysis = {}) {
  const supported = (analysis.focusAreas || []).length;
  const unsupported = (analysis.unsupportedFocus || []).length;
  const total = supported + unsupported;
  return total ? Math.round((supported / total) * 100) : null;
}

export function focusSentence(analysis = {}) {
  const title = compactTitle(analysis.title || '', { maxWords: 8, maxChars: 72 })
    .replace(/[.\s]+$/, '')
    .trim();
  const supported = Array.isArray(analysis.focusAreas) ? analysis.focusAreas : [];
  const practices = supported
    .filter((area) => area.kind !== 'domain')
    .slice()
    .sort((a, b) => (Number(b.weight) || 1) - (Number(a.weight) || 1))
    .slice(0, 3)
    .map((area) => area.label);

  if (!title && !practices.length) return '';
  const target = title ? `Targeting ${title} roles` : 'Targeting this role';
  const evidence = practices.length
    ? `, with transferable evidence in ${joinNatural(practices)}`
    : '';
  return `${target}${evidence}.`;
}
