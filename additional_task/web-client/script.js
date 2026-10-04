const rButtons = document.querySelectorAll('.r-btn');
const rInput = document.getElementById('r-input');
const yInput = document.getElementById('y-input');
const form = document.getElementById('point-form');
const tableBody = document.querySelector('#results-table tbody');
const canvas = document.getElementById('graph');
const ctx = canvas.getContext('2d');
let results = JSON.parse(localStorage.getItem('lab2_results')) || [];

const UNIT_SIZE = 35;
const AXIS_LIMIT = 6;
const HANDLE_RADIUS = 3;
const HANDLE_HIT_RADIUS = 10;
const ARC_STEPS = 10;

let currentR = null;
const defaultR = 5;

let vertices = null;
let shapeModified = false;
let dragTarget = null;
let isDragging = false;

function init() {
    setupRButtons();
    setupCanvasDragging();
    loadTable();

    if (results.length > 0) {
        const lastPoint = results[results.length - 1];
        currentR = parseFloat(lastPoint.r);

        rButtons.forEach(b => {
            if (b.value == currentR) b.classList.add('selected');
        });
        rInput.value = currentR;

        drawScene(currentR);
        drawPoint(parseFloat(lastPoint.x), parseFloat(lastPoint.y), lastPoint.hit);
    } else {
        drawScene(null);
    }
    form.addEventListener('submit', handleFormSubmit);
}

function loadTable() {
    tableBody.innerHTML = '';
    results.forEach(res => addTableRow(res));
}

function setupRButtons() {
    rButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            rButtons.forEach(b => b.classList.remove('selected'));
            if (this.value == "R") {
                currentR = null;
                document.getElementById('r-error').textContent = '';
                drawScene(currentR);
                return;
            }
            this.classList.add('selected');
            rInput.value = this.value;
            currentR = parseFloat(this.value);

            document.getElementById('r-error').textContent = '';
            drawScene(currentR);
        });
    });
}

function handleFormSubmit(event) {
    event.preventDefault();
    const existingServerError = document.getElementById('server-error');
    if (existingServerError) existingServerError.textContent = '';

    const xChecked = document.querySelector('input[name="x"]:checked');
    const xVal = xChecked ? xChecked.value : null;
    const yVal = yInput.value.replace(',', '.').trim();
    const rVal = rInput.value;

    if (!xVal) {
        document.getElementById('x-error').textContent = 'Выберите X';
        return;
    } else {
        document.getElementById('x-error').textContent = '';
    }

    if (!yVal || isNaN(yVal) || parseFloat(yVal) < -3 || parseFloat(yVal) > 5) {
        document.getElementById('y-error').textContent = 'Введите число от -3 до 5';
        return;
    } else {
        document.getElementById('y-error').textContent = '';
    }

    if (!rVal) {
        document.getElementById('r-error').textContent = 'Выберите R';
        return;
    }

    const params = new URLSearchParams();
    params.append('x', xVal);
    params.append('y', yVal);
    params.append('r', rVal);

    if (shapeModified) {
        params.append('rect', serializePolygon(vertices.rect));
        params.append('tri', serializePolygon(vertices.tri));
        params.append('arc', serializePolygon(vertices.arc));
    }

    const url = `/fcgi-bin/server.jar`;

    fetch(url, { 
        method: 'POST', 
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString() 
    })
    .then(response => {
        if (!response.ok) throw new Error('Ошибка сервера');
        return response.json();
    })
    .then(data => {
        results.push(data);
        localStorage.setItem('lab2_results', JSON.stringify(results));

        redraw();
        drawPoint(parseFloat(data.x), parseFloat(data.y), data.hit);
        addTableRow(data);
    })
    .catch(error => {
        console.error('Ошибка AJAX:', error);
        let serverError = document.getElementById('server-error');
        if (!serverError) {
            serverError = document.createElement('div');
            serverError.id = 'server-error';
            serverError.className = 'error-message';
            serverError.style.color = 'red';
            serverError.style.marginTop = '10px';
            form.appendChild(serverError);
        }
        serverError.textContent = 'Не удалось связаться с сервером. Проверьте запущен ли FastCGI.';
    });
}

function serializePolygon(poly) {
    return poly.map(pt => `${pt.x},${pt.y}`).join(';');
}

function addTableRow(data) {
    const dateObj = new Date(data.currentTime);
    const timeStr = new Intl.DateTimeFormat('ru-RU', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).format(dateObj);

    const row = document.createElement('tr');
    row.innerHTML = `
        <td>${data.x}</td>
        <td>${data.y}</td>
        <td>${data.r}</td>
        <td style="color: ${data.hit ? 'green' : 'red'}">${data.hit ? 'Попадание' : 'Промах'}</td>
        <td>${timeStr}</td>
        <td>${data.executionTime} нс</td>
    `;
    tableBody.prepend(row);
}

function buildDefaultVertices(r) {
    const rr = r / 2;
    const arc = [{ x: 0, y: 0 }];
    for (let i = 0; i <= ARC_STEPS; i++) {
        const theta = Math.PI - (Math.PI / 2) * (i / ARC_STEPS);
        arc.push({ x: rr * Math.cos(theta), y: -rr * Math.sin(theta) });
    }
    return {
        rect: [
            { x: 0, y: 0 },
            { x: r, y: 0 },
            { x: r, y: -r / 2 },
            { x: 0, y: -r / 2 }
        ],
        tri: [
            { x: 0, y: 0 },
            { x: -r, y: 0 },
            { x: 0, y: r / 2 }
        ],
        arc
    };
}

function resetVerticesForR(r) {
    vertices = buildDefaultVertices(r);
    shapeModified = false;
}

function drawScene(rValue) {
    const renderR = rValue !== null ? rValue : defaultR;
    resetVerticesForR(renderR);
    redraw();
}

function redraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawCustomShapes();
    drawAxes(currentR);
    drawHandles();
}

function toPixel(pt) {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    return { px: cx + pt.x * UNIT_SIZE, py: cy - pt.y * UNIT_SIZE };
}

function drawPolygon(points) {
    if (points.length < 2) return;
    ctx.beginPath();
    points.forEach((pt, i) => {
        const { px, py } = toPixel(pt);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.fill();
}

function drawCustomShapes() {
    ctx.fillStyle = '#3399ff';
    drawPolygon(vertices.rect);
    drawPolygon(vertices.tri);
    drawPolygon(vertices.arc);
}

function drawAxes(rValue) {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#000';
    ctx.font = '12px Arial';

    ctx.beginPath();
    ctx.moveTo(0, cy); ctx.lineTo(canvas.width, cy);
    ctx.moveTo(cx, 0); ctx.lineTo(cx, canvas.height);
    ctx.stroke();

    for (let i = -AXIS_LIMIT; i <= AXIS_LIMIT; i += 0.5) {
        if (i === 0) continue;
        let px = cx + i * UNIT_SIZE;
        let py = cy - i * UNIT_SIZE;

        ctx.beginPath();
        if (i % 1 == 0) {
            ctx.moveTo(px, cy - 5); ctx.lineTo(px, cy + 5);
            ctx.moveTo(cx - 5, py); ctx.lineTo(cx + 5, py);
        } else {
            ctx.moveTo(px, cy - 3); ctx.lineTo(px, cy + 3);
            ctx.moveTo(cx - 3, py); ctx.lineTo(cx + 3, py);
        }
        ctx.stroke();

        let label = rValue === null ?
            (i === 5 ? "R" : i === 2.5 ? "R/2" : i === -2.5 ? "-R/2" : i === -5 ? "-R" : "") : i % 1 == 0 ? i : "";

        if (label) {
            ctx.fillText(label, px - 5, cy + 18);
            ctx.fillText(label, cx + 8, py + 4);
        }
    }
}

function drawPoint(x, y, isHit) {
    const { px, py } = toPixel({ x, y });
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fillStyle = isHit ? '#00ff00' : '#ff0000';
    ctx.fill();
    ctx.stroke();
}

function drawHandles() {
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#1a1a1a';
    for (const group of ['rect', 'tri', 'arc']) {
        vertices[group].forEach(pt => {
            const { px, py } = toPixel(pt);
            ctx.beginPath();
            ctx.arc(px, py, HANDLE_RADIUS, 0, Math.PI * 2);
            ctx.fillStyle = '#6e6e6e';
            ctx.fill();
            ctx.stroke();
        });
    }
}


function pointInPolygon(x, y, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i].x, yi = poly[i].y;
        const xj = poly[j].x, yj = poly[j].y;
        const intersect = ((yi > y) !== (yj > y)) &&
            (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function pointInAnyShape(x, y) {
    return pointInPolygon(x, y, vertices.rect) ||
        pointInPolygon(x, y, vertices.tri) ||
        pointInPolygon(x, y, vertices.arc);
}

function getCanvasPoint(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        px: (e.clientX - rect.left) * scaleX,
        py: (e.clientY - rect.top) * scaleY
    };
}

function pixelToCartesian(px, py) {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    return { x: (px - cx) / UNIT_SIZE, y: (cy - py) / UNIT_SIZE };
}

function findHandleAt(px, py) {
    for (const group of ['rect', 'tri', 'arc']) {
        for (let i = 0; i < vertices[group].length; i++) {
            const { px: hx, py: hy } = toPixel(vertices[group][i]);
            const dist = Math.hypot(px - hx, py - hy);
            if (dist <= HANDLE_HIT_RADIUS) return { group, index: i };
        }
    }
    return null;
}

function setupCanvasDragging() {
    canvas.addEventListener('mousedown', (e) => {
        const { px, py } = getCanvasPoint(e);
        const target = findHandleAt(px, py);
        if (target) {
            isDragging = true;
            dragTarget = target;
            canvas.style.cursor = 'grabbing';
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        const { px, py } = getCanvasPoint(e);

        if (isDragging && dragTarget) {
            const { x, y } = pixelToCartesian(px, py);
            vertices[dragTarget.group][dragTarget.index] = { x, y };
            shapeModified = true;
            redraw();
            return;
        }

        canvas.style.cursor = findHandleAt(px, py) ? 'grab' : 'default';
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
        dragTarget = null;
        canvas.style.cursor = 'default';
    });
}

init();