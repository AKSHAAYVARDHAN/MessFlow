import { supabase } from './supabase';

export const announcementService = {
    /**
     * Get the most recent announcements.
     */
    async getAnnouncements(limit = 20) {
        const { data, error } = await supabase
            .from('announcements')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error) throw error;
        return data || [];
    },

    /**
     * Get announcements for a specific date (includes 'all'-meal announcements).
     */
    async getAnnouncementsByDate(date) {
        const { data, error } = await supabase
            .from('announcements')
            .select('*')
            .eq('date', date)
            .order('is_important', { ascending: false })
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    /**
     * Create a new announcement.
     */
    async createAnnouncement(title, description, mealType, date, isImportant = false) {
        const { data, error } = await supabase
            .from('announcements')
            .insert({
                title,
                description,
                meal_type: mealType || null,
                date,
                is_important: isImportant,
            })
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    /**
     * Update an existing announcement.
     */
    async updateAnnouncement(id, { title, description, mealType, date, isImportant }) {
        const { data, error } = await supabase
            .from('announcements')
            .update({
                title,
                description,
                meal_type: mealType || null,
                date,
                is_important: isImportant,
            })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    /**
     * Delete an announcement by ID.
     */
    async deleteAnnouncement(id) {
        const { error } = await supabase
            .from('announcements')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },
};
