export const $ = (selector) =>
  document.querySelector(selector);

export const $$ = (selector) =>
  [...document.querySelectorAll(selector)];

export function formatBRL(value) {
  return new Intl.NumberFormat(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL"
    }
  ).format(Number(value || 0));
}

export function escapeHTML(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function showToast(
  message,
  type = "success"
) {
  const root =
    document.getElementById("toastRoot");

  if (!root) {
    console.log(message);
    return;
  }

  const toast =
    document.createElement("div");

  toast.className =
    `toast ${type}`;

  toast.textContent =
    message;

  root.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3500);
}

export function setButtonLoading(
  button,
  loading,
  text = "Carregando..."
) {
  if (!button) return;

  if (loading) {
    button.dataset.originalText =
      button.textContent;

    button.disabled = true;
    button.textContent = text;
  } else {
    button.disabled = false;

    button.textContent =
      button.dataset.originalText ||
      button.textContent;
  }
}