import {
  supabase,
  isConfigured
} from "/js/supabaseClient.js";


const CART_KEY =
  "crazy_chicken_cart_v4";


const BRAND_ICON =
  "/assets/crazy-chicken-icon.png";


let product = null;

let cart =
  loadCart();


/* =========================
   ELEMENTO
========================= */

function element(id) {

  return document
    .getElementById(id);

}


/* =========================
   SEGURANÇA HTML
========================= */

function escapeHTML(value) {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


/* =========================
   FORMATAR PREÇO
========================= */

function formatBRL(value) {

  return new Intl.NumberFormat(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL"
    }
  ).format(
    Number(value || 0)
  );

}


/* =========================
   CARREGAR CARRINHO
========================= */

function loadCart() {

  try {

    const parsed =
      JSON.parse(
        localStorage.getItem(
          CART_KEY
        ) || "[]"
      );


    return Array.isArray(parsed)
      ? parsed
      : [];


  } catch {

    return [];

  }

}


/* =========================
   SALVAR CARRINHO
========================= */

function saveCart() {

  localStorage.setItem(
    CART_KEY,
    JSON.stringify(cart)
  );

  renderCart();

}


/* =========================
   TOAST
========================= */

function showToast(message) {

  const toast =
    element("toast");


  if (!toast) {
    return;
  }


  toast.textContent =
    message;


  toast.classList.add(
    "show"
  );


  clearTimeout(
    showToast.timer
  );


  showToast.timer =
    setTimeout(
      () => {

        toast.classList.remove(
          "show"
        );

      },
      2200
    );

}


/* =========================
   ID DO PRODUTO
========================= */

function getProductId() {

  const params =
    new URLSearchParams(
      location.search
    );


  return params.get("id");

}


/* =========================
   CARREGAR PRODUTO
========================= */

async function loadProduct() {

  const root =
    element("productRoot");


  const productId =
    getProductId();


  if (!productId) {

    root.innerHTML = `
      <div class="error-box">
        Produto não encontrado.
      </div>
    `;

    return;

  }


  if (
    !isConfigured ||
    !supabase
  ) {

    root.innerHTML = `
      <div class="error-box">
        Não foi possível conectar à loja.
      </div>
    `;

    return;

  }


  try {

    const {
      data,
      error
    } =
      await supabase

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
          active
        `)

        .eq(
          "id",
          productId
        )

        .eq(
          "active",
          true
        )

        .single();


    if (error) {
      throw error;
    }


    if (!data) {
      throw new Error(
        "Produto não encontrado."
      );
    }


    product =
      data;


    renderProduct();


    await loadRelatedProducts();


  } catch (error) {

    console.error(
      "Erro ao carregar produto:",
      error
    );


    root.innerHTML = `
      <div class="error-box">
        <div>

          <strong>
            Produto não encontrado.
          </strong>

          <p>
            Ele pode ter sido removido
            ou estar indisponível.
          </p>

        </div>
      </div>
    `;

  }

}


/* =========================
   RENDERIZAR PRODUTO
========================= */

function renderProduct() {

  const root =
    element("productRoot");


  if (
    !root ||
    !product
  ) {
    return;
  }


  const price =
    Number(
      product.price || 0
    );


  const comparePrice =
    Number(
      product.compare_at_price ||
      0
    );


  const stock =
    Number(
      product.stock || 0
    );


  const available =
    stock > 0;


  const lowStock =
    stock > 0 &&
    stock <= 3;


  const hasCompare =
    comparePrice > price;


  const image =
    product.image_url ||
    BRAND_ICON;


  /*
    Define o visual do estoque.

    4 ou mais:
    verde.

    1 até 3:
    amarelo.

    0:
    vermelho.
  */

  let stockClass =
    "unavailable";


  let stockText =
    "Produto indisponível";


  if (stock >= 4) {

    stockClass =
      "available";


    stockText =
      `${stock} unidades disponíveis`;

  } else if (lowStock) {

    stockClass =
      "low-stock";


    stockText =
      stock === 1
        ? "Última unidade disponível"
        : `Últimas ${stock} unidades`;

  }


  document.title =
    `${
      product.name ||
      "Produto"
    } | Crazy Chicken`;


  root.innerHTML = `

    <div class="product-layout">

      <!-- =========================
           GALERIA
      ========================== -->

      <section class="gallery">

        <div
          class="main-image"
          id="mainImageButton"
          role="button"
          tabindex="0"
          aria-label="Ampliar imagem"
        >

          <img
            id="mainProductImage"
            src="${escapeHTML(image)}"
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


        <div class="image-tip">
          Toque na imagem para ampliar
        </div>

      </section>


      <!-- =========================
           DETALHES
      ========================== -->

      <section class="details">

        <span class="category">
          ${
            escapeHTML(
              product.category ||
              "Produtos"
            )
          }
        </span>


        <h1 class="title">
          ${
            escapeHTML(
              product.name ||
              "Produto"
            )
          }
        </h1>


        <!-- =========================
             ESTOQUE
        ========================== -->

        <span
          class="stock ${stockClass}"
        >

          <span
            class="stock-dot"
            aria-hidden="true"
          ></span>

          ${stockText}

        </span>


        <!-- =========================
             PREÇO
        ========================== -->

        <div class="price-box">

          ${
            hasCompare
              ? `
                <span class="old-price">
                  ${formatBRL(comparePrice)}
                </span>
              `
              : ""
          }


          <strong class="price">
            ${formatBRL(price)}
          </strong>


          <span class="payment-note">
            Valor do produto. Entrega calculada conforme o CEP.
          </span>

        </div>


        <!-- =========================
             INFORMAÇÕES DA COMPRA
        ========================== -->

        <div class="purchase-info">


          <!-- ENTREGA -->

          <div class="purchase-info-item">

            <div
              class="purchase-info-icon"
              aria-hidden="true"
            >
              📍
            </div>


            <div class="purchase-info-text">

              <strong>
                Entrega
              </strong>

              <span>
                Valor e disponibilidade da entrega
                são calculados conforme o CEP.
              </span>

            </div>

          </div>


          <!-- WHATSAPP -->

          <div class="purchase-info-item">

            <div
              class="purchase-info-icon"
              aria-hidden="true"
            >
              💬
            </div>


            <div class="purchase-info-text">

              <strong>
                Atendimento direto
              </strong>

              <span>
                O pedido é finalizado diretamente
                pelo WhatsApp da Crazy Chicken.
              </span>

            </div>

          </div>


          <!-- CARRINHO -->

          <div class="purchase-info-item">

            <div
              class="purchase-info-icon"
              aria-hidden="true"
            >
              🛒
            </div>


            <div class="purchase-info-text">

              <strong>
                Carrinho
              </strong>

              <span>
                Adicione outros produtos antes
                de finalizar o seu pedido.
              </span>

            </div>

          </div>


        </div>


        <!-- =========================
             BOTÕES
        ========================== -->

        <div class="actions">

          <button
            id="buyNow"
            class="btn buy-now"
            type="button"
            ${
              available
                ? ""
                : "disabled"
            }
          >

            ${
              available
                ? "Comprar agora"
                : "Produto sem estoque"
            }

          </button>


          <button
            id="addCart"
            class="btn add-cart"
            type="button"
            ${
              available
                ? ""
                : "disabled"
            }
          >

            ${
              available
                ? "Adicionar ao carrinho"
                : "Indisponível"
            }

          </button>

        </div>


        <!-- =========================
             DESCRIÇÃO
        ========================== -->

        <div class="description">

          <h2>
            Descrição do produto
          </h2>


          <p>
            ${
              escapeHTML(
                product.description ||
                "Sem descrição disponível."
              )
            }
          </p>

        </div>

      </section>

    </div>
  `;


  bindProductEvents();

}


/* =========================
   PRODUTOS RELACIONADOS
========================= */

async function loadRelatedProducts() {

  const section =
    element("relatedSection");

  const root =
    element("relatedProducts");


  if (
    !section ||
    !root ||
    !product ||
    !supabase
  ) {
    return;
  }


  /*
    A seção começa escondida.

    Ela só aparece caso realmente
    existam outros produtos da mesma
    categoria.
  */

  section.hidden =
    true;


  root.innerHTML =
    "";


  const category =
    String(
      product.category || ""
    ).trim();


  if (!category) {
    return;
  }


  try {

    const {
      data,
      error
    } =
      await supabase

        .from("products")

        .select(`
          id,
          name,
          category,
          price,
          compare_at_price,
          stock,
          image_url,
          is_new,
          featured,
          active
        `)


        /*
          Apenas produtos ativos.
        */

        .eq(
          "active",
          true
        )


        /*
          Apenas produtos da mesma
          categoria do produto atual.
        */

        .eq(
          "category",
          category
        )


        /*
          Não mostra o próprio produto
          que o cliente já está vendo.
        */

        .neq(
          "id",
          product.id
        )


        /*
          Produtos destacados aparecem
          primeiro.
        */

        .order(
          "featured",
          {
            ascending: false
          }
        )


        /*
          No máximo quatro produtos.
        */

        .limit(4);


    if (error) {
      throw error;
    }


    const related =
      Array.isArray(data)
        ? data
        : [];


    /*
      Se não houver nenhum produto
      relacionado, a seção continua
      escondida.
    */

    if (!related.length) {
      return;
    }


    root.innerHTML =
      related

        .map(

          relatedProduct => {

            const price =
              Number(
                relatedProduct.price ||
                0
              );


            const comparePrice =
              Number(
                relatedProduct
                  .compare_at_price ||
                0
              );


            const hasCompare =
              comparePrice > price;


            const stock =
              Number(
                relatedProduct.stock ||
                0
              );


            const image =
              relatedProduct.image_url ||
              BRAND_ICON;


            return `

              <a
                class="related-card"
                href="/produto.html?id=${
                  encodeURIComponent(
                    relatedProduct.id
                  )
                }"
              >


                <div class="related-image">

                  <img
                    src="${escapeHTML(image)}"
                    alt="${
                      escapeHTML(
                        relatedProduct.name ||
                        "Produto"
                      )
                    }"
                    loading="lazy"
                    onerror="
                      this.onerror=null;
                      this.src='${BRAND_ICON}'
                    "
                  >


                  ${
                    relatedProduct.is_new
                      ? `
                        <span class="related-new">
                          Novidade
                        </span>
                      `
                      : ""
                  }

                </div>


                <div class="related-info">


                  <span class="related-category">

                    ${
                      escapeHTML(
                        relatedProduct.category ||
                        "Produtos"
                      )
                    }

                  </span>


                  <h3 class="related-name">

                    ${
                      escapeHTML(
                        relatedProduct.name ||
                        "Produto"
                      )
                    }

                  </h3>


                  <span class="related-old-price">

                    ${
                      hasCompare
                        ? formatBRL(
                            comparePrice
                          )
                        : "&nbsp;"
                    }

                  </span>


                  <strong class="related-price">

                    ${
                      formatBRL(
                        price
                      )
                    }

                  </strong>


                  <span class="related-stock">

                    ${
                      stock > 0
                        ? `${stock} em estoque`
                        : "Indisponível"
                    }

                  </span>


                </div>

              </a>

            `;

          }

        )

        .join("");


    /*
      Agora que existem produtos,
      mostramos a seção.
    */

    section.hidden =
      false;


  } catch (error) {

    console.error(
      "Erro ao carregar produtos relacionados:",
      error
    );


    section.hidden =
      true;


    root.innerHTML =
      "";

  }

}


/* =========================
   ADICIONAR PRODUTO
========================= */

function addCurrentProduct() {

  if (!product) {
    return false;
  }


  const stock =
    Number(
      product.stock || 0
    );


  if (stock <= 0) {

    showToast(
      "Produto sem estoque."
    );

    return false;

  }


  const item =
    cart.find(
      entry =>
        String(
          entry.product_id
        ) ===
        String(
          product.id
        )
    );


  if (item) {

    if (
      Number(
        item.quantity
      ) >= stock
    ) {

      showToast(
        "Você atingiu o estoque disponível."
      );

      return false;

    }


    item.quantity =
      Number(
        item.quantity
      ) + 1;


  } else {

    cart.push({

      product_id:
        product.id,

      quantity:
        1

    });

  }


  saveCart();


  return true;

}


/* =========================
   ADICIONAR AO CARRINHO
========================= */

function addToCart() {

  const added =
    addCurrentProduct();


  if (!added) {
    return;
  }


  showToast(
    "Produto adicionado ao carrinho."
  );


  animateCartButton();

}


/* =========================
   COMPRAR AGORA
========================= */

function buyNow() {

  const added =
    addCurrentProduct();


  if (!added) {
    return;
  }


  /*
    Volta para o index com
    checkout=1.

    O store.js reconhece esse
    parâmetro e abre o carrinho.
  */

  location.href =
    "/index.html?checkout=1";

}


/* =========================
   ANIMAÇÃO DO CARRINHO
========================= */

function animateCartButton() {

  const button =
    element("openCart");


  if (
    !button ||
    !button.animate
  ) {
    return;
  }


  button.animate(
    [

      {
        transform:
          "scale(1)"
      },

      {
        transform:
          "scale(1.12)"
      },

      {
        transform:
          "scale(.96)"
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

}


/* =========================
   CARRINHO
========================= */

function renderCart() {

  const count =
    element("cartCount");


  const itemsRoot =
    element("cartItems");


  const subtotalRoot =
    element("cartSubtotal");


  if (
    !count ||
    !itemsRoot ||
    !subtotalRoot
  ) {
    return;
  }


  const totalQuantity =
    cart.reduce(

      (total, item) =>

        total +

        Number(
          item.quantity || 0
        ),

      0

    );


  count.textContent =
    totalQuantity;


  renderCartProducts();

}


/* =========================
   PRODUTOS DO CARRINHO
========================= */

async function renderCartProducts() {

  const root =
    element("cartItems");


  const subtotalRoot =
    element("cartSubtotal");


  if (
    !root ||
    !subtotalRoot
  ) {
    return;
  }


  if (!cart.length) {

    root.innerHTML = `
      <div class="cart-empty">
        Seu carrinho está vazio.
      </div>
    `;


    subtotalRoot.textContent =
      formatBRL(0);


    return;

  }


  if (!supabase) {
    return;
  }


  try {

    const ids =
      [

        ...new Set(

          cart.map(

            item =>
              item.product_id

          )

        )

      ];


    const {
      data,
      error
    } =
      await supabase

        .from("products")

        .select(`
          id,
          name,
          price,
          image_url
        `)

        .in(
          "id",
          ids
        );


    if (error) {
      throw error;
    }


    const products =
      Array.isArray(data)
        ? data
        : [];


    let subtotal =
      0;


    const rows =
      cart

        .map(

          item => {

            const cartProduct =
              products.find(

                entry =>

                  String(
                    entry.id
                  ) ===

                  String(
                    item.product_id
                  )

              );


            if (!cartProduct) {
              return "";
            }


            const quantity =
              Number(
                item.quantity || 1
              );


            subtotal +=

              Number(
                cartProduct.price || 0
              )

              *

              quantity;


            return `

              <div class="cart-item">


                <img
                  src="${
                    escapeHTML(
                      cartProduct.image_url ||
                      BRAND_ICON
                    )
                  }"

                  alt="${
                    escapeHTML(
                      cartProduct.name ||
                      "Produto"
                    )
                  }"

                  onerror="
                    this.onerror=null;
                    this.src='${BRAND_ICON}'
                  "
                >


                <div class="cart-item-info">


                  <strong>

                    ${
                      escapeHTML(
                        cartProduct.name ||
                        "Produto"
                      )
                    }

                  </strong>


                  <span>

                    ${quantity}x

                    ${
                      formatBRL(
                        cartProduct.price
                      )
                    }

                  </span>


                </div>


                <button
                  class="cart-item-remove"
                  type="button"

                  data-remove="${
                    cartProduct.id
                  }"

                  aria-label="Remover produto"
                >

                  ×

                </button>


              </div>

            `;

          }

        )

        .join("");


    root.innerHTML =
      rows ||

      `
        <div class="cart-empty">
          Seu carrinho está vazio.
        </div>
      `;


    subtotalRoot.textContent =
      formatBRL(
        subtotal
      );


  } catch (error) {

    console.error(
      "Erro ao carregar carrinho:",
      error
    );

  }

}


/* =========================
   REMOVER DO CARRINHO
========================= */

function removeFromCart(id) {

  cart =
    cart.filter(

      item =>

        String(
          item.product_id
        ) !==

        String(id)

    );


  saveCart();

}


/* =========================
   ABRIR CARRINHO
========================= */

function openCart() {

  element("cartDrawer")
    ?.classList.add(
      "open"
    );


  element("cartBackdrop")
    ?.classList.add(
      "open"
    );


  document.body
    .classList.add(
      "no-scroll"
    );

}


/* =========================
   FECHAR CARRINHO
========================= */

function closeCart() {

  element("cartDrawer")
    ?.classList.remove(
      "open"
    );


  element("cartBackdrop")
    ?.classList.remove(
      "open"
    );


  document.body
    .classList.remove(
      "no-scroll"
    );

}


/* =========================
   ABRIR IMAGEM
========================= */

function openImage() {

  const image =
    element(
      "mainProductImage"
    );


  const expanded =
    element(
      "expandedImage"
    );


  if (
    !image ||
    !expanded
  ) {
    return;
  }


  expanded.src =
    image.src;


  element("imageModal")
    ?.classList.add(
      "open"
    );

}


/* =========================
   FECHAR IMAGEM
========================= */

function closeImage() {

  element("imageModal")
    ?.classList.remove(
      "open"
    );

}


/* =========================
   EVENTOS DO PRODUTO
========================= */

function bindProductEvents() {

  element("addCart")
    ?.addEventListener(
      "click",
      addToCart
    );


  element("buyNow")
    ?.addEventListener(
      "click",
      buyNow
    );


  const mainImage =
    element(
      "mainImageButton"
    );


  mainImage
    ?.addEventListener(
      "click",
      openImage
    );


  mainImage
    ?.addEventListener(

      "keydown",

      event => {

        if (
          event.key ===
            "Enter" ||

          event.key ===
            " "
        ) {

          event.preventDefault();

          openImage();

        }

      }

    );

}


/* =========================
   EVENTOS GLOBAIS
========================= */

function bindGlobalEvents() {

  element("openCart")
    ?.addEventListener(
      "click",
      openCart
    );


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


  element("closeImage")
    ?.addEventListener(
      "click",
      closeImage
    );


  element("imageModal")
    ?.addEventListener(

      "click",

      event => {

        if (
          event.target.id ===
          "imageModal"
        ) {

          closeImage();

        }

      }

    );


  element("cartItems")
    ?.addEventListener(

      "click",

      event => {

        const remove =
          event.target.closest(
            "[data-remove]"
          );


        if (!remove) {
          return;
        }


        removeFromCart(
          remove.dataset.remove
        );

      }

    );


  document.addEventListener(

    "keydown",

    event => {

      if (
        event.key ===
        "Escape"
      ) {

        closeCart();

        closeImage();

      }

    }

  );

}


/* =========================
   INICIALIZAÇÃO
========================= */

async function init() {

  bindGlobalEvents();

  renderCart();

  await loadProduct();

}


document.addEventListener(
  "DOMContentLoaded",
  init
);