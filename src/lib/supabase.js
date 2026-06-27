import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if credentials are valid and not placeholders
export const isRealSupabase = !!(
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes('your-') && 
  supabaseUrl.startsWith('https://')
);

// Real Supabase Client or Mock Client Setup
export const supabase = isRealSupabase 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : {
      auth: {
        getSession: async () => {
          const token = getCookie('jwt_token');
          if (!token) return { data: { session: null }, error: null };
          const payload = parseMockJWT(token);
          if (!payload) return { data: { session: null }, error: null };
          const session = {
            access_token: token,
            user: {
              id: payload.id,
              email: payload.email,
              user_metadata: {
                name: payload.name,
                phone: payload.phone,
                role: payload.role
              }
            }
          };
          return { data: { session }, error: null };
        },
        getUser: async () => {
          const res = await supabase.auth.getSession();
          return { data: { user: res.data.session?.user || null }, error: null };
        },
        onAuthStateChange: (callback) => {
          authListeners.push(callback);
          supabase.auth.getSession().then(({ data }) => {
            callback(data.session ? 'SIGNED_IN' : 'SIGNED_OUT', data.session);
          });
          return {
            data: {
              subscription: {
                unsubscribe: () => {
                  authListeners = authListeners.filter(cb => cb !== callback);
                }
              }
            }
          };
        },
        signOut: async () => {
          eraseCookie('jwt_token');
          notifyAuthListeners('SIGNED_OUT', null);
          return { error: null };
        },
        resetPasswordForEmail: async (email) => {
          console.log(`Mock password reset link sent to: ${email}`);
          return { error: null };
        }
      }
    };

export const supabaseConfigured = true; // Always return true so the UI doesn't block

export const allStatuses = ['Pending', 'Under Review', 'Accepted', 'Rejected'];
export const progressStatuses = ['Pending', 'Under Review', 'Accepted'];

// Cookie Helper Functions
const getCookie = (name) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
};

const setCookie = (name, value, days = 7) => {
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = "; expires=" + date.toUTCString();
  }
  document.cookie = name + "=" + (value || "")  + expires + "; path=/";
};

const eraseCookie = (name) => {
  document.cookie = name +'=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
};

// Mock JWT helpers
function generateMockJWT(payload) {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7) }));
  const signature = btoa("mock_signature");
  return `${header}.${body}.${signature}`;
}

function parseMockJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(atob(parts[1]));
  } catch (e) {
    return null;
  }
}

// Local Database Getters & Setters (for Mock Fallback)
const getMockUsers = () => JSON.parse(localStorage.getItem('tb-mock-users') || '[]');
const getProfiles = () => JSON.parse(localStorage.getItem('tb-mock-profiles') || '[]');
const getResumes = () => JSON.parse(localStorage.getItem('tb-mock-resumes') || '[]');
const getContactMessages = () => JSON.parse(localStorage.getItem('tb-mock-contact-messages') || '[]');
const getNotifications = () => JSON.parse(localStorage.getItem('tb-mock-notifications') || '[]');

let authListeners = [];
const notifyAuthListeners = (event, session) => {
  authListeners.forEach(cb => cb(event, session));
};

// Listen to Supabase Auth State Changes if Real Supabase is active
if (isRealSupabase) {
  supabase.auth.onAuthStateChange((event, session) => {
    // Propagate standard Auth events
  });
}

export function sanitizeText(value = '') {
  return String(value).replace(/[<>]/g, '').trim();
}

export async function adminExists() {
  if (isRealSupabase) {
    const { data, error } = await supabase.rpc('admin_exists');
    if (error) {
      // Fallback if RPC function is missing
      const { count, error: countError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'Admin');
      if (countError) return false;
      return (count || 0) > 0;
    }
    return !!data;
  }
  const profiles = getProfiles();
  return profiles.some(p => p.role === 'Admin');
}

export async function getProfile(userId) {
  if (!userId) return null;
  if (isRealSupabase) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
    return data;
  }
  const profiles = getProfiles();
  return profiles.find(p => p.id === userId) || null;
}

export async function upsertProfile(profile) {
  const clean = {
    id: profile.id,
    name: sanitizeText(profile.name),
    email: sanitizeText(profile.email).toLowerCase(),
    phone: sanitizeText(profile.phone || ''),
    role: profile.role || 'User',
    avatar: profile.avatar || null,
    created_at: profile.created_at || new Date().toISOString()
  };
  if (isRealSupabase) {
    const { data, error } = await supabase
      .from('profiles')
      .upsert(clean)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  const profiles = getProfiles();
  const idx = profiles.findIndex(p => p.id === profile.id);
  if (idx > -1) {
    profiles[idx] = { ...profiles[idx], ...clean };
  } else {
    profiles.push(clean);
  }
  localStorage.setItem('tb-mock-profiles', JSON.stringify(profiles));
  return clean;
}

export async function createAdminAccount(values) {
  if (await adminExists()) throw new Error('Admin account already exists. Please use Admin Login.');
  const email = sanitizeText(values.email).toLowerCase();
  const password = String(values.password || '');
  if (password.length < 8) throw new Error('Admin password must be at least 8 characters.');

  if (isRealSupabase) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: values.name || 'Administrator',
          role: 'Admin'
        }
      }
    });
    if (error) throw error;

    // Retrieve or insert profile
    let profile = await getProfile(data.user.id);
    if (!profile) {
      profile = await upsertProfile({
        id: data.user.id,
        name: values.name || 'Administrator',
        email,
        phone: '',
        role: 'Admin'
      });
    }
    return { session: data.session, profile };
  }

  const users = getMockUsers();
  if (users.some(u => u.email === email)) throw new Error('A user with this email already exists.');

  const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
  const newUser = { id, email, password, name: values.name || 'Administrator', phone: '', role: 'Admin' };
  users.push(newUser);
  localStorage.setItem('tb-mock-users', JSON.stringify(users));

  const profile = await upsertProfile({ id, name: newUser.name, email, phone: '', role: 'Admin' });
  const token = generateMockJWT({ id, email, name: newUser.name, phone: '', role: 'Admin' });
  setCookie('jwt_token', token, 7);

  const session = {
    access_token: token,
    user: {
      id,
      email,
      user_metadata: { name: newUser.name, phone: '', role: 'Admin' }
    }
  };

  notifyAuthListeners('SIGNED_IN', session);
  return { session, profile };
}

export async function registerUser(values) {
  const email = sanitizeText(values.email).toLowerCase();
  
  if (isRealSupabase) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password: values.password,
      options: {
        data: {
          name: values.name,
          phone: values.phone || '',
          role: 'User'
        }
      }
    });
    if (error) throw error;
    return { data, error: null };
  }

  const users = getMockUsers();
  if (users.some(u => u.email === email)) throw new Error('A user with this email already exists.');

  const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
  const newUser = { id, email, password: values.password, name: values.name, phone: values.phone || '', role: 'User' };
  users.push(newUser);
  localStorage.setItem('tb-mock-users', JSON.stringify(users));

  await upsertProfile({ id, name: values.name, email, phone: values.phone || '', role: 'User' });
  return { data: { user: { id, email } }, error: null };
}

export async function loginWithPassword({ email, password }) {
  const cleanEmail = sanitizeText(email).toLowerCase();

  if (isRealSupabase) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password
    });
    if (error) throw error;

    const profile = await getProfile(data.user.id);
    return { session: data.session, profile };
  }

  const users = getMockUsers();
  const user = users.find(u => u.email === cleanEmail && u.password === password);
  if (!user) throw new Error('Invalid email or password.');

  const profile = await getProfile(user.id) || await upsertProfile({ id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role });
  const token = generateMockJWT({ id: user.id, email: user.email, name: user.name, phone: user.phone, role: profile.role });
  setCookie('jwt_token', token, 7);

  const session = {
    access_token: token,
    user: {
      id: user.id,
      email: user.email,
      user_metadata: { name: user.name, phone: user.phone, role: profile.role }
    }
  };

  notifyAuthListeners('SIGNED_IN', session);
  return { session, profile };
}

export async function loginWithGoogle() {
  if (isRealSupabase) {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/dashboard'
      }
    });
    if (error) throw error;
    return data;
  }

  const id = 'google-mock-user-id';
  const email = 'google.user@example.com';
  const name = 'Google User';
  const role = 'User';
  
  const users = getMockUsers();
  if (!users.some(u => u.id === id)) {
    users.push({ id, email, password: '', name, phone: '', role });
    localStorage.setItem('tb-mock-users', JSON.stringify(users));
  }

  const profile = await getProfile(id) || await upsertProfile({ id, name, email, phone: '', role });
  const token = generateMockJWT({ id, email, name, phone: '', role });
  setCookie('jwt_token', token, 7);

  window.location.href = window.location.origin + '/dashboard';
}

export async function saveContactMessage(values) {
  const payload = {
    name: sanitizeText(values.name),
    email: sanitizeText(values.email).toLowerCase(),
    phone: sanitizeText(values.phone || ''),
    subject: sanitizeText(values.subject),
    message: sanitizeText(values.message),
    is_read: false
  };

  if (isRealSupabase) {
    const { error } = await supabase
      .from('contact_messages')
      .insert(payload);
    if (error) throw error;
    return payload;
  }

  const messages = getContactMessages();
  const mockPayload = {
    ...payload,
    id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
    created_at: new Date().toISOString()
  };
  messages.push(mockPayload);
  localStorage.setItem('tb-mock-contact-messages', JSON.stringify(messages));
  return mockPayload;
}

export async function fetchContactMessages() {
  if (isRealSupabase) {
    const { data, error } = await supabase
      .from('contact_messages')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }
  return getContactMessages();
}

export async function updateContactMessage(id, patch) {
  if (isRealSupabase) {
    const { data, error } = await supabase
      .from('contact_messages')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const messages = getContactMessages();
  const idx = messages.findIndex(m => m.id === id);
  if (idx === -1) throw new Error('Message not found.');
  messages[idx] = { ...messages[idx], ...patch };
  localStorage.setItem('tb-mock-contact-messages', JSON.stringify(messages));
  return messages[idx];
}

export async function deleteContactMessage(id) {
  if (isRealSupabase) {
    const { error } = await supabase
      .from('contact_messages')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return;
  }

  const messages = getContactMessages();
  const filtered = messages.filter(m => m.id !== id);
  localStorage.setItem('tb-mock-contact-messages', JSON.stringify(filtered));
}

export async function uploadResume({ user, profile, file }) {
  if (!file) throw new Error('Please choose a resume file.');
  if (!/\.(pdf|doc|docx)$/i.test(file.name)) throw new Error('Upload PDF, DOC, or DOCX only.');
  if (!user?.id) throw new Error('Please login again before uploading your resume.');
  
  const cleanName = file.name.replace(/[^a-zA-Z0-9.]/g, '-');
  const storagePath = user.id + '/' + Date.now() + '-' + cleanName;

  if (isRealSupabase) {
    const { error: uploadError } = await supabase.storage
      .from('resumes')
      .upload(storagePath, file);
    if (uploadError) throw uploadError;

    // Generates a temporary signed URL valid for 24 hours
    const { data: urlData } = await supabase.storage
      .from('resumes')
      .createSignedUrl(storagePath, 60 * 60 * 24);

    const payload = {
      user_id: user.id,
      user_name: profile?.name || user.user_metadata?.name || user.email?.split('@')[0] || 'Techie Brains User',
      email: profile?.email || user.email,
      resume_path: storagePath,
      resume_file_name: cleanName,
      resume_url: urlData?.signedUrl || null,
      status: 'Pending'
    };

    const { data, error } = await supabase
      .from('resume_uploads')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  
  const objectUrl = URL.createObjectURL(file);
  const fileCache = JSON.parse(sessionStorage.getItem('tb-resume-files') || '{}');
  fileCache[storagePath] = { name: file.name, type: file.type, url: objectUrl };
  sessionStorage.setItem('tb-resume-files', JSON.stringify(fileCache));

  const resumes = getResumes();
  const payload = {
    id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
    user_id: user.id,
    user_name: profile?.name || user.user_metadata?.name || user.email?.split('@')[0] || 'Techie Brains User',
    email: profile?.email || user.email,
    resume_path: storagePath,
    resume_file_name: cleanName,
    resume_url: objectUrl,
    status: 'Pending',
    uploaded_at: new Date().toISOString()
  };
  resumes.push(payload);
  localStorage.setItem('tb-mock-resumes', JSON.stringify(resumes));
  return payload;
}

export async function fetchUserResume(userId) {
  if (isRealSupabase) {
    const { data, error } = await supabase
      .from('resume_uploads')
      .select('*')
      .eq('user_id', userId)
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  const resumes = getResumes();
  const userResumes = resumes.filter(r => r.user_id === userId);
  if (userResumes.length === 0) return null;
  userResumes.sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at));
  return userResumes[0];
}

export async function fetchResumes() {
  if (isRealSupabase) {
    const { data, error } = await supabase
      .from('resume_uploads')
      .select('*')
      .order('uploaded_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }
  return getResumes();
}

export async function updateResumeStatus(id, status) {
  if (isRealSupabase) {
    const { data: resume, error: updateError } = await supabase
      .from('resume_uploads')
      .update({ status })
      .eq('id', id)
      .select()
      .single();
    if (updateError) throw updateError;

    // Insert user notification
    await supabase.from('notifications').insert({
      user_id: resume.user_id,
      title: 'Application status updated',
      message: 'Your application status is now ' + status + '.',
      is_read: false
    });

    return resume;
  }

  const resumes = getResumes();
  const idx = resumes.findIndex(r => r.id === id);
  if (idx === -1) throw new Error('Resume not found.');
  resumes[idx].status = status;
  localStorage.setItem('tb-mock-resumes', JSON.stringify(resumes));

  const notifications = getNotifications();
  const notification = {
    id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
    user_id: resumes[idx].user_id,
    title: 'Application status updated',
    message: 'Your application status is now ' + status + '.',
    is_read: false,
    created_at: new Date().toISOString()
  };
  notifications.push(notification);
  localStorage.setItem('tb-mock-notifications', JSON.stringify(notifications));

  return resumes[idx];
}

export async function getResumeDownloadUrl(path) {
  if (isRealSupabase) {
    const { data, error } = await supabase.storage
      .from('resumes')
      .createSignedUrl(path, 60 * 5); // 5 minutes validity
    if (error) throw error;
    return data.signedUrl;
  }

  const fileCache = JSON.parse(sessionStorage.getItem('tb-resume-files') || '{}');
  if (fileCache[path]) {
    return fileCache[path].url;
  }
  const blob = new Blob(["Fallback Resume Content (Session reloaded). File name was: " + path.split('-').slice(1).join('-')], { type: 'text/plain' });
  return URL.createObjectURL(blob);
}

export async function fetchUsers() {
  if (isRealSupabase) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'User');
    if (error) throw error;
    return data || [];
  }
  const profiles = getProfiles();
  return profiles.filter(p => p.role === 'User');
}

export async function fetchStats() {
  if (isRealSupabase) {
    const { count: users } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'User');

    const { count: resumes } = await supabase
      .from('resume_uploads')
      .select('*', { count: 'exact', head: true });

    const { count: messages } = await supabase
      .from('contact_messages')
      .select('*', { count: 'exact', head: true });

    const { count: accepted } = await supabase
      .from('resume_uploads')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Accepted');

    const { count: rejected } = await supabase
      .from('resume_uploads')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Rejected');

    const { count: pending } = await supabase
      .from('resume_uploads')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Pending');

    return {
      users: users || 0,
      resumes: resumes || 0,
      messages: messages || 0,
      accepted: accepted || 0,
      rejected: rejected || 0,
      pending: pending || 0
    };
  }

  const profiles = getProfiles();
  const users = profiles.filter(p => p.role === 'User').length;
  const resumes = getResumes();
  const messages = getContactMessages().length;
  const accepted = resumes.filter(r => r.status === 'Accepted').length;
  const rejected = resumes.filter(r => r.status === 'Rejected').length;
  const pending = resumes.filter(r => r.status === 'Pending').length;

  return {
    users,
    resumes: resumes.length,
    messages,
    accepted,
    rejected,
    pending
  };
}

export async function fetchNotifications(userId) {
  if (!userId) return [];
  if (isRealSupabase) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }
  return getNotifications().filter(n => n.user_id === userId);
}

export async function markNotificationAsRead(id) {
  if (isRealSupabase) {
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  const notifications = getNotifications();
  const idx = notifications.findIndex(n => n.id === id);
  if (idx > -1) {
    notifications[idx].is_read = true;
    localStorage.setItem('tb-mock-notifications', JSON.stringify(notifications));
  }
}
