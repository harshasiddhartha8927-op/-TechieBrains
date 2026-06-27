import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import {
  ArrowRight, Bell, Check, CheckCircle2, ChevronDown, Download, Eye, FileUp,
  Linkedin, Lock, LogOut, Mail, MapPin, Menu, Moon, Phone, Search, Send, ShieldCheck, Sparkles, Sun, Trash2,
  User, Users, X
} from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { navLinks, stats, whyChoose, partnerships, staffingServices, consultingServices, testimonials, faqs, adminMetrics, chartData, techStack } from './data/content';
import { adminExists, allStatuses, createAdminAccount, deleteContactMessage as deleteContactMessageDb, fetchContactMessages, fetchResumes, fetchStats, fetchUserResume, fetchUsers, getProfile, getResumeDownloadUrl, loginWithGoogle, loginWithPassword, progressStatuses, registerUser, saveContactMessage, supabase, supabaseConfigured, updateContactMessage, updateResumeStatus, uploadResume, upsertProfile } from './lib/supabase';
import { useAppStore } from './store/useAppStore';

const page = { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -18 }, transition: { duration: 0.35 } };
const office = 'Flat No - 301, 3rd Floor, Madhu Enclave, Opp MaxCure Hospital, Patrika Nagar, HiTech City, Hyderabad - 500081, India';
const mailTo = 'mailto:info@techiebrains.com?subject=Inquiry%20from%20Techie%20Brains%20website';

function App() {
  const { theme, setAuth } = useAppStore();
  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);
  useEffect(() => {
    if (!supabase) return undefined;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session?.user) return;
      let profile = await getProfile(data.session.user.id).catch(() => null);
      if (!profile) profile = await upsertProfile(buildProfile(data.session.user)).catch(() => buildProfile(data.session.user));
      setAuth({ session: data.session, profile });
    });
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.user) return setAuth({ session: null, profile: null });
      let profile = await getProfile(session.user.id).catch(() => null);
      if (!profile) profile = await upsertProfile(buildProfile(session.user)).catch(() => buildProfile(session.user));
      setAuth({ session, profile });
    });
    return () => listener.subscription.unsubscribe();
  }, [setAuth]);
  return <Layout />;
}

function buildProfile(user, role = 'User') {
  return {
    id: user.id,
    name: user.user_metadata?.name || user.email?.split('@')[0] || 'Techie Brains User',
    email: user.email,
    phone: user.user_metadata?.phone || '',
    role
  };
}

function Layout() {
  const location = useLocation();
  return <><Shell /><main><AnimatePresence mode="wait"><Routes location={location} key={location.pathname}>
    <Route path="/" element={<Home />} />
    <Route path="/about" element={<About />} />
    <Route path="/services" element={<Services />} />
    <Route path="/testimonials" element={<Testimonials />} />
    <Route path="/faqs" element={<Faqs />} />
    <Route path="/contact" element={<Contact />} />
    <Route path="/login" element={<Login />} />
    <Route path="/dashboard" element={<Protected><UserDashboard /></Protected>} />
    <Route path="/admin/setup" element={<AdminSetup />} />
    <Route path="/admin" element={<Protected role="Admin"><AdminDashboard /></Protected>} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></AnimatePresence></main><Footer /></>;
}

function Shell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme, session, profile, logout } = useAppStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  useEffect(() => setMenuOpen(false), [location.pathname]);
  const authed = Boolean(session);
  const search = (event) => {
    event.preventDefault();
    const q = query.trim().toLowerCase();
    if (!q) return;
    const target = q.includes('staff') || q.includes('service') || q.includes('cloud') ? '/services' : q.includes('contact') || q.includes('resume') ? '/contact' : q.includes('faq') ? '/faqs' : q.includes('about') ? '/about' : '/';
    navigate(target);
    toast.success('Showing the closest section for "' + query + '"');
    setQuery('');
  };
  const handleLogout = async () => {
    if (supabase) await supabase.auth.signOut();
    logout();
    toast.success('Logged out');
    navigate('/');
  };
  return <>
    <header className="nav-shell">
      <Link to="/" className="brand" aria-label="Techie Brains home"><img src="/techiebrains-logo.png" alt="Techie Brains" /></Link>
      <nav className="desktop-nav" aria-label="Primary navigation">
        {navLinks.map(([to, label]) => <NavLink key={to} to={to}>{label}</NavLink>)}
        {authed ? <NavLink to={profile?.role === 'Admin' ? '/admin' : '/dashboard'}>Dashboard</NavLink> : <NavLink to="/login">Login</NavLink>}
      </nav>
      <form className="nav-search" onSubmit={search}><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" /></form>
      <div className="nav-actions">
        <button className="icon-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">{theme === 'dark' ? <Sun /> : <Moon />}</button>
        {authed && <button className="icon-btn" onClick={handleLogout} aria-label="Logout"><LogOut /></button>}
        <button className="icon-btn mobile-only" onClick={() => setMenuOpen(!menuOpen)} aria-label="Open menu">{menuOpen ? <X /> : <Menu />}</button>
      </div>
    </header>
    {menuOpen && <div className="mobile-menu">{navLinks.map(([to, label]) => <NavLink key={to} to={to}>{label}</NavLink>)}<NavLink to={authed ? profile?.role === 'Admin' ? '/admin' : '/dashboard' : '/login'}>{authed ? 'Dashboard' : 'Login'}</NavLink></div>}
  </>;
}

function Protected({ children, role }) {
  const { session, profile } = useAppStore();
  const isRedirect = window.location.hash.includes('access_token=') || window.location.hash.includes('id_token=');

  if (isRedirect && !session) {
    return (
      <div className="section" style={{ minHeight: '80vh', display: 'grid', placeItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <ShieldCheck size={48} className="spin" style={{ color: '#00D4FF', marginBottom: '16px' }} />
          <h2>Signing in with Google...</h2>
          <p style={{ color: 'var(--text-muted)' }}>Please wait while we verify your credentials.</p>
        </div>
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;
  if (role && profile?.role !== role) return <Navigate to="/dashboard" replace />;
  return children;
}

function Section({ eyebrow, title, children, className = '' }) {
  return <section className={'section ' + className}><div className="section-head"><span>{eyebrow}</span><h2>{title}</h2></div>{children}</section>;
}

function Card({ children, className = '', onClick }) {
  return <motion.div whileHover={{ y: -6 }} transition={{ type: 'spring', stiffness: 220, damping: 20 }} className={'glass-card ' + className} onClick={onClick}>{children}</motion.div>;
}

function ButtonLink({ to, href, children, variant = 'primary' }) {
  const className = variant === 'primary' ? 'gradient-btn' : 'secondary-btn';
  if (href) return <a className={className} href={href}>{children}<ArrowRight size={18} /></a>;
  return <Link className={className} to={to}>{children}<ArrowRight size={18} /></Link>;
}

function Home() {
  return <motion.div {...page}>
    <section className="hero">
      <div className="hero-bg" />
      <div className="hero-copy">
        <span className="pill"><Sparkles size={15} />Recruitment and IT Consulting</span>
        <h1>Techie Brains Inc.</h1>
        <p>Trusted recruitment, IT staffing, and consulting solutions for companies that need skilled technology professionals and reliable delivery support.</p>
        <div className="hero-actions"><ButtonLink to="/contact">Contact Us</ButtonLink><ButtonLink to="/services" variant="secondary">Our Services</ButtonLink></div>
        <div className="hero-trust"><span>Contract</span><span>Contract-to-Hire</span><span>Permanent Staffing</span><span>IT Consulting</span></div>
      </div>
    </section>
    <Section eyebrow="Why Choose Us" title="A refined recruitment model for high-stakes technology hiring.">
      <div className="feature-grid">{whyChoose.map(([title, Icon]) => <Card key={title}><Icon className="card-icon" /><h3>{title}</h3><p>Careful screening, clear communication, and delivery ownership from first call to final onboarding.</p></Card>)}</div>
    </Section>
    <Section eyebrow="Company Statistics" title="Client-ready proof points."><div className="stats-grid">{stats.map(([label, value]) => <Card key={label}><strong>{value}{label === 'Satisfaction' ? '%' : '+'}</strong><span>{label}</span></Card>)}</div></Section>
    <Section eyebrow="Featured Services" title="Capabilities clients can buy with confidence."><div className="service-strip">{consultingServices.slice(0, 6).map(([title, Icon, text]) => <Card key={title}><Icon className="card-icon" /><h3>{title}</h3><p>{text}</p><Link className="text-link" to="/services">View details</Link></Card>)}</div></Section>
    <Section eyebrow="Technology Stack" title="Modern platforms, practical delivery."><div className="logo-cloud">{techStack.map((item) => <span key={item}>{item}</span>)}</div></Section>
    <Partnerships />
    <section className="cta"><div><h2>Ready to accelerate hiring or delivery?</h2><p>Send requirements, upload a resume, or speak with the Techie Brains team today.</p></div><div className="cta-actions"><ButtonLink to="/contact">Contact Team</ButtonLink><ButtonLink href={mailTo} variant="secondary">Email Us</ButtonLink></div></section>
  </motion.div>;
}

function About() {
  return <motion.div {...page}>
    <section className="page-hero"><span className="pill">About Techie Brains</span><h1>Fast-growing IT services, solutions, products, and professional services.</h1><p>Techie Brains provides a positive, passionate, and collaborative work environment with opportunities to support elite global clients and next-generation technology programs.</p></section>
    <Section eyebrow="About Us" title="Quality recruitment starts with understanding the requirement."><div className="two-col"><Card><p>Every recruiter carefully studies client requirements before shortlisting candidates. This approach has enabled Techie Brains to consistently deliver high-quality talent to clients.</p><p>Profiles are evaluated for domain expertise, leadership, collaboration, communication, professionalism, and loyalty.</p></Card><div className="timeline">{['Domain Expertise', 'Leadership', 'Team Collaboration', 'Communication Skills', 'Professionalism', 'Loyalty'].map((item) => <div key={item}><Check />{item}</div>)}</div></div></Section>
    <section className="mission-grid"><Card><h2>Our Mission</h2><p>To strive for transcendence, encourage innovation by adopting the latest technological developments in the pursuit of providing quality business solutions.</p></Card><Card><h2>Our Vision</h2><p>We strive to provide clients trustworthy, cost-effective, scalable, and efficient solutions driven by passion, intellect, and integrity.</p></Card></section>
    <Partnerships />
  </motion.div>;
}

function Partnerships() {
  return <Section eyebrow="Our Partnerships" title="A partner ecosystem across staffing, technology, and enterprise delivery."><div className="partner-grid">{partnerships.map((name) => <div className="partner-logo" key={name}>{name}</div>)}</div></Section>;
}

function Services() {
  return <motion.div {...page}><section className="page-hero"><span className="pill">Services</span><h1>Right resources. Right cost. Right time.</h1><p>Techie Brains provides contract staffing, contract-to-hire, permanent staffing, full-time recruitment, and consulting services across enterprise technology domains.</p><div className="hero-actions"><ButtonLink to="/contact">Send Requirement</ButtonLink><ButtonLink href={mailTo} variant="secondary">Email Requirement</ButtonLink></div></section>
    <Section eyebrow="IT Staffing Services" title="Specialized recruitment across the full technology organization."><div className="chip-grid">{staffingServices.map((item) => <span key={item}>{item}</span>)}</div></Section>
    <Section eyebrow="IT Consulting Services" title="Premium consulting for transformation, operations, and delivery."><div className="feature-grid">{consultingServices.map(([title, Icon, text]) => <Card key={title}><Icon className="card-icon" /><h3>{title}</h3><p>{text}</p><ButtonLink to="/contact" variant="secondary">Discuss</ButtonLink></Card>)}</div></Section>
  </motion.div>;
}

function Testimonials({ preview = false }) {
  const shown = preview ? testimonials.slice(0, 2) : testimonials;
  return <motion.div {...(!preview ? page : {})}><Section eyebrow="Testimonials" title="Trusted by clients, consultants, and delivery teams."><div className="testimonial-grid">{shown.map(([who, quote]) => <Card key={who}><div className="stars">5.0 / 5 rating</div><p>{quote}</p><strong>{who}</strong></Card>)}</div>{preview && <Link className="section-link" to="/testimonials">View all testimonials <ArrowRight size={17} /></Link>}</Section></motion.div>;
}

function Faqs({ preview = false }) {
  const [open, setOpen] = useState(0);
  const shown = preview ? faqs.slice(0, 4) : faqs;
  return <motion.div {...(!preview ? page : {})}><Section eyebrow="FAQs" title="Clear answers for candidates and clients."><div className="faq-list">{shown.map(([question, answer], index) => <div className="faq-item" key={question}><button onClick={() => setOpen(open === index ? -1 : index)}><span>{question}</span><ChevronDown className={open === index ? 'spin' : ''} /></button>{open === index && <p>{answer}</p>}</div>)}</div>{preview && <Link className="section-link" to="/faqs">Browse all FAQs <ArrowRight size={17} /></Link>}</Section></motion.div>;
}

function Contact() {
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm();
  const { addContactMessage } = useAppStore();
  const onSubmit = async (values) => {
    try {
      await saveContactMessage(values);
      addContactMessage(values);
      toast.success('Message submitted successfully');
      reset();
    } catch (error) {
      toast.error(error.message || 'Could not submit message');
    }
  };
  return <motion.div {...page}><section className="page-hero"><span className="pill">Contact</span><h1>Start a hiring or consulting conversation.</h1><p>Send a requirement, candidate inquiry, partnership request, or service question. The form stores messages in Supabase when configured.</p></section>
    <section className="contact-stack"><Card><h2>Send a Message</h2><form className="form" onSubmit={handleSubmit(onSubmit)}><input {...register('name', { required: true })} placeholder="Name" /><input type="email" {...register('email', { required: true })} placeholder="Email" /><input {...register('phone')} placeholder="Phone" /><input {...register('subject', { required: true })} placeholder="Subject" /><textarea {...register('message', { required: true })} placeholder="Message" rows="5" /><button className="gradient-btn" disabled={isSubmitting}><Send size={18} />{isSubmitting ? 'Submitting...' : 'Submit Message'}</button></form></Card><Card><h2>Office Information</h2><p><MapPin />{office}</p><p><Phone />040-46032959</p><p><Mail />info@techiebrains.com</p><div className="contact-actions"><a className="secondary-btn" href="tel:04046032959"><Phone size={18} />Call Office</a><a className="secondary-btn" href={mailTo}><Mail size={18} />Email Team</a><a className="secondary-btn" href="https://www.linkedin.com/company/techie-brains-incorporated/about/" target="_blank" rel="noreferrer"><Linkedin size={18} />LinkedIn</a></div><iframe title="Techie Brains Hyderabad map" src="https://www.google.com/maps?q=Madhu%20Enclave%20Patrika%20Nagar%20HiTech%20City%20Hyderabad%20500081%20India&output=embed" loading="lazy" /></Card></section>
  </motion.div>;
}

function AdminSetup() {
  const navigate = useNavigate();
  const { register, handleSubmit } = useForm();
  const { setAuth } = useAppStore();
  const [checking, setChecking] = useState(true);
  const [exists, setExists] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabaseConfigured) {
      setChecking(false);
      return;
    }
    adminExists().then((value) => {
      setExists(value);
      if (value) navigate('/login', { replace: true });
    }).catch((error) => toast.error(error.message)).finally(() => setChecking(false));
  }, [navigate]);

  const submit = async (values) => {
    setBusy(true);
    try {
      const result = await createAdminAccount(values);
      if (result.session) {
        setAuth(result);
        toast.success('Admin account created');
        navigate('/admin');
      } else {
        toast.success('Admin account created. Please verify email, then login.');
        navigate('/login');
      }
    } catch (error) {
      toast.error(error.message || 'Could not create admin account');
    } finally {
      setBusy(false);
    }
  };

  if (!supabaseConfigured) return <motion.div {...page}><section className="auth-wrap"><Card className="auth-card"><img src="/techiebrains-logo.png" alt="Techie Brains" /><h1>Connect Supabase</h1><p className="auth-intro">Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env, run the SQL schema, then refresh this page to create the first admin account.</p></Card></section></motion.div>;
  if (checking) return <motion.div {...page}><section className="auth-wrap"><Card className="auth-card"><h1>Checking admin setup...</h1></Card></section></motion.div>;
  if (exists) return null;

  return <motion.div {...page}><section className="auth-wrap"><Card className="auth-card"><img src="/techiebrains-logo.png" alt="Techie Brains" /><span className="pill"><Lock size={15} />First Launch</span><h1>Create Admin Account</h1><p className="auth-intro">Only one admin account can be created. After this step, admin registration is locked and future admins must use Admin Login.</p><form className="form" onSubmit={handleSubmit(submit)}><input {...register('name', { required: true })} placeholder="Admin name" /><input type="email" {...register('email', { required: true })} placeholder="Admin email" /><input type="password" {...register('password', { required: true, minLength: 8 })} placeholder="Admin password" /><button className="gradient-btn" disabled={busy}>{busy ? 'Creating...' : 'Create Admin Account'}</button></form><div className="auth-links"><button onClick={() => navigate('/login')}>Admin Login</button></div></Card></section></motion.div>;
}

function Login() {
  const navigate = useNavigate();
  const { register, handleSubmit } = useForm();
  const { setAuth, session, profile } = useAppStore();
  const [mode, setMode] = useState('login');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session && profile) {
      navigate(profile.role === 'Admin' ? '/admin' : '/dashboard', { replace: true });
    }
  }, [session, profile, navigate]);

  const submit = async (values) => {
    setBusy(true);
    try {
      if (!supabaseConfigured) throw new Error('Authentication service is not connected. Configure Supabase before client delivery.');
      if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(values.email, { redirectTo: window.location.origin + '/login' });
        if (error) throw error;
        toast.success('Password reset link sent');
        return;
      }
      if (mode === 'register') {
        await registerUser(values);
        toast.success('Registration successful. Please verify email if confirmation is enabled.');
        setMode('login');
        return;
      }
      const result = await loginWithPassword(values);
      if (mode === 'admin' && result.profile.role !== 'Admin') throw new Error('This account does not have admin access.');
      if (mode !== 'admin' && result.profile.role === 'Admin') throw new Error('Please use Admin Login for this account.');
      setAuth(result);
      toast.success(mode === 'admin' ? 'Admin signed in' : 'Welcome back');
      navigate(result.profile.role === 'Admin' ? '/admin' : '/dashboard');
    } catch (error) {
      toast.error(error.message || 'Authentication failed');
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    try {
      if (!supabaseConfigured) throw new Error('Authentication service is not connected. Configure Supabase before client delivery.');
      await loginWithGoogle();
    } catch (error) {
      toast.error(error.message);
    }
  };

  return <motion.div {...page}><section className="auth-wrap"><Card className="auth-card"><img src="/techiebrains-logo.png" alt="Techie Brains" /><span className="pill"><Lock size={15} />Secure Access</span><h1>{mode === 'login' ? 'User Login' : mode === 'register' ? 'Create candidate account' : mode === 'admin' ? 'Admin Login' : 'Reset password'}</h1><p className="auth-intro">Users and administrators sign in separately. Admin registration is available only on first launch.</p>{mode !== 'admin' && <button type="button" className="google-btn" onClick={google}><span>G</span>Continue with Google</button>}<div className="divider"><span>or</span></div><form className="form" onSubmit={handleSubmit(submit)}>{mode === 'register' && <><input {...register('name', { required: true })} placeholder="Full name" /><input {...register('phone')} placeholder="Phone" /></>}<input type="email" {...register('email', { required: true })} placeholder={mode === 'admin' ? 'Admin email' : 'Email'} />{mode !== 'forgot' && <input type="password" {...register('password', { required: true, minLength: mode === 'register' ? 8 : 6 })} placeholder={mode === 'admin' ? 'Admin password' : 'Password'} />}<label className="check"><input type="checkbox" />Remember me</label><button className="gradient-btn" disabled={busy}>{busy ? 'Please wait...' : mode === 'forgot' ? 'Send Reset Link' : mode === 'admin' ? 'Login as Admin' : mode === 'register' ? 'Register' : 'Login'}</button></form><div className="auth-links"><button onClick={() => setMode('login')}>User Login</button><button onClick={() => setMode('register')}>Register</button><button onClick={() => setMode('forgot')}>Forgot Password</button><button onClick={() => setMode('admin')}>Admin Login</button><button onClick={() => navigate('/admin/setup')}>Create Admin</button></div><small>{supabaseConfigured ? 'Connected to Supabase authentication.' : 'Supabase keys are required for production login, Google sign-in, resume upload, and admin access.'}</small></Card></section></motion.div>;
}

function UserDashboard() {
  const { profile, resume, setResume, notifications, markNotificationRead, setProfile } = useAppStore();
  const [uploading, setUploading] = useState(false);
  const { register, handleSubmit } = useForm({ defaultValues: profile || {} });
  const progress = resume?.status === 'Rejected' ? -1 : progressStatuses.indexOf(resume?.status || 'Pending');

  useEffect(() => {
    if (!profile?.id || !supabaseConfigured) return;
    fetchUserResume(profile.id).then((data) => data && setResume(data)).catch((error) => toast.error(error.message));
  }, [profile?.id, setResume]);

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      if (!data.user) throw new Error('Please login again before uploading your resume.');

      const uploaded = await uploadResume({
        user: data.user,
        profile,
        file
      });

      setResume(uploaded);
      toast.success('Resume uploaded successfully');
    } catch (error) {
      toast.error(error.message || 'Resume upload failed');
      event.target.value = '';
    } finally {
      setUploading(false);
    }
  };
  const saveProfile = async (values) => {
    const next = { ...profile, ...values, role: 'User' };
    try {
      await upsertProfile(next);
      setProfile(next);
      toast.success('Profile updated');
    } catch (error) {
      toast.error(error.message || 'Profile update failed');
    }
  };

  return <motion.div {...page} className="dashboard"><DashboardHeader title="User Dashboard" subtitle="Manage your profile, resume, notifications, and application status." />
    <div className="dashboard-grid"><Card><User className="card-icon" /><h3>{profile?.name}</h3><p>{profile?.email}</p><p>{profile?.phone || 'Phone not added'}</p></Card><Card><FileUp className="card-icon" /><h3>Resume Upload</h3><label className="upload"><input type="file" accept=".pdf,.doc,.docx" onChange={handleFile} />{uploading ? 'Uploading...' : 'Upload PDF, DOC, DOCX'}</label>{resume ? <p>{resume.resume_file_name || resume.fileName}</p> : <p>No resume uploaded yet.</p>}</Card><Card><Bell className="card-icon" /><h3>Notifications</h3>{notifications.length ? notifications.map((item) => <button className={'notice ' + (item.is_read ? 'read' : '')} key={item.id} onClick={() => markNotificationRead(item.id)}><strong>{item.title}</strong><span>{item.message}</span></button>) : <p>No notifications yet.</p>}</Card></div>
    <Card className="wide"><h2>Application Status</h2>{resume ? <><div className="status-line">{progressStatuses.map((step, index) => <div className={index <= progress ? 'done' : ''} key={step}><span>{index + 1}</span><p>{step}</p></div>)}</div><p className={'badge status-' + resume.status.toLowerCase().replaceAll(' ', '-')}>Current: {resume.status}</p><p>{resume.remarks || 'Your application will update as the admin reviews your resume.'}</p></> : <p className="empty-state">Upload a resume to start tracking your application status.</p>}</Card>
    <Card className="wide"><h2>Account Settings</h2><form className="form settings-form" onSubmit={handleSubmit(saveProfile)}><input {...register('name', { required: true })} placeholder="Name" /><input type="email" {...register('email', { required: true })} placeholder="Email" /><input {...register('phone')} placeholder="Phone" /><button className="gradient-btn">Save Profile</button></form></Card>
  </motion.div>;
}

function AdminDashboard() {
  const { adminResumes, setAdminResumes, contactMessages, setContactMessages, adminUsers, setAdminUsers, deleteContactMessage, toggleContactMessageRead } = useAppStore();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [stats, setStats] = useState({ users: 0, resumes: 0, messages: 0, accepted: 0, rejected: 0, pending: 0 });

  const loadAdminData = async () => {
    if (!supabaseConfigured) return;
    try {
      const [users, resumes, messages, nextStats] = await Promise.all([fetchUsers(), fetchResumes(), fetchContactMessages(), fetchStats()]);
      setAdminUsers(users);
      setAdminResumes(resumes);
      setContactMessages(messages);
      setStats(nextStats);
    } catch (error) {
      toast.error(error.message || 'Could not load admin data');
    }
  };

  useEffect(() => { loadAdminData(); }, []);

  const rows = useMemo(() => adminResumes.filter((row) => {
    const text = ((row.user_name || '') + ' ' + (row.email || '') + ' ' + (row.status || '')).toLowerCase();
    return text.includes(query.toLowerCase()) && (filter === 'All' || row.status === filter);
  }), [adminResumes, query, filter]);

  const updateStatus = async (row, status) => {
    try {
      const updated = await updateResumeStatus(row.id, status);
      setAdminResumes(adminResumes.map((item) => item.id === row.id ? updated : item));
      setStats(await fetchStats());
      toast.success('Application status updated');
    } catch (error) {
      toast.error(error.message || 'Status update failed');
    }
  };

  const download = async (row) => {
    try {
      const url = await getResumeDownloadUrl(row.resume_path);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      toast.error(error.message || 'Download failed');
    }
  };

  const markMessage = async (message) => {
    try {
      await updateContactMessage(message.id, { is_read: !message.is_read });
      toggleContactMessageRead(message.id);
    } catch (error) {
      toast.error(error.message || 'Could not update message');
    }
  };

  const removeMessage = async (id) => {
    try {
      await deleteContactMessageDb(id);
      deleteContactMessage(id);
      setStats(await fetchStats());
      toast.success('Message deleted');
    } catch (error) {
      toast.error(error.message || 'Could not delete message');
    }
  };

  const metricCards = [
    ['Total Users', stats.users, Users], ['Total Resumes Uploaded', stats.resumes, FileUp], ['Total Contact Messages', stats.messages, Mail],
    ['Accepted Applications', stats.accepted, CheckCircle2], ['Rejected Applications', stats.rejected, X], ['Pending Applications', stats.pending, Bell]
  ];

  return <motion.div {...page} className="dashboard"><DashboardHeader title="Admin Dashboard" subtitle="Overview, users, resumes, contact messages, website statistics, and logout." />
    <div className="metric-grid">{metricCards.map(([label, value, Icon]) => <Card key={label}><Icon className="card-icon" /><strong>{value}</strong><span>{label}</span></Card>)}</div>
    <Card className="wide"><h2>Registered Users</h2>{adminUsers.length ? <div className="user-list">{adminUsers.map((user) => <div key={user.id}><span><strong>{user.name}</strong><small>{user.email} - {user.phone || 'No phone'}</small></span><span className="badge">{user.role}</span></div>)}</div> : <p className="empty-state">No users registered.</p>}</Card>
    <Card className="wide"><div className="table-head"><h2>Uploaded Resumes</h2><div className="table-tools"><label><Search size={18}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search resumes" /></label><select value={filter} onChange={(e) => setFilter(e.target.value)}><option>All</option>{allStatuses.map((status) => <option key={status}>{status}</option>)}</select></div></div>{rows.length ? <div className="table">{rows.map((row) => <div key={row.id}><span><strong>{row.user_name}</strong><small>{row.email} - {new Date(row.uploaded_at).toLocaleString()}</small><small>{row.resume_file_name}</small></span><select value={row.status} onChange={(e) => updateStatus(row, e.target.value)}>{allStatuses.map((status) => <option key={status}>{status}</option>)}</select><button onClick={() => toast.message(row.user_name, { description: row.resume_file_name })}><Eye />View</button><button onClick={() => download(row)}><Download />Download</button></div>)}</div> : <p className="empty-state">No resumes uploaded yet.</p>}</Card>
    <Card className="wide"><h2>Contact Messages</h2>{contactMessages.length ? <div className="message-list">{contactMessages.map((message) => <div key={message.id} className={message.is_read ? 'read-message' : ''}><span><strong>{message.subject}</strong><small>{message.name} - {message.email} - {new Date(message.created_at).toLocaleString()}</small></span><p>{message.message}</p><div><button className="secondary-btn" onClick={() => markMessage(message)}>{message.is_read ? 'Mark Unread' : 'Mark Read'}</button><button className="secondary-btn danger-text" onClick={() => removeMessage(message.id)}>Delete</button></div></div>)}</div> : <p className="empty-state">No contact messages received.</p>}</Card>
    <Card className="wide"><h2>Website Statistics</h2><ResponsiveContainer width="100%" height={260}><AreaChart data={[{ name: 'Users', value: stats.users }, { name: 'Resumes', value: stats.resumes }, { name: 'Messages', value: stats.messages }]}><CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.25)"/><XAxis dataKey="name"/><YAxis allowDecimals={false}/><Tooltip/><Area type="monotone" dataKey="value" stroke="#00D4FF" fill="rgba(0,212,255,.18)"/></AreaChart></ResponsiveContainer></Card>
  </motion.div>;
}

function DashboardHeader({ title, subtitle }) {
  return <section className="dash-head"><span className="pill"><ShieldCheck size={16}/>Protected Route</span><h1>{title}</h1><p>{subtitle}</p></section>;
}

function Footer() {
  const footerLinks = [['/', 'Home'], ['/about', 'About Us'], ['/services', 'Services'], ['/contact', 'Contact']];
  return <footer><div><img src="/techiebrains-logo.png" alt="Techie Brains" /><p>Premium recruitment and IT consulting for scalable, cost-effective, and trustworthy enterprise outcomes.</p><div className="footer-actions"><a href="https://www.linkedin.com/company/techie-brains-incorporated/about/" target="_blank" rel="noreferrer"><Linkedin size={18} />LinkedIn</a></div></div><div><h3>Quick Links</h3>{footerLinks.map(([to,label]) => <Link key={to} to={to}>{label}</Link>)}</div><div><h3>Services</h3><Link to="/services">IT Staffing</Link><Link to="/services">IT Consulting</Link><Link to="/contact">Send Requirement</Link></div><div><h3>Contact</h3><p>{office}</p><p>040-46032959</p><p>info@techiebrains.com</p><Link to="/contact">Contact Form</Link></div><small>Copyright (c) 2026 Techie Brains Inc. Privacy Policy | Terms & Conditions</small></footer>;
}

export default App;
