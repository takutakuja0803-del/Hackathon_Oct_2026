require('dotenv').config();

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: [
    /^chrome-extension:\/\//,
    /^http:\/\/localhost(:\d+)?$/,
    /^http:\/\/127\.0\.0\.1(:\d+)?$/
  ]
}));
app.use(express.json({ limit: '1mb' }));

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// Accepts highlighted text or a lecture transcript and returns study material.
// Body: { text: string, source?: "highlight" | "transcript", targetLanguage?: string }
app.post('/api/process', async (req, res) => {
  const { text, source = 'highlight', targetLanguage = 'Spanish' } = req.body || {};

  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Request body must include a non-empty "text" string.' });
  }

  // TODO: Build the LLM prompt here. It should ask the model to reply with
  // only JSON matching this shape:
  //   {
  //     "eli5":    "Explain Like I'm 5 version of the text, written in targetLanguage",
  //     "notes":   "Formatted study notes (markdown bullets) for the text",
  //     "mermaid": "A Mermaid.js flowchart string that visualizes the main ideas"
  //   }
  // Include `source` so transcripts get summarized more aggressively than
  // short highlights.

  // TODO: Call the LLM provider with process.env.LLM_API_KEY, parse its JSON
  // reply, and validate that eli5, notes, and mermaid are all present strings
  // before returning. Never send the API key to the extension or web app.

  // Mock response so the extension and web app can be built against the shape.
  res.json({
    source,
    targetLanguage,
    eli5: `(${targetLanguage}) Simple explanation of: "${text.slice(0, 120)}"`,
    notes: `- Key idea from the ${source}\n- Supporting detail\n- Why it matters`,
    mermaid: 'flowchart TD\n  A[Main idea] --> B[Detail 1]\n  A --> C[Detail 2]'
  });
});

app.listen(PORT, () => {
  console.log(`Bridge proxy server running at http://localhost:${PORT}`);
});
