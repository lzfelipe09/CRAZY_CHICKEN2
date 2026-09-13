import { supabase, isConfigured } from "./supabaseClient.js";
import {
  $, $$, formatBRL, escapeHTML, showToast, setButtonLoading,
  requireAdmin, showSetupWarning
} from "./common.js";

let adminSession = null;
let products = [];
let orders = [];
let customers = [];

const statuses = {
  pending_whatsapp: "Aguardando confirmação",
  confirmed: "Confirmado",
  preparing: "Em preparação",
  ready: "Pronto",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

function setSection(name) {
  $$('[data-admin-section]').forEach((section) => section.hidden = section.dataset.adminSection !== name);
  $$('#adminNav [data-section]').forEach((button) => button.classList.toggle("active", button.dataset.section === name));
  if (name === "orders") loadOrders();
  if (name === "customers") loadCustomers();
}

function resetProductForm() {
  $("#productForm").reset();
  $("#productId").value = "";
  $("#existingImagePath").value = "";
  $("#productActive").checked = true;
  $("#productStock").value = "0";
  $("#imagePreview").innerHTML = "Sem imagem selecionada";
  $("#productFormTitle").textContent = "Adicionar produto";
  $("#saveProductButton").textContent = "Salvar produto";
}

function renderProducts() {
  const body = $("#adminProductsBody");
  const query = $("#adminProductSearch").value.trim().toLowerCase();
  const visible = products.filter((product) => !query || `${product.name} ${product.category || ""} ${product.sku || ""}`.toLowerCase().includes(query));
  if (!visible.length) {
    body.innerHTML = `<tr><td colspan="6">Nenhum produto encontrado.</td></tr>`;
    return;
  }
  body.innerHTML = visible.map((product) => `
    <tr>
      <td><div class="table-product"><div class="table-thumb">${product.image_url ? `<img src="${escapeHTML(product.image_url)}" alt="">` : "🐔"}</div><div><strong>${escapeHTML(product.name)}</strong><div class="muted">${escapeHTML(product.sku || "Sem SKU")}</div></div></div></td>
      <td>${escapeHTML(product.category || "—")}</td>
      <td>${formatBRL(product.price)}</td>
      <td>${product.stock}</td>
      <td><span class="status-pill ${product.active ? "status-confirmed" : "status-cancelled"}">${product.active ? "Ativo" : "Oculto"}</span></td>
      <td><div class="row-actions"><button class="btn btn-ghost btn-sm" data-edit-product="${product.id}" type="button">Editar</button><button class="btn btn-danger btn-sm" data-delete-product="${product.id}" type="button">Excluir</button></div></td>
    </tr>`).join("");
}

async function loadProducts() {
  const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  products = data || [];
  $("#metricProducts").textContent = products.filter((p) => p.active).length;
  renderProducts();
}

function editProduct(id) {
  const product = products.find((item) => item.id === id);
  if (!product) return;
  $("#productId").value = product.id;
  $("#existingImagePath").value = product.image_path || "";
  $("#productName").value = product.name || "";
  $("#productSku").value = product.sku || "";
  $("#productCategory").value = product.category || "";
  $("#productPrice").value = product.price || "";
  $("#productComparePrice").value = product.compare_at_price || "";
  $("#productStock").value = product.stock ?? 0;
  $("#productDescription").value = product.description || "";
  $("#productNew").checked = !!product.is_new;
  $("#productFeatured").checked = !!product.featured;
  $("#productActive").checked = !!product.active;
  $("#imagePreview").innerHTML = product.image_url ? `<img src="${escapeHTML(product.image_url)}" alt="Prévia">` : "Sem imagem";
  $("#productFormTitle").textContent = "Editar produto";
  $("#saveProductButton").textContent = "Salvar alterações";
  $("#productForm").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function uploadImage(file) {
  if (!file) return null;
  if (file.size > 6 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 6 MB.");
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) throw new Error("Use uma imagem JPG, PNG ou WebP.");

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${adminSession.user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("product-images").upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from("product-images").getPublicUrl(path);
  return { path, url: data.publicUrl };
}

async function deleteProduct(id) {
  const product = products.find((item) => item.id === id);
  if (!product || !confirm(`Excluir "${product.name}"? Esta ação não pode ser desfeita.`)) return;
  try {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) throw error;
    if (product.image_path) await supabase.storage.from("product-images").remove([product.image_path]).catch(() => {});
    showToast("Produto excluído.", "success");
    await loadProducts();
  } catch (error) {
    showToast(error.message, "error");
  }
}

function statusOptions(current) {
  return Object.entries(statuses).map(([value, label]) => `<option value="${value}" ${current === value ? "selected" : ""}>${label}</option>`).join("");
}

function renderOrders() {
  const root = $("#adminOrdersList");
  if (!orders.length) {
    root.innerHTML = `<div class="empty-state"><strong>Nenhum pedido</strong>Os pedidos registrados pelos clientes aparecerão aqui.</div>`;
    return;
  }

  root.innerHTML = orders.map((order) => {
    const shipping = order.shipping_snapshot || {};
    return `
      <article class="order-card" data-order-id="${order.id}">
        <div class="order-head">
          <div><strong>Pedido #${order.order_number} — ${escapeHTML(shipping.full_name || "Cliente")}</strong><div class="order-meta">${new Date(order.created_at).toLocaleString("pt-BR")} • ${escapeHTML(shipping.phone || "sem telefone")}</div></div>
          <span class="status-pill status-${escapeHTML(order.status)}">${escapeHTML(statuses[order.status] || order.status)}</span>
        </div>
        <div class="order-items">
          ${(order.order_items || []).map((item) => `<div class="order-item-line"><span>${item.quantity}x ${escapeHTML(item.name_snapshot)}</span><strong>${formatBRL(item.line_total)}</strong></div>`).join("")}
        </div>
        <div class="muted" style="font-size:12px;line-height:1.6;margin-bottom:12px">Entrega: ${escapeHTML(shipping.street || "")}, ${escapeHTML(shipping.number || "")}${shipping.complement ? ` - ${escapeHTML(shipping.complement)}` : ""} • ${escapeHTML(shipping.city || "")}/${escapeHTML(shipping.state || "")} • CEP ${escapeHTML(shipping.postal_code || "")}</div>
        <div class="row-actions" style="flex-wrap:wrap;justify-content:space-between">
          <div class="row-actions">
            <select class="mini-select" data-order-status>${statusOptions(order.status)}</select>
            <input class="mini-input" data-order-shipping type="number" min="0" step="0.01" value="${order.shipping_cost ?? ""}" placeholder="Frete">
            <button class="btn btn-primary btn-sm" data-save-order type="button">Salvar</button>
          </div>
          <div class="order-total"><div><span>Subtotal</span><strong>${formatBRL(order.subtotal)}</strong></div><div><span>Total</span><strong>${formatBRL(order.total)}</strong></div></div>
        </div>
      </article>`;
  }).join("");
}

async function loadOrders() {
  const root = $("#adminOrdersList");
  root.innerHTML = `<div class="empty-state"><strong>Carregando...</strong></div>`;
  const { data, error } = await supabase
    .from("orders")
    .select("id,order_number,user_id,status,subtotal,shipping_cost,total,shipping_snapshot,created_at,order_items(id,name_snapshot,unit_price,quantity,line_total)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  orders = data || [];
  $("#metricOrders").textContent = orders.filter((order) => !["delivered", "cancelled"].includes(order.status)).length;
  renderOrders();
}

async function saveOrder(card) {
  const id = card.dataset.orderId;
  const order = orders.find((item) => item.id === id);
  const status = card.querySelector("[data-order-status]").value;
  const shippingRaw = card.querySelector("[data-order-shipping]").value;
  const shippingCost = shippingRaw === "" ? null : Number(shippingRaw);
  const total = Number(order.subtotal) + Number(shippingCost || 0);
  try {
    const { error } = await supabase.from("orders").update({ status, shipping_cost: shippingCost, total }).eq("id", id);
    if (error) throw error;
    showToast("Pedido atualizado.", "success");
    await loadOrders();
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function loadCustomers() {
  const { data, error } = await supabase.from("profiles").select("id,full_name,phone,city,state,postal_code,role,created_at").eq("role", "customer").order("created_at", { ascending: false });
  if (error) throw error;
  customers = data || [];
  $("#metricCustomers").textContent = customers.length;
  $("#customersBody").innerHTML = customers.length ? customers.map((customer) => `
    <tr><td><strong>${escapeHTML(customer.full_name || "Não informado")}</strong></td><td>${escapeHTML(customer.phone || "—")}</td><td>${escapeHTML(customer.city || "—")}${customer.state ? `/${escapeHTML(customer.state)}` : ""}</td><td>${escapeHTML(customer.postal_code || "—")}</td><td>${new Date(customer.created_at).toLocaleDateString("pt-BR")}</td></tr>`).join("") : `<tr><td colspan="5">Nenhum cliente cadastrado.</td></tr>`;
}

async function loadMetrics() {
  await Promise.all([loadProducts(), loadOrders(), loadCustomers()]);
}

async function init() {
  if (!isConfigured) {
    showSetupWarning();
    return;
  }
  const auth = await requireAdmin();
  if (!auth) return;
  adminSession = auth.session;

  $$('#adminNav [data-section]').forEach((button) => button.addEventListener("click", () => setSection(button.dataset.section)));
  $("#adminProductSearch")?.addEventListener("input", renderProducts);
  $("#cancelEditButton")?.addEventListener("click", resetProductForm);
  $("#refreshOrders")?.addEventListener("click", () => loadOrders().catch((error) => showToast(error.message, "error")));

  $("#productImage")?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    $("#imagePreview").innerHTML = `<img src="${url}" alt="Prévia">`;
  });

  $("#productForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = $("#saveProductButton");
    setButtonLoading(button, true, "Salvando...");
    let uploaded = null;
    try {
      const id = $("#productId").value;
      const file = $("#productImage").files?.[0];
      if (file) uploaded = await uploadImage(file);

      const payload = {
        name: $("#productName").value.trim(),
        sku: $("#productSku").value.trim() || null,
        category: $("#productCategory").value.trim(),
        price: Number($("#productPrice").value),
        compare_at_price: $("#productComparePrice").value ? Number($("#productComparePrice").value) : null,
        stock: Number($("#productStock").value),
        description: $("#productDescription").value.trim() || null,
        is_new: $("#productNew").checked,
        featured: $("#productFeatured").checked,
        active: $("#productActive").checked,
      };
      if (uploaded) {
        payload.image_url = uploaded.url;
        payload.image_path = uploaded.path;
      }
      if (payload.compare_at_price && payload.compare_at_price <= payload.price) payload.compare_at_price = null;

      if (id) {
        const oldProduct = products.find((item) => item.id === id);
        const { error } = await supabase.from("products").update(payload).eq("id", id);
        if (error) throw error;
        if (uploaded && oldProduct?.image_path) await supabase.storage.from("product-images").remove([oldProduct.image_path]).catch(() => {});
        showToast("Produto atualizado.", "success");
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
        showToast("Produto adicionado.", "success");
      }

      resetProductForm();
      await loadProducts();
    } catch (error) {
      if (uploaded?.path) await supabase.storage.from("product-images").remove([uploaded.path]).catch(() => {});
      showToast(error.message, "error");
    } finally {
      setButtonLoading(button, false);
    }
  });

  $("#adminProductsBody")?.addEventListener("click", (event) => {
    const edit = event.target.closest("[data-edit-product]");
    const remove = event.target.closest("[data-delete-product]");
    if (edit) editProduct(edit.dataset.editProduct);
    if (remove) deleteProduct(remove.dataset.deleteProduct);
  });

  $("#adminOrdersList")?.addEventListener("click", (event) => {
    const save = event.target.closest("[data-save-order]");
    if (save) saveOrder(save.closest("[data-order-id]"));
  });

  $("#adminLogout")?.addEventListener("click", async () => {
    await supabase.auth.signOut();
    location.href = "/login?redirect=/admin";
  });

  await loadMetrics();
}

init().catch((error) => showToast(error.message, "error"));
