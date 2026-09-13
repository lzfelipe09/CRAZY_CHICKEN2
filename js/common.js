import {
  supabase,
  isConfigured
} from "/js/supabaseClient.js";


export const $ = (
  selector,
  root = document
) => root.querySelector(selector);


export const $$ = (
  selector,
  root = document
) => [
  ...root.querySelectorAll(selector)
];


export function escapeHTML(value = "") {

  return String(value)

    .replaceAll(
      "&",
      "&amp;"
    )

    .replaceAll(
      "<",
      "&lt;"
    )

    .replaceAll(
      ">",
      "&gt;"
    )

    .replaceAll(
      '"',
      "&quot;"
    )

    .replaceAll(
      "'",
      "&#039;"
    );
}


export function formatBRL(value) {

  return Number(
    value || 0
  ).toLocaleString(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL"
    }
  );
}


export function onlyDigits(
  value = ""
) {

  return String(value)
    .replace(
      /\D/g,
      ""
    );
}


export function formatCEP(
  value = ""
) {

  const digits =
    onlyDigits(value)
      .slice(
        0,
        8
      );

  return digits.length > 5

    ? `${digits.slice(
        0,
        5
      )}-${digits.slice(5)}`

    : digits;
}


export function showToast(
  message,
  type = "info"
) {

  let root =
    $("#toastRoot");


  if (!root) {

    root =
      document.createElement(
        "div"
      );

    root.id =
      "toastRoot";

    root.className =
      "toast-root";

    document.body
      .appendChild(root);
  }


  const toast =
    document.createElement(
      "div"
    );


  toast.className =
    `toast toast-${type}`;

  toast.textContent =
    message;


  root.appendChild(
    toast
  );


  requestAnimationFrame(
    () =>
      toast.classList.add(
        "show"
      )
  );


  setTimeout(
    () => {

      toast.classList.remove(
        "show"
      );

      setTimeout(
        () => toast.remove(),
        250
      );

    },
    3500
  );
}


export function setButtonLoading(
  button,
  loading,
  loadingText = "Carregando..."
) {

  if (!button) return;


  if (loading) {

    button.dataset.originalText =
      button.textContent;

    button.disabled =
      true;

    button.textContent =
      loadingText;

  } else {

    button.disabled =
      false;

    button.textContent =
      button.dataset.originalText ||
      button.textContent;
  }
}


export function showSetupWarning() {

  if (
    $("#setupWarning")
  ) {
    return;
  }


  const el =
    document.createElement(
      "div"
    );


  el.id =
    "setupWarning";

  el.className =
    "setup-warning";


  el.innerHTML = `
    <strong>
      Supabase não configurado.
    </strong>

    Preencha
    <code>
      js/config.js
    </code>
    com a URL e a chave pública.
  `;


  document.body
    .prepend(el);
}


export async function getSession() {

  if (!supabase) {
    return null;
  }


  const {
    data,
    error
  } =
    await supabase.auth
      .getSession();


  if (error) {
    throw error;
  }


  return data.session;
}


export async function getProfile(
  userId
) {

  if (
    !supabase ||
    !userId
  ) {
    return null;
  }


  const {
    data,
    error
  } =
    await supabase

      .from(
        "profiles"
      )

      .select("*")

      .eq(
        "id",
        userId
      )

      .single();


  if (error) {
    throw error;
  }


  return data;
}


export async function requireAuth() {

  if (
    !isConfigured
  ) {

    showSetupWarning();

    return null;
  }


  const session =
    await getSession();


  if (!session) {

    const returnTo =
      `${location.pathname}${location.search}`;


    location.replace(
      `/login.html?redirect=${encodeURIComponent(
        returnTo
      )}`
    );


    return null;
  }


  return session;
}


export async function requireAdmin() {

  const session =
    await requireAuth();


  if (!session) {
    return null;
  }


  const profile =
    await getProfile(
      session.user.id
    );


  if (
    profile?.role !==
    "admin"
  ) {

    location.replace(
      "/index.html"
    );

    return null;
  }


  return {
    session,
    profile
  };
}


export async function hydrateHeaderAuth() {

  const slot =
    $(
      "[data-auth-slot]"
    );


  const adminLinks =
    $$(
      "[data-admin-link]"
    );


  if (!slot) {
    return;
  }


  if (
    !isConfigured
  ) {

    slot.innerHTML =
      `
        <a href="/login.html">
          Entrar
        </a>
      `;


    adminLinks.forEach(
      el =>
        el.hidden = true
    );


    return;
  }


  try {

    const session =
      await getSession();


    if (!session) {

      slot.innerHTML =
        `
          <a href="/login.html">
            Entrar
          </a>
        `;


      adminLinks.forEach(
        el =>
          el.hidden = true
      );


      return;
    }


    const profile =
      await getProfile(
        session.user.id
      )
      .catch(
        () => null
      );


    slot.innerHTML =
      `
        <a href="/account.html">
          Minha conta
        </a>
      `;


    adminLinks.forEach(
      el =>
        el.hidden =
          profile?.role !==
          "admin"
    );


  } catch {

    slot.innerHTML =
      `
        <a href="/login.html">
          Entrar
        </a>
      `;
  }
}