import {
  supabase,
  isConfigured
} from "/js/supabaseClient.js";


import {
  $,
  $$,
  showToast,
  setButtonLoading,
  showSetupWarning,
  getSession,
  getProfile
} from "/js/common.js";


const tabs =
  $$(".auth-tab");


const loginForm =
  $("#loginForm");


const signupForm =
  $("#signupForm");


const resetForm =
  $("#resetForm");


const newPasswordForm =
  $("#newPasswordForm");


const authTabs =
  $("#authTabs");


const authTitle =
  $("#authTitle");


const authSubtitle =
  $("#authSubtitle");


if (
  !isConfigured
) {
  showSetupWarning();
}


function safeRedirectTarget() {

  const params =
    new URLSearchParams(
      location.search
    );


  const target =
    params.get(
      "redirect"
    );


  if (!target) {
    return null;
  }


  if (
    !target.startsWith("/") ||
    target.startsWith("//")
  ) {
    return null;
  }


  return target;
}


function showMode(mode) {

  [
    loginForm,
    signupForm,
    resetForm,
    newPasswordForm
  ]
  .forEach(
    form => {

      if (form) {
        form.hidden =
          true;
      }

    }
  );


  tabs.forEach(
    tab =>
      tab.classList.toggle(
        "active",
        tab.dataset.tab ===
          mode
      )
  );


  if (
    mode === "login"
  ) {

    authTabs.hidden =
      false;

    loginForm.hidden =
      false;

    authTitle.textContent =
      "Bem-vindo";

    authSubtitle.textContent =
      "Entre na sua conta para continuar.";
  }


  if (
    mode === "signup"
  ) {

    authTabs.hidden =
      false;

    signupForm.hidden =
      false;

    authTitle.textContent =
      "Criar conta";

    authSubtitle.textContent =
      "Cadastre-se para salvar seus dados e acompanhar pedidos.";
  }


  if (
    mode === "reset"
  ) {

    authTabs.hidden =
      true;

    resetForm.hidden =
      false;

    authTitle.textContent =
      "Recuperar senha";

    authSubtitle.textContent =
      "Enviaremos um link seguro para seu e-mail.";
  }


  if (
    mode ===
    "new-password"
  ) {

    authTabs.hidden =
      true;

    newPasswordForm.hidden =
      false;

    authTitle.textContent =
      "Nova senha";

    authSubtitle.textContent =
      "Defina uma nova senha para sua conta.";
  }
}


async function redirectAfterLogin(
  user
) {

  const profile =
    await getProfile(
      user.id
    )
    .catch(
      () => null
    );


  const requested =
    safeRedirectTarget();


  if (
    requested ===
    "/admin.html"
  ) {

    if (
      profile?.role ===
      "admin"
    ) {

      location.replace(
        "/admin.html"
      );

    } else {

      showToast(
        "Esta conta não tem permissão de administrador.",
        "error"
      );


      setTimeout(
        () =>
          location.replace(
            "/account.html"
          ),
        700
      );
    }


    return;
  }


  if (requested) {

    location.replace(
      requested
    );

    return;
  }


  location.replace(
    profile?.role ===
      "admin"

      ? "/admin.html"

      : "/account.html"
  );
}


tabs.forEach(
  tab => {

    tab.addEventListener(
      "click",
      () =>
        showMode(
          tab.dataset.tab
        )
    );

  }
);


$("#forgotButton")
  ?.addEventListener(
    "click",
    () =>
      showMode(
        "reset"
      )
  );


$$(
  "[data-back-login]"
)
.forEach(
  button => {

    button.addEventListener(
      "click",
      () =>
        showMode(
          "login"
        )
    );

  }
);


$$(
  "[data-toggle-password]"
)
.forEach(
  button => {

    button.addEventListener(
      "click",
      () => {

        const input =
          document.getElementById(
            button.dataset
              .togglePassword
          );


        if (!input) {
          return;
        }


        const showing =
          input.type ===
          "text";


        input.type =
          showing

            ? "password"

            : "text";


        button.textContent =
          showing

            ? "Mostrar"

            : "Ocultar";
      }
    );

  }
);


loginForm
  ?.addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      if (!supabase) {

        showSetupWarning();

        return;
      }


      const button =
        $("#loginButton");


      setButtonLoading(
        button,
        true,
        "Entrando..."
      );


      try {

        const email =
          $("#loginEmail")
            .value
            .trim();


        const password =
          $("#loginPassword")
            .value;


        const {
          data,
          error
        } =
          await supabase.auth
            .signInWithPassword(
              {
                email,
                password
              }
            );


        if (error) {
          throw error;
        }


        if (!data.user) {

          throw new Error(
            "Não foi possível autenticar sua conta."
          );
        }


        showToast(
          "Login realizado com sucesso.",
          "success"
        );


        await redirectAfterLogin(
          data.user
        );


      } catch (error) {

        const raw =
          String(
            error?.message ||
            ""
          );


        if (
          raw
            .toLowerCase()
            .includes(
              "email not confirmed"
            )
        ) {

          showToast(
            "Confirme seu e-mail antes de entrar.",
            "error"
          );

        } else if (
          raw
            .toLowerCase()
            .includes(
              "invalid login"
            )
        ) {

          showToast(
            "E-mail ou senha incorretos.",
            "error"
          );

        } else {

          showToast(
            raw ||
            "Não foi possível entrar.",
            "error"
          );
        }


      } finally {

        setButtonLoading(
          button,
          false
        );
      }

    }
  );


signupForm
  ?.addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      if (!supabase) {

        showSetupWarning();

        return;
      }


      const button =
        $("#signupButton");


      setButtonLoading(
        button,
        true,
        "Criando conta..."
      );


      try {

        const fullName =
          $("#signupName")
            .value
            .trim();


        const email =
          $("#signupEmail")
            .value
            .trim();


        const password =
          $("#signupPassword")
            .value;


        const confirmPassword =
          $("#signupPasswordConfirm")
            .value;


        if (
          password.length <
          8
        ) {

          throw new Error(
            "A senha precisa ter pelo menos 8 caracteres."
          );
        }


        if (
          password !==
          confirmPassword
        ) {

          throw new Error(
            "As senhas não são iguais."
          );
        }


        const {
          data,
          error
        } =
          await supabase.auth
            .signUp(
              {
                email,
                password,

                options: {

                  data: {
                    full_name:
                      fullName
                  },

                  emailRedirectTo:
                    `${location.origin}/login.html`
                }
              }
            );


        if (error) {
          throw error;
        }


        if (
          data.session &&
          data.user
        ) {

          showToast(
            "Conta criada com sucesso.",
            "success"
          );


          await redirectAfterLogin(
            data.user
          );


          return;
        }


        showToast(
          "Conta criada. Confira seu e-mail para confirmar o cadastro.",
          "success"
        );


        showMode(
          "login"
        );


        $("#loginEmail").value =
          email;


      } catch (error) {

        showToast(
          error?.message ||
          "Não foi possível criar a conta.",
          "error"
        );


      } finally {

        setButtonLoading(
          button,
          false
        );
      }

    }
  );


resetForm
  ?.addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      if (!supabase) {

        showSetupWarning();

        return;
      }


      const button =
        $("#resetButton");


      setButtonLoading(
        button,
        true,
        "Enviando..."
      );


      try {

        const email =
          $("#resetEmail")
            .value
            .trim();


        const {
          error
        } =
          await supabase.auth
            .resetPasswordForEmail(
              email,
              {
                redirectTo:
                  `${location.origin}/login.html`
              }
            );


        if (error) {
          throw error;
        }


        showToast(
          "Se o e-mail estiver cadastrado, você receberá o link de recuperação.",
          "success"
        );


        showMode(
          "login"
        );


      } catch (error) {

        showToast(
          error?.message ||
          "Não foi possível enviar a recuperação.",
          "error"
        );


      } finally {

        setButtonLoading(
          button,
          false
        );
      }

    }
  );


newPasswordForm
  ?.addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      if (!supabase) {

        showSetupWarning();

        return;
      }


      const button =
        $("#newPasswordButton");


      setButtonLoading(
        button,
        true,
        "Salvando..."
      );


      try {

        const password =
          $("#newPassword")
            .value;


        if (
          password.length <
          8
        ) {

          throw new Error(
            "A senha precisa ter pelo menos 8 caracteres."
          );
        }


        const {
          error
        } =
          await supabase.auth
            .updateUser(
              {
                password
              }
            );


        if (error) {
          throw error;
        }


        showToast(
          "Senha alterada com sucesso.",
          "success"
        );


        setTimeout(
          () =>
            location.replace(
              "/account.html"
            ),
          700
        );


      } catch (error) {

        showToast(
          error?.message ||
          "Não foi possível alterar a senha.",
          "error"
        );


      } finally {

        setButtonLoading(
          button,
          false
        );
      }

    }
  );


if (supabase) {

  supabase.auth
    .onAuthStateChange(
      event => {

        if (
          event ===
          "PASSWORD_RECOVERY"
        ) {

          showMode(
            "new-password"
          );
        }

      }
    );


  const recoveryInUrl =
    location.hash
      .includes(
        "type=recovery"
      ) ||

    location.search
      .includes(
        "type=recovery"
      );


  if (
    recoveryInUrl
  ) {

    showMode(
      "new-password"
    );

  } else {

    getSession()

      .then(
        async session => {

          if (
            session &&
            safeRedirectTarget()
          ) {

            await redirectAfterLogin(
              session.user
            );
          }

        }
      )

      .catch(
        () => {}
      );
  }
}