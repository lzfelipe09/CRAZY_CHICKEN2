import {
  supabase,
  isConfigured
} from "/js/supabaseClient.js";


import {
  $,
  $$,
  escapeHTML,
  formatBRL,
  showToast,
  showSetupWarning,
  getSession,
  getProfile,
  hydrateHeaderAuth
} from "/js/common.js";


import {
  WHATSAPP_NUMBER,
  INSTAGRAM_URL
} from "/js/config.js";


const CART_KEY =
  "crazy_chicken_cart_v4";


const BRAND_ICON =
  "/assets/crazy-chicken-icon.png";


const state = {

  products: [],

  filtered: [],

  cart: loadCart(),

  favorites:
    new Set(),

  session: null,

  category: "all",

  search: "",

  sort: "featured"

};


function element(id) {

  return document
    .getElementById(id);

}


function loadCart() {

  try {

    const parsed =
      JSON.parse(
        localStorage.getItem(
          CART_KEY
        ) || "[]"
      );


    return Array.isArray(
      parsed
    )
      ? parsed
      : [];


  } catch {

    return [];

  }

}


function saveCart() {

  localStorage.setItem(
    CART_KEY,
    JSON.stringify(
      state.cart
    )
  );


  renderCart();

}


function productById(id) {

  return state.products
    .find(
      product =>
        String(
          product.id
        ) ===
        String(id)
    );

}


async function loadProducts() {

  const grid =
    element(
      "productGrid"
    );


  if (!grid) {
    return;
  }


  grid.innerHTML = `
    <div class="empty">
      <div>
        <strong>
          Carregando produtos...
        </strong>
        <span>
          Buscando catálogo.
        </span>
      </div>
    </div>
  `;


  if (
    !isConfigured ||
    !supabase
  ) {

    grid.innerHTML = `
      <div class="empty">
        <div>
          <strong>
            Supabase não configurado.
          </strong>
          <span>
            Verifique js/config.js
          </span>
        </div>
      </div>
    `;


    showSetupWarning();

    return;

  }


  try {

    const {
      data,
      error
    } =
      await supabase

        .from(
          "products"
        )

        .select(
          `
          id,
          sku,
          name,
          description,
          category,
          price,
          compare_at_price,
          stock,
          image_url,
          image_path,
          is_new,
          featured,
          active,
          created_at,
          updated_at
          `
        )

        .eq(
          "active",
          true
        )

        .order(
          "featured",
          {
            ascending: false
          }
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


    state.products =
      Array.isArray(data)
        ? data
        : [];


    state.filtered =
      [
        ...state.products
      ];


    normalizeCart();

    renderCategories();

    applyFilters();

    renderCart();


    try {

      await loadFavorites();

      applyFilters();


    } catch (error) {

      console.warn(
        "Favoritos não carregados:",
        error
      );

    }


  } catch (error) {

    console.error(
      "Erro ao carregar produtos:",
      error
    );


    grid.innerHTML = `
      <div class="empty">

        <div>

          <strong>
            Não foi possível carregar os produtos.
          </strong>

          <span>
            ${
              escapeHTML(
                error?.message ||
                "Erro desconhecido"
              )
            }
          </span>

        </div>

      </div>
    `;


    showToast(
      error?.message ||
      "Erro ao carregar produtos.",
      "error"
    );

  }

}


function productCard(
  product
) {

  const stock =
    Number(
      product.stock || 0
    );


  const inStock =
    stock > 0;


  const favorite =
    state.favorites.has(
      product.id
    );


  const price =
    Number(
      product.price || 0
    );


  const comparePrice =
    Number(
      product.compare_at_price ||
      0
    );


  const hasCompare =
    comparePrice >
    price;


  const imageSrc =
    product.image_url ||
    BRAND_ICON;


  return `
    <article
      class="product-card"
      data-product-id="${product.id}"
    >

      <div class="product-media">

        <img
          src="${escapeHTML(imageSrc)}"
          alt="${
            escapeHTML(
              product.name ||
              "Produto Crazy Chicken"
            )
          }"
          loading="lazy"
          onerror="
            this.onerror=null;
            this.src='${BRAND_ICON}'
          "
        >


        <div class="badges">

          ${
            product.is_new
              ? `<span>Novidade</span>`
              : ""
          }

          ${
            product.featured
              ? `<span>Destaque</span>`
              : ""
          }

          ${
            !inStock
              ? `<span>Sem estoque</span>`
              : ""
          }

        </div>


        <button
          class="favorite ${
            favorite
              ? "active"
              : ""
          }"
          type="button"
          data-favorite="${product.id}"
          aria-label="Favoritar produto"
        >

          ${
            favorite
              ? "♥"
              : "♡"
          }

        </button>

      </div>


      <div class="product-body">

        <small>
          ${
            escapeHTML(
              product.category ||
              "Produtos"
            )
          }
        </small>


        <h3>
          ${
            escapeHTML(
              product.name ||
              "Produto"
            )
          }
        </h3>


        <p>
          ${
            escapeHTML(
              product.description ||
              "Produto Crazy Chicken."
            )
          }
        </p>


        <div class="price-line">

          <div>

            ${
              hasCompare
                ? `
                  <s>
                    ${
                      formatBRL(
                        comparePrice
                      )
                    }
                  </s>
                `
                : ""
            }


            <strong>
              ${
                formatBRL(
                  price
                )
              }
            </strong>

          </div>


          <span>

            ${
              inStock
                ? `${stock} em estoque`
                : "Indisponível"
            }

          </span>

        </div>


        <button
          class="btn primary"
          type="button"
          data-add="${product.id}"
          ${
            inStock
              ? ""
              : "disabled"
          }
        >

          ${
            inStock
              ? "Adicionar ao carrinho"
              : "Sem estoque"
          }

        </button>

      </div>

    </article>
  `;

}


function renderProducts() {

  const grid =
    element(
      "productGrid"
    );


  if (!grid) {
    return;
  }


  if (
    !state.filtered.length
  ) {

    grid.innerHTML = `
      <div class="empty">

        <div>

          <strong>
            Nenhum produto encontrado.
          </strong>

          <span>
            Tente mudar a pesquisa ou categoria.
          </span>

        </div>

      </div>
    `;

    return;

  }


  grid.innerHTML =
    state.filtered

      .map(
        productCard
      )

      .join("");

}


function applyFilters() {

  const search =
    state.search
      .trim()
      .toLowerCase();


  const list =
    state.products
      .filter(
        product => {

          const category =
            String(
              product.category ||
              "Outros"
            )
              .trim()
              .toLowerCase();


          const text =
            `
            ${product.name || ""}
            ${product.description || ""}
            ${product.category || ""}
            ${product.sku || ""}
            `
              .toLowerCase();


          const categoryMatches =
            state.category ===
              "all"

            ||

            category ===
              state.category;


          const searchMatches =
            !search

            ||

            text.includes(
              search
            );


          return (
            categoryMatches &&
            searchMatches
          );

        }
      );


  list.sort(
    (
      a,
      b
    ) => {

      if (
        state.sort ===
        "price-asc"
      ) {

        return (
          Number(
            a.price
          )
          -
          Number(
            b.price
          )
        );

      }


      if (
        state.sort ===
        "price-desc"
      ) {

        return (
          Number(
            b.price
          )
          -
          Number(
            a.price
          )
        );

      }


      if (
        state.sort ===
        "name"
      ) {

        return String(
          a.name || ""
        )
          .localeCompare(
            String(
              b.name || ""
            ),
            "pt-BR"
          );

      }


      return (

        Number(
          Boolean(
            b.featured
          )
        )

        -

        Number(
          Boolean(
            a.featured
          )
        )

        ||

        Number(
          Boolean(
            b.is_new
          )
        )

        -

        Number(
          Boolean(
            a.is_new
          )
        )

        ||

        new Date(
          b.created_at
        )

        -

        new Date(
          a.created_at
        )

      );

    }
  );


  state.filtered =
    list;


  renderProducts();

}


function renderCategories() {

  const row =
    element(
      "categoryRow"
    );


  if (!row) {
    return;
  }


  const categories =
    [
      ...new Set(

        state.products

          .map(
            product =>
              String(
                product.category ||
                "Outros"
              )
                .trim()
          )

          .filter(
            Boolean
          )

      )
    ]
      .sort(
        (
          a,
          b
        ) =>
          a.localeCompare(
            b,
            "pt-BR"
          )
      );


  row.innerHTML = `

    <button
      class="chip ${
        state.category ===
          "all"
          ? "active"
          : ""
      }"
      type="button"
      data-category="all"
    >
      Todos
    </button>


    ${
      categories

        .map(
          category => {

            const normalized =
              category
                .toLowerCase();


            return `
              <button
                class="chip ${
                  state.category ===
                    normalized
                    ? "active"
                    : ""
                }"
                type="button"
                data-category="${
                  escapeHTML(
                    normalized
                  )
                }"
              >
                ${
                  escapeHTML(
                    category
                  )
                }
              </button>
            `;

          }
        )

        .join("")
    }
  `;

}


function normalizeCart() {

  state.cart =
    state.cart

      .map(
        item => {

          const product =
            productById(
              item.product_id
            );


          if (
            !product ||
            !product.active
          ) {

            return null;

          }


          const stock =
            Number(
              product.stock ||
              0
            );


          if (
            stock <= 0
          ) {

            return null;

          }


          return {

            product_id:
              product.id,

            quantity:
              Math.min(

                Math.max(
                  Number(
                    item.quantity
                  ) || 1,
                  1
                ),

                stock

              )

          };

        }
      )

      .filter(
        Boolean
      );


  localStorage.setItem(
    CART_KEY,
    JSON.stringify(
      state.cart
    )
  );

}


function addToCart(id) {

  const product =
    productById(id);


  if (!product) {

    showToast(
      "Produto não encontrado.",
      "error"
    );

    return;

  }


  const stock =
    Number(
      product.stock ||
      0
    );


  if (
    stock <= 0
  ) {

    showToast(
      "Produto sem estoque.",
      "error"
    );

    return;

  }


  const item =
    state.cart
      .find(
        entry =>
          String(
            entry.product_id
          )
          ===
          String(id)
      );


  if (item) {

    if (
      item.quantity >=
      stock
    ) {

      showToast(
        "Você atingiu o estoque disponível.",
        "error"
      );

      return;

    }


    item.quantity +=
      1;


  } else {

    state.cart.push(
      {

        product_id:
          product.id,

        quantity:
          1

      }
    );

  }


  saveCart();

  openCart();


  showToast(
    "Produto adicionado ao carrinho.",
    "success"
  );

}


function changeQty(
  id,
  delta
) {

  const item =
    state.cart
      .find(
        entry =>
          String(
            entry.product_id
          )
          ===
          String(id)
      );


  const product =
    productById(id);


  if (
    !item ||
    !product
  ) {

    return;

  }


  const next =
    item.quantity +
    delta;


  if (
    next <= 0
  ) {

    state.cart =
      state.cart
        .filter(
          entry =>
            String(
              entry.product_id
            )
            !==
            String(id)
        );


  } else if (
    next <=
    Number(
      product.stock
    )
  ) {

    item.quantity =
      next;


  } else {

    showToast(
      "Você atingiu o estoque disponível.",
      "error"
    );

  }


  saveCart();

}


function removeFromCart(id) {

  state.cart =
    state.cart
      .filter(
        item =>
          String(
            item.product_id
          )
          !==
          String(id)
      );


  saveCart();

}


function renderCart() {

  const root =
    element(
      "cartItems"
    );


  const count =
    element(
      "cartCount"
    );


  const subtotalEl =
    element(
      "cartSubtotal"
    );


  if (
    !root ||
    !count ||
    !subtotalEl
  ) {

    return;

  }


  const rows =
    state.cart

      .map(
        item => ({

          item,

          product:
            productById(
              item.product_id
            )

        })
      )

      .filter(
        row =>
          row.product
      );


  const quantity =
    rows.reduce(
      (
        total,
        row
      ) =>
        total +
        row.item.quantity,
      0
    );


  const subtotal =
    rows.reduce(
      (
        total,
        row
      ) => {

        return (
          total

          +

          Number(
            row.product.price
          )

          *

          row.item.quantity
        );

      },
      0
    );


  count.textContent =
    quantity;


  subtotalEl.textContent =
    formatBRL(
      subtotal
    );


  if (
    !rows.length
  ) {

    root.innerHTML = `
      <div class="empty">

        <div>

          <strong>
            Seu carrinho está vazio.
          </strong>

          <span>
            Adicione produtos para continuar.
          </span>

        </div>

      </div>
    `;

    return;

  }


  root.innerHTML =
    rows

      .map(
        ({
          item,
          product
        }) => {


          const thumb =
            product.image_url ||
            BRAND_ICON;


          return `
            <div class="cart-item">

              <div class="cart-thumb">

                <img
                  src="${
                    escapeHTML(
                      thumb
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

              </div>


              <div class="cart-info">

                <strong>
                  ${
                    escapeHTML(
                      product.name
                    )
                  }
                </strong>

                <span>
                  ${
                    formatBRL(
                      product.price
                    )
                  }
                  cada
                </span>


                <div class="qty">

                  <button
                    type="button"
                    data-qty="-1"
                    data-id="${product.id}"
                  >
                    −
                  </button>

                  <b>
                    ${item.quantity}
                  </b>

                  <button
                    type="button"
                    data-qty="1"
                    data-id="${product.id}"
                  >
                    +
                  </button>

                </div>

              </div>


              <button
                class="remove"
                type="button"
                data-remove="${product.id}"
              >
                ×
              </button>

            </div>
          `;

        }
      )

      .join("");

}


function openCart() {

  element(
    "cartDrawer"
  )
    ?.classList.add(
      "open"
    );


  element(
    "cartBackdrop"
  )
    ?.classList.add(
      "open"
    );


  document.body
    .classList.add(
      "no-scroll"
    );

}


function closeCart() {

  element(
    "cartDrawer"
  )
    ?.classList.remove(
      "open"
    );


  element(
    "cartBackdrop"
  )
    ?.classList.remove(
      "open"
    );


  document.body
    .classList.remove(
      "no-scroll"
    );

}


async function loadFavorites() {

  if (
    !state.session ||
    !supabase
  ) {

    return;

  }


  const {
    data,
    error
  } =
    await supabase

      .from(
        "favorites"
      )

      .select(
        "product_id"
      )

      .eq(
        "user_id",
        state.session.user.id
      );


  if (error) {
    throw error;
  }


  state.favorites =
    new Set(

      (data || [])
        .map(
          row =>
            row.product_id
        )

    );

}


async function toggleFavorite(id) {

  if (!supabase) {

    showSetupWarning();

    return;

  }


  const session =
    state.session ||
    await getSession();


  if (!session) {

    location.href =
      `/login.html?redirect=${
        encodeURIComponent(
          location.pathname +
          location.search +
          location.hash
        )
      }`;


    return;

  }


  try {

    if (
      state.favorites.has(
        id
      )
    ) {

      const {
        error
      } =
        await supabase

          .from(
            "favorites"
          )

          .delete()

          .eq(
            "user_id",
            session.user.id
          )

          .eq(
            "product_id",
            id
          );


      if (error) {
        throw error;
      }


      state.favorites.delete(
        id
      );


    } else {

      const {
        error
      } =
        await supabase

          .from(
            "favorites"
          )

          .insert(
            {

              user_id:
                session.user.id,

              product_id:
                id

            }
          );


      if (error) {
        throw error;
      }


      state.favorites.add(
        id
      );

    }


    applyFilters();


  } catch (error) {

    console.error(
      error
    );


    showToast(
      error?.message ||
      "Erro ao favoritar produto.",
      "error"
    );

  }

}


function profileComplete(
  profile
) {

  return [

    profile?.full_name,

    profile?.phone,

    profile?.postal_code,

    profile?.street,

    profile?.number,

    profile?.city,

    profile?.state

  ].every(
    value =>
      String(
        value ||
        ""
      )
        .trim()
  );

}


async function checkout() {

  if (
    !state.cart.length
  ) {

    showToast(
      "Seu carrinho está vazio.",
      "error"
    );

    return;

  }


  if (!supabase) {

    showSetupWarning();

    return;

  }


  const button =
    element(
      "checkoutButton"
    );


  const originalText =
    button?.textContent;


  if (button) {

    button.disabled =
      true;

    button.textContent =
      "Preparando pedido...";

  }


  let popup =
    window.open(
      "about:blank",
      "_blank"
    );


  try {

    const session =
      await getSession();


    if (!session) {

      popup?.close();


      location.href =
        `/login.html?redirect=${
          encodeURIComponent(
            "/index.html?checkout=1"
          )
        }`;


      return;

    }


    const profile =
      await getProfile(
        session.user.id
      );


    if (
      !profileComplete(
        profile
      )
    ) {

      popup?.close();


      location.href =
        "/account.html?checkout=1";


      return;

    }


    const items =
      state.cart
        .map(
          item => ({

            product_id:
              item.product_id,

            quantity:
              item.quantity

          })
        );


    const {
      data,
      error
    } =
      await supabase.rpc(
        "create_order",
        {

          p_items:
            items

        }
      );


    if (error) {
      throw error;
    }


    const lines = [

      `Olá! Quero confirmar o pedido #${data.order_number} da Crazy Chicken.`,

      "",

      `Cliente: ${profile.full_name}`,

      `Telefone: ${profile.phone}`,

      "",

      "Produtos:",

      ...state.cart.map(
        item => {

          const product =
            productById(
              item.product_id
            );


          return (
            `${item.quantity}x ` +
            `${product.name} — ` +
            `${formatBRL(
              Number(
                product.price
              )
              *
              item.quantity
            )}`
          );

        }
      ),

      "",

      `Subtotal: ${
        formatBRL(
          data.subtotal
        )
      }`,

      "Frete: a confirmar conforme o CEP",

      `CEP: ${profile.postal_code}`,

      `Endereço: ${profile.street}, ${profile.number}${
        profile.complement
          ? ` - ${profile.complement}`
          : ""
      }`,

      `${profile.city}/${profile.state}`

    ];


    const whatsapp =
      `https://wa.me/${WHATSAPP_NUMBER}?text=${
        encodeURIComponent(
          lines.join(
            "\n"
          )
        )
      }`;


    state.cart =
      [];


    saveCart();


    if (popup) {

      popup.location.href =
        whatsapp;


    } else {

      location.href =
        whatsapp;

    }


  } catch (error) {

    popup?.close();


    console.error(
      "Erro no checkout:",
      error
    );


    showToast(
      error?.message ||
      "Não foi possível finalizar o pedido.",
      "error"
    );


  } finally {

    if (button) {

      button.disabled =
        false;


      button.textContent =
        originalText ||
        "Finalizar pelo WhatsApp";

    }

  }

}


function bindEvents() {

  element(
    "openCart"
  )
    ?.addEventListener(
      "click",
      openCart
    );


  element(
    "closeCart"
  )
    ?.addEventListener(
      "click",
      closeCart
    );


  element(
    "cartBackdrop"
  )
    ?.addEventListener(
      "click",
      closeCart
    );


  element(
    "checkoutButton"
  )
    ?.addEventListener(
      "click",
      checkout
    );


  element(
    "searchInput"
  )
    ?.addEventListener(
      "input",
      event => {

        state.search =
          event.target.value;


        applyFilters();

      }
    );


  element(
    "sortSelect"
  )
    ?.addEventListener(
      "change",
      event => {

        state.sort =
          event.target.value;


        applyFilters();

      }
    );


  element(
    "categoryRow"
  )
    ?.addEventListener(
      "click",
      event => {

        const button =
          event.target.closest(
            "[data-category]"
          );


        if (!button) {
          return;
        }


        state.category =
          button.dataset.category;


        $$(
          ".chip",
          element(
            "categoryRow"
          )
        )
          .forEach(
            chip => {

              chip.classList
                .toggle(
                  "active",
                  chip ===
                  button
                );

            }
          );


        applyFilters();

      }
    );


  element(
    "productGrid"
  )
    ?.addEventListener(
      "click",
      event => {

        const add =
          event.target.closest(
            "[data-add]"
          );


        const favorite =
          event.target.closest(
            "[data-favorite]"
          );


        if (add) {

          addToCart(
            add.dataset.add
          );

        }


        if (favorite) {

          toggleFavorite(
            favorite.dataset.favorite
          );

        }

      }
    );


  element(
    "cartItems"
  )
    ?.addEventListener(
      "click",
      event => {

        const qty =
          event.target.closest(
            "[data-qty]"
          );


        const remove =
          event.target.closest(
            "[data-remove]"
          );


        if (qty) {

          changeQty(
            qty.dataset.id,
            Number(
              qty.dataset.qty
            )
          );

        }


        if (remove) {

          removeFromCart(
            remove.dataset.remove
          );

        }

      }
    );

}


async function init() {

  bindEvents();


  const instagram =
    element(
      "footerInstagram"
    );


  if (instagram) {

    instagram.href =
      INSTAGRAM_URL;

  }


  const whatsapp =
    element(
      "footerWhatsapp"
    );


  if (whatsapp) {

    whatsapp.href =
      `https://wa.me/${WHATSAPP_NUMBER}`;

  }


  const year =
    element(
      "year"
    );


  if (year) {

    year.textContent =
      new Date()
        .getFullYear();

  }


  try {

    await hydrateHeaderAuth();


  } catch (error) {

    console.warn(
      "Cabeçalho de autenticação:",
      error
    );

  }


  if (
    isConfigured &&
    supabase
  ) {

    try {

      state.session =
        await getSession();


    } catch (error) {

      console.warn(
        "Sessão não carregada:",
        error
      );

    }

  }


  await loadProducts();


  if (
    new URLSearchParams(
      location.search
    )
      .get(
        "checkout"
      )
    ===
    "1"
  ) {

    openCart();

  }

}


document
  .addEventListener(
    "DOMContentLoaded",
    init
  );