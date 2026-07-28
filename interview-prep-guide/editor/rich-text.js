function normalizeRichHtml(html) {
  return String(html || '')
    .replace(/<b>/gi, '<strong>')
    .replace(/<\/b>/gi, '</strong>')
    .replace(/<i>/gi, '<em>')
    .replace(/<\/i>/gi, '</em>')
    .replace(/<div>/gi, '<p>')
    .replace(/<\/div>/gi, '</p>')
    .replace(/<p><\/p>/g, '')
    .trim();
}

function richField(label, path, html = '', hint = '') {
  const id = `rich-${path.replace(/[^a-z0-9-]/gi, '-')}`;
  return `<div class="field rich-field" data-rich-path="${path}">
    <label for="${id}">${label}</label>
    <div class="rich-toolbar">
      <button type="button" class="rich-btn" data-cmd="bold" title="Bold (⌘B)"><b>B</b></button>
      <button type="button" class="rich-btn" data-cmd="italic" title="Italic (⌘I)"><i>I</i></button>
      <button type="button" class="rich-btn" data-cmd="insertUnorderedList" title="Bullet list">• List</button>
      <button type="button" class="rich-btn" data-cmd="createLink" title="Insert link">Link</button>
    </div>
    <div class="rich-editor" contenteditable="true" id="${id}">${html}</div>
    ${hint ? `<p class="field-hint">${hint}</p>` : ''}
  </div>`;
}

function bindRichEditors(container, onChange) {
  container.querySelectorAll('.rich-field').forEach((field) => {
    const editor = field.querySelector('.rich-editor');

    field.querySelectorAll('.rich-btn').forEach((btn) => {
      btn.addEventListener('mousedown', (e) => e.preventDefault());
      btn.addEventListener('click', () => {
        editor.focus();
        const cmd = btn.dataset.cmd;
        if (cmd === 'createLink') {
          const url = prompt('Link URL (include https://):');
          if (url) document.execCommand('createLink', false, url);
        } else {
          document.execCommand(cmd, false, null);
        }
        onChange?.();
      });
    });

    editor.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        document.execCommand('bold');
        onChange?.();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
        e.preventDefault();
        document.execCommand('italic');
        onChange?.();
      }
    });

    editor.addEventListener('input', () => onChange?.());
    editor.addEventListener('blur', () => onChange?.());
  });
}

function readRichEditors(container, content, setByPathFn) {
  container.querySelectorAll('.rich-field').forEach((field) => {
    const editor = field.querySelector('.rich-editor');
    setByPathFn(content, field.dataset.richPath, normalizeRichHtml(editor.innerHTML));
  });
}
