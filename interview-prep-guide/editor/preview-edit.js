(function () {
  function normalizeHtml(html) {
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

  function readValue(el) {
    const type = el.dataset.editType;
    if (type === 'html') return normalizeHtml(el.innerHTML);
    if (type === 'paragraphs') return el.innerText.replace(/\r\n/g, '\n').trim();
    return el.innerText.replace(/\s+/g, ' ').trim();
  }

  function sendUpdate(el) {
    window.parent.postMessage(
      {
        type: 'prep-edit',
        path: el.dataset.editPath,
        editType: el.dataset.editType,
        value: readValue(el),
      },
      '*'
    );
  }

  document.body.classList.add('prep-visual-mode');

  document.querySelectorAll('.prep-edit').forEach((el) => {
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && el.dataset.editType === 'text') {
        e.preventDefault();
        el.blur();
      }
    });
    el.addEventListener('blur', () => sendUpdate(el));
  });
})();
