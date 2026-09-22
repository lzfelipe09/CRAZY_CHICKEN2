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


/* =========================================================
   ELEMENTOS
========================================================= */

function element(id) {

  return document
    .getElementById(id);

}


/* =========================================================
   CARRINHO - LOCAL STORAGE
========================================================= */

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


  } catch (error) {

    console.warn(
      "Não foi possível carregar o carrinho:",
      error
    );


    return [];

  }

}


function saveCart() {

  try {

    localStorage.setItem(
      CART_KEY,
      JSON.stringify(
        state.cart
      )
    );


  } catch (error) {

    console.warn(
      "Não foi possível salvar o carrinho:",
      error
    );

  }


  renderCart();

}


/* =========================================================
   PRODUTO PELO ID
========================================================= */

function productById(id) {

  return state.products
    .find(
      product =>
        String(
          product.id
        )
        ===
        String(id)
    );

}


/* =========================================================
   NORMALIZAÇÃO DO CARRINHO
========================================================= */

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

      .filter(Boolean);


  try {

    localStorage.setItem(
      CART_KEY,
      JSON.stringify(
        state.cart
      )
    );


  } catch (error) {

    console.warn(
      "Não foi possível normalizar o carrinho:",
      error
    );

  }

}


/* =========================================================
   PRODUTOS
========================================================= */

async function loadProducts() {

  const grid =
    element(
      "productGrid"
    );


  if (
    !isConfigured ||
    !supabase
  ) {

    showSetupWarning?.();


    if (grid) {

      grid.innerHTML = `
        <div class="empty">

          <div>

            <strong>
              Loja ainda não configurada.
            </strong>

            <span>
              Configure o Supabase para carregar os produtos.
            </span>

          </div>

        </div>
      `;

    }


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
          "*"
        )

        .eq(
          "active",
          true
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


    normalizeCart();


    buildCategories();


    applyFilters();


    renderCart();


  } catch (error) {

    console.error(
      "Erro ao carregar produtos:",
      error
    );


    if (grid) {

      grid.innerHTML = `
        <div class="empty">

          <div>

            <strong>
              Não foi possível carregar os produtos.
            </strong>

            <span>
              Tente novamente em alguns instantes.
            </span>

          </div>

        </div>
      `;

    }


    showToast(
      "Não foi possível carregar os produtos.",
      "error"
    );

  }

}


/* =========================================================
   CATEGORIAS
========================================================= */

function getProductCategory(
  product
) {

  return String(
    product.category ||
    product.categoria ||
    ""
  )
    .trim();

}


function buildCategories() {

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
              getProductCategory(
                product
              )
          )

          .filter(Boolean)

      )

    ];


  const buttons = [

    `
      <button
        class="chip ${
          state.category === "all"
            ? "active"
            : ""
        }"
        type="button"
        data-category="all"
      >
        Todos
      </button>
    `,

    ...categories.map(
      category => `

        <button
          class="chip ${
            state.category === category
              ? "active"
              : ""
          }"
          type="button"
          data-category="${
            escapeHTML(
              category
            )
          }"
        >
          ${
            escapeHTML(
              category
            )
          }
        </button>

      `
    )

  ];


  row.innerHTML =
    buttons.join("");

}


/* =========================================================
   BUSCA / FILTRO / ORDENAÇÃO
========================================================= */

function normalizeText(
  value
) {

  return String(
    value ||
    ""
  )

    .normalize(
      "NFD"
    )

    .replace(
      /[\u0300-\u036f]/g,
      ""
    )

    .toLowerCase()

    .trim();

}


function applyFilters() {

  let products =
    [...state.products];


  if (
    state.category !==
    "all"
  ) {

    products =
      products.filter(
        product =>
          getProductCategory(
            product
          )
          ===
          state.category
      );

  }


  const search =
    normalizeText(
      state.search
    );


  if (search) {

    products =
      products.filter(
        product => {

          const haystack =
            normalizeText(
              [
                product.name,
                product.description,
                product.category,
                product.categoria
              ]
                .filter(Boolean)
                .join(" ")
            );


          return haystack
            .includes(
              search
            );

        }
      );

  }


  switch (
    state.sort
  ) {

    case "price-asc":

      products.sort(
        (a, b) =>
          Number(
            a.price ||
            0
          )
          -
          Number(
            b.price ||
            0
          )
      );

      break;


    case "price-desc":

      products.sort(
        (a, b) =>
          Number(
            b.price ||
            0
          )
          -
          Number(
            a.price ||
            0
          )
      );

      break;


    case "name":

      products.sort(
        (a, b) =>
          String(
            a.name ||
            ""
          )
            .localeCompare(
              String(
                b.name ||
                ""
              ),
              "pt-BR"
            )
      );

      break;


    default:

      /*
      Mantém a ordem recebida
      do banco para destaques.
      */

      break;

  }


  state.filtered =
    products;


  renderProducts();

}


/* =========================================================
   CARDS DOS PRODUTOS
========================================================= */

function productCard(
  product
) {

  const id =
    String(
      product.id
    );


  const name =
    String(
      product.name ||
      "Produto"
    );


  const description =
    String(
      product.description ||
      ""
    );


  const category =
    getProductCategory(
      product
    ) ||
    "Produto";


  const image =
    product.image_url ||
    BRAND_ICON;


  const price =
    Number(
      product.price ||
      0
    );


  const comparePrice =
    Number(
      product.compare_price ||
      product.old_price ||
      0
    );


  const stock =
    Number(
      product.stock ||
      0
    );


  const isFavorite =
    state.favorites
      .has(id);


  const outOfStock =
    stock <= 0;


  return `
    <article
      class="product-card"
      data-product-card="${escapeHTML(id)}"
    >

      <div
        class="product-media"
        data-open-product="${escapeHTML(id)}"
        role="button"
        tabindex="0"
        aria-label="Abrir ${escapeHTML(name)}"
      >

        <img
          src="${escapeHTML(image)}"
          alt="${escapeHTML(name)}"
          loading="lazy"
          onerror="
            this.onerror=null;
            this.src='${BRAND_ICON}'
          "
        >


        <div class="badges">

          ${
            outOfStock
              ? `
                <span>
                  Sem estoque
                </span>
              `
              : ""
          }

          ${
            !outOfStock &&
            stock <= 3
              ? `
                <span>
                  Últimas unidades
                </span>
              `
              : ""
          }

        </div>


        <button
          class="favorite ${
            isFavorite
              ? "active"
              : ""
          }"
          type="button"
          data-favorite="${escapeHTML(id)}"
          aria-label="Favoritar ${escapeHTML(name)}"
          title="Favoritar"
        >
          ${
            isFavorite
              ? "♥"
              : "♡"
          }
        </button>

      </div>


      <div class="product-body">

        <small>
          ${escapeHTML(category)}
        </small>


        <h3>
          ${escapeHTML(name)}
        </h3>


        <p>
          ${escapeHTML(description)}
        </p>


        <div class="price-line">

          <div>

            ${
              comparePrice >
              price
                ? `
                  <s>
                    ${formatBRL(comparePrice)}
                  </s>
                `
                : ""
            }

            <strong>
              ${formatBRL(price)}
            </strong>

          </div>


          <span>

            ${
              outOfStock
                ? "Indisponível"
                : `${stock} em estoque`
            }

          </span>

        </div>


        <button
          class="btn primary"
          type="button"
          data-add="${escapeHTML(id)}"
          ${
            outOfStock
              ? "disabled"
              : ""
          }
        >

          ${
            outOfStock
              ? "Sem estoque"
              : "Adicionar ao carrinho"
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
            Tente alterar a pesquisa ou categoria.
          </span>

        </div>

      </div>
    `;


    return;

  }


  grid.innerHTML =
    state.filtered

      .map(
        product =>
          productCard(
            product
          )
      )

      .join("");

}


/* =========================================================
   FAVORITOS
========================================================= */

function toggleFavorite(
  id
) {

  const key =
    String(id);


  if (
    state.favorites
      .has(key)
  ) {

    state.favorites
      .delete(key);


  } else {

    state.favorites
      .add(key);

  }


  renderProducts();

}


/* =========================================================
   ABRIR PRODUTO
========================================================= */

function openProduct(
  id
) {

  if (!id) {

    return;

  }


  location.href =
    `/produto.html?id=${
      encodeURIComponent(
        id
      )
    }`;

}


/* =========================================================
   ANIMAÇÃO PRODUTO -> CARRINHO
========================================================= */

function animateProductToCart(
  productId
) {

  const card =
    document.querySelector(
      `[data-product-card="${CSS.escape(String(productId))}"]`
    );


  const image =
    card?.querySelector(
      ".product-media img"
    );


  const cartButton =
    element(
      "openCart"
    );


  if (
    !image ||
    !cartButton
  ) {

    return;

  }


  const imageRect =
    image.getBoundingClientRect();


  const cartRect =
    cartButton.getBoundingClientRect();


  const clone =
    image.cloneNode(true);


  clone.style.position =
    "fixed";


  clone.style.left =
    `${imageRect.left}px`;


  clone.style.top =
    `${imageRect.top}px`;


  clone.style.width =
    `${imageRect.width}px`;


  clone.style.height =
    `${imageRect.height}px`;


  clone.style.objectFit =
    "cover";


  clone.style.borderRadius =
    "14px";


  clone.style.zIndex =
    "9999";


  clone.style.pointerEvents =
    "none";


  clone.style.boxShadow =
    "0 16px 35px rgba(0,0,0,.35)";


  clone.style.transition =
    [
      "left .7s cubic-bezier(.22,.61,.36,1)",
      "top .7s cubic-bezier(.22,.61,.36,1)",
      "width .7s ease",
      "height .7s ease",
      "opacity .7s ease",
      "transform .7s ease"
    ]
      .join(", ");


  document.body
    .appendChild(
      clone
    );


  requestAnimationFrame(
    () => {

      clone.style.left =
        `${
          cartRect.left +
          cartRect.width / 2 -
          12
        }px`;


      clone.style.top =
        `${
          cartRect.top +
          cartRect.height / 2 -
          12
        }px`;


      clone.style.width =
        "24px";


      clone.style.height =
        "24px";


      clone.style.opacity =
        ".15";


      clone.style.transform =
        "rotate(8deg) scale(.5)";

    }
  );


  setTimeout(
    () => {

      clone.remove();

    },
    760
  );


  setTimeout(
    () => {

      cartButton.animate(
        [

          {
            transform:
              "scale(1)"
          },

          {
            transform:
              "scale(1.18)"
          },

          {
            transform:
              "scale(.95)"
          },

          {
            transform:
              "scale(1)"
          }

        ],
        {

          duration: 350,

          easing:
            "ease-out"

        }
      );

    },
    700
  );

}


/* =========================================================
   ADICIONAR AO CARRINHO

   IMPORTANTE:
   adicionar NÃO abre o drawer automaticamente.
========================================================= */

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
    Math.max(
      0,
      Number(
        product.stock ||
        0
      )
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

    const currentQuantity =
      Math.max(
        1,
        Number(
          item.quantity
        ) || 1
      );


    if (
      currentQuantity >=
      stock
    ) {

      showToast(
        "Você atingiu o estoque disponível.",
        "error"
      );


      return;

    }


    item.quantity =
      currentQuantity +
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


  animateProductToCart(
    product.id
  );


  showToast(
    "Produto adicionado ao carrinho.",
    "success"
  );

}


/* =========================================================
   ALTERAR QUANTIDADE

   O + nunca ultrapassa o estoque real.
========================================================= */

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


  const stock =
    Math.max(
      0,
      Number(
        product.stock ||
        0
      )
    );


  const currentQuantity =
    Math.max(
      1,
      Number(
        item.quantity
      ) || 1
    );


  const change =
    Number(
      delta
    ) || 0;


  const next =
    currentQuantity +
    change;


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


    saveCart();


    return;

  }


  if (
    stock <= 0
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


    saveCart();


    showToast(
      "Este produto ficou sem estoque.",
      "error"
    );


    return;

  }


  if (
    next >
    stock
  ) {

    showToast(
      "Você atingiu o estoque disponível.",
      "error"
    );


    /*
      Ainda renderizamos para garantir
      que o botão + permaneça bloqueado.
    */

    renderCart();


    return;

  }


  item.quantity =
    next;


  saveCart();

}


/* =========================================================
   REMOVER DO CARRINHO
========================================================= */

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


  showToast(
    "Produto removido do carrinho.",
    "success"
  );

}


/* =========================================================
   RENDERIZAR CARRINHO

   Cada produto mostra:
   - foto
   - nome
   - preço unitário
   - estoque
   - quantidade
   - subtotal daquele item
========================================================= */

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
      ) => {

        return (
          total +
          Math.max(
            0,
            Number(
              row.item.quantity
            ) || 0
          )
        );

      },
      0
    );


  const subtotal =
    rows.reduce(
      (
        total,
        row
      ) => {

        const price =
          Number(
            row.product.price ||
            0
          );


        const itemQuantity =
          Math.max(
            0,
            Number(
              row.item.quantity
            ) || 0
          );


        return (
          total +
          price *
          itemQuantity
        );

      },
      0
    );


  count.textContent =
    String(
      quantity
    );


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


          const productName =
            String(
              product.name ||
              "Produto"
            );


          const price =
            Number(
              product.price ||
              0
            );


          const stock =
            Math.max(
              0,
              Number(
                product.stock ||
                0
              )
            );


          const itemQuantity =
            Math.min(
              Math.max(
                1,
                Number(
                  item.quantity
                ) || 1
              ),
              Math.max(
                stock,
                1
              )
            );


          /*
            Mantém o objeto sincronizado
            com a quantidade exibida.
          */

          item.quantity =
            itemQuantity;


          const itemSubtotal =
            price *
            itemQuantity;


          const atMaxStock =
            itemQuantity >=
            stock;


          return `
            <div
              class="cart-item"
              data-cart-item="${escapeHTML(String(product.id))}"
            >

              <div class="cart-thumb">

                <img
                  src="${
                    escapeHTML(
                      thumb
                    )
                  }"
                  alt="${
                    escapeHTML(
                      productName
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
                      productName
                    )
                  }
                </strong>


                <span class="cart-unit-price">
                  ${formatBRL(price)} cada
                </span>


                <div class="cart-stock">

                  ${
                    stock > 0
                      ? `${stock} ${
                          stock === 1
                            ? "unidade disponível"
                            : "unidades disponíveis"
                        }`
                      : "Sem estoque"
                  }

                </div>


                <div class="cart-item-bottom">

                  <div
                    class="qty"
                    aria-label="Quantidade de ${escapeHTML(productName)}"
                  >

                    <button
                      type="button"
                      data-qty="-1"
                      data-id="${escapeHTML(String(product.id))}"
                      aria-label="Diminuir quantidade de ${escapeHTML(productName)}"
                    >
                      −
                    </button>


                    <b class="qty-value">
                      ${itemQuantity}
                    </b>


                    <button
                      type="button"
                      data-qty="1"
                      data-id="${escapeHTML(String(product.id))}"
                      aria-label="Aumentar quantidade de ${escapeHTML(productName)}"
                      ${
                        atMaxStock
                          ? "disabled"
                          : ""
                      }
                    >
                      +
                    </button>

                  </div>


                  <div class="cart-item-subtotal">

                    <span>
                      Subtotal
                    </span>

                    <strong>
                      ${formatBRL(itemSubtotal)}
                    </strong>

                  </div>

                </div>

              </div>


              <button
                class="remove"
                type="button"
                data-remove="${escapeHTML(String(product.id))}"
                aria-label="Remover ${escapeHTML(productName)} do carrinho"
                title="Remover produto"
              >
                ×
              </button>

            </div>
          `;

        }
      )

      .join("");

}


/* =========================================================
   ABRIR CARRINHO
========================================================= */

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


/* =========================================================
   FECHAR CARRINHO
========================================================= */

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

/* =========================================================
   EVENTOS GERAIS
========================================================= */

function bindEvents() {

  bindCartEvents();

  bindProductEvents();

  bindCatalogEvents();

}


/* =========================================================
   ESTADO INICIAL DO CARRINHO

   Mostra a quantidade imediatamente,
   mesmo antes de os produtos terminarem
   de carregar do Supabase.
========================================================= */

function renderInitialCartCount() {

  const count =
    element(
      "cartCount"
    );


  if (!count) {

    return;

  }


  const quantity =
    state.cart.reduce(
      (
        total,
        item
      ) => {

        return (
          total +
          Math.max(
            0,
            Number(
              item.quantity
            ) || 0
          )
        );

      },
      0
    );


  count.textContent =
    String(
      quantity
    );

}


/* =========================================================
   INICIALIZAÇÃO
========================================================= */

async function init() {

  /*
    Primeiro registramos todos
    os eventos da interface.
  */

  bindEvents();


  /*
    Informações estáticas.
  */

  hydrateFooter();


  /*
    Exibe imediatamente o número
    salvo no carrinho.
  */

  renderInitialCartCount();


  /*
    Autenticação.
  */

  await hydrateAuth();


  /*
    Observa login/logout.
  */

  watchAuthChanges();


  /*
    Carrega catálogo.
    Essa função também normaliza
    e renderiza o carrinho.
  */

  await loadProducts();


  /*
    Caso o usuário tenha chegado
    com ?checkout=1, abre o carrinho
    depois que os produtos existem.
  */

  handleCheckoutQuery();

}


/* =========================================================
   START
========================================================= */

init()
  .catch(
    error => {

      console.error(
        "Erro ao iniciar a loja:",
        error
      );


      showToast(
        "Ocorreu um erro ao iniciar a loja.",
        "error"
      );

    }
  );

