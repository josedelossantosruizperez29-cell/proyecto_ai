let currentConversationId = null;
let isSending = false;

const state = {
    conversations: []
};

document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('messageInput');
    input.addEventListener('input', () => {
        document.getElementById('sendBtn').disabled = !input.value.trim() || isSending;
    });

    changeModel();
    loadConversations();
});

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
    const empty = state.conversations.length === 0
        ? '<div class="empty-history" id="emptyHistory">Aún no tienes conversaciones.</div>'
        : '';

    container.innerHTML = `<div class="chat-history-label">Historial</div>${empty}`;

    state.conversations.forEach(conversation => {
        const item = document.createElement('div');
        item.className = `chat-item ${conversation.id === currentConversationId ? 'active' : ''}`;
        item.dataset.id = conversation.id;
        item.onclick = () => selectChat(conversation.id);
        item.innerHTML = `
            <svg class="chat-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <span class="chat-item-text"></span>
            <button class="delete-chat" type="button" title="Eliminar chat">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
            </button>
        `;
        item.querySelector('.chat-item-text').textContent = conversation.title;
        item.querySelector('.delete-chat').onclick = event => {
            event.stopPropagation();
            deleteConversation(conversation.id);
        };
        container.appendChild(item);
    });
}

async function selectChat(conversationId) {
    currentConversationId = conversationId;
    renderConversations();
    hideWelcome();
    clearMessages();

    try {
        const response = await fetch(`/api/chat/conversations/${conversationId}/messages`, { credentials: 'same-origin' });
        if (!response.ok) throw new Error('No se pudo abrir la conversación.');
        const messages = await response.json();
        messages.forEach(addMessage);
        scrollToBottom();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function newChat() {
    currentConversationId = null;
    clearMessages();
    renderConversations();
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

    const wrapper = document.createElement('div');
    wrapper.className = `message ${message.role === 'user' ? 'user' : 'assistant'}`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = message.role === 'user' ? 'Tú' : 'E';

    const content = document.createElement('div');
    content.className = 'message-content';

    const role = document.createElement('div');
    role.className = 'message-role';
    role.textContent = message.role === 'user' ? 'Tú' : 'Emma';

    const text = document.createElement('div');
    text.className = 'message-text';

    if (message.role === 'assistant') {
        text.innerHTML = renderMarkdown(message.content);
    } else {
        text.textContent = message.content;
    }

    content.appendChild(role);
    content.appendChild(text);
    wrapper.appendChild(avatar);
    wrapper.appendChild(content);
    container.appendChild(wrapper);
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

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        const codeMatch = line.match(/%%CODEBLOCK_(\d+)%%/);
        if (codeMatch) {
            if (inList) { html += listType === 'ul' ? '</ul>' : '</ol>'; inList = false; }
            const block = codeBlocks[parseInt(codeMatch[1])];
            const highlighted = highlightSyntax(block.code, block.lang);
            const langLabel = block.lang && block.lang !== 'text' ? block.lang : '';
            html += `<div class="code-block-wrapper">` +
                `<div class="code-block-header"><span class="code-lang">${escapeHtml(langLabel)}</span>` +
                `<button class="copy-code-btn" onclick="copyCode(this)" title="Copiar código">` +
                `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>` +
                ` Copiar</button></div>` +
                `<pre class="code-block"><code>${highlighted}</code></pre></div>`;
            continue;
        }

        if (line.startsWith('### ')) {
            if (inList) { html += listType === 'ul' ? '</ul>' : '</ol>'; inList = false; }
            html += `<h4 class="md-h3">${inlineFormat(line.slice(4))}</h4>`;
            continue;
        }
        if (line.startsWith('## ')) {
            if (inList) { html += listType === 'ul' ? '</ul>' : '</ol>'; inList = false; }
            html += `<h3 class="md-h2">${inlineFormat(line.slice(3))}</h3>`;
            continue;
        }
        if (line.startsWith('# ')) {
            if (inList) { html += listType === 'ul' ? '</ul>' : '</ol>'; inList = false; }
            html += `<h2 class="md-h1">${inlineFormat(line.slice(2))}</h2>`;
            continue;
        }

        const ulMatch = line.match(/^(\s*)[*\-+]\s+(.+)/);
        if (ulMatch) {
            if (!inList || listType !== 'ul') {
                if (inList) html += listType === 'ul' ? '</ul>' : '</ol>';
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
                if (inList) html += listType === 'ul' ? '</ul>' : '</ol>';
                html += '<ol class="md-list">';
                inList = true;
                listType = 'ol';
            }
            html += `<li>${inlineFormat(olMatch[2])}</li>`;
            continue;
        }

        if (inList && line.trim() === '') {
            html += listType === 'ul' ? '</ul>' : '</ol>';
            inList = false;
            continue;
        }
        if (inList && !ulMatch && !olMatch) {
            html += listType === 'ul' ? '</ul>' : '</ol>';
            inList = false;
        }

        if (line.trim() === '') {
            html += '<br>';
            continue;
        }

        html += `<p>${inlineFormat(line)}</p>`;
    }

    if (inList) html += listType === 'ul' ? '</ul>' : '</ol>';

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
function highlightSyntax(code, lang) {
    code = escapeHtml(code);
    lang = (lang || '').toLowerCase();

    const keywords = {
        javascript: /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|this|class|extends|import|export|from|default|try|catch|finally|throw|async|await|yield|typeof|instanceof|in|of|null|undefined|true|false|void|delete|static|get|set|super|constructor)\b/g,
        python: /\b(def|class|if|elif|else|for|while|return|import|from|as|try|except|finally|raise|with|yield|lambda|pass|break|continue|and|or|not|is|in|None|True|False|self|print|global|nonlocal|assert|del|async|await)\b/g,
        csharp: /\b(using|namespace|class|public|private|protected|internal|static|void|int|string|bool|var|new|return|if|else|for|foreach|while|do|switch|case|break|continue|try|catch|finally|throw|async|await|Task|null|true|false|this|base|override|virtual|abstract|sealed|interface|enum|struct|readonly|const|out|ref|params|get|set|value|where|select|from|in|is|as|typeof)\b/g,
        java: /\b(public|private|protected|static|final|void|int|long|double|float|boolean|char|byte|short|String|class|interface|extends|implements|new|return|if|else|for|while|do|switch|case|break|continue|try|catch|finally|throw|throws|import|package|this|super|null|true|false|abstract|synchronized|volatile)\b/g,
        html: /\b(html|head|body|div|span|a|p|h[1-6]|ul|ol|li|table|tr|td|th|form|input|button|img|link|meta|script|style|title|class|id|src|href|type|name|value|placeholder)\b/g,
        css: /\b(color|background|margin|padding|border|font|display|flex|grid|position|width|height|top|left|right|bottom|z-index|overflow|opacity|transform|transition|animation|none|auto|inherit|initial|solid|block|inline|relative|absolute|fixed|sticky|center|space-between)\b/g,
        sql: /\b(SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|DROP|ALTER|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AND|OR|NOT|NULL|IS|IN|LIKE|ORDER|BY|GROUP|HAVING|LIMIT|OFFSET|AS|DISTINCT|COUNT|SUM|AVG|MAX|MIN|UNION|EXISTS|BETWEEN|CASE|WHEN|THEN|ELSE|END|INDEX|PRIMARY|KEY|FOREIGN|REFERENCES|CONSTRAINT|DEFAULT|CASCADE|TRUNCATE)\b/gi,
        typescript: /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|this|class|extends|import|export|from|default|try|catch|finally|throw|async|await|typeof|instanceof|in|of|null|undefined|true|false|void|interface|type|enum|namespace|module|declare|abstract|implements|readonly|private|public|protected|static|get|set|super|constructor|keyof|infer|never|unknown|any|string|number|boolean|symbol|bigint)\b/g,
        php: /\b(function|class|public|private|protected|static|return|if|else|elseif|for|foreach|while|do|switch|case|break|continue|try|catch|finally|throw|new|echo|print|var|null|true|false|array|string|int|float|bool|use|namespace|extends|implements|interface|abstract|final|const|global|isset|unset|empty|require|include|die|exit)\b/g,
        bash: /\b(echo|cd|ls|mkdir|rm|cp|mv|cat|grep|find|chmod|chown|sudo|apt|yum|npm|pip|git|docker|export|source|if|then|else|elif|fi|for|do|done|while|until|case|esac|function|return|exit|read|set|unset|test|true|false)\b/g,
    };

    code = code.replace(/(["'])(?:(?=(\\?))\2[\s\S])*?\1/g, '<span class="syn-string">$&</span>');

    code = code.replace(/(\/\/.*$)/gm, '<span class="syn-comment">$&</span>');
    code = code.replace(/(#.*$)/gm, function(match) {
        if (lang === 'python' || lang === 'bash' || lang === 'ruby' || lang === 'yaml') {
            return '<span class="syn-comment">' + match + '</span>';
        }
        return match;
    });

    const kwSet = keywords[lang] || keywords['javascript'];
    if (kwSet) {
        code = code.replace(kwSet, function(match) {
            return '<span class="syn-keyword">' + match + '</span>';
        });
    }

    code = code.replace(/\b(\d+\.?\d*)\b/g, '<span class="syn-number">$1</span>');

    return code;
}

function copyCode(btn) {
    const codeBlock = btn.closest('.code-block-wrapper').querySelector('code');
    const text = codeBlock.textContent;
    navigator.clipboard.writeText(text).then(() => {
        const original = btn.innerHTML;
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Copiado!';
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
    wrapper.innerHTML = `
        <div class="message-avatar">E</div>
        <div class="message-content">
            <div class="message-role">Emma</div>
            <div class="message-text">
                <div class="typing-indicator">
                    <span class="typing-dot"></span>
                    <span class="typing-dot"></span>
                    <span class="typing-dot"></span>
                </div>
            </div>
        </div>
    `;
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

function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
}

function changeModel() {
    const modelText = document.getElementById('modelSelector').selectedOptions[0]?.textContent || 'Modelo';
    const modeText = document.getElementById('thinkingModeSelector').selectedOptions[0]?.textContent || 'Rápido';
    document.getElementById('modelBadge').textContent = `${modelText} / ${modeText}`;
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

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('active');
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

        document.getElementById('sidebarName').textContent = `${data.nombre} ${data.apellido}`;
        document.getElementById('sidebarAvatar').textContent = data.initials;
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

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3200);
}

function scrollToBottom() {
    const area = document.getElementById('chatArea');
    area.scrollTop = area.scrollHeight;
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
