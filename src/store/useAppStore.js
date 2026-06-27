import { create } from 'zustand';

const readJson = (key, fallback) => JSON.parse(localStorage.getItem(key) || 'null') || fallback;
const writeJson = (key, value) => localStorage.setItem(key, JSON.stringify(value));

export const useAppStore = create((set, get) => ({
  theme: localStorage.getItem('theme') || 'light',
  session: readJson('tb-session', null),
  profile: readJson('tb-profile', null),
  notifications: readJson('tb-notifications', []),
  resume: readJson('tb-resume', null),
  adminUsers: readJson('tb-admin-users', []),
  adminResumes: readJson('tb-admin-resumes', []),
  contactMessages: readJson('tb-contact-messages', []),
  setTheme: (theme) => {
    localStorage.setItem('theme', theme);
    set({ theme });
  },
  setAuth: ({ session, profile }) => {
    session ? writeJson('tb-session', session) : localStorage.removeItem('tb-session');
    profile ? writeJson('tb-profile', profile) : localStorage.removeItem('tb-profile');
    set({ session, profile });
  },
  logout: () => get().setAuth({ session: null, profile: null }),
  setNotifications: (notifications) => {
    writeJson('tb-notifications', notifications);
    set({ notifications });
  },
  setProfile: (profile) => {
    writeJson('tb-profile', profile);
    set({ profile });
  },
  setResume: (resume) => {
    writeJson('tb-resume', resume);
    set({ resume });
  },
  setAdminUsers: (adminUsers) => {
    writeJson('tb-admin-users', adminUsers);
    set({ adminUsers });
  },
  setAdminResumes: (adminResumes) => {
    writeJson('tb-admin-resumes', adminResumes);
    set({ adminResumes });
  },
  setContactMessages: (contactMessages) => {
    writeJson('tb-contact-messages', contactMessages);
    set({ contactMessages });
  },
  addContactMessage: (message) => set((state) => {
    const contactMessages = [{ id: Date.now(), is_read: false, created_at: new Date().toISOString(), ...message }, ...state.contactMessages];
    writeJson('tb-contact-messages', contactMessages);
    return { contactMessages };
  }),
  addNotification: (notification) => set((state) => {
    const notifications = [{ id: Date.now(), is_read: false, created_at: new Date().toISOString(), ...notification }, ...state.notifications];
    writeJson('tb-notifications', notifications);
    return { notifications };
  }),
  markNotificationRead: (id) => set((state) => {
    const notifications = state.notifications.map((item) => item.id === id ? { ...item, is_read: true } : item);
    writeJson('tb-notifications', notifications);
    return { notifications };
  }),
  updateAdminResume: (id, patch) => set((state) => {
    const adminResumes = state.adminResumes.map((item) => item.id === id ? { ...item, ...patch } : item);
    writeJson('tb-admin-resumes', adminResumes);
    return { adminResumes };
  }),
  deleteAdminResume: (id) => set((state) => {
    const adminResumes = state.adminResumes.filter((item) => item.id !== id);
    writeJson('tb-admin-resumes', adminResumes);
    return { adminResumes };
  }),
  deleteContactMessage: (id) => set((state) => {
    const contactMessages = state.contactMessages.filter((item) => item.id !== id);
    writeJson('tb-contact-messages', contactMessages);
    return { contactMessages };
  }),
  toggleContactMessageRead: (id) => set((state) => {
    const contactMessages = state.contactMessages.map((item) => item.id === id ? { ...item, is_read: !item.is_read } : item);
    writeJson('tb-contact-messages', contactMessages);
    return { contactMessages };
  })
}));
