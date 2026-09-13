import { supabase, isConfigured } from "./supabaseClient.js";

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export function formatBRL(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function escapeHTML(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function onlyDigits(value = "") {
  return String(value).replace(/\D/g, "");
}

export function formatCEP(value = "") {
  const digits = onlyDigits(value).slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function showToast(message, type = "info") {
  let root = $("#toastRoot");
  if (!root) {
    root = document.createElement("div");
    root.id = "toastRoot";
    root.className = "toast-root";
    document.body.appendChild(root);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  root.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 250);
  }, 3600);
}

export function setButtonLoading(button, loading, text = "Processando...") {
  if (!button) return;
  if (loading) {
    button.dataset.originalText = button.textContent;
    button.disabled = true;
    button.textContent = text;
  } else {
    button.disabled = false;
    button.textContent = button.dataset.originalText || button.textContent;
  }
}

export function showSetupWarning(target = document.body) {
  if (isConfigured || $("#setupWarning")) return;
  const warning = document.createElement("div");
  warning.id = "setupWarning";
  warning.className = "setup-warning";
  warning.innerHTML = `
    <strong>Configuração necessária</strong>
    <span>Conecte o projeto ao Supabase editando <code>js/config.js</code>. O passo a passo está no README.</span>
  `;
  target.prepend(warning);
}

export async function getSession() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function getProfile(userId) {
  if (!supabase || !userId) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data;
}

export async function requireAuth(redirect = "/login") {
  if (!isConfigured) {
    showSetupWarning();
    return null;
  }
  const session = await getSession();
  if (!session) {
    const returnTo = `${location.pathname}${location.search}`;
    location.href = `${redirect}?redirect=${encodeURIComponent(returnTo)}`;
    return null;
  }
  return session;
}

export async function requireAdmin() {
  const session = await requireAuth("/login");
  if (!session) return null;

  const profile = await getProfile(session.user.id);
  if (profile?.role !== "admin") {
    location.href = "/";
    return null;
  }

  return { session, profile };
}

export async function hydrateHeaderAuth() {
  const authSlot = $("[data-auth-slot]");
  const adminLinks = $$("[data-admin-link]");
  if (!authSlot) return;

  if (!isConfigured) {
    authSlot.innerHTML = `<a class="header-link" href="/login">Entrar</a>`;
    adminLinks.forEach((link) => link.hidden = true);
    return;
  }

  try {
    const session = await getSession();
    if (!session) {
      authSlot.innerHTML = `<a class="header-link" href="/login">Entrar</a>`;
      adminLinks.forEach((link) => link.hidden = true);
      return;
    }

    authSlot.innerHTML = `<a class="header-link" href="/conta">Minha conta</a>`;
    const profile = await getProfile(session.user.id).catch(() => null);
    adminLinks.forEach((link) => link.hidden = profile?.role !== "admin");
  } catch {
    authSlot.innerHTML = `<a class="header-link" href="/login">Entrar</a>`;
  }
}

export function bindMobileMenu() {
  const trigger = $("[data-menu-trigger]");
  const menu = $("[data-mobile-menu]");
  if (!trigger || !menu) return;
  trigger.addEventListener("click", () => {
    const open = menu.classList.toggle("open");
    trigger.setAttribute("aria-expanded", String(open));
  });
  menu.addEventListener("click", (event) => {
    if (event.target.closest("a")) menu.classList.remove("open");
  });
}
