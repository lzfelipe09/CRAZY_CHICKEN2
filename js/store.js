import { supabase, isConfigured } from "./supabaseClient.js";
import { WHATSAPP_NUMBER, INSTAGRAM_URL } from "./config.js";
import {
  $, $$, formatBRL, escapeHTML, showToast, showSetupWarning, getSession, getProfile,
  hydrateHeaderAuth, bindMobileMenu
} from "./common.js";

const state = {
  products: [],
  filtered: [],
  cart: loadCart(),
  favorites: new Set(),
  category: "all",
  search: "",
  sort: "featured",
  session: null,
};

function loadCart() {
  try {
    const parsed = JSON.parse(localStorage.getItem("crazyChickenCart") || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCart() {
  localStorage.setItem("crazyChickenCart", JSON.stringify(state.cart));
  renderCart();
}

function productById(id) {
  return state.products.find((product) => product.id === id);
}

function normalizeCartAgainstStock() {
  state.cart = state.cart
    .filter((item) => productById(item.product_id))
    .map((item) => {
      const product = productById(item.product_id);
      return { ...item, quantity: Math.max(1, Math.min(Number(item.quantity || 1), Number(product.stock || 0))) };
    })
    .filter((item) => item.quantity > 0);
  saveCart();
}

function productCard(product) {
  const hasDiscount = product.compare_at_price && Number(product.compare_at_price) > Number(product.price);
  const favorite = state.favorites.has(product.id);
  const inStock = Number(product.stock) > 0;
  const image = product.image_url
    ? `<img src="${escapeHTML(product.image_url)}" alt="${escapeHTML(product.name)}" loading="lazy">`
    : `<div class="product-placeholder">🐔</div>`;

  return `
    <article class="product-card" data-product-id="${product.id}">
      <div class="product-media">
        ${image}
        <div class="product-badges">
          ${product.is_new ? '<span class="badge badge-new">Novidade</span>' : ""}
          ${product.featured ? '<span class="badge">Destaque</span>' : ""}
          ${!inStock ? '<span class="badge badge-out">Sem estoque</span>' : ""}
        </div>
        <button class="favorite-btn ${favorite ? "active" : ""}" type="button" data-favorite="${product.id}" aria-label="Favoritar">${favorite ? "♥" : "♡"}</button>
      </div>
      <div class="product-body">
        <div class="product-category">${escapeHTML(product.category || "Produtos")}</div>
        <h3 class="product-name">${escapeHTML(product.name)}</h3>
        <p class="product-desc">${escapeHTML(product.description || "Produto Crazy Chicken.")}</p>
        <div class="product-price-row">
          <div class="price-group">
            ${hasDiscount ? `<span class="old-price">${formatBRL(product.compare_at_price)}</span>` : ""}
            <strong>${formatBRL(product.price)}</strong>
          </div>
          <span class="stock-text ${inStock ? "" : "out"}">${inStock ? `${product.stock} em estoque` : "Indisponível"}</span>
        </div>
        <div class="product-actions">
          <button class="btn btn-primary" type="button" data-add-cart="${product.id}" ${inStock ? "" : "disabled"}>Adicionar</button>
          <button class="btn btn-ghost" type="button" data-open-cart="1">Carrinho</button>
        </div>
      </div>
    </article>`;
}

function renderProducts() {
  const grid = $("#productGrid");
  if (!grid) return;
  if (!state.filtered.length) {
    grid.innerHTML = `<div class="empty-state"><strong>Nenhum produto encontrado</strong>Tente outra pesquisa ou categoria.</div>`;
    return;
  }
  grid.innerHTML = state.filtered.map(productCard).join("");
}

function applyFilters() {
  const query = state.search.trim().toLowerCase();
  let list = state.products.filter((product) => {
    const matchesCategory = state.category === "all" || (product.category || "").toLowerCase() === state.category;
    const haystack = `${product.name} ${product.category || ""} ${product.description || ""}`.toLowerCase();
    return matchesCategory && (!query || haystack.includes(query));
  });

  list = [...list].sort((a, b) => {
    if (state.sort === "price-asc") return Number(a.price) - Number(b.price);
    if (state.sort === "price-desc") return Number(b.price) - Number(a.price);
    if (state.sort === "name") return a.name.localeCompare(b.name, "pt-BR");
    if (state.sort === "newest") return new Date(b.created_at) - new Date(a.created_at);
    return Number(b.featured) - Number(a.featured) || Number(b.is_new) - Number(a.is_new) || new Date(b.created_at) - new Date(a.created_at);
  });

  state.filtered = list;
  renderProducts();
}

function renderCategories() {
  const row = $("#categoryRow");
  if (!row) return;
  const categories = [...new Set(state.products.map((p) => (p.category || "Outros").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
  row.innerHTML = [
    `<button class="category-chip active" type="button" data-category="all">Todos</button>`,
    ...categories.map((category) => `<button class="category-chip" type="button" data-category="${escapeHTML(category.toLowerCase())}">${escapeHTML(category)}</button>`),
  ].join("");
}

function addToCart(productId) {
  const product = productById(productId);
  if (!product || Number(product.stock) <= 0) return showToast("Produto sem estoque.", "error");
  const existing = state.cart.find((item) => item.product_id === productId);
  const nextQty = existing ? existing.quantity + 1 : 1;
  if (nextQty > Number(product.stock)) return showToast("Quantidade maior que o estoque disponível.", "error");
  if (existing) existing.quantity = nextQty;
  else state.cart.push({ product_id: productId, quantity: 1 });
  saveCart();
  showToast("Produto adicionado ao carrinho.", "success");
}

function updateQuantity(productId, delta) {
  const item = state.cart.find((entry) => entry.product_id === productId);
  const product = productById(productId);
  if (!item || !product) return;
  const next = item.quantity + delta;
  if (next <= 0) state.cart = state.cart.filter((entry) => entry.product_id !== productId);
  else if (next <= Number(product.stock)) item.quantity = next;
  else showToast("Você atingiu o estoque disponível.", "error");
  saveCart();
}

function removeFromCart(productId) {
  state.cart = state.cart.filter((entry) => entry.product_id !== productId);
  saveCart();
}

function renderCart() {
  const root = $("#cartItems");
  if (!root) return;
  const validItems = state.cart.map((item) => ({ item, product: productById(item.product_id) })).filter((row) => row.product);
  const quantity = validItems.reduce((sum, row) => sum + Number(row.item.quantity), 0);
  const subtotal = validItems.reduce((sum, row) => sum + Number(row.product.price) * Number(row.item.quantity), 0);

  $("#cartCount").textContent = quantity;
  $("#cartItemsTotal").textContent = quantity;
  $("#cartSubtotal").textContent = formatBRL(subtotal);

  if (!validItems.length) {
    root.innerHTML = `<div class="empty-state"><strong>Seu carrinho está vazio</strong>Adicione produtos para continuar.</div>`;
    return;
  }

  root.innerHTML = validItems.map(({ item, product }) => `
    <div class="cart-item">
      <div class="cart-thumb">${product.image_url ? `<img src="${escapeHTML(product.image_url)}" alt="">` : "🐔"}</div>
      <div>
        <strong>${escapeHTML(product.name)}</strong>
        <div class="line-price">${formatBRL(product.price)} cada</div>
        <div class="qty-control">
          <button type="button" data-qty="-1" data-id="${product.id}">−</button>
          <span>${item.quantity}</span>
          <button type="button" data-qty="1" data-id="${product.id}">+</button>
        </div>
      </div>
      <button class="remove-btn" type="button" data-remove="${product.id}" aria-label="Remover">×</button>
    </div>`).join("");
}

function openCart() {
  $("#cartDrawer")?.classList.add("open");
  $("#cartBackdrop")?.classList.add("open");
  document.body.classList.add("no-scroll");
}

function closeCart() {
  $("#cartDrawer")?.classList.remove("open");
  $("#cartBackdrop")?.classList.remove("open");
  document.body.classList.remove("no-scroll");
}

async function loadFavorites() {
  if (!state.session) return;
  const { data, error } = await supabase.from("favorites").select("product_id").eq("user_id", state.session.user.id);
  if (!error) state.favorites = new Set((data || []).map((row) => row.product_id));
}

async function toggleFavorite(productId) {
  if (!isConfigured) return showSetupWarning();
  const session = state.session || await getSession();
  if (!session) {
    location.href = `/login?redirect=${encodeURIComponent(location.pathname + location.hash)}`;
    return;
  }

  try {
    if (state.favorites.has(productId)) {
      const { error } = await supabase.from("favorites").delete().eq("user_id", session.user.id).eq("product_id", productId);
      if (error) throw error;
      state.favorites.delete(productId);
      showToast("Removido dos favoritos.");
    } else {
      const { error } = await supabase.from("favorites").insert({ user_id: session.user.id, product_id: productId });
      if (error) throw error;
      state.favorites.add(productId);
      showToast("Adicionado aos favoritos.", "success");
    }
    renderProducts();
  } catch (error) {
    showToast(error.message, "error");
  }
}

function profileComplete(profile) {
  return [profile?.full_name, profile?.phone, profile?.postal_code, profile?.street, profile?.number, profile?.city, profile?.state].every((value) => String(value || "").trim());
}

async function checkout() {
  if (!state.cart.length) return showToast("Seu carrinho está vazio.", "error");
  if (!isConfigured) return showSetupWarning();

  const button = $("#checkoutButton");
  button.disabled = true;
  const oldText = button.textContent;
  button.textContent = "Preparando pedido...";
  // Abre a aba durante o clique do usuário para evitar bloqueio de popup.
  // Ela é fechada caso seja necessário redirecionar para login/cadastro.
  let popup = window.open("about:blank", "_blank");
  try {
    const session = await getSession();
    if (!session) {
      if (popup) popup.close();
      location.href = `/login?redirect=${encodeURIComponent("/?checkout=1")}`;
      return;
    }

    const profile = await getProfile(session.user.id);
    if (!profileComplete(profile)) {
      if (popup) popup.close();
      location.href = "/conta?checkout=1";
      return;
    }

    const items = state.cart.map((item) => ({ product_id: item.product_id, quantity: item.quantity }));
    const { data, error } = await supabase.rpc("create_order", { p_items: items });
    if (error) throw error;

    const orderNumber = data.order_number;
    const subtotal = Number(data.subtotal);
    const messageLines = [
      `Olá! Quero confirmar o pedido #${orderNumber} da Crazy Chicken.`,
      "",
      `Cliente: ${profile.full_name}`,
      `Telefone: ${profile.phone}`,
      "",
      "Produtos:",
      ...state.cart.map((item) => {
        const product = productById(item.product_id);
        return `${item.quantity}x ${product.name} — ${formatBRL(Number(product.price) * Number(item.quantity))}`;
      }),
      "",
      `Subtotal: ${formatBRL(subtotal)}`,
      "Frete: a confirmar conforme o CEP",
      "",
      `CEP: ${profile.postal_code}`,
      `Endereço: ${profile.street}, ${profile.number}${profile.complement ? ` - ${profile.complement}` : ""}`,
      `${profile.city}/${profile.state}`,
    ];
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(messageLines.join("\n"))}`;

    state.cart = [];
    saveCart();
    showToast(`Pedido #${orderNumber} registrado.`, "success");
    if (popup) popup.location.href = url;
    else location.href = url;
  } catch (error) {
    if (popup) popup.close();
    const msg = error.message?.includes("Complete seu cadastro") ? "Complete seus dados de entrega antes de finalizar." : error.message;
    showToast(msg, "error");
  } finally {
    button.disabled = false;
    button.textContent = oldText;
  }
}

async function init() {
  $("#year").textContent = new Date().getFullYear();
  $("#footerWhatsapp").href = `https://wa.me/${WHATSAPP_NUMBER}`;
  $("#footerInstagram").href = INSTAGRAM_URL;
  bindMobileMenu();
  hydrateHeaderAuth();

  $("#openCart")?.addEventListener("click", openCart);
  $("#closeCart")?.addEventListener("click", closeCart);
  $("#cartBackdrop")?.addEventListener("click", closeCart);
  $("#checkoutButton")?.addEventListener("click", checkout);

  $("#searchInput")?.addEventListener("input", (event) => { state.search = event.target.value; applyFilters(); });
  $("#sortSelect")?.addEventListener("change", (event) => { state.sort = event.target.value; applyFilters(); });
  $("#categoryRow")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    state.category = button.dataset.category;
    $$(".category-chip", $("#categoryRow")).forEach((chip) => chip.classList.toggle("active", chip === button));
    applyFilters();
  });

  $("#productGrid")?.addEventListener("click", (event) => {
    const add = event.target.closest("[data-add-cart]");
    const favorite = event.target.closest("[data-favorite]");
    const cart = event.target.closest("[data-open-cart]");
    if (add) addToCart(add.dataset.addCart);
    if (favorite) toggleFavorite(favorite.dataset.favorite);
    if (cart) openCart();
  });

  $("#cartItems")?.addEventListener("click", (event) => {
    const qty = event.target.closest("[data-qty]");
    const remove = event.target.closest("[data-remove]");
    if (qty) updateQuantity(qty.dataset.id, Number(qty.dataset.qty));
    if (remove) removeFromCart(remove.dataset.remove);
  });

  if (!isConfigured) {
    showSetupWarning();
    $("#productGrid").innerHTML = `<div class="empty-state"><strong>Conecte o Supabase</strong>Edite <code>js/config.js</code> e siga o README para ativar o catálogo.</div>`;
    renderCart();
    return;
  }

  try {
    state.session = await getSession();
    const [productsResult] = await Promise.all([
      supabase.from("products").select("*").eq("active", true).order("featured", { ascending: false }).order("created_at", { ascending: false }),
      loadFavorites(),
    ]);
    if (productsResult.error) throw productsResult.error;
    state.products = productsResult.data || [];
    normalizeCartAgainstStock();
    renderCategories();
    applyFilters();

    if (new URLSearchParams(location.search).get("checkout") === "1") {
      openCart();
      history.replaceState({}, "", location.pathname + location.hash);
    }
  } catch (error) {
    $("#productGrid").innerHTML = `<div class="empty-state"><strong>Não foi possível carregar os produtos</strong>${escapeHTML(error.message)}</div>`;
    showToast(error.message, "error");
  }
}

init();
