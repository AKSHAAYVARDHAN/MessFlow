import { useCart } from '../context/CartContext';

const FOOD_PLACEHOLDERS = {
  Starters:     'linear-gradient(135deg,#f093fb,#f5576c)',
  Soups:        'linear-gradient(135deg,#4facfe,#00f2fe)',
  'Main Course':'linear-gradient(135deg,#43e97b,#38f9d7)',
  Beverages:    'linear-gradient(135deg,#fa709a,#fee140)',
  Desserts:     'linear-gradient(135deg,#a18cd1,#fbc2eb)',
};

export default function MenuItemCard({ item, canteenId, canteenName }) {
  const { addItem, removeItem, getQuantity } = useCart();
  const qty = getQuantity(item.id);
  const bg = FOOD_PLACEHOLDERS[item.category] ?? 'linear-gradient(135deg,#667eea,#764ba2)';

  return (
    <div className={`ct-menu-card ${!item.is_available ? 'ct-menu-card--unavailable' : ''}`}>
      {/* Image */}
      <div className="ct-menu-img" style={{ background: item.image_url ? undefined : bg }}>
        {item.image_url && <img src={item.image_url} alt={item.name} />}
        {!item.is_available && (
          <div className="ct-menu-sold-out">Unavailable</div>
        )}
      </div>

      {/* Body */}
      <div className="ct-menu-body">
        {/* Diet badge */}
        <div className="ct-menu-top">
          <span className={`ct-diet-badge ${item.is_veg ? 'veg' : 'nonveg'}`}>
            <span className={item.is_veg ? 'veg-dot' : 'nonveg-dot'} />
            {item.is_veg ? 'Veg' : 'Non-Veg'}
          </span>
          {item.canteens?.name && (
            <span className="ct-menu-canteen-tag">{item.canteens.name}</span>
          )}
        </div>

        <p className="ct-menu-name">{item.name}</p>
        {item.description && <p className="ct-menu-desc">{item.description}</p>}
        <p className="ct-menu-price">₹{Number(item.price).toFixed(2)}</p>

        {/* Add / Qty controls */}
        <div className="ct-menu-action">
          {item.is_available ? (
            qty === 0 ? (
              <button
                className="ct-add-btn"
                onClick={() => addItem(item, canteenId, canteenName)}
                id={`add-${item.id}`}
              >
                + Add
              </button>
            ) : (
              <div className="qty-controls">
                <button className="qty-btn" onClick={() => removeItem(item.id)}>−</button>
                <span className="qty-value">{qty}</span>
                <button
                  className="qty-btn qty-btn-add"
                  onClick={() => addItem(item, canteenId, canteenName)}
                >+</button>
              </div>
            )
          ) : (
            <span className="ct-menu-unavail-label">Not available</span>
          )}
        </div>
      </div>
    </div>
  );
}
