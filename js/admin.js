import {
  supabase,
  isConfigured
} from "/js/supabaseClient.js";


import {
  $,
  $$,
  formatBRL,
  escapeHTML,
  showToast,
  setButtonLoading
} from "/js/common.js";


const BRAND_ICON =
  "/assets/crazy-chicken-icon.png";


let adminSession =
  null;


let products =
  [];


let orders =
  [];


let customers =
  [];


const statuses = {

  pending_whatsapp:
    "Aguardando confirmação",

  confirmed:
    "Confirmado",

  preparing:
    "Em preparação",

  ready:
    "Pronto",

  delivered:
    "Entregue",

  cancelled:
    "Cancelado"

};


async function protegerAdmin() {

  if (
    !isConfigured ||
    !supabase
  ) {

    document.body.innerHTML = `
      <div
        style="
          min-height:100vh;
          display:grid;
          place-items:center;
          background:#090909;
          color:#fff;
          font-family:Arial,sans-serif;
          padding:30px
        "
      >

        <div
          style="
            max-width:520px;
            width:100%;
            background:#151515;
            border:1px solid #303030;
            border-radius:16px;
            padding:30px;
            text-align:center
          "
        >

          <img
            src="${BRAND_ICON}"
            alt="Crazy Chicken"
            style="
              width:72px;
              height:72px;
              border-radius:18px;
              object-fit:cover;
              margin:0 auto 18px
            "
          >

          <h1
            style="margin-bottom:15px"
          >
            Supabase não configurado
          </h1>

          <p
            style="
              color:#aaa;
              line-height:1.6;
              margin-bottom:20px
            "
          >

            Configure primeiro o arquivo

            <strong>
              js/config.js
            </strong>

            com a URL e a Publishable Key
            do seu projeto Supabase.

          </p>

          <a
            href="/index.html"
            style="
              display:inline-block;
              padding:12px 18px;
              border-radius:10px;
              background:#ff2f37;
              color:white;
              text-decoration:none;
              font-weight:bold
            "
          >
            Voltar para a loja
          </a>

        </div>

      </div>
    `;


    return null;

  }


  try {

    const {
      data: {
        session
      },
      error:
        sessionError
    } =
      await supabase.auth
        .getSession();


    if (
      sessionError
    ) {

      throw sessionError;

    }


    if (!session) {

      window.location
        .replace(
          "/login.html?redirect=%2Fadmin.html"
        );


      return null;

    }


    const {
      data:
        profile,
      error:
        profileError
    } =
      await supabase

        .from(
          "profiles"
        )

        .select(
          "id, role, full_name"
        )

        .eq(
          "id",
          session.user.id
        )

        .single();


    if (
      profileError
    ) {

      console.error(
        profileError
      );


      await supabase.auth
        .signOut();


      window.location
        .replace(
          "/login.html?redirect=%2Fadmin.html"
        );


      return null;

    }


    if (
      !profile ||
      profile.role !==
        "admin"
    ) {

      window.location
        .replace(
          "/index.html"
        );


      return null;

    }


    return {
      session,
      profile
    };


  } catch (error) {

    console.error(
      "Erro ao validar administrador:",
      error
    );


    try {

      await supabase.auth
        .signOut();


    } catch {}


    window.location
      .replace(
        "/login.html?redirect=%2Fadmin.html"
      );


    return null;

  }

}


function setSection(name) {

  $$(
    "[data-admin-section]"
  )
    .forEach(
      section => {

        section.hidden =
          section.dataset
            .adminSection !==
          name;

      }
    );


  $$(
    "#adminNav [data-section]"
  )
    .forEach(
      button => {

        button.classList
          .toggle(
            "active",
            button.dataset
              .section ===
              name
          );

      }
    );


  if (
    name ===
    "orders"
  ) {

    loadOrders()
      .catch(
        handleError
      );

  }


  if (
    name ===
    "customers"
  ) {

    loadCustomers()
      .catch(
        handleError
      );

  }

}


function resetProductForm() {

  const form =
    $("#productForm");


  if (!form) {
    return;
  }


  form.reset();


  $("#productId").value =
    "";


  $("#existingImagePath").value =
    "";


  $("#productActive").checked =
    true;


  $("#productStock").value =
    "0";


  $("#imagePreview").innerHTML =
    "Sem imagem selecionada";


  $("#productFormTitle").textContent =
    "Adicionar produto";


  $("#saveProductButton").textContent =
    "Salvar produto";

}


function renderProducts() {

  const body =
    $("#adminProductsBody");


  if (!body) {
    return;
  }


  const query =
    $("#adminProductSearch")
      ?.value
      .trim()
      .toLowerCase()
    ||
    "";


  const visible =
    products
      .filter(
        product => {

          const texto =
            `
              ${product.name || ""}
              ${product.category || ""}
              ${product.sku || ""}
            `
              .toLowerCase();


          return (
            !query ||
            texto.includes(
              query
            )
          );

        }
      );


  if (
    !visible.length
  ) {

    body.innerHTML = `
      <tr>
        <td colspan="6">
          Nenhum produto encontrado.
        </td>
      </tr>
    `;


    return;

  }


  body.innerHTML =
    visible

      .map(
        product => {

          const image =
            product.image_url ||
            BRAND_ICON;


          return `
            <tr>

              <td>

                <div class="product-table-item">

                  <img
                    src="${
                      escapeHTML(
                        image
                      )
                    }"
                    alt="${
                      escapeHTML(
                        product.name ||
                        "Produto"
                      )
                    }"
                    onerror="
                      this.onerror=null;
                      this.src='${BRAND_ICON}'
                    "
                  >

                  <div>

                    <strong>
                      ${
                        escapeHTML(
                          product.name
                        )
                      }
                    </strong>

                    <div class="muted">
                      ${
                        escapeHTML(
                          product.sku ||
                          "Sem SKU"
                        )
                      }
                    </div>

                  </div>

                </div>

              </td>


              <td>
                ${
                  escapeHTML(
                    product.category ||
                    "—"
                  )
                }
              </td>


              <td>
                ${
                  formatBRL(
                    product.price
                  )
                }
              </td>


              <td>
                ${
                  product.stock ??
                  0
                }
              </td>


              <td>

                <span
                  class="badge ${
                    product.active
                      ? "active-status"
                      : "inactive-status"
                  }"
                >
                  ${
                    product.active
                      ? "Ativo"
                      : "Oculto"
                  }
                </span>

              </td>


              <td>

                <div class="table-actions">

                  <button
                    type="button"
                    data-edit-product="${product.id}"
                  >
                    Editar
                  </button>

                  <button
                    type="button"
                    data-delete-product="${product.id}"
                  >
                    Excluir
                  </button>

                </div>

              </td>

            </tr>
          `;

        }
      )

      .join("");

}


async function loadProducts() {

  const {
    data,
    error
  } =
    await supabase

      .from(
        "products"
      )

      .select("*")

      .order(
        "created_at",
        {
          ascending: false
        }
      );


  if (error) {
    throw error;
  }


  products =
    data || [];


  const metric =
    $("#metricProducts");


  if (metric) {

    metric.textContent =
      products
        .filter(
          product =>
            product.active
        )
        .length;

  }


  renderProducts();

}


function editProduct(id) {

  const product =
    products
      .find(
        item =>
          String(
            item.id
          )
          ===
          String(id)
      );


  if (!product) {
    return;
  }


  $("#productId").value =
    product.id;


  $("#existingImagePath").value =
    product.image_path ||
    "";


  $("#productName").value =
    product.name ||
    "";


  $("#productSku").value =
    product.sku ||
    "";


  $("#productCategory").value =
    product.category ||
    "";


  $("#productPrice").value =
    product.price ??
    "";


  $("#productComparePrice").value =
    product.compare_at_price ??
    "";


  $("#productStock").value =
    product.stock ??
    0;


  $("#productDescription").value =
    product.description ||
    "";


  $("#productNew").checked =
    Boolean(
      product.is_new
    );


  $("#productFeatured").checked =
    Boolean(
      product.featured
    );


  $("#productActive").checked =
    Boolean(
      product.active
    );


  const preview =
    product.image_url ||
    BRAND_ICON;


  $("#imagePreview").innerHTML = `
    <img
      src="${escapeHTML(preview)}"
      alt="Prévia"
      onerror="
        this.onerror=null;
        this.src='${BRAND_ICON}'
      "
    >
  `;


  $("#productFormTitle").textContent =
    "Editar produto";


  $("#saveProductButton").textContent =
    "Salvar alterações";


  $("#productForm")
    .scrollIntoView(
      {
        behavior:
          "smooth",

        block:
          "start"
      }
    );

}


async function uploadImage(
  file
) {

  if (!file) {
    return null;
  }


  if (
    file.size >
    6 * 1024 * 1024
  ) {

    throw new Error(
      "A imagem deve ter no máximo 6 MB."
    );

  }


  const allowed = [
    "image/jpeg",
    "image/png",
    "image/webp"
  ];


  if (
    !allowed.includes(
      file.type
    )
  ) {

    throw new Error(
      "Use uma imagem JPG, PNG ou WebP."
    );

  }


  const ext =
    file.name
      .split(".")
      .pop()
      ?.toLowerCase()
    ||
    "jpg";


  const path =
    `${adminSession.user.id}/${crypto.randomUUID()}.${ext}`;


  const {
    error
  } =
    await supabase.storage

      .from(
        "product-images"
      )

      .upload(
        path,
        file,
        {

          cacheControl:
            "3600",

          upsert:
            false,

          contentType:
            file.type

        }
      );


  if (error) {
    throw error;
  }


  const {
    data
  } =
    supabase.storage

      .from(
        "product-images"
      )

      .getPublicUrl(
        path
      );


  return {

    path,

    url:
      data.publicUrl

  };

}


async function deleteProduct(id) {

  const product =
    products
      .find(
        item =>
          String(
            item.id
          )
          ===
          String(id)
      );


  if (!product) {
    return;
  }


  if (
    !confirm(
      `Excluir "${product.name}"?`
    )
  ) {

    return;

  }


  try {

    const {
      error
    } =
      await supabase

        .from(
          "products"
        )

        .delete()

        .eq(
          "id",
          id
        );


    if (error) {
      throw error;
    }


    if (
      product.image_path
    ) {

      await supabase.storage

        .from(
          "product-images"
        )

        .remove(
          [
            product.image_path
          ]
        );

    }


    showToast(
      "Produto excluído.",
      "success"
    );


    await loadProducts();


  } catch (error) {

    handleError(
      error
    );

  }

}


function statusOptions(
  current
) {

  return Object
    .entries(
      statuses
    )

    .map(
      ([
        value,
        label
      ]) => `

        <option
          value="${value}"
          ${
            current ===
              value
              ? "selected"
              : ""
          }
        >
          ${label}
        </option>

      `
    )

    .join("");

}


function renderOrders() {

  const root =
    $("#adminOrdersList");


  if (!root) {
    return;
  }


  if (
    !orders.length
  ) {

    root.innerHTML = `
      <div class="empty-admin">
        Nenhum pedido encontrado.
      </div>
    `;


    return;

  }


  root.innerHTML =
    orders

      .map(
        order => {

          const shipping =
            order.shipping_snapshot ||
            {};


          return `
            <article
              class="order-card"
              data-order-id="${order.id}"
            >

              <div class="section-head order-head">

                <div>

                  <strong>
                    Pedido #${
                      escapeHTML(
                        order.order_number
                      )
                    }
                  </strong>

                  <div class="muted">
                    ${
                      new Date(
                        order.created_at
                      )
                        .toLocaleString(
                          "pt-BR"
                        )
                    }
                  </div>

                </div>

                <select
                  class="mini-input"
                  data-order-status
                >
                  ${
                    statusOptions(
                      order.status
                    )
                  }
                </select>

              </div>


              <div class="order-items-admin">

                ${
                  (
                    order.order_items ||
                    []
                  )

                    .map(
                      item => `
                        <div>

                          <span>
                            ${item.quantity}x
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

                    .join("")
                }

              </div>


              <div class="order-address">

                Cliente:
                ${
                  escapeHTML(
                    shipping.full_name ||
                    "—"
                  )
                }

                <br>

                Telefone:
                ${
                  escapeHTML(
                    shipping.phone ||
                    "—"
                  )
                }

                <br>

                Endereço:
                ${
                  escapeHTML(
                    shipping.street ||
                    ""
                  )
                },
                ${
                  escapeHTML(
                    shipping.number ||
                    ""
                  )
                }

                <br>

                ${
                  escapeHTML(
                    shipping.city ||
                    ""
                  )
                }
                /
                ${
                  escapeHTML(
                    shipping.state ||
                    ""
                  )
                }

                • CEP:
                ${
                  escapeHTML(
                    shipping.postal_code ||
                    ""
                  )
                }

              </div>


              <div class="form-grid">

                <input
                  class="input"
                  data-order-shipping
                  type="number"
                  min="0"
                  step="0.01"
                  value="${
                    order.shipping_cost ??
                    ""
                  }"
                  placeholder="Frete"
                >

                <button
                  class="btn btn-primary"
                  data-save-order
                  type="button"
                >
                  Salvar pedido
                </button>

              </div>


              <div class="order-total-admin">

                <span class="muted">
                  Total
                </span>

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

}


async function loadOrders() {

  const root =
    $("#adminOrdersList");


  if (root) {

    root.innerHTML = `
      <p class="muted">
        Carregando pedidos...
      </p>
    `;

  }


  const {
    data,
    error
  } =
    await supabase

      .from(
        "orders"
      )

      .select(
        `
        id,
        order_number,
        user_id,
        status,
        subtotal,
        shipping_cost,
        total,
        shipping_snapshot,
        created_at,
        order_items(
          id,
          name_snapshot,
          unit_price,
          quantity,
          line_total
        )
        `
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


  orders =
    data || [];


  const metric =
    $("#metricOrders");


  if (metric) {

    metric.textContent =
      orders
        .filter(
          order =>
            ![
              "delivered",
              "cancelled"
            ]
              .includes(
                order.status
              )
        )
        .length;

  }


  renderOrders();

}


async function saveOrder(
  card
) {

  const id =
    card.dataset
      .orderId;


  const order =
    orders
      .find(
        item =>
          String(
            item.id
          )
          ===
          String(id)
      );


  if (!order) {
    return;
  }


  const status =
    card
      .querySelector(
        "[data-order-status]"
      )
      .value;


  const shippingRaw =
    card
      .querySelector(
        "[data-order-shipping]"
      )
      .value;


  const shippingCost =
    shippingRaw ===
      ""
      ? null
      : Number(
          shippingRaw
        );


  const total =
    Number(
      order.subtotal
    )
    +
    Number(
      shippingCost ||
      0
    );


  const {
    error
  } =
    await supabase

      .from(
        "orders"
      )

      .update(
        {

          status,

          shipping_cost:
            shippingCost,

          total

        }
      )

      .eq(
        "id",
        id
      );


  if (error) {
    throw error;
  }


  showToast(
    "Pedido atualizado.",
    "success"
  );


  await loadOrders();

}


async function loadCustomers() {

  const {
    data,
    error
  } =
    await supabase

      .from(
        "profiles"
      )

      .select(
        `
        id,
        full_name,
        phone,
        city,
        state,
        postal_code,
        role,
        created_at
        `
      )

      .eq(
        "role",
        "customer"
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


  customers =
    data || [];


  const metric =
    $("#metricCustomers");


  if (metric) {

    metric.textContent =
      customers.length;

  }


  const body =
    $("#customersBody");


  if (!body) {
    return;
  }


  if (
    !customers.length
  ) {

    body.innerHTML = `
      <tr>
        <td colspan="5">
          Nenhum cliente cadastrado.
        </td>
      </tr>
    `;


    return;

  }


  body.innerHTML =
    customers

      .map(
        customer => `
          <tr>

            <td>
              <strong>
                ${
                  escapeHTML(
                    customer.full_name ||
                    "Não informado"
                  )
                }
              </strong>
            </td>

            <td>
              ${
                escapeHTML(
                  customer.phone ||
                  "—"
                )
              }
            </td>

            <td>
              ${
                escapeHTML(
                  customer.city ||
                  "—"
                )
              }
              ${
                customer.state
                  ? `/${escapeHTML(customer.state)}`
                  : ""
              }
            </td>

            <td>
              ${
                escapeHTML(
                  customer.postal_code ||
                  "—"
                )
              }
            </td>

            <td>
              ${
                new Date(
                  customer.created_at
                )
                  .toLocaleDateString(
                    "pt-BR"
                  )
              }
            </td>

          </tr>
        `
      )

      .join("");

}


async function loadMetrics() {

  await Promise.all(
    [

      loadProducts(),

      loadOrders(),

      loadCustomers()

    ]
  );

}


function handleError(
  error
) {

  console.error(
    error
  );


  showToast(
    error?.message ||
    "Ocorreu um erro.",
    "error"
  );

}


function bindEvents() {

  $$(
    "#adminNav [data-section]"
  )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () =>
            setSection(
              button.dataset
                .section
            )
        );

      }
    );


  $("#adminProductSearch")
    ?.addEventListener(
      "input",
      renderProducts
    );


  $("#cancelEditButton")
    ?.addEventListener(
      "click",
      resetProductForm
    );


  $("#refreshOrders")
    ?.addEventListener(
      "click",
      () =>
        loadOrders()
          .catch(
            handleError
          )
    );


  $("#productImage")
    ?.addEventListener(
      "change",
      event => {

        const file =
          event.target
            .files?.[0];


        if (!file) {
          return;
        }


        const url =
          URL.createObjectURL(
            file
          );


        $("#imagePreview").innerHTML = `
          <img
            src="${url}"
            alt="Prévia"
          >
        `;

      }
    );


  $("#adminProductsBody")
    ?.addEventListener(
      "click",
      event => {

        const edit =
          event.target
            .closest(
              "[data-edit-product]"
            );


        const remove =
          event.target
            .closest(
              "[data-delete-product]"
            );


        if (edit) {

          editProduct(
            edit.dataset
              .editProduct
          );

        }


        if (remove) {

          deleteProduct(
            remove.dataset
              .deleteProduct
          );

        }

      }
    );


  $("#adminOrdersList")
    ?.addEventListener(
      "click",
      event => {

        const save =
          event.target
            .closest(
              "[data-save-order]"
            );


        if (save) {

          saveOrder(
            save.closest(
              "[data-order-id]"
            )
          )
            .catch(
              handleError
            );

        }

      }
    );


  $("#adminLogout")
    ?.addEventListener(
      "click",
      async () => {

        await supabase.auth
          .signOut();


        window.location
          .replace(
            "/login.html?redirect=%2Fadmin.html"
          );

      }
    );


  $("#productForm")
    ?.addEventListener(
      "submit",
      async event => {

        event.preventDefault();


        const button =
          $("#saveProductButton");


        setButtonLoading(
          button,
          true,
          "Salvando..."
        );


        let uploaded =
          null;


        try {

          const id =
            $("#productId").value;


          const file =
            $("#productImage")
              .files?.[0];


          if (file) {

            uploaded =
              await uploadImage(
                file
              );

          }


          const payload = {

            name:
              $("#productName")
                .value
                .trim(),

            sku:
              $("#productSku")
                .value
                .trim()
              ||
              null,

            category:
              $("#productCategory")
                .value
                .trim(),

            price:
              Number(
                $("#productPrice")
                  .value
              ),

            compare_at_price:
              $("#productComparePrice")
                .value

                ? Number(
                    $("#productComparePrice")
                      .value
                  )

                : null,

            stock:
              Number(
                $("#productStock")
                  .value
              ),

            description:
              $("#productDescription")
                .value
                .trim()
              ||
              null,

            is_new:
              $("#productNew")
                .checked,

            featured:
              $("#productFeatured")
                .checked,

            active:
              $("#productActive")
                .checked

          };


          if (uploaded) {

            payload.image_url =
              uploaded.url;


            payload.image_path =
              uploaded.path;

          }


          if (
            payload.compare_at_price
            &&
            payload.compare_at_price <=
              payload.price
          ) {

            payload.compare_at_price =
              null;

          }


          if (id) {

            const oldProduct =
              products
                .find(
                  item =>
                    String(
                      item.id
                    )
                    ===
                    String(id)
                );


            const {
              error
            } =
              await supabase

                .from(
                  "products"
                )

                .update(
                  payload
                )

                .eq(
                  "id",
                  id
                );


            if (error) {
              throw error;
            }


            if (
              uploaded &&
              oldProduct?.image_path
            ) {

              await supabase.storage

                .from(
                  "product-images"
                )

                .remove(
                  [
                    oldProduct.image_path
                  ]
                );

            }


            showToast(
              "Produto atualizado.",
              "success"
            );


          } else {

            const {
              error
            } =
              await supabase

                .from(
                  "products"
                )

                .insert(
                  payload
                );


            if (error) {
              throw error;
            }


            showToast(
              "Produto adicionado.",
              "success"
            );

          }


          resetProductForm();


          await loadProducts();


        } catch (error) {

          if (
            uploaded?.path
          ) {

            try {

              await supabase.storage

                .from(
                  "product-images"
                )

                .remove(
                  [
                    uploaded.path
                  ]
                );


            } catch {}

          }


          handleError(
            error
          );


        } finally {

          setButtonLoading(
            button,
            false
          );

        }

      }
    );

}


async function init() {

  const page =
    document.querySelector(
      ".page-shell"
    );


  if (page) {

    page.style.visibility =
      "hidden";

  }


  const auth =
    await protegerAdmin();


  if (!auth) {
    return;
  }


  adminSession =
    auth.session;


  if (page) {

    page.style.visibility =
      "visible";

  }


  bindEvents();


  try {

    await loadMetrics();


  } catch (error) {

    handleError(
      error
    );

  }

}


if (
  isConfigured &&
  supabase
) {

  supabase.auth
    .onAuthStateChange(
      async (
        event,
        session
      ) => {

        if (
          event ===
            "SIGNED_OUT"
          ||
          !session
        ) {

          if (
            location.pathname
              .includes(
                "admin"
              )
          ) {

            window.location
              .replace(
                "/login.html?redirect=%2Fadmin.html"
              );

          }

        }

      }
    );

}


init();