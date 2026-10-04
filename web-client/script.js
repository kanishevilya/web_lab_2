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
let currentR = null;
const defaultR = 5;

function init() {
    setupRButtons();
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

    const url = `/fcgi-bin/server.jar?x=${xVal}&y=${yVal}&r=${rVal}`;

    fetch(url, { method: 'GET' })
        .then(response => {
            if (!response.ok) throw new Error('Ошибка сервера');
            return response.json();
        })
        .then(data => {
            results.push(data);
            localStorage.setItem('lab2_results', JSON.stringify(results));

            drawScene(parseFloat(data.r));
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

function drawScene(rValue) {
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const renderR = rValue !== null ? rValue : defaultR;
    drawShapes(renderR);
    drawAxes(rValue);
}
function drawShapes(r) {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    ctx.fillStyle = '#3399ff';

    ctx.fillRect(cx, cy, r * UNIT_SIZE, (r / 2) * UNIT_SIZE);

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx - r * UNIT_SIZE, cy);
    ctx.lineTo(cx, cy - (r / 2) * UNIT_SIZE);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, (r / 2) * UNIT_SIZE, Math.PI, Math.PI / 2, true);
    ctx.closePath();
    ctx.fill();
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
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const px = cx + x * UNIT_SIZE;
    const py = cy - y * UNIT_SIZE;

    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fillStyle = isHit ? '#00ff00' : '#ff0000';
    ctx.fill();
    ctx.stroke();
}

init();