import { supabase } from './supabase';
import { format } from 'date-fns';

const MEAL_LABEL = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };

export const menuService = {
    /**
     * Get all menus for a specific date.
     * Returns an array of menu rows (up to 3 — one per meal_type).
     */
    async getMenusByDate(date) {
        const { data, error } = await supabase
            .from('menus')
            .select('*')
            .eq('date', date)
            .order('meal_type', { ascending: true });
        if (error) throw error;
        return data || [];
    },

    /**
     * Get today's menus (shortcut).
     */
    async getTodayMenus() {
        const today = new Date().toISOString().split('T')[0];
        return this.getMenusByDate(today);
    },

    /**
     * Upsert a menu entry for a given date and meal_type.
     * Automatically creates an announcement for the update.
     *
     * @param {string} date - ISO date string (YYYY-MM-DD)
     * @param {string} mealType - 'breakfast' | 'lunch' | 'dinner'
     * @param {string} items - newline-separated menu items
     * @param {string} userId - UUID of the admin performing the update
     */
    async upsertMenu(date, mealType, items, userId) {
        // DB CHECK constraint requires title-cased values: 'Breakfast' | 'Lunch' | 'Dinner'
        const dbMealType = mealType.charAt(0).toUpperCase() + mealType.slice(1);

        const { data, error } = await supabase
            .from('menus')
            .upsert(
                { date, meal_type: dbMealType, items, updated_by: userId },
                { onConflict: 'date,meal_type' }
            )
            .select()
            .single();
        if (error) throw error;

        // Auto-create announcement
        const friendlyDate = format(new Date(date + 'T00:00:00'), 'MMM d');
        const label = MEAL_LABEL[mealType] || dbMealType;
        const title = `Menu updated for ${label} on ${friendlyDate}`;
        const description = `The ${label.toLowerCase()} menu has been updated. Check today's menu for details.`;

        await supabase.from('announcements').insert({
            title,
            description,
            meal_type: dbMealType,
            date,
            is_important: false,
        });

        return data;
    },

    /**
     * Delete a menu entry.
     */
    async deleteMenu(id) {
        const { error } = await supabase
            .from('menus')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },
};
