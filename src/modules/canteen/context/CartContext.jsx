import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const CartContext = createContext(null);

const CART_KEY = 'messflow_canteen_cart';

function loadCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : { canteenId: null, canteenName: '', items: {} };
  } catch {
    return { canteenId: null, canteenName: '', items: {} };
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

/**
 * CartProvider — wraps the canteen module.
 *
 * cart.items shape: { [itemId]: { item: MenuItemObject, quantity: number } }
 */
export function CartProvider({ children }) {
  const [cart, setCart] = useState(loadCart);

  // Persist to localStorage on every change
  useEffect(() => {
    saveCart(cart);
  }, [cart]);

  /** Add one unit of an item. If from a different canteen, clear cart first. */
  const addItem = useCallback((item, canteenId, canteenName) => {
    setCart(prev => {
      // If switching canteen, start fresh
      if (prev.canteenId && prev.canteenId !== canteenId) {
        const confirmSwitch = window.confirm(
          'Your cart has items from another canteen. Clear cart and switch?'
        );
        if (!confirmSwitch) return prev;
        return {
          canteenId,
          canteenName,
          items: { [item.id]: { item, quantity: 1 } },
        };
      }

      const existing = prev.items[item.id];
      return {
        canteenId: canteenId || prev.canteenId,
        canteenName: canteenName || prev.canteenName,
        items: {
          ...prev.items,
          [item.id]: {
            item,
            quantity: existing ? existing.quantity + 1 : 1,
          },
        },
      };
    });
  }, []);

  /** Remove one unit of an item (removes entry if qty reaches 0). */
  const removeItem = useCallback((itemId) => {
    setCart(prev => {
      const existing = prev.items[itemId];
      if (!existing) return prev;
      if (existing.quantity <= 1) {
        const { [itemId]: _, ...rest } = prev.items;
        const hasItems = Object.keys(rest).length > 0;
        return { ...prev, items: rest, canteenId: hasItems ? prev.canteenId : null };
      }
      return {
        ...prev,
        items: { ...prev.items, [itemId]: { ...existing, quantity: existing.quantity - 1 } },
      };
    });
  }, []);

  /** Set exact quantity for an item. */
  const setQuantity = useCallback((itemId, quantity) => {
    if (quantity <= 0) {
      removeItem(itemId);
      return;
    }
    setCart(prev => {
      if (!prev.items[itemId]) return prev;
      return {
        ...prev,
        items: { ...prev.items, [itemId]: { ...prev.items[itemId], quantity } },
      };
    });
  }, [removeItem]);

  /** Clear the entire cart. */
  const clearCart = useCallback(() => {
    setCart({ canteenId: null, canteenName: '', items: {} });
  }, []);

  // Derived values
  const itemList = Object.values(cart.items);
  const totalItems = itemList.reduce((sum, e) => sum + e.quantity, 0);
  const totalAmount = itemList.reduce((sum, e) => sum + e.item.price * e.quantity, 0);
  const getQuantity = (itemId) => cart.items[itemId]?.quantity ?? 0;

  const value = {
    cart,
    itemList,
    totalItems,
    totalAmount,
    addItem,
    removeItem,
    setQuantity,
    clearCart,
    getQuantity,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
