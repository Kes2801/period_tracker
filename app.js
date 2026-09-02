const STORAGE_KEY = 'period_tracker_logs';
let currentDate = new Date();

// DOM Elements
const form = document.getElementById('tracker-form');
const startDateInput = document.getElementById('start-date');
const periodLengthInput = document.getElementById('period-length');
const cycleLengthInput = document.getElementById('cycle-length');
const predNextEl = document.getElementById('pred-next');
const predOvulationEl = document.getElementById('pred-ovulation');
const avgCycleEl = document.getElementById('avg-cycle');
const avgPeriodEl = document.getElementById('avg-period');
const avgCycleSub = document.getElementById('avg-cycle-sub');
const avgPeriodSub = document.getElementById('avg-period-sub');
const historyBody = document.getElementById('history-body');
const calendarGrid = document.getElementById('calendar-grid');
const calendarTitle = document.getElementById('calendar-title');

function getLogs() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
}

function saveLogs(logs) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
}

function toISOKey(date) {
    const d = new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function addDays(dateStr, days) {
    const parts = dateStr.split('-');
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    date.setDate(date.getDate() + Math.round(days));
    return toISOKey(date);
}

function calculateRollingAverages(logs, windowSize = null) {
    if (!logs || logs.length === 0) {
        return { avgCycle: 0, avgPeriod: 0, sampleSize: 0 };
    }

    const targetLogs = windowSize ? logs.slice(0, windowSize) : logs;
    const totalCycle = targetLogs.reduce((sum, log) => sum + Number(log.cycleLength), 0);
    const totalPeriod = targetLogs.reduce((sum, log) => sum + Number(log.periodLength), 0);

    return {
        avgCycle: totalCycle / targetLogs.length,
        avgPeriod: totalPeriod / targetLogs.length,
        sampleSize: targetLogs.length
    };
}

function calculateHighlightedDates(logs) {
    const periodSet = new Set();
    const predictedPeriodSet = new Set();
    const predictedOvulationSet = new Set();

    if (logs.length === 0) return { periodSet, predictedPeriodSet, predictedOvulationSet };

    logs.forEach(log => {
        for (let i = 0; i < log.periodLength; i++) {
            periodSet.add(addDays(log.startDate, i));
        }
    });

    const sortedDesc = [...logs].sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
    const latest = sortedDesc[0];
    const { avgCycle, avgPeriod } = calculateRollingAverages(logs);

    let currentCycleStart = latest.startDate;

    for (let cycle = 0; cycle < 4; cycle++) {
        const nextStart = addDays(currentCycleStart, avgCycle);
        const ovulationDay = addDays(nextStart, -14);

        predictedOvulationSet.add(ovulationDay);

        for (let i = 0; i < Math.round(avgPeriod); i++) {
            predictedPeriodSet.add(addDays(nextStart, i));
        }

        currentCycleStart = nextStart;
    }

    return { periodSet, predictedPeriodSet, predictedOvulationSet };
}

function renderCalendar(logs) {
    calendarGrid.innerHTML = '';

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    calendarTitle.textContent = new Date(year, month).toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric'
    });

    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    daysOfWeek.forEach(day => {
        const el = document.createElement('div');
        el.className = 'day-header';
        el.textContent = day;
        calendarGrid.appendChild(el);
    });

    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    const { periodSet, predictedPeriodSet, predictedOvulationSet } = calculateHighlightedDates(logs);
    const todayStr = toISOKey(new Date());

    for (let i = 0; i < firstDayIndex; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'day-cell empty';
        calendarGrid.appendChild(emptyCell);
    }

    for (let day = 1; day <= totalDays; day++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'day-cell';
        dayCell.textContent = day;

        const dateStr = toISOKey(new Date(year, month, day));

        if (dateStr === todayStr) dayCell.classList.add('today');

        if (periodSet.has(dateStr)) {
            dayCell.classList.add('period');
        } else if (predictedPeriodSet.has(dateStr)) {
            dayCell.classList.add('predicted-period');
        } else if (predictedOvulationSet.has(dateStr)) {
            dayCell.classList.add('predicted-ovulation');
        }

        calendarGrid.appendChild(dayCell);
    }
}

function render() {
    const logs = getLogs();

    logs.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));

    historyBody.innerHTML = '';
    logs.forEach((log, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${formatDate(log.startDate)}</td>
            <td>${log.periodLength} days</td>
            <td>${log.cycleLength} days</td>
            <td><button class="btn-delete" onclick="deleteLog(${index})">✕</button></td>
        `;
        historyBody.appendChild(tr);
    });

    const { avgCycle, avgPeriod, sampleSize } = calculateRollingAverages(logs);

    if (sampleSize > 0) {
        const latest = logs[0];
        const nextStartStr = addDays(latest.startDate, avgCycle);
        const ovulationStr = addDays(nextStartStr, -14);

        predNextEl.textContent = formatDate(nextStartStr);
        predOvulationEl.textContent = formatDate(ovulationStr);

        avgCycleEl.textContent = `${avgCycle.toFixed(1)} days`;
        avgPeriodEl.textContent = `${avgPeriod.toFixed(1)} days`;
        avgCycleSub.textContent = `average of ${sampleSize} ${sampleSize === 1 ? 'entry' : 'entries'}`;
        avgPeriodSub.textContent = `average of ${sampleSize} ${sampleSize === 1 ? 'entry' : 'entries'}`;
    } else {
        predNextEl.textContent = '-';
        predOvulationEl.textContent = '-';
        avgCycleEl.textContent = '-';
        avgPeriodEl.textContent = '-';
        avgCycleSub.textContent = 'based on 0 entries';
        avgPeriodSub.textContent = 'based on 0 entries';
    }

    renderCalendar(logs);
}

form.addEventListener('submit', (e) => {
    e.preventDefault();

    const newLog = {
        startDate: startDateInput.value,
        periodLength: parseInt(periodLengthInput.value),
        cycleLength: parseInt(cycleLengthInput.value)
    };

    const logs = getLogs();
    logs.push(newLog);
    saveLogs(logs);

    startDateInput.value = '';
    periodLengthInput.value = '';
    cycleLengthInput.value = '';
    render();
});

window.deleteLog = function(index) {
    const logs = getLogs();
    logs.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
    logs.splice(index, 1);
    saveLogs(logs);
    render();
};

document.getElementById('prev-month').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    render();
});

document.getElementById('next-month').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    render();
});

render();