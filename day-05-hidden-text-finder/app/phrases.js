// Hidden Text Finder: spotting text aimed at AI screeners, and describing findings in plain words.
// Pure functions, shared by the PDF and Word readers and tested under Node.

// Phrases that only make sense as instructions to a language model or a screener, or as praise of
// the applicant written in the third person. Kept narrow on purpose: an ordinary CV that says
// "led a team" or "excellent communicator" must not match.
const PATTERNS = [
  /\b(ignore|disregard|forget|override)\b[^.]{0,40}\b(previous|prior|above|earlier|all|other|your)\b[^.]{0,20}\b(instructions?|prompts?|criteria|rules|guidelines|directions)\b/i,
  /\b(note|message|instructions?)\s+(to|for)\s+(the\s+)?(ai|a\.i\.|llm|model|chatbot|bot|screener|recruiter|reviewer|hiring\s+(manager|team|assistant)|ats)\b/i,
  /\byou\s+are\s+(now\s+)?(an?\s+)?(ai|assistant|hiring\s+assistant|recruit(er|ing)|screener|language\s+model|large\s+language\s+model|llm)\b/i,
  /\b(chat\s?gpt|gpt-?\d|claude|gemini|copilot|llama|llm|large\s+language\s+model)\b\s*[:,]/i,
  /\bas\s+an?\s+(ai|language\s+model)\b/i,
  /\b(system\s+prompt|prompt\s+injection)\b/i,
  /\b(rank|rate|score|grade|evaluate|recommend|shortlist|advance|select|prioriti[sz]e|mark)\b[^.]{0,25}\b(this|the)\s+(candidate|applicant|resume|r[eé]sum[eé]|cv|profile)\b/i,
  /\b(this|the)\s+(candidate|applicant)\s+(is|would\s+be|seems)\s+(an?\s+|the\s+)?(excellent|perfect|ideal|outstanding|exceptional|strongest|top|best|great|highly\s+qualified|ideal)\b/i,
  /\b(perfect|ideal|best|strongest|top)\s+(fit|match|candidate)\s+for\s+(this|the)\s+(role|position|job|vacancy)\b/i,
  /\b(must|should)\s+be\s+(interviewed|hired|shortlisted|advanced|selected)\b/i,
  /\b(score|rate|give)\b[^.]{0,30}\b(10\s*\/\s*10|100\s*%|five\s+stars|full\s+marks|top\s+score|highest\s+score)\b/i,
  /\b(\d{1,3}\s*\/\s*10|10\s*\/\s*10)\b[^.]{0,20}\b(candidate|resume|cv|match)\b/i,
];

export function aiInstruction(text) {
  if (!text) return null;
  for (const re of PATTERNS) {
    const m = text.match(re);
    if (m) return m[0];
  }
  return null;
}

// Hidden text that is a run of skills rather than sentences: commas or pipes between short items,
// or many capitalised terms with no full stop.
export function looksLikeKeywords(text) {
  const t = (text || '').trim();
  if (t.length < 24) return false;
  const parts = t.split(/[,|;•·\/]|\s{2,}/).map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 5 && parts.every((p) => p.split(/\s+/).length <= 4)) return true;
  const words = t.split(/\s+/);
  const caps = words.filter((w) => /^[A-Z][A-Za-z+#.]*$/.test(w)).length;
  return words.length >= 8 && !/[.!?]\s/.test(t) && caps / words.length > 0.5;
}

// Plain words for each kind of finding.
export const KINDS = {
  invisible: { label: 'Invisible on the page', why: 'The text is in the file, but the page shows nothing there: it is the colour of what is behind it, covered by a shape, or set never to be painted.' },
  faint: { label: 'Very faint', why: 'The text is so close to the colour behind it that a reader would not notice it.' },
  tiny: { label: 'Microscopic', why: 'The text is set so small that it shows as a speck or a line.' },
  offpage: { label: 'Outside the page', why: 'The text is placed beyond the edge of the page, where no viewer or printer shows it.' },
  vanish: { label: 'Hidden in Word', why: 'Word’s Hidden option is switched on for this text, so it is not shown or printed by default.' },
  deleted: { label: 'Deleted, still in the file', why: 'A tracked change removed this text, but it is still stored in the file.' },
  properties: { label: 'In the file’s details', why: 'This text sits in the file’s properties (title, subject, keywords, comments), which people rarely open but software reads.' },
  alttext: { label: 'In a picture’s description', why: 'This text is the hidden description of a picture, read by software and screen readers.' },
  annotation: { label: 'In a hidden note', why: 'This text is in a note or form field that is hidden from view.' },
  comment: { label: 'In a comment', why: 'This text is in a document comment.' },
  visibleai: { label: 'Instruction to AI, in plain sight', why: 'This text is visible, but it reads as an instruction to AI screening software.' },
};

export function summarize(result) {
  if (result.error) return { tone: 'error', title: result.error, short: 'Could not be read' };
  const f = result.findings || [];
  const hidden = f.filter((x) => x.kind !== 'visibleai');
  const ai = f.filter((x) => x.ai).length;
  if (result.noText) return { tone: 'neutral', title: 'No text in this file, only pictures of pages', short: 'No text layer' };
  if (!f.length) return { tone: 'clean', title: 'Nothing hidden found', short: 'Nothing hidden' };
  const n = hidden.length;
  let title = n ? (n === 1 ? '1 piece of hidden text' : n + ' pieces of hidden text') : 'No hidden text';
  if (ai) title += (n ? ', ' : ', but ') + (ai === 1 ? '1 instruction aimed at AI' : ai + ' instructions aimed at AI');
  return { tone: ai ? 'alert' : 'warn', title, short: ai ? (ai === 1 ? '1 AI instruction' : ai + ' AI instructions') : (n === 1 ? '1 hidden' : n + ' hidden') };
}
