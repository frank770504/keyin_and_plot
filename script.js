const addPointButton = document.getElementById('add-point');
const xInput = document.getElementById('x-input');
const yInput = document.getElementById('y-input');
const ctx = document.getElementById('myChart').getContext('2d');

const chart = new Chart(ctx, {
    type: 'scatter',
    data: {
        datasets: [{
            label: 'My Data',
            data: [],
            backgroundColor: 'rgba(255, 99, 132, 0.2)',
            borderColor: 'rgba(255, 99, 132, 1)',
            borderWidth: 1
        }]
    },
    options: {
        scales: {
            x: {
                type: 'linear',
                position: 'bottom'
            }
        }
    }
});

addPointButton.addEventListener('click', () => {
    const x = xInput.value;
    const y = yInput.value;

    if (x && y) {
        chart.data.datasets[0].data.push({x, y});
        chart.update();
        xInput.value = '';
        yInput.value = '';
    }
});
