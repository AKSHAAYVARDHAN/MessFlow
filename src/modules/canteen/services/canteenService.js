import { supabase } from '../../../services/supabase';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Generate a 6-char uppercase alphanumeric token */
function generateToken() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let token = '';
  for (let i = 0; i < 6; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

// ─── Canteens ─────────────────────────────────────────────────────────────────

export async function fetchCanteens() {
  const { data, error } = await supabase
    .from('canteens')
    .select('*')
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function fetchCanteen(canteenId) {
  const { data, error } = await supabase
    .from('canteens')
    .select('*')
    .eq('id', canteenId)
    .single();
  if (error) throw error;
  return data;
}

// ─── Menu Items ───────────────────────────────────────────────────────────────

export async function fetchMenuItems(canteenId) {
  const query = supabase
    .from('menu_items')
    .select('*')
    .order('category')
    .order('name');

  if (canteenId) query.eq('canteen_id', canteenId);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function fetchAllMenuItems() {
  const { data, error } = await supabase
    .from('menu_items')
    .select('*, canteens(id, name)')
    .order('category')
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function updateItemAvailability(itemId, isAvailable) {
  const { error } = await supabase
    .from('menu_items')
    .update({ is_available: isAvailable })
    .eq('id', itemId);
  if (error) throw error;
}

// ─── Orders ───────────────────────────────────────────────────────────────────

/**
 * Place a new order with a generated token_id.
 */
export async function placeOrder({ userId, canteenId, items, pickupTime, totalAmount, notes }) {
  const token_id = generateToken();

  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert({
      user_id: userId,
      canteen_id: canteenId,
      total_amount: totalAmount,
      pickup_time: pickupTime,
      status: 'not_preparing',
      notes: notes ?? null,
      token_id,
    })
    .select()
    .single();

  if (orderErr) throw orderErr;

  const orderItems = items.map(({ item, quantity }) => ({
    order_id: order.id,
    item_id: item.id,
    quantity,
    price_at_order: item.price,
  }));

  const { error: itemsErr } = await supabase.from('order_items').insert(orderItems);
  if (itemsErr) throw itemsErr;

  return order;
}

export async function fetchUserOrders(userId) {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      canteens ( id, name, location ),
      order_items (
        id,
        quantity,
        price_at_order,
        menu_items ( id, name, category, is_veg )
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchOrder(orderId) {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      canteens ( id, name, location ),
      order_items (
        id, quantity, price_at_order,
        menu_items ( id, name, category, is_veg )
      )
    `)
    .eq('id', orderId)
    .single();
  if (error) throw error;
  return data;
}

export async function updateOrderStatus(orderId, status) {
  const { error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', orderId);
  if (error) throw error;
}

export async function fetchCanteenOrders(canteenId) {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *, order_items (
        id, quantity, price_at_order,
        menu_items ( id, name, category )
      )
    `)
    .eq('canteen_id', canteenId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
