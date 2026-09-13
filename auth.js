import { supabase, isConfigured } from "./supabaseClient.js";
import { $, $$, showToast, setButtonLoading, showSetupWarning, getSession, getProfile } from "./common.js";

if (!isConfigured) showSetupWarning();

const tabs = $$(".auth-tab");
const loginForm = $("#loginForm");
const signupForm = $("#signupForm");
const resetRequestForm = $("#resetRequestForm");
const newPasswordForm = $("#newPasswordForm");
const authTabs = $("#authTabs");
const authTitle = $("#authTitle");
const authSubtitle = $("#authSubtitle");

function redirectTarget() {
  const params = new URLSearchParams(location.search);
  const target = params.get("redirect");
  return target && target.startsWith("/") && !target.startsWith("//") ? target : "/conta";
}

function showMode(mode) {
  [loginForm, signupForm, resetRequestForm, newPasswordForm].forEach((el) => el && (el.hidden = true));
  tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === mode));

  if (mode === "login") {
    authTabs.hidden = false;
    loginForm.hidden = false;
    authTitle.textContent = "Bem-vindo";
    authSubtitle.textContent = "Entre na sua conta ou crie seu cadastro.";
  } else if (mode === "signup") {
    authTabs.hidden = false;
    signupForm.hidden = false;
    authTitle.textContent = "Criar conta";
    authSubtitle.textContent = "Cadastre-se para salvar seus dados e acompanhar pedidos.";
  } else if (mode === "reset") {
    authTabs.hidden = true;
    resetRequestForm.hidden = false;
    authTitle.textContent = "Recuperar senha";
    authSubtitle.textContent = "Enviaremos um link seguro para o e-mail cadastrado.";
  } else if (mode === "new-password") {
    authTabs.hidden = true;
    newPasswordForm.hidden = false;
    authTitle.textContent = "Nova senha";
    authSubtitle.textContent = "Defina uma nova senha para sua conta.";
  }
}

tabs.forEach((tab) => tab.addEventListener("click", () => showMode(tab.dataset.tab)));
$("#forgotButton")?.addEventListener("click", () => showMode("reset"));
$$('[data-back-login]').forEach((button) => button.addEventListener("click", () => showMode("login")));

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabase) return showSetupWarning();
  const button = $("#loginButton");
  setButtonLoading(button, true, "Entrando...");
  try {
    const email = $("#loginEmail").value.trim();
    const password = $("#loginPassword").value;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    const profile = await getProfile(data.user.id).catch(() => null);
    const target = redirectTarget();
    if (target === "/admin" && profile?.role !== "admin") {
      showToast("Esta conta não possui permissão de administrador.", "error");
      return;
    }
    location.href = target;
  } catch (error) {
    showToast(error?.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : error.message, "error");
  } finally {
    setButtonLoading(button, false);
  }
});

signupForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabase) return showSetupWarning();
  const button = $("#signupButton");
  setButtonLoading(button, true, "Criando conta...");
  try {
    const fullName = $("#signupName").value.trim();
    const email = $("#signupEmail").value.trim();
    const password = $("#signupPassword").value;
    if (password.length < 8) throw new Error("A senha precisa ter pelo menos 8 caracteres.");

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) throw error;

    if (data.session) {
      showToast("Conta criada com sucesso.", "success");
      location.href = redirectTarget();
    } else {
      showToast("Conta criada. Confira seu e-mail para confirmar o cadastro.", "success");
      showMode("login");
      $("#loginEmail").value = email;
    }
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setButtonLoading(button, false);
  }
});

resetRequestForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabase) return showSetupWarning();
  const button = $("#resetRequestButton");
  setButtonLoading(button, true, "Enviando...");
  try {
    const email = $("#resetEmail").value.trim();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/login`,
    });
    if (error) throw error;
    showToast("Se o e-mail estiver cadastrado, você receberá o link de recuperação.", "success");
    showMode("login");
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setButtonLoading(button, false);
  }
});

newPasswordForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabase) return showSetupWarning();
  const button = $("#newPasswordButton");
  setButtonLoading(button, true, "Salvando...");
  try {
    const password = $("#newPassword").value;
    if (password.length < 8) throw new Error("A senha precisa ter pelo menos 8 caracteres.");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    showToast("Senha alterada com sucesso.", "success");
    setTimeout(() => (location.href = "/conta"), 700);
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setButtonLoading(button, false);
  }
});

if (supabase) {
  supabase.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") showMode("new-password");
  });

  const recoveryInUrl = location.hash.includes("type=recovery") || location.search.includes("type=recovery");
  if (recoveryInUrl) {
    showMode("new-password");
  } else {
    getSession().then((session) => {
      const params = new URLSearchParams(location.search);
      if (session && params.get("redirect")) location.href = redirectTarget();
    }).catch(() => {});
  }
}
