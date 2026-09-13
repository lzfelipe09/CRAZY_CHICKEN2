import {
  supabase,
  isConfigured
} from "/js/supabaseClient.js";

const loginForm =
  document.getElementById("loginForm");

const registerForm =
  document.getElementById("registerForm");

const resetForm =
  document.getElementById("resetForm");

const loginButton =
  document.getElementById("loginButton");

const registerButton =
  document.getElementById("registerButton");

const resetButton =
  document.getElementById("resetButton");

const authMessage =
  document.getElementById("authMessage");


function showMessage(
  message,
  type = "error"
) {
  if (!authMessage) return;

  authMessage.textContent = message;

  authMessage.className =
    `message show ${type}`;
}


function clearMessage() {
  if (!authMessage) return;

  authMessage.textContent = "";
  authMessage.className = "message";
}


function getRedirectPath() {
  const params =
    new URLSearchParams(
      window.location.search
    );

  const redirect =
    params.get("redirect");

  if (
    redirect &&
    redirect.startsWith("/") &&
    !redirect.startsWith("//")
  ) {
    return redirect;
  }

  return "/";
}


async function redirectUser(user) {

  const {
    data: profile,
    error
  } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error(
      "Erro ao carregar perfil:",
      error
    );
  }

  const wanted =
    getRedirectPath();

  if (
    wanted === "/admin" &&
    profile?.role === "admin"
  ) {
    window.location.replace("/admin");
    return;
  }

  if (profile?.role === "admin") {
    window.location.replace("/admin");
    return;
  }

  window.location.replace("/");
}


loginForm?.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();

    clearMessage();

    if (!isConfigured || !supabase) {
      showMessage(
        "Supabase não configurado."
      );
      return;
    }

    const email =
      document
        .getElementById("loginEmail")
        .value
        .trim();

    const password =
      document
        .getElementById("loginPassword")
        .value;

    loginButton.disabled = true;
    loginButton.textContent =
      "Entrando...";

    try {

      const {
        data,
        error
      } =
        await supabase.auth
          .signInWithPassword({
            email,
            password
          });

      if (error) throw error;

      if (!data.user) {
        throw new Error(
          "Usuário não encontrado."
        );
      }

      showMessage(
        "Login realizado!",
        "success"
      );

      await redirectUser(
        data.user
      );

    } catch (error) {

      console.error(error);

      if (
        error.message
          ?.toLowerCase()
          .includes(
            "email not confirmed"
          )
      ) {
        showMessage(
          "Confirme seu e-mail antes de entrar."
        );
      } else {
        showMessage(
          "E-mail ou senha incorretos."
        );
      }

    } finally {

      loginButton.disabled = false;
      loginButton.textContent =
        "Entrar";
    }

  }
);


registerForm?.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();

    clearMessage();

    const name =
      document
        .getElementById(
          "registerName"
        )
        .value
        .trim();

    const email =
      document
        .getElementById(
          "registerEmail"
        )
        .value
        .trim();

    const password =
      document
        .getElementById(
          "registerPassword"
        )
        .value;

    const confirmation =
      document
        .getElementById(
          "registerPasswordConfirm"
        )
        .value;

    if (password !== confirmation) {
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
      } =
        await supabase.auth.signUp({
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

      if (error) throw error;

      if (
        data.session &&
        data.user
      ) {
        await redirectUser(
          data.user
        );

        return;
      }

      showMessage(
        "Conta criada. Verifique seu e-mail para confirmar o cadastro.",
        "success"
      );

    } catch (error) {

      console.error(error);

      showMessage(
        error.message ||
        "Não foi possível criar a conta."
      );

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

    const email =
      document
        .getElementById("resetEmail")
        .value
        .trim();

    resetButton.disabled = true;

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

      if (error) throw error;

      showMessage(
        "Confira seu e-mail para recuperar sua senha.",
        "success"
      );

    } catch (error) {

      showMessage(
        "Não foi possível enviar a recuperação."
      );

    } finally {

      resetButton.disabled = false;
    }

  }
);