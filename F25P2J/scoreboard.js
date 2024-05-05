window.addEventListener('load', (event) => {
  const parent = document.getElementById('scores');

  const scores = JSON.parse(localStorage.getItem('scores') || '[]');
  console.log({ scores });
  scores.sort((a, b) => b.score - a.score);
  for (let i = 0; i < Math.min(scores.length, 10); i++) {
    const row = document.createElement('tr');
    const CLASSLIST = 'px-4 py-3 font-medium text-gray-900 dark:text-gray-50';
    row.innerHTML += `<td class="${CLASSLIST}">${i + 1}</td>`;
    const time = new Date(scores[i].date);
    row.innerHTML += `<td class="${CLASSLIST}">${time.toLocaleDateString() + ' ' + time.toLocaleDateString()}</td>`;
    row.innerHTML += `<td class="${CLASSLIST}">${scores[i].score}</td>`;
    parent.appendChild(row);
  }
});
