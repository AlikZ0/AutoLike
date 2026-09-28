import { getConfig, saveConfigOverrides, resetConfig, diffFromDefaults } from '../background/config.js';

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
  const diff = diffFromDefaults(parsed) || {};
  await saveConfigOverrides(diff);
  const changed = Object.keys(diff).length;
  say(changed ? 'Сохранено (только изменённые параметры). Применится со следующего шага.' : 'Совпадает со значениями по умолчанию.');
});

document.getElementById('reset').addEventListener('click', async () => {
  await resetConfig();
  await load();
  say('Настройки сброшены.');
});

load();
