import { getConfig, saveConfigOverrides, resetConfig } from '../background/config.js';

const area = document.getElementById('json');
const msg = document.getElementById('msg');

function say(text, isError = false) {
  msg.textContent = text;
  msg.classList.toggle('err', isError);
}

async function load() {
  area.value = JSON.stringify(await getConfig(), null, 2);
}

document.getElementById('save').addEventListener('click', async () => {
  let parsed;
  try {
    parsed = JSON.parse(area.value);
  } catch (e) {
    say(`Ошибка JSON: ${e.message}`, true);
    return;
  }
  const attempts = Number(parsed.maxAttempts);
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 10) {
    say('maxAttempts должен быть целым числом от 1 до 10', true);
    return;
  }
  await saveConfigOverrides(parsed);
  say('Сохранено. Изменения применятся со следующего шага.');
});

document.getElementById('reset').addEventListener('click', async () => {
  await resetConfig();
  await load();
  say('Настройки сброшены.');
});

load();
