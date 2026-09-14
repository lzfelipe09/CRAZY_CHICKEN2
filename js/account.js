import {
  supabase,
  isConfigured
} from "/js/supabaseClient.js";

import {
  $,
  formatCEP,
  escapeHTML,
  formatBRL,
  showToast,
  setButtonLoading,
  requireAuth,
  getProfile,
  showSetupWarning
} from "/js/common.js";


/* =========================================================
   ESTADO
========================================================= */

let session = null;
let profile = null;


const STATUS_LABELS = {
  pending_whatsapp: "Aguardando confirmação",
  confirmed: "Confirmado",
  preparing: "Em preparação",
  ready: "Pronto",
  delivered: "Entregue",
  cancelled: "Cancelado"
};


/* =========================================================
   LOADING / APP
========================================================= */

function showAccount() {

  const loading =
    $("#authLoading");

  const app =
    $("#accountApp");


  if (loading) {
    loading.hidden = true;
  }


  if (app) {
    app.hidden = false;
  }

}


function hideLoading() {

  const loading =
    $("#authLoading");


  if (loading) {
    loading.hidden = true;
  }

}


/* =========================================================
   PERFIL
========================================================= */

function fillProfile() {

  if (!profile || !session) {
    return;
  }


  const name =
    $("#profileName");

  const email =
    $("#profileEmail");

  const phone =
    $("#profilePhone");

  const cep =
    $("#profileCEP");

  const street =
    $("#profileStreet");

  const number =
    $("#profileNumber");

  const complement =
    $("#profileComplement");

  const city =
    $("#profileCity");

  const state =
    $("#profileState");

  const welcomeName =
    $("#welcomeName");

  const adminLink =
    $("#adminLink");


  if (name) {
    name.value =
      profile.full_name || "";
  }


  if (email) {
    email.value =
      session.user.email || "";
  }


  if (phone) {
    phone.value =
      profile.phone || "";
  }


  if (cep) {
    cep.value =
      profile.postal_code || "";
  }


  if (street) {
    street.value =
      profile.street || "";
  }


  if (number) {
    number.value =
      profile.number || "";
  }


  if (complement) {
    complement.value =
      profile.complement || "";
  }


  if (city) {
    city.value =
      profile.city || "";
  }


  if (state) {
    state.value =
      (
        profile.state || ""
      ).toUpperCase();
  }


  if (welcomeName) {

    const firstName =
      (
        profile.full_name ||
        session.user.email ||
        "Cliente"
      )
      .split(" ")[0];


    welcomeName.textContent =
      firstName;

  }


  if (
    adminLink &&
    profile.role === "admin"
  ) {

    adminLink.hidden =
      false;

  }

}


/* =========================================================
   PEDIDOS
========================================================= */

function renderEmptyOrders() {

  const root =
    $("#ordersList");


  if (!root) {
    return;
  }


  root.innerHTML = `
    <div class="empty">

      <div>

        <div class="empty-icon">
          📦
        </div>

        <strong>
          Nenhum pedido ainda
        </strong>

        <span>
          Quando você finalizar uma compra,
          ela aparecerá aqui.
        </span>

        <a href="/index.html#produtos">
          Ver produtos
        </a>

      </div>

    </div>
  `;

}


function renderOrderError(
  message
) {

  const root =
    $("#ordersList");


  if (!root) {
    return;
  }


  root.innerHTML = `
    <div class="empty">

      <div>

        <div class="empty-icon">
          ⚠️
        </div>

        <strong>
          Não foi possível carregar os pedidos
        </strong>

        <span>
          ${escapeHTML(
            message ||
            "Tente atualizar a página."
          )}
        </span>

      </div>

    </div>
  `;

}


async function loadOrders() {

  const root =
    $("#ordersList");


  if (!root) {
    return;
  }


  root.innerHTML = `
    <div class="empty">

      <div>

        <div class="empty-icon">
          📦
        </div>

        <strong>
          Carregando pedidos...
        </strong>

        <span>
          Aguarde alguns segundos.
        </span>

      </div>

    </div>
  `;


  try {

    const {
      data,
      error
    } =
      await supabase

        .from(
          "orders"
        )

        .select(`
          id,
          order_number,
          status,
          subtotal,
          shipping_cost,
          total,
          created_at,
          order_items(
            name_snapshot,
            quantity,
            line_total
          )
        `)

        .eq(
          "user_id",
          session.user.id
        )

        .order(
          "created_at",
          {
            ascending: false
          }
        );


    if (error) {
      throw error;
    }


    if (
      !data ||
      !data.length
    ) {

      renderEmptyOrders();

      return;

    }


    root.innerHTML =
      data
        .map(
          order => {

            const statusLabel =
              STATUS_LABELS[
                order.status
              ] ||
              order.status;


            const date =
              new Date(
                order.created_at
              )
              .toLocaleString(
                "pt-BR"
              );


            const items =
              (
                order.order_items ||
                []
              )
              .map(
                item => `
                  <div>

                    <span>
                      ${
                        item.quantity
                      }x
                      ${
                        escapeHTML(
                          item.name_snapshot
                        )
                      }
                    </span>

                    <strong>
                      ${
                        formatBRL(
                          item.line_total
                        )
                      }
                    </strong>

                  </div>
                `
              )
              .join("");


            return `
              <article class="order-card">

                <div class="order-head">

                  <div>

                    <strong>
                      Pedido #${
                        escapeHTML(
                          order.order_number
                        )
                      }
                    </strong>

                    <small>
                      ${date}
                    </small>

                  </div>


                  <span class="status">
                    ${
                      escapeHTML(
                        statusLabel
                      )
                    }
                  </span>

                </div>


                <div class="order-items">

                  ${
                    items ||
                    `
                      <div>
                        <span>
                          Pedido sem itens disponíveis.
                        </span>
                      </div>
                    `
                  }

                </div>


                <div class="order-total">

                  Total:

                  <strong>
                    ${
                      formatBRL(
                        order.total
                      )
                    }
                  </strong>

                </div>

              </article>
            `;

          }
        )
        .join("");


  } catch (error) {

    console.error(
      "Erro ao carregar pedidos:",
      error
    );


    renderOrderError(
      error?.message
    );

  }

}


/* =========================================================
   SALVAR PERFIL
========================================================= */

async function saveProfile(
  event
) {

  event.preventDefault();


  const button =
    $("#saveProfileButton");


  setButtonLoading(
    button,
    true,
    "Salvando..."
  );


  try {

    const fullName =
      $("#profileName")
        ?.value
        .trim() || "";


    const phone =
      $("#profilePhone")
        ?.value
        .trim() || "";


    const postalCode =
      formatCEP(
        $("#profileCEP")
          ?.value || ""
      );


    const street =
      $("#profileStreet")
        ?.value
        .trim() || "";


    const number =
      $("#profileNumber")
        ?.value
        .trim() || "";


    const complement =
      $("#profileComplement")
        ?.value
        .trim() || null;


    const city =
      $("#profileCity")
        ?.value
        .trim() || "";


    const state =
      $("#profileState")
        ?.value
        .trim()
        .toUpperCase()
        .replace(
          /[^A-Z]/g,
          ""
        )
        .slice(
          0,
          2
        ) || "";


    if (!fullName) {
      throw new Error(
        "Informe seu nome completo."
      );
    }


    if (!phone) {
      throw new Error(
        "Informe seu telefone."
      );
    }


    if (
      postalCode
        .replace(/\D/g, "")
        .length !== 8
    ) {

      throw new Error(
        "Informe um CEP válido."
      );

    }


    if (!street) {
      throw new Error(
        "Informe sua rua ou avenida."
      );
    }


    if (!number) {
      throw new Error(
        "Informe o número do endereço."
      );
    }


    if (!city) {
      throw new Error(
        "Informe sua cidade."
      );
    }


    if (
      state.length !== 2
    ) {

      throw new Error(
        "Informe a sigla do estado."
      );

    }


    const payload = {

      full_name:
        fullName,

      phone:
        phone,

      postal_code:
        postalCode,

      street:
        street,

      number:
        number,

      complement:
        complement,

      city:
        city,

      state:
        state

    };


    const {
      data,
      error
    } =
      await supabase

        .from(
          "profiles"
        )

        .update(
          payload
        )

        .eq(
          "id",
          session.user.id
        )

        .select()
        .single();


    if (error) {
      throw error;
    }


    profile =
      data || {
        ...profile,
        ...payload
      };


    fillProfile();


    showToast(
      "Dados salvos com sucesso.",
      "success"
    );


    /*
      Se o cliente veio do carrinho,
      volta automaticamente para finalizar.
    */

    const params =
      new URLSearchParams(
        location.search
      );


    if (
      params.get(
        "checkout"
      ) === "1"
    ) {

      showToast(
        "Voltando para seu carrinho...",
        "success"
      );


      setTimeout(
        () => {

          location.replace(
            "/index.html?checkout=1"
          );

        },
        700
      );

    }


  } catch (error) {

    console.error(
      "Erro ao salvar perfil:",
      error
    );


    showToast(
      error?.message ||
      "Não foi possível salvar seus dados.",
      "error"
    );


  } finally {

    setButtonLoading(
      button,
      false
    );

  }

}


/* =========================================================
   LOGOUT
========================================================= */

async function logout() {

  try {

    await supabase.auth
      .signOut();


    location.replace(
      "/login.html"
    );


  } catch (error) {

    console.error(
      "Erro ao sair:",
      error
    );


    showToast(
      "Não foi possível sair da conta.",
      "error"
    );

  }

}


/* =========================================================
   EVENTOS
========================================================= */

function bindEvents() {

  const cep =
    $("#profileCEP");


  cep?.addEventListener(
    "input",
    event => {

      event.target.value =
        formatCEP(
          event.target.value
        );

    }
  );


  const stateInput =
    $("#profileState");


  stateInput?.addEventListener(
    "input",
    event => {

      event.target.value =
        event.target.value

          .toUpperCase()

          .replace(
            /[^A-Z]/g,
            ""
          )

          .slice(
            0,
            2
          );

    }
  );


  $("#profileForm")
    ?.addEventListener(
      "submit",
      saveProfile
    );


  $("#logoutButton")
    ?.addEventListener(
      "click",
      logout
    );

}


/* =========================================================
   INICIALIZAÇÃO
========================================================= */

async function init() {

  console.log(
    "[Crazy Chicken] account.js carregado."
  );


  /*
    1. Verifica configuração Supabase
  */

  if (
    !isConfigured ||
    !supabase
  ) {

    hideLoading();

    showSetupWarning();

    showToast(
      "Supabase não configurado.",
      "error"
    );

    return;

  }


  /*
    2. Verifica login
  */

  session =
    await requireAuth();


  if (!session) {

    /*
      requireAuth já fará
      o redirecionamento.
    */

    return;

  }


  /*
    3. Busca perfil
  */

  try {

    profile =
      await getProfile(
        session.user.id
      );


  } catch (error) {

    console.error(
      "Erro ao buscar perfil:",
      error
    );


    hideLoading();


    showToast(
      "Não foi possível carregar seu perfil.",
      "error"
    );


    return;

  }


  /*
    4. Preenche os dados
  */

  fillProfile();


  /*
    IMPORTANTE:
    Mostra a página ANTES de buscar os pedidos.

    Assim, se os pedidos derem erro,
    a conta ainda abre normalmente.
  */

  showAccount();


  /*
    5. Eventos
  */

  bindEvents();


  /*
    6. Carrega pedidos
  */

  await loadOrders();


  console.log(
    "[Crazy Chicken] Conta carregada."
  );

}


/* =========================================================
   START
========================================================= */

init()
  .catch(
    error => {

      console.error(
        "Erro geral da conta:",
        error
      );


      hideLoading();


      showToast(
        error?.message ||
        "Erro ao carregar sua conta.",
        "error"
      );

    }
  );