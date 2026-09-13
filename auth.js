import { supabase, isConfigured } from "./supabaseClient.js";

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const resetForm = document.getElementById("resetForm");

const loginButton = document.getElementById("loginButton");
const registerButton = document.getElementById("registerButton");
const resetButton = document.getElementById("resetButton");

const authMessage = document.getElementById("authMessage");

function showMessage(message, type = "error") {
  if (!authMessage) return;

  authMessage.textContent = message;
  authMessage.className = `message show ${type}`;
}

function clearMessage() {
  if (!authMessage) return;

  authMessage.textContent = "";
  authMessage.className = "message";
}

function getRedirectPath() {
  const params = new URLSearchParams(window.location.search);

  const redirect = params.get("redirect");

  if (
    redirect &&
    redirect.startsWith("/") &&
    !redirect.startsWith("//")
  ) {
    return redirect;
  }

  return "/";
}

async function redirectAfterLogin(user) {
  try {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (error) {
      console.error("Erro ao buscar perfil:", error);
    }

    const requestedRedirect = getRedirectPath();

    if (requestedRedirect === "/admin") {
      if (profile?.role === "admin") {
        window.location.replace("/admin");
        return;
      }

      window.location.replace("/");
      return;
    }

    if (profile?.role === "admin") {
      window.location.replace("/admin");
      return;
    }

    window.location.replace("/");

  } catch (error) {
    console.error(error);
    window.location.replace("/");
  }
}

async function checkExistingSession() {
  if (!isConfigured || !supabase) {
    showMessage(
      "Supabase ainda não foi configurado no site.",
      "error"
    );
    return;
  }

  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (session?.user) {
    await redirectAfterLogin(session.user);
  }
}

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  clearMessage();

  const email =
    document
      .getElementById("loginEmail")
      .value
      .trim();

  const password =
    document
      .getElementById("loginPassword")
      .value;

  if (!email || !password) {
    showMessage(
      "Preencha seu e-mail e senha."
    );
    return;
  }

  loginButton.disabled = true;
  loginButton.textContent = "Entrando...";

  try {
    const {
      data,
      error
    } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      throw error;
    }

    if (!data.user) {
      throw new Error(
        "Não foi possível entrar na sua conta."
      );
    }

    showMessage(
      "Login realizado com sucesso.",
      "success"
    );

    await redirectAfterLogin(data.user);

  } catch (error) {
    console.error(error);

    let message = "Não foi possível entrar.";

    if (
      error.message
        ?.toLowerCase()
        .includes("invalid login")
    ) {
      message = "E-mail ou senha incorretos.";
    }

    if (
      error.message
        ?.toLowerCase()
        .includes("email not confirmed")
    ) {
      message =
        "Confirme seu e-mail antes de entrar.";
    }

    showMessage(message, "error");

  } finally {
    loginButton.disabled = false;
    loginButton.textContent = "Entrar";
  }
});


registerForm?.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();

    clearMessage();

    const name =
      document
        .getElementById("registerName")
        .value
        .trim();

    const email =
      document
        .getElementById("registerEmail")
        .value
        .trim();

    const password =
      document
        .getElementById("registerPassword")
        .value;

    const confirmPassword =
      document
        .getElementById("registerPasswordConfirm")
        .value;

    if (
      !name ||
      !email ||
      !password ||
      !confirmPassword
    ) {
      showMessage(
        "Preencha todos os campos."
      );
      return;
    }

    if (password.length < 6) {
      showMessage(
        "A senha precisa ter pelo menos 6 caracteres."
      );
      return;
    }

    if (password !== confirmPassword) {
      showMessage(
        "As senhas não são iguais."
      );
      return;
    }

    registerButton.disabled = true;
    registerButton.textContent =
      "Criando conta...";

    try {
      const {
        data,
        error
      } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name
          },
          emailRedirectTo:
            `${window.location.origin}/login`
        }
      });

      if (error) {
        throw error;
      }

      if (data.session && data.user) {
        showMessage(
          "Conta criada com sucesso.",
          "success"
        );

        await redirectAfterLogin(data.user);
        return;
      }

      showMessage(
        "Conta criada. Verifique seu e-mail para confirmar o cadastro.",
        "success"
      );

    } catch (error) {
      console.error(error);

      let message =
        "Não foi possível criar sua conta.";

      if (
        error.message
          ?.toLowerCase()
          .includes("already registered")
      ) {
        message =
          "Esse e-mail já está cadastrado.";
      }

      showMessage(message, "error");

    } finally {
      registerButton.disabled = false;
      registerButton.textContent =
        "Criar minha conta";
    }

  }
);


resetForm?.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();

    clearMessage();

    const email =
      document
        .getElementById("resetEmail")
        .value
        .trim();

    if (!email) {
      showMessage(
        "Digite seu e-mail."
      );
      return;
    }

    resetButton.disabled = true;
    resetButton.textContent =
      "Enviando...";

    try {
      const { error } =
        await supabase.auth
          .resetPasswordForEmail(
            email,
            {
              redirectTo:
                `${window.location.origin}/login`
            }
          );

      if (error) {
        throw error;
      }

      showMessage(
        "Enviamos as instruções para seu e-mail.",
        "success"
      );

    } catch (error) {
      console.error(error);

      showMessage(
        "Não foi possível enviar a recuperação.",
        "error"
      );

    } finally {
      resetButton.disabled = false;
      resetButton.textContent =
        "Enviar recuperação";
    }

  }
);


if (isConfigured && supabase) {
  supabase.auth.onAuthStateChange(
    async (event, session) => {

      if (
        event === "SIGNED_IN" &&
        session?.user
      ) {
        await redirectAfterLogin(
          session.user
        );
      }

    }
  );
}

checkExistingSession();