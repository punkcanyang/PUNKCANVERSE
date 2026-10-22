import { escapeHtml as e, externalLink } from './markdown.mjs';
import { renderPostMedia } from './cards.mjs';
import { REGION_BANNED_TERMS, REGION_BANNED_TERMS_EN, REGION_BANNED_TERMS_JA, validateRegionText } from './regions.mjs';

const STATUS_URL = /^https:\/\/x\.com\/([A-Za-z0-9_]+)\/status\/(\d+)$/;

function stringsOf(value, found = []) {
  if (typeof value === 'string') found.push(value);
  else if (Array.isArray(value)) value.forEach(item => stringsOf(item, found));
  else if (value && typeof value === 'object') Object.values(value).forEach(item => stringsOf(item, found));
  return found;
}

export function validateWorkflows(workflows, { bannedText = validateRegionText } = {}) {
  if (!Array.isArray(workflows)) throw new Error('Workflows must be an array');
  const ids = new Set();
  for (const workflow of workflows) {
    if (!workflow || typeof workflow !== 'object') throw new Error('Invalid workflow');
    if (typeof workflow.id !== 'string' || !/^\d+$/.test(workflow.id)) throw new Error(`Invalid workflow id: ${workflow.id}`);
    if (ids.has(workflow.id)) throw new Error(`Duplicate workflow id: ${workflow.id}`);
    ids.add(workflow.id);
    const handle = workflow.author?.handle;
    if (!workflow.author || typeof workflow.author.name !== 'string' || !workflow.author.name.trim() || typeof handle !== 'string' || !/^[A-Za-z0-9_]+$/.test(handle)) throw new Error(`${workflow.id}: invalid author`);
    if (workflow.author.url !== `https://x.com/${handle}`) throw new Error(`${workflow.id}: author url must match handle`);
    const post = STATUS_URL.exec(workflow.postUrl || '');
    if (!post || post[1] !== handle || post[2] !== workflow.id) throw new Error(`${workflow.id}: postUrl must be https://x.com/${handle}/status/${workflow.id}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(workflow.date || '')) throw new Error(`${workflow.id}: invalid date`);
    if (!Array.isArray(workflow.steps) || workflow.steps.length < 2) throw new Error(`${workflow.id}: at least two steps`);
    workflow.steps.forEach((step, index) => {
      if (!step || step.n !== index + 1) throw new Error(`${workflow.id}: step numbers must start at 1 and run in order`);
      if (typeof step.tool !== 'string' || !step.tool.trim()) throw new Error(`${workflow.id}: step ${step.n} needs a tool`);
      const prompt = typeof step.prompt === 'string' && step.prompt.trim() ? step.prompt : '';
      const settings = typeof step.settings === 'string' && step.settings.trim() ? step.settings : '';
      if (!prompt && !settings) throw new Error(`${workflow.id}: step ${step.n} needs a prompt or settings`);
      if (step.prompt != null && typeof step.prompt !== 'string') throw new Error(`${workflow.id}: step ${step.n} prompt must be a string or null`);
      if (step.settings != null && typeof step.settings !== 'string') throw new Error(`${workflow.id}: step ${step.n} settings must be a string or null`);
      if (step.sourcePost != null) {
        const source = STATUS_URL.exec(step.sourcePost);
        if (!source || source[1] !== handle) throw new Error(`${workflow.id}: sourcePost must be a status URL by @${handle}`);
      }
    });
    if (!Array.isArray(workflow.tools) || workflow.tools.length !== workflow.steps.length || workflow.tools.some((tool, index) => tool !== workflow.steps[index].tool)) {
      throw new Error(`${workflow.id}: tools must follow the step order`);
    }
    if (!Array.isArray(workflow.tags) || !workflow.tags.length || workflow.tags.some(tag => typeof tag !== 'string' || !tag.trim())) throw new Error(`${workflow.id}: tags required`);
    bannedText(stringsOf(workflow).join('\n'));
  }
  return true;
}

export const WORKFLOW_BANNED_TERMS = Object.freeze([...REGION_BANNED_TERMS, ...REGION_BANNED_TERMS_EN, ...REGION_BANNED_TERMS_JA]);

export function relatedWorkflows(workflow, workflows) {
  const scored = workflows.filter(other => other.id !== workflow.id).map(other => ({
    other,
    score: other.tags.filter(tag => workflow.tags.includes(tag)).length,
  }));
  scored.sort((a, b) => b.score - a.score || a.other.id.localeCompare(b.other.id));
  return scored.slice(0, 3).map(item => item.other);
}

export function renderWorkflowCard(workflow, index, localized, thumb, ui) {
  const entry = {
    id: workflow.id,
    title: localized.title,
    medium: 'video',
    postUrl: workflow.postUrl,
    author: workflow.author.name,
    authorHandle: workflow.author.handle,
    authorUrl: workflow.author.url,
  };
  const chain = workflow.tools.map(tool => e(tool)).join(' → ');
  return `<article class="prompt-card workflow-card" data-entry-id="${e(workflow.id)}"><div class="card-overline"><span class="card-number">${String(index + 1).padStart(2, '0')}</span><small>VIDEO</small></div>${renderPostMedia(entry, thumb, ui)}<div class="record-info"><p class="model-labels tool-chain">${chain}</p><h2><a href="${e(ui.workflowHref(workflow.id))}">${e(localized.title)}</a></h2><div class="card-source"><span>${externalLink(workflow.author.url, e(workflow.author.name))}<small>@${e(workflow.author.handle)}</small></span>${externalLink(workflow.postUrl, ui.postLink)}</div><a class="entry-read" href="${e(ui.workflowHref(workflow.id))}">${e(ui.readWorkflow)}</a></div><div class="record-note"><span class="note-label">${e(ui.fieldNotes)}</span><p class="card-description">${e(localized.fieldNote)}</p></div></article>`;
}

function stepBody(step, localizedRole, ui) {
  const role = localizedRole || step.role;
  const prompt = typeof step.prompt === 'string' && step.prompt.trim() ? step.prompt : '';
  const settings = typeof step.settings === 'string' && step.settings.trim() ? step.settings : '';
  const promptBlock = prompt
    ? `<div class="prompt-box" data-copy-scope><div class="prompt-toolbar"><span>${e(ui.originalPrompt)}</span><button class="copy-button" type="button" data-copy-block>${e(ui.copy)}</button></div><pre class="prompt-text" tabindex="0">${e(prompt)}</pre></div>`
    : `<p class="prompt-missing">${e(ui.promptMissing)}</p>`;
  const settingsBlock = settings
    ? `<div class="prompt-box" data-copy-scope><div class="prompt-toolbar"><span>${e(ui.settingsLabel)}</span><button class="copy-button" type="button" data-copy-block>${e(ui.copy)}</button></div><pre class="prompt-text step-settings" tabindex="0">${e(settings)}</pre></div>`
    : '';
  const source = step.sourcePost ? `<p class="step-source">${externalLink(step.sourcePost, ui.stepSource)}</p>` : '';
  return `<li class="workflow-step"><header><span>${String(step.n).padStart(2, '0')}</span><strong>${e(step.tool)}</strong></header><p>${e(role)}</p>${prompt ? promptBlock : `${promptBlock}${settingsBlock}`}${prompt && settings ? settingsBlock : ''}${source}</li>`;
}

export function renderWorkflowDetail(workflow, workflows, localized, thumb, ui, localize) {
  const entry = {
    id: workflow.id,
    title: localized.title,
    medium: 'video',
    postUrl: workflow.postUrl,
    author: workflow.author.name,
    authorHandle: workflow.author.handle,
    authorUrl: workflow.author.url,
  };
  const steps = workflow.steps.map(step => stepBody(step, localized.steps?.[step.n] || localized.steps?.[String(step.n)], ui)).join('');
  const related = relatedWorkflows(workflow, workflows).map(other => {
    const copy = localize(other);
    return `<a href="${e(ui.workflowHref(other.id))}"><span>${e(other.tools.join(' → '))}</span><strong>${e(copy.title)}</strong><span aria-hidden="true">↗</span></a>`;
  }).join('');
  return `<article class="prompt-detail workflow-detail" data-entry-id="${e(workflow.id)}"><header class="detail-header"><a href="${e(ui.workflowIndex)}">${e(ui.workflowCrumb)}</a><p class="eyebrow tool-chain">${workflow.tools.map(tool => e(tool)).join(' → ')}</p><h1>${e(localized.title)}</h1><div class="card-source"><span>${externalLink(workflow.author.url, e(workflow.author.name))}<small>@${e(workflow.author.handle)}</small></span>${externalLink(workflow.postUrl, ui.postLink)}</div><p class="byline"><time datetime="${e(workflow.date)}">${e(workflow.date)}</time></p></header><div class="detail-layout"><div>${renderPostMedia(entry, thumb, ui)}<ol class="workflow-steps">${steps}</ol></div><aside class="detail-sidebar"><span class="cut-label">FIELD NOTES</span><p>${e(localized.fieldNote)}</p><div class="tag-list">${(localized.tags || []).map(tag => `<span>${e(tag)}</span>`).join('')}</div></aside></div></article><section class="related"><p class="eyebrow">CONTINUE THE REEL</p><h2>${e(ui.relatedWorkflows)}</h2>${related}</section>`;
}

export function renderWorkflowEmpty(ui) {
  return `<section class="essay-empty"><span class="cut-label">${e(ui.comingSoon)}</span><h2>${e(ui.workflowEmptyTitle)}</h2><p>${e(ui.workflowEmptyBody)}</p></section>`;
}
