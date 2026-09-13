import { supabase, isConfigured } from "./supabaseClient.js";
import {
  $, $$, formatBRL, escapeHTML, formatCEP, showToast, setButtonLoading,
  requireAuth, getProfile, hydrateHeaderAuth, showSetupWarning
} from "./common.js";

let session = null;
let profile = null;

function setSection(name) {
  $$('[data-account-section]').forEach((section) => section.hidden = section.dataset.accountSection !== name);
  $$('#accountNav [data-section]').forEach((button) => button.classList.toggle("active", button.dataset.section === name));
  if (name === "orders") loadOrders();
  if (name === "favorites") loadFavorites();
}

function fillProfile(data) {
  $("#fullName").value = data?.full_name || "";
  $("#phone").value = data?.phone || "";
  $("#postalCode").value = data?.postal_code || "";
  $("#street").value = data?.street || "";
  $("#number").value = data?.number || "";
  $("#complement").value = data?.complement || "";
  $("#city").value = data?.city || "";
  $("#state").value = (data?.state || "").toUpperCase();
}

function statusLabel(status) {
  return ({
    pending_whatsapp: "Aguardando confirmação",
    confirmed: "Confirmado",
    preparing: "Em preparação",
    ready: "Pronto",
    delivered: "Entregue",
    cancelled: "Cancelado",
  })[status] || status;
}

async function loadOrders() {
  const root = $("#ordersList");
  root.innerHTML = `<div class="empty-state"><strong>Carregando...</strong></div>`;
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("id, order_number, status, subtotal, shipping_cost, total, created_at, order_items(name_snapshot, unit_price, quantity, line_total)")
      .order("created_at", { ascending: false });
    if (error) throw error;

    if (!data?.length) {
      root.innerHTML = `<div class="empty-state"><strong>Nenhum pedido ainda</strong>Quando você finalizar um pedido, ele aparecerá aqui.</div>`;
      return;
    }

    root.innerHTML = data.map((order) => `
      <article class="order-card">
        <div class="order-head">
          <div><strong>Pedido #${order.order_number}</strong><div class="order-meta">${new Date(order.created_at).toLocaleString("pt-BR")}</div></div>
          <span class="status-pill status-${escapeHTML(order.status)}">${escapeHTML(statusLabel(order.status))}</span>
        </div>
        <div class="order-items">
          ${(order.order_items || []).map((item) => `<div class="order-item-line"><span>${item.quantity}x ${escapeHTML(item.name_snapshot)}</span><strong>${formatBRL(item.line_total)}</strong></div>`).join("")}
        </div>
        <div class="order-total">
          <div><span>Subtotal</span><strong>${formatBRL(order.subtotal)}</strong></div>
          <div><span>Frete</span><strong>${order.shipping_cost == null ? "A confirmar" : formatBRL(order.shipping_cost)}</strong></div>
          <div><span>Total</span><strong>${formatBRL(order.total)}</strong></div>
        </div>
      </article>`).join("");
  } catch (error) {
    root.innerHTML = `<div class="empty-state"><strong>Erro ao carregar pedidos</strong>${escapeHTML(error.message)}</div>`;
  }
}

async function loadFavorites() {
  const root = $("#favoritesGrid");
  root.innerHTML = `<div class="empty-state"><strong>Carregando...</strong></div>`;
  try {
    const { data, error } = await supabase
      .from("favorites")
      .select("product_id, products(id,name,description,price,compare_at_price,category,image_url,stock,active)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    const products = (data || []).map((row) => row.products).filter((product) => product?.active);
    if (!products.length) {
      root.innerHTML = `<div class="empty-state"><strong>Você ainda não favoritou produtos</strong>Use o coração nos produtos da loja para salvá-los aqui.</div>`;
      return;
    }
    root.innerHTML = products.map((product) => `
      <article class="product-card">
        <div class="product-media">${product.image_url ? `<img src="${escapeHTML(product.image_url)}" alt="${escapeHTML(product.name)}">` : `<div class="product-placeholder">🐔</div>`}</div>
        <div class="product-body">
          <div class="product-category">${escapeHTML(product.category || "Produto")}</div>
          <h3 class="product-name">${escapeHTML(product.name)}</h3>
          <p class="product-desc">${escapeHTML(product.description || "")}</p>
          <div class="product-price-row"><div class="price-group"><strong>${formatBRL(product.price)}</strong></div></div>
          <div class="product-actions"><a class="btn btn-primary" href="/#produtos">Ver na loja</a><button class="btn btn-ghost" type="button" data-remove-favorite="${product.id}">Remover</button></div>
        </div>
      </article>`).join("");
  } catch (error) {
    root.innerHTML = `<div class="empty-state"><strong>Erro ao carregar favoritos</strong>${escapeHTML(error.message)}</div>`;
  }
}

async function init() {
  if (!isConfigured) {
    showSetupWarning();
    return;
  }

  session = await requireAuth();
  if (!session) return;
  $("#accountEmail").textContent = session.user.email || "";
  profile = await getProfile(session.user.id);
  fillProfile(profile);
  hydrateHeaderAuth();

  const params = new URLSearchParams(location.search);
  if (params.get("checkout") === "1") {
    showToast("Complete seus dados de entrega para finalizar o pedido.");
  }

  $$('#accountNav [data-section]').forEach((button) => button.addEventListener("click", () => setSection(button.dataset.section)));
  $("#postalCode")?.addEventListener("input", (event) => event.target.value = formatCEP(event.target.value));
  $("#state")?.addEventListener("input", (event) => event.target.value = event.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2));

  $("#profileForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = $("#saveProfileButton");
    setButtonLoading(button, true, "Salvando...");
    try {
      const payload = {
        full_name: $("#fullName").value.trim(),
        phone: $("#phone").value.trim(),
        postal_code: formatCEP($("#postalCode").value),
        street: $("#street").value.trim(),
        number: $("#number").value.trim(),
        complement: $("#complement").value.trim() || null,
        city: $("#city").value.trim(),
        state: $("#state").value.trim().toUpperCase(),
      };
      const { data, error } = await supabase.from("profiles").update(payload).eq("id", session.user.id).select().single();
      if (error) throw error;
      profile = data;
      showToast("Dados atualizados com sucesso.", "success");
      if (params.get("checkout") === "1") {
        setTimeout(() => location.href = "/?checkout=1", 600);
      }
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setButtonLoading(button, false);
    }
  });

  $("#favoritesGrid")?.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-remove-favorite]");
    if (!button) return;
    const { error } = await supabase.from("favorites").delete().eq("user_id", session.user.id).eq("product_id", button.dataset.removeFavorite);
    if (error) return showToast(error.message, "error");
    showToast("Favorito removido.");
    loadFavorites();
  });

  $("#logoutButton")?.addEventListener("click", async () => {
    await supabase.auth.signOut();
    location.href = "/";
  });
}

init().catch((error) => showToast(error.message, "error"));
