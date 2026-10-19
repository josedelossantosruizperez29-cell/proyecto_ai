let currentConversationId = null;
let isSending = false;

const state = {
    conversations: []
};

const EMPTY_HISTORY_HTML = `
    <div class="empty-history" id="emptyHistory">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        <p>Aún no tienes conversaciones</p>
        <span>Tus chats aparecerán aquí, listos para continuar.</span>
    </div>
`;

document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('messageInput');
    input.addEventListener('input', () => {
        document.getElementById('sendBtn').disabled = !input.value.trim() || isSending;
    });

    changeModel();
    loadConversations();

    document.addEventListener('keydown', handleGlobalKeyDown);
});

function handleGlobalKeyDown(event) {
    if (event.key !== 'Escape') return;

    const imageModal = document.getElementById('imagePromptArea');
    if (imageModal && imageModal.style.display !== 'none') {
        hideImagePrompt();
        return;
    }

    const settings = document.getElementById('settingsOverlay');
    if (settings.classList.contains('active')) {
        closeSettings();
        return;
    }

    const sidebar = document.getElementById('sidebar');
    if (sidebar.classList.contains('open')) {
        toggleSidebar();
    }
}

async function loadConversations() {
    try {
        const response = await fetch('/api/chat/conversations', { credentials: 'same-origin' });
        if (!response.ok) throw new Error('No se pudo cargar el historial.');
        state.conversations = await response.json();
        renderConversations();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function renderConversations() {
    const container = document.getElementById('chatHistory');
    container.innerHTML = '';

    if (!state.conversations.length) {
        container.insertAdjacentHTML('beforeend', '<div class="history-label">Recientes</div>');
        container.insertAdjacentHTML('beforeend', EMPTY_HISTORY_HTML);
        return;
    }

    groupConversations(state.conversations).forEach(group => {
        const section = document.createElement('div');
        section.className = 'history-group';

        const label = document.createElement('div');
        label.className = 'history-label';
        label.textContent = group.label;
        section.appendChild(label);

        group.items.forEach(conversation => {
            section.appendChild(buildConversationItem(conversation));
        });

        container.appendChild(section);
    });
}

function groupConversations(conversations) {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - 7);

    const groups = [];
    const bucket = label => {
        let group = groups.find(item => item.label === label);
        if (!group) {
            group = { label, items: [] };
            groups.push(group);
        }
        return group;
    };

    conversations.forEach(conversation => {
        const date = parseDate(conversation.updatedAt);
        let label = 'Anteriores';

        if (date) {
            if (date >= startOfToday) label = 'Hoy';
            else if (date >= startOfYesterday) label = 'Ayer';
            else if (date >= startOfWeek) label = 'Últimos 7 días';
        }

        bucket(label).items.push(conversation);
    });

    return groups;
}

function parseDate(value) {
    if (!value) return null;
    const raw = String(value);
    const hasZone = /(z|[+-]\d{2}:?\d{2})$/i.test(raw);
    const date = new Date(hasZone ? raw : `${raw}Z`);
    return isNaN(date.getTime()) ? null : date;
}

function buildConversationItem(conversation) {
    const item = document.createElement('div');
    item.className = `chat-item ${conversation.id === currentConversationId ? 'active' : ''}`;
    item.dataset.id = conversation.id;
    item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '0');
    item.setAttribute('title', conversation.title || 'Conversación');

    const text = document.createElement('span');
    text.className = 'chat-item-text';
    text.textContent = conversation.title;

    const remove = document.createElement('button');
    remove.className = 'delete-chat';
    remove.type = 'button';
    remove.title = 'Eliminar chat';
    remove.setAttribute('aria-label', `Eliminar conversación ${conversation.title}`);
    remove.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
    `;

    item.appendChild(text);
    item.appendChild(remove);

    item.addEventListener('click', () => selectChat(conversation.id));
    item.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            selectChat(conversation.id);
        }
    });
    remove.addEventListener('click', event => {
        event.stopPropagation();
        deleteConversation(conversation.id);
    });

    return item;
}

async function selectChat(conversationId) {
    currentConversationId = conversationId;
    renderConversations();
    closeSidebarOnMobile();
    hideWelcome();
    clearMessages();

    try {
        const response = await fetch(`/api/chat/conversations/${conversationId}/messages`, { credentials: 'same-origin' });
        if (!response.ok) throw new Error('No se pudo abrir la conversación.');
        const messages = await response.json();
        messages.forEach(addMessage);
        scrollToBottom('auto');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function newChat() {
    currentConversationId = null;
    clearMessages();
    renderConversations();
    closeSidebarOnMobile();
    document.getElementById('welcomeScreen').style.display = 'flex';
    document.getElementById('messagesContainer').style.display = 'none';
    document.getElementById('messageInput').focus();
}

async function deleteConversation(conversationId) {
    try {
        const response = await fetch(`/api/chat/conversations/${conversationId}`, {
            method: 'DELETE',
            credentials: 'same-origin'
        });

        if (!response.ok && response.status !== 204) throw new Error('No se pudo eliminar el chat.');

        state.conversations = state.conversations.filter(conversation => conversation.id !== conversationId);
        if (currentConversationId === conversationId) {
            newChat();
        } else {
            renderConversations();
        }
        showToast('Chat eliminado.', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function sendMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();
    if (!message || isSending) return;

    isSending = true;
    document.getElementById('sendBtn').disabled = true;
    hideWelcome();
    addMessage({ role: 'user', content: message, modelId: getSelectedModel(), createdAt: new Date().toISOString() });
    input.value = '';
    autoResize(input);
    const typingId = addTyping();
    scrollToBottom();

    try {
        const response = await fetch('/api/chat/send', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                conversationId: currentConversationId,
                message,
                modelId: getSelectedModel(),
                thinkingMode: getThinkingMode()
            })
        });

        const data = await safeJson(response);
        if (!response.ok) {
            throw new Error(data?.error || 'La IA no pudo responder.');
        }

        currentConversationId = data.conversationId;
        removeTyping(typingId);
        addMessage(data.assistantMessage);
        upsertConversation({
            id: data.conversationId,
            title: data.title,
            modelId: getSelectedModel(),
            thinkingMode: getThinkingMode(),
            updatedAt: new Date().toISOString()
        });
        renderConversations();
    } catch (error) {
        removeTyping(typingId);
        addMessage({
            role: 'assistant',
            content: error.message,
            modelId: getSelectedModel(),
            createdAt: new Date().toISOString()
        });
        showToast(error.message, 'error');
    } finally {
        isSending = false;
        document.getElementById('sendBtn').disabled = !document.getElementById('messageInput').value.trim();
        scrollToBottom();
    }
}

function upsertConversation(conversation) {
    state.conversations = state.conversations.filter(item => item.id !== conversation.id);
    state.conversations.unshift(conversation);
}

function addMessage(message) {
    const container = document.getElementById('messagesContainer');
    container.style.display = 'block';

    const isUser = message.role === 'user';
    const wrapper = document.createElement('div');
    wrapper.className = `message ${isUser ? 'user' : 'assistant'}`;

    if (!isUser) {
        wrapper.appendChild(buildAssistantMark());
    }

    const content = document.createElement('div');
    content.className = 'message-content';

    const text = document.createElement('div');
    text.className = 'message-text';

    if (isUser) {
        text.textContent = message.content;
    } else {
        text.innerHTML = renderMarkdown(message.content);
    }

    content.appendChild(text);
    wrapper.appendChild(content);
    container.appendChild(wrapper);
}

function buildAssistantMark() {
    const mark = document.createElement('div');
    mark.className = 'assistant-mark';
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = 'E';
    return mark;
}

/* ===== MARKDOWN RENDERER ===== */
function renderMarkdown(text) {
    if (!text) return '';

    const codeBlocks = [];
    text = text.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
        const idx = codeBlocks.length;
        codeBlocks.push({ lang: lang || 'text', code: code.replace(/\n$/, '') });
        return `%%CODEBLOCK_${idx}%%`;
    });

    const lines = text.split('\n');
    let html = '';
    let inList = false;
    let listType = '';

    const closeList = () => {
        if (inList) {
            html += listType === 'ul' ? '</ul>' : '</ol>';
            inList = false;
        }
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        const codeMatch = line.match(/%%CODEBLOCK_(\d+)%%/);
        if (codeMatch) {
            closeList();
            const block = codeBlocks[parseInt(codeMatch[1])];
            const highlighted = highlightSyntax(block.code, block.lang);
            const langLabel = block.lang && block.lang !== 'text' ? block.lang : 'código';
            html += `<div class="code-block-wrapper">` +
                `<div class="code-block-header"><span class="code-lang">${escapeHtml(langLabel)}</span>` +
                `<button class="copy-code-btn" onclick="copyCode(this)" title="Copiar código">` +
                `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>` +
                ` Copiar</button></div>` +
                `<pre class="code-block"><code>${highlighted}</code></pre></div>`;
            continue;
        }

        if (line.startsWith('### ')) {
            closeList();
            html += `<h4 class="md-h3">${inlineFormat(line.slice(4))}</h4>`;
            continue;
        }
        if (line.startsWith('## ')) {
            closeList();
            html += `<h3 class="md-h2">${inlineFormat(line.slice(3))}</h3>`;
            continue;
        }
        if (line.startsWith('# ')) {
            closeList();
            html += `<h2 class="md-h1">${inlineFormat(line.slice(2))}</h2>`;
            continue;
        }

        const ulMatch = line.match(/^(\s*)[*\-+]\s+(.+)/);
        if (ulMatch) {
            if (!inList || listType !== 'ul') {
                closeList();
                html += '<ul class="md-list">';
                inList = true;
                listType = 'ul';
            }
            html += `<li>${inlineFormat(ulMatch[2])}</li>`;
            continue;
        }

        const olMatch = line.match(/^(\s*)\d+\.\s+(.+)/);
        if (olMatch) {
            if (!inList || listType !== 'ol') {
                closeList();
                html += '<ol class="md-list">';
                inList = true;
                listType = 'ol';
            }
            html += `<li>${inlineFormat(olMatch[2])}</li>`;
            continue;
        }

        if (inList && line.trim() === '') {
            closeList();
            continue;
        }
        if (inList) {
            closeList();
        }

        if (line.trim() === '') {
            continue;
        }

        html += `<p>${inlineFormat(line)}</p>`;
    }

    closeList();

    return html;
}

function inlineFormat(text) {
    text = escapeHtml(text);
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');
    text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
    text = text.replace(/_(.+?)_/g, '<em>$1</em>');
    text = text.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
    return text;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/* ===== SYNTAX HIGHLIGHTING ===== */
/* Single-pass tokenizer: markup is never re-scanned, so the output stays valid. */
const SYNTAX_KEYWORDS = {
    javascript: 'const let var function return if else for while do switch case break continue new this class extends import export from default try catch finally throw async await yield typeof instanceof in of null undefined true false void delete static get set super constructor'.split(' '),
    typescript: 'const let var function return if else for while do switch case break continue new this class extends import export from default try catch finally throw async await typeof instanceof in of null undefined true false void interface type enum namespace module declare abstract implements readonly private public protected static get set super constructor keyof infer never unknown any string number boolean'.split(' '),
    python: 'def class if elif else for while return import from as try except finally raise with yield lambda pass break continue and or not is in None True False self print global nonlocal assert del async await'.split(' '),
    csharp: 'using namespace class public private protected internal static void int string bool var new return if else for foreach while do switch case break continue try catch finally throw async await Task null true false this base override virtual abstract sealed interface enum struct readonly const out ref params get set value where select from in is as typeof'.split(' '),
    java: 'public private protected static final void int long double float boolean char byte short String class interface extends implements new return if else for while do switch case break continue try catch finally throw throws import package this super null true false abstract synchronized volatile'.split(' '),
    html: 'html head body div span a p ul ol li table tr td th form input button img link meta script style title class id src href type name value placeholder'.split(' '),
    css: 'color background margin padding border font display flex grid position width height top left right bottom overflow opacity transform transition animation none auto inherit initial solid block inline relative absolute fixed sticky center'.split(' '),
    sql: 'select from where insert into values update set delete create table drop alter join left right inner outer on and or not null is in like order by group having limit offset as distinct count sum avg max min union exists between case when then else end index primary key foreign references constraint default cascade truncate'.split(' '),
    php: 'function class public private protected static return if else elseif for foreach while do switch case break continue try catch finally throw new echo print var null true false array string int float bool use namespace extends implements interface abstract final const global isset unset empty require include die exit'.split(' '),
    bash: 'echo cd ls mkdir rm cp mv cat grep find chmod chown sudo apt npm pip git docker export source if then else elif fi for do done while until case esac function return exit read set unset test true false'.split(' '),
};

const CASE_INSENSITIVE_LANGS = ['sql', 'html', 'css', 'php', 'bash'];
const HASH_COMMENT_LANGS = ['python', 'bash', 'ruby', 'yaml', 'sql', 'sh'];

function highlightSyntax(code, lang) {
    lang = (lang || '').toLowerCase();

    const words = SYNTAX_KEYWORDS[lang] || SYNTAX_KEYWORDS.javascript;
    const caseInsensitive = CASE_INSENSITIVE_LANGS.includes(lang);
    const lookup = new Set(words);
    const hashComments = HASH_COMMENT_LANGS.includes(lang);

    const tokenPattern = /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|\/\/[^\n]*|#[^\n]*|\b\d+(?:\.\d+)?\b|[A-Za-z_$][A-Za-z0-9_$]*/g;

    let html = '';
    let lastIndex = 0;
    let match;

    while ((match = tokenPattern.exec(code)) !== null) {
        html += escapeHtml(code.slice(lastIndex, match.index));
        lastIndex = tokenPattern.lastIndex;

        const token = match[0];
        let className = '';

        if (match[1]) {
            className = 'syn-string';
        } else if (token.startsWith('//')) {
            className = 'syn-comment';
        } else if (token.startsWith('#')) {
            className = hashComments ? 'syn-comment' : '';
        } else if (/^\d/.test(token)) {
            className = 'syn-number';
        } else {
            const candidate = caseInsensitive ? token.toLowerCase() : token;
            if (lookup.has(candidate)) className = 'syn-keyword';
        }

        html += className
            ? `<span class="${className}">${escapeHtml(token)}</span>`
            : escapeHtml(token);
    }

    html += escapeHtml(code.slice(lastIndex));
    return html;
}

function copyCode(btn) {
    const codeBlock = btn.closest('.code-block-wrapper').querySelector('code');
    const text = codeBlock.textContent;
    navigator.clipboard.writeText(text).then(() => {
        const original = btn.innerHTML;
        btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Copiado';
        btn.classList.add('copied');
        setTimeout(() => {
            btn.innerHTML = original;
            btn.classList.remove('copied');
        }, 2000);
    });
}

function addTyping() {
    const id = `typing-${Date.now()}`;
    const container = document.getElementById('messagesContainer');
    const wrapper = document.createElement('div');
    wrapper.className = 'message assistant';
    wrapper.id = id;

    const mark = buildAssistantMark();
    const content = document.createElement('div');
    content.className = 'message-content';
    const text = document.createElement('div');
    text.className = 'message-text';
    text.innerHTML = '<div class="typing-indicator"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div>';

    content.appendChild(text);
    wrapper.appendChild(mark);
    wrapper.appendChild(content);
    container.appendChild(wrapper);

    return id;
}

function removeTyping(id) {
    document.getElementById(id)?.remove();
}

function clearMessages() {
    document.getElementById('messagesContainer').innerHTML = '';
}

function hideWelcome() {
    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('messagesContainer').style.display = 'block';
}

function useSuggestion(text) {
    const input = document.getElementById('messageInput');
    input.value = text;
    autoResize(input);
    document.getElementById('sendBtn').disabled = false;
    input.focus();
}

/* ===== IMAGE GENERATION ===== */
function showImagePrompt() {
    const area = document.getElementById('imagePromptArea');
    area.style.display = 'flex';
    document.getElementById('imagePromptText').focus();
}

function hideImagePrompt() {
    const area = document.getElementById('imagePromptArea');
    area.style.display = 'none';
    document.getElementById('imagePromptText').value = '';
    document.getElementById('imagePromptCard').classList.remove('is-loading');
}

async function generateImage() {
    const prompt = document.getElementById('imagePromptText').value.trim();
    if (!prompt) {
        showToast('Escribe un prompt para generar la imagen.', 'error');
        return;
    }

    const card = document.getElementById('imagePromptCard');
    card.classList.add('is-loading');

    isSending = true;
    document.getElementById('sendBtn').disabled = true;

    try {
        const response = await fetch('/api/chat/image', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });

        const data = await safeJson(response);
        if (!response.ok) {
            throw new Error(data?.error || 'No se pudo generar la imagen.');
        }

        const imageUrl = data.imageUrl || data.url;
        hideImagePrompt();
        hideWelcome();
        appendImageMessage(imageUrl);
        scrollToBottom();
    } catch (error) {
        hideImagePrompt();
        showToast(error.message, 'error');
    } finally {
        card.classList.remove('is-loading');
        isSending = false;
        document.getElementById('sendBtn').disabled = !document.getElementById('messageInput').value.trim();
    }
}

function appendImageMessage(imageUrl) {
    const container = document.getElementById('messagesContainer');
    container.style.display = 'block';

    const wrapper = document.createElement('div');
    wrapper.className = 'message assistant';

    const content = document.createElement('div');
    content.className = 'message-content';

    const text = document.createElement('div');
    text.className = 'message-text';

    const image = document.createElement('img');
    image.className = 'generated-image';
    image.src = imageUrl;
    image.alt = 'Imagen generada por Emma AI';
    image.loading = 'lazy';

    text.appendChild(image);
    content.appendChild(text);
    wrapper.appendChild(buildAssistantMark());
    wrapper.appendChild(content);
    container.appendChild(wrapper);
}

/* ===== INPUT ===== */
function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
}

function changeModel() {
    const modelText = document.getElementById('modelSelector').selectedOptions[0]?.textContent || 'Modelo';
    const modeText = document.getElementById('thinkingModeSelector').selectedOptions[0]?.textContent || 'Rápido';
    document.getElementById('modelBadge').textContent = `${modelText} · ${modeText}`;
}

function changeThinkingMode() {
    changeModel();
}

function getSelectedModel() {
    return document.getElementById('modelSelector').value;
}

function getThinkingMode() {
    return document.getElementById('thinkingModeSelector').value;
}

/* ===== LAYOUT ===== */
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('active');
}

function closeSidebarOnMobile() {
    if (window.matchMedia('(max-width: 900px)').matches) {
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('sidebarOverlay').classList.remove('active');
    }
}

function openSettings() {
    document.getElementById('settingsOverlay').classList.add('active');
}

function closeSettings() {
    document.getElementById('settingsOverlay').classList.remove('active');
}

function closeSettingsOnOverlay(event) {
    if (event.target.id === 'settingsOverlay') {
        closeSettings();
    }
}

/* ===== ACCOUNT ===== */
async function saveProfile() {
    const nombre = document.getElementById('settingsFirstName').value.trim();
    const apellido = document.getElementById('settingsLastName').value.trim();
    if (nombre.length < 2 || apellido.length < 2) {
        showToast('Nombre y apellido deben tener al menos 2 caracteres.', 'error');
        return;
    }

    try {
        const response = await fetch('/Account/UpdateProfile', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, apellido })
        });
        const data = await safeJson(response);
        if (!response.ok) throw new Error(data?.error || 'No se pudo guardar el perfil.');

        const fullName = `${data.nombre} ${data.apellido}`;
        document.getElementById('sidebarName').textContent = fullName;
        document.getElementById('sidebarAvatar').textContent = data.initials;
        document.getElementById('settingsName').textContent = fullName;
        document.getElementById('settingsAvatar').textContent = data.initials;
        showToast('Perfil actualizado.', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function changePassword() {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (newPassword.length < 8 || newPassword !== confirmPassword) {
        showToast('La nueva contraseña debe tener mínimo 8 caracteres y coincidir.', 'error');
        return;
    }

    try {
        const response = await fetch('/Account/ChangePassword', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
        });
        const data = await safeJson(response);
        if (!response.ok) throw new Error(data?.error || 'No se pudo cambiar la contraseña.');

        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';
        showToast(data?.message || 'Contraseña actualizada.', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

/* ===== FEEDBACK ===== */
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3200);
}

function scrollToBottom(behavior = 'smooth') {
    const area = document.getElementById('chatArea');
    area.scrollTo({ top: area.scrollHeight, behavior });
}

async function safeJson(response) {
    const text = await response.text();
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}
