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


/* =========================================================
   CONFIGURAÇÕES
========================================================= */

const CART_KEY = "crazy_chicken_cart_v4";

const BRAND_ICON =
  "/assets/crazy-chicken-icon.png";


const state = {
  products: [],
  filtered: [],
  cart: loadCart(),
  favorites: new Set(),
  session: null,
  category: "all",
  search: "",
  sort: "featured"
};


/* =========================================================
   ELEMENTOS
========================================================= */

function element(id) {
  return document.getElementById(id);
}


/* =========================================================
   CARRINHO - LOCAL STORAGE
========================================================= */

function loadCart() {

  try {

    const parsed = JSON.parse(
      localStorage.getItem(CART_KEY) || "[]"
    );

    return Array.isArray(parsed)
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
      JSON.stringify(state.cart)
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
   LOCALIZAR PRODUTO
========================================================= */

function productById(id) {

  return state.products.find(
    product =>
      String(product.id) ===
      String(id)
  );

}


/* =========================================================
   NORMALIZAR CARRINHO
========================================================= */

function normalizeCart() {

  state.cart = state.cart
    .map(item => {

      const product =
        productById(item.product_id);

      if (
        !product ||
        !product.active
      ) {
        return null;
      }

      const stock =
        Number(product.stock || 0);

      if (stock <= 0) {
        return null;
      }

      return {
        product_id: product.id,

        quantity: Math.min(
          Math.max(
            Number(item.quantity) || 1,
            1
          ),
          stock
        )
      };

    })
    .filter(Boolean);


  try {

    localStorage.setItem(
      CART_KEY,
      JSON.stringify(state.cart)
    );

  } catch (error) {

    console.warn(
      "Não foi possível normalizar o carrinho:",
      error
    );

  }

}


/* =========================================================
   CARREGAR PRODUTOS
========================================================= */

async function loadProducts() {

  const grid =
    element("productGrid");

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
            Verifique a configuração da loja.
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
    } = await supabase
      .from("products")
      .select(`
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
      `)
      .eq("active", true)
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
      [...state.products];


    /*
      Corrige quantidades antigas caso
      o estoque tenha sido alterado.
    */

    normalizeCart();


    /*
      Monta catálogo.
    */

    renderCategories();

    applyFilters();

    renderCart();


    /*
      Favoritos.
    */

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


/* =========================================================
   CARD DO PRODUTO
========================================================= */

function productCard(product) {

  const stock =
    Number(product.stock || 0);

  const inStock =
    stock > 0;

  const favorite =
    state.favorites.has(product.id);

  const price =
    Number(product.price || 0);

  const comparePrice =
    Number(
      product.compare_at_price || 0
    );

  const hasCompare =
    comparePrice > price;

  const imageSrc =
    product.image_url ||
    BRAND_ICON;


  return `
    <article
      class="product-card"
      data-product-id="${product.id}"
    >

      <div
        class="product-media"
        data-open-product="${product.id}"
        style="cursor:pointer;"
      >

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


        <h3
          data-open-product="${product.id}"
          style="cursor:pointer;"
        >
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


/* =========================================================
   RENDERIZAR PRODUTOS
========================================================= */

function renderProducts() {

  const grid =
    element("productGrid");

  if (!grid) {
    return;
  }


  if (!state.filtered.length) {

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
      .map(productCard)
      .join("");

}


/* =========================================================
   FILTROS
========================================================= */

function applyFilters() {

  const search =
    state.search
      .trim()
      .toLowerCase();


  const list =
    state.products
      .filter(product => {

        const category =
          String(
            product.category ||
            "Outros"
          )
            .trim()
            .toLowerCase();


        const text = `
          ${product.name || ""}
          ${product.description || ""}
          ${product.category || ""}
          ${product.sku || ""}
        `
          .toLowerCase();


        const categoryMatches =
          state.category === "all" ||
          category === state.category;


        const searchMatches =
          !search ||
          text.includes(search);


        return (
          categoryMatches &&
          searchMatches
        );

      });


  list.sort((a, b) => {

    if (
      state.sort ===
      "price-asc"
    ) {

      return (
        Number(a.price) -
        Number(b.price)
      );

    }


    if (
      state.sort ===
      "price-desc"
    ) {

      return (
        Number(b.price) -
        Number(a.price)
      );

    }


    if (
      state.sort ===
      "name"
    ) {

      return String(
        a.name || ""
      ).localeCompare(
        String(
          b.name || ""
        ),
        "pt-BR"
      );

    }


    /*
      Destaques primeiro.
    */

    return (
      Number(
        Boolean(b.featured)
      )
      -
      Number(
        Boolean(a.featured)
      )
      ||
      Number(
        Boolean(b.is_new)
      )
      -
      Number(
        Boolean(a.is_new)
      )
      ||
      new Date(b.created_at)
      -
      new Date(a.created_at)
    );

  });


  state.filtered =
    list;


  renderProducts();

}


/* =========================================================
   CATEGORIAS
========================================================= */

function renderCategories() {

  const row =
    element("categoryRow");

  if (!row) {
    return;
  }


  const categories = [
    ...new Set(
      state.products
        .map(product =>
          String(
            product.category ||
            "Outros"
          ).trim()
        )
        .filter(Boolean)
    )
  ]
    .sort(
      (a, b) =>
        a.localeCompare(
          b,
          "pt-BR"
        )
    );


  row.innerHTML = `

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


    ${
      categories
        .map(category => {

          const normalized =
            category.toLowerCase();

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
                escapeHTML(normalized)
              }"
            >
              ${escapeHTML(category)}
            </button>
          `;

        })
        .join("")
    }
  `;

}


/* =========================================================
   ANIMAÇÃO PRODUTO -> CARRINHO
========================================================= */

function animateProductToCart(
  productId
) {

  const card =
    document.querySelector(
      `[data-product-id="${CSS.escape(
        String(productId)
      )}"]`
    );


  const productImage =
    card?.querySelector(
      ".product-media img"
    );


  const cartButton =
    element("openCart");


  if (
    !productImage ||
    !cartButton
  ) {
    return;
  }


  const imageRect =
    productImage
      .getBoundingClientRect();


  const cartRect =
    cartButton
      .getBoundingClientRect();


  const flyingImage =
    productImage.cloneNode(true);


  flyingImage.style.position =
    "fixed";

  flyingImage.style.left =
    `${imageRect.left}px`;

  flyingImage.style.top =
    `${imageRect.top}px`;

  flyingImage.style.width =
    `${imageRect.width}px`;

  flyingImage.style.height =
    `${imageRect.height}px`;

  flyingImage.style.objectFit =
    "cover";

  flyingImage.style.borderRadius =
    "16px";

  flyingImage.style.zIndex =
    "999999";

  flyingImage.style.pointerEvents =
    "none";

  flyingImage.style.opacity =
    "0.95";

  flyingImage.style.boxShadow =
    "0 12px 35px rgba(0,0,0,.45)";

  flyingImage.style.transition = [
    "left .7s cubic-bezier(.22,.61,.36,1)",
    "top .7s cubic-bezier(.22,.61,.36,1)",
    "width .7s ease",
    "height .7s ease",
    "opacity .7s ease",
    "transform .7s ease"
  ].join(", ");


  document.body.appendChild(
    flyingImage
  );


  requestAnimationFrame(() => {

    requestAnimationFrame(() => {

      flyingImage.style.left =
        `${
          cartRect.left +
          cartRect.width / 2 -
          15
        }px`;

      flyingImage.style.top =
        `${
          cartRect.top +
          cartRect.height / 2 -
          15
        }px`;

      flyingImage.style.width =
        "30px";

      flyingImage.style.height =
        "30px";

      flyingImage.style.opacity =
        "0.25";

      flyingImage.style.transform =
        "rotate(8deg) scale(.5)";

    });

  });


  setTimeout(() => {

    flyingImage.remove();


    if (
      typeof cartButton.animate ===
      "function"
    ) {

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
          easing: "ease-out"
        }
      );

    }

  }, 700);

}


/* =========================================================
   ADICIONAR AO CARRINHO

   NÃO ABRE O CARRINHO AUTOMATICAMENTE.
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
        product.stock || 0
      )
    );


  if (stock <= 0) {

    showToast(
      "Produto sem estoque.",
      "error"
    );

    return;

  }


  const item =
    state.cart.find(
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
      currentQuantity >= stock
    ) {

      showToast(
        "Você atingiu o estoque disponível.",
        "error"
      );

      return;

    }


    item.quantity =
      currentQuantity + 1;


  } else {

    state.cart.push({
      product_id: product.id,
      quantity: 1
    });

  }


  saveCart();


  /*
    Apenas anima o produto indo
    até o ícone do carrinho.
  */

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
========================================================= */

function changeQty(
  id,
  delta
) {

  const item =
    state.cart.find(
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
        product.stock || 0
      )
    );


  const currentQuantity =
    Math.max(
      1,
      Number(
        item.quantity
      ) || 1
    );


  const next =
    currentQuantity +
    Number(delta || 0);


  /*
    Se diminuir de 1 para 0,
    remove o produto.
  */

  if (next <= 0) {

    state.cart =
      state.cart.filter(
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


  /*
    Produto ficou sem estoque.
  */

  if (stock <= 0) {

    state.cart =
      state.cart.filter(
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


  /*
    Nunca ultrapassa o estoque.
  */

  if (next > stock) {

    showToast(
      "Você atingiu o estoque disponível.",
      "error"
    );

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
    state.cart.filter(
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
========================================================= */

function renderCart() {

  const root =
    element("cartItems");

  const count =
    element("cartCount");

  const subtotalEl =
    element("cartSubtotal");


  if (
    !root ||
    !count ||
    !subtotalEl
  ) {
    return;
  }


  const rows =
    state.cart
      .map(item => ({
        item,
        product:
          productById(
            item.product_id
          )
      }))
      .filter(
        row => row.product
      );


  /*
    Quantidade total no ícone.
  */

  const quantity =
    rows.reduce(
      (total, row) =>
        total +
        Math.max(
          0,
          Number(
            row.item.quantity
          ) || 0
        ),
      0
    );


  /*
    Subtotal geral.
  */

  const subtotal =
    rows.reduce(
      (total, row) => {

        const price =
          Number(
            row.product.price || 0
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
          price * itemQuantity
        );

      },
      0
    );


  count.textContent =
    String(quantity);


  subtotalEl.textContent =
    formatBRL(subtotal);


  if (!rows.length) {

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
    rows.map(
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
            product.price || 0
          );


        const stock =
          Math.max(
            0,
            Number(
              product.stock || 0
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
          Mantém estado sincronizado.
        */

        item.quantity =
          itemQuantity;


        const itemSubtotal =
          price *
          itemQuantity;


        const atMaxStock =
          itemQuantity >= stock;


        return `
          <div
            class="cart-item"
            data-cart-item="${
              escapeHTML(
                String(product.id)
              )
            }"
          >

            <div class="cart-thumb">

              <img
                src="${
                  escapeHTML(thumb)
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
                  aria-label="Quantidade de ${
                    escapeHTML(
                      productName
                    )
                  }"
                >

                  <button
                    type="button"
                    data-qty="-1"
                    data-id="${
                      escapeHTML(
                        String(product.id)
                      )
                    }"
                    aria-label="Diminuir quantidade"
                  >
                    −
                  </button>


                  <b class="qty-value">
                    ${itemQuantity}
                  </b>


                  <button
                    type="button"
                    data-qty="1"
                    data-id="${
                      escapeHTML(
                        String(product.id)
                      )
                    }"
                    aria-label="Aumentar quantidade"
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
                    ${
                      formatBRL(
                        itemSubtotal
                      )
                    }
                  </strong>

                </div>

              </div>

            </div>


            <button
              class="remove"
              type="button"
              data-remove="${
                escapeHTML(
                  String(product.id)
                )
              }"
              aria-label="Remover ${
                escapeHTML(
                  productName
                )
              }"
              title="Remover produto"
            >
              ×
            </button>

          </div>
        `;

      }
    ).join("");

}


/* =========================================================
   ABRIR CARRINHO
========================================================= */

function openCart() {

  renderCart();


  element("cartDrawer")
    ?.classList.add("open");


  element("cartBackdrop")
    ?.classList.add("open");


  document.body
    .classList.add(
      "no-scroll"
    );

}


/* =========================================================
   FECHAR CARRINHO
========================================================= */

function closeCart() {

  element("cartDrawer")
    ?.classList.remove("open");


  element("cartBackdrop")
    ?.classList.remove("open");


  document.body
    .classList.remove(
      "no-scroll"
    );

}


/* =========================================================
   FAVORITOS
========================================================= */

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
  } = await supabase
    .from("favorites")
    .select("product_id")
    .eq(
      "user_id",
      state.session.user.id
    );


  if (error) {
    throw error;
  }


  state.favorites =
    new Set(
      (data || []).map(
        row =>
          row.product_id
      )
    );

}


/* =========================================================
   FAVORITAR / DESFAVORITAR
========================================================= */

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
      state.favorites.has(id)
    ) {

      const {
        error
      } = await supabase
        .from("favorites")
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


      state.favorites.delete(id);


    } else {

      const {
        error
      } = await supabase
        .from("favorites")
        .insert({
          user_id:
            session.user.id,

          product_id:
            id
        });


      if (error) {
        throw error;
      }


      state.favorites.add(id);

    }


    applyFilters();


  } catch (error) {

    console.error(
      "Erro ao favoritar:",
      error
    );


    showToast(
      error?.message ||
      "Erro ao favoritar produto.",
      "error"
    );

  }

}


/* =========================================================
   VERIFICAR PERFIL
========================================================= */

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
        value || ""
      ).trim()
  );

}


/* =========================================================
   CHECKOUT
========================================================= */

async function checkout() {

  if (!state.cart.length) {

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

    button.disabled = true;

    button.textContent =
      "Preparando pedido...";

  }


  /*
    Abre antes das operações assíncronas
    para o navegador não bloquear
    o WhatsApp.
  */

  let popup = null;


  try {

    popup =
      window.open(
        "about:blank",
        "_blank"
      );

  } catch (error) {

    console.warn(
      "Popup não pôde ser pré-aberto:",
      error
    );

  }


  try {

    const session =
      await getSession();


    /*
      Precisa estar logado.
    */

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


    /*
      Carrega perfil.
    */

    const profile =
      await getProfile(
        session.user.id
      );


    /*
      Se faltar endereço ou cadastro,
      vai para Minha Conta.
    */

    if (
      !profileComplete(profile)
    ) {

      popup?.close();


      location.href =
        "/account.html?checkout=1";

      return;

    }


    /*
      Garante novamente que nenhuma
      quantidade ultrapassou estoque.
    */

    normalizeCart();

    renderCart();


    if (!state.cart.length) {

      popup?.close();


      showToast(
        "Seu carrinho não possui produtos disponíveis.",
        "error"
      );

      return;

    }


    /*
      Formato esperado pelo RPC.
    */

    const items =
      state.cart.map(
        item => ({
          product_id:
            item.product_id,

          quantity:
            Number(
              item.quantity
            )
        })
      );


    /*
      Cria pedido no Supabase.
    */

    const {
      data,
      error
    } = await supabase.rpc(
      "create_order",
      {
        p_items: items
      }
    );


    if (error) {
      throw error;
    }


    /*
      Mantém compatibilidade caso
      o RPC retorne objeto ou array.
    */

    const orderData =
      Array.isArray(data)
        ? data[0]
        : data;


    const orderNumber =
      orderData?.order_number ||
      orderData?.number ||
      orderData?.id ||
      "Novo pedido";


    /*
      Usa subtotal retornado pelo banco.
      Caso não exista, calcula localmente.
    */

    const localSubtotal =
      state.cart.reduce(
        (total, item) => {

          const product =
            productById(
              item.product_id
            );


          if (!product) {
            return total;
          }


          return (
            total +
            Number(
              product.price || 0
            )
            *
            Number(
              item.quantity || 0
            )
          );

        },
        0
      );


    const finalSubtotal =
      Number(
        orderData?.subtotal
      );

    const subtotal =
      Number.isFinite(
        finalSubtotal
      )
        ? finalSubtotal
        : localSubtotal;


    /*
      Linhas dos produtos.
    */

    const productLines =
      state.cart.map(
        item => {

          const product =
            productById(
              item.product_id
            );


          const itemSubtotal =
            Number(
              product?.price || 0
            )
            *
            Number(
              item.quantity || 0
            );


          return (
            `${item.quantity}x ` +
            `${product?.name || "Produto"} — ` +
            `${formatBRL(itemSubtotal)}`
          );

        }
      );


    /*
      Mensagem final.
    */

    const lines = [

      `Olá! Quero confirmar o pedido #${orderNumber} da Crazy Chicken.`,

      "",

      `Cliente: ${profile.full_name}`,

      `Telefone: ${profile.phone}`,

      "",

      "Produtos:",

      ...productLines,

      "",

      `Subtotal: ${formatBRL(subtotal)}`,

      "",

      "Entrega/frete calculado conforme o CEP.",

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
          lines.join("\n")
        )
      }`;


    /*
      Pedido criado:
      limpa carrinho.
    */

    state.cart = [];

    saveCart();

    closeCart();


    /*
      Abre WhatsApp.
    */

    if (
      popup &&
      !popup.closed
    ) {

      popup.location.href =
        whatsapp;


    } else {

      window.open(
        whatsapp,
        "_blank",
        "noopener"
      );

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
        "📲 Finalizar pelo WhatsApp";

    }

  }

}


/* =========================================================
   BOTÃO DA CONTA NO HERO
========================================================= */

function hydrateHeroAuth() {

  const button =
    document.querySelector(
      ".hero-actions .btn.secondary"
    );


  if (!button) {
    return;
  }


  if (
    state.session?.user
  ) {

    button.href =
      "/account.html";

    button.textContent =
      "👤 Minha conta";


  } else {

    button.href =
      "/login.html";

    button.textContent =
      "👤 Entrar ou criar conta";

  }

}


/* =========================================================
   EVENTOS

   UMA ÚNICA FUNÇÃO.
   NÃO EXISTE bindCartEvents() SEPARADA.
========================================================= */

function bindEvents() {

  /*
    ABRIR CARRINHO
  */

  element("openCart")
    ?.addEventListener(
      "click",
      openCart
    );


  /*
    FECHAR CARRINHO
  */

  element("closeCart")
    ?.addEventListener(
      "click",
      closeCart
    );


  element("cartBackdrop")
    ?.addEventListener(
      "click",
      closeCart
    );


  /*
    CHECKOUT
  */

  element("checkoutButton")
    ?.addEventListener(
      "click",
      checkout
    );


  /*
    PESQUISA
  */

  element("searchInput")
    ?.addEventListener(
      "input",
      event => {

        state.search =
          event.target.value || "";

        applyFilters();

      }
    );


  /*
    ORDENAÇÃO
  */

  element("sortSelect")
    ?.addEventListener(
      "change",
      event => {

        state.sort =
          event.target.value ||
          "featured";

        applyFilters();

      }
    );


  /*
    CATEGORIAS
  */

  element("categoryRow")
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
          button.dataset.category ||
          "all";


        $$(
          ".chip",
          element("categoryRow")
        )
          .forEach(chip => {

            chip.classList.toggle(
              "active",
              chip === button
            );

          });


        applyFilters();

      }
    );


  /*
    PRODUTOS

    Ordem importante:
    1 - adicionar
    2 - favoritar
    3 - abrir produto
  */

  element("productGrid")
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


        const openProductButton =
          event.target.closest(
            "[data-open-product]"
          );


        /*
          ADICIONAR
        */

        if (add) {

          event.preventDefault();

          event.stopPropagation();


          if (add.disabled) {
            return;
          }


          addToCart(
            add.dataset.add
          );

          return;

        }


        /*
          FAVORITAR
        */

        if (favorite) {

          event.preventDefault();

          event.stopPropagation();


          toggleFavorite(
            favorite.dataset.favorite
          );

          return;

        }


        /*
          ABRIR PRODUTO
        */

        if (openProductButton) {

          const id =
            openProductButton
              .dataset
              .openProduct;


          if (!id) {
            return;
          }


          location.href =
            `/produto.html?id=${
              encodeURIComponent(id)
            }`;

        }

      }
    );


  /*
    CARRINHO:
    + / - / remover
  */

  element("cartItems")
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


        /*
          QUANTIDADE
        */

        if (qty) {

          if (qty.disabled) {
            return;
          }


          changeQty(
            qty.dataset.id,
            Number(
              qty.dataset.qty
            )
          );

          return;

        }


        /*
          REMOVER
        */

        if (remove) {

          removeFromCart(
            remove.dataset.remove
          );

        }

      }
    );


  /*
    ESC fecha o carrinho.
  */

  document.addEventListener(
    "keydown",
    event => {

      if (
        event.key === "Escape"
      ) {

        closeCart();

      }

    }
  );

}


/* =========================================================
   INICIALIZAÇÃO

   UMA ÚNICA init().
========================================================= */

async function init() {

  /*
    Eventos.
  */

  bindEvents();


  /*
    Instagram.
  */

  const instagram =
    element(
      "footerInstagram"
    );


  if (instagram) {

    instagram.href =
      INSTAGRAM_URL;

  }


  /*
    WhatsApp.
  */

  const whatsapp =
    element(
      "footerWhatsapp"
    );


  if (whatsapp) {

    whatsapp.href =
      `https://wa.me/${WHATSAPP_NUMBER}`;

  }


  /*
    Ano.
  */

  const year =
    element("year");


  if (year) {

    year.textContent =
      String(
        new Date()
          .getFullYear()
      );

  }


  /*
    Cabeçalho de autenticação.
  */

  try {

    await hydrateHeaderAuth();

  } catch (error) {

    console.warn(
      "Cabeçalho de autenticação:",
      error
    );

  }


  /*
    Sessão.
  */

  if (
    isConfigured &&
    supabase
  ) {

    try {

      state.session =
        await getSession();


      hydrateHeroAuth();


    } catch (error) {

      console.warn(
        "Sessão não carregada:",
        error
      );


      state.session = null;

      hydrateHeroAuth();

    }


    /*
      Login / logout em tempo real.
    */

    supabase.auth
      .onAuthStateChange(
        async (
          _event,
          session
        ) => {

          state.session =
            session;


          hydrateHeroAuth();


          try {

            await hydrateHeaderAuth();

          } catch (error) {

            console.warn(
              "Cabeçalho não atualizado:",
              error
            );

          }


          /*
            Atualiza favoritos quando
            a sessão mudar.
          */

          try {

            if (session) {

              await loadFavorites();

            } else {

              state.favorites =
                new Set();

            }


            applyFilters();


          } catch (error) {

            console.warn(
              "Favoritos não atualizados:",
              error
            );

          }

        }
      );


  } else {

    hydrateHeroAuth();

  }


  /*
    Carrega catálogo.
  */

  await loadProducts();


  /*
    Comprar agora / retorno do login.

    produto.html envia:
    /index.html?checkout=1

    Nesse caso o carrinho abre.
  */

  const params =
    new URLSearchParams(
      location.search
    );


  if (
    params.get("checkout") ===
    "1"
  ) {

    openCart();


    /*
      Remove checkout=1 da URL
      sem atualizar a página.
    */

    try {

      const url =
        new URL(
          location.href
        );


      url.searchParams.delete(
        "checkout"
      );


      history.replaceState(
        {},
        "",
        url.pathname +
        url.search +
        url.hash
      );


    } catch (error) {

      console.warn(
        "Não foi possível limpar checkout da URL:",
        error
      );

    }

  }

}


/* =========================================================
   INICIAR A LOJA

   Apenas UMA inicialização.
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  init
);