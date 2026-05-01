import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// App Preview Generator — per-image elements + save/load + textblock
// =====================================================================

const state = {
    images: [],
    translations: {},
    allKeys: [],
    templateElements: {},
    selectedId: null,
    nextId: 1,
    drag: null,
    collapsedGroups: new Set(),
};

const els = {
    imageInput: document.getElementById('imageInput'),
    jsonInput: document.getElementById('jsonInput'),
    imageList: document.getElementById('imageList'),
    langInfo: document.getElementById('langInfo'),
    elementsList: document.getElementById('elementsList'),
    addCustomElement: document.getElementById('addCustomElement'),
    previewLang: document.getElementById('previewLang'),
    previewTemplate: document.getElementById('previewTemplate'),
    previewScale: document.getElementById('previewScale'),
    scaleValue: document.getElementById('scaleValue'),
    previewCanvas: document.getElementById('previewCanvas'),
    canvasPlaceholder: document.getElementById('canvasPlaceholder'),
    canvasWrapper: document.getElementById('canvasWrapper'),
    canvasScroll: document.getElementById('canvasScroll'),
    generateBtn: document.getElementById('generateBtn'),
    progress: document.getElementById('progress'),
    progressFill: document.getElementById('progressFill'),
    progressText: document.getElementById('progressText'),
    inspector: document.getElementById('inspector'),
    inKey: document.getElementById('inKey'),
    inX: document.getElementById('inX'),
    inY: document.getElementById('inY'),
    inSize: document.getElementById('inSize'),
    inColor: document.getElementById('inColor'),
    inColorText: document.getElementById('inColorText'),
    inFont: document.getElementById('inFont'),
    inType: document.getElementById('inType'),
    blockFields: document.getElementById('blockFields'),
    blockFields2: document.getElementById('blockFields2'),
    inBlockWidth: document.getElementById('inBlockWidth'),
    inBlockHeight: document.getElementById('inBlockHeight'),
    inLineHeight: document.getElementById('inLineHeight'),
    inTextAlign: document.getElementById('inTextAlign'),
    inBold: document.getElementById('inBold'),
    inShadow: document.getElementById('inShadow'),
    inOutline: document.getElementById('inOutline'),
    inCenter: document.getElementById('inCenter'),
    inDefault: document.getElementById('inDefault'),
    inRotation: document.getElementById('inRotation'),
    inSkewX: document.getElementById('inSkewX'),
    inSkewY: document.getElementById('inSkewY'),
    deleteElement: document.getElementById('deleteElement'),
    saveProjectBtn: document.getElementById('saveProjectBtn'),
    loadProjectBtn: document.getElementById('loadProjectBtn'),
    loadProjectInput: document.getElementById('loadProjectInput'),
};

function loadImage(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
    });
}

function getLangs() {
    return Object.keys(state.translations);
}

function getTextForKey(lang, key, fallback) {
    const map = state.translations[lang];
    if (map && map[key] != null) return String(map[key]);
    if (fallback != null) return String(fallback);
    return key;
}

function getCurrentImage() {
    const idx = parseInt(els.previewTemplate.value, 10);
    if (isNaN(idx)) return null;
    return state.images[idx] || null;
}

function getCurrentElements() {
    const img = getCurrentImage();
    if (!img) return [];
    if (!state.templateElements[img.id]) state.templateElements[img.id] = [];
    return state.templateElements[img.id];
}

function getCurrentLang() {
    return els.previewLang.value;
}

function updateGenerateButton() {
    const can = state.images.length > 0 && getLangs().length > 0 && state.images.some(img => {
        const el = state.templateElements[img.id];
        return el && el.length > 0;
    });
    els.generateBtn.disabled = !can;
}

// Images
els.imageInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
        try {
            const img = await loadImage(file);
            const id = state.nextId++;
            state.images.push({ id, name: file.name, file, img });
            state.templateElements[id] = [];
        } catch (err) {
            console.error('Failed to load image', file.name, err);
        }
    }
    applyPendingTemplateElements();
    renderImageList();
    updateTemplateSelect();
    updateCanvasVisibility();
    renderElementsList();
    updateGenerateButton();
});

function renderImageList() {
    els.imageList.innerHTML = '';
    state.images.forEach((item, idx) => {
        const div = document.createElement('div');
        div.className = 'file-item';
        div.innerHTML = `<span>${escapeHtml(item.name)}</span><button data-idx="${idx}">Удалить</button>`;
        div.querySelector('button').addEventListener('click', () => {
            URL.revokeObjectURL(item.img.src);
            delete state.templateElements[item.id];
            state.images.splice(idx, 1);
            renderImageList();
            updateTemplateSelect();
            updateCanvasVisibility();
            updateGenerateButton();
        });
        els.imageList.appendChild(div);
    });
}

function updateTemplateSelect() {
    els.previewTemplate.innerHTML = '';
    if (state.images.length === 0) {
        els.previewTemplate.disabled = true;
        const opt = document.createElement('option');
        opt.textContent = 'Сначала загрузите изображения';
        els.previewTemplate.appendChild(opt);
        return;
    }
    els.previewTemplate.disabled = false;
    state.images.forEach((img, idx) => {
        const opt = document.createElement('option');
        opt.value = idx;
        opt.textContent = img.name;
        els.previewTemplate.appendChild(opt);
    });
}

// JSON
els.jsonInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (data && typeof data === 'object' && !Array.isArray(data)) {
            const normalized = {};
            for (const [lang, map] of Object.entries(data)) {
                if (map && typeof map === 'object' && !Array.isArray(map)) {
                    normalized[lang] = map;
                }
            }
            state.translations = normalized;
        } else {
            alert('JSON должен быть объектом с языками');
            return;
        }
        renderLangInfo();
        updateLangSelect();
        autoCreateElementsFromKeys();
        applyPendingTemplateElements();
        updateGenerateButton();
    } catch (err) {
        alert('Ошибка чтения JSON: ' + err.message);
    }
});

function renderLangInfo() {
    const langs = getLangs();
    if (langs.length === 0) {
        els.langInfo.classList.add('hidden');
        return;
    }
    const first = state.translations[langs[0]];
    const keys = Object.keys(first || {});
    els.langInfo.classList.remove('hidden');
    els.langInfo.innerHTML = `
        <div style="margin-top:3px"> 
            Языков: <strong>${langs.length}</strong> 
            Ключей: <strong>${keys.length}</strong></div>
        <div class="lang-tags">
            ${langs.map(l => `<span class="lang-tag">${escapeHtml(l)}</span>`).join('')}
        </div>
    `;
}

function updateLangSelect() {
    els.previewLang.innerHTML = '';
    const langs = getLangs();
    if (langs.length === 0) {
        els.previewLang.disabled = true;
        const opt = document.createElement('option');
        opt.textContent = 'Сначала загрузите JSON';
        els.previewLang.appendChild(opt);
        return;
    }
    els.previewLang.disabled = false;
    langs.forEach(lang => {
        const opt = document.createElement('option');
        opt.value = lang;
        opt.textContent = lang;
        els.previewLang.appendChild(opt);
    });
}

function autoCreateElementsFromKeys() {
    const langs = getLangs();
    if (langs.length === 0) return;
    const firstLang = state.translations[langs[0]];

    function extract(map, group = null) {
        const result = [];
        for (const [k, v] of Object.entries(map)) {
            if (v && typeof v === 'object' && !Array.isArray(v)) {
                const newGroup = k.startsWith('G-')
                    ? (group ? group + '/' + k.slice(2) : k.slice(2))
                    : group;
                result.push(...extract(v, newGroup));
            } else if (v != null) {
                result.push({ key: k, group, defaultText: String(v) });
            }
        }
        return result;
    }

    const extracted = extract(firstLang || {});
    if (extracted.length === 0) return;

    let added = false;
    extracted.forEach(({ key, group, defaultText }) => {
        if (state.allKeys.find(k => k.key === key)) return;
        state.allKeys.push({
            key,
            group,
            defaultText,
            fontSize: key.length > 20 ? 32 : 48,
            color: '#ffffff',
            font: 'Inter',
            bold: false,
            shadow: true,
            outline: false,
            center: true,
            rotation: 0,
            skewX: 0,
            skewY: 0,
            perspective: getDefaultPerspective(),
        });
        added = true;
    });
    if (added) renderElementsList();
}

function addElementToTemplate(key) {
    const img = getCurrentImage();
    if (!img) return;
    const poolItem = state.allKeys.find(k => k.key === key);
    if (!poolItem) return;

    const elements = getCurrentElements();
    if (elements.find(e => e.key === key)) return;

    const cw = img.img.width;
    const ch = img.img.height;

    elements.push({
        key: poolItem.key,
        x: Math.round(cw / 2),
        y: Math.round(ch / 2),
        fontSize: poolItem.fontSize,
        color: poolItem.color,
        font: poolItem.font,
        bold: poolItem.bold,
        shadow: poolItem.shadow,
        outline: poolItem.outline,
        center: poolItem.center,
        defaultText: poolItem.defaultText,
        type: 'text',
        rotation: poolItem.rotation || 0,
        skewX: poolItem.skewX || 0,
        skewY: poolItem.skewY || 0,
        perspective: poolItem.perspective ? getPerspective(poolItem) : getDefaultPerspective(),
    });

    state.selectedId = elements.length - 1;
    renderElementsList();
    updateInspector();
    drawPreview();
    updateGenerateButton();
}

// Elements list sidebar
function renderElementsList() {
    const elements = getCurrentElements();
    els.elementsList.innerHTML = '';

    if (state.allKeys.length === 0) {
        els.elementsList.innerHTML = '<div class="empty-state">Загрузите JSON чтобы создать элементы</div>';
        updateInspector();
        updateGenerateButton();
        drawPreview();
        return;
    }

    function buildTree(keys) {
        const root = { children: new Map(), keys: [] };
        keys.forEach(k => {
            const parts = k.group ? k.group.split('/') : [];
            let node = root;
            parts.forEach(part => {
                if (!node.children.has(part)) {
                    node.children.set(part, { children: new Map(), keys: [] });
                }
                node = node.children.get(part);
            });
            node.keys.push(k);
        });
        return root;
    }

    function countDeep(node) {
        let count = node.keys.length;
        node.children.forEach(child => { count += countDeep(child); });
        return count;
    }

    function renderCard(poolItem) {
        const templateIdx = elements.findIndex(e => e.key === poolItem.key);
        const onTemplate = templateIdx >= 0;
        const card = document.createElement('div');
        card.className = 'element-card' + (state.selectedId === templateIdx && onTemplate ? ' selected' : '') + (onTemplate ? ' on-template' : '');
        card.innerHTML = `
            <div class="el-header">
                <span>${escapeHtml(poolItem.key)}</span>
                <div class="el-actions">
                    ${onTemplate ? '<button class="edit" title="Редактировать">✎</button>' : '<button class="add" title="Добавить на шаблон">+</button>'}
                    ${onTemplate ? '<button class="del" title="Удалить со шаблона">🗑</button>' : ''}
                </div>
            </div>
            <div class="el-meta">
                <span class="el-status">${onTemplate ? '✓ На шаблоне' : '− Не добавлен'}</span>
                <span>${poolItem.fontSize}px</span>
                <span>${escapeHtml(poolItem.font)}</span>
                <span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${poolItem.color};border:1px solid #555;"></span>
            </div>
        `;
        if (onTemplate) {
            card.querySelector('.edit').addEventListener('click', (ev) => {
                ev.stopPropagation();
                state.selectedId = templateIdx;
                renderElementsList();
                updateInspector();
                drawPreview();
            });
            card.querySelector('.del').addEventListener('click', (ev) => {
                ev.stopPropagation();
                elements.splice(templateIdx, 1);
                if (state.selectedId === templateIdx) state.selectedId = null;
                else if (state.selectedId != null && state.selectedId > templateIdx) state.selectedId--;
                renderElementsList();
                updateInspector();
                drawPreview();
            });
        } else {
            card.querySelector('.add').addEventListener('click', (ev) => {
                ev.stopPropagation();
                addElementToTemplate(poolItem.key);
            });
        }
        card.addEventListener('click', () => {
            if (onTemplate) {
                state.selectedId = templateIdx;
                renderElementsList();
                updateInspector();
                drawPreview();
            } else {
                addElementToTemplate(poolItem.key);
            }
        });
        return card;
    }

    function renderNode(node, path) {
        const container = document.createElement('div');

        // Ungrouped keys — wrap in a "Без группы" section at root level
        if (path === '' && node.keys.length > 0) {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'element-group';
            const isCollapsed = state.collapsedGroups.has(null);
            const header = document.createElement('div');
            header.className = 'element-group-header';
            header.innerHTML = `
                <span class="group-toggle">${isCollapsed ? '▶' : '▼'}</span>
                <span class="group-name">Без группы</span>
                <span class="group-count">${node.keys.length}</span>
            `;
            header.addEventListener('click', () => {
                if (state.collapsedGroups.has(null)) {
                    state.collapsedGroups.delete(null);
                } else {
                    state.collapsedGroups.add(null);
                }
                renderElementsList();
            });
            groupDiv.appendChild(header);
            if (!isCollapsed) {
                const listDiv = document.createElement('div');
                listDiv.className = 'element-group-list';
                node.keys.forEach(k => listDiv.appendChild(renderCard(k)));
                groupDiv.appendChild(listDiv);
            }
            container.appendChild(groupDiv);
        } else {
            node.keys.forEach(k => container.appendChild(renderCard(k)));
        }

        const childNames = Array.from(node.children.keys()).sort();
        childNames.forEach(name => {
            const childNode = node.children.get(name);
            const childPath = path ? path + '/' + name : name;
            const groupDiv = document.createElement('div');
            groupDiv.className = 'element-group';

            const isCollapsed = state.collapsedGroups.has(childPath);
            const header = document.createElement('div');
            header.className = 'element-group-header';
            header.innerHTML = `
                <span class="group-toggle">${isCollapsed ? '▶' : '▼'}</span>
                <span class="group-name">${escapeHtml(name)}</span>
                <span class="group-count">${countDeep(childNode)}</span>
            `;
            header.addEventListener('click', () => {
                if (state.collapsedGroups.has(childPath)) {
                    state.collapsedGroups.delete(childPath);
                } else {
                    state.collapsedGroups.add(childPath);
                }
                renderElementsList();
            });
            groupDiv.appendChild(header);

            if (!isCollapsed) {
                const listDiv = renderNode(childNode, childPath);
                listDiv.className = 'element-group-list';
                groupDiv.appendChild(listDiv);
            }
            container.appendChild(groupDiv);
        });
        return container;
    }

    const tree = buildTree(state.allKeys);
    els.elementsList.appendChild(renderNode(tree, ''));

    updateInspector();
    updateGenerateButton();
    drawPreview();
}

// Custom key into global pool
els.addCustomElement.addEventListener('click', () => {
    const key = prompt('Название ключа:', 'custom');
    if (!key) return;
    if (state.allKeys.find(k => k.key === key)) {
        alert('Такой ключ уже есть');
        return;
    }
    state.allKeys.push({
        key,
        defaultText: '',
        fontSize: 36,
        color: '#ffffff',
        font: 'Inter',
        bold: false,
        shadow: true,
        outline: false,
        center: true,
        rotation: 0,
        skewX: 0,
        skewY: 0,
        perspective: getDefaultPerspective(),
    });
    renderElementsList();
});

// Inspector
function toggleBlockFields() {
    const isBlock = els.inType.value === 'textblock';
    els.blockFields.classList.toggle('hidden', !isBlock);
    els.blockFields2.classList.toggle('hidden', !isBlock);
}

function updateInspector() {
    const elements = getCurrentElements();
    if (state.selectedId == null || !elements[state.selectedId]) {
        els.inspector.classList.add('hidden');
        return;
    }
    els.inspector.classList.remove('hidden');
    const el = elements[state.selectedId];
    if (!el.perspective) el.perspective = getDefaultPerspective();
    els.inKey.value = el.key;
    els.inX.value = el.x;
    els.inY.value = el.y;
    els.inSize.value = el.fontSize;
    els.inColor.value = el.color;
    els.inColorText.value = el.color;
    els.inFont.value = el.font;
    els.inType.value = el.type || 'text';
    toggleBlockFields();
    els.inBlockWidth.value = el.blockWidth || 400;
    els.inBlockHeight.value = el.blockHeight || 0;
    els.inLineHeight.value = getSafeLineHeight(el);
    els.inTextAlign.value = el.textAlign || 'left';
    els.inBold.checked = el.bold;
    els.inShadow.checked = el.shadow;
    els.inOutline.checked = el.outline;
    els.inCenter.checked = el.center;
    els.inDefault.value = el.defaultText || '';
    els.inRotation.value = el.rotation || 0;
    els.inSkewX.value = el.skewX || 0;
    els.inSkewY.value = el.skewY || 0;
}

function readInspector() {
    if (state.selectedId == null) return;
    const elements = getCurrentElements();
    const el = elements[state.selectedId];
    if (!el) return;
    const prev = {
        ...el,
        perspective: getPerspective(el),
    };
    if (!el.perspective) el.perspective = getDefaultPerspective();
    el.key = els.inKey.value.trim() || el.key;
    el.x = parseInt(els.inX.value, 10) || 0;
    el.y = parseInt(els.inY.value, 10) || 0;
    el.fontSize = Math.max(8, parseInt(els.inSize.value, 10) || 24);
    el.color = els.inColorText.value || '#ffffff';
    el.font = els.inFont.value;
    el.type = els.inType.value || 'text';
    el.bold = els.inBold.checked;
    el.shadow = els.inShadow.checked;
    el.outline = els.inOutline.checked;
    el.center = els.inCenter.checked;
    el.defaultText = els.inDefault.value.trim();
    el.rotation = parseFloat(els.inRotation.value) || 0;
    el.skewX = parseFloat(els.inSkewX.value) || 0;
    el.skewY = parseFloat(els.inSkewY.value) || 0;
    if (el.type === 'textblock') {
        el.blockWidth = Math.max(10, parseInt(els.inBlockWidth.value, 10) || 400);
        el.blockHeight = Math.max(0, parseInt(els.inBlockHeight.value, 10) || 0);
        el.lineHeight = Math.max(0.1, parseFloat(els.inLineHeight.value) || 1.2);
        el.textAlign = els.inTextAlign.value || 'left';
    }

    const typeChanged = prev.type !== el.type && (prev.type === 'text' || prev.type === 'textblock') && (el.type === 'text' || el.type === 'textblock');
    if (typeChanged) {
        const img = getCurrentImage();
        const canvas = document.createElement('canvas');
        canvas.width = img?.img?.width || 1;
        canvas.height = img?.img?.height || 1;
        const ctx = canvas.getContext('2d');
        const lang = getCurrentLang();

        el.perspective = getDefaultPerspective();

        if (el.type === 'textblock') {
            const measured = measureElement(ctx, { ...el, type: 'text', perspective: getDefaultPerspective() }, lang);
            el.blockWidth = Math.max(120, Math.ceil(measured.width));
            el.blockHeight = Math.max(1, Math.ceil(el.fontSize * getSafeLineHeight(el)));
            const fitted = layoutTextBlock(ctx, el, lang);
            el.blockHeight = Math.max(1, Math.ceil(fitted.contentHeight));
        }
    }
    drawPreview();
    renderElementsList();
}

els.inKey.addEventListener('input', readInspector);
els.inX.addEventListener('input', readInspector);
els.inY.addEventListener('input', readInspector);
els.inSize.addEventListener('input', readInspector);
els.inFont.addEventListener('change', readInspector);
els.inType.addEventListener('change', () => { toggleBlockFields(); readInspector(); });
els.inBlockWidth.addEventListener('input', readInspector);
els.inBlockHeight.addEventListener('input', readInspector);
els.inLineHeight.addEventListener('input', readInspector);
els.inTextAlign.addEventListener('change', readInspector);
els.inBold.addEventListener('change', readInspector);
els.inShadow.addEventListener('change', readInspector);
els.inOutline.addEventListener('change', readInspector);
els.inCenter.addEventListener('change', readInspector);
els.inDefault.addEventListener('input', readInspector);
els.inRotation.addEventListener('input', readInspector);
els.inSkewX.addEventListener('input', readInspector);
els.inSkewY.addEventListener('input', readInspector);

els.inColor.addEventListener('input', (e) => {
    els.inColorText.value = e.target.value;
    readInspector();
});
els.inColorText.addEventListener('input', (e) => {
    els.inColor.value = e.target.value;
    readInspector();
});

els.deleteElement.addEventListener('click', () => {
    if (state.selectedId == null) return;
    const elements = getCurrentElements();
    elements.splice(state.selectedId, 1);
    state.selectedId = null;
    renderElementsList();
    updateInspector();
    drawPreview();
});

function dataUrlToFile(dataUrl, name) {
    const byteString = atob(dataUrl.split(',')[1]);
    const mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: mimeString });
    return new File([blob], name, { type: mimeString });
}

// Save / Load project
els.saveProjectBtn.addEventListener('click', async () => {
    const imageData = [];
    for (const imgItem of state.images) {
        const canvas = document.createElement('canvas');
        canvas.width = imgItem.img.width;
        canvas.height = imgItem.img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imgItem.img, 0, 0);
        const base64 = canvas.toDataURL('image/png');
        imageData.push({ name: imgItem.name, base64 });
    }

    const data = {
        version: 1,
        allKeys: state.allKeys,
        templateElements: {},
        translations: state.translations,
        images: imageData,
    };
    state.images.forEach(img => {
        const elements = state.templateElements[img.id];
        if (elements && elements.length > 0) {
            data.templateElements[img.name] = elements.map(e => ({...e}));
        }
    });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    saveAs(blob, 'project.alka');
});

els.loadProjectBtn.addEventListener('click', () => {
    els.loadProjectInput.click();
});

els.loadProjectInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data.allKeys || !data.templateElements) {
            alert('Некорректный файл проекта');
            return;
        }

        // Clear existing state
        state.images.forEach(img => URL.revokeObjectURL(img.img.src));
        state.images = [];
        state.templateElements = {};
        state.nextId = 1;
        state.selectedId = null;

        // Restore images
        if (data.images && Array.isArray(data.images)) {
            for (const imgData of data.images) {
                const fileObj = dataUrlToFile(imgData.base64, imgData.name);
                const img = await loadImage(fileObj);
                const id = state.nextId++;
                state.images.push({ id, name: imgData.name, file: fileObj, img });
                state.templateElements[id] = [];
            }
        }

        state.allKeys = (data.allKeys || []).map(k => ({
            ...k,
            perspective: k.perspective ? getPerspective(k) : getDefaultPerspective(),
        }));
        state.translations = data.translations || {};
        state.pendingTemplateElements = data.templateElements;
        applyPendingTemplateElements();

        renderImageList();
        updateTemplateSelect();
        updateLangSelect();
        renderLangInfo();
        renderElementsList();
        updateCanvasVisibility();
        updateGenerateButton();
        drawPreview();
    } catch (err) {
        alert('Ошибка загрузки проекта: ' + err.message);
    }
});

function applyPendingTemplateElements() {
    if (!state.pendingTemplateElements) return;
    state.images.forEach(img => {
        const saved = state.pendingTemplateElements[img.name];
        if (saved) {
            state.templateElements[img.id] = saved.map(e => ({
                ...e,
                perspective: e.perspective ? getPerspective(e) : getDefaultPerspective(),
            }));
        }
    });
    delete state.pendingTemplateElements;
}

// Canvas
function updateCanvasVisibility() {
    const img = getCurrentImage();
    if (!img) {
        els.previewCanvas.style.display = 'none';
        els.canvasPlaceholder.classList.remove('hidden');
        return;
    }
    els.previewCanvas.style.display = 'block';
    els.canvasPlaceholder.classList.add('hidden');
    drawPreview();
}

function getSafeLineHeight(el) {
    const lh = Number(el?.lineHeight);
    return Number.isFinite(lh) && lh > 0 ? lh : 1.2;
}

function getCanvasPoint(e) {
    const rect = els.previewCanvas.getBoundingClientRect();
    const scale = parseFloat(els.previewScale.value);
    return {
        x: (e.clientX - rect.left) / scale,
        y: (e.clientY - rect.top) / scale,
    };
}

function wrapText(ctx, text, maxWidth) {
    if (!text) return [''];
    const lines = [];
    const paragraphs = String(text).split(/\r?\n/);

    const breakLongToken = (token) => {
        const chunks = [];
        let chunk = '';
        for (const char of token) {
            const next = chunk + char;
            if (chunk && ctx.measureText(next).width > maxWidth) {
                chunks.push(chunk);
                chunk = char;
            } else {
                chunk = next;
            }
        }
        if (chunk) chunks.push(chunk);
        return chunks;
    };

    for (const paragraph of paragraphs) {
        if (paragraph.length === 0) {
            lines.push('');
            continue;
        }
        let current = '';
        const tokens = paragraph.match(/\S+|\s+/g) || [];
        for (const token of tokens) {
            if (/^\s+$/.test(token)) {
                current += token;
                continue;
            }

            const candidate = current + token;
            if (ctx.measureText(candidate).width <= maxWidth || current.trim().length === 0) {
                if (ctx.measureText(candidate).width <= maxWidth) {
                    current = candidate;
                    continue;
                }
            }

            if (current.trim().length > 0) {
                lines.push(current.trimEnd());
                current = '';
            }

            if (ctx.measureText(token).width <= maxWidth) {
                current = token;
            } else {
                const chunks = breakLongToken(token);
                lines.push(...chunks.slice(0, -1));
                current = chunks[chunks.length - 1] || '';
            }
        }
        lines.push(current.trimEnd());
    }

    return lines.length ? lines : [''];
}


function layoutTextBlock(ctx, el, lang) {
    const text = getTextForKey(lang, el.key, el.defaultText || el.key);
    const maxWidth = Math.max(10, el.blockWidth || 400);
    const targetHeight = Math.max(0, el.blockHeight || 0);
    const baseSize = Math.max(8, el.fontSize || 24);
    const minSize = 8;

    const resolveLines = (fontSize) => {
        ctx.font = `${el.bold ? 'bold ' : ''}${fontSize}px "${el.font}", sans-serif`;
        const lines = wrapText(ctx, text, maxWidth);
        const lineHeight = fontSize * getSafeLineHeight(el);
        const contentHeight = lines.length * lineHeight;
        return { fontSize, lines, lineHeight, contentHeight };
    };

    let blockLayout = resolveLines(baseSize);
    if (targetHeight > 0 && blockLayout.contentHeight > targetHeight) {
        let lo = minSize;
        let hi = baseSize;
        let best = resolveLines(minSize);
        if (best.contentHeight > targetHeight) {
            blockLayout = best;
        } else {
            for (let i = 0; i < 14; i++) {
                const mid = (lo + hi) / 2;
                const probe = resolveLines(mid);
                if (probe.contentHeight <= targetHeight) {
                    best = probe;
                    lo = mid;
                } else {
                    hi = mid;
                }
            }
            blockLayout = best;
        }
    }

    return {
        text,
        width: maxWidth,
        renderHeight: targetHeight > 0 ? targetHeight : blockLayout.contentHeight,
        lines: blockLayout.lines,
        lineHeight: blockLayout.lineHeight,
        drawFontSize: blockLayout.fontSize,
        contentHeight: blockLayout.contentHeight,
    };
}

function measureElement(ctx, el, lang) {
    const text = getTextForKey(lang, el.key, el.defaultText || el.key);
    ctx.save();
    ctx.font = `${el.bold ? 'bold ' : ''}${el.fontSize}px "${el.font}", sans-serif`;
    if (el.type === 'textblock') {
        const blockLayout = layoutTextBlock(ctx, el, lang);
        ctx.restore();
        return { text, width: blockLayout.width, height: blockLayout.renderHeight, lines: blockLayout.lines, lineHeight: blockLayout.lineHeight };
    }
    const metrics = ctx.measureText(text);
    ctx.restore();
    return { text, width: metrics.width, height: el.fontSize };
}

function getElementTransformMatrix(el, ox, oy) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.translate(ox, oy);
    ctx.rotate((el.rotation || 0) * Math.PI / 180);
    ctx.transform(1, Math.tan((el.skewY || 0) * Math.PI / 180), Math.tan((el.skewX || 0) * Math.PI / 180), 1, 0, 0);
    ctx.translate(-ox, -oy);
    return ctx.getTransform();
}

function getDefaultPerspective() {
    return {
        tl: { x: 0, y: 0 },
        tr: { x: 0, y: 0 },
        bl: { x: 0, y: 0 },
        br: { x: 0, y: 0 },
    };
}

function getPerspective(el) {
    const p = el.perspective || {};
    return {
        tl: { x: p.tl?.x || 0, y: p.tl?.y || 0 },
        tr: { x: p.tr?.x || 0, y: p.tr?.y || 0 },
        bl: { x: p.bl?.x || 0, y: p.bl?.y || 0 },
        br: { x: p.br?.x || 0, y: p.br?.y || 0 },
    };
}

function hasPerspective(el) {
    const p = getPerspective(el);
    return Object.values(p).some(pt => pt.x !== 0 || pt.y !== 0);
}

function getElementBox(ctx, el, lang, pad = 0) {
    const m = measureElement(ctx, el, lang);
    if (el.type === 'textblock') {
        const x = el.x - pad;
        const y = el.y - pad;
        const w = (el.blockWidth || 400) + pad * 2;
        const h = (el.blockHeight > 0 ? el.blockHeight : m.height) + pad * 2;
        return { x, y, w, h, ox: el.x, oy: el.y };
    }
    let tx = el.x;
    if (el.center) tx = el.x - m.width / 2;
    const x = tx - pad;
    const y = el.y - m.height / 2 - pad;
    const w = m.width + pad * 2;
    const h = m.height + pad * 2;
    return { x, y, w, h, ox: tx, oy: el.y };
}

function getTransformedCorners(ctx, el, lang, pad = 0) {
    const { x, y, w, h, ox, oy } = getElementBox(ctx, el, lang, pad);
    const mat = getElementTransformMatrix(el, ox, oy);
    const p = getPerspective(el);
    return {
        tl: transformPoint(mat, x + p.tl.x, y + p.tl.y),
        tr: transformPoint(mat, x + w + p.tr.x, y + p.tr.y),
        bl: transformPoint(mat, x + p.bl.x, y + h + p.bl.y),
        br: transformPoint(mat, x + w + p.br.x, y + h + p.br.y),
        mat,
        x,
        y,
        w,
        h,
        ox,
        oy,
    };
}

function transformPoint(m, x, y) {
    const p = m.transformPoint(new DOMPoint(x, y));
    return { x: p.x, y: p.y };
}

function inverseTransformPoint(m, x, y) {
    const p = m.inverse().transformPoint(new DOMPoint(x, y));
    return { x: p.x, y: p.y };
}

function getElementBounds(ctx, el, lang) {
    const c = getTransformedCorners(ctx, el, lang, 8);
    const corners = [c.tl, c.tr, c.bl, c.br];
    const xs = corners.map(pt => pt.x);
    const ys = corners.map(pt => pt.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY, textX: el.type === 'text' ? c.ox : el.x, textY: el.y };
}

function hitTest(px, py) {
    const img = getCurrentImage();
    if (!img) return -1;
    const elements = getCurrentElements();
    const canvas = document.createElement('canvas');
    canvas.width = img.img.width;
    canvas.height = img.img.height;
    const ctx = canvas.getContext('2d');
    const lang = getCurrentLang();
    for (let i = elements.length - 1; i >= 0; i--) {
        const el = elements[i];
        if (pointInElement(ctx, el, lang, px, py, 8)) {
            return i;
        }
    }
    return -1;
}

function pointInElement(ctx, el, lang, px, py, pad = 0) {
    if (hasPerspective(el)) {
        const c = getTransformedCorners(ctx, el, lang, pad);
        const p = { x: px, y: py };
        const area = (p1, p2, p3) => (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
        const pointInTri = (pt, a, b, cc) => {
            const d1 = area(pt, a, b);
            const d2 = area(pt, b, cc);
            const d3 = area(pt, cc, a);
            const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
            const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
            return !(hasNeg && hasPos);
        };
        return pointInTri(p, c.tl, c.tr, c.br) || pointInTri(p, c.tl, c.bl, c.br);
    }
    const { x, y, w, h, mat } = getTransformedCorners(ctx, el, lang, 0);
    const local = inverseTransformPoint(mat, px, py);
    return local.x >= x - pad && local.x <= x + w + pad && local.y >= y - pad && local.y <= y + h + pad;
}

function applyAffineFromCorners(ctx, corners, width, height) {
    if (width <= 0 || height <= 0) return false;
    const ex = {
        x: ((corners.tr.x - corners.tl.x) + (corners.br.x - corners.bl.x)) / 2,
        y: ((corners.tr.y - corners.tl.y) + (corners.br.y - corners.bl.y)) / 2,
    };
    const ey = {
        x: ((corners.bl.x - corners.tl.x) + (corners.br.x - corners.tr.x)) / 2,
        y: ((corners.bl.y - corners.tl.y) + (corners.br.y - corners.tr.y)) / 2,
    };
    const a = ex.x / width;
    const b = ex.y / width;
    const c = ey.x / height;
    const d = ey.y / height;
    const e = corners.tl.x;
    const f = corners.tl.y;
    ctx.transform(a, b, c, d, e, f);
    return true;
}

function drawPerspectiveText(ctx, el, lang, width, height, drawTextFn) {
    const corners = getTransformedCorners(ctx, el, lang, 0);
    if (width <= 0 || height <= 0) return;

    const buffer = document.createElement('canvas');
    buffer.width = Math.max(1, Math.ceil(width));
    buffer.height = Math.max(1, Math.ceil(height));
    const bctx = buffer.getContext('2d');
    drawTextFn(bctx);

    ctx.save();
    const slices = Math.min(160, Math.max(24, Math.ceil(width / 6)));
    for (let i = 0; i < slices; i++) {
        const u0 = i / slices;
        const u1 = (i + 1) / slices;

        const top0 = {
            x: corners.tl.x + (corners.tr.x - corners.tl.x) * u0,
            y: corners.tl.y + (corners.tr.y - corners.tl.y) * u0,
        };
        const top1 = {
            x: corners.tl.x + (corners.tr.x - corners.tl.x) * u1,
            y: corners.tl.y + (corners.tr.y - corners.tl.y) * u1,
        };
        const bottom0 = {
            x: corners.bl.x + (corners.br.x - corners.bl.x) * u0,
            y: corners.bl.y + (corners.br.y - corners.bl.y) * u0,
        };
        const bottom1 = {
            x: corners.bl.x + (corners.br.x - corners.bl.x) * u1,
            y: corners.bl.y + (corners.br.y - corners.bl.y) * u1,
        };

        const srcX = u0 * width;
        const srcW = Math.max(1, (u1 - u0) * width);

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(top0.x, top0.y);
        ctx.lineTo(top1.x, top1.y);
        ctx.lineTo(bottom1.x, bottom1.y);
        ctx.lineTo(bottom0.x, bottom0.y);
        ctx.closePath();
        ctx.clip();

        ctx.transform(
            (top1.x - top0.x) / srcW,
            (top1.y - top0.y) / srcW,
            (bottom0.x - top0.x) / height,
            (bottom0.y - top0.y) / height,
            top0.x - ((top1.x - top0.x) / srcW) * srcX,
            top0.y - ((top1.y - top0.y) / srcW) * srcX,
        );

        ctx.drawImage(buffer, 0, 0);
        ctx.restore();
    }
    ctx.restore();
}

function drawTextBlock(ctx, el, lang) {
    const temp = document.createElement('canvas').getContext('2d');
    const blockLayout = layoutTextBlock(temp, el, lang);
    const maxWidth = blockLayout.width;
    const lines = blockLayout.lines;
    const lineHeight = blockLayout.lineHeight;
    const contentHeight = el.blockHeight || 0;
    const renderHeight = blockLayout.renderHeight;

    if (hasPerspective(el)) {
        drawPerspectiveText(ctx, el, lang, maxWidth, renderHeight, (pctx) => {
            pctx.font = `${el.bold ? 'bold ' : ''}${blockLayout.drawFontSize}px "${el.font}", sans-serif`;
            pctx.fillStyle = el.color;
            pctx.textBaseline = 'top';
            lines.forEach((line, i) => {
                const y = i * lineHeight;
                if (contentHeight > 0 && y + blockLayout.drawFontSize > contentHeight) return;
                let x = 0;
                const lineWidth = pctx.measureText(line).width;
                if (el.textAlign === 'center') x = (maxWidth - lineWidth) / 2;
                else if (el.textAlign === 'right') x = maxWidth - lineWidth;
                if (el.outline) {
                    pctx.strokeStyle = 'rgba(0,0,0,0.85)';
                    pctx.lineWidth = Math.max(2, el.fontSize / 8);
                    pctx.strokeText(line, x, y);
                }
                if (el.shadow) {
                    pctx.shadowColor = 'rgba(0,0,0,0.55)';
                    pctx.shadowBlur = Math.max(4, el.fontSize / 5);
                    pctx.shadowOffsetX = 2;
                    pctx.shadowOffsetY = 2;
                }
                pctx.fillText(line, x, y);
            });
        });
        return;
    }

    ctx.save();
    const isTransformed = (el.rotation || 0) !== 0 || (el.skewX || 0) !== 0 || (el.skewY || 0) !== 0;
    if (isTransformed) {
        ctx.translate(el.x, el.y);
        ctx.rotate((el.rotation || 0) * Math.PI / 180);
        ctx.transform(1, Math.tan((el.skewY || 0) * Math.PI / 180), Math.tan((el.skewX || 0) * Math.PI / 180), 1, 0, 0);
        ctx.translate(-el.x, -el.y);
    }
    ctx.font = `${el.bold ? 'bold ' : ''}${el.fontSize}px "${el.font}", sans-serif`;
    ctx.fillStyle = el.color;
    ctx.textBaseline = 'top';

    const maxHeight = contentHeight;

    lines.forEach((line, i) => {
        const y = el.y + i * lineHeight;
        if (maxHeight > 0 && y + blockLayout.drawFontSize > el.y + maxHeight) return;

        let x = el.x;
        const lineWidth = ctx.measureText(line).width;
        if (el.textAlign === 'center') {
            x = el.x + (maxWidth - lineWidth) / 2;
        } else if (el.textAlign === 'right') {
            x = el.x + maxWidth - lineWidth;
        }

        if (el.outline) {
            ctx.strokeStyle = 'rgba(0,0,0,0.85)';
            ctx.lineWidth = Math.max(2, el.fontSize / 8);
            ctx.strokeText(line, x, y);
        }
        if (el.shadow) {
            ctx.shadowColor = 'rgba(0,0,0,0.55)';
            ctx.shadowBlur = Math.max(4, el.fontSize / 5);
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;
        }
        ctx.fillText(line, x, y);
    });

    ctx.restore();
}

function drawElement(ctx, el, lang) {
    if (el.type === 'textblock') {
        drawTextBlock(ctx, el, lang);
        return;
    }
    const { text, width } = measureElement(ctx, el, lang);
    const height = el.fontSize;

    if (hasPerspective(el)) {
        drawPerspectiveText(ctx, el, lang, width, height, (pctx) => {
            pctx.font = `${el.bold ? 'bold ' : ''}${el.fontSize}px "${el.font}", sans-serif`;
            pctx.fillStyle = el.color;
            pctx.textBaseline = 'middle';
            const y = height / 2;
            if (el.outline) {
                pctx.strokeStyle = 'rgba(0,0,0,0.85)';
                pctx.lineWidth = Math.max(2, el.fontSize / 8);
                pctx.strokeText(text, 0, y);
            }
            if (el.shadow) {
                pctx.shadowColor = 'rgba(0,0,0,0.55)';
                pctx.shadowBlur = Math.max(4, el.fontSize / 5);
                pctx.shadowOffsetX = 2;
                pctx.shadowOffsetY = 2;
            }
            pctx.fillText(text, 0, y);
        });
        return;
    }

    ctx.save();
    let x = el.x;
    if (el.center) {
        x = el.x - width / 2;
    }
    const y = el.y;
    const isTransformed = (el.rotation || 0) !== 0 || (el.skewX || 0) !== 0 || (el.skewY || 0) !== 0;
    if (isTransformed) {
        ctx.translate(x, y);
        ctx.rotate((el.rotation || 0) * Math.PI / 180);
        ctx.transform(1, Math.tan((el.skewY || 0) * Math.PI / 180), Math.tan((el.skewX || 0) * Math.PI / 180), 1, 0, 0);
        ctx.translate(-x, -y);
    }
    ctx.font = `${el.bold ? 'bold ' : ''}${el.fontSize}px "${el.font}", sans-serif`;
    ctx.fillStyle = el.color;
    ctx.textBaseline = 'middle';

    if (el.outline) {
        ctx.strokeStyle = 'rgba(0,0,0,0.85)';
        ctx.lineWidth = Math.max(2, el.fontSize / 8);
        ctx.strokeText(text, x, y);
    }
    if (el.shadow) {
        ctx.shadowColor = 'rgba(0,0,0,0.55)';
        ctx.shadowBlur = Math.max(4, el.fontSize / 5);
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
    }
    ctx.fillText(text, x, y);
    ctx.restore();
}

function drawSelection(ctx, el, lang) {
    const c = getTransformedCorners(ctx, el, lang, 8);
    ctx.save();
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(c.tl.x, c.tl.y);
    ctx.lineTo(c.tr.x, c.tr.y);
    ctx.lineTo(c.br.x, c.br.y);
    ctx.lineTo(c.bl.x, c.bl.y);
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    const handles = [
        { x: c.tl.x, y: c.tl.y },
        { x: c.tr.x, y: c.tr.y },
        { x: c.bl.x, y: c.bl.y },
        { x: c.br.x, y: c.br.y },
    ];
    ctx.fillStyle = '#6366f1';
    handles.forEach(h => {
        ctx.fillRect(h.x - 4, h.y - 4, 8, 8);
    });
    ctx.restore();
}

function drawPreview() {
    const imgItem = getCurrentImage();
    if (!imgItem) return;
    const img = imgItem.img;
    const canvas = els.previewCanvas;
    const ctx = canvas.getContext('2d');
    const scale = parseFloat(els.previewScale.value);

    canvas.width = img.width;
    canvas.height = img.height;
    canvas.style.width = (img.width * scale) + 'px';
    canvas.style.height = (img.height * scale) + 'px';

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    const lang = getCurrentLang();
    const elements = getCurrentElements();
    elements.forEach(el => drawElement(ctx, el, lang));
    if (state.selectedId != null && elements[state.selectedId]) {
        drawSelection(ctx, elements[state.selectedId], lang);
    }
}

els.previewLang.addEventListener('change', drawPreview);
els.previewTemplate.addEventListener('change', () => {
    state.selectedId = null;
    renderElementsList();
    updateInspector();
    updateCanvasVisibility();
});
els.previewScale.addEventListener('input', () => {
    els.scaleValue.textContent = Math.round(parseFloat(els.previewScale.value) * 100) + '%';
    drawPreview();
});

// Canvas interactions
function getHandleAt(px, py, elIdx) {
    const img = getCurrentImage();
    if (!img) return null;
    const elements = getCurrentElements();
    const canvas = document.createElement('canvas');
    canvas.width = img.img.width;
    canvas.height = img.img.height;
    const ctx = canvas.getContext('2d');
    const lang = getCurrentLang();
    const el = elements[elIdx];
    const c = getTransformedCorners(ctx, el, lang, 8);
    const handles = [
        { name: 'tl', pt: c.tl },
        { name: 'tr', pt: c.tr },
        { name: 'bl', pt: c.bl },
        { name: 'br', pt: c.br },
    ];
    for (const h of handles) {
        if (Math.abs(px - h.pt.x) <= 10 && Math.abs(py - h.pt.y) <= 10) return h.name;
    }
    return null;
}

els.previewCanvas.addEventListener('mousedown', (e) => {
    const p = getCanvasPoint(e);
    const elements = getCurrentElements();
    if (state.selectedId != null) {
        const h = getHandleAt(p.x, p.y, state.selectedId);
        if (h) {
            const el = elements[state.selectedId];
            if (e.shiftKey) {
                const img = getCurrentImage();
                if (!img) return;
                const canvas = document.createElement('canvas');
                canvas.width = img.img.width;
                canvas.height = img.img.height;
                const ctx = canvas.getContext('2d');
                const lang = getCurrentLang();
                const geom = getTransformedCorners(ctx, el, lang, 0);
                const startLocal = inverseTransformPoint(geom.mat, p.x, p.y);
                state.drag = {
                    type: 'transform',
                    handle: h,
                    idx: state.selectedId,
                    startX: p.x,
                    startY: p.y,
                    startLocal,
                    transformMatrix: geom.mat,
                    startPerspective: getPerspective(el),
                };
                els.previewCanvas.style.cursor = 'crosshair';
                e.preventDefault();
                e.stopPropagation();
                return;
            } else {
                state.drag = {
                    type: 'resize',
                    handle: h,
                    idx: state.selectedId,
                    startX: p.x,
                    startY: p.y,
                    startFontSize: el.fontSize,
                };
                return;
            }
        }
    }
    const idx = hitTest(p.x, p.y);
    if (idx >= 0) {
        state.selectedId = idx;
        state.drag = {
            type: 'move',
            idx,
            offsetX: p.x - elements[idx].x,
            offsetY: p.y - elements[idx].y,
        };
        renderElementsList();
        updateInspector();
        drawPreview();
    } else {
        pan.active = true;
        pan.moved = false;
        pan.startX = e.clientX;
        pan.startY = e.clientY;
        pan.startScrollLeft = els.canvasScroll.scrollLeft;
        pan.startScrollTop = els.canvasScroll.scrollTop;
        els.canvasWrapper.style.cursor = 'grabbing';
    }
});

window.addEventListener('mousemove', (e) => {
    if (state.drag) {
        const p = getCanvasPoint(e);
        const elements = getCurrentElements();
        const el = elements[state.drag.idx];
        if (state.drag.type === 'move') {
            el.x = Math.round(p.x - state.drag.offsetX);
            el.y = Math.round(p.y - state.drag.offsetY);
        } else if (state.drag.type === 'resize') {
            const dy = p.y - state.drag.startY;
            el.fontSize = Math.max(8, Math.round(state.drag.startFontSize + dy * 0.4));
        } else if (state.drag.type === 'transform') {
            const local = inverseTransformPoint(state.drag.transformMatrix, p.x, p.y);
            const dxLocal = local.x - state.drag.startLocal.x;
            const dyLocal = local.y - state.drag.startLocal.y;
            const next = {
                ...state.drag.startPerspective,
                tl: { ...state.drag.startPerspective.tl },
                tr: { ...state.drag.startPerspective.tr },
                bl: { ...state.drag.startPerspective.bl },
                br: { ...state.drag.startPerspective.br },
            };
            next[state.drag.handle].x = next[state.drag.handle].x + dxLocal;
            next[state.drag.handle].y = next[state.drag.handle].y + dyLocal;

            const h = state.drag.handle;

            next.tl.x = Math.round(next.tl.x * 10) / 10;
            next.tl.y = Math.round(next.tl.y * 10) / 10;
            next.tr.x = Math.round(next.tr.x * 10) / 10;
            next.tr.y = Math.round(next.tr.y * 10) / 10;
            next.bl.x = Math.round(next.bl.x * 10) / 10;
            next.bl.y = Math.round(next.bl.y * 10) / 10;
            next.br.x = Math.round(next.br.x * 10) / 10;
            next.br.y = Math.round(next.br.y * 10) / 10;
            el.perspective = next;
            updateInspector();
        }
        drawPreview();
    } else if (pan.active) {
        const dx = pan.startX - e.clientX;
        const dy = pan.startY - e.clientY;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) pan.moved = true;
        els.canvasScroll.scrollLeft = pan.startScrollLeft + dx;
        els.canvasScroll.scrollTop = pan.startScrollTop + dy;
    } else {
        const p = getCanvasPoint(e);
        let cursor = 'grab';
        if (state.selectedId != null) {
            const h = getHandleAt(p.x, p.y, state.selectedId);
            if (h) {
                cursor = e.shiftKey ? 'crosshair' : 'nwse-resize';
            } else {
                const img = getCurrentImage();
                if (img) {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.img.width;
                    canvas.height = img.img.height;
                    const ctx = canvas.getContext('2d');
                    const lang = getCurrentLang();
                    const el = getCurrentElements()[state.selectedId];
                    if (el && pointInElement(ctx, el, lang, p.x, p.y, 8)) cursor = 'move';
                }
            }
        } else if (hitTest(p.x, p.y) >= 0) {
            cursor = 'move';
        }
        els.previewCanvas.style.cursor = cursor;
    }
});

window.addEventListener('mouseup', () => {
    if (state.drag) {
        state.drag = null;
        renderElementsList();
        updateInspector();
        drawPreview();
        els.previewCanvas.style.cursor = '';
    }
    if (pan.active) {
        pan.active = false;
        els.canvasWrapper.style.cursor = '';
        if (!pan.moved && state.selectedId != null) {
            state.selectedId = null;
            renderElementsList();
            updateInspector();
            drawPreview();
        }
    }
});

// Wheel: Ctrl+scroll = zoom canvas, hover text = fontSize
els.previewCanvas.addEventListener('wheel', (e) => {
    if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.05 : 0.05;
        let scale = parseFloat(els.previewScale.value) + delta;
        scale = Math.max(0.1, Math.min(2.0, scale));
        els.previewScale.value = scale;
        els.scaleValue.textContent = Math.round(scale * 100) + '%';
        drawPreview();
        return;
    }
    const p = getCanvasPoint(e);
    const idx = hitTest(p.x, p.y);
    if (idx >= 0) {
        e.preventDefault();
        const elements = getCurrentElements();
        const el = elements[idx];
        if (e.shiftKey) {
            if (el.type === 'textblock') {
                const delta = e.deltaY > 0 ? -10 : 10;
                el.blockWidth = Math.max(10, (el.blockWidth || 400) + delta);
            } else {
                const delta = e.deltaY > 0 ? -2 : 2;
                el.fontSize = Math.max(8, el.fontSize + delta * 10);
            }
        } else {
            const delta = e.deltaY > 0 ? -2 : 2;
            el.fontSize = Math.max(8, el.fontSize + delta);
        }
        state.selectedId = idx;
        renderElementsList();
        updateInspector();
        drawPreview();
    }
}, { passive: false });

// Pan canvas by dragging empty space
const pan = { active: false, moved: false, startX: 0, startY: 0, startScrollLeft: 0, startScrollTop: 0 };

// Double click to edit default text
els.previewCanvas.addEventListener('dblclick', (e) => {
    const p = getCanvasPoint(e);
    const idx = hitTest(p.x, p.y);
    if (idx >= 0) {
        const elements = getCurrentElements();
        const el = elements[idx];
        const text = prompt('Текст по умолчанию (fallback):', el.defaultText || '');
        if (text !== null) {
            el.defaultText = text;
            state.selectedId = idx;
            renderElementsList();
            updateInspector();
            drawPreview();
        }
    }
});

// Keyboard (element editing)
window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
    if (state.selectedId == null) return;
    const elements = getCurrentElements();
    const el = elements[state.selectedId];
    if (!el) return;
    const step = e.shiftKey ? 10 : 1;
    let changed = false;
    switch (e.key) {
        case 'ArrowUp': el.y -= step; changed = true; break;
        case 'ArrowDown': el.y += step; changed = true; break;
        case 'ArrowLeft': el.x -= step; changed = true; break;
        case 'ArrowRight': el.x += step; changed = true; break;
        case '+': case '=': el.fontSize = Math.max(8, el.fontSize + (e.shiftKey ? 10 : 1)); changed = true; break;
        case '-': case '_': el.fontSize = Math.max(8, el.fontSize - (e.shiftKey ? 10 : 1)); changed = true; break;
        case 'Delete': case 'Backspace':
            elements.splice(state.selectedId, 1);
            state.selectedId = null;
            renderElementsList();
            updateInspector();
            drawPreview();
            return;
    }
    if (changed) {
        e.preventDefault();
        updateInspector();
        drawPreview();
    }
});

// Generation
els.generateBtn.addEventListener('click', async () => {
    const langs = getLangs();
    if (langs.length === 0 || state.images.length === 0) return;

    let total = 0;
    for (const imgItem of state.images) {
        const el = state.templateElements[imgItem.id];
        if (el && el.length > 0) total += langs.length;
    }
    if (total === 0) return;

    els.progress.classList.remove('hidden');
    els.generateBtn.disabled = true;
    let done = 0;

    const zip = new JSZip();
    for (const lang of langs) {
        const folder = zip.folder(lang);
        for (const imgItem of state.images) {
            const elements = state.templateElements[imgItem.id] || [];
            if (elements.length === 0) continue;

            const canvas = document.createElement('canvas');
            canvas.width = imgItem.img.width;
            canvas.height = imgItem.img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(imgItem.img, 0, 0);
            elements.forEach(el => drawElement(ctx, el, lang));

            const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
            const cleanName = imgItem.name.replace(/\.[^.]+$/, '') + '.png';
            folder.file(cleanName, blob);

            done++;
            els.progressFill.style.width = ((done / total) * 100) + '%';
            els.progressText.textContent = `${done} / ${total}`;
        }
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    saveAs(zipBlob, 'app-previews.zip');

    els.progress.classList.add('hidden');
    els.generateBtn.disabled = false;
    els.progressFill.style.width = '0%';
});

// Utils
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Init
updateTemplateSelect();
updateLangSelect();
updateCanvasVisibility();
updateGenerateButton();
