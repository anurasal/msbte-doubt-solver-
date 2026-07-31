// ---- State ----
let catalog = null;
let currentSubjectData = null;
let currentLang = 'en';
let chatHistory = [];

const el = (id) => document.getElementById(id);

// ---- Init ----
async function init() {
  catalog = await (await fetch('data/catalog.json')).json();
  buildSemesterOptions();
  buildSubjectOptions();
  el('langSelect').addEventListener('change', onLangChange);
  el('semesterSelect').addEventListener('change', () => { buildSubjectOptions(); onSubjectChange(); });
  el('subjectSelect').addEventListener('change', onSubjectChange);
  el('voteBtn').addEventListener('click', onVote);
  el('saveKeyBtn').addEventListener('click', saveApiKey);
  el('sendChatBtn').addEventListener('click', sendChat);
  el('chatInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(); });
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));

  const savedKey = localStorage.getItem('gemini_api_key');
  if (savedKey) el('apiKeyInput').value = savedKey;

  onSubjectChange();
}

function buildSemesterOptions() {
  const sel = el('semesterSelect');
  sel.innerHTML = '';
  catalog.semesters.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.number;
    opt.textContent = `Semester ${s.number}`;
    sel.appendChild(opt);
  });
  sel.value = 4; // default to Sem IV where launch content lives
}

function buildSubjectOptions() {
  const semNum = parseInt(el('semesterSelect').value);
  const sem = catalog.semesters.find(s => s.number === semNum);
  const sel = el('subjectSelect');
  sel.innerHTML = '';
  sem.subjects.forEach(sub => {
    const opt = document.createElement('option');
    opt.value = sub.id;
    opt.textContent = sub.status === 'available' ? sub.name : `${sub.name} (Coming soon)`;
    sel.appendChild(opt);
  });
}

async function onSubjectChange() {
  const semNum = parseInt(el('semesterSelect').value);
  const sem = catalog.semesters.find(s => s.number === semNum);
  const subjectId = el('subjectSelect').value;
  const subMeta = sem.subjects.find(s => s.id === subjectId);

  if (!subMeta || subMeta.status !== 'available') {
    el('comingSoon').classList.remove('hidden');
    el('subjectArea').classList.add('hidden');
    el('comingSoonSubject').textContent = subMeta ? subMeta.name : '';
    updateVoteCount(subjectId);
    return;
  }

  try {
    currentSubjectData = await (await fetch(`data/${subjectId}.json`)).json();
    el('comingSoon').classList.add('hidden');
    el('subjectArea').classList.remove('hidden');
    chatHistory = [];
    el('chatWindow').innerHTML = '';
    renderNotes();
    renderPyqs();
  } catch (e) {
    console.error('Failed to load subject data', e);
  }
}

function onLangChange() {
  currentLang = el('langSelect').value;
  if (currentSubjectData) {
    renderNotes();
    renderPyqs();
  }
}

function renderNotes() {
  const container = el('notesList');
  container.innerHTML = '';
  currentSubjectData.chapters.forEach(ch => {
    const block = document.createElement('div');
    block.className = 'chapter-block';
    block.innerHTML = `<div class="chapter-title">${ch.title[currentLang] || ch.title.en}</div>`;
    ch.notes.forEach(n => {
      const card = document.createElement('div');
      card.className = 'note-card';
      const reviewedTag = n.reviewed ? '' : '<span class="review-flag">unreviewed translation</span>';
      card.innerHTML = `<div class="note-topic">${n.topic[currentLang] || n.topic.en}${currentLang !== 'en' ? reviewedTag : ''}</div>
                         <div class="note-content">${n.content[currentLang] || n.content.en}</div>`;
      block.appendChild(card);
    });
    container.appendChild(block);
  });
}

function renderPyqs() {
  const container = el('pyqList');
  container.innerHTML = '';
  currentSubjectData.chapters.forEach(ch => {
    if (!ch.pyqs || !ch.pyqs.length) return;
    const block = document.createElement('div');
    block.className = 'chapter-block';
    block.innerHTML = `<div class="chapter-title">${ch.title[currentLang] || ch.title.en}</div>`;
    ch.pyqs.forEach(p => {
      const card = document.createElement('div');
      card.className = 'pyq-card';
      card.innerHTML = `<span class="pyq-year">${p.year}</span>${p.question[currentLang] || p.question.en}`;
      block.appendChild(card);
    });
    container.appendChild(block);
  });
}

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  el(`tab-${tab}`).classList.add('active');
}

// ---- Coming soon voting (stored locally per browser for demo purposes) ----
function updateVoteCount(subjectId) {
  const votes = JSON.parse(localStorage.getItem('subject_votes') || '{}');
  el('voteCount').textContent = votes[subjectId] ? `${votes[subjectId]} student(s) have asked for this` : '';
}

function onVote() {
  const subjectId = el('subjectSelect').value;
  const votes = JSON.parse(localStorage.getItem('subject_votes') || '{}');
  votes[subjectId] = (votes[subjectId] || 0) + 1;
  localStorage.setItem('subject_votes', JSON.stringify(votes));
  updateVoteCount(subjectId);
}

// ---- Chatbot (Gemini API, grounded in this subject's notes) ----
function saveApiKey() {
  const key = el('apiKeyInput').value.trim();
  if (key) {
    localStorage.setItem('gemini_api_key', key);
    alert('API key saved in this browser.');
  }
}

function buildContextFromSubject() {
  // Flatten this subject's notes into plain text so the model answers
  // grounded in the actual syllabus content instead of freely generating.
  let text = `Subject: ${currentSubjectData.subjectName}\n\n`;
  currentSubjectData.chapters.forEach(ch => {
    text += `${ch.title.en}\n`;
    ch.notes.forEach(n => {
      text += `- ${n.topic.en}: ${n.content.en}\n`;
    });
  });
  return text;
}

async function sendChat() {
  const input = el('chatInput');
  const question = input.value.trim();
  if (!question) return;
  const apiKey = localStorage.getItem('gemini_api_key');
  if (!apiKey) {
    alert('Add your Gemini API key above first.');
    return;
  }

  appendChatMessage('user', question);
  input.value = '';

  const langNames = { en: 'English', hi: 'Hindi', mr: 'Marathi' };
  const systemPrompt = `You are a doubt-solving assistant for MSBTE Diploma students, strictly limited to the subject "${currentSubjectData.subjectName}". Only answer questions about this subject's syllabus topics. If asked something unrelated, say you can only help with this subject. Answer in ${langNames[currentLang]}. Ground your answer in the following syllabus notes when relevant:\n\n${buildContextFromSubject()}`;

  appendChatMessage('bot', '...');
  const thinkingMsg = el('chatWindow').lastElementChild;

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemPrompt}\n\nStudent question: ${question}` }] }]
      })
    });
    const data = await res.json();
    const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not generate an answer. Check your API key and try again.';
    thinkingMsg.querySelector('.chat-bubble').textContent = answer;
  } catch (e) {
    thinkingMsg.querySelector('.chat-bubble').textContent = 'Error reaching Gemini API. Check your connection and API key.';
    console.error(e);
  }
}

function appendChatMessage(role, text) {
  const win = el('chatWindow');
  const msg = document.createElement('div');
  msg.className = `chat-msg ${role}`;
  msg.innerHTML = `<div class="chat-bubble"></div>`;
  msg.querySelector('.chat-bubble').textContent = text;
  win.appendChild(msg);
  win.scrollTop = win.scrollHeight;
}

init();
