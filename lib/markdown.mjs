export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

export function safeUrl(value) {
  const url = String(value).trim();
  if (!/^https?:\/\//i.test(url) || /[\s\u0000-\u001f\u007f]/u.test(url)) return null;
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password ? url : null;
  } catch {
    return null;
  }
}

export function externalLink(url, label, className = '') {
  const href = safeUrl(url);
  return href
    ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer"${className ? ` class="${escapeHtml(className)}"` : ''}>${label}</a>`
    : label;
}

// Inline markup is parsed before escaping; raw HTML is always treated as text.
export function inlineMarkdown(input) {
  let result = '';
  let index = 0;
  while (index < input.length) {
    const rest = input.slice(index);
    if (rest[0] === '\\' && rest.length > 1 && /[\\`*_[\]<>|]/.test(rest[1])) {
      result += escapeHtml(rest[1]);
      index += 2;
      continue;
    }
    if (rest[0] === '`') {
      const delimiter = rest.match(/^`+/)[0];
      const end = input.indexOf(delimiter, index + delimiter.length);
      if (end !== -1) {
        result += `<code>${escapeHtml(input.slice(index + delimiter.length, end))}</code>`;
        index = end + delimiter.length;
        continue;
      }
    }
    if (rest[0] === '[') {
      const labelEnd = input.indexOf('](', index + 1);
      if (labelEnd !== -1) {
        let end = labelEnd + 2;
        let depth = 1;
        while (end < input.length && depth) {
          if (input[end] === '(') depth++;
          if (input[end] === ')') depth--;
          if (depth) end++;
        }
        if (!depth) {
          const label = inlineMarkdown(input.slice(index + 1, labelEnd));
          result += externalLink(input.slice(labelEnd + 2, end), label);
          index = end + 1;
          continue;
        }
      }
    }
    if (rest[0] === '<') {
      const end = input.indexOf('>', index + 1);
      const url = end === -1 ? null : safeUrl(input.slice(index + 1, end));
      if (url) {
        result += externalLink(url, escapeHtml(url));
        index = end + 1;
        continue;
      }
    }
    const delimiter = rest.startsWith('**') ? '**' : rest[0] === '*' ? '*' : null;
    if (delimiter) {
      const end = input.indexOf(delimiter, index + delimiter.length);
      if (end > index + delimiter.length) {
        const tag = delimiter === '**' ? 'strong' : 'em';
        result += `<${tag}>${inlineMarkdown(input.slice(index + delimiter.length, end))}</${tag}>`;
        index = end + delimiter.length;
        continue;
      }
    }
    result += escapeHtml(input[index++]);
  }
  return result;
}

function tableCells(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(cell => cell.trim());
}

function isTableDivider(line = '') {
  const cells = tableCells(line);
  return cells.length > 1 && cells.every(cell => /^:?-{3,}:?$/.test(cell));
}

const listMarker = line => /^(\s*)([-+*]|\d+\.)\s+(.*)$/.exec(line);

export function markdownToHtml(markdown, { headingOffset = 0, copyLabel = '复制', codeLabel = '提示词示例', tableLabel = '写法对照表' } = {}) {
  function render(lines) {
    const output = [];
    let i = 0;
    const startsBlock = at => /^\s*$|^\s*```|^#{1,6}\s|^\s*>/.test(lines[at] ?? '') ||
      Boolean(listMarker(lines[at] ?? '')) || (lines[at]?.includes('|') && isTableDivider(lines[at + 1]));
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) { i++; continue; }
      const fence = /^\s*(`{3,})([^`]*)$/.exec(line);
      if (fence) {
        const code = [];
        i++;
        while (i < lines.length && !new RegExp(`^\\s*\x60{${fence[1].length},}\\s*$`).test(lines[i])) code.push(lines[i++]);
        if (i < lines.length) i++;
        const language = fence[2].trim();
        output.push(`<div class="code-frame"><div class="code-toolbar"><span>${escapeHtml(language || codeLabel)}</span><button type="button" class="copy-button" data-copy-code>${escapeHtml(copyLabel)}</button></div><pre><code>${escapeHtml(code.join('\n'))}</code></pre></div>`);
        continue;
      }
      const heading = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
      if (heading) {
        const level = Math.min(6, heading[1].length + headingOffset);
        output.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
        i++;
        continue;
      }
      if (/^\s*>/.test(line)) {
        const quote = [];
        while (i < lines.length && /^\s*>/.test(lines[i])) quote.push(lines[i++].replace(/^\s*> ?/, ''));
        output.push(`<blockquote>${render(quote)}</blockquote>`);
        continue;
      }
      if (line.includes('|') && isTableDivider(lines[i + 1])) {
        const headers = tableCells(line);
        const rows = [];
        i += 2;
        while (i < lines.length && lines[i].trim() && lines[i].includes('|')) {
          const cells = tableCells(lines[i++]);
          rows.push(`<tr>${headers.map((_, column) => `<td>${inlineMarkdown(cells[column] ?? '')}</td>`).join('')}</tr>`);
        }
        output.push(`<div class="table-scroll" role="region" aria-label="${escapeHtml(tableLabel)}" tabindex="0"><table><thead><tr>${headers.map(cell => `<th scope="col">${inlineMarkdown(cell)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`);
        continue;
      }
      const marker = listMarker(line);
      if (marker) {
        const indent = marker[1].length;
        const ordered = /^\d/.test(marker[2]);
        const tag = ordered ? 'ol' : 'ul';
        const items = [];
        while (i < lines.length) {
          const current = listMarker(lines[i]);
          if (!current || current[1].length !== indent || /^\d/.test(current[2]) !== ordered) break;
          const body = [current[3]];
          i++;
          while (i < lines.length) {
            if (!lines[i].trim()) {
              let next = i + 1;
              while (next < lines.length && !lines[next].trim()) next++;
              if (next === lines.length || lines[next].search(/\S/) <= indent) break;
              body.push(''); i++; continue;
            }
            if (lines[i].search(/\S/) <= indent) break;
            body.push(lines[i++].slice(indent + 2));
          }
          items.push(`<li>${render(body)}</li>`);
        }
        const start = ordered && marker[2] !== '1.' ? ` start="${Number.parseInt(marker[2], 10)}"` : '';
        output.push(`<${tag}${start}>${items.join('')}</${tag}>`);
        continue;
      }
      const paragraph = [line];
      i++;
      while (i < lines.length && !startsBlock(i)) paragraph.push(lines[i++]);
      output.push(`<p>${inlineMarkdown(paragraph.join('\n'))}</p>`);
    }
    return output.join('\n');
  }
  return render(markdown.replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n'));
}
