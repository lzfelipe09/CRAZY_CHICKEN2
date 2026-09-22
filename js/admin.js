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


const PRODUCT_IMAGES_BUCKET =
  "product-images";


let adminSession =
  null;


let products =
  [];


let orders =
  [];


let customers =
  [];


/*
  Imagens que já existem no banco
  quando estamos editando um produto.
*/
let existingProductImages =
  [];


/*
  Novas imagens escolhidas pelo usuário
  antes de salvar.
*/
let selectedProductImages =
  [];


/*
  URLs temporárias usadas somente
  para mostrar a prévia das novas imagens.
*/
let selectedPreviewUrls =
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


/* =========================================
   AUTENTICAÇÃO ADMIN
========================================= */

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


/* =========================================
   NAVEGAÇÃO
========================================= */

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


/* =========================================
   UTILIDADES DAS IMAGENS
========================================= */

function clearSelectedPreviewUrls() {

  selectedPreviewUrls
    .forEach(
      url => {

        try {

          URL.revokeObjectURL(
            url
          );

        } catch {}

      }
    );


  selectedPreviewUrls =
    [];

}


function resetImageState() {

  clearSelectedPreviewUrls();


  existingProductImages =
    [];


  selectedProductImages =
    [];


  const input =
    $("#productImage");


  if (input) {

    input.value =
      "";

  }


  renderImagePreview();

}


function updateImagesInfo() {

  const info =
    $("#productImagesInfo");


  if (!info) {
    return;
  }


  const existingCount =
    existingProductImages.length;


  const newCount =
    selectedProductImages.length;


  const total =
    existingCount +
    newCount;


  if (!total) {

    info.textContent =
      "Nenhuma nova imagem selecionada.";

    return;

  }


  if (
    existingCount &&
    newCount
  ) {

    info.textContent =
      `${existingCount} imagem(ns) já salva(s) + ${newCount} nova(s) imagem(ns).`;

    return;

  }


  if (existingCount) {

    info.textContent =
      `${existingCount} imagem(ns) cadastrada(s). Você pode adicionar mais imagens.`;

    return;

  }


  info.textContent =
    `${newCount} nova(s) imagem(ns) selecionada(s). A primeira será a principal.`;

}


function renderImagePreview() {

  const root =
    $("#imagePreview");


  if (!root) {
    return;
  }


  clearSelectedPreviewUrls();


  const existingHTML =
    existingProductImages

      .map(
        (
          image,
          index
        ) => {

          const isMain =
            index === 0;


          return `
            <div
              class="product-image-preview-item ${
                isMain
                  ? "is-main"
                  : ""
              }"
            >

              <img
                src="${
                  escapeHTML(
                    image.image_url ||
                    BRAND_ICON
                  )
                }"
                alt="Imagem do produto"
                onerror="
                  this.onerror=null;
                  this.src='${BRAND_ICON}'
                "
              >

              <span
                class="product-image-badge"
              >
                ${
                  isMain
                    ? "Principal"
                    : `Foto ${index + 1}`
                }
              </span>

              <button
                class="product-image-remove"
                type="button"
                data-remove-existing-image="${
                  escapeHTML(
                    String(
                      image.id ||
                      ""
                    )
                  )
                }"
                aria-label="Excluir imagem"
                title="Excluir imagem"
              >
                ×
              </button>

            </div>
          `;

        }
      )

      .join("");


  const offset =
    existingProductImages.length;


  const newHTML =
    selectedProductImages

      .map(
        (
          file,
          index
        ) => {

          const url =
            URL.createObjectURL(
              file
            );


          selectedPreviewUrls
            .push(
              url
            );


          const position =
            offset +
            index;


          const isMain =
            position === 0;


          return `
            <div
              class="product-image-preview-item ${
                isMain
                  ? "is-main"
                  : ""
              }"
            >

              <img
                src="${url}"
                alt="Nova imagem do produto"
              >

              <span
                class="product-image-badge"
              >
                ${
                  isMain
                    ? "Principal"
                    : `Foto ${position + 1}`
                }
              </span>

              <button
                class="product-image-remove"
                type="button"
                data-remove-new-image="${index}"
                aria-label="Remover imagem"
                title="Remover imagem"
              >
                ×
              </button>

            </div>
          `;

        }
      )

      .join("");


  root.innerHTML =
    existingHTML +
    newHTML;


  updateImagesInfo();

}


function validateImageFile(
  file
) {

  if (!file) {

    throw new Error(
      "Arquivo de imagem inválido."
    );

  }


  if (
    file.size >
    6 * 1024 * 1024
  ) {

    throw new Error(
      `"${file.name}" ultrapassa o limite de 6 MB.`
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
      `"${file.name}" não é JPG, PNG ou WebP.`
    );

  }

}


function addSelectedImages(
  files
) {

  const incoming =
    Array.from(
      files || []
    );


  if (
    !incoming.length
  ) {

    return;

  }


  try {

    incoming
      .forEach(
        validateImageFile
      );


    selectedProductImages =
      [
        ...selectedProductImages,
        ...incoming
      ];


    renderImagePreview();


  } catch (error) {

    handleError(
      error
    );

  }


  const input =
    $("#productImage");


  if (input) {

    /*
      Limpamos o input para permitir
      selecionar o mesmo arquivo novamente
      caso ele tenha sido removido da prévia.
    */
    input.value =
      "";

  }

}


function removeNewSelectedImage(
  index
) {

  const safeIndex =
    Number(
      index
    );


  if (
    !Number.isInteger(
      safeIndex
    )
    ||
    safeIndex < 0
    ||
    safeIndex >=
      selectedProductImages.length
  ) {

    return;

  }


  selectedProductImages
    .splice(
      safeIndex,
      1
    );


  renderImagePreview();

}


/* =========================================
   PRODUTO - RESET
========================================= */

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


  resetImageState();


  $("#productFormTitle").textContent =
    "Adicionar produto";


  $("#saveProductButton").textContent =
    "Salvar produto";

}


/* =========================================
   PRODUTOS - LISTAGEM
========================================= */

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


/* =========================================
   PRODUTOS - CARREGAR GALERIA
========================================= */

async function loadProductImages(
  product
) {

  const {
    data,
    error
  } =
    await supabase

      .from(
        "product_images"
      )

      .select(
        `
        id,
        product_id,
        image_url,
        image_path,
        position,
        created_at
        `
      )

      .eq(
        "product_id",
        product.id
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


  existingProductImages =
    data || [];


  /*
    Compatibilidade com produtos antigos.

    Se o produto já existia antes da tabela
    product_images e possui image_url,
    mostramos essa imagem normalmente.
  */
  if (
    !existingProductImages.length
    &&
    product.image_url
  ) {

    existingProductImages = [
      {
        id:
          `legacy-${product.id}`,

        product_id:
          product.id,

        image_url:
          product.image_url,

        image_path:
          product.image_path ||
          null,

        position:
          0,

        legacy:
          true
      }
    ];

  }


  renderImagePreview();

}


/* =========================================
   PRODUTOS - EDITAR
========================================= */

async function editProduct(id) {

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


  selectedProductImages =
    [];


  clearSelectedPreviewUrls();


  existingProductImages =
    [];


  renderImagePreview();


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


  try {

    await loadProductImages(
      product
    );


  } catch (error) {

    handleError(
      error
    );

  }

}


/* =========================================
   STORAGE - UPLOAD
========================================= */

async function uploadImage(
  file,
  productId
) {

  validateImageFile(
    file
  );


  const ext =
    file.name
      .split(".")
      .pop()
      ?.toLowerCase()
    ||
    "jpg";


  /*
    Estrutura:
    ID DO ADMIN / ID DO PRODUTO / FOTO
  */
  const path =
    `${adminSession.user.id}/${productId}/${crypto.randomUUID()}.${ext}`;


  const {
    error
  } =
    await supabase.storage

      .from(
        PRODUCT_IMAGES_BUCKET
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
        PRODUCT_IMAGES_BUCKET
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


/* =========================================
   GALERIA - REORDENAR POSIÇÕES
========================================= */

async function normalizeImagePositions(
  productId
) {

  const {
    data,
    error
  } =
    await supabase

      .from(
        "product_images"
      )

      .select(
        "id, position"
      )

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


  const rows =
    data || [];


  for (
    let index = 0;
    index < rows.length;
    index++
  ) {

    if (
      Number(
        rows[index].position
      ) ===
      index
    ) {

      continue;

    }


    const {
      error:
        updateError
    } =
      await supabase

        .from(
          "product_images"
        )

        .update(
          {
            position:
              index
          }
        )

        .eq(
          "id",
          rows[index].id
        );


    if (
      updateError
    ) {

      throw updateError;

    }

  }

}


/* =========================================
   GALERIA - SINCRONIZAR FOTO PRINCIPAL
========================================= */

async function syncProductMainImage(
  productId
) {

  const {
    data,
    error
  } =
    await supabase

      .from(
        "product_images"
      )

      .select(
        `
        id,
        image_url,
        image_path,
        position
        `
      )

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

      .limit(1);


  if (error) {
    throw error;
  }


  const mainImage =
    data?.[0] ||
    null;


  const {
    error:
      productError
  } =
    await supabase

      .from(
        "products"
      )

      .update(
        {

          image_url:
            mainImage?.image_url ||
            null,

          image_path:
            mainImage?.image_path ||
            null

        }
      )

      .eq(
        "id",
        productId
      );


  if (
    productError
  ) {

    throw productError;

  }

}


/* =========================================
   GALERIA - MIGRAR IMAGEM ANTIGA
========================================= */

async function ensureLegacyImageInGallery(
  product
) {

  if (
    !product ||
    !product.id ||
    !product.image_url
  ) {

    return;

  }


  const {
    data,
    error
  } =
    await supabase

      .from(
        "product_images"
      )

      .select(
        "id"
      )

      .eq(
        "product_id",
        product.id
      )

      .limit(1);


  if (error) {
    throw error;
  }


  if (
    data?.length
  ) {

    return;

  }


  const {
    error:
      insertError
  } =
    await supabase

      .from(
        "product_images"
      )

      .insert(
        {

          product_id:
            product.id,

          image_url:
            product.image_url,

          image_path:
            product.image_path ||
            null,

          position:
            0

        }
      );


  if (
    insertError
  ) {

    throw insertError;

  }

}


/* =========================================
   GALERIA - EXCLUIR FOTO
========================================= */

async function removeExistingProductImage(
  imageId
) {

  const productId =
    $("#productId")
      ?.value;


  if (
    !productId
  ) {

    return;

  }


  const image =
    existingProductImages
      .find(
        item =>
          String(
            item.id
          ) ===
          String(
            imageId
          )
      );


  if (!image) {
    return;
  }


  if (
    !confirm(
      "Excluir esta imagem do produto?"
    )
  ) {

    return;

  }


  try {

    /*
      Produto antigo que ainda não tinha
      registro na tabela product_images.
    */
    if (
      image.legacy
    ) {

      if (
        image.image_path
      ) {

        const {
          error:
            storageError
        } =
          await supabase.storage

            .from(
              PRODUCT_IMAGES_BUCKET
            )

            .remove(
              [
                image.image_path
              ]
            );


        if (
          storageError
        ) {

          throw storageError;

        }

      }


      const {
        error:
          productError
      } =
        await supabase

          .from(
            "products"
          )

          .update(
            {

              image_url:
                null,

              image_path:
                null

            }
          )

          .eq(
            "id",
            productId
          );


      if (
        productError
      ) {

        throw productError;

      }


    } else {

      const {
        error:
          deleteError
      } =
        await supabase

          .from(
            "product_images"
          )

          .delete()

          .eq(
            "id",
            image.id
          );


      if (
        deleteError
      ) {

        throw deleteError;

      }


      if (
        image.image_path
      ) {

        const {
          error:
            storageError
        } =
          await supabase.storage

            .from(
              PRODUCT_IMAGES_BUCKET
            )

            .remove(
              [
                image.image_path
              ]
            );


        if (
          storageError
        ) {

          console.warn(
            "Registro excluído, mas não foi possível remover o arquivo do Storage:",
            storageError
          );

        }

      }


      await normalizeImagePositions(
        productId
      );


      await syncProductMainImage(
        productId
      );

    }


    const product =
      products
        .find(
          item =>
            String(
              item.id
            ) ===
            String(
              productId
            )
        );


    if (product) {

      const {
        data:
          refreshedProduct
      } =
        await supabase

          .from(
            "products"
          )

          .select("*")

          .eq(
            "id",
            productId
          )

          .single();


      if (
        refreshedProduct
      ) {

        Object.assign(
          product,
          refreshedProduct
        );

      }


      await loadProductImages(
        product
      );

    }


    await loadProducts();


    showToast(
      "Imagem excluída.",
      "success"
    );


  } catch (error) {

    handleError(
      error
    );

  }

}


/* =========================================
   GALERIA - SALVAR NOVAS IMAGENS
========================================= */

async function saveNewProductImages(
  productId,
  files,
  startPosition = 0
) {

  const uploaded =
    [];


  try {

    for (
      let index = 0;
      index < files.length;
      index++
    ) {

      const file =
        files[index];


      const result =
        await uploadImage(
          file,
          productId
        );


      uploaded.push(
        result
      );


      const {
        error
      } =
        await supabase

          .from(
            "product_images"
          )

          .insert(
            {

              product_id:
                productId,

              image_url:
                result.url,

              image_path:
                result.path,

              position:
                startPosition +
                index

            }
          );


      if (error) {
        throw error;
      }

    }


    return uploaded;


  } catch (error) {

    /*
      Se alguma coisa der errado no meio
      do upload, tentamos remover os
      arquivos que acabaram de ser enviados.
    */
    const paths =
      uploaded
        .map(
          item =>
            item.path
        )
        .filter(
          Boolean
        );


    if (
      paths.length
    ) {

      try {

        await supabase.storage

          .from(
            PRODUCT_IMAGES_BUCKET
          )

          .remove(
            paths
          );

      } catch {}

    }


    throw error;

  }

}


/* =========================================
   PRODUTO - EXCLUIR
========================================= */

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

    /*
      Pegamos todas as imagens antes
      de apagar o produto.

      O ON DELETE CASCADE remove os
      registros de product_images.
    */
    const {
      data:
        galleryImages,
      error:
        galleryError
    } =
      await supabase

        .from(
          "product_images"
        )

        .select(
          "image_path"
        )

        .eq(
          "product_id",
          id
        );


    if (
      galleryError
    ) {

      throw galleryError;

    }


    const paths =
      (
        galleryImages ||
        []
      )

        .map(
          image =>
            image.image_path
        )

        .filter(
          Boolean
        );


    /*
      Compatibilidade com produto antigo
      que ainda não está em product_images.
    */
    if (
      product.image_path &&
      !paths.includes(
        product.image_path
      )
    ) {

      paths.push(
        product.image_path
      );

    }


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
      paths.length
    ) {

      const {
        error:
          storageError
      } =
        await supabase.storage

          .from(
            PRODUCT_IMAGES_BUCKET
          )

          .remove(
            paths
          );


      if (
        storageError
      ) {

        console.warn(
          "Produto excluído, mas alguns arquivos não puderam ser removidos:",
          storageError
        );

      }

    }


    if (
      String(
        $("#productId")
          ?.value
      ) ===
      String(id)
    ) {

      resetProductForm();

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


/* =========================================
   PEDIDOS
========================================= */

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


/* =========================================
   CLIENTES
========================================= */

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


/* =========================================
   MÉTRICAS
========================================= */

async function loadMetrics() {

  await Promise.all(
    [

      loadProducts(),

      loadOrders(),

      loadCustomers()

    ]
  );

}


/* =========================================
   ERROS
========================================= */

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


/* =========================================
   EVENTOS
========================================= */

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


  /*
    Agora pegamos TODOS os arquivos,
    e não apenas files[0].
  */
  $("#productImage")
    ?.addEventListener(
      "change",
      event => {

        addSelectedImages(
          event.target.files
        );

      }
    );


  /*
    Botões × das imagens.
  */
  $("#imagePreview")
    ?.addEventListener(
      "click",
      event => {

        const removeNew =
          event.target
            .closest(
              "[data-remove-new-image]"
            );


        if (removeNew) {

          removeNewSelectedImage(
            removeNew.dataset
              .removeNewImage
          );


          return;

        }


        const removeExisting =
          event.target
            .closest(
              "[data-remove-existing-image]"
            );


        if (
          removeExisting
        ) {

          removeExistingProductImage(
            removeExisting.dataset
              .removeExistingImage
          );

        }

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


  /* =========================================
     SALVAR PRODUTO
  ========================================= */

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


        let createdProductId =
          null;


        let newUploadedImages =
          [];


        try {

          const id =
            $("#productId")
              .value;


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


          if (
            payload.compare_at_price
            &&
            payload.compare_at_price <=
              payload.price
          ) {

            payload.compare_at_price =
              null;

          }


          /* =================================
             EDITANDO PRODUTO
          ================================= */

          if (id) {

            const oldProduct =
              products
                .find(
                  item =>
                    String(
                      item.id
                    ) ===
                    String(id)
                );


            if (
              !oldProduct
            ) {

              throw new Error(
                "Produto não encontrado."
              );

            }


            /*
              Se for produto antigo, registramos
              sua imagem atual na nova tabela
              antes de adicionar outras.
            */
            await ensureLegacyImageInGallery(
              oldProduct
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


            /*
              Descobre quantas imagens já existem
              para colocar as novas no final.
            */
            const {
              count,
              error:
                countError
            } =
              await supabase

                .from(
                  "product_images"
                )

                .select(
                  "id",
                  {
                    count:
                      "exact",

                    head:
                      true
                  }
                )

                .eq(
                  "product_id",
                  id
                );


            if (
              countError
            ) {

              throw countError;

            }


            if (
              selectedProductImages.length
            ) {

              newUploadedImages =
                await saveNewProductImages(
                  id,
                  selectedProductImages,
                  count || 0
                );

            }


            await normalizeImagePositions(
              id
            );


            await syncProductMainImage(
              id
            );


            showToast(
              "Produto atualizado.",
              "success"
            );


          } else {

            /* =================================
               NOVO PRODUTO
            ================================= */

            if (
              !selectedProductImages.length
            ) {

              throw new Error(
                "Selecione pelo menos uma imagem para o produto."
              );

            }


            /*
              Primeiro criamos o produto
              para receber seu UUID.
            */
            const {
              data:
                createdProduct,
              error:
                insertError
            } =
              await supabase

                .from(
                  "products"
                )

                .insert(
                  payload
                )

                .select("*")

                .single();


            if (
              insertError
            ) {

              throw insertError;

            }


            createdProductId =
              createdProduct.id;


            /*
              Agora enviamos todas as imagens
              usando o UUID do produto.
            */
            newUploadedImages =
              await saveNewProductImages(
                createdProduct.id,
                selectedProductImages,
                0
              );


            /*
              A posição 0 vira image_url/image_path
              no products para o catálogo antigo
              continuar funcionando normalmente.
            */
            await syncProductMainImage(
              createdProduct.id
            );


            showToast(
              "Produto adicionado.",
              "success"
            );

          }


          resetProductForm();


          await loadProducts();


        } catch (error) {

          /*
            Se era um produto novo e houve erro
            depois da criação, removemos o produto
            incompleto. O cascade também limpa
            product_images.
          */
          if (
            createdProductId
          ) {

            try {

              const paths =
                newUploadedImages

                  .map(
                    image =>
                      image.path
                  )

                  .filter(
                    Boolean
                  );


              if (
                paths.length
              ) {

                await supabase.storage

                  .from(
                    PRODUCT_IMAGES_BUCKET
                  )

                  .remove(
                    paths
                  );

              }


              await supabase

                .from(
                  "products"
                )

                .delete()

                .eq(
                  "id",
                  createdProductId
                );


            } catch (
              cleanupError
            ) {

              console.error(
                "Erro ao limpar cadastro incompleto:",
                cleanupError
              );

            }

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


/* =========================================
   INICIALIZAÇÃO
========================================= */

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


  resetImageState();


  try {

    await loadMetrics();


  } catch (error) {

    handleError(
      error
    );

  }

}


/* =========================================
   ALTERAÇÃO DA SESSÃO
========================================= */

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