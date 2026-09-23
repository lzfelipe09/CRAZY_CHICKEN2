import {
  supabase,
  isConfigured
} from "/js/supabaseClient.js";


/* =========================================================
   CONFIGURAÇÕES
========================================================= */

const CART_KEY = "crazy_chicken_cart_v4";

const BRAND_ICON =
  "/assets/crazy-chicken-icon.png";


/* =========================================================
   ESTADO
========================================================= */

let product = null;

let productImages = [];

let currentImageIndex = 0;

let selectedQuantity = 1;

let cart = loadCart();


/* =========================================================
   CONTROLE DO SWIPE MOBILE
========================================================= */

let touchStartX = 0;

let touchStartY = 0;

let touchCurrentX = 0;

let touchMoved = false;

let swipeHandled = false;


/* =========================================================
   HELPERS
========================================================= */

function element(id) {

  return document.getElementById(id);

}


function escapeHTML(value) {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


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

    console.error(
      "Erro ao carregar carrinho:",
      error
    );


    return [];

  }

}


function saveCart() {

  localStorage.setItem(
    CART_KEY,
    JSON.stringify(cart)
  );


  renderCart();

}


/* =========================================================
   TOAST
========================================================= */

function showToast(message) {

  let toast = element("toast");


  /*
    Caso o HTML já tenha o toast,
    utilizamos o existente.
  */

  if (toast) {

    toast.textContent = message;

    toast.classList.add("show");


    clearTimeout(
      showToast.timer
    );


    showToast.timer = setTimeout(
      () => {

        toast.classList.remove("show");

      },
      2200
    );


    return;

  }


  /*
    Fallback caso o elemento não exista.
  */

  toast = document.createElement("div");

  toast.id = "dynamicProductToast";

  toast.textContent = message;


  Object.assign(
    toast.style,
    {
      position: "fixed",
      left: "50%",
      bottom: "28px",
      transform: "translateX(-50%)",
      zIndex: "999999",
      background: "#171717",
      color: "#fff",
      border: "1px solid #333",
      borderRadius: "12px",
      padding: "12px 18px",
      fontSize: "13px",
      fontWeight: "700",
      boxShadow: "0 12px 35px rgba(0,0,0,.35)",
      maxWidth: "calc(100vw - 32px)",
      textAlign: "center"
    }
  );


  document.body.appendChild(toast);


  clearTimeout(
    showToast.dynamicTimer
  );


  showToast.dynamicTimer = setTimeout(
    () => {

      toast.remove();

    },
    2200
  );

}


/* =========================================================
   ID DO PRODUTO
========================================================= */

function getProductId() {

  const params =
    new URLSearchParams(
      location.search
    );


  return params.get("id");

}


/* =========================================================
   GALERIA - CARREGAR IMAGENS
========================================================= */

async function loadProductImages(productId) {

  productImages = [];

  currentImageIndex = 0;


  if (
    !supabase ||
    !productId
  ) {

    return;

  }


  try {

    const {
      data,
      error
    } = await supabase

      .from("product_images")

      .select(`
        id,
        product_id,
        image_url,
        image_path,
        position,
        created_at
      `)

      .eq(
        "product_id",
        productId
      )

      .order(
        "position",
        {
          ascending: true
        }
      )

      .order(
        "created_at",
        {
          ascending: true
        }
      );


    if (error) {

      throw error;

    }


    const galleryImages =
      Array.isArray(data)

        ? data.filter(
            image =>
              image?.image_url
          )

        : [];


    if (galleryImages.length) {

      productImages =
        galleryImages;


      return;

    }


  } catch (error) {

    console.error(
      "Erro ao carregar galeria:",
      error
    );

  }


  /*
    FALLBACK PARA PRODUTOS
    QUE POSSUEM SOMENTE image_url
  */

  if (product?.image_url) {

    productImages = [

      {
        id: "legacy-main-image",

        product_id:
          product.id,

        image_url:
          product.image_url,

        image_path:
          product.image_path || null,

        position: 0
      }

    ];


  } else {

    productImages = [

      {
        id: "brand-fallback",

        product_id:
          product?.id || null,

        image_url:
          BRAND_ICON,

        image_path:
          null,

        position: 0
      }

    ];

  }

}


/* =========================================================
   GALERIA - IMAGEM PRINCIPAL
========================================================= */

function getMainImage() {

  const selected =
    productImages[
      currentImageIndex
    ];


  return (
    selected?.image_url ||
    product?.image_url ||
    BRAND_ICON
  );

}


/* =========================================================
   GALERIA - INDICADORES
========================================================= */

function updateGalleryIndicators() {

  document
    .querySelectorAll(
      ".product-thumbnail"
    )
    .forEach(
      thumbnail => {

        const index =
          Number(
            thumbnail.dataset.productImage
          );


        const active =
          index === currentImageIndex;


        thumbnail.classList.toggle(
          "active",
          active
        );


        thumbnail.setAttribute(
          "aria-pressed",
          active
            ? "true"
            : "false"
        );

      }
    );


  document
    .querySelectorAll(
      ".mobile-gallery-dot"
    )
    .forEach(
      dot => {

        const index =
          Number(
            dot.dataset.galleryDot
          );


        dot.classList.toggle(
          "active",
          index === currentImageIndex
        );

      }
    );

}


/* =========================================================
   GALERIA - TROCAR IMAGEM
========================================================= */

function selectProductImage(
  index,
  animate = true
) {

  const parsedIndex =
    Number(index);


  if (
    !Number.isInteger(parsedIndex) ||
    parsedIndex < 0 ||
    parsedIndex >= productImages.length
  ) {

    return;

  }


  if (
    parsedIndex === currentImageIndex
  ) {

    updateGalleryIndicators();

    return;

  }


  currentImageIndex =
    parsedIndex;


  const image =
    element("mainProductImage");


  if (image) {

    if (animate) {

      image.classList.add(
        "image-changing"
      );

    }


    image.src =
      getMainImage();


    image.alt =
      `${
        product?.name ||
        "Produto"
      } - imagem ${
        currentImageIndex + 1
      }`;


    if (animate) {

      window.setTimeout(
        () => {

          image.classList.remove(
            "image-changing"
          );

        },
        150
      );

    }

  }


  updateGalleryIndicators();

}


/* =========================================================
   GALERIA - PRÓXIMA
========================================================= */

function nextProductImage() {

  if (
    productImages.length <= 1
  ) {

    return;

  }


  const nextIndex =
    (
      currentImageIndex + 1
    ) %
    productImages.length;


  selectProductImage(
    nextIndex
  );

}


/* =========================================================
   GALERIA - ANTERIOR
========================================================= */

function previousProductImage() {

  if (
    productImages.length <= 1
  ) {

    return;

  }


  const previousIndex =
    (
      currentImageIndex -
      1 +
      productImages.length
    ) %
    productImages.length;


  selectProductImage(
    previousIndex
  );

}


/* =========================================================
   MINIATURAS DESKTOP
========================================================= */

function renderProductThumbnails() {

  if (
    productImages.length <= 1
  ) {

    return "";

  }


  return `

    <div
      class="product-thumbnails"
      id="productThumbnails"
      aria-label="Outras imagens do produto"
    >

      ${
        productImages

          .map(
            (
              image,
              index
            ) => {

              const imageUrl =
                image.image_url ||
                BRAND_ICON;


              return `

                <button
                  class="product-thumbnail ${
                    index === 0
                      ? "active"
                      : ""
                  }"
                  type="button"
                  data-product-image="${index}"
                  aria-label="Ver imagem ${
                    index + 1
                  }"
                  aria-pressed="${
                    index === 0
                      ? "true"
                      : "false"
                  }"
                >

                  <img
                    src="${
                      escapeHTML(
                        imageUrl
                      )
                    }"
                    alt="${
                      escapeHTML(
                        `${
                          product?.name ||
                          "Produto"
                        } - imagem ${
                          index + 1
                        }`
                      )
                    }"
                    loading="lazy"
                    onerror="
                      this.onerror=null;
                      this.src='${BRAND_ICON}'
                    "
                  >

                </button>

              `;

            }
          )

          .join("")
      }

    </div>

  `;

}


/* =========================================================
   BOLINHAS MOBILE
========================================================= */

function renderMobileGalleryDots() {

  if (
    productImages.length <= 1
  ) {

    return "";

  }


  return `

    <div
      class="mobile-gallery-dots"
      aria-hidden="true"
    >

      ${
        productImages

          .map(
            (
              _,
              index
            ) => `

              <span
                class="mobile-gallery-dot ${
                  index === 0
                    ? "active"
                    : ""
                }"
                data-gallery-dot="${index}"
              ></span>

            `
          )

          .join("")
      }

    </div>

  `;

}


/* =========================================================
   CARREGAR PRODUTO
========================================================= */

async function loadProduct() {

  const root =
    element("productRoot");


  if (!root) {

    return;

  }


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


    selectedQuantity =
      1;


    await loadProductImages(
      product.id
    );


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


/* =========================================================
   RENDERIZAR PRODUTO
========================================================= */

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
      product.compare_at_price || 0
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
    getMainImage();


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
            draggable="false"
            onerror="
              this.onerror=null;
              this.src='${BRAND_ICON}'
            "
          >

        </div>


        ${renderProductThumbnails()}


        ${renderMobileGalleryDots()}


        <div class="image-tip">

          ${
            productImages.length > 1

              ? "Passe pelas imagens no computador ou deslize no celular"

              : "Toque na imagem para ampliar"
          }

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


        <span
          class="stock ${stockClass}"
        >

          <span
            class="stock-dot"
            aria-hidden="true"
          ></span>

          ${stockText}

        </span>


        <!-- PREÇO -->

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

            Valor do produto.
            Entrega calculada conforme o CEP.

          </span>

        </div>


        <!-- INFORMAÇÕES -->

        <div class="purchase-info">

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
             SELETOR DE QUANTIDADE
        ========================== -->

        ${
          available
            ? `

              <div
                class="product-quantity-selector"
                style="
                  display:flex;
                  align-items:center;
                  justify-content:space-between;
                  gap:16px;
                  margin:20px 0 14px;
                  padding:14px 16px;
                  border:1px solid #2b2b2b;
                  border-radius:14px;
                  background:#101010;
                "
              >

                <div>

                  <strong
                    style="
                      display:block;
                      color:#ffffff;
                      font-size:13px;
                      font-weight:800;
                    "
                  >

                    Quantidade

                  </strong>


                  <span
                    style="
                      display:block;
                      margin-top:3px;
                      color:#888888;
                      font-size:11px;
                    "
                  >

                    Escolha quantas unidades deseja

                  </span>

                </div>


                <div
                  style="
                    display:flex;
                    align-items:center;
                    gap:10px;
                  "
                >

                  <button
                    id="decreaseQuantity"
                    type="button"
                    aria-label="Diminuir quantidade"
                    style="
                      width:40px;
                      height:40px;
                      display:flex;
                      align-items:center;
                      justify-content:center;
                      border:1px solid #333333;
                      border-radius:10px;
                      background:#181818;
                      color:#ffffff;
                      font-size:21px;
                      font-weight:700;
                      cursor:pointer;
                    "
                  >
                    −
                  </button>


                  <strong
                    id="selectedQuantity"
                    style="
                      min-width:34px;
                      text-align:center;
                      color:#ffffff;
                      font-size:17px;
                      font-weight:800;
                    "
                  >

                    ${selectedQuantity}

                  </strong>


                  <button
                    id="increaseQuantity"
                    type="button"
                    aria-label="Aumentar quantidade"
                    style="
                      width:40px;
                      height:40px;
                      display:flex;
                      align-items:center;
                      justify-content:center;
                      border:1px solid #333333;
                      border-radius:10px;
                      background:#181818;
                      color:#ffffff;
                      font-size:21px;
                      font-weight:700;
                      cursor:pointer;
                    "
                  >
                    +
                  </button>

                </div>

              </div>

            `
            : ""
        }


        <!-- BOTÕES -->

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


        <!-- DESCRIÇÃO -->

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


/* =========================================================
   PRODUTOS RELACIONADOS
========================================================= */

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
    } = await supabase

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
        active
      `)

      .eq(
        "active",
        true
      )

      .eq(
        "category",
        category
      )

      .neq(
        "id",
        product.id
      )

      .limit(4);


    if (error) {

      throw error;

    }


    const related =
      Array.isArray(data)
        ? data
        : [];


    if (!related.length) {

      return;

    }


    root.innerHTML = related

      .map(
        relatedProduct => {

          const price =
            Number(
              relatedProduct.price || 0
            );


          const comparePrice =
            Number(
              relatedProduct.compare_at_price || 0
            );


          const hasCompare =
            comparePrice > price;


          const stock =
            Number(
              relatedProduct.stock || 0
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


/* =========================================================
   QUANTIDADE DO PRODUTO
========================================================= */

function updateQuantitySelector() {

  if (!product) {

    return;

  }


  const stock =
    Math.max(
      0,
      Number(
        product.stock || 0
      )
    );


  selectedQuantity =
    Math.max(
      1,
      Math.min(
        Number(selectedQuantity) || 1,
        Math.max(
          stock,
          1
        )
      )
    );


  const value =
    element("selectedQuantity");


  const decrease =
    element("decreaseQuantity");


  const increase =
    element("increaseQuantity");


  if (value) {

    value.textContent =
      String(selectedQuantity);

  }


  /*
    BOTÃO MENOS
  */

  if (decrease) {

    decrease.disabled =
      selectedQuantity <= 1 ||
      stock <= 0;


    decrease.style.opacity =
      decrease.disabled
        ? "0.35"
        : "1";


    decrease.style.cursor =
      decrease.disabled
        ? "not-allowed"
        : "pointer";

  }


  /*
    BOTÃO MAIS
  */

  if (increase) {

    increase.disabled =
      selectedQuantity >= stock ||
      stock <= 0;


    increase.style.opacity =
      increase.disabled
        ? "0.35"
        : "1";


    increase.style.cursor =
      increase.disabled
        ? "not-allowed"
        : "pointer";

  }

}


/* =========================================================
   ALTERAR QUANTIDADE
========================================================= */

function changeSelectedQuantity(delta) {

  if (!product) {

    return;

  }


  const stock =
    Number(
      product.stock || 0
    );


  if (stock <= 0) {

    return;

  }


  const next =
    selectedQuantity +
    Number(delta || 0);


  /*
    NÃO PERMITE PASSAR DO ESTOQUE
  */

  if (next > stock) {

    showToast(
      "Você atingiu o estoque disponível."
    );


    updateQuantitySelector();


    return;

  }


  /*
    NÃO PERMITE MENOS DE 1
  */

  selectedQuantity =
    Math.max(
      1,
      next
    );


  updateQuantitySelector();

}


/* =========================================================
   ADICIONAR PRODUTO
========================================================= */

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


  /*
    QUANTIDADE ESCOLHIDA NA PÁGINA
  */

  const quantityToAdd =
    Math.max(
      1,
      Math.min(
        Number(
          selectedQuantity
        ) || 1,
        stock
      )
    );


  /*
    PROCURA SE O PRODUTO
    JÁ ESTÁ NO CARRINHO
  */

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


  const currentQuantity =
    item
      ? Number(
          item.quantity || 0
        )
      : 0;


  /*
    ESTOQUE REAL CONSIDERANDO
    O QUE JÁ ESTÁ NO CARRINHO
  */

  const finalQuantity =
    currentQuantity +
    quantityToAdd;


  if (
    finalQuantity > stock
  ) {

    const remaining =
      Math.max(
        0,
        stock -
        currentQuantity
      );


    if (remaining <= 0) {

      showToast(
        "Você atingiu o estoque disponível."
      );


    } else {

      showToast(

        `Você pode adicionar no máximo mais ${remaining} ${
          remaining === 1
            ? "unidade"
            : "unidades"
        }.`

      );

    }


    return false;

  }


  /*
    ATUALIZA OU CRIA ITEM
  */

  if (item) {

    item.quantity =
      finalQuantity;


  } else {

    cart.push(
      {
        product_id:
          product.id,

        quantity:
          quantityToAdd
      }
    );

  }


  saveCart();


  return true;

}


/* =========================================================
   ADICIONAR AO CARRINHO
========================================================= */

function addToCart() {

  const quantityAdded =
    selectedQuantity;


  const added =
    addCurrentProduct();


  if (!added) {

    return;

  }


  if (
    quantityAdded === 1
  ) {

    showToast(
      "Produto adicionado ao carrinho."
    );


  } else {

    showToast(
      `${quantityAdded} unidades adicionadas ao carrinho.`
    );

  }


  animateCartButton();


  /*
    DEPOIS DE ADICIONAR,
    VOLTA O SELETOR PARA 1
  */

  selectedQuantity =
    1;


  updateQuantitySelector();

}


/* =========================================================
   COMPRAR AGORA
========================================================= */

function buyNow() {

  const added =
    addCurrentProduct();


  if (!added) {

    return;

  }


  /*
    ABRE O CARRINHO/CHECKOUT
    NA PÁGINA PRINCIPAL
  */

  location.href =
    "/index.html?checkout=1";

}


/* =========================================================
   ANIMAÇÃO DO CARRINHO
========================================================= */

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
      easing: "ease"
    }
  );

}


/* =========================================================
   RENDERIZAR CARRINHO
========================================================= */

function renderCart() {

  const count =
    element("cartCount");


  const totalQuantity =
    cart.reduce(
      (
        total,
        item
      ) =>

        total +
        Number(
          item.quantity || 0
        ),

      0
    );


  if (count) {

    count.textContent =
      String(
        totalQuantity
      );


    count.hidden =
      totalQuantity <= 0;

  }


  renderCartProducts();

}


/* =========================================================
   PRODUTOS DO CARRINHO
========================================================= */

async function renderCartProducts() {

  const root =
    element("cartItems");


  const subtotalRoot =
    element("cartSubtotal");


  if (!root) {

    return;

  }


  /*
    CARRINHO VAZIO
  */

  if (!cart.length) {

    root.innerHTML = `

      <div class="cart-empty">

        Seu carrinho está vazio.

      </div>

    `;


    if (subtotalRoot) {

      subtotalRoot.textContent =
        formatBRL(0);

    }


    return;

  }


  if (
    !supabase ||
    !isConfigured
  ) {

    return;

  }


  try {

    const ids = cart

      .map(
        item =>
          item.product_id
      )

      .filter(Boolean);


    if (!ids.length) {

      return;

    }


    const {
      data,
      error
    } = await supabase

      .from("products")

      .select(`
        id,
        name,
        price,
        image_url,
        stock
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


    const rows = cart

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


          const unitPrice =
            Number(
              cartProduct.price || 0
            );


          const itemSubtotal =
            unitPrice *
            quantity;


          subtotal +=
            itemSubtotal;


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
                  ${formatBRL(unitPrice)}

                </span>


                <span>

                  ${formatBRL(itemSubtotal)}

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


    if (subtotalRoot) {

      subtotalRoot.textContent =
        formatBRL(
          subtotal
        );

    }


  } catch (error) {

    console.error(
      "Erro ao carregar carrinho:",
      error
    );

  }

}


/* =========================================================
   REMOVER PRODUTO DO CARRINHO
========================================================= */

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


/* =========================================================
   ABRIR CARRINHO
========================================================= */

function openCart() {

  element("cartDrawer")
    ?.classList.add(
      "open"
    );


  element("cartBackdrop")
    ?.classList.add(
      "open"
    );


  document.body.classList.add(
    "no-scroll"
  );

}


/* =========================================================
   FECHAR CARRINHO
========================================================= */

function closeCart() {

  element("cartDrawer")
    ?.classList.remove(
      "open"
    );


  element("cartBackdrop")
    ?.classList.remove(
      "open"
    );


  document.body.classList.remove(
    "no-scroll"
  );

}


/* =========================================================
   ABRIR ZOOM DA IMAGEM
========================================================= */

function openImage() {

  const image =
    element("mainProductImage");


  const expanded =
    element("expandedImage");


  if (
    !image ||
    !expanded
  ) {

    return;

  }


  expanded.src =
    image.src;


  expanded.alt =
    `${
      product?.name ||
      "Produto"
    } ampliado`;


  element("imageModal")
    ?.classList.add(
      "open"
    );

}


/* =========================================================
   FECHAR ZOOM
========================================================= */

function closeImage() {

  element("imageModal")
    ?.classList.remove(
      "open"
    );

}


/* =========================================================
   SWIPE - INÍCIO
========================================================= */

function handleTouchStart(event) {

  if (
    productImages.length <= 1
  ) {

    return;

  }


  const touch =
    event.touches?.[0];


  if (!touch) {

    return;

  }


  touchStartX =
    touch.clientX;


  touchStartY =
    touch.clientY;


  touchCurrentX =
    touch.clientX;


  touchMoved =
    false;


  swipeHandled =
    false;

}


/* =========================================================
   SWIPE - MOVIMENTO
========================================================= */

function handleTouchMove(event) {

  if (
    productImages.length <= 1
  ) {

    return;

  }


  const touch =
    event.touches?.[0];


  if (!touch) {

    return;

  }


  touchCurrentX =
    touch.clientX;


  const distanceX =
    touchCurrentX -
    touchStartX;


  const distanceY =
    touch.clientY -
    touchStartY;


  /*
    SÓ CONSIDERA SWIPE SE
    O MOVIMENTO HORIZONTAL
    FOR MAIOR QUE O VERTICAL.
  */

  if (
    Math.abs(distanceX) >
      Math.abs(distanceY) &&

    Math.abs(distanceX) > 10
  ) {

    touchMoved =
      true;

  }

}


/* =========================================================
   SWIPE - FINAL
========================================================= */

function handleTouchEnd() {

  if (
    productImages.length <= 1
  ) {

    return;

  }


  const distance =
    touchCurrentX -
    touchStartX;


  const minimumSwipe =
    45;


  if (
    touchMoved &&
    Math.abs(distance) >=
      minimumSwipe
  ) {

    swipeHandled =
      true;


    if (distance < 0) {

      nextProductImage();


    } else {

      previousProductImage();

    }

  }


  touchStartX = 0;

  touchStartY = 0;

  touchCurrentX = 0;

  touchMoved = false;

}


/* =========================================================
   EVENTOS DO PRODUTO
========================================================= */

function bindProductEvents() {

  /*
    QUANTIDADE
  */

  element("decreaseQuantity")
    ?.addEventListener(
      "click",
      () => {

        changeSelectedQuantity(
          -1
        );

      }
    );


  element("increaseQuantity")
    ?.addEventListener(
      "click",
      () => {

        changeSelectedQuantity(
          1
        );

      }
    );


  updateQuantitySelector();


  /*
    ADICIONAR AO CARRINHO
  */

  element("addCart")
    ?.addEventListener(
      "click",
      addToCart
    );


  /*
    COMPRAR AGORA
  */

  element("buyNow")
    ?.addEventListener(
      "click",
      buyNow
    );


  /*
    MINIATURAS
  */

  const thumbnails =
    element(
      "productThumbnails"
    );


  thumbnails
    ?.addEventListener(
      "click",
      event => {

        const button =
          event.target.closest(
            "[data-product-image]"
          );


        if (!button) {

          return;

        }


        selectProductImage(
          Number(
            button.dataset.productImage
          )
        );

      }
    );


  /*
    HOVER NO COMPUTADOR
  */

  if (
    window.matchMedia(
      "(hover: hover) and (pointer: fine)"
    ).matches
  ) {

    thumbnails
      ?.querySelectorAll(
        "[data-product-image]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "mouseenter",
            () => {

              selectProductImage(
                Number(
                  button.dataset.productImage
                )
              );

            }
          );

        }
      );

  }


  /*
    IMAGEM PRINCIPAL
  */

  const mainImage =
    element(
      "mainImageButton"
    );


  /*
    SWIPE MOBILE
  */

  mainImage
    ?.addEventListener(
      "touchstart",
      handleTouchStart,
      {
        passive: true
      }
    );


  mainImage
    ?.addEventListener(
      "touchmove",
      handleTouchMove,
      {
        passive: true
      }
    );


  mainImage
    ?.addEventListener(
      "touchend",
      handleTouchEnd,
      {
        passive: true
      }
    );


  /*
    CLIQUE NA IMAGEM = ZOOM
  */

  mainImage
    ?.addEventListener(
      "click",
      event => {

        /*
          IGNORA O CLIQUE GERADO
          DEPOIS DE UM SWIPE.
        */

        if (swipeHandled) {

          event.preventDefault();


          swipeHandled =
            false;


          return;

        }


        openImage();

      }
    );


  /*
    TECLADO / ACESSIBILIDADE
  */

  mainImage
    ?.addEventListener(
      "keydown",
      event => {

        if (
          event.key === "Enter" ||
          event.key === " "
        ) {

          event.preventDefault();


          openImage();

        }

      }
    );

}


/* =========================================================
   EVENTOS GLOBAIS
========================================================= */

function bindGlobalEvents() {

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
    FECHAR ZOOM
  */

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


  /*
    REMOVER ITEM DO CARRINHO
  */

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


  /*
    ESC
  */

  document.addEventListener(
    "keydown",
    event => {

      if (
        event.key === "Escape"
      ) {

        closeCart();

        closeImage();

      }

    }
  );

}


/* =========================================================
   INICIALIZAÇÃO
========================================================= */

async function init() {

  bindGlobalEvents();


  renderCart();


  await loadProduct();

}


/* =========================================================
   START
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  init
);